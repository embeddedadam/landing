import Image from "next/image";
import { WavesDemo } from "@/components/ui/demo";
import { InteractiveHoverButton } from "@/components/ui/interactive-hover-button";

export default function Home() {
  return (
    <div className="grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen p-8 pb-20 gap-16 sm:p-20 font-[family-name:var(--font-geist-sans)] pt-24">
      <main className="flex flex-col gap-8 row-start-2 items-center sm:items-start w-full max-w-5xl">
        <ol className="list-inside list-decimal text-sm text-center sm:text-left font-[family-name:var(--font-geist-mono)]">
          <li className="mb-2">
            I&apos;m all about entrepreneurship, tech and building things.
          </li>
          <li className="mb-2">Currently building side projects.</li>
          <li className="mb-2">
            This website is a collection of my thoughts and ideas.
          </li>
        </ol>

        <div className="flex gap-4 items-center flex-col sm:flex-row">
          <InteractiveHoverButton text="Read" href="/articles" />
        </div>
        <WavesDemo />
      </main>
      <footer className="row-start-3 flex gap-6 flex-wrap items-center justify-center">
        {/* <a
          className="flex items-center gap-2 hover:underline hover:underline-offset-4"
          href="https://nextjs.org/learn?utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Image
            aria-hidden
            src="/file.svg"
            alt="File icon"
            width={16}
            height={16}
          />
          Learn
        </a> */}
        <a
          className="flex items-center gap-2 hover:underline hover:underline-offset-4"
          href="/examples"
        >
          <Image
            aria-hidden
            src="/window.svg"
            alt="Window icon"
            width={16}
            height={16}
          />
          Examples of projects
        </a>
      </footer>
    </div>
  );
}
