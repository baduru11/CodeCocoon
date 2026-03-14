import type { RepoFile } from "@/types/github";
import type { TutorialAbstraction, TutorialRelationships } from "@/types/tutorial";

const MAX_LINES_PER_FILE = 150;
const MAX_TOTAL_CHARS = 80_000;

const SKILL_LEVEL_DESCRIPTIONS: Record<string, string> = {
  beginner:
    "ZERO or minimal coding experience. May have used AI tools to generate code but does NOT understand how it works. Needs programming fundamentals explained alongside the tech stack. Assume no prior knowledge of variables, functions, loops, or any language.",
  intermediate:
    "Has 1-2 years of coding experience. Understands basic syntax, control flow, functions, and simple data structures in at least one language. Comfortable reading code but may be unfamiliar with the specific frameworks and patterns in this project.",
  advanced:
    "Experienced developer with 3+ years of professional work. Understands design patterns, async/concurrency, testing, and architecture. Familiar with most concepts but wants to learn the specific patterns and decisions in this codebase.",
};

function getSkillLevelContext(skillLevel: string): string {
  const desc = SKILL_LEVEL_DESCRIPTIONS[skillLevel] || SKILL_LEVEL_DESCRIPTIONS.beginner;
  return `SKILL LEVEL: ${skillLevel}\nSKILL LEVEL CONTEXT: ${desc}`;
}

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
  analyzeTechStack(files: RepoFile[], ragContext?: string): string {
    const ragSection = ragContext
      ? `\n\nADDITIONAL CODE CONTEXT:\n${ragContext}`
      : "";
    return `You are a senior software engineer analyzing a codebase. Identify ALL technologies used.

CODEBASE (imports and declarations):
${formatFilesStructureOnly(files)}${ragSection}

Analyze every file carefully. For each category:
- languages: Programming languages used (e.g., "TypeScript", "Python")
- frameworks: Frameworks and libraries (e.g., "Next.js", "React", "Express")
- databases: Any database or ORM (e.g., "PostgreSQL", "Prisma", "MongoDB")
- tools: Build tools, testing, CI/CD (e.g., "Webpack", "Jest", "Docker")
- styling: CSS frameworks/methods (e.g., "Tailwind CSS", "CSS Modules", "styled-components")

Be specific. Don't guess — only include what's evident from the code.`;
  },

  analyzeArchitecture(files: RepoFile[], ragContext?: string): string {
    const codeContext = ragContext || formatFilesTruncated(files, 80);
    return `You are a senior software architect analyzing a codebase's architecture.

CODEBASE (structure and key sections):
${codeContext}

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
- 2-4 high-quality resources. For URLs, use ONLY:
  * Official docs you're confident about (e.g., https://react.dev/learn, https://developer.mozilla.org/en-US/docs/...)
  * Search URLs for anything else (e.g., https://www.youtube.com/results?search_query=TOPIC+HERE, https://www.google.com/search?q=TOPIC+site:freecodecamp.org)
  * NEVER guess or invent a specific page URL. Use search URLs when unsure.

IMPORTANT:
- Adapt complexity to their skill level
- Start with fundamentals if beginner, skip basics if advanced
- Always connect lessons back to their actual code
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
- 2-4 high-quality resources. For URLs, use ONLY:
  * Official docs you're confident about (e.g., https://react.dev/learn, https://developer.mozilla.org/en-US/docs/...)
  * Search URLs for anything else (e.g., https://www.youtube.com/results?search_query=TOPIC+HERE, https://www.google.com/search?q=TOPIC+site:freecodecamp.org)
  * NEVER guess or invent a specific page URL. Use search URLs when unsure.

IMPORTANT:
- Use the analysis context to personalize lessons — reference their architecture pattern, tech choices, and code quality insights
- Adapt complexity to their skill level
- Start with fundamentals if beginner, skip basics if advanced
- Always connect lessons back to their actual code and project structure
- Each module should build on the previous one
- Prioritize lessons that address code quality issues found in the analysis`;
  },

  generateExercises(
    files: RepoFile[],
    skillLevel: string,
    exerciseTypes: string[],
    ragContext?: string
  ): string {
    const codeContext = ragContext || formatFilesTruncated(files.slice(0, 8));
    return `You are a coding instructor creating interactive exercises from a student's OWN codebase.

SKILL LEVEL: ${skillLevel}
CODEBASE:
${codeContext}

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

IMPORTANT: Each exercise should relate to one of the learning path concepts listed above.
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

  identifyAbstractions(files: RepoFile[], projectName: string, maxAbstractions = 10, ragContext?: string): string {
    const { context, listing } = formatFilesWithIndices(files);
    const codeContext = ragContext || context;
    return `For the project \`${projectName}\`:

Codebase Context:
${codeContext}

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
- MERMAID SYNTAX RULES: Never use special characters like parentheses, brackets, or quotes inside node labels without wrapping the label in quotes. Use simple alphanumeric node IDs (e.g., A, B, C). Avoid semicolons inside labels. Keep labels short (under 40 chars). For sequenceDiagram, use simple participant names without spaces. Test that your diagram would parse correctly.
- Heavily use analogies and examples to explain technical concepts
${nextChapter ? `- End with a conclusion and transition to the next chapter [${nextChapter.name}](${nextChapter.filename}) using a markdown link` : "- End with a conclusion summarizing what was covered"}
- Tone: welcoming, easy for newcomers, like explaining to a friend`;
  },

  // ─── Learning Path Pipeline Prompts (V2) ──────────────────────────

  /**
   * Step 1: Role-Based Concept Extraction (fast model)
   * Extracts 10-20 concepts filtered by role relevance.
   */
  extractRoleConcepts(params: {
    roleLabel: string;
    roleDescription: string;
    skillLevel: string;
    techStack: string[];
    abstractionsSummary: string;
    codeContext: string;
  }): string {
    const { roleLabel, roleDescription, skillLevel, techStack, abstractionsSummary, codeContext } = params;
    return `You are an expert developer analyzing a codebase to identify the most important concepts for a specific role.

ROLE: ${roleLabel}
ROLE CONTEXT: ${roleDescription}
${getSkillLevelContext(skillLevel)}
TECH STACK: ${techStack.join(", ")}

CODEBASE ABSTRACTIONS (from prior analysis):
${abstractionsSummary}

CODE SAMPLES:
${codeContext}

Identify 10-20 concepts that someone in the "${roleLabel}" role needs to understand about this codebase. For each concept:

1. "name": A clear, specific name (e.g., "React Server Components", "API Route Handlers", "Supabase Auth Flow")
2. "category": One of "language", "framework", "pattern", "tooling", "architecture", "library"
3. "relevanceScore": 0.0-1.0 how relevant this is for the ${roleLabel} role (1.0 = essential, 0.3 = nice-to-know)
4. "fileReferences": Array of file paths from the codebase where this concept appears
5. "moduleGroup": A grouping label (e.g., "React Fundamentals", "Data Layer", "Auth & Security")

IMPORTANT:
- Filter by role: A "${roleLabel}" doesn't need to know everything. Prioritize what matters for their role.
- Be specific to THIS codebase, not generic tutorials
- Each concept should be learnable in 10-45 minutes
- Group related concepts into 3-6 module groups
- Aim for 12-18 concepts (minimum 10, maximum 20)

Output as JSON: { "concepts": [...] }`;
  },

  /**
   * Step 2: Dependency Graph & Gap Analysis (fast model)
   * Determines prerequisite ordering, difficulty, and skill gaps.
   */
  buildDependencyGraph(params: {
    concepts: { name: string; category: string; relevanceScore: number; moduleGroup: string }[];
    skillLevel: string;
    codebasePatterns: string;
  }): string {
    const { concepts, skillLevel, codebasePatterns } = params;
    const conceptList = concepts
      .map((c, i) => `${i}. "${c.name}" (${c.category}, relevance: ${c.relevanceScore}, group: "${c.moduleGroup}")`)
      .join("\n");

    return `You are an expert instructor designing a learning dependency graph.

${getSkillLevelContext(skillLevel)}
CODEBASE PATTERNS: ${codebasePatterns}

CONCEPTS TO ORGANIZE:
${conceptList}

For each concept (by index), determine:

1. "prerequisites": Array of concept indices that MUST be learned first (e.g., you need JSX before Component Composition). Use empty array [] if no prerequisites.
2. "difficulty": 1-5 rating relative to the "${skillLevel}" skill level
3. "estimatedMinutes": Estimated learning time in minutes (10-45)

Also provide a gap analysis:
- "likelyKnown": Array of concept names the student probably already knows at "${skillLevel}" level. For "beginner" level this should be EMPTY or near-empty since they have no coding experience.
- "focusAreas": Array of concept names the student should prioritize
- "summary": 2-3 sentence personalized analysis (e.g., "As an intermediate developer, you likely understand basic React concepts but may be unfamiliar with Server Components and the App Router patterns used here." For beginners: "As someone new to coding, you'll need to start with the fundamentals...")

IMPORTANT:
- Prerequisites should form a valid DAG (no circular dependencies)
- A concept can have 0-3 prerequisites max
- Difficulty 1 = trivial for this level, 5 = challenging stretch
- Be realistic about what someone at "${skillLevel}" level already knows

Output as JSON:
{
  "nodes": [{ "index": 0, "prerequisites": [1, 2], "difficulty": 3, "estimatedMinutes": 20 }, ...],
  "gapAnalysis": { "likelyKnown": [...], "focusAreas": [...], "summary": "..." }
}`;
  },

  /**
   * Step 3: Lesson Content Generation (deep model)
   * Generates substantive explanations for all concepts in a single call.
   */
  generateLessonContent(params: {
    concepts: { name: string; category: string; fileReferences: string[]; moduleGroup: string }[];
    skillLevel: string;
    codeContext: string;
  }): string {
    const { concepts, skillLevel, codeContext } = params;
    const conceptList = concepts
      .map((c, i) => `${i}. "${c.name}" (${c.category}, files: [${c.fileReferences.join(", ")}], group: "${c.moduleGroup}")`)
      .join("\n");

    return `You are an expert technical writer creating substantive learning content.

${getSkillLevelContext(skillLevel)}

CONCEPTS:
${conceptList}

CODEBASE CONTEXT:
${codeContext}

For EACH concept, generate:

1. "explanation" (100-200 words): What this concept is, why it matters, and a simple analogy. Write at a level appropriate for a "${skillLevel}" developer. Be substantive — the reader should understand the concept at a surface level after reading this.

2. "inYourCodebase" (2-3 sentences): Specifically where and how this concept appears in THIS codebase. Reference actual file paths. Example: "In this project, React Server Components are used in app/page.tsx and app/dashboard/page.tsx. The layout.tsx file acts as a Server Component that wraps client-side interactive elements."

3. "keyTakeaways" (2-3 bullet points): The most important things to remember about this concept.

4. "tags" (string array): 3-5 tags for resource matching. Include the concept name, related technologies, and broader topics. Example: ["react-hooks", "useState", "state-management", "react"]

IMPORTANT:
- Be substantive but not exhaustive — you're a doctor diagnosing what they need to learn, not teaching the full course
- Reference actual files and patterns from the codebase context
- Use analogies to make complex concepts accessible
- Each explanation should stand alone — don't reference other concepts' explanations
- Write all content in a single response

Output as JSON: { "lessons": [{ "conceptIndex": 0, "explanation": "...", "inYourCodebase": "...", "keyTakeaways": ["...", "..."], "tags": ["...", "..."] }, ...] }`;
  },

  /**
   * Step 4: Resource Curation (fast model)
   * Recommends 3-5 learning resources per concept from well-known platforms.
   */
  curateResources(params: {
    concepts: { name: string; tags: string[]; difficulty: number }[];
    skillLevel: string;
  }): string {
    const { concepts, skillLevel } = params;
    const conceptList = concepts
      .map((c, i) => `${i}. "${c.name}" (difficulty: ${c.difficulty}/5, tags: [${c.tags.join(", ")}])`)
      .join("\n");

    return `You are a learning resource curator recommending the best external resources for each concept.

${getSkillLevelContext(skillLevel)}

CONCEPTS:
${conceptList}

For EACH concept, recommend 3-5 resources. Each resource needs:

1. "platform": The platform name (e.g., "MDN", "React Docs", "freeCodeCamp", "Coursera", "YouTube")
2. "title": A descriptive title for the resource
3. "url": A URL that DEFINITELY works (see URL RULES below)
4. "type": One of "course", "video", "article", "interactive", "documentation"
5. "intent": One of:
   - "start_here" — Free, beginner-friendly entry point
   - "go_deeper" — Paid/longer content for mastery
   - "quick_reference" — Docs and cheat sheets for ongoing reference
6. "priceTier": "free", "paid", or "subscription"
7. "difficulty": "beginner", "intermediate", or "advanced"
8. "estimatedDuration": Human-readable (e.g., "15 min read", "2 hours", "4 weeks")
9. "whyThisResource": One sentence explaining why this resource is good for this concept in context

CRITICAL URL RULES — URLs MUST be real and working. Use ONLY these strategies:

STRATEGY A — Official documentation (stable paths you're confident about):
  * https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/...
  * https://developer.mozilla.org/en-US/docs/Web/CSS/...
  * https://developer.mozilla.org/en-US/docs/Web/HTML/Element/...
  * https://react.dev/learn or https://react.dev/reference/react/...
  * https://nextjs.org/docs/app/...
  * https://www.typescriptlang.org/docs/handbook/...
  * https://tailwindcss.com/docs/...
  * https://javascript.info/...
  * https://nodejs.org/docs/latest/api/...
  ONLY use these if you are certain the specific path exists. When in doubt, use the section landing page (e.g., https://react.dev/learn instead of guessing a sub-page).

STRATEGY B — Search URLs (for YouTube, Udemy, Coursera, Google, and any platform where you're NOT certain of the exact page):
  * YouTube: https://www.youtube.com/results?search_query=TOPIC+HERE (URL-encode spaces as +)
  * Google: https://www.google.com/search?q=TOPIC+HERE+site:DOMAIN
  * Udemy: https://www.udemy.com/courses/search/?q=TOPIC+HERE
  * Coursera: https://www.coursera.org/search?query=TOPIC+HERE
  * freeCodeCamp: https://www.google.com/search?q=TOPIC+HERE+site:freecodecamp.org
  * Frontend Masters: https://frontendmasters.com/courses/#q=TOPIC
  * Codecademy: https://www.codecademy.com/search?query=TOPIC+HERE
  * Egghead: https://egghead.io/q/TOPIC+HERE

  For STRATEGY B, set the title to describe what the user should search for, e.g., "Search: React Hooks tutorial for beginners".

NEVER guess or invent a specific page URL. If unsure, ALWAYS use Strategy B (search URL).

REQUIRED RESOURCE MIX per concept (provide BOTH docs AND learning platforms):
- 1 official documentation link (Strategy A) as "quick_reference" — e.g., MDN, React Docs, TypeScript Handbook, etc.
- 1 free learning resource (Strategy B) as "start_here" — e.g., YouTube search, freeCodeCamp search, Codecademy search
- 1 paid/deeper learning resource (Strategy B) as "go_deeper" — e.g., Udemy search, Coursera search, Frontend Masters search
- You MUST include at least 1 official doc AND at least 1 learning platform (YouTube/Udemy/Coursera/freeCodeCamp) per concept

Output as JSON: { "resources": [{ "conceptIndex": 0, "recommendations": [{ "platform": "...", "title": "...", "url": "...", "type": "...", "intent": "...", "priceTier": "...", "difficulty": "...", "estimatedDuration": "...", "whyThisResource": "..." }, ...] }, ...] }`;
  },
};
