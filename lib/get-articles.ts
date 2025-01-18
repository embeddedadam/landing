import fs from "fs/promises";
import path from "path";
import matter from "gray-matter";
import { z } from "zod";

export interface Article {
  title: string;
  slug: string;
  description: string;
  tags: string[];
  date: string;
  published: boolean;
  content: string;
}

const ArticleSchema = z.object({
  title: z.string(),
  slug: z.string(),
  description: z.string(),
  tags: z.array(z.string()).default([]),
  date: z.string(),
  content: z.string(),
  published: z.boolean().default(true),
});

export async function getArticles(): Promise<Article[]> {
  const articlesDir = path.join(process.cwd(), "content", "articles");
  const filenames = await fs.readdir(articlesDir);

  const articles: Article[] = [];

  for (const filename of filenames) {
    if (!filename.endsWith(".md")) continue;

    const filePath = path.join(articlesDir, filename);
    const fileContents = await fs.readFile(filePath, "utf-8");
    const { data, content } = matter(fileContents);

    const parseResult = ArticleSchema.safeParse({
      ...data,
      content,
    });

    if (!parseResult.success) {
      console.error(
        "Invalid article frontmatter:",
        filePath,
        parseResult.error,
      );
      continue;
    }

    articles.push({
      ...parseResult.data,
      published: parseResult.data.published ?? true,
    });
  }

  return articles;
}
