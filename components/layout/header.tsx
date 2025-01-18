import { Navigation } from "@/components/layout/navigation";

export function Header() {
  return (
    <header className="fixed top-0 w-full z-10 border-b bg-background/80 backdrop-blur-sm">
      <div className="container flex h-14 items-center justify-center">
        <Navigation />
      </div>
    </header>
  );
}
