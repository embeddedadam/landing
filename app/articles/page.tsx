import Link from "next/link";
import { getArticles } from "@/lib/get-articles";
import { formatDate } from "@/lib/utils";
import { TextScramble } from "@/components/ui/text-scramble";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Articles | Written by Adam",
  description:
    "Collection of articles and thoughts about technology and building things",
  openGraph: {
    title: "Articles | Written by Adam",
    description:
      "Collection of articles and thoughts about technology and building things",
    type: "website",
    siteName: "Written by Adam",
  },
  twitter: {
    card: "summary_large_image",
    title: "Articles | Written by Adam",
    description:
      "Collection of articles and thoughts about technology and building things",
    creator: "@pon_o_",
  },
  alternates: {
    canonical: "https://writtenbyadam.com/articles",
  },
};

export default async function ArticlesPage() {
  const articles = await getArticles();
  const sortedArticles = articles
    .filter((article) => article.published !== false)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <div className="min-h-screen px-3 xs:px-4 sm:px-8 lg:px-16 py-12 xs:py-14 sm:py-16">
      <main className="mx-auto max-w-[95%] xs:max-w-[90%] sm:max-w-3xl">
        <h1 className="mb-6 sm:mb-8 text-2xl xs:text-2xl sm:text-3xl font-bold tracking-tight">
          Articles
        </h1>
        <div className="space-y-6 xs:space-y-8 sm:space-y-10">
          {sortedArticles.map((article) => (
            <article key={article.slug} className="group relative">
              <Link
                href={`/articles/${article.slug}`}
                className="block space-y-2 xs:space-y-2.5 sm:space-y-3 rounded-lg p-4 xs:p-5 sm:p-6 transition-colors hover:bg-muted/50"
              >
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <time dateTime={article.date}>
                    {formatDate(article.date)}
                  </time>
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
                <TextScramble
                  as="h2"
                  className="text-xl font-semibold tracking-tight transition-colors group-hover:text-primary"
                  duration={1.2}
                  speed={0.05}
                  trigger={true}
                >
                  {article.title}
                </TextScramble>
                <p className="line-clamp-2 text-muted-foreground">
                  {article.description}
                </p>
              </Link>
            </article>
          ))}
        </div>
      </main>
    </div>
  );
}
