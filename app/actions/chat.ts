"use server";

import { Message } from "ai";
import { Pinecone } from "@pinecone-database/pinecone";
import { OpenAIEmbeddings } from "@langchain/openai";
import { Document } from "langchain/document";
import { ChatOpenAI } from "@langchain/openai";
import { RunnableSequence } from "@langchain/core/runnables";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { PromptTemplate } from "@langchain/core/prompts";

interface RankedDocument extends Document {
  score: number;
}

async function rerankDocuments(
  query: string,
  documents: Document[],
): Promise<RankedDocument[]> {
  console.log("\n[RERANK] Starting reranking for query:", query);

  const llm = new ChatOpenAI({
    modelName: "gpt-4-turbo-preview",
    temperature: 0,
  });

  const rerankPrompt = PromptTemplate.fromTemplate(`
    You are a document relevance scoring system. Rate each document's relevance to the query on a scale of 0-100.
    Respond with only numbers separated by commas, matching the order of documents provided.

    Query: {query}

    Documents to score:
    {documents}

    Scores (comma-separated):
  `);

  const documentsList = documents
    .map((doc, i) => `Document ${i + 1}: ${doc.pageContent.slice(0, 1000)}`)
    .join("\n\n");

  const response = await llm.invoke(
    await rerankPrompt.format({
      query,
      documents: documentsList,
    }),
  );

  const scores = (response.content as string)
    .split(",")
    .map((score: string) => parseInt(score.trim()))
    .map((score: number) => (isNaN(score) ? 0 : score));

  const rerankedDocs: RankedDocument[] = documents.map((doc, i) => ({
    ...doc,
    score: scores[i] || 0,
  }));

  const sortedDocs = rerankedDocs.sort((a, b) => b.score - a.score);

  console.log("\n[RERANK] Reranking scores:");
  sortedDocs.forEach((doc, i) => {
    console.log(`Document ${i + 1} score: ${doc.score}`);
  });

  return sortedDocs;
}

async function getRelevantDocs(query: string) {
  console.log("\n[RETRIEVAL] Query:", query);

  const pinecone = new Pinecone({
    apiKey: process.env.PINECONE_API_KEY!,
  });

  const index = pinecone.Index(process.env.PINECONE_INDEX_NAME!);
  const embeddings = new OpenAIEmbeddings({
    openAIApiKey: process.env.OPENAI_API_KEY,
  });

  const queryEmbedding = await embeddings.embedQuery(query);
  const results = await index.query({
    vector: queryEmbedding,
    topK: 10,
    includeMetadata: true,
  });

  const documents = results.matches.map(
    (match) =>
      new Document({
        pageContent:
          match.metadata?.content?.toString() ||
          match.metadata?.text?.toString() ||
          "",
        metadata: {
          ...match.metadata,
          score: match.score?.toString(),
        },
      }),
  );

  const rerankedDocs = await rerankDocuments(query, documents);

  const topDocs = rerankedDocs.slice(0, 3);

  console.log("\n[RETRIEVAL] Top reranked documents:");
  topDocs.forEach((doc, i) => {
    console.log(`\nDocument ${i + 1}:`);
    console.log(`Content: ${doc.pageContent.slice(0, 150)}...`);
    console.log(`Score: ${doc.score}`);
  });

  return topDocs;
}

const CONTEXT_PROMPT = PromptTemplate.fromTemplate(`
Previous conversation:
{history}

Context information:
{context}

Current question: {question}

Instructions:
- Use the provided context to answer the question
- Maintain consistency with previous responses
- If the context doesn't contain relevant information, say so
- Stay focused on the topic from provided context
`);

export async function chatAction(messages: Message[]) {
  try {
    const conversationHistory = messages
      .slice(-4) // Keep last 4 messages for context
      .map((msg) => `${msg.role}: ${msg.content}`)
      .join("\n");

    const lastMessage = messages[messages.length - 1];

    // Augment query with conversation context
    const augmentedQuery = `
      Previous messages:
      ${conversationHistory}
      Current question: ${lastMessage.content}
    `;

    const relevantDocs = await getRelevantDocs(augmentedQuery);

    const chain = RunnableSequence.from([
      {
        history: () => conversationHistory,
        context: (input) =>
          input.context.map((doc: Document) => doc.pageContent).join("\n\n"),
        question: (input) => input.question,
      },
      CONTEXT_PROMPT,
      new ChatOpenAI({ modelName: "gpt-4-turbo-preview", temperature: 0 }),
      new StringOutputParser(),
    ]);

    const response = await chain.invoke({
      context: relevantDocs,
      question: lastMessage.content,
    });

    return {
      messages: [
        {
          id: messages.length.toString(),
          role: "assistant",
          content: response,
        },
      ],
    };
  } catch (error) {
    console.error("[CHAT] Error:", error);
    throw new Error("Failed to generate response");
  }
}
