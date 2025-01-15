"use client";

import { RiGithubFill, RiLinkedinFill, RiTwitterXFill } from "@remixicon/react";
import { cn } from "@/lib/utils";

interface SocialLink {
  href: string;
  label: string;
  icon: React.ReactNode;
}

interface SocialLinksProps {
  className?: string;
}

function SocialLinks({ className }: SocialLinksProps) {
  const socialLinks: SocialLink[] = [
    {
      href: "https://x.com/pon_o_",
      label: "Follow on X (formerly Twitter)",
      icon: <RiTwitterXFill className="h-4 w-4 sm:h-[18px] sm:w-[18px]" />,
    },
    {
      href: "https://www.linkedin.com/in/adam-galecki/",
      label: "Connect on LinkedIn",
      icon: <RiLinkedinFill className="h-4 w-4 sm:h-[18px] sm:w-[18px]" />,
    },
    {
      href: "https://github.com/embeddedadam",
      label: "Follow on GitHub",
      icon: <RiGithubFill className="h-4 w-4 sm:h-[18px] sm:w-[18px]" />,
    },
  ];

  return (
    <nav
      className={cn("inline-flex items-center gap-1 sm:gap-1.5", className)}
      aria-label="Social media links"
    >
      {socialLinks.map(({ href, label, icon }) => (
        <a
          key={href}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-md 
            border border-input bg-background/50 
            hover:bg-accent hover:text-accent-foreground
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring
            active:scale-95 transition-all duration-200
            touch-manipulation"
          aria-label={label}
        >
          {icon}
        </a>
      ))}
    </nav>
  );
}

export { SocialLinks };
