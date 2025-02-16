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

async function generateDateTimeQuestion(
  chunk: DocumentChunk,
  client: OpenAI,
): Promise<OutputRow | null> {
  const hasDateTime =
    /\b(19|20)\d{2}\b|\b\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}\b|\b(?:january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2}(?:st|nd|rd|th)?\s*,?\s*\d{4}\b|\b(?:yesterday|today|tomorrow|last\s+(?:week|month|year))\b/i.test(
      chunk.content,
    );

  if (!hasDateTime) {
    console.log(
      "No datetime found in chunk:",
      chunk.content.slice(0, 100) + "...",
    );
    return null;
  }

  try {
    console.log(
      "Generating question for datetime content:",
      chunk.content.slice(0, 100) + "...",
    );

    const questionResponse = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are a question generator focused on dates and times.
Generate a specific question that asks about a date or time from the given text.
The answer must be clearly stated in the text and be a specific date, time, or duration.
Focus on:
- Specific dates (e.g., "When was X founded?")
- Time periods (e.g., "How long did Y last?")
- Year-based questions (e.g., "What year did Z occur?")
- Relative time (e.g., "How long ago...?")
The question should require minimal inference and have an unambiguous temporal answer.
If no clear temporal information is found, respond with "INVALID".`,
        },
        {
          role: "user",
          content: chunk.content,
        },
      ],
      temperature: 0.3,
      max_tokens: 150,
    });

    const question = questionResponse.choices[0]?.message?.content;
    if (!question || question === "INVALID") {
      console.log("Invalid or no question generated");
      return null;
    }

    console.log("Generated question:", question);

    const answerResponse = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `Extract the exact date, time, or temporal answer to the question from the text.
Respond only with the date/time value, without any additional text.
If the answer is ambiguous or requires inference, respond with "INVALID".
Valid formats:
- Years (e.g., "2024")
- Full dates (e.g., "March 15, 2024")
- Time periods (e.g., "5 years")
- Relative time (e.g., "2 months ago")`,
        },
        {
          role: "user",
          content: `Question: ${question}\n\nText: ${chunk.content}`,
        },
      ],
      temperature: 0,
      max_tokens: 50,
    });

    const answer = answerResponse.choices[0]?.message?.content;
    if (!answer || answer === "INVALID") {
      console.log("Invalid or no answer generated");
      return null;
    }

    console.log("Generated answer:", answer);

    // Enhanced answer format validation with more flexible patterns
    const isValidAnswer =
      /^(?:\d{4}|(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}(?:st|nd|rd|th)?,?\s*\d{4}|\d+\s+(?:year|month|week|day)s?(?:\s+ago)?|\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}|(?:one|two|three|four|five|six|seven|eight|nine|ten)\s+(?:year|month|week|day)s?(?:\s+ago)?)$/i.test(
        answer.trim(),
      );

    if (!isValidAnswer) {
      console.log("Answer format validation failed:", answer);
      return null;
    }

    return {
      question_type: "S2_DATETIME",
      filename: [chunk.metadata.filename],
      question: question.trim(),
      answer: answer.trim(),
      chunks: [chunk.content],
    };
  } catch (error) {
    console.error("Error generating datetime question:", error);
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

    // Don't parse markdown to HTML, just clean the markdown content
    const cleanContent = removeMarkdown(markdownContent)
      .replace(/\s+/g, " ")
      .trim();

    const textSplitter = new CharacterTextSplitter({
      separator: ".", // Split by sentences instead of newlines
      chunkSize: 1000, // Smaller chunks for better processing
      chunkOverlap: 200,
    });

    const chunks = await textSplitter.createDocuments([cleanContent]);

    if (isDebug) {
      console.log(`Created ${chunks.length} chunks from ${filepath}`);
      chunks.forEach((chunk, i) => {
        console.log(`Chunk ${i + 1} length: ${chunk.pageContent.length} chars`);
      });
    }

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
  datasetName = "dataset-s2",
  isDebug = process.env.NODE_ENV === "development",
}: GenerationConfig = {}) {
  console.log("Starting S2 datetime question generation...");
  console.log("Source directory:", sourceDirectory);

  const chunksMap = new Map<string, DocumentChunk[]>();
  const files = await fs.promises.readdir(sourceDirectory);
  const markdownFiles = files.filter((file) => file.endsWith(".md"));

  console.log("Found markdown files:", markdownFiles);

  for (const filename of markdownFiles) {
    const filepath = path.join(sourceDirectory, filename);
    console.log("Processing file:", filepath);

    const chunks = await processDocuments(filepath, isDebug);
    chunksMap.set(filename, chunks);
  }

  const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  const outputs: OutputRow[] = [];

  for (const [filename, chunks] of chunksMap) {
    console.log(`Processing ${filename} with ${chunks.length} chunks...`);

    for (const chunk of chunks) {
      const questionRow = await generateDateTimeQuestion(chunk, client);
      if (questionRow) {
        outputs.push(questionRow);
        if (isDebug) {
          console.log("Generated question row:", questionRow);
        }
      }
    }
  }

  if (outputs.length === 0) {
    console.log("No datetime questions were generated!");
    return outputs;
  }

  const outputDir = path.join("outputs", datasetName);
  await fs.promises.mkdir(outputDir, { recursive: true });

  const outputPath = path.join(
    outputDir,
    `questions_${new Date().toISOString().replace(/[:.]/g, "_")}.csv`,
  );

  await fs.promises.writeFile(outputPath, stringify(outputs, { header: true }));
  console.log(`Generated ${outputs.length} questions, saved to ${outputPath}`);

  return outputs;
}

// Replace the CommonJS require.main check with ESM equivalent
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}
