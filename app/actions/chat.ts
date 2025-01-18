"use server";

import { Message } from "ai";
import { Pinecone } from "@pinecone-database/pinecone";
import { OpenAIEmbeddings } from "@langchain/openai";
import { Document } from "langchain/document";
import { ChatOpenAI } from "@langchain/openai";
import { RunnableSequence } from "@langchain/core/runnables";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { PromptTemplate } from "@langchain/core/prompts";

const CONTEXT_PROMPT = PromptTemplate.fromTemplate(`
Answer the question based only on the following context:
{context}

Question: {question}
`);

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
    topK: 3,
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

  console.log("\n[RETRIEVAL] Found documents:");
  documents.forEach((doc, i) => {
    console.log(`\nDocument ${i + 1}:`);
    console.log(`Content: ${doc.pageContent.slice(0, 150)}...`);
    console.log(`Score: ${results.matches[i].score}`);
  });

  return documents;
}

export async function chatAction(messages: Message[]) {
  try {
    const lastMessage = messages[messages.length - 1];
    console.log("\n[CHAT] Processing message:", lastMessage.content);

    const relevantDocs = await getRelevantDocs(lastMessage.content);

    const llm = new ChatOpenAI({
      modelName: "gpt-3.5-turbo",
      temperature: 0,
    });

    const chain = RunnableSequence.from([
      {
        context: (input) =>
          input.context.map((doc: Document) => doc.pageContent).join("\n\n"),
        question: (input) => input.question,
      },
      CONTEXT_PROMPT,
      llm,
      new StringOutputParser(),
    ]);

    const response = await chain.invoke({
      context: relevantDocs,
      question: lastMessage.content,
    });

    console.log("\n[CHAT] Generated response:", response.slice(0, 150), "...");

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
