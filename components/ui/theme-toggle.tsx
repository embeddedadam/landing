"use client";

import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";

interface ThemeToggleProps {
  className?: string;
}

export function ThemeToggle({ className }: ThemeToggleProps) {
  const { theme, systemTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  const resolvedTheme = theme === "system" ? systemTheme : theme;
  const isDark = resolvedTheme === "dark";

  return (
    <div
      className={cn(
        "relative flex w-16 h-8 p-1 rounded-full cursor-pointer transition-colors duration-300",
        isDark
          ? "bg-zinc-950 border border-zinc-800"
          : "bg-white border border-zinc-200",
        className,
      )}
      onClick={() => setTheme(isDark ? "light" : "dark")}
      role="button"
      tabIndex={0}
    >
      {/* Toggle Handle */}
      <div
        className={cn(
          "absolute flex justify-center items-center w-6 h-6 rounded-full transition-all duration-300",
          isDark ? "translate-x-0 bg-zinc-800" : "translate-x-8 bg-gray-200",
        )}
      >
        {isDark ? (
          <Moon className="w-4 h-4 text-white" strokeWidth={1.5} />
        ) : (
          <Sun className="w-4 h-4 text-gray-700" strokeWidth={1.5} />
        )}
      </div>

      {/* Static Icons */}
      <div className="flex justify-between items-center w-full px-[2px]">
        <div className="w-5 h-5 flex items-center justify-center">
          <Moon
            className={cn(
              "w-4 h-4 transition-opacity duration-300",
              isDark ? "opacity-0" : "opacity-30",
            )}
            strokeWidth={1.5}
          />
        </div>
        <div className="w-5 h-5 flex items-center justify-center">
          <Sun
            className={cn(
              "w-4 h-4 transition-opacity duration-300",
              isDark ? "opacity-30" : "opacity-0",
            )}
            strokeWidth={1.5}
          />
        </div>
      </div>
    </div>
  );
}
