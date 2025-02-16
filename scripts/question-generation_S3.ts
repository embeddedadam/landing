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

async function generateMultipleChoiceQuestion(
  chunk: string,
  client: OpenAI,
  isDebug: boolean,
): Promise<{ question: string; answer: string }> {
  const prompt = `Generate a multiple choice question with 4 possible choices focusing around a significant named entity identified within the given context.
When generating the question, be as succinct and concise as you can. The generated question should not have reference to the given text.
Do not provide explanations. The list of choices should only have one correct answer. Strictly ensure the correctness of each question, choices and answer.
Format your output as a JSON object with a "question" and "answer" pair.
The question should include the choices labeled as A), B), C), and D).
The answer should only be the letter of the correct choice (A, B, C, or D).

Context:
\`\`\`
${chunk}
\`\`\`
`;

  if (isDebug) {
    console.log("Formatted Prompt:", prompt);
  }

  const response = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
  });

  const output = response.choices[0].message.content;
  if (!output) throw new Error("No response from OpenAI");

  // Clean the response by removing markdown code blocks
  const cleanedOutput = output
    .replace(/```json\n/g, '')
    .replace(/```\n?/g, '')
    .trim();

  try {
    return JSON.parse(cleanedOutput);
  } catch (error) {
    throw new Error(`Failed to parse GPT response: ${error}`);
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
  datasetName = "dataset-s3",
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

  for (const [filename, chunks] of chunksMap.entries()) {
    for (const chunk of chunks) {
      try {
        const { question, answer } = await generateMultipleChoiceQuestion(
          chunk.content,
          client,
          isDebug,
        );

        outputs.push({
          question_type: "S3_MULTIPLE_CHOICE",
          filename: [filename],
          question,
          answer,
          chunks: [chunk.content],
        });
      } catch (error) {
        console.error(`Error generating question for ${filename}:`, error);
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
