// File extensions to include in analysis
export const SOURCE_EXTENSIONS = new Set([
  "ts", "tsx", "js", "jsx", "mjs", "cjs",
  "py", "rb", "go", "rs", "java", "kt", "swift", "cs",
  "cpp", "c", "h", "hpp",
  "php", "vue", "svelte",
  "html", "css", "scss", "sass", "less",
  "sql", "graphql", "gql",
  "sh", "bash", "zsh",
  "yaml", "yml", "toml",
  "json", "md", "mdx",
  "dockerfile",
]);

// Config files to always include (by filename)
export const CONFIG_FILES = new Set([
  "package.json",
  "tsconfig.json",
  "next.config.ts",
  "next.config.js",
  "next.config.mjs",
  "vite.config.ts",
  "vite.config.js",
  "webpack.config.js",
  "tailwind.config.ts",
  "tailwind.config.js",
  ".eslintrc.json",
  "eslint.config.mjs",
  "Dockerfile",
  "docker-compose.yml",
  "docker-compose.yaml",
  "requirements.txt",
  "Pipfile",
  "Gemfile",
  "Cargo.toml",
  "go.mod",
  "pom.xml",
  "build.gradle",
  ".env.example",
  ".env.local.example",
  "prisma/schema.prisma",
]);

// Directories to always skip
export const IGNORED_DIRS = new Set([
  "node_modules",
  ".git",
  ".next",
  ".nuxt",
  "__pycache__",
  ".cache",
  "dist",
  "build",
  "out",
  ".vercel",
  ".turbo",
  "coverage",
  ".nyc_output",
  "vendor",
  ".bundle",
  "target",
  "bin",
  "obj",
  ".idea",
  ".vscode",
  ".DS_Store",
]);

// Binary extensions to skip
export const BINARY_EXTENSIONS = new Set([
  "png", "jpg", "jpeg", "gif", "svg", "ico", "webp", "bmp", "tiff",
  "mp3", "mp4", "avi", "mov", "webm", "wav", "ogg",
  "pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx",
  "zip", "tar", "gz", "rar", "7z",
  "woff", "woff2", "ttf", "eot", "otf",
  "exe", "dll", "so", "dylib",
  "lock",
]);

// Skill levels
export const SKILL_LEVELS = {
  beginner: { label: "Beginner", color: "bg-accent-green", emoji: "🐛" },
  intermediate: { label: "Intermediate", color: "bg-accent-yellow", emoji: "🪺" },
  advanced: { label: "Advanced", color: "bg-accent-purple", emoji: "🦋" },
} as const;

// Max files to analyze
export const MAX_FILES_TO_FETCH = 100;
export const MAX_FILE_SIZE_BYTES = 100_000; // 100KB per file
export const MAX_TOTAL_CONTENT_BYTES = 500_000; // 500KB total
export const FILE_SIZE_WARNING_BYTES = 50_000; // 50KB - files above this are highlighted

// OpenRouter model IDs
export const OPENROUTER_MODELS = {
  fast: "google/gemini-2.5-flash-lite",
  deep: "google/gemini-2.5-flash",
} as const;

// GitHub API
export const GITHUB_API_BASE = "https://api.github.com";
export const GITHUB_RATE_LIMIT_UNAUTH = 60;
export const GITHUB_RATE_LIMIT_AUTH = 5000;
export const GITHUB_BATCH_CONCURRENCY = 5;

// App
export const APP_NAME = "CodeCocoon";
export const APP_DESCRIPTION = "Your code is wrapped up. Let's unwrap it together.";

// Skill level options for configure page
export const SKILL_LEVEL_OPTIONS = [
  {
    value: "beginner" as const,
    label: "Beginner",
    emoji: "🐛",
    description: "I'm new to coding or used AI to generate my project",
  },
  {
    value: "intermediate" as const,
    label: "Intermediate",
    emoji: "🪺",
    description: "I understand basics but want to deepen my knowledge",
  },
  {
    value: "advanced" as const,
    label: "Advanced",
    emoji: "🦋",
    description: "I'm experienced and want to learn advanced patterns",
  },
];

// Exercise type configuration
export const EXERCISE_TYPES = {
  error_injection: { label: "Bug Hunt", icon: "Bug", color: "bg-primary" },
  code_recreation: { label: "Fill in Blank", icon: "PenTool", color: "bg-secondary" },
  code_explanation: { label: "Explain", icon: "MessageSquare", color: "bg-accent-purple" },
  mcq: { label: "Multiple Choice", icon: "MessageSquare", color: "bg-secondary" },
  output_prediction: { label: "Predict Output", icon: "MessageSquare", color: "bg-accent-yellow" },
  parsons: { label: "Code Order", icon: "ArrowDownUp", color: "bg-accent-green" },
  error_message: { label: "Fix the Error", icon: "AlertTriangle", color: "bg-primary" },
} as const;

// Processing steps for the processing page
export const PROCESSING_STEPS = [
  { key: "files_fetched", label: "Fetching file contents" },
  { key: "indexing", label: "Indexing codebase for retrieval" },
  { key: "tech_stack", label: "Detecting tech stack" },
  { key: "architecture", label: "Analyzing architecture" },
  { key: "key_files", label: "Identifying key files" },
  { key: "tutorial_abstractions", label: "Identifying core concepts" },
  { key: "tutorial_relationships", label: "Mapping relationships" },
  { key: "tutorial_order", label: "Planning chapter order" },
  { key: "tutorial_chapters", label: "Writing tutorial chapters" },
  { key: "learning_concepts", label: "Extracting role-based concepts" },
  { key: "learning_graph", label: "Building skill dependency graph" },
  { key: "learning_lessons", label: "Generating lesson content" },
  { key: "learning_resources", label: "Curating learning resources" },
  { key: "exercises", label: "Creating exercises" },
] as const;
