import type { RepoFile } from "@/types/github";
import type { RoleProfile } from "@/types/learning";
import type { TutorialAbstraction, TutorialRelationships } from "@/types/tutorial";

const MAX_LINES_PER_FILE = 150;
const MAX_TOTAL_CHARS = 80_000;

function formatFilesForPrompt(files: RepoFile[]): string {
  return files
    .map((f) => `--- FILE: ${f.path} (${f.language}) ---\n${f.content}`)
    .join("\n\n");
}

/** Truncate each file to N lines and cap total size. */
function formatFilesTruncated(files: RepoFile[], maxLines = MAX_LINES_PER_FILE): string {
  let total = 0;
  const parts: string[] = [];
  for (const f of files) {
    if (total >= MAX_TOTAL_CHARS) break;
    const lines = f.content.split("\n");
    const truncated = lines.length > maxLines
      ? lines.slice(0, maxLines).join("\n") + `\n... (${lines.length - maxLines} more lines)`
      : f.content;
    const chunk = `--- FILE: ${f.path} (${f.language}) ---\n${truncated}`;
    parts.push(chunk);
    total += chunk.length;
  }
  return parts.join("\n\n");
}

/** Only imports, exports, and function/class signatures — very compact. */
function formatFilesStructureOnly(files: RepoFile[]): string {
  const parts: string[] = [];
  for (const f of files) {
    const lines = f.content.split("\n");
    const important = lines.filter((line) => {
      const t = line.trim();
      return t.startsWith("import ") || t.startsWith("export ") ||
        t.startsWith("from ") || t.startsWith("require(") ||
        t.startsWith("function ") || t.startsWith("class ") ||
        t.startsWith("const ") || t.startsWith("interface ") ||
        t.startsWith("type ") || t.startsWith("enum ") ||
        t.startsWith("def ") || t.startsWith("async ") ||
        t.startsWith("@") || t.startsWith("module ") ||
        t.startsWith("package ") || t.startsWith("use ");
    });
    if (important.length > 0) {
      parts.push(`--- ${f.path} ---\n${important.join("\n")}`);
    }
  }
  return parts.join("\n\n");
}

/** Format files with integer index markers for tutorial prompts. */
function formatFilesWithIndices(files: RepoFile[]): { context: string; listing: string } {
  let total = 0;
  const contextParts: string[] = [];
  const listingParts: string[] = [];

  for (let i = 0; i < files.length; i++) {
    if (total >= MAX_TOTAL_CHARS) break;
    const f = files[i];
    const lines = f.content.split("\n");
    const truncated = lines.length > MAX_LINES_PER_FILE
      ? lines.slice(0, MAX_LINES_PER_FILE).join("\n") + `\n... (${lines.length - MAX_LINES_PER_FILE} more lines)`
      : f.content;
    const chunk = `--- File Index ${i}: ${f.path} ---\n${truncated}`;
    contextParts.push(chunk);
    listingParts.push(`- ${i} # ${f.path}`);
    total += chunk.length;
  }

  return {
    context: contextParts.join("\n\n"),
    listing: listingParts.join("\n"),
  };
}

/** Get formatted file content for specific indices. */
function getContentForIndices(files: RepoFile[], indices: number[]): string {
  return indices
    .filter((i) => i >= 0 && i < files.length)
    .map((i) => `--- File: ${i} # ${files[i].path} ---\n${files[i].content}`)
    .join("\n\n");
}

export const PROMPTS = {
  analyzeTechStack(files: RepoFile[]): string {
    return `You are a senior software engineer analyzing a codebase. Identify ALL technologies used.

CODEBASE (imports and declarations):
${formatFilesStructureOnly(files)}

Analyze every file carefully. For each category:
- languages: Programming languages used (e.g., "TypeScript", "Python")
- frameworks: Frameworks and libraries (e.g., "Next.js", "React", "Express")
- databases: Any database or ORM (e.g., "PostgreSQL", "Prisma", "MongoDB")
- tools: Build tools, testing, CI/CD (e.g., "Webpack", "Jest", "Docker")
- styling: CSS frameworks/methods (e.g., "Tailwind CSS", "CSS Modules", "styled-components")

Be specific. Don't guess — only include what's evident from the code.`;
  },

  analyzeArchitecture(files: RepoFile[]): string {
    return `You are a senior software architect analyzing a codebase's architecture.

CODEBASE (structure and key sections):
${formatFilesTruncated(files, 80)}

Analyze:
1. pattern: The overall architecture pattern (e.g., "MVC", "Component-based SPA", "Serverless", "Microservices", "Monolith")
2. description: A clear 2-3 sentence description of how the codebase is organized
3. layers: Break down the architecture into logical layers. For each layer:
   - name: Layer name (e.g., "Presentation", "Business Logic", "Data Access")
   - description: What this layer does
   - files: Key file paths in this layer
4. entryPoints: The main entry files (e.g., "app/page.tsx", "src/index.ts")

Be precise and base everything on the actual file structure.`;
  },

  analyzeCodeQuality(files: RepoFile[]): string {
    return `You are a senior code reviewer assessing code quality.

CODEBASE:
${formatFilesForPrompt(files)}

Provide:
1. score: A quality score from 0-100 based on:
   - Code organization and structure (25 points)
   - Naming conventions and readability (25 points)
   - Error handling and edge cases (25 points)
   - Best practices and patterns (25 points)
2. issues: Specific problems found (max 8). Be constructive, not harsh. Reference specific files.
3. strengths: Things done well (max 5). Acknowledge good practices.

Be honest but encouraging — this is for someone learning to code.`;
  },

  identifyKeyFiles(files: RepoFile[]): string {
    return `You are analyzing a codebase to identify the most important files for a developer to understand.

CODEBASE FILES:
${files.map((f) => `- ${f.path} (${f.language}, ${f.size} bytes)`).join("\n")}

Identify the 8-12 most important files and for each provide:
- path: The file path
- role: Its role (e.g., "Entry point", "Route definitions", "Database schema", "Main component")
- description: A brief explanation of what the file does and why it matters

Focus on files that are critical for understanding how the app works.`;
  },

  generateSummary(files: RepoFile[]): string {
    return `You are a senior technical writer creating documentation for a codebase. The reader used AI to generate this project and wants to understand how it works.

CODEBASE:
${formatFilesTruncated(files)}

Write an informative, objective summary (3-5 paragraphs) that explains:
1. What this project does (its purpose and main functionality)
2. How it's built (high-level architecture and design patterns)
3. The main technologies used and their roles in the system
4. How the components connect and data flows between them
5. The recommended starting points for understanding the codebase

Write in third person ("This project...", "The application..."). Be informative and objective.
Focus on factual descriptions of architecture, data flow, and technology choices.
Avoid subjective language, encouragement, or judgment. Do not address the reader directly.
Explain technical terms when they first appear.`;
  },

  generateQuizQuestions(techStack: string[], skillLevel: string): string {
    return `You are a coding instructor creating a skill assessment quiz.

TECH STACK: ${techStack.join(", ")}
CURRENT LEVEL: ${skillLevel}
TARGET LEVEL: Determine if the student is beginner, intermediate, or advanced

Generate exactly 8 multiple-choice questions. Requirements:
- 3 beginner questions (basic syntax, what things do)
- 3 intermediate questions (how things work together, common patterns)
- 2 advanced questions (edge cases, best practices, optimization)

Each question must:
- Have exactly 4 options (A, B, C, D)
- Have one clear correct answer (0-3 index)
- Include a brief explanation of why the answer is correct
- Be specific to the tech stack above
- Test understanding, NOT memorization

Make questions practical — "What does this code do?" or "What's the best approach for X?"
Don't make trick questions. The goal is assessment, not stumping people.`;
  },

  generateLearningPath(
    techStack: string[],
    skillLevel: string,
    codeExamples: string
  ): string {
    return `You are an expert coding instructor creating a personalized learning path.

STUDENT SKILL LEVEL: ${skillLevel}
TECH STACK TO LEARN: ${techStack.join(", ")}
CODE FROM THEIR PROJECT (for context):
${codeExamples}

Create a structured learning path with modules for each technology. Each module should have 3-5 lessons.

For each lesson, provide:
- A clear title and description
- How this concept appears in THEIR code (keyConceptsFromCode) — reference specific patterns from the code above
- 2-4 high-quality resources with REAL, WORKING URLs:
  * Official documentation pages (e.g., https://react.dev/learn/...)
  * MDN Web Docs for web fundamentals (e.g., https://developer.mozilla.org/...)
  * freeCodeCamp articles/tutorials
  * YouTube tutorials from reputable channels

IMPORTANT:
- Adapt complexity to their skill level
- Start with fundamentals if beginner, skip basics if advanced
- Always connect lessons back to their actual code
- Resources must be REAL URLs that actually exist
- Each module should build on the previous one`;
  },

  generateLearningPathWithContext(
    techStack: string[],
    skillLevel: string,
    codeExamples: string,
    analysisContext: string
  ): string {
    return `You are an expert coding instructor creating a personalized learning path.

STUDENT SKILL LEVEL: ${skillLevel}
TECH STACK TO LEARN: ${techStack.join(", ")}

ANALYSIS CONTEXT (summary and architecture of their project):
${analysisContext}

CODE FROM THEIR PROJECT (for context):
${codeExamples}

Create a structured learning path with modules for each technology. Each module should have 3-5 lessons.

For each lesson, provide:
- A clear title and description
- How this concept appears in THEIR code (keyConceptsFromCode) — reference specific patterns from the code and analysis above
- 2-4 high-quality resources with REAL, WORKING URLs:
  * Official documentation pages (e.g., https://react.dev/learn/...)
  * MDN Web Docs for web fundamentals (e.g., https://developer.mozilla.org/...)
  * freeCodeCamp articles/tutorials
  * YouTube tutorials from reputable channels

IMPORTANT:
- Use the analysis context to personalize lessons — reference their architecture pattern, tech choices, and code quality insights
- Adapt complexity to their skill level
- Start with fundamentals if beginner, skip basics if advanced
- Always connect lessons back to their actual code and project structure
- Resources must be REAL URLs that actually exist
- Each module should build on the previous one
- Prioritize lessons that address code quality issues found in the analysis`;
  },

  generateExercises(
    files: RepoFile[],
    skillLevel: string,
    exerciseTypes: string[]
  ): string {
    return `You are a coding instructor creating interactive exercises from a student's OWN codebase.

SKILL LEVEL: ${skillLevel}
CODEBASE:
${formatFilesTruncated(files.slice(0, 8))}

Generate exactly 8 exercises with this distribution:
- 1 error_injection
- 1 code_recreation (fill-in-the-blank)
- 1 code_explanation
- 2 mcq
- 1 output_prediction
- 1 parsons
- 1 error_message

Types available: ${exerciseTypes.join(", ")}

For "error_injection" exercises:
- Take REAL code from their codebase and introduce 1-3 realistic bugs (off-by-one errors, missing null checks, wrong variable names, logic errors)
- Set originalCode to an EMPTY STRING "" (do NOT include the correct version — the user must NOT see it)
- Set modifiedCode to the buggy version (this is what the user will see and debug)
- The expectedAnswer should describe the bugs and how to fix them in PLAIN TEXT (e.g., "Line 5 has an off-by-one error: the loop should use < instead of <=")
- Do NOT put corrected code in expectedAnswer — describe the fixes verbally
- Provide 2-3 progressive hints that guide toward finding bugs WITHOUT revealing the answers

For "code_recreation" exercises (FILL-IN-THE-BLANK format):
- Pick a meaningful code snippet (function, component, or logic block) from their codebase
- Create a version with key parts replaced by numbered blanks: ___BLANK_1___, ___BLANK_2___, etc.
- Set modifiedCode to the code WITH blanks (this is what the user sees)
- Set originalCode to an EMPTY STRING ""
- Set expectedAnswer to a JSON object mapping blank numbers to their correct values, e.g.: {"1": "useState", "2": "count", "3": "setCount", "4": "0"}
- BLANK DIFFICULTY SCALING (based on skill level "${skillLevel}"):
  - If beginner: Use ONLY 2-3 blanks. Blank out well-known framework APIs and common patterns (e.g., "useState", "useEffect", "import", "export default", "async", "await", "console.log", "return"). Do NOT blank out project-specific variable names or custom function names. The blanks should be guessable from general programming knowledge alone.
  - If intermediate: Use 3-4 blanks. Mix of common framework APIs and some project-specific logic. At least half the blanks should be common concepts.
  - If advanced: Use 4-6 blanks. Include project-specific variables, logic patterns, subtle operators, and nuanced details.
- Do NOT blank out trivial syntax like semicolons or brackets — focus on meaningful code elements
- The prompt should say "Fill in the blanks to complete this code snippet"
- Hints should give clues about what each blank should contain without revealing the answer
- Example modifiedCode: "const [___BLANK_1___, ___BLANK_2___] = ___BLANK_3___(___BLANK_4___);"
- Example expectedAnswer: {"1": "count", "2": "setCount", "3": "useState", "4": "0"}

For "code_explanation" exercises:
- Show a code snippet from their project
- Ask them to explain what it does
- Set originalCode to the snippet being explained
- The expectedAnswer should be CONCISE (3-5 sentences max)
- Explain at the student's skill level (${skillLevel})
- Focus on WHAT the code does and WHY, not implementation minutiae
- Use simple language, avoid jargon

For "mcq" (multiple choice) exercises:
- Create questions about concepts from their codebase
- CRITICAL: You MUST set the "options" field to an array of EXACTLY 4 strings
- CRITICAL: You MUST set "correctOptionIndex" to a number 0-3 (0-based index of the correct option)
- CRITICAL: You MUST set "expectedAnswer" to the EXACT TEXT of the correct option string (copy it verbatim from the options array)
- Set "explanation" to explain why the correct answer is right and others are wrong. IMPORTANT: Reference options as A, B, C, D (letters), NOT 1, 2, 3, 4 (numbers). For example: "A is correct because..." or "Option C is wrong because..."
- The prompt should be the question text
- Set originalCode to the relevant code snippet if applicable (or empty string if not needed)
- Example format:
  "options": ["Option A text", "Option B text", "Option C text", "Option D text"],
  "correctOptionIndex": 1,
  "expectedAnswer": "Option B text",
  "explanation": "B is correct because... Option A is wrong because..."

For "parsons" exercises (Code Ordering):
- Pick a meaningful code snippet (5-10 lines) from their codebase — a function body, a component return, or a logic block
- Split the code into individual lines, each as a separate string
- Set modifiedCode to a JSON array of the code lines SHUFFLED in random order, e.g.: ["  return result;", "function add(a, b) {", "  const result = a + b;", "}"]
- Set expectedAnswer to a JSON array of the SAME lines in the CORRECT order, e.g.: ["function add(a, b) {", "  const result = a + b;", "  return result;", "}"]
- CRITICAL: modifiedCode and expectedAnswer must contain the EXACT same lines, just in different order
- CRITICAL: Each line must be a complete, meaningful line of code (not fragments)
- Preserve indentation in the lines (e.g., "  const x = 1;" not "const x = 1;")
- The prompt should say "Arrange the following lines of code in the correct order"
- Set originalCode to an EMPTY STRING ""
- Hints should describe what the code should do step-by-step without revealing the exact order

For "error_message" exercises (Error Interpretation):
- Take code from their codebase and create a scenario where it would produce a specific error
- Set originalCode to the code snippet that causes the error
- Set modifiedCode to the ERROR MESSAGE text (e.g., "TypeError: Cannot read properties of undefined (reading 'map')" or "ReferenceError: x is not defined")
- Make the error messages realistic — use actual JavaScript/TypeScript error formats
- The prompt should say "The following code produces the error shown below. Explain what causes this error and how to fix it."
- The expectedAnswer should explain: (1) what the error means, (2) which line causes it, (3) why it happens, (4) how to fix it
- Focus on common errors: TypeError, ReferenceError, SyntaxError, undefined access, null checks, async/await issues
- Hints should guide toward understanding the error type without revealing the exact cause

For "output_prediction" exercises:
- Show a code snippet and ask "What will this code output?" or "What is the value of X after this code runs?"
- Set originalCode to the code snippet being analyzed
- CRITICAL: You MUST set the "options" field to an array of EXACTLY 4 strings representing possible outputs
- CRITICAL: You MUST set "correctOptionIndex" to a number 0-3 (0-based index of the correct output)
- CRITICAL: You MUST set "expectedAnswer" to the EXACT TEXT of the correct option string (copy it verbatim from the options array)
- Set "explanation" to explain the execution flow step-by-step showing why the correct output is produced. IMPORTANT: Reference options as A, B, C, D (letters), NOT 1, 2, 3, 4 (numbers)
- Make the wrong options realistic — common mistakes like off-by-one errors, wrong operator precedence, etc.
- The prompt should be something like "What will the following code output?" or "What is the final value of 'result'?"
- Focus on concepts like: loop behavior, conditional logic, array operations, string manipulation, scope/closure
- Example: code with a loop → options: ["0 1 2 3", "1 2 3 4", "0 1 2 3 4", "1 2 3"] where one is correct

Make ALL exercises relevant to their actual code. Reference specific files via relatedFile.
Difficulty should match their skill level.
Every exercise MUST have ALL of these fields:
- id (unique string), type, difficulty, title, prompt, originalCode (can be empty ""), expectedAnswer, hints (array of strings), relatedFile
- options (array of 4 strings for mcq/output_prediction, empty array [] for other types)
- correctOptionIndex (0-3 for mcq/output_prediction, 0 for other types)
- explanation (string for mcq/output_prediction, empty string "" for other types)`;
  },

  evaluateExerciseAnswer(
    exerciseType: string,
    prompt: string,
    expectedAnswer: string,
    userAnswer: string
  ): string {
    const typeSpecificRules: Record<string, string> = {
      error_injection: `TYPE-SPECIFIC RULES (Bug Hunt):
- The student MUST describe the bug(s) in their OWN WORDS using natural language
- They should explain WHAT is wrong and HOW to fix it
- REJECT as INCORRECT if the student:
  * Simply copy-pasted code (even if it's the correct/fixed code)
  * Pasted the code snippet shown in the exercise without any explanation
  * Wrote only code without describing the bugs in words
- A correct answer looks like: "The loop condition uses <= instead of <, causing an off-by-one error. Fix by changing line 5 to use < operator."
- An INCORRECT answer looks like: just pasting code, or writing "this is the bug" without specifics`,

      code_explanation: `TYPE-SPECIFIC RULES (Code Explanation):
- The student MUST explain what the code does in NATURAL LANGUAGE (plain English sentences)
- They should describe the code's purpose, logic flow, and behavior
- REJECT as INCORRECT if the student:
  * Simply copy-pasted the code snippet back as their answer
  * Wrote only code without any natural language explanation
  * Gave a one-word or trivially short answer (e.g., "it works", "function")
- A correct answer demonstrates UNDERSTANDING of what the code does and why
- The explanation should cover the key behavior, not just restate the code in words`,

      code_recreation: `TYPE-SPECIFIC RULES (Fill in the Blank):
- The student is filling in blanks in a code snippet
- Compare their answers to the expected blank values
- Be flexible with minor differences (e.g., single vs double quotes, trailing semicolons)
- But the core logic/keywords must match`,

      error_message: `TYPE-SPECIFIC RULES (Error Interpretation):
- The student MUST explain what causes the error in NATURAL LANGUAGE
- They should identify: the error type, which part of the code causes it, why it happens, and how to fix it
- REJECT as INCORRECT if the student:
  * Simply pasted the error message back
  * Gave a vague answer like "there's an error" without specifics
  * Only provided fixed code without explaining the cause
- A correct answer demonstrates understanding of WHY the error occurs`,

      parsons: `TYPE-SPECIFIC RULES (Code Ordering / Parsons):
- The student arranged code lines in a specific order
- Compare their ordering to the expected correct order
- The order must match exactly — each line in the correct position
- This should be a straightforward sequence comparison`,

      mcq: `TYPE-SPECIFIC RULES (Multiple Choice):
- Compare the student's selected answer to the expected correct answer
- This should be a straightforward match`,
    };

    const rules = typeSpecificRules[exerciseType] || "";

    return `You are a strict but helpful coding tutor evaluating a student's answer.

EXERCISE TYPE: ${exerciseType}
EXERCISE PROMPT: ${prompt}
EXPECTED ANSWER: ${expectedAnswer}
STUDENT'S ANSWER: ${userAnswer}

${rules}

ANTI-CHEAT CHECK (MANDATORY — do this FIRST):
1. Does the student's answer look like they just copy-pasted code from the exercise prompt?
2. Is the answer suspiciously similar to a code snippet rather than a thoughtful response?
3. For text-based exercises (error_injection, code_explanation): the answer MUST be in natural language. Code-only answers = INCORRECT.

If the anti-cheat check fails, mark as INCORRECT and provide feedback like: "It looks like you pasted the code snippet. Please describe [the bugs / what the code does] in your own words."

OTHERWISE, evaluate normally:
1. Is it correct? (boolean)
2. Constructive feedback (2-3 sentences):
   - If correct: praise what they got right, mention any alternative approaches
   - If incorrect: explain what's wrong WITHOUT giving the answer, guide them toward understanding

Be encouraging and educational. Remember, they're learning.

Respond in JSON format: { "isCorrect": boolean, "feedback": "string" }`;
  },

  // ─── Tutorial Pipeline Prompts ─────────────────────────────────────

  identifyAbstractions(files: RepoFile[], projectName: string, maxAbstractions = 10): string {
    const { context, listing } = formatFilesWithIndices(files);
    return `For the project \`${projectName}\`:

Codebase Context:
${context}

Analyze the codebase context.
Identify the top 5-${maxAbstractions} core most important abstractions to help those new to the codebase.

For each abstraction, provide:
1. A concise \`name\`.
2. A beginner-friendly \`description\` explaining what it is with a simple analogy, in around 100 words.
3. A list of relevant \`file_indices\` (integers) using the format \`idx # path/comment\`.

List of file indices and paths present in the context:
${listing}

Format the output as a YAML list of dictionaries inside a fenced code block:

\`\`\`yaml
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
# ... up to ${maxAbstractions} abstractions
\`\`\``;
  },

  analyzeRelationships(
    files: RepoFile[],
    abstractions: TutorialAbstraction[],
    projectName: string
  ): string {
    const abstractionListing = abstractions
      .map((a, i) => `${i} # ${a.name}`)
      .join("\n");

    const allFileIndices = [...new Set(abstractions.flatMap((a) => a.fileIndices))];
    const fileContent = getContentForIndices(files, allFileIndices);

    const abstractionDetails = abstractions
      .map((a, i) =>
        `- Index ${i}: ${a.name} (Relevant file indices: [${a.fileIndices.join(", ")}])\n  Description: ${a.description}`
      )
      .join("\n");

    const context = `Abstraction Details:\n${abstractionDetails}\n\nRelevant Code:\n${fileContent}`;

    return `Based on the following abstractions and relevant code snippets from the project \`${projectName}\`:

List of Abstraction Indices and Names:
${abstractionListing}

Context (Abstractions, Descriptions, Code):
${context}

Please provide:
1. A high-level \`summary\` of the project's main purpose and functionality in a few beginner-friendly sentences. Use markdown formatting with **bold** and *italic* text to highlight important concepts.
2. A list (\`relationships\`) describing the key interactions between these abstractions. For each relationship, specify:
    - \`from_abstraction\`: Index of the source abstraction (e.g., \`0 # AbstractionName1\`)
    - \`to_abstraction\`: Index of the target abstraction (e.g., \`1 # AbstractionName2\`)
    - \`label\`: A brief label for the interaction **in just a few words** (e.g., "Manages", "Inherits", "Uses").
    Ideally the relationship should be backed by one abstraction calling or passing parameters to another.
    Simplify the relationship and exclude those non-important ones.

IMPORTANT: Make sure EVERY abstraction is involved in at least ONE relationship (either as source or target).

Format the output as YAML:

\`\`\`yaml
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
\`\`\`

Now, provide the YAML output:`;
  },

  orderChapters(
    abstractions: TutorialAbstraction[],
    relationships: TutorialRelationships,
    projectName: string
  ): string {
    const abstractionListing = abstractions
      .map((a, i) => `- ${i} # ${a.name}`)
      .join("\n");

    const relationshipContext = relationships.details
      .map((r) =>
        `From ${r.from} (${abstractions[r.from]?.name}) to ${r.to} (${abstractions[r.to]?.name}): ${r.label}`
      )
      .join("\n");

    const context = `Project Summary:\n${relationships.summary}\n\nRelationships:\n${relationshipContext}`;

    return `Given the following project abstractions and their relationships for the project \`${projectName}\`:

Abstractions (Index # Name):
${abstractionListing}

Context about relationships and project summary:
${context}

If you are going to make a tutorial for \`${projectName}\`, what is the best order to explain these abstractions, from first to last?
Ideally, first explain those that are the most important or foundational, perhaps user-facing concepts or entry points. Then move to more detailed, lower-level implementation details or supporting concepts.

Output the ordered list of abstraction indices, including the name in a comment for clarity:

\`\`\`yaml
- 2 # FoundationalConcept
- 0 # CoreClassA
- 1 # CoreClassB (uses CoreClassA)
\`\`\`

Now, provide the YAML output:`;
  },

  writeChapter(params: {
    projectName: string;
    chapterNum: number;
    abstractionName: string;
    abstractionDescription: string;
    fullChapterListing: string;
    previousChaptersSummary: string;
    fileContext: string;
    prevChapter?: { num: number; name: string; filename: string };
    nextChapter?: { num: number; name: string; filename: string };
  }): string {
    const {
      projectName, chapterNum, abstractionName, abstractionDescription,
      fullChapterListing, previousChaptersSummary, fileContext,
      prevChapter, nextChapter,
    } = params;

    return `Write a very beginner-friendly tutorial chapter (in Markdown format) for the project \`${projectName}\` about the concept: "${abstractionName}". This is Chapter ${chapterNum}.

Concept Details:
- Name: ${abstractionName}
- Description:
${abstractionDescription}

Complete Tutorial Structure:
${fullChapterListing}

Context from previous chapters:
${previousChaptersSummary || "This is the first chapter."}

Relevant Code Snippets:
${fileContext}

Instructions for the chapter:
- Start with heading \`# Chapter ${chapterNum}: ${abstractionName}\`
${prevChapter ? `- Begin with a brief transition from the previous chapter [${prevChapter.name}](${prevChapter.filename}) using a markdown link` : ""}
- Start the main content with high-level motivation and a concrete use case
- Break complex abstractions into key concepts, explain one by one
- Code blocks MUST be BELOW 10 lines — break longer code into smaller pieces with explanations between them
- Describe internal implementation with a mermaid \`sequenceDiagram\` (max 5 participants)
- ALWAYS use proper Markdown links for other chapters: [Title](filename)
- Use mermaid diagrams for complex concepts (flowcharts, sequence diagrams)
- Heavily use analogies and examples to explain technical concepts
${nextChapter ? `- End with a conclusion and transition to the next chapter [${nextChapter.name}](${nextChapter.filename}) using a markdown link` : "- End with a conclusion summarizing what was covered"}
- Tone: welcoming, easy for newcomers, like explaining to a friend`;
  },

  // ─── Learning Path Pipeline Prompts ─────────────────────────────────

  extractRoleConcepts(
    role: RoleProfile,
    skillLevel: string,
    techStack: string[],
    tutorialAbstractions?: TutorialAbstraction[],
    tutorialRelationships?: TutorialRelationships,
    codeExamples?: string
  ): string {
    const roleDesc = role.custom || `${role.displayName}: ${role.preset ? "focusing on their area of expertise" : "general understanding"}`;

    const integratedContext = tutorialAbstractions
      ? `TUTORIAL ABSTRACTIONS (core concepts already identified from this codebase):
${tutorialAbstractions.map((a, i) => `${i}. ${a.name}: ${a.description}`).join("\n")}

RELATIONSHIPS BETWEEN ABSTRACTIONS:
${tutorialRelationships?.details.map((r) => `- ${tutorialAbstractions[r.from]?.name} → ${tutorialAbstractions[r.to]?.name}: ${r.label}`).join("\n") ?? "None available"}

PROJECT SUMMARY:
${tutorialRelationships?.summary ?? "Not available"}`
      : `CODE FROM THE PROJECT (for context):
${codeExamples ?? "Not available"}`;

    return `You are an expert developer onboarding specialist. Your job is to identify exactly what concepts someone in a specific ROLE needs to learn about a codebase.

ROLE: ${roleDesc}
SKILL LEVEL: ${skillLevel}
TECH STACK: ${techStack.join(", ")}

${integratedContext}

Based on this role and codebase, identify 10-20 concepts this person needs to understand. For each concept:

1. "id": A kebab-case unique identifier (e.g., "react-hooks", "api-routes")
2. "name": A clear display name (e.g., "React Hooks", "API Route Handlers")
3. "category": One of: "language", "framework", "pattern", "tooling", "architecture", "library"
4. "relevanceScore": 0.0 to 1.0 — how important this concept is for THIS ROLE specifically. A frontend dev gets high scores for UI concepts, low for database internals.
5. "moduleGroup": A grouping label (e.g., "React Fundamentals", "State Management", "API Layer"). Group related concepts together.
6. "fileReferences": Array of file paths from the codebase where this concept appears (use paths from the context above).

IMPORTANT:
- Prioritize concepts that matter for the specified ROLE, not just all technologies in the stack
- A Product Manager gets architecture/data flow concepts, not implementation details
- A Frontend Developer gets component/state/styling concepts, not server infrastructure
- Order by relevance score (highest first)
- Each concept should be specific enough to learn in 15-60 minutes, not a whole topic area

Return as JSON: { "concepts": [...] }`;
  },

  buildDependencyGraph(
    concepts: { id: string; name: string; category: string }[],
    skillLevel: string,
    analysisContext?: string
  ): string {
    const conceptList = concepts
      .map((c, i) => `${i}. [${c.id}] ${c.name} (${c.category})`)
      .join("\n");

    return `You are an expert curriculum designer building a skill dependency graph.

SKILL LEVEL: ${skillLevel}
${analysisContext ? `PROJECT CONTEXT:\n${analysisContext}\n` : ""}
CONCEPTS TO MAP:
${conceptList}

For each concept, determine:

1. "prerequisites": Array of concept IDs that must be understood BEFORE this concept. Use the exact "id" strings from the list above. A concept with no prerequisites is a starting point.
2. "difficulty": 1 to 5 rating (1=trivial, 5=very complex) relative to the student's skill level (${skillLevel}).
3. "estimatedMinutes": How long a ${skillLevel}-level student would need to understand this concept (15-120 minutes).

Also provide a GAP ANALYSIS:
- "likelyKnown": Array of concept names a ${skillLevel}-level student likely already knows (based on typical knowledge at that level)
- "focusAreas": Array of concept names that should be prioritized (new, important, or commonly misunderstood)
- "summary": A 2-3 sentence personalized message like "Based on your intermediate skill level, you likely already understand basic React components and JSX. Focus on server components and data fetching patterns which are specific to this codebase's architecture."

IMPORTANT:
- Prerequisites must form a valid DAG (no circular dependencies)
- Every concept must be reachable (no orphaned nodes unless they're a starting point)
- Difficulty should reflect the student's CURRENT level, not absolute difficulty
- A beginner finds "React Hooks" harder than an intermediate student does

Return as JSON:
{
  "graph": [
    { "id": "concept-id", "prerequisites": ["other-id"], "difficulty": 3, "estimatedMinutes": 30 },
    ...
  ],
  "gapAnalysis": {
    "likelyKnown": ["concept name", ...],
    "focusAreas": ["concept name", ...],
    "summary": "Personalized gap analysis message."
  }
}`;
  },

  generateLessonContent(
    concepts: { id: string; name: string; category: string; fileRefs: string[] }[],
    files: RepoFile[],
    skillLevel: string
  ): string {
    // Build file context from referenced files
    const referencedPaths = new Set(concepts.flatMap((c) => c.fileRefs));
    const fileContext = files
      .filter((f) => referencedPaths.has(f.path))
      .slice(0, 15)
      .map((f) => {
        const lines = f.content.split("\n");
        const truncated = lines.length > 80
          ? lines.slice(0, 80).join("\n") + `\n... (${lines.length - 80} more lines)`
          : f.content;
        return `--- ${f.path} ---\n${truncated}`;
      })
      .join("\n\n");

    const conceptList = concepts
      .map((c) => `- [${c.id}] ${c.name} (${c.category}) — referenced files: ${c.fileRefs.join(", ") || "none"}`)
      .join("\n");

    return `You are an expert developer educator creating lesson content. You are NOT writing full tutorials — you are creating concise, insightful explanations that help someone understand concepts enough to know what they need to learn more about.

SKILL LEVEL: ${skillLevel}

CONCEPTS TO EXPLAIN:
${conceptList}

RELEVANT CODE FROM THEIR PROJECT:
${fileContext}

For EACH concept, generate:

1. "id": The concept ID (must match exactly)
2. "explanation": 100-200 words explaining what this concept is and why it matters. Include a simple analogy. Write at the ${skillLevel} level — don't over-explain basics for advanced students, don't use jargon for beginners.
3. "inYourCodebase": 2-3 sentences pointing to SPECIFIC files and patterns where this concept appears in THEIR project. Use actual file paths from the code context. Example: "In your project, React hooks are used extensively in \`hooks/use-processing.ts\` where \`useState\` manages the processing pipeline state and \`useCallback\` memoizes the event handlers."
4. "keyTakeaways": Array of 2-3 bullet points — the most important things to remember about this concept.
5. "tags": Array of keyword strings for resource matching (e.g., ["react-hooks", "useState", "state-management"]). Include technology-specific and concept-specific tags.

IMPORTANT:
- Be substantive but NOT exhaustive — enough to understand, not enough to master
- Always reference THEIR code, not generic examples
- Analogies should be simple and relatable
- Key takeaways should be actionable, not obvious
- This is the "doctor's diagnosis" — thorough enough that they understand their situation, but they go to a specialist (external learning platform) for the full treatment

Return as JSON: { "lessons": [{ "id": "...", "explanation": "...", "inYourCodebase": "...", "keyTakeaways": [...], "tags": [...] }, ...] }`;
  },

  curateLearningResources(
    concepts: { id: string; name: string; tags: string[]; difficulty: number }[],
    skillLevel: string
  ): string {
    const conceptList = concepts
      .map((c) => `- [${c.id}] ${c.name} (difficulty: ${c.difficulty}/5, tags: ${c.tags.join(", ")})`)
      .join("\n");

    return `You are an expert learning resource curator for developers. Your job is to recommend the BEST external learning resources for specific programming concepts.

SKILL LEVEL: ${skillLevel}

CONCEPTS NEEDING RESOURCES:
${conceptList}

For EACH concept, recommend 3-5 resources. For each resource:

1. "platform": The platform name (e.g., "MDN Web Docs", "React Official Docs", "freeCodeCamp", "Coursera", "Udemy", "Frontend Masters", "YouTube", "Pluralsight", "Codecademy", "Egghead.io", "Kent C. Dodds Blog", "CSS-Tricks", "Smashing Magazine")
2. "title": The specific resource title (e.g., "Using the State Hook – React Docs", "JavaScript: Understanding the Weird Parts")
3. "url": The URL — ONLY use URLs you are confident exist. Prefer well-known URL patterns:
   - https://react.dev/learn/... or https://react.dev/reference/...
   - https://developer.mozilla.org/en-US/docs/Web/...
   - https://nextjs.org/docs/...
   - https://www.typescriptlang.org/docs/...
   - https://tailwindcss.com/docs/...
   - https://www.freecodecamp.org/news/...
   - https://docs.github.com/...
   If you're not sure a specific URL exists, use the platform's main docs page instead.
4. "type": One of "course", "video", "article", "interactive", "documentation"
5. "intent": One of:
   - "start_here" — Free, beginner-friendly entry point for this concept
   - "go_deeper" — Comprehensive paid content for mastery
   - "quick_reference" — Docs and cheat sheets for ongoing use
6. "priceTier": One of "free", "paid", "subscription"
   - "free" — No cost (freeCodeCamp, MDN, official docs, most YouTube)
   - "paid" — One-time purchase (Udemy courses, books)
   - "subscription" — Monthly/yearly fee (Frontend Masters, Pluralsight, Coursera Plus)
7. "difficulty": "beginner", "intermediate", or "advanced" — match to the content's actual level
8. "estimatedDuration": Human-readable (e.g., "15 min read", "2 hour course", "4 week course", "5 min video")
9. "whyThisResource": One sentence explaining why this specific resource is good for this concept. Reference the student's context.

IMPORTANT:
- Every concept MUST have at least one "start_here" (free) resource
- Mix of free and paid — don't just list all paid courses
- "quick_reference" should be official docs when available
- URLs must be from well-known platforms with predictable URL patterns
- Match resource difficulty to the student's skill level
- Resources should be specifically relevant to the concept, not general "learn to code" content
- Price transparency is a trust feature — be accurate about what's free vs paid

Return as JSON: { "resources": { "concept-id": [{ "platform": "...", ... }, ...], ... } }`;
  },
};
