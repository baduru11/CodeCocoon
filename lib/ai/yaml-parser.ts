import yaml from "js-yaml";

/**
 * Extract and parse YAML from a fenced code block in LLM output.
 * Throws if extraction or parsing fails.
 */
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
