export interface CodeChunk {
  file: string;
  language: string;
  type: "function" | "class" | "module" | "block";
  name: string;
  startLine: number;
  endLine: number;
  content: string;
}
