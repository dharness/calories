import { ChatAnthropic } from "@langchain/anthropic";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { AIMessage, HumanMessage } from "@langchain/core/messages";
import { StructuredTool } from "@langchain/core/tools";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { createMiddleware, createAgent as langchainCreateAgent, providerStrategy } from "langchain";
import type { ZodSchema, z } from "zod";
import { logError } from "./utils/errorLogger";

export type AgentProgressEvent =
  | { type: "start" }
  | { type: "tool_call"; toolName: string; args: any }
  | { type: "tool_result"; toolName: string; result: any }
  | { type: "llm_response"; content: string }
  | { type: "agent_action"; action: string }
  | { type: "error"; error: string }
  | { type: "fetch_food_details"; fdcId: number }
  | { type: "end"; success: boolean }
  | { type: "retry"; attempt: number; maxRetries: number; delayMs: number };

export interface LLMClientConfig {
  apiKey: string;
  modelName?: string;
  temperature?: number;
  maxTokens?: number;
  maxRetries?: number;
  provider?: "gemini" | "claude";
}

export interface GenerateOptions {
  responseSchema?: Record<string, unknown>;
}

export interface AgentOptions {
  tools: StructuredTool[];
  systemPrompt?: string;
  onProgress?: (event: AgentProgressEvent) => void;
  responseFormat?: ZodSchema<any>;
  onRetry?: (attempt: number, maxRetries: number, delayMs: number) => void;
}

/**
 * Type helper to infer the response type from AgentOptions.
 * If responseFormat is provided, extracts the inferred type from the Zod schema.
 * Otherwise, defaults to string.
 */
type InferResponseType<T extends AgentOptions> =
  T['responseFormat'] extends z.ZodType<infer U> ? U : string;

let llmClientInstance: LLMClient | null = null;

const DEFAULT_MODEL_NAME = "gemini-3-flash-preview";
const DEFAULT_CLAUDE_MODEL_NAME = "claude-sonnet-4-5";

/**
 * Creates a chat model instance from the provided configuration.
 * This function abstracts platform-specific model creation details.
 */
function createChatModel(config: LLMClientConfig): BaseChatModel {
  const provider = config.provider || process.env.LLM_PROVIDER || "gemini";

  let model: BaseChatModel;

  if (provider === "claude") {
    const modelConfig: any = {
      model: config.modelName || DEFAULT_CLAUDE_MODEL_NAME,
      apiKey: config.apiKey,
      temperature: config.temperature ?? 0.3,
    };

    if (config.maxTokens !== undefined) {
      modelConfig.maxTokens = config.maxTokens;
    }

    model = new ChatAnthropic(modelConfig);
  } else {
    const modelConfig: any = {
      model: config.modelName || DEFAULT_MODEL_NAME,
      apiKey: config.apiKey,
      temperature: config.temperature ?? 0.3,
    };

    if (config.maxTokens !== undefined) {
      modelConfig.maxOutputTokens = config.maxTokens;
    }

    model = new ChatGoogleGenerativeAI(modelConfig);
  }

  return model;
}

/**
 * Initializes the LLM client with the provided configuration.
 * Must be called before using getLLMClient().
 */
export function initializeLLMClient(config: LLMClientConfig): void {
  if (llmClientInstance) {
    throw new Error("LLMClient has already been initialized");
  }

  llmClientInstance = new LLMClient(config);
}

/**
 * Gets the initialized LLM client instance.
 * @returns The LLM client instance
 * @throws Error if client has not been initialized
 */
export function getLLMClient(): LLMClient {
  if (!llmClientInstance) {
    throw new Error(
      "LLMClient has not been initialized. Call initializeLLMClient() first."
    );
  }
  return llmClientInstance;
}

/**
 * LLM Client for text generation, structured output, and agent-based workflows.
 */
export class LLMClient {
  private model: BaseChatModel;

  constructor(config: LLMClientConfig) {
    this.model = createChatModel(config);
  }

  /**
   * Generates a text response. Use for simple prompts without tool calling.
   * @param prompt - Input prompt
   * @param options - Optional structured output schema
   * @returns Generated text or parsed JSON if schema provided
   */
  async generate(
    prompt: string,
    options?: GenerateOptions
  ): Promise<string | any> {
    const messages = [new HumanMessage(prompt)];
    const response = await this.model.invoke(messages);
    const content = response.content;

    if (options?.responseSchema) {
      try {
        const textContent = typeof content === "string" ? content : JSON.stringify(content);
        return JSON.parse(textContent);
      } catch (error) {
        throw new Error(
          `Failed to parse JSON response: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }

    return typeof content === "string" ? content : JSON.stringify(content);
  }

  /**
   * Generates structured output using Zod schema with LangChain's withStructuredOutput.
   * This method properly enforces schema compliance using guided decoding.
   * @param prompt - Input prompt
   * @param schema - Zod schema for output structure
   * @param schemaName - Optional name for the schema (helps with model compliance)
   * @returns Parsed object matching the Zod schema
   */
  async generateWithZodSchema<T>(
    prompt: string,
    schema: ZodSchema<T>,
    schemaName?: string
  ): Promise<T> {
    const structuredModel = this.model.withStructuredOutput(schema, {
      name: schemaName || "StructuredOutput",
      includeRaw: false,
    });

    const messages = [new HumanMessage(prompt)];
    let result;
    try {
      result = await structuredModel.invoke(messages);
    } catch (error: any) {
      const errorMessage = String(error.message || "").toLowerCase();
      if (errorMessage.includes("json parse") || errorMessage.includes("unterminated")) {
        throw new Error(
          `Structured output parsing failed. Response may be truncated. Consider increasing maxOutputTokens. ${error.message}`
        );
      }
      throw error;
    }

    if (result && typeof result === "object" && "parsed" in result) {
      return result.parsed as T;
    }

    return result as T;
  }

  /**
   * Creates an agent with tools for multi-step workflows requiring tool calls.
   * @param options - Tools, system prompt, optional progress callback, and optional structured output schema
   * @returns Agent instance with inferred response type based on the schema
   */
  createAgent<T extends AgentOptions>(options: T): Agent<InferResponseType<T>> {
    const middleware = options.onProgress
      ? [createProgressMiddleware(options.onProgress)]
      : [];

    const maxRetries = 6; // Default retries
    const onRetry = options.onRetry;

    // Apply LangChain's built-in retry with error logging and optional callback
    const retryModel = this.model.withRetry({
      stopAfterAttempt: maxRetries,
      onFailedAttempt: (error) => {
        // Log error
        logError(error.error, {
          type: "langchain_retry",
          attempt: error.attemptNumber,
          maxRetries: maxRetries,
        });
        // Call the onRetry callback if provided
        if (onRetry) {
          // LangChain doesn't provide delayMs, so we estimate based on attempt number
          const estimatedDelay = Math.min(1000 * Math.pow(2, error.attemptNumber - 1), 60000);
          onRetry(error.attemptNumber, maxRetries, estimatedDelay);
        }
      },
    });

    const modelToUse = retryModel as unknown as BaseChatModel;

    const agentConfig: any = {
      model: modelToUse,
      tools: options.tools,
      systemPrompt: options.systemPrompt,
      middleware,
    };

    if (options.responseFormat) {
      agentConfig.responseFormat = providerStrategy(options.responseFormat);
    }

    const agent = langchainCreateAgent(agentConfig);

    return new AgentWrapper<InferResponseType<T>>(agent);
  }
}

function createProgressMiddleware(
  onProgress: (event: AgentProgressEvent) => void
) {
  return createMiddleware({
    name: "ProgressMiddleware",
    afterModel: (state: any, runtime: any) => {
      const lastMessage = state.messages[state.messages.length - 1];
      if (lastMessage && "tool_calls" in lastMessage && lastMessage.tool_calls?.length > 0) {
        onProgress({
          type: "agent_action",
          action: `Agent decided to call ${lastMessage.tool_calls.length} tool(s)`,
        });
      } else if (lastMessage && "content" in lastMessage && lastMessage.content) {
        const content = typeof lastMessage.content === "string"
          ? lastMessage.content
          : JSON.stringify(lastMessage.content);
        onProgress({
          type: "llm_response",
          content,
        });
      }
    },
    wrapToolCall: async (request: any, handler: any) => {
      onProgress({
        type: "tool_call",
        toolName: request.toolCall.name,
        args: request.toolCall.args,
      });

      const result = await handler(request);

      const resultContent =
        result && typeof result === "object" && "content" in result
          ? result.content
          : result;

      onProgress({
        type: "tool_result",
        toolName: request.toolCall.name,
        result: resultContent,
      });

      return result;
    },
  });
}

/**
 * Agent interface for executing multi-step workflows with tool calling.
 * @template TResponse - The type of the response. Defaults to string when no schema is provided.
 */
export interface Agent<TResponse = string> {
  /**
   * Invokes the agent with the given input.
   * @param input - Input prompt or message
   * @returns Agent response typed based on the responseFormat schema
   */
  invoke(input: string): Promise<TResponse>;

  /**
   * Gets the conversation history.
   * @returns Array of messages
   */
  getHistory(): any[];
}

class AgentWrapper<TResponse = string> implements Agent<TResponse> {
  private lastInvokeResult: any = null;

  constructor(
    private agent: ReturnType<typeof langchainCreateAgent>
  ) { }

  async invoke(input: string): Promise<TResponse> {
    const result = await this.agent.invoke({
      messages: [{ role: "user", content: input }],
    });

    this.lastInvokeResult = result;

    if (result.structuredResponse !== undefined) {
      return result.structuredResponse as TResponse;
    }

    const lastMessage = result.messages[result.messages.length - 1];
    if (lastMessage && "content" in lastMessage && lastMessage.content) {
      return (typeof lastMessage.content === "string"
        ? lastMessage.content
        : lastMessage.content) as TResponse;
    }

    return result as TResponse;
  }

  getHistory(): any[] {
    if (this.lastInvokeResult && this.lastInvokeResult.messages) {
      return this.lastInvokeResult.messages;
    }
    return [];
  }
}
