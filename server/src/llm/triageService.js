import { getLLMClient } from "./client.js";
import { getSystemPrompt, PROMPT_VERSION } from "./prompt.js";
import { STUB_RESPONSE } from "./schema.js";

/**
 * Stage 2 baseline service: Loads prompt, sends user message as separate role, calls model.
 */
export async function triageMessage(text) {
  // Check stub mode
  if (process.env.LLM_STUB === "1") {
    return STUB_RESPONSE;
  }

  const client = getLLMClient();
  const systemPrompt = getSystemPrompt();
  const model = process.env.LLM_MODEL || "openrouter/free";

  // Untrusted input sent strictly as user message, JSON-encoded against prompt injection
  const userContent = JSON.stringify({ text });

  const response = await client.chat.completions.create({
    model,
    temperature: 0.1,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userContent },
    ],
  });

  const rawContent = response.choices[0]?.message?.content || "";
  return rawContent;
}
