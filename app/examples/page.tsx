import { FeaturesSectionWithHoverEffects } from "@/components/ui/projects-section-with-hover-effects";

export default function Page() {
  return (
    <main className="min-h-screen py-24 flex flex-col items-center">
      <div className="text-center space-y-4 mb-16">
        <p className="text-muted-foreground max-w-[600px] mx-auto font-[family-name:var(--font-geist-mono)]">
          What I&apos;ve built and contributed to:
        </p>
      </div>
      <FeaturesSectionWithHoverEffects />
    </main>
  );
}
