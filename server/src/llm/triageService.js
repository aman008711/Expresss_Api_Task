import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { getLLMClient } from "./client.js";
import { getSystemPrompt, PROMPT_VERSION } from "./prompt.js";
import { TriageOutputSchema, STUB_RESPONSE } from "./schema.js";
import { callWithRetry } from "./retryPolicy.js";
import { logCost } from "./costLogger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const logsDir = path.resolve(__dirname, "../../logs");
const quarantineLogPath = path.resolve(logsDir, "quarantine.jsonl");

if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

export const KILL_SWITCH_FALLBACK = {
  category: "other",
  urgency: "normal",
  confidence: 0.0,
  reason: "Service temporarily routed to deterministic fallback via kill switch (LLM_ENABLED=false).",
};

export class SchemaValidationError extends Error {
  constructor(message, details, rawOutput) {
    super(message);
    this.name = "SchemaValidationError";
    this.status = 422;
    this.details = details;
    this.rawOutput = rawOutput;
  }
}

export class GatewayTimeoutError extends Error {
  constructor(message = "LLM provider request timed out") {
    super(message);
    this.name = "GatewayTimeoutError";
    this.status = 504;
  }
}

export class ProviderAuthError extends Error {
  constructor(message = "Authentication failed with LLM provider") {
    super(message);
    this.name = "ProviderAuthError";
    this.status = 401;
  }
}

export function extractAndParseJson(rawText) {
  if (!rawText || typeof rawText !== "string") {
    return { success: false, error: "Empty or non-string response from model", raw: rawText };
  }

  let clean = rawText.trim();
  if (clean.startsWith("```")) {
    clean = clean.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  }

  try {
    const parsed = JSON.parse(clean);
    return { success: true, data: parsed, raw: rawText };
  } catch (initialErr) {
    const firstBrace = rawText.indexOf("{");
    const lastBrace = rawText.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      const candidate = rawText.substring(firstBrace, lastBrace + 1);
      try {
        const parsed = JSON.parse(candidate);
        return { success: true, data: parsed, raw: rawText };
      } catch (braceErr) {
        return { success: false, error: `JSON parse error: ${braceErr.message}`, raw: rawText };
      }
    }
    return { success: false, error: `JSON parse error: ${initialErr.message}`, raw: rawText };
  }
}

export function validateOutput(data) {
  const result = TriageOutputSchema.safeParse(data);
  if (result.success) {
    return { valid: true, data: result.data };
  }
  const issues = result.error.issues.map((i) => `${i.path.join(".") || "root"}: ${i.message}`).join("; ");
  return { valid: false, error: issues };
}

export function logQuarantine({ input, error, rawOutput, promptVersion }) {
  const entry = {
    timestamp: new Date().toISOString(),
    promptVersion,
    input,
    error,
    rawOutput,
  };
  fs.appendFileSync(quarantineLogPath, JSON.stringify(entry) + "\n", "utf-8");
}

/**
 * Triage pipeline:
 * 1. Check kill switch (LLM_ENABLED=false)
 * 2. Check stub mode (LLM_STUB=1)
 * 3. Invoke LLM with explicit timeout and retry policy
 * 4. Parse JSON and validate against Zod schema
 * 5. Single repair retry if attempt 1 fails
 * 6. Quarantine log and 422 if attempt 2 fails
 * 7. Token and cost structured logging
 */
export async function triageMessage(text) {
  // 1. Kill Switch Check
  if (process.env.LLM_ENABLED === "false" || process.env.LLM_ENABLED === "0") {
    console.log("[KILL SWITCH] LLM_ENABLED is false; returning deterministic fallback immediately.");
    return { data: KILL_SWITCH_FALLBACK, isFallback: true, repairCount: 0 };
  }

  // 2. Stub mode
  if (process.env.LLM_STUB === "1") {
    return { data: STUB_RESPONSE, isStub: true, repairCount: 0 };
  }

  const client = getLLMClient();
  const systemPrompt = getSystemPrompt();
  const model = process.env.LLM_MODEL || "openrouter/free";
  const userContent = JSON.stringify({ text });

  const startTime = Date.now();
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let neededRepair = false;

  async function executeCompletion(messages) {
    try {
      return await callWithRetry(() =>
        client.chat.completions.create({
          model,
          temperature: 0.1,
          messages,
        })
      );
    } catch (err) {
      if (err.status === 401) {
        throw new ProviderAuthError(`Invalid API key or unauthorized access to model '${model}' (HTTP 401).`);
      }
      if (
        err.name === "APIConnectionTimeoutError" ||
        err.code === "ETIMEDOUT" ||
        err.status === 504 ||
        (err.message && err.message.toLowerCase().includes("timeout"))
      ) {
        throw new GatewayTimeoutError(`LLM provider call timed out after ${process.env.LLM_TIMEOUT_MS || 30000}ms.`);
      }
      throw err;
    }
  }

  // --- ATTEMPT 1 ---
  const messages1 = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userContent },
  ];

  const response1 = await executeCompletion(messages1);
  const raw1 = response1.choices[0]?.message?.content || "";
  totalInputTokens += response1.usage?.prompt_tokens || 0;
  totalOutputTokens += response1.usage?.completion_tokens || 0;

  const parseResult1 = extractAndParseJson(raw1);

  if (parseResult1.success) {
    const valResult1 = validateOutput(parseResult1.data);
    if (valResult1.valid) {
      const durationMs = Date.now() - startTime;
      logCost({
        promptVersion: PROMPT_VERSION,
        model,
        inputTokens: totalInputTokens,
        outputTokens: totalOutputTokens,
        durationMs,
        neededRepair: false,
      });
      return { data: valResult1.data, repairCount: 0 };
    }
  }

  // --- REPAIR RETRY (Attempt 2) ---
  neededRepair = true;
  const firstError = !parseResult1.success
    ? parseResult1.error
    : validateOutput(parseResult1.data).error;

  const repairMessages = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userContent },
    { role: "assistant", content: raw1 },
    {
      role: "user",
      content: `Your previous answer was rejected for this reason: "${firstError}". Return only corrected JSON matching the schema.`,
    },
  ];

  const response2 = await executeCompletion(repairMessages);
  const raw2 = response2.choices[0]?.message?.content || "";
  totalInputTokens += response2.usage?.prompt_tokens || 0;
  totalOutputTokens += response2.usage?.completion_tokens || 0;

  const durationMs = Date.now() - startTime;
  logCost({
    promptVersion: PROMPT_VERSION,
    model,
    inputTokens: totalInputTokens,
    outputTokens: totalOutputTokens,
    durationMs,
    neededRepair: true,
  });

  const parseResult2 = extractAndParseJson(raw2);
  if (parseResult2.success) {
    const valResult2 = validateOutput(parseResult2.data);
    if (valResult2.valid) {
      return { data: valResult2.data, repairCount: 1 };
    }
  }

  // --- PERSISTENT FAILURE: QUARANTINE & 422 ---
  const finalError = !parseResult2.success
    ? parseResult2.error
    : validateOutput(parseResult2.data).error;

  logQuarantine({
    input: text,
    error: finalError,
    rawOutput: raw2,
    promptVersion: PROMPT_VERSION,
  });

  throw new SchemaValidationError(
    "Model output failed schema validation after repair attempt",
    finalError,
    raw2
  );
}
