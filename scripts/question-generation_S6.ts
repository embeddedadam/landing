import fs from "fs";
import path from "path";
import { OpenAI } from "openai";
import { stringify } from "csv-stringify/sync";
import { CharacterTextSplitter } from "langchain/text_splitter";
import matter from "gray-matter";
import { marked } from "marked";
import removeMarkdown from "remove-markdown";
import url from "url";

interface GenerationConfig {
  sourceDirectory?: string;
  datasetName?: string;
  isDebug?: boolean;
  expectedAnswer?: string;
}

interface DocumentChunk {
  content: string;
  metadata: {
    filename: string;
    pageContent: string;
    title?: string;
    [key: string]: any;
  };
}

interface OutputRow {
  question_type: string;
  filename: string[];
  question: string;
  answer: string;
  chunks: string[];
}

async function generateNoAnswerQuestions(
  content: string,
  client: OpenAI,
  isDebug: boolean,
): Promise<string[]> {
  const prompt = `Based on the given text content, generate 3 questions that cannot be answered using only this content.
The questions should be:
1. Related to the domain/topic of the text
2. Specific and well-defined
3. Impossible to answer without additional information
4. Not answerable through inference from the given content

Format: Output only the questions, one per line.
Each question should end with a question mark.

Content:
\`\`\`
${content}
\`\`\`
`;

  const response = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.7,
  });

  const output = response.choices[0].message.content || "";
  return output.split("\n").filter((line) => line.trim().endsWith("?"));
}

async function verifyNoAnswer(
  question: string,
  content: string,
  client: OpenAI,
): Promise<boolean> {
  const prompt = `Question: "${question}"

Content to search for answer:
\`\`\`
${content}
\`\`\`

Can this question be answered using ONLY the information in the provided content?
Answer with only "YES" or "NO".`;

  const response = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    temperature: 0,
  });

  return (
    (response.choices[0].message.content || "").trim().toUpperCase() === "NO"
  );
}

async function processDocuments(
  filepath: string,
  isDebug: boolean,
): Promise<DocumentChunk[]> {
  try {
    const content = await fs.promises.readFile(filepath, "utf-8");
    const { data: frontmatter, content: markdownContent } = matter(content);

    const parsedContent = marked.parse(markdownContent) as string;
    const cleanContent = removeMarkdown(parsedContent)
      .replace(/\s+/g, " ")
      .trim();

    const textSplitter = new CharacterTextSplitter({
      separator: "\n",
      chunkSize: 3000,
      chunkOverlap: 150,
    });

    const chunks = await textSplitter.createDocuments([cleanContent]);

    return chunks.map((chunk) => ({
      content: chunk.pageContent,
      metadata: {
        filename: path.basename(filepath),
        pageContent: chunk.pageContent,
        title: frontmatter.title || path.basename(filepath, ".md"),
        ...frontmatter,
      },
    }));
  } catch (error) {
    console.error(`Error processing ${filepath}:`, error);
    return [];
  }
}

async function main({
  sourceDirectory = path.join(process.cwd(), "content/articles/"),
  datasetName = "dataset-s6",
  isDebug = process.env.NODE_ENV === "development",
  expectedAnswer = "The system doesn't know the answer",
}: GenerationConfig = {}) {
  console.log("Starting S6 question generation...");
  console.log("Source directory:", sourceDirectory);

  const chunksMap = new Map<string, DocumentChunk[]>();
  const files = await fs.promises.readdir(sourceDirectory);
  const markdownFiles = files.filter((file) => file.endsWith(".md"));

  console.log(`Found ${markdownFiles.length} markdown files`);

  for (const filename of markdownFiles) {
    const filepath = path.join(sourceDirectory, filename);
    const chunks = await processDocuments(filepath, isDebug);
    chunksMap.set(filename, chunks);
  }

  const client = new OpenAI();
  const outputs: OutputRow[] = [];
  const targetQuestions = 10;

  const allContent = Array.from(chunksMap.values())
    .flat()
    .map((chunk) => chunk.content)
    .join("\n\n");

  while (outputs.length < targetQuestions) {
    try {
      const randomFile =
        markdownFiles[Math.floor(Math.random() * markdownFiles.length)];
      const chunks = chunksMap.get(randomFile) || [];
      if (chunks.length === 0) continue;

      const randomChunk = chunks[Math.floor(Math.random() * chunks.length)];
      const questions = await generateNoAnswerQuestions(
        randomChunk.content,
        client,
        isDebug,
      );

      for (const question of questions) {
        const isUnanswerable = await verifyNoAnswer(
          question,
          allContent,
          client,
        );

        if (isUnanswerable && outputs.length < targetQuestions) {
          outputs.push({
            question_type: "S6_NO_ANSWER",
            filename: [randomFile],
            question,
            answer: expectedAnswer,
            chunks: [randomChunk.content],
          });

          if (isDebug) {
            console.log(
              `Generated question ${outputs.length}/${targetQuestions}:`,
              question,
            );
          }
        }
      }
    } catch (error) {
      console.error("Error generating questions:", error);
    }
  }

  const outputDir = path.join("outputs", datasetName);
  await fs.promises.mkdir(outputDir, { recursive: true });
  const outputPath = path.join(
    outputDir,
    `questions_${new Date().toISOString().replace(/[:.]/g, "_")}.csv`,
  );
  await fs.promises.writeFile(outputPath, stringify(outputs, { header: true }));

  console.log(`\nResults saved to: ${outputPath}`);
  return outputs;
}

if (import.meta.url === url.pathToFileURL(process.argv[1]).href) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY environment variable is required");
  }

  main().catch(console.error);
}
