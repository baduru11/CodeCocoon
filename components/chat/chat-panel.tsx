"use client";

import { useState, useRef, useEffect } from "react";
import { MessageCircle, X, Send, Trash2, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useChat } from "@/hooks/use-chat";
import { ChatMessage } from "./chat-message";

interface ChatPanelProps {
  projectId: string;
  repoName: string;
  techStack?: {
    languages: string[];
    frameworks: string[];
    databases: string[];
    tools: string[];
    styling: string[];
  };
  architecturePattern?: string;
  skillLevel: string;
  roleLabel: string;
  conceptNames?: string[];
}

export function ChatPanel({
  projectId,
  repoName,
  techStack,
  architecturePattern,
  skillLevel,
  roleLabel,
  conceptNames,
}: ChatPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const { messages, isLoading, sendMessage, stopStreaming, clearMessages } = useChat(
    projectId,
    { repoName, techStack, architecturePattern, skillLevel, roleLabel, conceptNames }
  );

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Focus input when panel opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    sendMessage(input);
    setInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <>
      {/* Floating chat button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-50 w-14 h-14 bg-secondary text-white rounded-xl border-2 border-foreground shadow-[3px_3px_0px_0px_#1E293B] hover:shadow-[1px_1px_0px_0px_#1E293B] hover:translate-x-[2px] hover:translate-y-[2px] transition-all flex items-center justify-center"
        >
          <MessageCircle size={24} />
        </button>
      )}

      {/* Chat drawer */}
      <div
        className={cn(
          "fixed top-0 right-0 z-50 h-full w-full sm:w-[420px] bg-background border-l-2 border-foreground shadow-[-4px_0_16px_rgba(0,0,0,0.1)] transition-transform duration-300 ease-in-out flex flex-col",
          isOpen ? "translate-x-0" : "translate-x-full"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b-2 border-foreground/10">
          <div>
            <h3 className="font-bold text-sm">Ask about your code</h3>
            <p className="text-xs text-muted">{repoName}</p>
          </div>
          <div className="flex items-center gap-1">
            {messages.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearMessages}
                className="h-8 w-8 p-0"
                title="Clear chat"
              >
                <Trash2 size={14} />
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsOpen(false)}
              className="h-8 w-8 p-0"
            >
              <X size={16} />
            </Button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full px-6 text-center">
              <MessageCircle size={32} className="text-muted mb-3" />
              <p className="font-bold text-sm mb-1">Ask anything about this codebase</p>
              <p className="text-xs text-muted leading-relaxed">
                I can explain how specific files work, help you understand patterns,
                or answer questions about the architecture.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-foreground/5">
              {messages.map((msg) => (
                <ChatMessage key={msg.id} message={msg} />
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input */}
        <form onSubmit={handleSubmit} className="border-t-2 border-foreground/10 p-3">
          <div className="flex gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about your code..."
              rows={1}
              className="flex-1 resize-none rounded-lg border-2 border-foreground/15 bg-surface px-3 py-2 text-sm font-medium placeholder:text-muted focus:outline-none focus:border-secondary transition-colors"
            />
            {isLoading ? (
              <Button
                type="button"
                onClick={stopStreaming}
                size="sm"
                variant="secondary"
                className="shrink-0 h-10 w-10 p-0"
              >
                <Square size={14} />
              </Button>
            ) : (
              <Button
                type="submit"
                disabled={!input.trim()}
                size="sm"
                variant="default"
                className="shrink-0 h-10 w-10 p-0"
              >
                <Send size={14} />
              </Button>
            )}
          </div>
        </form>
      </div>

      {/* Backdrop (mobile) */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/20 sm:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}
    </>
  );
}
