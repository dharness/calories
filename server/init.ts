import { config as loadEnv } from "dotenv";

import { initializeLLMClient } from "./llmClient";
import { initializeUSDAClient } from "./usdaClient";
import "./utils/agentStatusUIManager";

loadEnv();

export function initializeClients(): void {
  const usdaKey = process.env.USDA_API_KEY;
  if (!usdaKey) {
    throw new Error("Missing required environment variable: USDA_API_KEY");
  }

  const llmProvider = process.env.LLM_PROVIDER || "gemini";

  try {
    initializeUSDAClient(usdaKey);
  } catch (error) {
    if (error instanceof Error && error.message.includes("already been initialized")) {
      // Already initialized, skip
    } else {
      throw error;
    }
  }

  try {
    if (llmProvider === "claude") {
      const anthropicKey = process.env.ANTHROPIC_API_KEY;
      if (!anthropicKey) {
        throw new Error("Missing required environment variable: ANTHROPIC_API_KEY");
      }
      initializeLLMClient({
        apiKey: anthropicKey,
        provider: "claude",
        modelName: process.env.CLAUDE_MODEL_NAME || "claude-sonnet-4-5",
      });
    } else {
      const geminiKey = process.env.GEMINI_API_KEY;
      if (!geminiKey) {
        throw new Error("Missing required environment variable: GEMINI_API_KEY");
      }
      initializeLLMClient({
        apiKey: geminiKey,
        provider: "gemini",
        modelName: "gemini-3-flash-preview",
      });
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes("already been initialized")) {
      // Already initialized, skip
    } else {
      throw error;
    }
  }
}
