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

// web-tree-sitter 0.24 exports a single class as default.
// After init(), it serves as both the Parser constructor and hosts Language.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TreeSitterClass = any;

let treeSitterClass: TreeSitterClass | null = null;
let initPromise: Promise<TreeSitterClass> | null = null;
const loadedLanguages = new Map<string, unknown>();
const failedLanguages = new Set<string>();

async function getTreeSitter(): Promise<TreeSitterClass> {
  if (treeSitterClass) return treeSitterClass;
  if (!initPromise) {
    initPromise = (async () => {
      const mod = await import("web-tree-sitter");
      const TS = mod.default;
      await TS.init();
      treeSitterClass = TS;
      return TS;
    })();
  }
  return initPromise;
}

async function getLanguageGrammar(
  TreeSitter: TreeSitterClass,
  language: string
): Promise<unknown | null> {
  if (loadedLanguages.has(language)) {
    return loadedLanguages.get(language)!;
  }
  if (failedLanguages.has(language)) {
    return null;
  }

  try {
    const wasmPath = await resolveGrammarPath(language);
    if (!wasmPath) {
      console.warn(
        `[chunker] No WASM grammar found for "${language}". Falling back to line-based chunking.`
      );
      failedLanguages.add(language);
      return null;
    }

    const lang = await TreeSitter.Language.load(wasmPath);
    loadedLanguages.set(language, lang);
    return lang;
  } catch (error) {
    console.warn(
      `[chunker] Failed to load tree-sitter grammar for "${language}":`,
      error instanceof Error ? error.message : String(error)
    );
    failedLanguages.add(language);
    return null;
  }
}

/**
 * Resolve the filesystem path to a .wasm grammar file.
 * Checks two locations:
 *   1. lib/rag/grammars/ (committed / downloaded grammars)
 *   2. node_modules/tree-sitter-wasms/out/ (installed npm package)
 *
 * Returns the path string if found, null otherwise.
 */
async function resolveGrammarPath(language: string): Promise<string | null> {
  const path = await import("path");
  const fs = await import("fs");

  const filename = `tree-sitter-${language}.wasm`;

  // Location 1: project grammars directory
  const projectPath = path.join(process.cwd(), "lib", "rag", "grammars", filename);
  if (fs.existsSync(projectPath)) {
    return projectPath;
  }

  // Location 2: tree-sitter-wasms npm package
  const npmPath = path.join(process.cwd(), "node_modules", "tree-sitter-wasms", "out", filename);
  if (fs.existsSync(npmPath)) {
    return npmPath;
  }

  return null;
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
  if (
    nodeType.includes("function") ||
    nodeType.includes("method") ||
    nodeType.includes("arrow") ||
    nodeType.includes("constructor")
  ) return "function";
  if (nodeType.includes("export") || nodeType.includes("type_alias")) return "module";
  return "block";
}

function getChunkName(nodeText: string): string {
  // Common patterns: function foo(), class Bar, const baz =
  const funcMatch = nodeText.match(/(?:function|class|interface|type)\s+(\w+)/);
  if (funcMatch) return funcMatch[1];

  const constMatch = nodeText.match(
    /(?:const|let|var|export)\s+(?:default\s+)?(?:const|let|var|function|class)?\s*(\w+)/
  );
  if (constMatch) return constMatch[1];

  const defMatch = nodeText.match(/def\s+(\w+)/);
  if (defMatch) return defMatch[1];

  const funcGoMatch = nodeText.match(/func\s+(\w+)/);
  if (funcGoMatch) return funcGoMatch[1];

  return "anonymous";
}

async function chunkWithTreeSitter(
  file: RepoFile,
  language: string
): Promise<CodeChunk[] | null> {
  if (!TREESITTER_LANGUAGES.has(language)) return null;

  try {
    const TreeSitter = await getTreeSitter();
    const grammar = await getLanguageGrammar(TreeSitter, language);
    if (!grammar) return null;

    const parser = new TreeSitter();
    parser.setLanguage(grammar);
    const tree = parser.parse(file.content);

    if (!tree) {
      parser.delete();
      return null;
    }

    const chunks: CodeChunk[] = [];
    const nodeTypes = CHUNK_NODE_TYPES[language] || new Set<string>();
    const lines = file.content.split("\n");

    // Walk top-level children of the root node
    const cursor = tree.walk();
    if (cursor.gotoFirstChild()) {
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
              name: getChunkName(node.text),
              startLine: startLine + 1,
              endLine: endLine + 1,
              content: lines.slice(startLine, endLine + 1).join("\n"),
            });
          }
        }
      } while (cursor.gotoNextSibling());
    }

    cursor.delete();
    parser.delete();
    tree.delete();

    // If we got very few chunks, the file might be mostly top-level code
    if (chunks.length === 0) {
      return [createWholeFileChunk(file, language)];
    }

    return chunks;
  } catch (error) {
    console.warn(
      `[chunker] Tree-sitter parse failed for ${file.path}:`,
      error instanceof Error ? error.message : error
    );
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
