# RAG + Pipeline Parallelization — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace blind context dumping with semantic RAG retrieval, switch to OpenRouter for concurrent API calls, and parallelize the pipeline for 2-3x speedup.

**Architecture:** OpenRouter (OpenAI-compatible) replaces Google Gemini SDK. web-tree-sitter chunks code at semantic boundaries. @huggingface/transformers embeds chunks into Supabase pgvector. A dependency-based executor runs pipeline steps in parallel whenever data dependencies allow.

**Tech Stack:** Next.js 16, OpenAI SDK (for OpenRouter), web-tree-sitter (WASM), @huggingface/transformers, Supabase pgvector

**Design doc:** `docs/plans/2026-03-14-rag-parallelization-upgrade.md`

---

## Task 1: Install Dependencies

**Files:**
- Modify: `package.json`

**Step 1: Install OpenAI SDK (for OpenRouter)**

Run: `npm install openai`

**Step 2: Uninstall Google Gemini SDK**

Run: `npm uninstall @google/genai`

**Step 3: Install RAG dependencies**

Run: `npm install web-tree-sitter @huggingface/transformers`

**Step 4: Verify install**

Run: `npm run build`
Expected: Build succeeds (will have import errors since we haven't updated code yet — that's ok, just verify npm install worked)

**Step 5: Commit**

```bash
git add package.json package-lock.json
git commit -m "build: swap @google/genai for openai, add web-tree-sitter and @huggingface/transformers"
```

---

## Task 2: Create OpenRouter Provider

**Files:**
- Create: `lib/ai/openrouter.ts`
- Modify: `lib/ai/gemini.ts` (will be deleted after migration)

The OpenRouter provider must implement the same `AIProvider` interface (`lib/ai/provider.ts`) so all downstream code works unchanged.

**Step 1: Create `lib/ai/openrouter.ts`**

```ts
import OpenAI from "openai";
import type { AIProvider, GenerateOptions, GenerateResult, StreamChunk } from "./provider";
import { OPENROUTER_MODELS } from "@/lib/constants";

const MAX_RETRIES = 5;
const BASE_DELAY_MS = 10000;
const BASE_DELAY_503_MS = 20000;

function isRetryable(error: unknown): boolean {
  if (error instanceof OpenAI.APIError) {
    return error.status === 429 || error.status === 503 || error.status === 502;
  }
  if (error instanceof Error) {
    const msg = error.message;
    if (msg.includes("fetch failed") || msg.includes("socket") || msg.includes("ECONNRESET")) return true;
    if (msg.includes("other side closed") || msg.includes("network")) return true;
  }
  return false;
}

function is503(error: unknown): boolean {
  if (error instanceof OpenAI.APIError) {
    return error.status === 503 || error.status === 502;
  }
  return false;
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Global concurrent rate limiter ──────────────────────────────────

class RequestQueue {
  private maxConcurrent: number;
  private minGapMs: number;
  private inFlight = 0;
  private lastStartTime = 0;
  private waiters: (() => void)[] = [];

  constructor(maxConcurrent: number, minGapMs: number) {
    this.maxConcurrent = maxConcurrent;
    this.minGapMs = minGapMs;
  }

  async run<T>(fn: () => Promise<T>): Promise<T> {
    await this.acquire();
    try {
      return await fn();
    } finally {
      this.release();
    }
  }

  private async acquire(): Promise<void> {
    while (this.inFlight >= this.maxConcurrent) {
      await new Promise<void>((resolve) => {
        this.waiters.push(resolve);
      });
    }
    this.inFlight++;
    const now = Date.now();
    const elapsed = now - this.lastStartTime;
    if (this.minGapMs > 0 && elapsed < this.minGapMs) {
      await sleep(this.minGapMs - elapsed);
    }
    this.lastStartTime = Date.now();
  }

  private release(): void {
    this.inFlight--;
    if (this.waiters.length > 0) {
      const next = this.waiters.shift()!;
      next();
    }
  }
}

/**
 * Concurrent queue for OpenRouter paid tier.
 * 5 concurrent requests, no minimum gap.
 */
const globalQueue = new RequestQueue(5, 0);

// ─── Schema translation ─────────────────────────────────────────────

/**
 * Convert Google Gemini Type-based schema to standard JSON Schema.
 * Google uses { type: Type.STRING } etc, OpenAI uses { type: "string" }.
 */
function convertGeminiSchema(schema: Record<string, unknown>): Record<string, unknown> {
  if (!schema || typeof schema !== "object") return schema;

  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(schema)) {
    if (key === "type") {
      // Google Type enum values: STRING, NUMBER, BOOLEAN, OBJECT, ARRAY, INTEGER
      const typeStr = String(value).toLowerCase();
      result.type = typeStr;
    } else if (key === "properties" && typeof value === "object" && value !== null) {
      const props: Record<string, unknown> = {};
      for (const [propKey, propVal] of Object.entries(value as Record<string, unknown>)) {
        props[propKey] = convertGeminiSchema(propVal as Record<string, unknown>);
      }
      result.properties = props;
    } else if (key === "items" && typeof value === "object" && value !== null) {
      result.items = convertGeminiSchema(value as Record<string, unknown>);
    } else {
      result[key] = value;
    }
  }

  // Add additionalProperties: false for objects (required by strict mode)
  if (result.type === "object" && result.properties) {
    result.additionalProperties = false;
  }

  return result;
}

// ─── Provider ────────────────────────────────────────────────────────

export class OpenRouterProvider implements AIProvider {
  name = "openrouter";
  private client: OpenAI;

  constructor(apiKey?: string) {
    const key = apiKey || process.env.OPENROUTER_API_KEY;
    if (!key) throw new Error("OPENROUTER_API_KEY is required");
    this.client = new OpenAI({
      baseURL: "https://openrouter.ai/api/v1",
      apiKey: key,
    });
  }

  async generate(options: GenerateOptions): Promise<GenerateResult> {
    const model = options.model || OPENROUTER_MODELS.fast;
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = options.messages.map((msg) => ({
      role: msg.role === "user" ? "user" as const : "assistant" as const,
      content: msg.content,
    }));

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const requestParams: OpenAI.Chat.ChatCompletionCreateParamsNonStreaming = {
          model,
          messages,
          temperature: options.temperature ?? 0.7,
          max_tokens: options.maxTokens ?? 8192,
        };

        if (options.responseFormat === "json") {
          if (options.responseSchema) {
            requestParams.response_format = {
              type: "json_schema",
              json_schema: {
                name: "response",
                strict: true,
                schema: convertGeminiSchema(options.responseSchema),
              },
            } as OpenAI.Chat.ChatCompletionCreateParams["response_format"];
          } else {
            requestParams.response_format = { type: "json_object" };
          }
        }

        const response = await globalQueue.run(() =>
          this.client.chat.completions.create(requestParams)
        );

        return {
          content: response.choices[0]?.message?.content || "",
          usage: {
            inputTokens: response.usage?.prompt_tokens || 0,
            outputTokens: response.usage?.completion_tokens || 0,
          },
        };
      } catch (error) {
        if (attempt < MAX_RETRIES && isRetryable(error)) {
          const base = is503(error) ? BASE_DELAY_503_MS : BASE_DELAY_MS;
          const baseDelay = base * Math.pow(2, attempt);
          const jitter = baseDelay * (0.5 + Math.random());
          const delay = Math.round(Math.min(jitter, 120_000));
          const errorType = is503(error) ? "503 overload" : "rate limit";
          console.warn(`OpenRouter API ${errorType} (attempt ${attempt + 1}/${MAX_RETRIES + 1}), retrying in ${Math.round(delay / 1000)}s...`);
          await sleep(delay);
          continue;
        }
        throw error;
      }
    }

    throw new Error("Unreachable");
  }

  async *generateStream(options: GenerateOptions): AsyncGenerator<StreamChunk> {
    const model = options.model || OPENROUTER_MODELS.fast;
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = options.messages.map((msg) => ({
      role: msg.role === "user" ? "user" as const : "assistant" as const,
      content: msg.content,
    }));

    let lastError: unknown = new Error("All retry attempts exhausted");
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const requestParams: OpenAI.Chat.ChatCompletionCreateParamsStreaming = {
          model,
          messages,
          temperature: options.temperature ?? 0.7,
          max_tokens: options.maxTokens ?? 8192,
          stream: true,
        };

        if (options.responseFormat === "json") {
          if (options.responseSchema) {
            requestParams.response_format = {
              type: "json_schema",
              json_schema: {
                name: "response",
                strict: true,
                schema: convertGeminiSchema(options.responseSchema),
              },
            } as OpenAI.Chat.ChatCompletionCreateParams["response_format"];
          } else {
            requestParams.response_format = { type: "json_object" };
          }
        }

        const stream = await globalQueue.run(() =>
          this.client.chat.completions.create(requestParams)
        );

        for await (const chunk of stream) {
          const content = chunk.choices[0]?.delta?.content || "";
          yield { content, done: false };
        }

        yield { content: "", done: true };
        return;
      } catch (error) {
        lastError = error;
        if (attempt < MAX_RETRIES && isRetryable(error)) {
          const base = is503(error) ? BASE_DELAY_503_MS : BASE_DELAY_MS;
          const baseDelay = base * Math.pow(2, attempt);
          const jitter = baseDelay * (0.5 + Math.random());
          const delay = Math.round(Math.min(jitter, 120_000));
          const errorType = is503(error) ? "503 overload" : "rate limit";
          console.warn(`OpenRouter stream ${errorType} (attempt ${attempt + 1}/${MAX_RETRIES + 1}), retrying in ${Math.round(delay / 1000)}s...`);
          await sleep(delay);
          continue;
        }
        throw error;
      }
    }

    throw lastError;
  }
}

// ─── Re-export schemas (translated to JSON Schema format) ────────────

// Import the raw Gemini-format schemas and convert them.
// These are used by pipeline code that passes responseSchema.
// NOTE: After migration, consider rewriting schemas as plain JSON Schema
// directly, removing the need for conversion.
export { convertGeminiSchema };
```

**Step 2: Update `lib/constants.ts` — model IDs**

Change `GEMINI_MODELS` to `OPENROUTER_MODELS`:

```ts
// OpenRouter model IDs
export const OPENROUTER_MODELS = {
  fast: "google/gemini-2.5-flash-lite",
  deep: "google/gemini-2.5-flash",
} as const;
```

Remove the old `GEMINI_MODELS` export.

**Step 3: Create `lib/ai/schemas.ts` — extract and convert schemas**

Move all the schema definitions from `lib/ai/gemini.ts` (the `GeminiSchemas` export, lines 218-461) into a new file `lib/ai/schemas.ts`. Keep the schema structure identical but export them independently so both old and new providers can use them. The schemas still use Google's `Type` enum internally — they get converted at call time by `convertGeminiSchema()`.

Actually, since we're removing `@google/genai`, we need to replace the `Type` enum. Rewrite the schemas using plain JSON Schema format directly in `lib/ai/schemas.ts`:

```ts
// Standard JSON Schema definitions for structured AI output.
// Used by OpenRouter via response_format.json_schema.

export const Schemas = {
  techStack: {
    type: "object",
    properties: {
      languages: { type: "array", items: { type: "string" } },
      frameworks: { type: "array", items: { type: "string" } },
      databases: { type: "array", items: { type: "string" } },
      tools: { type: "array", items: { type: "string" } },
      styling: { type: "array", items: { type: "string" } },
    },
    required: ["languages", "frameworks", "databases", "tools", "styling"],
    additionalProperties: false,
  },

  architecture: {
    type: "object",
    properties: {
      pattern: { type: "string" },
      description: { type: "string" },
      layers: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "string" },
            description: { type: "string" },
            files: { type: "array", items: { type: "string" } },
          },
          required: ["name", "description", "files"],
          additionalProperties: false,
        },
      },
      entryPoints: { type: "array", items: { type: "string" } },
    },
    required: ["pattern", "description", "layers", "entryPoints"],
    additionalProperties: false,
  },

  quizQuestions: {
    type: "object",
    properties: {
      questions: {
        type: "array",
        items: {
          type: "object",
          properties: {
            id: { type: "string" },
            question: { type: "string" },
            options: { type: "array", items: { type: "string" } },
            correctAnswer: { type: "number" },
            topic: { type: "string" },
            difficulty: { type: "string" },
            explanation: { type: "string" },
          },
          required: ["id", "question", "options", "correctAnswer", "topic", "difficulty", "explanation"],
          additionalProperties: false,
        },
      },
    },
    required: ["questions"],
    additionalProperties: false,
  },

  learningPath: {
    type: "object",
    properties: {
      title: { type: "string" },
      description: { type: "string" },
      modules: {
        type: "array",
        items: {
          type: "object",
          properties: {
            id: { type: "string" },
            title: { type: "string" },
            description: { type: "string" },
            techStack: { type: "string" },
            lessons: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  title: { type: "string" },
                  description: { type: "string" },
                  keyConceptsFromCode: { type: "string" },
                  resources: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        title: { type: "string" },
                        url: { type: "string" },
                        type: { type: "string" },
                        source: { type: "string" },
                      },
                      required: ["title", "url", "type", "source"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["id", "title", "description", "keyConceptsFromCode", "resources"],
                additionalProperties: false,
              },
            },
          },
          required: ["id", "title", "description", "techStack", "lessons"],
          additionalProperties: false,
        },
      },
    },
    required: ["title", "description", "modules"],
    additionalProperties: false,
  },

  exercises: {
    type: "object",
    properties: {
      exercises: {
        type: "array",
        items: {
          type: "object",
          properties: {
            id: { type: "string" },
            type: { type: "string" },
            difficulty: { type: "string" },
            title: { type: "string" },
            prompt: { type: "string" },
            originalCode: { type: "string" },
            modifiedCode: { type: "string" },
            expectedAnswer: { type: "string" },
            hints: { type: "array", items: { type: "string" } },
            relatedFile: { type: "string" },
            options: { type: "array", items: { type: "string" } },
            correctOptionIndex: { type: "number" },
            explanation: { type: "string" },
          },
          required: ["id", "type", "difficulty", "title", "prompt", "originalCode", "expectedAnswer", "hints", "relatedFile", "options", "correctOptionIndex", "explanation"],
          additionalProperties: false,
        },
      },
    },
    required: ["exercises"],
    additionalProperties: false,
  },

  // ─── Learning Path V2 Pipeline Schemas ───────────────────────────

  conceptExtraction: {
    type: "object",
    properties: {
      concepts: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "string" },
            category: { type: "string" },
            relevanceScore: { type: "number" },
            fileReferences: { type: "array", items: { type: "string" } },
            moduleGroup: { type: "string" },
          },
          required: ["name", "category", "relevanceScore", "fileReferences", "moduleGroup"],
          additionalProperties: false,
        },
      },
    },
    required: ["concepts"],
    additionalProperties: false,
  },

  dependencyGraph: {
    type: "object",
    properties: {
      nodes: {
        type: "array",
        items: {
          type: "object",
          properties: {
            index: { type: "number" },
            prerequisites: { type: "array", items: { type: "number" } },
            difficulty: { type: "number" },
            estimatedMinutes: { type: "number" },
          },
          required: ["index", "prerequisites", "difficulty", "estimatedMinutes"],
          additionalProperties: false,
        },
      },
      gapAnalysis: {
        type: "object",
        properties: {
          likelyKnown: { type: "array", items: { type: "string" } },
          focusAreas: { type: "array", items: { type: "string" } },
          summary: { type: "string" },
        },
        required: ["likelyKnown", "focusAreas", "summary"],
        additionalProperties: false,
      },
    },
    required: ["nodes", "gapAnalysis"],
    additionalProperties: false,
  },

  lessonContent: {
    type: "object",
    properties: {
      lessons: {
        type: "array",
        items: {
          type: "object",
          properties: {
            conceptIndex: { type: "number" },
            explanation: { type: "string" },
            inYourCodebase: { type: "string" },
            keyTakeaways: { type: "array", items: { type: "string" } },
            tags: { type: "array", items: { type: "string" } },
          },
          required: ["conceptIndex", "explanation", "inYourCodebase", "keyTakeaways", "tags"],
          additionalProperties: false,
        },
      },
    },
    required: ["lessons"],
    additionalProperties: false,
  },

  resourceCuration: {
    type: "object",
    properties: {
      resources: {
        type: "array",
        items: {
          type: "object",
          properties: {
            conceptIndex: { type: "number" },
            recommendations: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  platform: { type: "string" },
                  title: { type: "string" },
                  url: { type: "string" },
                  type: { type: "string" },
                  intent: { type: "string" },
                  priceTier: { type: "string" },
                  difficulty: { type: "string" },
                  estimatedDuration: { type: "string" },
                  whyThisResource: { type: "string" },
                },
                required: ["platform", "title", "url", "type", "intent", "priceTier", "difficulty", "estimatedDuration", "whyThisResource"],
                additionalProperties: false,
              },
            },
          },
          required: ["conceptIndex", "recommendations"],
          additionalProperties: false,
        },
      },
    },
    required: ["resources"],
    additionalProperties: false,
  },
} as const;
```

**Step 4: Update all imports**

Files that import from `lib/ai/gemini.ts`:
- `app/api/process/route.ts:1` — `GeminiProvider, GeminiSchemas` → `OpenRouterProvider` from `openrouter.ts`, `Schemas` from `schemas.ts`
- `lib/ai/learning-pipeline.ts:20` — `GeminiSchemas` → `Schemas` from `schemas.ts`
- `lib/constants.ts:94` — `GEMINI_MODELS` → `OPENROUTER_MODELS`

Also update all references:
- `app/api/process/route.ts:3` — `GEMINI_MODELS` → `OPENROUTER_MODELS`
- `lib/ai/learning-pipeline.ts:18` — `GEMINI_MODELS` → `OPENROUTER_MODELS`
- `lib/ai/tutorial-pipeline.ts:9` — `GEMINI_MODELS` → `OPENROUTER_MODELS`
- `app/api/process/route.ts:104` — `new GeminiProvider()` → `new OpenRouterProvider()`

Search for any other references:

Run: `grep -r "GeminiProvider\|GeminiSchemas\|GEMINI_MODELS" --include="*.ts" --include="*.tsx" -l` (excluding node_modules)

Update every hit.

**Step 5: Delete `lib/ai/gemini.ts`**

After all imports are updated, delete the old file.

**Step 6: Update `.env.local`**

Add `OPENROUTER_API_KEY` and remove `GEMINI_API_KEY` reference.

**Step 7: Update CLAUDE.md**

Change env section: `GEMINI_API_KEY` → `OPENROUTER_API_KEY`

**Step 8: Verify build**

Run: `npm run build`
Expected: Build succeeds with no errors.

**Step 9: Commit**

```bash
git add -A
git commit -m "feat: switch from Google Gemini SDK to OpenRouter provider

- Replace @google/genai with openai SDK
- Create OpenRouterProvider with OpenAI-compatible API
- Extract schemas to lib/ai/schemas.ts as standard JSON Schema
- Update RequestQueue to allow 5 concurrent requests
- Update model IDs to OpenRouter format (google/gemini-2.5-flash-lite, google/gemini-2.5-flash)"
```

---

## Task 3: Create Semantic Chunker

**Files:**
- Create: `lib/rag/chunker.ts`
- Create: `lib/rag/types.ts`

**Step 1: Create `lib/rag/types.ts`**

```ts
export interface CodeChunk {
  file: string;
  language: string;
  type: "function" | "class" | "module" | "block";
  name: string;
  startLine: number;
  endLine: number;
  content: string;
}
```

**Step 2: Create `lib/rag/chunker.ts`**

```ts
import type { RepoFile } from "@/types/github";
import type { CodeChunk } from "./types";

// ─── Language detection ──────────────────────────────────────────────

const EXTENSION_TO_LANGUAGE: Record<string, string> = {
  ts: "typescript", tsx: "typescript",
  js: "javascript", jsx: "javascript", mjs: "javascript", cjs: "javascript",
  py: "python",
  go: "go",
  java: "java",
  rs: "rust",
  rb: "ruby",
  cpp: "cpp", c: "c", h: "c", hpp: "cpp",
  cs: "c_sharp",
  kt: "kotlin",
  swift: "swift",
  php: "php",
  vue: "javascript",
  svelte: "javascript",
};

const TREESITTER_LANGUAGES = new Set([
  "typescript", "javascript", "python", "go", "java",
]);

function getLanguageFromPath(filePath: string): string {
  const ext = filePath.split(".").pop()?.toLowerCase() || "";
  return EXTENSION_TO_LANGUAGE[ext] || "unknown";
}

// ─── Tree-sitter parser (lazy-loaded) ────────────────────────────────

let parserReady: Promise<typeof import("web-tree-sitter")> | null = null;
const loadedLanguages = new Map<string, unknown>();

async function getParser() {
  if (!parserReady) {
    parserReady = (async () => {
      const TreeSitter = (await import("web-tree-sitter")).default;
      await TreeSitter.init();
      return TreeSitter;
    })() as Promise<typeof import("web-tree-sitter")>;
  }
  return parserReady;
}

async function getLanguageGrammar(TreeSitter: typeof import("web-tree-sitter"), language: string) {
  if (loadedLanguages.has(language)) {
    return loadedLanguages.get(language);
  }

  try {
    const path = await import("path");
    const wasmPath = path.join(process.cwd(), "lib", "rag", "grammars", `tree-sitter-${language}.wasm`);
    const lang = await TreeSitter.default.Language.load(wasmPath);
    loadedLanguages.set(language, lang);
    return lang;
  } catch (error) {
    console.warn(`Failed to load tree-sitter grammar for ${language}:`, error);
    return null;
  }
}

// ─── AST-based chunking ─────────────────────────────────────────────

// Node types that represent top-level semantic boundaries per language
const CHUNK_NODE_TYPES: Record<string, Set<string>> = {
  typescript: new Set([
    "function_declaration", "arrow_function", "method_definition",
    "class_declaration", "interface_declaration", "type_alias_declaration",
    "export_statement", "lexical_declaration",
  ]),
  javascript: new Set([
    "function_declaration", "arrow_function", "method_definition",
    "class_declaration", "export_statement", "lexical_declaration",
  ]),
  python: new Set([
    "function_definition", "class_definition", "decorated_definition",
  ]),
  go: new Set([
    "function_declaration", "method_declaration", "type_declaration",
  ]),
  java: new Set([
    "method_declaration", "class_declaration", "interface_declaration",
    "constructor_declaration",
  ]),
};

function getChunkType(nodeType: string): CodeChunk["type"] {
  if (nodeType.includes("class") || nodeType.includes("interface")) return "class";
  if (nodeType.includes("function") || nodeType.includes("method") || nodeType.includes("arrow") || nodeType.includes("constructor")) return "function";
  if (nodeType.includes("export") || nodeType.includes("type_alias")) return "module";
  return "block";
}

function getChunkName(node: { type: string; text: string; childCount: number; child(i: number): unknown }): string {
  // Try to extract a meaningful name from the AST node
  const text = node.text;

  // Common patterns: function foo(), class Bar, const baz =
  const funcMatch = text.match(/(?:function|class|interface|type)\s+(\w+)/);
  if (funcMatch) return funcMatch[1];

  const constMatch = text.match(/(?:const|let|var|export)\s+(?:default\s+)?(?:const|let|var|function|class)?\s*(\w+)/);
  if (constMatch) return constMatch[1];

  const defMatch = text.match(/def\s+(\w+)/);
  if (defMatch) return defMatch[1];

  const funcGoMatch = text.match(/func\s+(\w+)/);
  if (funcGoMatch) return funcGoMatch[1];

  return "anonymous";
}

async function chunkWithTreeSitter(
  file: RepoFile,
  language: string
): Promise<CodeChunk[] | null> {
  if (!TREESITTER_LANGUAGES.has(language)) return null;

  try {
    const TreeSitter = await getParser();
    const grammar = await getLanguageGrammar(TreeSitter, language);
    if (!grammar) return null;

    const parser = new TreeSitter.default();
    parser.setLanguage(grammar as Parameters<typeof parser.setLanguage>[0]);
    const tree = parser.parse(file.content);

    const chunks: CodeChunk[] = [];
    const nodeTypes = CHUNK_NODE_TYPES[language] || new Set();
    const lines = file.content.split("\n");

    // Walk top-level children of the root node
    const cursor = tree.walk();
    cursor.gotoFirstChild();

    do {
      const node = cursor.currentNode;
      if (nodeTypes.has(node.type)) {
        const startLine = node.startPosition.row;
        const endLine = node.endPosition.row;
        const lineCount = endLine - startLine + 1;

        if (lineCount > 300) {
          // Large node — split into sub-chunks
          const subChunks = chunkByLines(
            lines.slice(startLine, endLine + 1).join("\n"),
            file.path,
            language,
            300, 50, startLine
          );
          chunks.push(...subChunks);
        } else if (lineCount > 1) {
          chunks.push({
            file: file.path,
            language,
            type: getChunkType(node.type),
            name: getChunkName(node as Parameters<typeof getChunkName>[0]),
            startLine: startLine + 1,
            endLine: endLine + 1,
            content: lines.slice(startLine, endLine + 1).join("\n"),
          });
        }
      }
    } while (cursor.gotoNextSibling());

    parser.delete();
    tree.delete();

    // If we got very few chunks, the file might be mostly top-level code
    if (chunks.length === 0) {
      return [createWholeFileChunk(file, language)];
    }

    return chunks;
  } catch (error) {
    console.warn(`Tree-sitter parse failed for ${file.path}:`, error);
    return null;
  }
}

// ─── Line-based fallback chunking ────────────────────────────────────

function chunkByLines(
  content: string,
  filePath: string,
  language: string,
  windowSize = 300,
  overlap = 50,
  lineOffset = 0
): CodeChunk[] {
  const lines = content.split("\n");
  if (lines.length <= windowSize) {
    return [{
      file: filePath,
      language,
      type: "block" as const,
      name: `lines-${lineOffset + 1}-${lineOffset + lines.length}`,
      startLine: lineOffset + 1,
      endLine: lineOffset + lines.length,
      content,
    }];
  }

  const chunks: CodeChunk[] = [];
  let start = 0;

  while (start < lines.length) {
    const end = Math.min(start + windowSize, lines.length);
    chunks.push({
      file: filePath,
      language,
      type: "block",
      name: `lines-${lineOffset + start + 1}-${lineOffset + end}`,
      startLine: lineOffset + start + 1,
      endLine: lineOffset + end,
      content: lines.slice(start, end).join("\n"),
    });
    start += windowSize - overlap;
    if (start + overlap >= lines.length) break;
  }

  return chunks;
}

function createWholeFileChunk(file: RepoFile, language: string): CodeChunk {
  const lines = file.content.split("\n");
  return {
    file: file.path,
    language,
    type: "module",
    name: file.path.split("/").pop() || file.path,
    startLine: 1,
    endLine: lines.length,
    content: file.content,
  };
}

// ─── Public API ──────────────────────────────────────────────────────

export async function chunkFiles(files: RepoFile[]): Promise<CodeChunk[]> {
  const allChunks: CodeChunk[] = [];

  for (const file of files) {
    if (!file.content || file.content.trim().length === 0) continue;

    const language = getLanguageFromPath(file.path);

    // Try tree-sitter first
    const astChunks = await chunkWithTreeSitter(file, language);
    if (astChunks) {
      allChunks.push(...astChunks);
      continue;
    }

    // Fallback: line-based chunking
    const lines = file.content.split("\n");
    if (lines.length <= 300) {
      allChunks.push(createWholeFileChunk(file, language));
    } else {
      allChunks.push(...chunkByLines(file.content, file.path, language));
    }
  }

  return allChunks;
}
```

**Step 3: Download WASM grammar files**

Run the following to download grammars into `lib/rag/grammars/`:

```bash
mkdir -p lib/rag/grammars
cd lib/rag/grammars
curl -L -o tree-sitter-typescript.wasm https://github.com/nicolo-ribaudo/tree-sitter-wasm-builds/releases/download/2025-02-20/tree-sitter-typescript.wasm
curl -L -o tree-sitter-javascript.wasm https://github.com/nicolo-ribaudo/tree-sitter-wasm-builds/releases/download/2025-02-20/tree-sitter-javascript.wasm
curl -L -o tree-sitter-python.wasm https://github.com/nicolo-ribaudo/tree-sitter-wasm-builds/releases/download/2025-02-20/tree-sitter-python.wasm
curl -L -o tree-sitter-go.wasm https://github.com/nicolo-ribaudo/tree-sitter-wasm-builds/releases/download/2025-02-20/tree-sitter-go.wasm
curl -L -o tree-sitter-java.wasm https://github.com/nicolo-ribaudo/tree-sitter-wasm-builds/releases/download/2025-02-20/tree-sitter-java.wasm
cd ../../..
```

NOTE: If these URLs don't work, search npm for `tree-sitter-wasms` or `@nicolo-ribaudo/tree-sitter-wasm-builds` and download from there. The grammars can also be built from source using `tree-sitter build --wasm`.

**Step 4: Add grammars to .gitignore (optional)**

If the .wasm files are large (>1MB each), consider adding a download script instead of committing them. If they're small enough (<5MB total), just commit them.

**Step 5: Verify build**

Run: `npm run build`
Expected: Build succeeds. (The chunker won't be called yet — just verify it compiles.)

**Step 6: Commit**

```bash
git add lib/rag/types.ts lib/rag/chunker.ts lib/rag/grammars/
git commit -m "feat(rag): add semantic code chunker with web-tree-sitter and line-based fallback"
```

---

## Task 4: Create Embedder

**Files:**
- Create: `lib/rag/embedder.ts`

**Step 1: Create `lib/rag/embedder.ts`**

```ts
// Singleton embedding pipeline using @huggingface/transformers.
// Uses all-MiniLM-L6-v2 (384 dimensions).
// First call downloads ~80MB model; subsequent calls reuse cached instance.

let pipelineInstance: unknown = null;
let pipelineLoading: Promise<unknown> | null = null;

async function getPipeline() {
  if (pipelineInstance) return pipelineInstance;

  if (!pipelineLoading) {
    pipelineLoading = (async () => {
      const { pipeline } = await import("@huggingface/transformers");
      const pipe = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2", {
        // Use default cache dir — downloads model on first run
      });
      pipelineInstance = pipe;
      return pipe;
    })();
  }

  return pipelineLoading;
}

/**
 * Embed an array of text strings into 384-dimensional vectors.
 * Batches internally for efficiency.
 */
export async function embed(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];

  const pipe = await getPipeline() as (
    input: string[],
    options: { pooling: string; normalize: boolean }
  ) => Promise<{ tolist: () => number[][] }>;

  // Process in batches of 32 to avoid memory issues
  const BATCH_SIZE = 32;
  const allEmbeddings: number[][] = [];

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);
    const output = await pipe(batch, { pooling: "mean", normalize: true });
    const embeddings = output.tolist();
    allEmbeddings.push(...embeddings);
  }

  return allEmbeddings;
}

/**
 * Embed a single query string.
 */
export async function embedQuery(text: string): Promise<number[]> {
  const results = await embed([text]);
  return results[0];
}
```

**Step 2: Verify build**

Run: `npm run build`
Expected: Build succeeds.

**Step 3: Commit**

```bash
git add lib/rag/embedder.ts
git commit -m "feat(rag): add embedding singleton with @huggingface/transformers all-MiniLM-L6-v2"
```

---

## Task 5: Create Supabase Migration for pgvector

**Files:**
- Create: `supabase/migrations/005_code_chunks_pgvector.sql`

**Step 1: Create migration**

```sql
-- Enable pgvector extension
create extension if not exists vector;

-- Code chunks with embeddings for RAG retrieval
create table code_chunks (
  id bigint generated always as identity primary key,
  project_id text not null,
  file_path text not null,
  language text,
  chunk_type text,
  chunk_name text,
  start_line int,
  end_line int,
  content text not null,
  embedding vector(384) not null
);

-- Index for fast vector similarity search
create index idx_code_chunks_embedding
  on code_chunks using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

-- Index for filtering by project
create index idx_code_chunks_project_id on code_chunks (project_id);

-- RPC function for vector similarity search
create or replace function match_code_chunks(
  query_embedding vector(384),
  match_project_id text,
  match_count int default 8
)
returns table (
  id bigint,
  file_path text,
  language text,
  chunk_type text,
  chunk_name text,
  start_line int,
  end_line int,
  content text,
  similarity float
)
language sql stable
as $$
  select
    code_chunks.id,
    code_chunks.file_path,
    code_chunks.language,
    code_chunks.chunk_type,
    code_chunks.chunk_name,
    code_chunks.start_line,
    code_chunks.end_line,
    code_chunks.content,
    1 - (code_chunks.embedding <=> query_embedding) as similarity
  from code_chunks
  where code_chunks.project_id = match_project_id
  order by code_chunks.embedding <=> query_embedding
  limit match_count;
$$;
```

**Step 2: Apply migration**

Use the Supabase MCP tool `apply_migration` to apply this migration to your project.

**Step 3: Commit**

```bash
git add supabase/migrations/005_code_chunks_pgvector.sql
git commit -m "feat(db): add code_chunks table with pgvector for RAG retrieval"
```

---

## Task 6: Create Vector Store

**Files:**
- Create: `lib/rag/store.ts`

**Step 1: Create `lib/rag/store.ts`**

```ts
import { createClient } from "@/lib/supabase/server";
import { embed, embedQuery } from "./embedder";
import type { CodeChunk } from "./types";

/**
 * Index code chunks into Supabase pgvector.
 * Embeds all chunks and batch-inserts them.
 */
export async function indexChunks(
  projectId: string,
  chunks: CodeChunk[]
): Promise<void> {
  if (chunks.length === 0) return;

  const supabase = await createClient();

  // Delete existing chunks for this project (re-indexing)
  await supabase.from("code_chunks").delete().eq("project_id", projectId);

  // Embed all chunk contents
  const texts = chunks.map((c) => c.content);
  const embeddings = await embed(texts);

  // Batch insert (Supabase has row limits, insert in groups of 100)
  const BATCH_SIZE = 100;
  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    const batch = chunks.slice(i, i + BATCH_SIZE);
    const batchEmbeddings = embeddings.slice(i, i + BATCH_SIZE);

    const rows = batch.map((chunk, j) => ({
      project_id: projectId,
      file_path: chunk.file,
      language: chunk.language,
      chunk_type: chunk.type,
      chunk_name: chunk.name,
      start_line: chunk.startLine,
      end_line: chunk.endLine,
      content: chunk.content,
      embedding: JSON.stringify(batchEmbeddings[j]),
    }));

    const { error } = await supabase.from("code_chunks").insert(rows);
    if (error) {
      throw new Error(`Failed to insert code chunks: ${error.message}`);
    }
  }
}

/**
 * Query similar code chunks using pgvector cosine similarity.
 * Returns null if the query fails (caller should fall back to truncation).
 */
export async function queryChunks(
  projectId: string,
  queryText: string,
  topK = 8
): Promise<CodeChunk[] | null> {
  try {
    const supabase = await createClient();
    const queryEmbedding = await embedQuery(queryText);

    const { data, error } = await supabase.rpc("match_code_chunks", {
      query_embedding: JSON.stringify(queryEmbedding),
      match_project_id: projectId,
      match_count: topK,
    });

    if (error) {
      console.warn("pgvector query failed:", error.message);
      return null;
    }

    if (!data || data.length === 0) return null;

    return data.map((row: Record<string, unknown>) => ({
      file: String(row.file_path),
      language: String(row.language || "unknown"),
      type: String(row.chunk_type || "block") as CodeChunk["type"],
      name: String(row.chunk_name || ""),
      startLine: Number(row.start_line || 0),
      endLine: Number(row.end_line || 0),
      content: String(row.content),
    }));
  } catch (error) {
    console.warn("RAG query failed:", error);
    return null;
  }
}

/**
 * Delete all chunks for a project.
 */
export async function deleteIndex(projectId: string): Promise<void> {
  const supabase = await createClient();
  await supabase.from("code_chunks").delete().eq("project_id", projectId);
}

/**
 * Check if a project already has indexed chunks.
 */
export async function hasIndex(projectId: string): Promise<boolean> {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("code_chunks")
    .select("id", { count: "exact", head: true })
    .eq("project_id", projectId);

  if (error) return false;
  return (count || 0) > 0;
}
```

**Step 2: Verify build**

Run: `npm run build`

**Step 3: Commit**

```bash
git add lib/rag/store.ts
git commit -m "feat(rag): add pgvector store with indexing, querying, and cleanup"
```

---

## Task 7: Create RAGService

**Files:**
- Create: `lib/rag/index.ts`

**Step 1: Create `lib/rag/index.ts`**

```ts
import type { RepoFile } from "@/types/github";
import type { CodeChunk } from "./types";
import { chunkFiles } from "./chunker";
import { indexChunks, queryChunks, deleteIndex, hasIndex } from "./store";

export type { CodeChunk } from "./types";

/**
 * Format retrieved chunks for injection into an AI prompt.
 */
export function formatChunksForPrompt(chunks: CodeChunk[]): string {
  return chunks
    .map((c) => `--- ${c.file}:${c.startLine}-${c.endLine} (${c.type}: ${c.name}) ---\n${c.content}`)
    .join("\n\n");
}

export class RAGService {
  /**
   * Index a repo's files: chunk → embed → store in pgvector.
   * Skips if already indexed (call deleteIndex first to re-index).
   */
  async indexRepo(projectId: string, files: RepoFile[]): Promise<void> {
    // Check if already indexed
    const alreadyIndexed = await hasIndex(projectId);
    if (alreadyIndexed) {
      console.log(`RAG: Project ${projectId} already indexed, skipping.`);
      return;
    }

    const chunks = await chunkFiles(files);
    console.log(`RAG: Chunked ${files.length} files into ${chunks.length} chunks`);

    await indexChunks(projectId, chunks);
    console.log(`RAG: Indexed ${chunks.length} chunks for project ${projectId}`);
  }

  /**
   * Query for relevant code chunks. Returns null on failure
   * (caller should fall back to truncation-based context).
   */
  async query(projectId: string, queryText: string, topK = 8): Promise<CodeChunk[] | null> {
    return queryChunks(projectId, queryText, topK);
  }

  /**
   * Delete all indexed chunks for a project.
   */
  async deleteIndex(projectId: string): Promise<void> {
    return deleteIndex(projectId);
  }

  /**
   * Check if a project has been indexed.
   */
  async hasIndex(projectId: string): Promise<boolean> {
    return hasIndex(projectId);
  }
}
```

**Step 2: Verify build**

Run: `npm run build`

**Step 3: Commit**

```bash
git add lib/rag/index.ts
git commit -m "feat(rag): add RAGService combining chunker, embedder, and pgvector store"
```

---

## Task 8: Add RAG Context to Prompts

**Files:**
- Modify: `lib/ai/prompts.ts`

**Step 1: Add RAG-aware formatting helper**

Add to the top of `lib/ai/prompts.ts` (after the existing imports):

```ts
import type { CodeChunk } from "@/lib/rag/types";
```

Add a new helper function after the existing `getContentForIndices` function (after line 98):

```ts
/**
 * Format RAG-retrieved chunks for prompt injection.
 * Falls back to truncated files if chunks is null.
 */
function formatRAGContext(chunks: CodeChunk[] | null, files: RepoFile[], fallbackMaxLines = 150): string {
  if (chunks && chunks.length > 0) {
    return chunks
      .map((c) => `--- ${c.file}:${c.startLine}-${c.endLine} (${c.type}: ${c.name}) ---\n${c.content}`)
      .join("\n\n");
  }
  // Fallback to truncated concatenation
  return formatFilesTruncated(files, fallbackMaxLines);
}
```

**Step 2: Add RAG-aware prompt variants**

For each prompt that currently uses `formatFilesTruncated()` or `formatCodeContextForPipeline()`, add an optional `ragContext?: string` parameter that, when provided, replaces the file dump.

This is a large change — update these prompts in `PROMPTS`:
- `analyzeTechStack` — keep `formatFilesStructureOnly` as supplement, add RAG context
- `analyzeArchitecture` — replace `formatFilesTruncated` with RAG context
- `identifyAbstractions` — replace `formatFilesWithIndices` with RAG context
- `analyzeRelationships` — replace `getContentForIndices` with RAG context
- `extractRoleConcepts` — replace `codeContext` parameter
- `generateLessonContent` — replace `codeContext` parameter
- `generateExercises` — replace `formatFilesTruncated` with RAG context + concept list

Each prompt builder should accept an optional `ragContext?: string` parameter. When present, use it instead of calling the format functions. When absent, fall back to the existing format functions.

Example for `analyzeArchitecture`:

```ts
analyzeArchitecture(files: RepoFile[], ragContext?: string): string {
  const codeContext = ragContext || formatFilesTruncated(files, 80);
  return `You are a senior software architect analyzing a codebase's architecture.

CODEBASE (structure and key sections):
${codeContext}

Analyze:
1. pattern: ...
...`;
},
```

Apply the same pattern to all prompts listed above.

**Step 3: Add concept-aware exercise prompt**

Add a new prompt method alongside the existing `generateExercises`:

```ts
generateExercisesWithConcepts(
  ragContext: string,
  skillLevel: string,
  exerciseTypes: string[],
  concepts: { name: string; category: string }[],
  roleLabel: string
): string {
  const conceptList = concepts.map((c) => `- ${c.name} (${c.category})`).join("\n");
  return `You are a coding instructor creating interactive exercises from a student's OWN codebase.
These exercises should reinforce the learning path concepts identified for this student.

SKILL LEVEL: ${skillLevel}
ROLE: ${roleLabel}

LEARNING PATH CONCEPTS (exercises should target these):
${conceptList}

RELEVANT CODE:
${ragContext}

Generate exactly 8 exercises with this distribution:
- 1 error_injection
- 1 code_recreation (fill-in-the-blank)
- 1 code_explanation
- 2 mcq
- 1 output_prediction
- 1 parsons
- 1 error_message

${/* rest of the existing exercise instructions — copy from current generateExercises */""}
Types available: ${exerciseTypes.join(", ")}

... (keep all existing type-specific instructions from the current generateExercises prompt)

IMPORTANT: Each exercise should relate to one of the learning path concepts listed above.
Make ALL exercises relevant to their actual code. Reference specific files via relatedFile.
Difficulty should match their skill level.
Every exercise MUST have ALL required fields.`;
},
```

NOTE: Copy the full type-specific instructions (error_injection rules, code_recreation rules, etc.) from the existing `generateExercises` method. Don't abbreviate — the instructions are important for output quality.

**Step 4: Verify build**

Run: `npm run build`

**Step 5: Commit**

```bash
git add lib/ai/prompts.ts
git commit -m "feat(prompts): add RAG-aware context injection with truncation fallback"
```

---

## Task 9: Update Tutorial Pipeline with RAG

**Files:**
- Modify: `lib/ai/tutorial-pipeline.ts`

**Step 1: Add RAGService parameter**

Update the function signature at line 132:

```ts
export async function runTutorialPipeline(
  ai: AIProvider,
  files: RepoFile[],
  projectName: string,
  send: (type: string, data: unknown) => void,
  checkAborted: () => void,
  rag?: RAGService | null
): Promise<TutorialData> {
```

Add import at the top:

```ts
import { RAGService, formatChunksForPrompt } from "@/lib/rag";
```

**Step 2: Use RAG for abstractions step**

Before the abstractions call (line 143), add a RAG query:

```ts
let ragContext: string | undefined;
if (rag) {
  const chunks = await rag.query(projectName, "Core abstractions, design patterns, and architectural concepts in this codebase", 12);
  if (chunks) ragContext = formatChunksForPrompt(chunks);
}
```

Pass `ragContext` to the `PROMPTS.identifyAbstractions` call. This requires updating `identifyAbstractions` to accept optional RAG context (done in Task 8).

**Step 3: Use RAG for chapter writing**

In the chapter loop (line 219), replace the static file context with a RAG query:

```ts
let fileContext: string;
if (rag) {
  const chunks = await rag.query(
    projectName,
    `How ${abstraction.name} is implemented and used in this codebase: ${abstraction.description}`,
    8
  );
  fileContext = chunks
    ? formatChunksForPrompt(chunks)
    : abstraction.fileIndices
        .filter((idx) => idx >= 0 && idx < files.length)
        .map((idx) => `--- File: ${idx} # ${files[idx].path} ---\n${files[idx].content}`)
        .join("\n\n");
} else {
  fileContext = abstraction.fileIndices
    .filter((idx) => idx >= 0 && idx < files.length)
    .map((idx) => `--- File: ${idx} # ${files[idx].path} ---\n${files[idx].content}`)
    .join("\n\n");
}
```

**Step 4: Verify build**

Run: `npm run build`

**Step 5: Commit**

```bash
git add lib/ai/tutorial-pipeline.ts
git commit -m "feat(tutorial): integrate RAG context retrieval with truncation fallback"
```

---

## Task 10: Update Learning Pipeline with RAG + Split Steps

**Files:**
- Modify: `lib/ai/learning-pipeline.ts`

**Step 1: Add RAGService parameter and import**

```ts
import { RAGService, formatChunksForPrompt } from "@/lib/rag";
```

Update `runLearningPipeline` signature (line 408):

```ts
export async function runLearningPipeline(
  ai: AIProvider,
  input: LearningPipelineInput,
  send: (type: string, data: unknown) => void,
  checkAborted: () => void,
  rag?: RAGService | null
): Promise<LearningPathV2> {
```

**Step 2: Replace `formatCodeContextForPipeline` with RAG**

At line 437, replace:

```ts
const codeContext = formatCodeContextForPipeline(files);
```

With:

```ts
let codeContext: string;
if (rag) {
  const chunks = await rag.query(
    projectId,
    `Code related to ${role.displayName} responsibilities in this codebase`,
    10
  );
  codeContext = chunks ? formatChunksForPrompt(chunks) : formatCodeContextForPipeline(files);
} else {
  codeContext = formatCodeContextForPipeline(files);
}
```

**Step 3: Add RAG to lesson content step**

At the lesson generation step (line 511), replace the static `codeContext` with a dynamic per-concept RAG query. Since lessons are generated in a single batch call, query RAG for all concepts and combine:

```ts
let lessonCodeContext = codeContext; // fallback
if (rag) {
  const conceptQueries = concepts.map((c) => `How ${c.name} is implemented in this codebase`);
  // Query for the first 3 most relevant concepts to keep context focused
  const topConcepts = concepts.slice(0, 5);
  const chunkResults = await Promise.all(
    topConcepts.map((c) =>
      rag.query(projectId, `Implementation and usage of ${c.name} in this codebase`, 6)
    )
  );
  const allChunks = chunkResults.filter(Boolean).flat() as CodeChunk[];
  // Deduplicate by file+startLine
  const seen = new Set<string>();
  const uniqueChunks = allChunks.filter((c) => {
    const key = `${c.file}:${c.startLine}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  if (uniqueChunks.length > 0) {
    lessonCodeContext = formatChunksForPrompt(uniqueChunks);
  }
}
```

Add import for `CodeChunk`:

```ts
import type { CodeChunk } from "@/lib/rag/types";
```

**Step 4: Export individual step functions**

For Phase 4 (parallelization), the route.ts needs to call individual steps. Export the step logic as separate functions. Add after the `assembleSkillTree` function:

```ts
// ─── Exported Step Functions (for parallel execution) ────────────────

export async function extractConcepts(
  ai: AIProvider,
  input: LearningPipelineInput,
  codeContext: string
): Promise<RawConcept[]> {
  // ... extract the concept extraction logic from runLearningPipeline lines 446-472
}

export async function buildDependencyGraph(
  ai: AIProvider,
  concepts: RawConcept[],
  skillLevel: string,
  codebasePatterns: string
): Promise<{ nodes: RawGraphNode[]; gapAnalysis: GapAnalysis }> {
  // ... extract from lines 477-506
}

export async function generateLessons(
  ai: AIProvider,
  concepts: RawConcept[],
  skillLevel: string,
  codeContext: string
): Promise<RawLesson[]> {
  // ... extract from lines 511-538
}

export async function curateResources(
  ai: AIProvider,
  concepts: RawConcept[],
  lessons: RawLesson[],
  graphNodes: RawGraphNode[],
  skillLevel: string
): Promise<RawResource[]> {
  // ... extract from lines 543-574
}

// Also export assembleSkillTree and the Raw types
export type { RawConcept, RawGraphNode, RawLesson, RawResource };
export { assembleSkillTree };
```

Each exported function should contain the exact logic currently inside `runLearningPipeline`, extracted verbatim. The `runLearningPipeline` function should then call these exported functions to avoid duplication.

**Step 5: Verify build**

Run: `npm run build`

**Step 6: Commit**

```bash
git add lib/ai/learning-pipeline.ts
git commit -m "feat(learning): integrate RAG, export individual step functions for parallel execution"
```

---

## Task 11: Restructure Route with Parallel Execution

**Files:**
- Modify: `app/api/process/route.ts`

This is the most complex task. Rewrite the pipeline orchestration to use a dependency-based executor.

**Step 1: Add imports**

```ts
import { RAGService, formatChunksForPrompt } from "@/lib/rag";
import {
  extractConcepts,
  buildDependencyGraph,
  generateLessons,
  curateResources,
  assembleSkillTree,
} from "@/lib/ai/learning-pipeline";
import type { RawConcept, RawGraphNode, RawLesson, RawResource } from "@/lib/ai/learning-pipeline";
```

**Step 2: Create step executor utility**

Add inside the route file (or in a separate `lib/pipeline/executor.ts`):

```ts
function createStepExecutor(send: (type: string, data: unknown) => void, checkAborted: () => void) {
  const results = new Map<string, unknown>();
  const resolvers = new Map<string, () => void>();
  const promises = new Map<string, Promise<void>>();

  function waitFor(name: string): Promise<void> {
    if (results.has(name)) return Promise.resolve();
    if (!promises.has(name)) {
      promises.set(name, new Promise<void>((resolve) => {
        resolvers.set(name, resolve);
      }));
    }
    return promises.get(name)!;
  }

  function resolve(name: string): void {
    const resolver = resolvers.get(name);
    if (resolver) resolver();
  }

  async function runStep<T>(name: string, deps: string[], fn: () => Promise<T>): Promise<T> {
    await Promise.all(deps.map((d) => waitFor(d)));
    checkAborted();
    send("step_start", name);
    const result = await fn();
    results.set(name, result);
    resolve(name);
    return result;
  }

  function getResult<T>(name: string): T {
    return results.get(name) as T;
  }

  return { runStep, getResult, resolve, results };
}
```

**Step 3: Rewrite the pipeline orchestration**

Replace the current sequential steps 2-7 (lines 157-288) with:

```ts
// Step 1.5: RAG indexing
const rag = new RAGService();
send("step_start", "indexing");
send("status", "Indexing codebase for smart retrieval...");
try {
  await rag.indexRepo(repoName, files);
} catch (error) {
  console.warn("RAG indexing failed, falling back to truncation:", error);
  // Continue without RAG — all steps have fallback behavior
}
send("indexing", { indexed: true });
checkAborted();

const { runStep, getResult } = createStepExecutor(send, checkAborted);

// Seed the executor with files
// (files are available immediately, not a "step" per se)

await Promise.all([
  // ── Wave 1: Independent steps (all need only files) ──────────────
  runStep("tech_stack", [], async () => {
    send("status", "Detecting tech stack...");
    // RAG query for config files
    let ragContext: string | undefined;
    const chunks = await rag.query(repoName, "Project configuration files declaring dependencies, frameworks, and build tools", 10);
    if (chunks) ragContext = formatChunksForPrompt(chunks);

    const result = await ai.generate({
      model: OPENROUTER_MODELS.fast,
      messages: [{ role: "user", content: PROMPTS.analyzeTechStack(files, ragContext) }],
      responseFormat: "json",
      responseSchema: Schemas.techStack,
    });
    let techStack: TechStack;
    try { techStack = JSON.parse(result.content); }
    catch { techStack = { languages: [], frameworks: [], databases: [], tools: [], styling: [] }; }
    send("tech_stack", techStack);
    return techStack;
  }),

  runStep("architecture", [], async () => {
    send("status", "Analyzing architecture...");
    const chunks = await rag.query(repoName, "Main entry points, routing definitions, middleware, and application structure", 10);
    const ragContext = chunks ? formatChunksForPrompt(chunks) : undefined;

    const result = await ai.generate({
      model: OPENROUTER_MODELS.fast,
      messages: [{ role: "user", content: PROMPTS.analyzeArchitecture(files, ragContext) }],
      responseFormat: "json",
      responseSchema: Schemas.architecture,
    });
    let architecture: unknown;
    try { architecture = JSON.parse(result.content); }
    catch { architecture = { pattern: "Unknown", description: "", layers: [], entryPoints: [] }; }
    send("architecture", architecture);
    return architecture;
  }),

  runStep("key_files", [], async () => {
    send("status", "Identifying key files...");
    const result = await ai.generate({
      model: OPENROUTER_MODELS.fast,
      messages: [{ role: "user", content: PROMPTS.identifyKeyFiles(files) }],
      responseFormat: "json",
    });
    let keyFiles: unknown;
    try { keyFiles = JSON.parse(result.content); }
    catch { keyFiles = []; }
    send("key_files", keyFiles);
    return keyFiles;
  }),

  runStep("abstractions", [], async () => {
    send("status", "Identifying core concepts...");
    const tutorialData = await runTutorialPipeline(ai, files, projectName, send, checkAborted, rag);
    send("summary", tutorialData.relationships.summary);
    return tutorialData;
  }),

  // ── Steps with dependencies ──────────────────────────────────────

  runStep("concepts", ["abstractions", "tech_stack"], async () => {
    send("status", "Extracting role-based concepts...");
    const tutorialData = getResult<TutorialData>("abstractions");
    const techStack = getResult<TechStack>("tech_stack");

    const learningPath = await runLearningPipeline(
      ai,
      {
        role,
        skillLevel: skillLevel || "beginner",
        techStack,
        files,
        projectId: repoName,
        abstractions: tutorialData.abstractions,
        relationships: tutorialData.relationships,
        summary: tutorialData.relationships.summary,
        architectureJson: JSON.stringify(getResult("architecture")),
      },
      send,
      checkAborted,
      rag
    );
    return learningPath;
  }),

  runStep("exercises", ["concepts"], async () => {
    send("step_start", "exercises");
    send("status", "Generating exercises...");
    const learningPath = getResult<LearningPathV2>("concepts");
    const concepts = learningPath.nodes.map((n) => ({ name: n.name, category: n.category }));

    // RAG query for exercise-relevant code
    const conceptNames = concepts.slice(0, 5).map((c) => c.name).join(", ");
    const chunks = await rag.query(
      repoName,
      `Code implementing ${conceptNames} with functions and logic suitable for coding exercises`,
      10
    );
    const ragContext = chunks ? formatChunksForPrompt(chunks) : undefined;

    const exerciseTypes = [
      "error_injection", "code_recreation", "code_explanation",
      "mcq", "output_prediction", "parsons", "error_message",
    ];

    const prompt = ragContext
      ? PROMPTS.generateExercisesWithConcepts(ragContext, skillLevel || "beginner", exerciseTypes, concepts, role.displayName)
      : PROMPTS.generateExercises(files, skillLevel || "beginner", exerciseTypes);

    const exercisesResult = await ai.generate({
      model: OPENROUTER_MODELS.deep,
      messages: [{ role: "user", content: prompt }],
      responseFormat: "json",
      responseSchema: Schemas.exercises,
      maxTokens: 32768,
    });

    let exercises: unknown;
    try {
      const parsed = JSON.parse(exercisesResult.content);
      exercises = Array.isArray(parsed) ? parsed : parsed.exercises || [];
    } catch (e) {
      console.error("Failed to parse exercises:", e);
      exercises = [];
    }
    send("exercises", exercises);
    return exercises;
  }),
]);

// Gather all results
const tutorialData = getResult<TutorialData>("abstractions");
const techStack = getResult<TechStack>("tech_stack");
const architecture = getResult("architecture");
const keyFiles = getResult("key_files");
const learningPath = getResult<LearningPathV2>("concepts");
const exercises = getResult("exercises");

// Complete
send("complete", {
  projectData,
  analysis: {
    techStack,
    architecture,
    keyFiles,
    summary: tutorialData.relationships.summary,
    tutorial: tutorialData,
  },
  learningPath,
  exercises,
});
```

NOTE: The above is a simplified version. The actual implementation needs careful handling of:
1. The `runTutorialPipeline` call happens inside the "abstractions" step because it's sequential internally (abstractions → relationships → order → chapters)
2. The `runLearningPipeline` call happens inside "concepts" but it runs its own internal parallelization (concepts → [graph, lessons] → resources). Consider whether to keep this internal to `runLearningPipeline` or hoist it to the executor level.

The cleanest approach: keep `runTutorialPipeline` and `runLearningPipeline` as-is (they manage their own internal sequencing), and parallelize at the OUTER level:
- `abstractions` (tutorial pipeline) runs in parallel with `tech_stack`, `architecture`, `key_files`
- `concepts` (learning pipeline) waits for `abstractions` + `tech_stack`
- `exercises` waits for `concepts`

This gives the biggest wins with the least refactoring.

**Step 4: Update PROCESSING_STEPS in constants.ts**

Add the indexing step:

```ts
export const PROCESSING_STEPS = [
  { key: "files_fetched", label: "Fetching file contents" },
  { key: "indexing", label: "Indexing codebase for retrieval" },
  { key: "tech_stack", label: "Detecting tech stack" },
  // ... rest unchanged
] as const;
```

**Step 5: Verify build**

Run: `npm run build`
Expected: Build succeeds.

**Step 6: Manual smoke test**

Run: `npm run dev`

1. Navigate to the app, connect a small GitHub repo
2. Verify the processing page shows the new "indexing" step
3. Verify all steps complete (some may run faster due to parallelism)
4. Verify the results page shows learning path, tutorial, and exercises

**Step 7: Commit**

```bash
git add app/api/process/route.ts lib/constants.ts
git commit -m "feat: parallelize pipeline with dependency-based executor and RAG integration

- Steps 2-4 + abstractions run in parallel (Wave 1)
- Learning pipeline runs after abstractions + tech stack
- Exercises generated after concepts with RAG context
- New 'indexing' step for RAG embedding phase
- RequestQueue allows 5 concurrent OpenRouter requests"
```

---

## Task 12: Update CLAUDE.md and Environment

**Files:**
- Modify: `CLAUDE.md`

**Step 1: Update CLAUDE.md**

Update the Env section:
- `OPENROUTER_API_KEY` (required, replaces `GEMINI_API_KEY`)
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (unchanged)
- `GITHUB_TOKEN` (unchanged)

Update the Stack section:
- Replace "Google Gemini AI" with "OpenRouter (Gemini models)"
- Add "pgvector (Supabase), web-tree-sitter, @huggingface/transformers" to stack

Update the Key Patterns section:
- Change "AI rate limiting" to describe the new concurrent approach
- Add "RAG retrieval" pattern description

Update the Structure section:
- Add `lib/rag/` entry

**Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: update CLAUDE.md for OpenRouter, RAG, and parallel pipeline"
```

---

## Task 13: Final Verification

**Step 1: Full build check**

Run: `npm run build`
Expected: Clean build, no errors.

**Step 2: Lint check**

Run: `npm run lint`
Expected: No new lint errors.

**Step 3: Manual E2E test**

Run: `npm run dev`

Test with a medium-sized repo (30-50 files):
1. Connect repo → verify file selection works
2. Start processing → verify SSE events stream correctly
3. Check that "Indexing codebase" step appears
4. Verify parallel steps complete (some should finish around the same time)
5. Check results page → tutorial, learning path, exercises all present
6. Verify exercises reference learning path concepts

Test with a small repo (5-10 files):
1. Verify fallback behavior works (few chunks → should still produce results)

Test with uploaded code:
1. Upload a folder → verify RAG indexing works for non-GitHub sources

**Step 4: Check for regressions**

- Dashboard page loads with existing projects
- History page shows past results
- Exercise interaction works (submit answers, get feedback)

---

## Task 14: Create Chat API Route

**Files:**
- Create: `app/api/chat/route.ts`

**Step 1: Create `app/api/chat/route.ts`**

```ts
import { OpenRouterProvider } from "@/lib/ai/openrouter";
import { OPENROUTER_MODELS } from "@/lib/constants";
import { RAGService, formatChunksForPrompt } from "@/lib/rag";

export const runtime = "nodejs";

interface ChatRequest {
  projectId: string;
  message: string;
  history: { role: "user" | "assistant"; content: string }[];
  context: {
    repoName: string;
    techStack?: { languages: string[]; frameworks: string[]; databases: string[]; tools: string[]; styling: string[] };
    architecturePattern?: string;
    skillLevel: string;
    roleLabel: string;
    conceptNames?: string[];
  };
}

export async function POST(request: Request) {
  try {
    const { projectId, message, history, context } = (await request.json()) as ChatRequest;

    if (!message?.trim()) {
      return new Response(JSON.stringify({ error: "Message is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const ai = new OpenRouterProvider();
    const rag = new RAGService();
    const encoder = new TextEncoder();

    // Query RAG for relevant code chunks
    let ragContext = "";
    let referencedFiles: string[] = [];
    try {
      const chunks = await rag.query(projectId, message, 6);
      if (chunks && chunks.length > 0) {
        ragContext = formatChunksForPrompt(chunks);
        referencedFiles = [...new Set(chunks.map((c) => c.file))];
      }
    } catch {
      // RAG unavailable — proceed with general knowledge only
    }

    // Build system prompt with project context
    const techStackStr = context.techStack
      ? [...context.techStack.languages, ...context.techStack.frameworks].join(", ")
      : "unknown";

    const conceptsStr = context.conceptNames?.length
      ? `\nLEARNING PATH CONCEPTS: ${context.conceptNames.join(", ")}`
      : "";

    const systemPrompt = `You are a helpful coding tutor assisting a student who is learning about their codebase.

PROJECT: ${context.repoName}
TECH STACK: ${techStackStr}
ARCHITECTURE: ${context.architecturePattern || "unknown"}
STUDENT SKILL LEVEL: ${context.skillLevel}
STUDENT ROLE: ${context.roleLabel}${conceptsStr}

${ragContext ? `RELEVANT CODE FROM THEIR CODEBASE:\n${ragContext}` : "No specific code context available — answer based on general knowledge of the tech stack."}

INSTRUCTIONS:
- Answer questions about their specific codebase when code context is available
- When no relevant code is found, provide general guidance about the technologies
- Adapt your explanations to the student's skill level (${context.skillLevel})
- Reference specific files and line numbers when discussing code
- Be concise but thorough — aim for 2-4 paragraphs unless a longer explanation is needed
- Use code examples from their codebase when possible
- If you're unsure about something specific to their codebase, say so rather than guessing`;

    // Build message history for the LLM
    const messages = [
      { role: "user" as const, content: systemPrompt },
      { role: "model" as const, content: "Understood. I'm ready to help with questions about this codebase." },
      ...history.map((msg) => ({
        role: msg.role === "user" ? "user" as const : "model" as const,
        content: msg.content,
      })),
      { role: "user" as const, content: message },
    ];

    // Stream the response
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Send referenced files first
          if (referencedFiles.length > 0) {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: "references", data: referencedFiles })}\n\n`)
            );
          }

          const generator = ai.generateStream({
            model: OPENROUTER_MODELS.deep,
            messages,
            temperature: 0.7,
            maxTokens: 4096,
          });

          for await (const chunk of generator) {
            if (chunk.content) {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ type: "content", data: chunk.content })}\n\n`)
              );
            }
            if (chunk.done) {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ type: "done" })}\n\n`)
              );
            }
          }
        } catch (error) {
          const msg = error instanceof Error ? error.message : "Chat failed";
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: "error", data: msg })}\n\n`)
          );
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("Chat route error:", error);
    return new Response(JSON.stringify({ error: "Chat failed" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
```

**Step 2: Verify build**

Run: `npm run build`

**Step 3: Commit**

```bash
git add app/api/chat/route.ts
git commit -m "feat(chat): add SSE streaming chat endpoint with RAG context retrieval"
```

---

## Task 15: Create Chat Hook

**Files:**
- Create: `hooks/use-chat.ts`

**Step 1: Create `hooks/use-chat.ts`**

```ts
"use client";

import { useState, useCallback, useRef } from "react";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  references?: string[];
  isStreaming?: boolean;
}

interface ChatContext {
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

export function useChat(projectId: string, context: ChatContext) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim() || isLoading) return;

    // Add user message
    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: content.trim(),
    };

    // Add placeholder assistant message
    const assistantId = `assistant-${Date.now()}`;
    const assistantMsg: ChatMessage = {
      id: assistantId,
      role: "assistant",
      content: "",
      isStreaming: true,
    };

    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setIsLoading(true);

    // Build history from previous messages (exclude current)
    const history = messages
      .filter((m) => !m.isStreaming)
      .map((m) => ({ role: m.role, content: m.content }));

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          message: content.trim(),
          history,
          context,
        }),
        signal: controller.signal,
      });

      if (!res.ok) throw new Error("Chat request failed");

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const event = JSON.parse(line.slice(6));

            if (event.type === "content") {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId
                    ? { ...m, content: m.content + event.data }
                    : m
                )
              );
            } else if (event.type === "references") {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId
                    ? { ...m, references: event.data }
                    : m
                )
              );
            } else if (event.type === "done") {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId
                    ? { ...m, isStreaming: false }
                    : m
                )
              );
            } else if (event.type === "error") {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId
                    ? { ...m, content: `Error: ${event.data}`, isStreaming: false }
                    : m
                )
              );
            }
          } catch {
            // Skip malformed SSE lines
          }
        }
      }

      // Ensure streaming is marked as done
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId && m.isStreaming
            ? { ...m, isStreaming: false }
            : m
        )
      );
    } catch (error) {
      if ((error as Error).name !== "AbortError") {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, content: "Failed to get a response. Please try again.", isStreaming: false }
              : m
          )
        );
      }
    } finally {
      setIsLoading(false);
      abortRef.current = null;
    }
  }, [messages, isLoading, projectId, context]);

  const stopStreaming = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  return { messages, isLoading, sendMessage, stopStreaming, clearMessages };
}
```

**Step 2: Verify build**

Run: `npm run build`

**Step 3: Commit**

```bash
git add hooks/use-chat.ts
git commit -m "feat(chat): add useChat hook with SSE streaming and message state"
```

---

## Task 16: Create Chat UI Components

**Files:**
- Create: `components/chat/chat-message.tsx`
- Create: `components/chat/chat-panel.tsx`

**Step 1: Create `components/chat/chat-message.tsx`**

```tsx
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
```

**Step 2: Create `components/chat/chat-panel.tsx`**

```tsx
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
                variant="primary"
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
```

**Step 3: Verify build**

Run: `npm run build`

**Step 4: Commit**

```bash
git add components/chat/chat-message.tsx components/chat/chat-panel.tsx
git commit -m "feat(chat): add chat panel drawer with streaming messages and file references"
```

---

## Task 17: Integrate Chat into Results Page

**Files:**
- Modify: `app/(main)/results/page.tsx`

**Step 1: Add ChatPanel import**

Add to imports at top of file:

```ts
import { ChatPanel } from "@/components/chat/chat-panel";
```

**Step 2: Render ChatPanel**

Add just before the closing `</div>` of the return statement (before line 597's `</div>`):

```tsx
{/* Chat Panel */}
<ChatPanel
  projectId={activeSession.repoName}
  repoName={activeSession.repoName}
  techStack={techStack}
  architecturePattern={architecture?.pattern}
  skillLevel={activeSession.skillLevel || "beginner"}
  roleLabel={activeSession.role?.displayName || "Developer"}
  conceptNames={
    learningPath && "nodes" in learningPath
      ? learningPath.nodes?.map((n: { name: string }) => n.name)
      : undefined
  }
/>
```

**Step 3: Verify build**

Run: `npm run build`

**Step 4: Manual test**

Run: `npm run dev`

1. Navigate to results page with an analyzed project
2. Verify floating chat button appears in bottom-right corner
3. Click it — drawer should slide open
4. Type a question about the codebase
5. Verify streaming response appears
6. Verify file references appear below the response
7. Verify clear and close buttons work

**Step 5: Commit**

```bash
git add app/(main)/results/page.tsx
git commit -m "feat(chat): integrate chat panel into results page"
```

---

## Dependency Graph (Task Execution Order)

```
Task 1 (install deps)
    |
    +-- Task 2 (OpenRouter provider + schemas + imports)
    |       |
    |       +-- Task 11 (parallel route.ts) ← also needs Tasks 8, 9, 10
    |       |
    |       +-- Task 14 (chat API route) ← also needs Task 7
    |
    +-- Task 3 (chunker)
    |       |
    |       +-- Task 7 (RAGService) ← also needs Tasks 4, 5, 6
    |
    +-- Task 4 (embedder)
    |
    +-- Task 5 (pgvector migration)
    |       |
    |       +-- Task 6 (store)
    |
    +-- Task 8 (RAG prompts) ← needs Task 3 types
    |
    +-- Task 9 (tutorial pipeline + RAG) ← needs Tasks 7, 8
    |
    +-- Task 10 (learning pipeline + RAG + split) ← needs Tasks 7, 8
    |
    +-- Task 12 (CLAUDE.md)
    |
    +-- Task 15 (chat hook) ← independent, client-side only
    |
    +-- Task 16 (chat UI) ← needs Task 15
    |       |
    |       +-- Task 17 (integrate into results page)
    |
    +-- Task 13 (final verification) ← all tasks complete
```

**Safe parallel groups:**
- Tasks 3 + 4 + 5 can be done in parallel (chunker, embedder, migration)
- Tasks 8 + 9 + 10 can be done in parallel after their deps
- Tasks 14 + 15 + 16 can be done in parallel (chat API, hook, UI)

**Must be sequential:**
- Task 1 → Task 2 → Task 11
- Task 5 → Task 6 → Task 7
- Task 15 → Task 16 → Task 17
- All tasks → Task 13
