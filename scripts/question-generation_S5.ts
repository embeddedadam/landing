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

async function generateMultiFileQuestions(
  chunks: string[],
  filenames: string[],
  client: OpenAI,
  isDebug: boolean,
): Promise<Array<{ question: string; answer: string }>> {
  const prompt = `Generate specific questions about the key information in each of the following three texts. Each text is from a different document.
The questions must be focused and specific, not general. The answer must be directly stated in the given text.
Format output as a JSON array where each object has "question" and "answer" fields.
Each question should focus on information from a single text - do not combine information across texts.

Text 1 (from ${filenames[0]}):
\`\`\`
${chunks[0]}
\`\`\`

Text 2 (from ${filenames[1]}):
\`\`\`
${chunks[1]}
\`\`\`

Text 3 (from ${filenames[2]}):
\`\`\`
${chunks[2]}
\`\`\`
`;

  if (isDebug) {
    console.log("\nGenerating questions for files:", filenames.join(", "));
    console.log(
      "Chunk lengths:",
      chunks.map((c) => c.length),
    );
  }

  const response = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.3,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error("No content in response");

  try {
    const cleanedContent = content
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();

    const parsed = JSON.parse(cleanedContent);
    if (!Array.isArray(parsed)) {
      throw new Error("Response is not an array");
    }

    if (isDebug) {
      console.log("Generated questions:", parsed.length);
    }

    return parsed;
  } catch (error) {
    if (isDebug) {
      console.error("Raw response:", content);
    }
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
  datasetName = "dataset-s5",
  isDebug = process.env.NODE_ENV === "development",
}: GenerationConfig = {}) {
  console.log("Starting S5 question generation...");
  console.log("Source directory:", sourceDirectory);

  const chunksMap = new Map<string, DocumentChunk[]>();
  const files = await fs.promises.readdir(sourceDirectory);
  const markdownFiles = files.filter((file) => file.endsWith(".md"));

  console.log(`Found ${markdownFiles.length} markdown files`);

  for (const filename of markdownFiles) {
    const filepath = path.join(sourceDirectory, filename);
    const chunks = await processDocuments(filepath, isDebug);
    if (chunks.length > 0) {
      chunksMap.set(filename, chunks);
      if (isDebug) {
        console.log(`Processed ${filename}: ${chunks.length} chunks`);
      }
    }
  }

  const client = new OpenAI();
  const outputs: OutputRow[] = [];
  const targetQuestions = 10;
  let attempts = 0;
  const maxAttempts = targetQuestions * 2;

  console.log(
    `\nGenerating ${targetQuestions} sets of multi-file questions...`,
  );

  while (outputs.length < targetQuestions && attempts < maxAttempts) {
    attempts++;
    try {
      const fileNames = Array.from(chunksMap.keys());
      if (fileNames.length < 3) {
        throw new Error("Not enough files available (need at least 3)");
      }

      const selectedFiles = fileNames
        .sort(() => Math.random() - 0.5)
        .slice(0, 3);

      const selectedChunks = selectedFiles
        .map((filename) => {
          const chunks = chunksMap.get(filename) || [];
          if (chunks.length === 0) return null;
          return chunks[Math.floor(Math.random() * chunks.length)].content;
        })
        .filter((chunk): chunk is string => chunk !== null);

      if (selectedChunks.length < 3) {
        if (isDebug) {
          console.warn("Skipping: Not enough valid chunks");
        }
        continue;
      }

      const questions = await generateMultiFileQuestions(
        selectedChunks,
        selectedFiles,
        client,
        isDebug,
      );

      if (!questions || questions.length === 0) {
        if (isDebug) {
          console.warn("Skipping: No questions generated");
        }
        continue;
      }

      outputs.push({
        question_type: "S5_MULTIPLE_QUESTIONS_MULTI_DOC",
        filename: selectedFiles,
        question: questions
          .map((q) => q?.question || "")
          .filter(Boolean)
          .join(" | "),
        answer: questions
          .map((q) => q?.answer || "")
          .filter(Boolean)
          .join(" | "),
        chunks: selectedChunks,
      });

      console.log(
        `Generated question set ${outputs.length}/${targetQuestions}`,
      );
    } catch (error) {
      console.error("Error in generation attempt:", error);
    }
  }

  if (outputs.length < targetQuestions) {
    console.warn(
      `Warning: Only generated ${outputs.length} question sets out of ${targetQuestions} target`,
    );
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
