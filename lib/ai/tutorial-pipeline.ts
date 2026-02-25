import type { AIProvider } from "./provider";
import type { RepoFile } from "@/types/github";
import type {
  TutorialAbstraction,
  TutorialRelationships,
  TutorialChapter,
  TutorialData,
} from "@/types/tutorial";
import { AI_MODELS } from "@/lib/constants";
import { PROMPTS } from "./prompts";
import { extractYaml, parseIndex } from "./yaml-parser";

// ─── Validation ──────────────────────────────────────────────────────

function validateAbstractions(
  raw: unknown,
  fileCount: number
): TutorialAbstraction[] {
  if (!Array.isArray(raw)) throw new Error("Abstractions must be an array");

  return raw.map((item: Record<string, unknown>) => {
    if (!item.name || !item.description) {
      throw new Error("Abstraction missing name or description");
    }
    const rawIndices = (item.file_indices ?? item.fileIndices) as unknown[];
    if (!Array.isArray(rawIndices)) {
      throw new Error("Abstraction missing file_indices array");
    }
    const fileIndices = rawIndices
      .map(parseIndex)
      .filter((idx) => idx >= 0 && idx < fileCount);

    return {
      name: String(item.name).trim(),
      description: String(item.description).trim(),
      fileIndices: [...new Set(fileIndices)].sort((a, b) => a - b),
    };
  });
}

function validateRelationships(
  raw: unknown,
  numAbstractions: number
): TutorialRelationships {
  const obj = raw as Record<string, unknown>;
  if (!obj.summary || !Array.isArray(obj.relationships)) {
    throw new Error("Missing summary or relationships");
  }

  const details = (obj.relationships as Record<string, unknown>[]).map((r) => {
    const from = parseIndex(r.from_abstraction);
    const to = parseIndex(r.to_abstraction);
    if (from < 0 || from >= numAbstractions || to < 0 || to >= numAbstractions) {
      throw new Error(`Relationship index out of bounds: ${from} -> ${to}`);
    }
    return { from, to, label: String(r.label).trim() };
  });

  return { summary: String(obj.summary).trim(), details };
}

function validateChapterOrder(
  raw: unknown,
  numAbstractions: number
): number[] {
  if (!Array.isArray(raw)) throw new Error("Chapter order must be an array");
  const order = raw.map(parseIndex);
  const unique = [...new Set(order)];

  if (unique.length !== numAbstractions) {
    throw new Error(
      `Chapter order must contain all ${numAbstractions} abstractions, got ${unique.length}`
    );
  }
  for (const idx of unique) {
    if (idx < 0 || idx >= numAbstractions) {
      throw new Error(`Chapter order index out of bounds: ${idx}`);
    }
  }
  return unique;
}

// ─── Helpers ─────────────────────────────────────────────────────────

/** Retry only on validation errors (bad YAML/output from LLM). Network/429
 *  errors are already handled by the Gemini-level retry + throttle. */
async function retryOnBadOutput<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    console.warn(
      "Tutorial pipeline validation failed, retrying once in 3s...",
      error instanceof Error ? error.message : error
    );
    await new Promise((resolve) => setTimeout(resolve, 3000));
    return await fn();
  }
}

function buildChapterFilenames(
  order: number[],
  abstractions: TutorialAbstraction[]
): Record<number, { num: number; name: string; filename: string }> {
  const result: Record<number, { num: number; name: string; filename: string }> = {};
  order.forEach((absIdx, i) => {
    const name = abstractions[absIdx].name;
    const safeName = name.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase();
    result[absIdx] = {
      num: i + 1,
      name,
      filename: `${String(i + 1).padStart(2, "0")}_${safeName}`,
    };
  });
  return result;
}

function buildChapterListing(
  order: number[],
  abstractions: TutorialAbstraction[],
  filenames: Record<number, { num: number; name: string; filename: string }>
): string {
  return order
    .map(
      (absIdx) =>
        `${filenames[absIdx].num}. [${filenames[absIdx].name}](${filenames[absIdx].filename})`
    )
    .join("\n");
}

// ─── Main Pipeline ───────────────────────────────────────────────────

export async function runTutorialPipeline(
  ai: AIProvider,
  files: RepoFile[],
  projectName: string,
  send: (type: string, data: unknown) => void,
  checkAborted: () => void
): Promise<TutorialData> {
  // Step 1: Identify Abstractions
  send("step_start", "tutorial_abstractions");
  send("status", "Identifying core concepts...");

  const abstractions = await retryOnBadOutput(async () => {
    const result = await ai.generate({
      model: AI_MODELS.fast,
      messages: [
        {
          role: "user",
          content: PROMPTS.identifyAbstractions(files, projectName),
        },
      ],
    });
    return validateAbstractions(extractYaml(result.content), files.length);
  });

  send("tutorial_abstractions", abstractions);
  checkAborted();

  // Step 2: Analyze Relationships
  send("step_start", "tutorial_relationships");
  send("status", "Mapping relationships...");

  const relationships = await retryOnBadOutput(async () => {
    const result = await ai.generate({
      model: AI_MODELS.fast,
      messages: [
        {
          role: "user",
          content: PROMPTS.analyzeRelationships(files, abstractions, projectName),
        },
      ],
    });
    return validateRelationships(
      extractYaml(result.content),
      abstractions.length
    );
  });

  send("tutorial_relationships", relationships);
  checkAborted();

  // Step 3: Order Chapters
  send("step_start", "tutorial_order");
  send("status", "Planning chapter order...");

  const chapterOrder = await retryOnBadOutput(async () => {
    const result = await ai.generate({
      model: AI_MODELS.fast,
      messages: [
        {
          role: "user",
          content: PROMPTS.orderChapters(abstractions, relationships, projectName),
        },
      ],
    });
    return validateChapterOrder(
      extractYaml(result.content),
      abstractions.length
    );
  });

  send("tutorial_order", chapterOrder);
  checkAborted();

  // Step 4: Write Chapters (sequential — each builds on previous)
  send("step_start", "tutorial_chapters");
  send("status", "Writing tutorial chapters...");

  const chapterFilenames = buildChapterFilenames(chapterOrder, abstractions);
  const fullChapterListing = buildChapterListing(
    chapterOrder,
    abstractions,
    chapterFilenames
  );

  const chapters: TutorialChapter[] = [];
  const chaptersWrittenSoFar: string[] = [];

  for (let i = 0; i < chapterOrder.length; i++) {
    const absIdx = chapterOrder[i];
    const abstraction = abstractions[absIdx];
    const chapterNum = i + 1;

    // Get file content for this abstraction's relevant files
    const fileContext = abstraction.fileIndices
      .filter((idx) => idx >= 0 && idx < files.length)
      .map((idx) => `--- File: ${idx} # ${files[idx].path} ---\n${files[idx].content}`)
      .join("\n\n");

    const prevChapter =
      i > 0 ? chapterFilenames[chapterOrder[i - 1]] : undefined;
    const nextChapter =
      i < chapterOrder.length - 1
        ? chapterFilenames[chapterOrder[i + 1]]
        : undefined;

    send("status", `Writing chapter ${chapterNum} of ${chapterOrder.length}...`);

    const chapterContent = await ai.generate({
      model: AI_MODELS.deep,
      messages: [
        {
          role: "user",
          content: PROMPTS.writeChapter({
            projectName,
            chapterNum,
            abstractionName: abstraction.name,
            abstractionDescription: abstraction.description,
            fullChapterListing,
            previousChaptersSummary: chaptersWrittenSoFar.join("\n---\n"),
            fileContext,
            prevChapter,
            nextChapter,
          }),
        },
      ],
      maxTokens: 8192,
    });

    const chapter: TutorialChapter = {
      index: absIdx,
      name: abstraction.name,
      filename: chapterFilenames[absIdx].filename,
      content: chapterContent.content,
    };

    chapters.push(chapter);
    chaptersWrittenSoFar.push(chapterContent.content);

    // Send per-chapter progress event
    send("tutorial_chapter", {
      chapterNum,
      total: chapterOrder.length,
      chapter,
    });

    checkAborted();
  }

  return { abstractions, relationships, chapterOrder, chapters };
}
