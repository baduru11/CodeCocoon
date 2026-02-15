"use client";

import { cn } from "@/lib/utils";
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
        "relative border-3 border-foreground rounded-[4px] shadow-[5px_5px_0px_0px_#1A1A1A] overflow-hidden",
        className
      )}
    >
      {/* Header */}
      {filename && (
        <div className="flex items-center justify-between px-4 py-2 bg-foreground text-surface border-b-3 border-foreground">
          <span className="text-sm font-bold font-mono">{filename}</span>
          <button
            onClick={handleCopy}
            className="p-1 rounded-[4px] hover:bg-surface/20 transition-colors"
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
            className="absolute top-2 right-2 z-10 p-1.5 bg-surface border-2 border-foreground rounded-[4px] shadow-[2px_2px_0px_0px_#1A1A1A] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none transition-all"
            title="Copy code"
          >
            {copied ? (
              <Check size={14} className="text-accent-green" />
            ) : (
              <Copy size={14} />
            )}
          </button>
        )}
        <SyntaxHighlighter
          language={language}
          style={atomOneLight}
          showLineNumbers={false}
          wrapLongLines={false}
          customStyle={{
            margin: 0,
            padding: "1rem",
            background: "#FFFFFF",
            fontSize: "0.875rem",
            fontFamily: "var(--font-mono), monospace",
            overflowX: "hidden",
          }}
        >
          {code}
        </SyntaxHighlighter>
      </div>
    </div>
  );
}

export { CodeBlock };
