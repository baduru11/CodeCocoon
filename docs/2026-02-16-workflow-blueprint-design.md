# Blueprint: Recreating the Codebase-to-Tutorial Workflow

> **Purpose:** Step-by-step instructions for an AI agent (Claude Code or similar) to build a workflow that reads a codebase and generates a beginner-friendly multi-chapter tutorial. This document is self-contained — an AI with no prior context can follow it to produce a working implementation.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Framework Foundation — The Node Lifecycle](#2-framework-foundation--the-node-lifecycle)
3. [Shared State — The Data Contract](#3-shared-state--the-data-contract)
4. [Node 1 — FetchRepo (Data Ingestion)](#4-node-1--fetchrepo-data-ingestion)
5. [Node 2 — IdentifyAbstractions (LLM Analysis)](#5-node-2--identifyabstractions-llm-analysis)
6. [Node 3 — AnalyzeRelationships (LLM Analysis)](#6-node-3--analyzerelationships-llm-analysis)
7. [Node 4 — OrderChapters (LLM Analysis)](#7-node-4--orderchapters-llm-analysis)
8. [Node 5 — WriteChapters (Batch LLM Generation)](#8-node-5--writechapters-batch-llm-generation)
9. [Node 6 — CombineTutorial (File Output)](#9-node-6--combinetutorial-file-output)
10. [The LLM Utility](#10-the-llm-utility)
11. [Entry Point and Wiring](#11-entry-point-and-wiring)
12. [Repeating Patterns — What Every LLM Node Does](#12-repeating-patterns--what-every-llm-node-does)
13. [File Structure to Create](#13-file-structure-to-create)
14. [Dependencies](#14-dependencies)
15. [Step-by-Step Build Order](#15-step-by-step-build-order)

---

## 1. Architecture Overview

The workflow is a **6-node sequential pipeline**. Each node does one thing, reads from a shared dictionary, and writes its output back. No node runs until the previous one finishes.

```
FetchRepo → IdentifyAbstractions → AnalyzeRelationships → OrderChapters → WriteChapters → CombineTutorial
```

- **Nodes 1 and 6** do I/O (read files, write files). No LLM calls.
- **Nodes 2, 3, 4** each make one LLM call, parse YAML output, validate it.
- **Node 5** is a BatchNode — it makes one LLM call per chapter, sequentially.

The entire state lives in a single Python dictionary called `shared` that is passed to every node.

---

## 2. Framework Foundation — The Node Lifecycle

Every processing step is a `Node` with exactly 3 phases:

```
prep(shared) → exec(prep_res) → post(shared, prep_res, exec_res)
```

### What each phase does

| Phase | Input | Purpose | Rules |
|-------|-------|---------|-------|
| `prep(shared)` | The shared dict | Extract and transform data needed for exec | Read from shared. Return a value. Do NOT call APIs here. |
| `exec(prep_res)` | Return value of prep | Do the actual work (LLM calls, file I/O) | Has NO access to shared. This isolation makes retries safe. |
| `post(shared, prep_res, exec_res)` | All three | Write results back to shared | Update shared dict. Optionally return an action string for branching. |

### Retry mechanism

Nodes accept `max_retries` and `wait` parameters:

```python
class Node(BaseNode):
    def __init__(self, max_retries=1, wait=0):
        ...
    def _exec(self, prep_res):
        for self.cur_retry in range(self.max_retries):
            try:
                return self.exec(prep_res)
            except Exception as e:
                if self.cur_retry == self.max_retries - 1:
                    return self.exec_fallback(prep_res, e)
                if self.wait > 0:
                    time.sleep(self.wait)
```

- `self.cur_retry` is 0-indexed, accessible inside `exec()`.
- On final failure, `exec_fallback()` re-raises the exception by default.
- All LLM nodes use `max_retries=5, wait=20` — 5 attempts, 20-second delay between.

### BatchNode

A Node where `prep()` returns a **list of items** and `exec(item)` is called once per item:

```python
class BatchNode(Node):
    def _exec(self, items):
        return [super(BatchNode, self)._exec(i) for i in (items or [])]
```

- `post()` receives the full list of results.
- Each `exec()` call has independent retry logic.

### Node chaining

The `>>` operator connects nodes into a sequence:

```python
node_a >> node_b >> node_c  # equivalent to: node_a.next(node_b); node_b.next(node_c)
```

### Flow

Wraps a chain and orchestrates execution:

```python
class Flow(BaseNode):
    def __init__(self, start=None):
        ...
    def _orch(self, shared, params=None):
        curr = copy.copy(self.start_node)
        while curr:
            curr._run(shared)  # calls prep → exec → post
            last_action = curr._run(shared)
            curr = copy.copy(self.get_next_node(curr, last_action))
        return last_action
```

It runs each node in sequence, passing the same `shared` dict to every node.

---

## 3. Shared State — The Data Contract

An AI recreating this workflow must initialize this exact structure before the flow runs.

### Initial state (set by entry point)

```python
shared = {
    # --- INPUTS ---
    "repo_url": str | None,       # GitHub URL (mutually exclusive with local_dir)
    "local_dir": str | None,      # Local path (mutually exclusive with repo_url)
    "project_name": str | None,   # Optional — auto-derived from URL/path if omitted
    "github_token": str | None,   # Optional GitHub personal access token
    "output_dir": "output",       # Base output directory
    "include_patterns": set,      # e.g. {"*.py", "*.js", "*.ts"}
    "exclude_patterns": set,      # e.g. {"*test*", "*docs/*", ".git/*"}
    "max_file_size": 100000,      # ~100KB limit per file
    "language": "english",        # Target tutorial language
    "use_cache": True,            # LLM response caching toggle
    "max_abstraction_num": 10,    # Cap on identified concepts

    # --- OUTPUTS (populated by nodes as they run) ---
    "files": [],                  # Node 1 → [(path, content), ...]
    "abstractions": [],           # Node 2 → [{"name": str, "description": str, "files": [int]}]
    "relationships": {},          # Node 3 → {"summary": str, "details": [{"from": int, "to": int, "label": str}]}
    "chapter_order": [],          # Node 4 → [int, int, ...] indices into abstractions
    "chapters": [],               # Node 5 → [str, str, ...] markdown content strings
    "final_output_dir": None      # Node 6 → path string to output folder
}
```

### Index-based references

This is the key design decision. Files are stored as an ordered list of `(path, content)` tuples. Everything else references items by integer index into this list:

- `abstractions[i]["files"]` = list of file indices (ints)
- `relationships["details"][j]["from"]` and `["to"]` = abstraction indices (ints)
- `chapter_order` = list of abstraction indices in tutorial order

No data is duplicated. Everything points back by position.

### Data flow between nodes

```
Node 1 (FetchRepo)            → writes shared["files"]
Node 2 (IdentifyAbstractions) → reads files               → writes shared["abstractions"]
Node 3 (AnalyzeRelationships) → reads files, abstractions → writes shared["relationships"]
Node 4 (OrderChapters)        → reads abstractions, relationships → writes shared["chapter_order"]
Node 5 (WriteChapters)        → reads all of the above    → writes shared["chapters"]
Node 6 (CombineTutorial)      → reads all of the above    → writes files to disk
```

---

## 4. Node 1 — FetchRepo (Data Ingestion)

**Purpose:** Convert a GitHub URL or local directory into a normalized list of `(filepath, content)` tuples.

**Type:** Regular `Node` — no retries needed (no LLM call).

### prep(shared)

1. Read `repo_url`, `local_dir`, `project_name` from shared.
2. If `project_name` is None, derive it:
   - From URL: take last path segment, strip `.git` suffix.
   - From local path: take the directory basename.
3. Write derived `project_name` back to shared. (This is the one exception where prep mutates shared.)
4. Return a dict: `{"repo_url", "local_dir", "token", "include_patterns", "exclude_patterns", "max_file_size", "use_relative_paths": True}`.

### exec(prep_res)

- If `repo_url` exists → call `crawl_github_files(...)`.
- If `local_dir` exists → call `crawl_local_files(...)`.
- Both return `{"files": {path: content}}` — a dict.
- Convert to ordered list: `list(result["files"].items())` → `[(path, content), ...]`.
- Raise `ValueError` if zero files.
- Return the list.

### post(shared, prep_res, exec_res)

```python
shared["files"] = exec_res
```

### Utility: crawl_github_files

- Parses GitHub URL → extracts `owner`, `repo`, optional `ref` (branch/commit), `specific_path`.
- Recursively calls GitHub Contents API: `GET /repos/{owner}/{repo}/contents/{path}?ref={ref}`.
- Handles rate limiting: reads `X-RateLimit-Reset` header, sleeps, retries.
- Supports SSH URLs: clones to temp directory via `gitpython`.
- Filters: `include_patterns` matches filename, `exclude_patterns` matches full path, both via `fnmatch`.
- Skips files exceeding `max_file_size`.

### Utility: crawl_local_files

- Uses `os.walk()` to traverse directory.
- Loads `.gitignore` via `pathspec.PathSpec.from_lines("gitwildmatch", ...)`.
- Prunes excluded directories early (modifies `dirs` list in-place during walk to skip subtrees).
- Applies include/exclude pattern matching with `fnmatch`.
- Reads files with `utf-8-sig` encoding.

### What to implement

1. A function that takes a source (URL or path) and returns `{path: content}` dict.
2. Pattern-based file filtering (include and exclude) using `fnmatch` glob syntax.
3. File size limits.
4. Conversion from dict → ordered list of tuples. **Order matters** — indices are used by all subsequent nodes.

---

## 5. Node 2 — IdentifyAbstractions (LLM Analysis)

**Purpose:** Feed the entire codebase to an LLM and extract 5-10 core concepts with names, descriptions, and associated file indices.

**Type:** Regular `Node` with `max_retries=5, wait=20`.

### prep(shared)

1. Read `files`, `project_name`, `language`, `use_cache`, `max_abstraction_num`.
2. Build a single context string by concatenating ALL files with index markers:
   ```
   --- File Index 0: path/to/file1.py ---
   <full file content>

   --- File Index 1: path/to/file2.js ---
   <full file content>
   ```
3. Build a file listing string for the prompt:
   ```
   - 0 # path/to/file1.py
   - 1 # path/to/file2.js
   ```
4. Return tuple: `(context, file_listing, file_count, project_name, language, use_cache, max_abstraction_num)`.

### exec(prep_res)

1. Unpack the tuple.
2. Build the prompt. Key elements:
   - Project name.
   - Full codebase context string.
   - Language instruction (only if not English): "Generate `name` and `description` in {language}."
   - Task: "Identify the top 5-{max} core most important abstractions to help those new to the codebase."
   - Per abstraction: `name`, `description` (~100 words, beginner-friendly, with analogy), `file_indices`.
   - Output format: YAML in fenced code blocks.
   - Include an example YAML structure to guide the LLM.
3. Call `call_llm(prompt, use_cache=(use_cache and self.cur_retry == 0))`.
4. Validate:
   - Extract YAML between `` ```yaml `` and `` ``` `` markers.
   - Parse with `yaml.safe_load()`.
   - Assert result is a list.
   - For each item: assert keys `name` (str), `description` (str), `file_indices` (list).
   - Parse each index entry — handles both raw `int` and `"0 # path/to/file"` string formats.
   - Validate bounds: `0 <= idx < file_count`.
   - Deduplicate and sort indices.
5. Any validation failure raises `ValueError` → triggers retry.
6. Return: `[{"name": str, "description": str, "files": [int, int, ...]}, ...]`.

### Exact prompt template

```
For the project `{project_name}`:

Codebase Context:
{context}

{language_instruction}Analyze the codebase context.
Identify the top 5-{max_abstraction_num} core most important abstractions to help those new to the codebase.

For each abstraction, provide:
1. A concise `name`.
2. A beginner-friendly `description` explaining what it is with a simple analogy, in around 100 words.
3. A list of relevant `file_indices` (integers) using the format `idx # path/comment`.

List of file indices and paths present in the context:
{file_listing_for_prompt}

Format the output as a YAML list of dictionaries:

```yaml
- name: |
    Query Processing
  description: |
    Explains what the abstraction does.
    It's like a central dispatcher routing requests.
  file_indices:
    - 0 # path/to/file1.py
    - 3 # path/to/related.py
- name: |
    Query Optimization
  description: |
    Another core concept, similar to a blueprint for objects.
  file_indices:
    - 5 # path/to/another.js
# ... up to {max_abstraction_num} abstractions
```
```

### post(shared, prep_res, exec_res)

```python
shared["abstractions"] = exec_res
```

---

## 6. Node 3 — AnalyzeRelationships (LLM Analysis)

**Purpose:** Generate a project summary and map how abstractions interact with each other.

**Type:** Regular `Node` with `max_retries=5, wait=20`.

### Helper function

```python
def get_content_for_indices(files_data, indices):
    """Given the files list and a set of integer indices, return a dict of {\"idx # path\": content}."""
    content_map = {}
    for i in indices:
        if 0 <= i < len(files_data):
            path, content = files_data[i]
            content_map[f"{i} # {path}"] = content
    return content_map
```

This helper is used by both Node 3 and Node 5.

### prep(shared)

1. Read `abstractions`, `files`, `project_name`, `language`, `use_cache`.
2. Build context string with two parts:
   - **Abstraction listing:** For each abstraction `i`:
     ```
     - Index 0: Query Processing (Relevant file indices: [0, 3, 5])
       Description: Explains what the abstraction does...
     ```
   - **Relevant file snippets:** Collect union of all file indices across all abstractions. Use `get_content_for_indices()` to get content. Format:
     ```
     --- File: 0 # path/to/file1.py ---
     <content>

     --- File: 3 # path/to/related.py ---
     <content>
     ```
3. Build abstraction listing for prompt: `"0 # Query Processing\n1 # Data Flow\n..."`.
4. Return tuple: `(context, abstraction_listing, num_abstractions, project_name, language, use_cache)`.

### exec(prep_res)

1. Build prompt asking for:
   - `summary`: Beginner-friendly project overview with markdown bold/italic formatting.
   - `relationships`: List of interactions, each with `from_abstraction`, `to_abstraction`, `label`.
2. Key constraints in prompt:
   - "Every abstraction must appear in at least one relationship."
   - "Labels should be just a few words" (e.g., "Manages", "Provides config").
   - "Relationship should be backed by one abstraction calling or passing parameters to another."
3. Language instruction added if not English.
4. Call LLM. Extract YAML. Validate:
   - Result is a dict with keys `summary` (str) and `relationships` (list).
   - Each relationship has `from_abstraction`, `to_abstraction` (parseable to int), `label` (str).
   - Both indices in range `0..num_abstractions-1`.
5. Return: `{"summary": str, "details": [{"from": int, "to": int, "label": str}, ...]}`.

### Exact prompt template

```
Based on the following abstractions and relevant code snippets from the project `{project_name}`:

List of Abstraction Indices and Names:
{abstraction_listing}

Context (Abstractions, Descriptions, Code):
{context}

{language_instruction}Please provide:
1. A high-level `summary` of the project's main purpose and functionality in a few beginner-friendly sentences. Use markdown formatting with **bold** and *italic* text to highlight important concepts.
2. A list (`relationships`) describing the key interactions between these abstractions. For each relationship, specify:
    - `from_abstraction`: Index of the source abstraction (e.g., `0 # AbstractionName1`)
    - `to_abstraction`: Index of the target abstraction (e.g., `1 # AbstractionName2`)
    - `label`: A brief label for the interaction **in just a few words** (e.g., "Manages", "Inherits", "Uses").
    Ideally the relationship should be backed by one abstraction calling or passing parameters to another.
    Simplify the relationship and exclude those non-important ones.

IMPORTANT: Make sure EVERY abstraction is involved in at least ONE relationship (either as source or target). Each abstraction index must appear at least once across all relationships.

Format the output as YAML:

```yaml
summary: |
  A brief, simple explanation of the project.
  Can span multiple lines with **bold** and *italic* for emphasis.
relationships:
  - from_abstraction: 0 # AbstractionName1
    to_abstraction: 1 # AbstractionName2
    label: "Manages"
  - from_abstraction: 2 # AbstractionName3
    to_abstraction: 0 # AbstractionName1
    label: "Provides config"
  # ... other relationships
```

Now, provide the YAML output:
```

### post(shared, prep_res, exec_res)

```python
shared["relationships"] = exec_res
```

---

## 7. Node 4 — OrderChapters (LLM Analysis)

**Purpose:** Determine the best pedagogical order to present abstractions as tutorial chapters.

**Type:** Regular `Node` with `max_retries=5, wait=20`.

### prep(shared)

1. Read `abstractions`, `relationships`, `project_name`, `language`, `use_cache`.
2. Build abstraction listing: `"- 0 # AbstractionName\n- 1 # AnotherName"`.
3. Build context string:
   - Project summary from `relationships["summary"]`.
   - Each relationship: `"From 0 (QueryProcessing) to 1 (DataFlow): Manages"`.
4. Return tuple: `(abstraction_listing, context, num_abstractions, project_name, list_lang_note, use_cache)`.

### exec(prep_res)

1. Build prompt: "What is the best order to explain these abstractions, from first to last?"
2. Guidance: "First explain foundational/user-facing concepts, then detailed/lower-level implementation."
3. Request YAML list: `"- 2 # FoundationalConcept\n- 0 # CoreClassA"`.
4. Call LLM. Extract YAML. Validate:
   - Result is a list.
   - Parse each entry to integer (handles both `int` and `"0 # name"` formats).
   - Every index in range, no duplicates.
   - **Must contain every abstraction exactly once** — raises if count doesn't match.
5. Return: `[int, int, ...]`.

### Exact prompt template

```
Given the following project abstractions and their relationships for the project `{project_name}`:

Abstractions (Index # Name):
{abstraction_listing}

Context about relationships and project summary:
{context}

If you are going to make a tutorial for `{project_name}`, what is the best order to explain these abstractions, from first to last?
Ideally, first explain those that are the most important or foundational, perhaps user-facing concepts or entry points. Then move to more detailed, lower-level implementation details or supporting concepts.

Output the ordered list of abstraction indices, including the name in a comment for clarity. Use the format `idx # AbstractionName`.

```yaml
- 2 # FoundationalConcept
- 0 # CoreClassA
- 1 # CoreClassB (uses CoreClassA)
- ...
```

Now, provide the YAML output:
```

### post(shared, prep_res, exec_res)

```python
shared["chapter_order"] = exec_res
```

---

## 8. Node 5 — WriteChapters (Batch LLM Generation)

**Purpose:** Write full markdown content for each chapter. Most complex node. Uses BatchNode — prep returns a list, exec runs per item.

**Type:** `BatchNode` with `max_retries=5, wait=20`.

### prep(shared)

1. Read `chapter_order`, `abstractions`, `files`, `project_name`, `language`, `use_cache`.
2. Initialize `self.chapters_written_so_far = []` — instance variable to accumulate context across sequential exec calls.
3. **Build chapter metadata.** For each abstraction index in `chapter_order`:
   - `chapter_num` = 1-based position.
   - Safe filename: replace non-alphanumeric chars with `_`, lowercase, prefix with zero-padded number → `"01_query_processing.md"`.
   - Store: `chapter_filenames[abstraction_index] = {"num": N, "name": str, "filename": str}`.
4. Build `full_chapter_listing`:
   ```
   1. [Query Processing](01_query_processing.md)
   2. [Data Flow](02_data_flow.md)
   ```
5. **Build items list** — one dict per chapter:
   ```python
   {
       "chapter_num": int,
       "abstraction_index": int,
       "abstraction_details": {"name": str, "description": str, "files": [int]},
       "related_files_content_map": {"idx # path": content, ...},  # from get_content_for_indices()
       "project_name": str,
       "full_chapter_listing": str,
       "chapter_filenames": dict,
       "prev_chapter": {"num": int, "name": str, "filename": str} | None,
       "next_chapter": {"num": int, "name": str, "filename": str} | None,
       "language": str,
       "use_cache": bool,
   }
   ```
6. Return the items list.

### exec(item) — called once per chapter, sequentially

1. Build file context string from `related_files_content_map`:
   ```
   --- File: path/to/file1.py ---
   <content>

   --- File: path/to/utils.py ---
   <content>
   ```
2. Get `previous_chapters_summary` = `"\n---\n".join(self.chapters_written_so_far)`.
3. Build prompt with these instructions:
   - Heading: `# Chapter {N}: {name}`.
   - If not first chapter, transition from previous chapter with markdown link.
   - Start with motivation: what problem does this solve? Concrete use case.
   - Break complex abstractions into key concepts, explain one by one.
   - **Code blocks must be under 10 lines** — break longer code into pieces.
   - Include a mermaid `sequenceDiagram` for internal implementation, max 5 participants.
   - **Always link to other chapters** via `[Chapter Title](filename.md)`.
   - Use analogies heavily.
   - End with conclusion and transition to next chapter (with link).
4. If not English, add detailed translation instructions.
5. Call LLM.
6. **Post-process heading:** If response doesn't start with `# Chapter {N}`, fix it.
7. **Append to context:** `self.chapters_written_so_far.append(chapter_content)`.
8. Return the markdown string.

### Critical design: progressive context

Each chapter's prompt includes summaries of ALL previously written chapters. This ensures narrative continuity — later chapters reference and build on earlier ones. `self.chapters_written_so_far` accumulates across the sequential `exec()` calls that BatchNode makes.

### Exact prompt template (abbreviated — key structure)

```
Write a very beginner-friendly tutorial chapter (in Markdown format) for the project `{project_name}` about the concept: "{abstraction_name}". This is Chapter {chapter_num}.

Concept Details:
- Name: {abstraction_name}
- Description:
{abstraction_description}

Complete Tutorial Structure:
{full_chapter_listing}

Context from previous chapters:
{previous_chapters_summary or "This is the first chapter."}

Relevant Code Snippets:
{file_context_str}

Instructions for the chapter:
- Start with heading `# Chapter {N}: {name}`
- If not first chapter, transition from previous with markdown link
- Begin with high-level motivation and a concrete use case
- Break complex abstractions into key concepts, explain one by one
- Code blocks BELOW 10 lines — break longer code into smaller pieces
- Describe internal implementation with a sequenceDiagram (max 5 participants)
- ALWAYS use proper Markdown links for other chapters: [Title](filename.md)
- Use mermaid diagrams for complex concepts
- Heavily use analogies and examples
- End with conclusion and transition to next chapter with link
- Tone: welcoming, easy for newcomers
```

### post(shared, prep_res, exec_res_list)

```python
shared["chapters"] = exec_res_list  # list of markdown strings in chapter order
del self.chapters_written_so_far    # cleanup
```

---

## 9. Node 6 — CombineTutorial (File Output)

**Purpose:** Assemble all generated content into markdown files on disk.

**Type:** Regular `Node` — no retries, no LLM.

### prep(shared)

1. Read `project_name`, `output_dir`, `repo_url`, `relationships`, `chapter_order`, `abstractions`, `chapters`.
2. Compute output path: `{output_dir}/{project_name}`.
3. **Generate Mermaid diagram:**
   ```
   flowchart TD
       A0["Query Processing"]
       A1["Data Flow"]
       A0 -- "Manages" --> A1
   ```
   - For each abstraction `i`: `A{i}["{name}"]`.
   - For each relationship: `A{from} -- "{label}" --> A{to}`.
   - Truncate labels longer than 30 characters with `...`.
4. **Build index.md content:**
   ```markdown
   # Tutorial: {project_name}

   {summary}

   **Source Repository:** [{repo_url}]({repo_url})

   ```mermaid
   {diagram}
   ```

   ## Chapters

   1. [Abstraction Name](01_abstraction_name.md)
   2. [Another Concept](02_another_concept.md)
   ```
5. **Build chapter files list:** For each chapter in order:
   - Generate same safe filename as WriteChapters (must match exactly).
   - Append attribution footer to content.
   - Store as `{"filename": str, "content": str}`.
6. Return `{"output_path", "index_content", "chapter_files"}`.

### exec(prep_res)

1. `os.makedirs(output_path, exist_ok=True)`.
2. Write `index.md`.
3. Write each chapter `.md` file.
4. Return `output_path`.

### post(shared, prep_res, exec_res)

```python
shared["final_output_dir"] = exec_res
```

### Filename generation (must be identical in Node 5 and Node 6)

```python
safe_name = "".join(c if c.isalnum() else "_" for c in abstraction_name).lower()
filename = f"{chapter_num:02d}_{safe_name}.md"
```

This logic appears in both `WriteChapters.prep()` and `CombineTutorial.prep()`. They MUST produce the same filenames — otherwise cross-chapter markdown links will break.

---

## 10. The LLM Utility

**Purpose:** Single function `call_llm(prompt, use_cache=True)` that all nodes call.

### Architecture

```
call_llm(prompt, use_cache)
   ├─ Check disk cache (llm_cache.json) → return cached response if hit
   ├─ Detect provider via get_llm_provider()
   │   ├─ "GEMINI" → _call_llm_gemini(prompt)
   │   └─ anything else → _call_llm_provider(prompt)  [OpenAI-compatible]
   ├─ Log prompt and response to daily log file
   └─ Save response to disk cache
```

### Caching

- **File-based:** reads/writes `llm_cache.json`.
- **Key:** full prompt string. **Value:** full response string.
- Checked before calling provider, updated after successful call.
- Nodes pass `use_cache=(use_cache and self.cur_retry == 0)` — cache only on first attempt. Retries always call the LLM fresh.

### Provider detection

```python
def get_llm_provider():
    provider = os.getenv("LLM_PROVIDER")
    if not provider and (os.getenv("GEMINI_PROJECT_ID") or os.getenv("GEMINI_API_KEY")):
        provider = "GEMINI"
    return provider
```

### Gemini provider

- Uses `google.genai.Client`.
- Supports Vertex AI (`GEMINI_PROJECT_ID` + `GEMINI_LOCATION`) and direct API key (`GEMINI_API_KEY`).
- Default model: `gemini-2.5-pro-exp-03-25`.

### Generic OpenAI-compatible provider

- Reads env vars: `{PROVIDER}_MODEL`, `{PROVIDER}_BASE_URL`, `{PROVIDER}_API_KEY`.
- Posts to `{base_url}/v1/chat/completions`.
- Standard chat format: `{"messages": [{"role": "user", "content": prompt}], "temperature": 0.7}`.
- Works with Ollama, XAI, or any OpenAI-compatible API.

### What to implement

1. A `call_llm(prompt)` function returning a string.
2. Disk-based caching (prompt → response) to avoid redundant expensive calls.
3. At minimum one LLM provider integration.
4. Logging of prompt/response pairs for debugging.

---

## 11. Entry Point and Wiring

### Default file patterns

```python
DEFAULT_INCLUDE_PATTERNS = {
    "*.py", "*.js", "*.jsx", "*.ts", "*.tsx", "*.go", "*.java", "*.pyi", "*.pyx",
    "*.c", "*.cc", "*.cpp", "*.h", "*.md", "*.rst", "*Dockerfile",
    "*Makefile", "*.yaml", "*.yml",
}

DEFAULT_EXCLUDE_PATTERNS = {
    "*test*", "*tests/*", "*examples/*", "*docs/*", "*venv/*", "*.venv/*",
    ".git/*", ".github/*", ".next/*", ".vscode/*",
    "*node_modules/*", "*dist/*", "*build/*",
    "assets/*", "data/*", "images/*", "public/*", "static/*", "temp/*",
    "*obj/*", "*bin/*", "*experimental/*", "*deprecated/*", "*misc/*", "*legacy/*",
    "v1/*", "*.log"
}
```

### CLI arguments

| Argument | Type | Default | Purpose |
|----------|------|---------|---------|
| `--repo` | str | required* | GitHub URL |
| `--dir` | str | required* | Local path |
| `-n, --name` | str | auto-derived | Project name |
| `-t, --token` | str | env var | GitHub PAT |
| `-o, --output` | str | `"output"` | Output base dir |
| `-i, --include` | list | defaults above | Include patterns |
| `-e, --exclude` | list | defaults above | Exclude patterns |
| `-s, --max-size` | int | 100000 | Max file size bytes |
| `--language` | str | `"english"` | Tutorial language |
| `--no-cache` | flag | False | Disable LLM cache |
| `--max-abstractions` | int | 10 | Max concepts to identify |

*`--repo` and `--dir` are mutually exclusive; one is required.

### Flow wiring

```python
def create_tutorial_flow():
    fetch_repo = FetchRepo()
    identify_abstractions = IdentifyAbstractions(max_retries=5, wait=20)
    analyze_relationships = AnalyzeRelationships(max_retries=5, wait=20)
    order_chapters = OrderChapters(max_retries=5, wait=20)
    write_chapters = WriteChapters(max_retries=5, wait=20)
    combine_tutorial = CombineTutorial()

    fetch_repo >> identify_abstractions >> analyze_relationships >> order_chapters >> write_chapters >> combine_tutorial

    return Flow(start=fetch_repo)

# Run
tutorial_flow = create_tutorial_flow()
tutorial_flow.run(shared)
```

---

## 12. Repeating Patterns — What Every LLM Node Does

Nodes 2, 3, 4, and 5 all follow the same pattern. An AI builder should extract this into a mental template:

### The LLM-YAML-Validate pattern

```
1. PREP: Read from shared → build context string → build prompt inputs → return tuple
2. EXEC:
   a. Construct prompt with: context, task, format instructions, YAML example
   b. Request output as YAML inside ```yaml ``` fenced blocks
   c. Call call_llm(prompt, use_cache=(use_cache and self.cur_retry == 0))
   d. Extract YAML: response.strip().split("```yaml")[1].split("```")[0].strip()
   e. Parse: yaml.safe_load(yaml_str)
   f. Validate structure: check types, required keys, index bounds
   g. Any validation error → raise ValueError → Node retries automatically
   h. Return validated data
3. POST: shared["key"] = exec_res
```

### Multi-language support pattern

Every LLM node follows the same language handling:

```python
language_instruction = ""
if language.lower() != "english":
    language_instruction = f"IMPORTANT: Generate fields in **{language.capitalize()}** language."
# Insert language_instruction into prompt
```

Only applied when language is not English. Specific hints are added to individual fields in the YAML example.

### Index parsing pattern

LLM outputs indices in formats like `0`, `"0 # path/to/file"`, or `"0"`. All nodes parse them the same way:

```python
if isinstance(entry, int):
    idx = entry
elif isinstance(entry, str) and "#" in entry:
    idx = int(entry.split("#")[0].strip())
else:
    idx = int(str(entry).strip())
```

---

## 13. File Structure to Create

```
project_root/
├── main.py                      # Entry point: CLI args, shared dict init, run flow
├── flow.py                      # Flow wiring: instantiate nodes, chain with >>
├── nodes.py                     # All 6 node classes + get_content_for_indices helper
├── utils/
│   ├── call_llm.py              # LLM abstraction: call_llm(), caching, provider detection
│   ├── crawl_github_files.py    # GitHub repo crawler
│   └── crawl_local_files.py     # Local directory crawler
├── requirements.txt             # Dependencies
├── .env.sample                  # Template for API keys
└── output/                      # Default output directory (created at runtime)
    └── {project_name}/
        ├── index.md
        ├── 01_chapter_name.md
        ├── 02_chapter_name.md
        └── ...
```

---

## 14. Dependencies

```
pocketflow>=0.0.1         # Node/BatchNode/Flow framework
pyyaml>=6.0               # YAML parsing for LLM output
requests>=2.28.0          # HTTP for GitHub API and OpenAI-compatible APIs
gitpython>=3.1.0          # Git clone for SSH URLs
google-genai>=1.9.0       # Google Gemini SDK (if using Gemini)
google-cloud-aiplatform    # Vertex AI support (if using Vertex)
python-dotenv>=1.0.0      # .env file loading
pathspec>=0.11.0          # .gitignore pattern matching
```

---

## 15. Step-by-Step Build Order

An AI agent should build this in the following order:

### Step 1: Install framework and dependencies

```bash
pip install pocketflow pyyaml requests gitpython python-dotenv pathspec google-genai
```

### Step 2: Build `utils/call_llm.py`

Start here because every LLM node depends on it.

1. Implement `call_llm(prompt, use_cache=True)` → returns string.
2. Implement disk-based caching (JSON file, prompt as key).
3. Implement at least one provider (Gemini or OpenAI-compatible).
4. Add logging.

### Step 3: Build `utils/crawl_github_files.py` and `utils/crawl_local_files.py`

1. Implement file crawling with include/exclude pattern filtering.
2. Both must return `{"files": {path: content}}`.
3. Handle edge cases: rate limits, SSH URLs, .gitignore.

### Step 4: Build `nodes.py` — implement nodes in order

Build each node class one at a time, in pipeline order:

1. `get_content_for_indices()` helper function.
2. `FetchRepo(Node)` — no LLM, just calls crawl utilities.
3. `IdentifyAbstractions(Node)` — first LLM node, establishes the YAML-validate pattern.
4. `AnalyzeRelationships(Node)` — same pattern, different prompt.
5. `OrderChapters(Node)` — same pattern, simpler output.
6. `WriteChapters(BatchNode)` — most complex; progressive context via instance variable.
7. `CombineTutorial(Node)` — no LLM, file assembly and Mermaid generation.

### Step 5: Build `flow.py`

Wire all nodes together:

```python
fetch_repo >> identify_abstractions >> analyze_relationships >> order_chapters >> write_chapters >> combine_tutorial
return Flow(start=fetch_repo)
```

### Step 6: Build `main.py`

1. Parse CLI arguments.
2. Initialize the shared dict with all inputs and empty output slots.
3. Call `create_tutorial_flow().run(shared)`.

### Step 7: Test incrementally

1. Test FetchRepo alone on a small repo.
2. Add IdentifyAbstractions — verify YAML parsing and validation.
3. Add each subsequent node, verifying shared state after each.
4. Full end-to-end test on a small repository.

---

## Summary of Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| Index-based references | Avoids duplicating file content; everything references by position |
| YAML output format | Structured enough for parsing, flexible enough for LLM to produce |
| Fenced code blocks for YAML | Easy to extract with string splitting; LLMs produce this naturally |
| Retry with cache bypass | First attempt uses cache; retries get fresh LLM responses |
| BatchNode for chapters | Each chapter is independent work but needs sequential context |
| Progressive chapter context | Later chapters reference earlier ones for narrative continuity |
| prep/exec/post separation | exec has no access to shared → retries are safe |
| Filename generation in two places | Both Node 5 and Node 6 must produce identical filenames for links to work |
