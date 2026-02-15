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
