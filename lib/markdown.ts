import { remark } from "remark";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import remarkRehype from "remark-rehype";
import rehypeStringify from "rehype-stringify";
import rehypeSlug from "rehype-slug";

export async function markdownToHtml(markdown: string) {
  // Replace environment variable placeholder before processing
  const processedMarkdown = markdown.replace(
    /\${process\.env\.NEXT_PUBLIC_DOMAIN_URL}/g,
    process.env.NEXT_PUBLIC_DOMAIN_URL || "https://writtenbyadam.com",
  );

  const result = await remark()
    .use(remarkGfm)
    .use(remarkMath)
    .use(remarkRehype)
    .use(rehypeKatex)
    .use(rehypeStringify)
    .use(rehypeSlug)
    .process(processedMarkdown);
  return result.toString();
}
