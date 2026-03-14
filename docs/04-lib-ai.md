# CodeCocoon — lib/ai (AI Integration)

All AI logic lives in `lib/ai/`. Uses Google Gemini via `@google/genai`.

---

## `lib/ai/provider.ts` — AI Provider Interface

```typescript
export interface AIMessage {
  role: "user" | "model";
  content: string;
}

export interface GenerateOptions {
  model?: string;
  messages: AIMessage[];
  temperature?: number;
  maxTokens?: number;
  responseFormat?: "text" | "json";
  responseSchema?: Record<string, unknown>;
}

export interface GenerateResult {
  content: string;
  usage?: {
    inputTokens: number;
    outputTokens: number;
  };
}

export interface StreamChunk {
  content: string;
  done: boolean;
}

export interface AIProvider {
  name: string;
  generate(options: GenerateOptions): Promise<GenerateResult>;
  generateStream(options: GenerateOptions): AsyncGenerator<StreamChunk>;
}
```

---

## `lib/ai/gemini.ts` — GeminiProvider + Rate Limiter + Schemas

### Rate Limiting

The global serial queue ensures only 1 API call at a time with a 7s gap between starts.
This keeps the effective rate at ~8.5 RPM, safely under the 10 RPM free-tier limit.

```typescript
import { GoogleGenAI, Type } from "@google/genai";
import type { AIProvider, GenerateOptions, GenerateResult, StreamChunk } from "./provider";
import { GEMINI_MODELS } from "@/lib/constants";

const MAX_RETRIES = 5;
const BASE_DELAY_MS = 10000;
const BASE_DELAY_503_MS = 20000;

function isRetryable(error: unknown): boolean {
  if (error instanceof Error) {
    const msg = error.message;
    if (msg.includes("429") || msg.includes("RESOURCE_EXHAUSTED")) return true;
    if (msg.includes("503") || msg.includes("UNAVAILABLE")) return true;
    if (msg.includes("fetch failed") || msg.includes("socket") || msg.includes("ECONNRESET")) return true;
    if (msg.includes("other side closed") || msg.includes("network")) return true;
    const cause = (error as { cause?: Error }).cause;
    if (cause instanceof Error) {
      const causeMsg = cause.message;
      if (causeMsg.includes("closed") || causeMsg.includes("socket") || causeMsg.includes("ECONNRESET")) return true;
    }
  }
  if (typeof error === "object" && error !== null && "status" in error) {
    const status = (error as { status: number }).status;
    if (status === 429 || status === 503) return true;
  }
  if (typeof error === "object" && error !== null && "code" in error) {
    const code = (error as { code?: string }).code;
    if (code === "UND_ERR_SOCKET" || code === "ECONNRESET" || code === "ETIMEDOUT") return true;
  }
  return false;
}

function is503(error: unknown): boolean {
  if (error instanceof Error) {
    const msg = error.message;
    if (msg.includes("503") || msg.includes("UNAVAILABLE") || msg.includes("high demand")) return true;
  }
  if (typeof error === "object" && error !== null && "status" in error) {
    return (error as { status: number }).status === 503;
  }
  return false;
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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
      await new Promise<void>((resolve) => { this.waiters.push(resolve); });
    }
    this.inFlight++;
    const now = Date.now();
    const elapsed = now - this.lastStartTime;
    if (elapsed < this.minGapMs) {
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

/** Single global queue — 1 concurrent, 7s gap → ~8.5 RPM */
const globalQueue = new RequestQueue(1, 7000);

export class GeminiProvider implements AIProvider {
  name = "gemini";
  private client: GoogleGenAI;

  constructor(apiKey?: string) {
    const key = apiKey || process.env.GEMINI_API_KEY;
    if (!key) throw new Error("GEMINI_API_KEY is required");
    this.client = new GoogleGenAI({ apiKey: key });
  }

  private buildConfig(options: GenerateOptions) {
    const config: Record<string, unknown> = {
      temperature: options.temperature ?? 0.7,
      maxOutputTokens: options.maxTokens ?? 8192,
    };
    if (options.responseFormat === "json") {
      config.responseMimeType = "application/json";
      if (options.responseSchema) {
        config.responseSchema = options.responseSchema;
      }
    }
    return config;
  }

  private buildContents(options: GenerateOptions) {
    return options.messages.map((msg) => ({
      role: msg.role === "user" ? "user" : "model",
      parts: [{ text: msg.content }],
    }));
  }

  async generate(options: GenerateOptions): Promise<GenerateResult> {
    const model = options.model || GEMINI_MODELS.fast;
    const contents = this.buildContents(options);
    const config = this.buildConfig(options);

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const response = await globalQueue.run(() =>
          this.client.models.generateContent({ model, contents, config })
        );
        return {
          content: response.text || "",
          usage: {
            inputTokens: response.usageMetadata?.promptTokenCount || 0,
            outputTokens: response.usageMetadata?.candidatesTokenCount || 0,
          },
        };
      } catch (error) {
        if (attempt < MAX_RETRIES && isRetryable(error)) {
          const base = is503(error) ? BASE_DELAY_503_MS : BASE_DELAY_MS;
          const baseDelay = base * Math.pow(2, attempt);
          const jitter = baseDelay * (0.5 + Math.random());
          const delay = Math.round(Math.min(jitter, 120_000));
          const errorType = is503(error) ? "503 overload" : "rate limit";
          console.warn(`Gemini API ${errorType} (attempt ${attempt + 1}/${MAX_RETRIES + 1}), retrying in ${Math.round(delay / 1000)}s...`);
          await sleep(delay);
          continue;
        }
        throw error;
      }
    }
    throw new Error("Unreachable");
  }

  async *generateStream(options: GenerateOptions): AsyncGenerator<StreamChunk> {
    const model = options.model || GEMINI_MODELS.fast;
    const contents = this.buildContents(options);
    const config = this.buildConfig(options);

    let lastError: unknown = new Error("All retry attempts exhausted");
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const stream = await globalQueue.run(() =>
          this.client.models.generateContentStream({ model, contents, config })
        );
        for await (const chunk of stream) {
          yield { content: chunk.text || "", done: false };
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
          console.warn(`Gemini stream ${errorType} (attempt ${attempt + 1}/${MAX_RETRIES + 1}), retrying in ${Math.round(delay / 1000)}s...`);
          await sleep(delay);
          continue;
        }
        throw error;
      }
    }
    throw lastError;
  }
}
```

### Gemini Schemas (`GeminiSchemas` exported from gemini.ts)

These are `Type.OBJECT` schemas passed to Gemini's `responseSchema` for structured JSON output.

```typescript
export const GeminiSchemas = {
  techStack: { /* languages[], frameworks[], databases[], tools[], styling[] */ },
  architecture: { /* pattern, description, layers[], entryPoints[] */ },
  quizQuestions: { /* questions[{ id, question, options[], correctAnswer, topic, difficulty, explanation }] */ },
  learningPath: { /* title, description, modules[{ id, title, description, techStack, lessons[] }] */ },
  exercises: { /* exercises[{ id, type, difficulty, title, prompt, originalCode, modifiedCode, expectedAnswer, hints[], relatedFile, options[], correctOptionIndex, explanation }] */ },
  // V2 Pipeline schemas:
  conceptExtraction: { /* concepts[{ name, category, relevanceScore, fileReferences[], moduleGroup }] */ },
  dependencyGraph: { /* nodes[{ index, prerequisites[], difficulty, estimatedMinutes }], gapAnalysis */ },
  lessonContent: { /* lessons[{ conceptIndex, explanation, inYourCodebase, keyTakeaways[], tags[] }] */ },
  resourceCuration: { /* resources[{ conceptIndex, recommendations[{ platform, title, url, type, intent, priceTier, difficulty, estimatedDuration, whyThisResource }] }] */ },
};
```

---

## `lib/ai/yaml-parser.ts`

```typescript
import yaml from "js-yaml";

/** Extract and parse YAML from a ```yaml fenced code block in LLM output. */
export function extractYaml<T>(response: string): T {
  const match = response.match(/```yaml\s*\n([\s\S]*?)```/);
  if (!match) throw new Error("No YAML code block found in response");
  const parsed = yaml.load(match[1].trim());
  if (!parsed) throw new Error("YAML parsed to null/undefined");
  return parsed as T;
}

/**
 * Parse an index entry from LLM output.
 * Handles: 0, "0", "0 # path/to/file"
 */
export function parseIndex(entry: unknown): number {
  if (typeof entry === "number") return entry;
  if (typeof entry === "string") {
    const num = entry.includes("#") ? entry.split("#")[0].trim() : entry.trim();
    const parsed = parseInt(num, 10);
    if (isNaN(parsed)) throw new Error(`Cannot parse index: ${entry}`);
    return parsed;
  }
  throw new Error(`Invalid index type: ${typeof entry}`);
}
```

---

## `lib/ai/tutorial-pipeline.ts` — 4-Step Tutorial Generation

Generates `TutorialData` from files. Called from `POST /api/process`.

### Flow
```
Step 1: identifyAbstractions  (fast model) → TutorialAbstraction[]
Step 2: analyzeRelationships  (fast model) → TutorialRelationships
Step 3: orderChapters         (fast model) → number[] (chapter order)
Step 4: writeChapter × N      (deep model) → TutorialChapter[] (sequential)
```

### Key Points
- Each chapter is written sequentially so later chapters can reference earlier ones
- `chaptersWrittenSoFar` accumulates markdown content passed as context to each new chapter
- Chapter filenames: `"01_query_processing"` format (zero-padded index + snake_case name)
- `checkAborted()` is called between steps to detect client disconnect
- `retryOnBadOutput()` retries once on YAML parse/validation failure

```typescript
export async function runTutorialPipeline(
  ai: AIProvider,
  files: RepoFile[],
  projectName: string,
  send: (type: string, data: unknown) => void,
  checkAborted: () => void
): Promise<TutorialData>
```

---

## `lib/ai/learning-pipeline.ts` — 4-Step Learning Path V2

Generates `LearningPathV2` from files + role + skill level. Called from `POST /api/process` after tutorial pipeline.

### Flow
```
Step 1: extractRoleConcepts    (fast model + JSON schema) → RawConcept[] (10-20)
Step 2: buildDependencyGraph   (fast model + JSON schema) → graph nodes + gap analysis
Step 3: generateLessonContent  (deep model + JSON schema) → lesson text for all concepts
Step 4: curateResources        (fast model + JSON schema) → 3-5 resources per concept
Assembly: assembleSkillTree()  → LearningPathV2
```

### Key Points
- Role-filtered: only concepts relevant to the user's role
- `assembleSkillTree()` combines all 4 outputs into the final `LearningPathV2`
- Module colors: 8 predefined hex colors cycling round-robin
- Concept IDs: kebab-case from concept name (`"React Hooks"` → `"react-hooks"`)
- All nodes start with `status: "ready"` (no lock system in current version)

```typescript
export interface LearningPipelineInput {
  role: RoleProfile;
  skillLevel: string;
  techStack: TechStack;
  files: RepoFile[];
  projectId: string;
  abstractions?: TutorialAbstraction[];   // from tutorial pipeline
  relationships?: TutorialRelationships;  // from tutorial pipeline
  summary?: string;
  architectureJson?: string;
}

export async function runLearningPipeline(
  ai: AIProvider,
  input: LearningPipelineInput,
  send: (type: string, data: unknown) => void,
  checkAborted: () => void
): Promise<LearningPathV2>
```

---

## `lib/ai/prompts.ts` — All LLM Prompts

The `PROMPTS` object contains all prompt-building functions. Key functions:

| Function | Model | Output Format |
|----------|-------|---------------|
| `analyzeTechStack(files)` | fast | JSON (techStack schema) |
| `analyzeArchitecture(files)` | fast | JSON (architecture schema) |
| `identifyKeyFiles(files)` | fast | JSON array |
| `generateSummary(files)` | fast | Plain text |
| `generateQuizQuestions(techStack, skillLevel)` | fast | JSON (quizQuestions schema) |
| `generateExercises(files, skillLevel, types)` | deep | JSON (exercises schema) |
| `evaluateExerciseAnswer(type, prompt, expected, user)` | fast | JSON `{ isCorrect, feedback }` |
| `identifyAbstractions(files, projectName)` | fast | YAML code block |
| `analyzeRelationships(files, abstractions, projectName)` | fast | YAML code block |
| `orderChapters(abstractions, relationships, projectName)` | fast | YAML code block |
| `writeChapter(params)` | deep | Markdown |
| `extractRoleConcepts(params)` | fast | JSON (conceptExtraction schema) |
| `buildDependencyGraph(params)` | fast | JSON (dependencyGraph schema) |
| `generateLessonContent(params)` | deep | JSON (lessonContent schema) |
| `curateResources(params)` | fast | JSON (resourceCuration schema) |

### File Truncation Strategy
- `formatFilesStructureOnly()` — Only imports/exports/signatures (for tech stack analysis)
- `formatFilesTruncated(files, maxLines=150)` — First N lines, cap at 80K chars total
- `formatFilesWithIndices(files)` — With `--- File Index N: path ---` markers (for tutorial)
- `getContentForIndices(files, indices)` — Full content for specific files

### Skill Level Descriptions in Prompts
- **beginner**: "ZERO or minimal coding experience. May have used AI tools..."
- **intermediate**: "Has 1-2 years of coding experience..."
- **advanced**: "Experienced developer with 3+ years of professional work..."
