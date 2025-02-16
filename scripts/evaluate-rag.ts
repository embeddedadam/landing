import { config } from "dotenv";
import { resolve } from "path";

// Load environment variables from different env files in order
const envFiles = [".env.local", ".env"];
envFiles.forEach((file) => {
  config({ path: resolve(process.cwd(), file) });
});

import fs from "fs/promises";
import path from "path";
import { stringify } from "csv-stringify/sync";
import { RAGEvaluator } from "./rag-evaluator";
import {
  EvaluationQuestion,
  EvaluationResult,
  EvaluationMetrics,
} from "./types/evaluation";
import { fileURLToPath } from "url";

async function runEvaluation() {
  try {
    // Load test questions
    const questionsPath = path.join(
      process.cwd(),
      "evaluation",
      "questions.json",
    );
    const questions: EvaluationQuestion[] = JSON.parse(
      await fs.readFile(questionsPath, "utf-8"),
    );

    const evaluator = new RAGEvaluator();
    await evaluator.initialize();

    const results: EvaluationResult[] = [];
    const metrics: EvaluationMetrics = {
      totalQuestions: questions.length,
      averageResponseTime: 0,
      averageRelevanceScore: 0,
      coverage: 0,
      sourceAccuracy: 0,
      conceptAccuracy: 0,
    };

    // Evaluate each question
    for (const question of questions) {
      console.log(`Evaluating question: ${question.id}`);
      const result = await evaluator.evaluateQuestion(question);
      results.push(result);

      // Update metrics
      metrics.averageResponseTime += result.metadata.responseTime;
      if (result.metadata.relevanceScore) {
        metrics.averageRelevanceScore += result.metadata.relevanceScore;
      }
      if (result.metadata.sourceOverlap) {
        metrics.sourceAccuracy! += result.metadata.sourceOverlap;
      }
      if (result.metadata.conceptCoverage) {
        metrics.conceptAccuracy! += result.metadata.conceptCoverage;
      }
    }

    // Calculate final metrics
    const n = questions.length;
    metrics.averageResponseTime /= n;
    metrics.averageRelevanceScore /= n;
    metrics.coverage =
      results.filter((r) => r.references.length > 0).length / n;
    metrics.sourceAccuracy! /= n;
    metrics.conceptAccuracy! /= n;

    // Save results
    const outputDir = path.join(process.cwd(), "evaluation", "results");
    await fs.mkdir(outputDir, { recursive: true });

    // Save detailed results as CSV
    const csvData = stringify(results, { header: true });
    await fs.writeFile(path.join(outputDir, "evaluation_results.csv"), csvData);

    // Save metrics
    await fs.writeFile(
      path.join(outputDir, "metrics.json"),
      JSON.stringify(metrics, null, 2),
    );

    console.log("Evaluation completed successfully");
    console.log("Metrics:", metrics);
  } catch (error) {
    console.error("Evaluation failed:", error);
    process.exit(1);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const requiredEnvVars = [
    "OPENAI_API_KEY",
    "PINECONE_API_KEY",
    "PINECONE_INDEX_NAME",
  ];

  // Check for missing environment variables
  const missingVars = requiredEnvVars.filter((envVar) => !process.env[envVar]);
  if (missingVars.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missingVars.join(", ")}\n` +
        `Please ensure these are set in your .env file or environment.`,
    );
  }

  runEvaluation().catch(console.error);
}
