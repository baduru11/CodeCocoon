"use client";

import { cn } from "@/lib/utils";
import { User, Bot, FileCode, Loader2 } from "lucide-react";
import type { ChatMessage as ChatMessageType } from "@/hooks/use-chat";

interface Props {
  message: ChatMessageType;
}

export function ChatMessage({ message }: Props) {
  const isUser = message.role === "user";

  return (
    <div className={cn("flex gap-3 px-4 py-3", isUser ? "bg-surface/50" : "")}>
      <div
        className={cn(
          "shrink-0 w-7 h-7 rounded-lg border-2 flex items-center justify-center",
          isUser
            ? "bg-secondary/10 border-secondary/30"
            : "bg-accent-purple/10 border-accent-purple/30"
        )}
      >
        {isUser ? <User size={14} /> : <Bot size={14} />}
      </div>
      <div className="min-w-0 flex-1 space-y-2">
        <div className="text-sm font-medium leading-relaxed whitespace-pre-wrap break-words">
          {message.content}
          {message.isStreaming && (
            <Loader2 size={14} className="inline-block ml-1 animate-spin text-muted" />
          )}
        </div>
        {message.references && message.references.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-1">
            {message.references.map((file) => (
              <span
                key={file}
                className="inline-flex items-center gap-1 text-[10px] font-mono bg-surface px-1.5 py-0.5 border border-foreground/10 rounded-md text-muted"
              >
                <FileCode size={10} />
                {file}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
