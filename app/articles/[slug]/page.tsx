import { notFound } from "next/navigation";
import { getArticles } from "@/lib/get-articles";
import { Metadata } from "next";
import { TextScramble } from "@/components/ui/text-scramble";
import { markdownToHtml } from "@/lib/markdown";
import { ArticleLayout } from "@/app/articles/article-layout";
import { formatDate } from "@/lib/utils";

export async function generateStaticParams() {
  const articles = await getArticles();
  return articles.map((article) => ({
    slug: article.slug,
  }));
}

export async function generateMetadata(props: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const params = await props.params;
  const slug = await Promise.resolve(params.slug);
  const articles = await getArticles();
  const article = articles.find((a) => a.slug === slug);

  if (!article || article.published === false) return {};

  const publishedTime = new Date(article.date).toISOString();

  return {
    title: `${article.title} | Written by Adam`,
    description: article.description,
    openGraph: {
      title: article.title,
      description: article.description,
      type: "article",
      publishedTime,
      authors: ["Adam Gałecki"],
      tags: article.tags,
      siteName: "Written by Adam",
    },
    twitter: {
      card: "summary_large_image",
      title: article.title,
      description: article.description,
      creator: "@AdamGalecki",
    },
    alternates: {
      canonical: `https://writtenbyadam.com/articles/${article.slug}`,
    },
    keywords: article.tags.join(", "),
  };
}

export default async function ArticlePage(props: {
  params: Promise<{ slug: string }>;
}) {
  const params = await props.params;
  const slug = await Promise.resolve(params.slug);
  const articles = await getArticles();
  const article = articles.find((a) => a.slug === slug);

  if (!article) return notFound();

  const content = await markdownToHtml(article.content);

  return (
    <div className="min-h-screen px-4 py-16 sm:px-8 lg:px-16">
      <main className="mx-auto max-w-3xl">
        <div className="mb-8 space-y-4">
          <TextScramble
            as="h1"
            className="text-3xl font-bold tracking-tight"
            duration={1.2}
            speed={0.05}
            trigger={true}
          >
            {article.title}
          </TextScramble>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <time dateTime={article.date}>{formatDate(article.date)}</time>
            <span>•</span>
            <div className="flex gap-2">
              {article.tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
          <p className="text-lg text-muted-foreground">{article.description}</p>
        </div>
        <ArticleLayout>
          <div dangerouslySetInnerHTML={{ __html: content }} />
        </ArticleLayout>
      </main>
    </div>
  );
}
