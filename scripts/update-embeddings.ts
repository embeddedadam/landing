import { Pinecone, PineconeRecord } from "@pinecone-database/pinecone";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { OpenAIEmbeddings } from "@langchain/openai";
import { glob } from "glob";
import { readFileSync } from "fs";
import matter from "gray-matter";
import { chunk } from "lodash-es";
import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

if (
  !process.env.PINECONE_API_KEY ||
  !process.env.PINECONE_INDEX_NAME ||
  !process.env.OPENAI_API_KEY
) {
  console.error(
    "Missing required environment variables. Please check your .env file.",
  );
  process.exit(1);
}

interface ArticleMetadata {
  title: string;
  slug: string;
  description: string;
  tags: string[];
  date: string;
  published: boolean;
  author: string;
  section?: string;
  heading?: string;
  wordCount: number;
  sourceFile: string;
}

interface DocumentChunk {
  id: string;
  text: string;
  metadata: ArticleMetadata & {
    chunk_index: number;
  };
}

const articleSchema = z.object({
  title: z.string(),
  slug: z.string(),
  description: z.string(),
  tags: z.array(z.string()),
  date: z.string(),
  published: z.boolean(),
  author: z.string().default("Adam Gałecki"),
});

async function initPinecone() {
  const pinecone = new Pinecone({
    apiKey: process.env.PINECONE_API_KEY!,
  });

  const index = pinecone.Index(process.env.PINECONE_INDEX_NAME!);

  console.log("Index stats before upsert:");
  console.log(await index.describeIndexStats());
  console.log("\n");

  return index;
}

async function cleanDatabase(index: any) {
  console.log("Cleaning existing vectors...");
  try {
    const stats = await index.describeIndexStats();

    if (stats.totalRecordCount === 0) {
      console.log("Index is empty, skipping cleanup");
      return;
    }

    await index.deleteAll();
    console.log("Successfully cleaned the database");
  } catch (error: any) {
    if (error?.message?.includes("404")) {
      console.log("Index is empty, skipping cleanup");
      return;
    }
    console.error("Error cleaning database:", error);
    throw error;
  }
}

async function processArticles(): Promise<DocumentChunk[]> {
  const articleFiles = await glob("content/articles/**/*.md");
  const chunks: DocumentChunk[] = [];

  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1000,
    chunkOverlap: 200,
    separators: ["\n## ", "\n### ", "\n#### ", "\n\n", "\n", ". ", " ", ""],
  });

  for (const file of articleFiles) {
    try {
      const content = readFileSync(file, "utf-8");
      const { data: frontmatter, content: articleContent } = matter(content);

      const parsedFrontmatter = articleSchema.safeParse(frontmatter);
      if (!parsedFrontmatter.success) {
        console.error(
          `Invalid frontmatter in ${file}:`,
          parsedFrontmatter.error,
        );
        continue;
      }

      if (!frontmatter.published) {
        console.log(`Skipping unpublished article: ${file}`);
        continue;
      }

      const sections = extractSections(articleContent);

      for (const section of sections) {
        const splits = await splitter.createDocuments([section.content]);

        chunks.push(
          ...splits.map((split, index) => ({
            id: `${frontmatter.slug}-${section.heading}-${index}`,
            text: split.pageContent,
            metadata: {
              title: frontmatter.title,
              slug: frontmatter.slug,
              description: frontmatter.description,
              tags: frontmatter.tags,
              date: frontmatter.date,
              published: frontmatter.published,
              author: frontmatter.author,
              section: section.heading,
              wordCount: split.pageContent.split(/\s+/).length,
              sourceFile: file,
              chunk_index: index,
            },
          })),
        );
      }

      console.log(`Processed ${file}: ${chunks.length} chunks`);
    } catch (error) {
      console.error(`Error processing ${file}:`, error);
    }
  }

  return chunks;
}

function extractSections(content: string) {
  const sections: { heading: string; content: string }[] = [];
  const lines = content.split("\n");
  let currentHeading = "Introduction";
  let currentContent: string[] = [];

  lines.forEach((line) => {
    if (line.startsWith("#")) {
      if (currentContent.length > 0) {
        sections.push({
          heading: currentHeading,
          content: currentContent.join("\n"),
        });
      }
      currentHeading = line.replace(/^#+\s+/, "");
      currentContent = [];
    } else {
      currentContent.push(line);
    }
  });

  if (currentContent.length > 0) {
    sections.push({
      heading: currentHeading,
      content: currentContent.join("\n"),
    });
  }

  return sections;
}

async function updateEmbeddings() {
  try {
    console.log("Initializing Pinecone client...");
    const index = await initPinecone();

    await cleanDatabase(index);

    console.log("Processing articles...");
    const chunks = await processArticles();

    console.log("Generating embeddings...");
    const embeddings = new OpenAIEmbeddings({
      openAIApiKey: process.env.OPENAI_API_KEY,
    });

    const BATCH_SIZE = 100;
    const RETRY_ATTEMPTS = 3;
    const batches = chunk(chunks, BATCH_SIZE);

    for (const [batchIndex, batch] of batches.entries()) {
      console.log(`Processing batch ${batchIndex + 1}/${batches.length}`);

      let attempts = 0;
      while (attempts < RETRY_ATTEMPTS) {
        try {
          const vectors = await Promise.all(
            batch.map(async (doc: DocumentChunk) => {
              const embedding = await embeddings.embedQuery(doc.text);
              return {
                id: doc.id,
                values: embedding,
                metadata: {
                  ...doc.metadata,
                  content: doc.text,
                },
              };
            }),
          );

          await index.upsert(vectors as unknown as PineconeRecord[]);
          break;
        } catch (error) {
          attempts++;
          if (attempts === RETRY_ATTEMPTS) throw error;
          console.warn(`Retry attempt ${attempts} for batch ${batchIndex + 1}`);
          await new Promise((resolve) => setTimeout(resolve, 1000 * attempts));
        }
      }
    }

    console.log("Successfully updated embeddings in Pinecone");
  } catch (error) {
    console.error("Error updating embeddings:", error);
    process.exit(1);
  }
}

updateEmbeddings();
