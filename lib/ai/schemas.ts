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
          required: ["id", "type", "difficulty", "title", "prompt", "originalCode", "modifiedCode", "expectedAnswer", "hints", "relatedFile", "options", "correctOptionIndex", "explanation"],
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
