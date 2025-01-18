import { cn } from "@/lib/utils";

interface ArticleLayoutProps {
  children: React.ReactNode;
  className?: string;
}

export function ArticleLayout({ children, className }: ArticleLayoutProps) {
  return (
    <article
      className={cn(
        // Base styles
        "prose prose-neutral dark:prose-invert",
        // Responsive text sizing
        "prose-base xs:prose-lg sm:prose-xl",
        // Headings
        "prose-h1:text-2xl xs:prose-h1:text-2xl sm:prose-h1:text-3xl",
        "prose-h2:text-xl xs:prose-h2:text-xl sm:prose-h2:text-2xl",
        // Spacing
        "prose-p:my-2 sm:prose-p:my-4",
        "prose-li:my-1 sm:prose-li:my-2",
        // Mobile-optimized padding
        "px-3 xs:px-4 sm:px-6",
        // Code blocks
        "prose-pre:bg-muted prose-pre:border prose-pre:border-border",
        "prose-code:text-primary prose-code:font-mono prose-code:font-normal",
        // Links
        "prose-a:text-primary prose-a:no-underline hover:prose-a:underline",
        // Custom max width
        "max-w-none w-full",
        // Images
        "prose-img:rounded-lg prose-img:shadow-md",
        // Tables
        "prose-table:border prose-td:p-2",
        className,
      )}
    >
      {children}
    </article>
  );
}
