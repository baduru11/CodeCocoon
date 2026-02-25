"use client";

import { cn, normalizeCode } from "@/lib/utils";
import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { Light as SyntaxHighlighter } from "react-syntax-highlighter";
import { atomOneLight } from "react-syntax-highlighter/dist/esm/styles/hljs";
import typescript from "react-syntax-highlighter/dist/esm/languages/hljs/typescript";
import javascript from "react-syntax-highlighter/dist/esm/languages/hljs/javascript";
import python from "react-syntax-highlighter/dist/esm/languages/hljs/python";
import css from "react-syntax-highlighter/dist/esm/languages/hljs/css";
import json from "react-syntax-highlighter/dist/esm/languages/hljs/json";
import xml from "react-syntax-highlighter/dist/esm/languages/hljs/xml";

SyntaxHighlighter.registerLanguage("typescript", typescript);
SyntaxHighlighter.registerLanguage("javascript", javascript);
SyntaxHighlighter.registerLanguage("python", python);
SyntaxHighlighter.registerLanguage("css", css);
SyntaxHighlighter.registerLanguage("json", json);
SyntaxHighlighter.registerLanguage("html", xml);
SyntaxHighlighter.registerLanguage("xml", xml);

interface CodeBlockProps {
  code: string;
  language?: string;
  filename?: string;
  className?: string;
  showLineNumbers?: boolean;
}

function CodeBlock({
  code,
  language = "typescript",
  filename,
  className,
  showLineNumbers = true,
}: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className={cn(
        "relative border-2 border-foreground/15 rounded-xl overflow-hidden",
        className
      )}
    >
      {/* Header */}
      {filename && (
        <div className="flex items-center justify-between px-4 py-2.5 bg-foreground text-surface border-b border-foreground/20">
          <span className="text-sm font-bold font-mono">{filename}</span>
          <button
            onClick={handleCopy}
            className="p-1 rounded-lg hover:bg-surface/10 transition-colors cursor-pointer"
            title="Copy code"
          >
            {copied ? (
              <Check size={14} className="text-accent-green" />
            ) : (
              <Copy size={14} />
            )}
          </button>
        </div>
      )}
      {/* Code */}
      <div className="relative code-block-wrap">
        {!filename && (
          <button
            onClick={handleCopy}
            className="absolute top-2 right-2 z-10 p-1.5 bg-surface border border-foreground/15 rounded-lg hover:bg-foreground/5 transition-all cursor-pointer"
            title="Copy code"
          >
            {copied ? (
              <Check size={14} className="text-accent-green" />
            ) : (
              <Copy size={14} className="text-muted" />
            )}
          </button>
        )}
        <SyntaxHighlighter
          language={language}
          style={atomOneLight}
          showLineNumbers={showLineNumbers}
          wrapLongLines={false}
          customStyle={{
            margin: 0,
            padding: "1rem",
            background: "#FFFFFF",
            fontSize: "0.875rem",
            fontFamily: "var(--font-mono), monospace",
            overflowX: "auto",
          }}
        >
          {normalizeCode(code)}
        </SyntaxHighlighter>
      </div>
    </div>
  );
}

export { CodeBlock };
