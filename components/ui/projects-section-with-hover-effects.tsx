"use client";

import { cn } from "@/lib/utils";
import {
  IconCar,
  IconBrain,
  IconRobot,
  IconMessage2Code,
  IconDeviceAnalytics,
  IconShieldLock,
  IconTools,
  IconBrowser,
} from "@tabler/icons-react";

export function FeaturesSectionWithHoverEffects() {
  const features = [
    {
      title: "Automotive Infotainment",
      description:
        "Developed sophisticated infotainment platforms for Volvo and BMW, enhancing driver experience and vehicle connectivity.",
      icon: <IconCar className="w-6 h-6" />,
    },
    {
      title: "Braincast Ed-Tech",
      description:
        "Built an innovative educational platform leveraging cognitive science for accelerated learning outcomes.",
      icon: <IconBrain className="w-6 h-6" />,
    },
    {
      title: "Health Data Chatbot",
      description:
        "Engineered a RAG-based chatbot with custom parsing capabilities for intelligent health data analysis.",
      icon: <IconMessage2Code className="w-6 h-6" />,
    },
    {
      title: "Autonomous Robot",
      description:
        "Implemented SLAM algorithms and ROS framework for autonomous navigation and mapping systems.",
      icon: <IconRobot className="w-6 h-6" />,
    },
    {
      title: "Smart Water Metering",
      description:
        "Programmed microcontrollers in C for precise water consumption monitoring and analysis.",
      icon: <IconDeviceAnalytics className="w-6 h-6" />,
    },
    {
      title: "RTOS Security System",
      description:
        "Developed a real-time operating system-based security solution for robust protection.",
      icon: <IconShieldLock className="w-6 h-6" />,
    },
    {
      title: "Developer Tools",
      description:
        "Created numerous developer utilities to streamline software development workflows.",
      icon: <IconTools className="w-6 h-6" />,
    },
    {
      title: "AI Assistant Extension",
      description:
        "Built a Chrome extension enabling custom autocompletion for Claude and ChatGPT interfaces.",
      icon: <IconBrowser className="w-6 h-6" />,
    },
  ];
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4  relative z-10 py-10 max-w-7xl mx-auto">
      {features.map((feature, index) => (
        <Feature key={feature.title} {...feature} index={index} />
      ))}
    </div>
  );
}

const Feature = ({
  title,
  description,
  icon,
  index,
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
  index: number;
}) => {
  return (
    <div
      className={cn(
        "flex flex-col lg:border-r  py-10 relative group/feature dark:border-neutral-800",
        (index === 0 || index === 4) && "lg:border-l dark:border-neutral-800",
        index < 4 && "lg:border-b dark:border-neutral-800",
      )}
    >
      {index < 4 && (
        <div className="opacity-0 group-hover/feature:opacity-100 transition duration-200 absolute inset-0 h-full w-full bg-gradient-to-t from-neutral-100 dark:from-neutral-800 to-transparent pointer-events-none" />
      )}
      {index >= 4 && (
        <div className="opacity-0 group-hover/feature:opacity-100 transition duration-200 absolute inset-0 h-full w-full bg-gradient-to-b from-neutral-100 dark:from-neutral-800 to-transparent pointer-events-none" />
      )}
      <div className="mb-4 relative z-10 px-10 text-neutral-600 dark:text-neutral-400">
        {icon}
      </div>
      <div className="text-lg font-bold mb-2 relative z-10 px-10">
        <div className="absolute left-0 inset-y-0 h-6 group-hover/feature:h-8 w-1 rounded-tr-full rounded-br-full bg-neutral-300 dark:bg-neutral-700 group-hover/feature:bg-blue-500 transition-all duration-200 origin-center" />
        <span className="group-hover/feature:translate-x-2 transition duration-200 inline-block text-neutral-800 dark:text-neutral-100">
          {title}
        </span>
      </div>
      <p className="text-sm text-neutral-600 dark:text-neutral-300 max-w-xs relative z-10 px-10">
        {description}
      </p>
    </div>
  );
};
