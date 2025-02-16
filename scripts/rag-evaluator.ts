import { PineconeStore } from "@langchain/community/vectorstores/pinecone";
import { OpenAIEmbeddings } from "@langchain/openai";
import { OpenAI } from "openai";
import type { EvaluationQuestion, EvaluationResult } from "./types/evaluation";
import { Pinecone } from "@pinecone-database/pinecone";
import { Message } from "ai";
import { chatAction } from "@/app/actions/chat";

async function initPinecone() {
  const pinecone = new Pinecone({
    apiKey: process.env.PINECONE_API_KEY!,
  });
  return pinecone;
}

export async function generateRagResponse(question: string) {
  const messages: Message[] = [
    {
      id: "1",
      role: "user",
      content: question,
    },
  ];

  try {
    const response = await chatAction(messages);

    return {
      answer: response.messages[0].content,
      sources: [],
    };
  } catch (error) {
    console.error("Error generating RAG response:", error);
    return {
      answer: "Error generating response",
      sources: [],
    };
  }
}

export class RAGEvaluator {
  private vectorStore: PineconeStore | null = null;
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI();
  }

  async initialize() {
    const pinecone = await initPinecone();
    const index = pinecone.Index(process.env.PINECONE_INDEX_NAME!);

    this.vectorStore = await PineconeStore.fromExistingIndex(
      new OpenAIEmbeddings(),
      { pineconeIndex: index },
    );
  }

  async evaluateQuestion(
    question: EvaluationQuestion,
  ): Promise<EvaluationResult> {
    const startTime = Date.now();

    const { answer, sources } = await generateRagResponse(question.question);
    const responseTime = Date.now() - startTime;

    const [relevanceScore, sourceOverlap, conceptCoverage] = await Promise.all([
      question.expectedAnswer
        ? this.calculateRelevanceScore(answer, question.expectedAnswer)
        : Promise.resolve(undefined),
      this.calculateSourceOverlap(
        sources.map((s: any) => s.source),
        question.metadata?.sourceFiles || [],
      ),
      this.calculateConceptCoverage(answer, question.metadata?.concepts || []),
    ]);

    return {
      questionId: question.id,
      question: question.question,
      systemAnswer: answer,
      expectedAnswer: question.expectedAnswer,
      references: sources.map((s: any) => s.source),
      metadata: {
        responseTime,
        relevanceScore,
        sourceOverlap,
        conceptCoverage,
      },
    };
  }

  private async calculateRelevanceScore(
    systemAnswer: string,
    expectedAnswer: string,
  ): Promise<number> {
    const response = await this.openai.embeddings.create({
      model: "text-embedding-ada-002",
      input: [systemAnswer, expectedAnswer],
    });

    const [vec1, vec2] = response.data.map((d) => d.embedding);
    return this.cosineSimilarity(vec1, vec2);
  }

  private async calculateSourceOverlap(
    systemSources: string[],
    expectedSources: string[],
  ): Promise<number> {
    if (!expectedSources.length) return 1;

    const overlap = systemSources.filter((source) =>
      expectedSources.includes(source),
    ).length;

    return overlap / Math.max(systemSources.length, expectedSources.length);
  }

  private async calculateConceptCoverage(
    answer: string,
    expectedConcepts: string[],
  ): Promise<number> {
    if (!expectedConcepts.length) return 1;

    const response = await this.openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are an evaluator. Given a list of expected concepts and an answer, 
determine how many of the concepts are meaningfully covered in the answer.
Respond with a number between 0 and 1 representing the coverage ratio.`,
        },
        {
          role: "user",
          content: `Expected concepts: ${expectedConcepts.join(", ")}
Answer: ${answer}`,
        },
      ],
    });

    const content = response.choices[0]?.message?.content;
    if (!content) throw new Error("No response from OpenAI");

    const score = parseFloat(content);
    return isNaN(score) ? 0 : Math.max(0, Math.min(1, score));
  }

  private cosineSimilarity(vec1: number[], vec2: number[]): number {
    const dotProduct = vec1.reduce((acc, val, i) => acc + val * vec2[i], 0);
    const mag1 = Math.sqrt(vec1.reduce((acc, val) => acc + val * val, 0));
    const mag2 = Math.sqrt(vec2.reduce((acc, val) => acc + val * val, 0));
    return dotProduct / (mag1 * mag2);
  }
}
