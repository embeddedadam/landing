"use client";

import { useRef, useState, useEffect } from "react";
import { type Message } from "ai";
import { PlaceholdersAndVanishInput } from "@/components/ui/placeholders-and-vanish-input";
import * as FloatingPanel from "@/components/ui/floating-panel";
import { MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import { chatAction } from "@/app/actions/chat";

const CHAT_PLACEHOLDERS = [
  "What's on your mind?",
  "Ask me anything about RAG...",
  "How can I help you today?",
  "Do you want to get to know me better?",
  "Wow, you are so handsome!",
];

export function AIChatPanel() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const messageRef = useRef<string>("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isAnimatingRef = useRef(false);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    messageRef.current = e.target.value;
  };

  async function processMessage(message: string) {
    try {
      const newUserMessage: Message = {
        id: String(Date.now()),
        role: "user",
        content: message,
      };

      setMessages((current) => [...current, newUserMessage]);

      const result = await chatAction([...messages, newUserMessage]);

      setMessages((current) => [
        ...current,
        ...(result.messages.filter((m) => m.role === "assistant") as Message[]),
      ]);
    } catch (error) {
      console.error("[CHAT]", error);
    } finally {
      setIsLoading(false);
    }
  }

  function handleSubmit(message: string) {
    if (!message || isLoading || isAnimatingRef.current) {
      console.log("AIChatPanel - handleSubmit early return:", {
        message,
        isLoading,
        isAnimating: isAnimatingRef.current,
      });
      return;
    }

    isAnimatingRef.current = true;
    setIsLoading(true);
    processMessage(message);
  }

  const ChatContent = () => (
    <div className="flex flex-col h-[85vh] xs:h-[88vh] sm:h-[600px] w-full max-w-[95vw] xs:max-w-[92vw] sm:w-[600px] md:w-[700px] lg:w-[800px]">
      <div className="flex justify-between items-center p-2 xs:p-3 sm:p-4">
        <h2 className="text-sm xs:text-base sm:text-lg font-semibold">
          Ask me about articles
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto p-2 xs:p-3 sm:p-4 space-y-3 sm:space-y-4">
        {messages.map((message, index) => (
          <div
            key={`${message.role}-${index}`}
            className={cn(
              "flex",
              message.role === "user" ? "justify-end" : "justify-start",
              "w-full"
            )}
          >
            <div
              className={cn(
                "max-w-[90%] xs:max-w-[85%] sm:max-w-[80%] rounded-lg",
                "p-2 xs:p-2.5 sm:p-3",
                "text-xs xs:text-sm sm:text-base",
                "bg-gray-100 dark:bg-zinc-800",
              )}
            >
              {typeof message.content === "string"
                ? message.content
                : (message.content as { type: string; text: string }[])
                    .filter((part) => part.type === "text")
                    .map((part, partIndex) => (
                      <div key={partIndex}>{part.text}</div>
                    ))}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 dark:bg-zinc-800 rounded-lg p-2 sm:p-3">
              <div className="flex space-x-1 sm:space-x-2">
                <div className="w-1.5 sm:w-2 h-1.5 sm:h-2 bg-gray-400 rounded-full animate-bounce" />
                <div className="w-1.5 sm:w-2 h-1.5 sm:h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:0.2s]" />
                <div className="w-1.5 sm:w-2 h-1.5 sm:h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:0.4s]" />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <div className="px-2 xs:px-3 sm:px-4 py-2 xs:py-2.5 sm:py-3 dark:border-zinc-800">
        <div className="relative w-full max-w-[calc(100%-0.5rem)] mx-auto">
          <PlaceholdersAndVanishInput
            placeholders={CHAT_PLACEHOLDERS}
            onChange={handleChange}
            onSubmit={handleSubmit}
            onAnimationComplete={() => {
              messageRef.current = "";
              isAnimatingRef.current = false;
            }}
          />
        </div>
      </div>
    </div>
  );

  return (
    <FloatingPanel.Root>
      <FloatingPanel.Trigger
        title="Open Chat"
        className="fixed bottom-3 xs:bottom-4 sm:bottom-8 right-3 xs:right-4 sm:right-8 h-9 xs:h-10 sm:h-12 w-9 xs:w-10 sm:w-12 flex items-center justify-center rounded-full bg-gray-100 dark:bg-zinc-800 transition-colors shadow-lg"
      >
        <MessageSquare className="w-4 xs:w-5 sm:w-6 h-4 xs:h-5 sm:h-6 text-dark-400 dark:text-zinc-400" />
      </FloatingPanel.Trigger>
      <FloatingPanel.Content>
        <ChatContent />
      </FloatingPanel.Content>
    </FloatingPanel.Root>
  );
}
