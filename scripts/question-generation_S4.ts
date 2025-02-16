import fs from "fs";
import path from "path";
import { OpenAI } from "openai";
import { stringify } from "csv-stringify/sync";
import matter from "gray-matter";
import * as marked from "marked";
import removeMarkdown from "remove-markdown";

interface GenerationConfig {
  sourceDirectory: string;
  datasetName: string;
  isDebug?: boolean;
}

interface DocumentChunk {
  content: string;
  metadata: {
    title?: string;
    section?: string;
    position?: number;
  };
}

interface QuestionAnswer {
  question: string;
  answer: string;
}

interface OutputRow {
  question_type: string;
  filename: string[];
  question: string;
  answer: string;
  chunks: string[];
  metadata?: {
    title?: string;
    section?: string;
  };
}

class SingleDocMultiQuestionGenerator {
  private client: OpenAI;
  private chunks: Map<string, string[]> = new Map();

  constructor(apiKey: string) {
    this.client = new OpenAI({ apiKey });
  }

  private async loadMarkdownDocument(
    filepath: string,
  ): Promise<DocumentChunk[]> {
    const content = await fs.promises.readFile(filepath, "utf-8");
    const { data: frontmatter, content: markdownContent } = matter(content);

    const parsedContent = marked.parse(markdownContent) as string;
    const cleanContent = removeMarkdown(parsedContent)
      .replace(/\s+/g, " ")
      .trim();

    const sections = this.splitByHeaders(markdownContent);

    return sections.map((section, index) => ({
      content: removeMarkdown(marked.parse(section.content) as string)
        .replace(/\s+/g, " ")
        .trim(),
      metadata: {
        title: frontmatter.title || path.basename(filepath, ".md"),
        section: section.header || "Main Content",
        position: index,
      },
    }));
  }

  private splitByHeaders(
    markdown: string,
  ): Array<{ header: string; content: string }> {
    const headerRegex = /^(#{1,6})\s+(.+)$/gm;
    const sections: Array<{ header: string; content: string }> = [];
    let lastIndex = 0;
    let currentHeader = "";

    const matches = markdown.matchAll(headerRegex);
    for (const match of matches) {
      if (lastIndex > 0) {
        sections.push({
          header: currentHeader,
          content: markdown.slice(lastIndex, match.index).trim(),
        });
      }
      currentHeader = match[2];
      lastIndex = match.index! + match[0].length;
    }

    sections.push({
      header: currentHeader,
      content: markdown.slice(lastIndex).trim(),
    });

    return sections;
  }

  private splitIntoChunks(
    text: string,
    chunkSize = 3000,
    overlap = 150,
  ): string[] {
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
    const chunks: string[] = [];
    let currentChunk = "";

    for (const sentence of sentences) {
      if (
        (currentChunk + sentence).length > chunkSize &&
        currentChunk.length > 0
      ) {
        chunks.push(currentChunk.trim());
        currentChunk =
          currentChunk
            .split(" ")
            .slice(-overlap / 10)
            .join(" ") + sentence;
      } else {
        currentChunk += " " + sentence;
      }
    }

    if (currentChunk.trim().length > 0) {
      chunks.push(currentChunk.trim());
    }

    return chunks;
  }

  private async generateQuestions(chunk: string): Promise<QuestionAnswer[]> {
    const prompt = `Generate 3 distinct questions about different aspects from the given text. Each question should focus on a separate key point or concept.
The questions should require specific information from the text to answer correctly.
Do not create questions that combine multiple topics - each question should focus on one specific aspect.
Format output as JSON array where each object has "question" and "answer" fields.

Text:
\`\`\`
${chunk}
\`\`\`
`;

    const response = await this.client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
    });

    const content = response.choices[0].message.content;
    if (!content) throw new Error("No content in response");

    try {
      // Clean the response by removing markdown code blocks
      const cleanedContent = content
        .replace(/```json\n?/g, "")
        .replace(/```\n?/g, "")
        .trim();

      return JSON.parse(cleanedContent) as QuestionAnswer[];
    } catch (e) {
      throw new Error(`Failed to parse GPT response: ${e}`);
    }
  }

  async processDocuments({
    sourceDirectory,
    datasetName,
    isDebug = false,
  }: GenerationConfig) {
    const files = await fs.promises.readdir(sourceDirectory);
    const markdownFiles = files.filter((file) => file.endsWith(".md"));
    const outputs: OutputRow[] = [];

    console.log(`Processing ${markdownFiles.length} markdown files...`);

    for (const filename of markdownFiles) {
      try {
        if (isDebug) {
          console.log(`\nProcessing file: ${filename}`);
        }

        const filepath = path.join(sourceDirectory, filename);
        const docs = await this.loadMarkdownDocument(filepath);

        const allChunks = docs.flatMap((doc) =>
          this.splitIntoChunks(doc.content).map((chunk) => ({
            content: chunk,
            metadata: doc.metadata,
          })),
        );

        if (allChunks.length === 0) {
          if (isDebug) {
            console.log(`No valid chunks found in ${filename}`);
          }
          continue;
        }

        const largestChunk = allChunks.reduce((prev, current) =>
          prev.content.length > current.content.length ? prev : current,
        );

        const qa = await this.generateQuestions(largestChunk.content);

        outputs.push({
          question_type: "S4_MULTIPLE_QUESTIONS_SINGLE_DOC",
          filename: [filename],
          question: qa.map((q) => q.question).join(" | "),
          answer: qa.map((q) => q.answer).join(" | "),
          chunks: [largestChunk.content],
          metadata: {
            title: largestChunk.metadata.title,
            section: largestChunk.metadata.section,
          },
        });

        if (isDebug) {
          console.log(`Generated ${qa.length} questions from ${filename}`);
        }
      } catch (error) {
        console.error(`Error processing ${filename}:`, error);
      }
    }

    console.log(`\nGenerated questions for ${outputs.length} files`);
    await this.saveOutput(outputs, datasetName);
    return outputs;
  }

  private async saveOutput(outputs: OutputRow[], datasetName: string) {
    const outputDir = path.join("outputs", datasetName);
    await fs.promises.mkdir(outputDir, { recursive: true });

    const timestamp = new Date().toISOString().replace(/[:.]/g, "_");
    const outputPath = path.join(outputDir, `questions_${timestamp}.csv`);

    await fs.promises.writeFile(
      outputPath,
      stringify(outputs, { header: true }),
    );
    console.log(`Results saved to: ${outputPath}`);
  }
}

async function main() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY environment variable is required");
  }

  const generator = new SingleDocMultiQuestionGenerator(
    process.env.OPENAI_API_KEY,
  );

  await generator.processDocuments({
    sourceDirectory: path.join(process.cwd(), "content/articles/"),
    datasetName: "dataset-s4",
    isDebug: process.env.NODE_ENV === "development",
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}
