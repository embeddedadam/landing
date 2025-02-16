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

async function generateNumericQuestion(
  chunk: DocumentChunk,
  client: OpenAI,
): Promise<OutputRow | null> {
  const hasNumbers = /\d+/.test(chunk.content);
  if (!hasNumbers) return null;

  try {
    const questionResponse = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are a question generator focused on numerical information. 
          Generate a specific question that asks for a number from the given text.
          The answer must be clearly stated in the text and be a specific number.
          Do not generate questions about dates or years - only quantities, measurements, statistics, or counts.
          The question should require minimal inference and have an unambiguous numerical answer.`,
        },
        {
          role: "user",
          content: chunk.content,
        },
      ],
      temperature: 0.3,
    });

    const question = questionResponse.choices[0]?.message?.content;
    if (!question) return null;

    const answerResponse = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `Extract the exact numerical answer to the question from the text. 
          Respond only with the number, without any additional text.
          If the answer involves multiple numbers or is ambiguous, respond with "INVALID".`,
        },
        {
          role: "user",
          content: `Question: ${question}\n\nText: ${chunk.content}`,
        },
      ],
      temperature: 0,
    });

    const answer = answerResponse.choices[0]?.message?.content;
    if (!answer || answer === "INVALID") return null;

    const numericAnswer = answer.replace(/,/g, "");
    if (!/^\d+(\.\d+)?$/.test(numericAnswer)) return null;

    return {
      question_type: "S1_NUMERIC",
      filename: [chunk.metadata.filename],
      question: question.trim(),
      answer: answer.trim(),
      chunks: [chunk.content],
    };
  } catch (error) {
    console.error("Error generating numeric question:", error);
    return null;
  }
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
  datasetName = "dataset-s1",
  isDebug = process.env.NODE_ENV === "development",
}: GenerationConfig = {}) {
  const chunksMap = new Map<string, DocumentChunk[]>();
  const files = await fs.promises.readdir(sourceDirectory);
  const markdownFiles = files.filter((file) => file.endsWith(".md"));

  for (const filename of markdownFiles) {
    const filepath = path.join(sourceDirectory, filename);
    const chunks = await processDocuments(filepath, isDebug);
    chunksMap.set(filename, chunks);
  }

  const client = new OpenAI();
  const outputs: OutputRow[] = [];

  for (const [filename, chunks] of chunksMap) {
    if (isDebug) {
      console.log(`Processing ${filename}...`);
    }

    for (const chunk of chunks) {
      const questionRow = await generateNumericQuestion(chunk, client);
      if (questionRow) {
        outputs.push(questionRow);
        if (isDebug) {
          console.log("Generated question:", questionRow);
        }
      }
    }
  }

  const outputDir = path.join("outputs", datasetName);
  await fs.promises.mkdir(outputDir, { recursive: true });
  const outputPath = path.join(
    outputDir,
    `questions_${new Date().toISOString().replace(/[:.]/g, "_")}.csv`,
  );
  await fs.promises.writeFile(outputPath, stringify(outputs, { header: true }));

  return outputs;
}

if (import.meta.url === url.pathToFileURL(process.argv[1]).href) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY environment variable is required");
  }

  main().catch(console.error);
}
