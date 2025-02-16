import fs from "fs/promises";
import path from "path";
import { parse } from "csv-parse/sync";
import { v4 as uuidv4 } from "uuid";

async function combineQuestions() {
  const outputsDir = path.join(process.cwd(), "outputs");
  const datasets = [
    "dataset-s1",
    "dataset-s2",
    "dataset-s3",
    "dataset-s4",
    "dataset-s5",
    "dataset-s6",
  ];

  const questions = [];

  for (const dataset of datasets) {
    const datasetDir = path.join(outputsDir, dataset);
    try {
      const files = await fs.readdir(datasetDir);
      const questionFiles = files.filter((f) => f.startsWith("questions_"));

      for (const file of questionFiles) {
        try {
          const content = await fs.readFile(
            path.join(datasetDir, file),
            "utf-8",
          );
          const rows = parse(content, { columns: true });

          questions.push(
            ...rows.map((row: any) => ({
              id: uuidv4(),
              question: row.question,
              expectedAnswer: row.answer,
              metadata: {
                sourceFiles: row.filename ? row.filename.split(",") : [],
                concepts: row.chunks ? row.chunks.split(",") : [],
              },
            })),
          );
        } catch (error: any) {
          console.warn(`Skipping file ${file} in ${dataset}: ${error.message}`);
        }
      }
    } catch (error: any) {
      console.warn(`Skipping dataset ${dataset}: ${error.message}`);
    }
  }

  await fs.mkdir(path.join(process.cwd(), "evaluation"), { recursive: true });
  await fs.writeFile(
    path.join(process.cwd(), "evaluation", "questions.json"),
    JSON.stringify(questions, null, 2),
  );
}

combineQuestions().catch(console.error);
