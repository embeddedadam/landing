"use client";

import { useTheme } from "next-themes";
import { Waves } from "@/components/ui/waves-background";
import dynamic from "next/dynamic";
import { useState, useEffect } from "react";

const TextScramble = dynamic(
  () => import("@/components/ui/text-scramble").then((mod) => mod.TextScramble),
  { ssr: false },
);

export function WavesDemo() {
  const { theme, systemTheme } = useTheme();
  const [isMounted, setIsMounted] = useState(false);

  // Ensure we only render after client hydration
  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return (
      <div className="relative w-full h-[400px] bg-background/80 rounded-lg overflow-hidden" />
    );
  }

  // Resolve 'system' to an explicit 'dark' or 'light'
  const resolvedTheme = theme === "system" ? systemTheme : theme;
  const isDark = resolvedTheme === "dark";

  return (
    <div className="relative w-full h-[400px] bg-background/80 rounded-lg overflow-hidden">
      <div className="absolute inset-0">
        <Waves
          lineColor={
            isDark ? "rgba(255, 255, 255, 0.3)" : "rgba(0, 0, 0, 0.3)"
          }
          backgroundColor="transparent"
          waveSpeedX={0.02}
          waveSpeedY={0.01}
          waveAmpX={40}
          waveAmpY={20}
          friction={0.9}
          tension={0.01}
          maxCursorMove={120}
          xGap={12}
          yGap={36}
        />
      </div>

      <div className="relative z-10 p-8">
        <TextScramble
          as="h3"
          className="text-2xl font-bold"
          duration={1.2}
          speed={0.05}
        >
          Adam Galecki
        </TextScramble>
      </div>
    </div>
  );
}
