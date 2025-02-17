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
  const llm = new ChatOpenAI({
    modelName: "gpt-4o-mini",
    temperature: 0,
  });

  const rerankPrompt = PromptTemplate.fromTemplate(`
    You are a document relevance scoring system. Rate each document's relevance to the query on a scale of 0-100.
    Consider both semantic meaning and keyword matches when scoring.
    - High scores (80-100): Perfect semantic and keyword matches
    - Medium scores (40-79): Good semantic match or multiple keyword matches
    - Low scores (0-39): Poor matches or irrelevant content

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

  return rerankedDocs.sort((a, b) => b.score - a.score);
}

interface PineconeMatch {
  id: string;
  score?: number;
  metadata?: {
    content?: string;
    text?: string;
    [key: string]: unknown;
  };
}

async function getRelevantDocs(query: string) {
  const pinecone = new Pinecone({
    apiKey: process.env.PINECONE_API_KEY!,
  });

  const index = pinecone.Index(process.env.PINECONE_INDEX_NAME!);
  const embeddings = new OpenAIEmbeddings({
    openAIApiKey: process.env.OPENAI_API_KEY,
  });

  console.log("[HYBRID-RAG] Processing query:", query);
  const keywords = query.toLowerCase().split(/\s+/);
  console.log("[HYBRID-RAG] Extracted keywords:", keywords);

  const queryEmbedding = await embeddings.embedQuery(query);
  const vectorResults = await index.query({
    vector: queryEmbedding,
    topK: 15,
    includeMetadata: true,
  });
  console.log("[HYBRID-RAG] Vector search results:", {
    matchCount: vectorResults.matches.length,
    topScore: vectorResults.matches[0]?.score,
  });

  const keywordPromises = keywords.map((keyword) =>
    index.query({
      vector: new Array(1536).fill(0),
      topK: 5,
      includeMetadata: true,
      filter: {
        text: keyword,
      },
    }),
  );

  const keywordResponses = await Promise.all(keywordPromises);
  const keywordResults = keywordResponses.flatMap((r) => r.matches);
  console.log("[HYBRID-RAG] Keyword search results:", {
    totalMatches: keywordResults.length,
    matchesPerKeyword: keywordResponses.map((r) => r.matches.length),
  });

  const scoreMap = new Map<
    string,
    {
      score: number;
      match: PineconeMatch;
    }
  >();

  vectorResults.matches.forEach((match) => {
    scoreMap.set(match.id, {
      score: (match.score || 0) * 0.6,
      match,
    });
  });

  keywordResults.forEach((match) => {
    const existingEntry = scoreMap.get(match.id);
    const keywordScore = (match.score || 0) * 0.4;

    if (existingEntry) {
      existingEntry.score += keywordScore;
    } else {
      scoreMap.set(match.id, { score: keywordScore, match });
    }
  });

  console.log("[HYBRID-RAG] Combined results:", {
    totalUnique: scoreMap.size,
    scoreRange: {
      min: Math.min(...Array.from(scoreMap.values()).map((v) => v.score)),
      max: Math.max(...Array.from(scoreMap.values()).map((v) => v.score)),
    },
  });

  const documents = Array.from(scoreMap.values())
    .sort((a, b) => b.score - a.score)
    .map(
      ({ match }) =>
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
  console.log("[HYBRID-RAG] Final reranked docs:", {
    count: rerankedDocs.length,
    topScore: rerankedDocs[0]?.score,
  });

  return rerankedDocs.slice(0, 3);
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
      .slice(-4)
      .map((msg) => `${msg.role}: ${msg.content}`)
      .join("\n");

    const lastMessage = messages[messages.length - 1];

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
      new ChatOpenAI({ modelName: "gpt-4o-mini", temperature: 0 }),
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
