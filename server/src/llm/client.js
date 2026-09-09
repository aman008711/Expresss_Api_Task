import OpenAI from "openai";

export function getLLMClient() {
  const baseURL = process.env.LLM_BASE_URL || "https://openrouter.ai/api/v1";
  const apiKey = process.env.LLM_API_KEY || "ollama";
  const timeout = parseInt(process.env.LLM_TIMEOUT_MS || "30000", 10);

  return new OpenAI({
    baseURL,
    apiKey,
    timeout,
    maxRetries: 0, // Explicitly controlled by our custom retry policy
  });
}
