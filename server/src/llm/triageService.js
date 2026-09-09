import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { getLLMClient } from "./client.js";
import { getSystemPrompt, PROMPT_VERSION } from "./prompt.js";
import { TriageOutputSchema, STUB_RESPONSE } from "./schema.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const logsDir = path.resolve(__dirname, "../../logs");
const quarantineLogPath = path.resolve(logsDir, "quarantine.jsonl");

// Ensure logs directory exists
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

/**
 * Strips markdown fences and extracts a valid JSON object.
 */
export function extractAndParseJson(rawText) {
  if (!rawText || typeof rawText !== "string") {
    return { success: false, error: "Empty or non-string response from model", raw: rawText };
  }

  // 1. Try stripping markdown code fences
  let clean = rawText.trim();
  if (clean.startsWith("```")) {
    clean = clean.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  }

  try {
    const parsed = JSON.parse(clean);
    return { success: true, data: parsed, raw: rawText };
  } catch (initialErr) {
    // 2. Try locating outermost { ... }
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

/**
 * Validates parsed data against TriageOutputSchema.
 */
export function validateOutput(data) {
  const result = TriageOutputSchema.safeParse(data);
  if (result.success) {
    return { valid: true, data: result.data };
  }
  const issues = result.error.issues.map((i) => `${i.path.join(".") || "root"}: ${i.message}`).join("; ");
  return { valid: false, error: issues };
}

/**
 * Appends malformed/unfixable response to logs/quarantine.jsonl.
 */
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

export class SchemaValidationError extends Error {
  constructor(message, details, rawOutput) {
    super(message);
    this.name = "SchemaValidationError";
    this.status = 422;
    this.details = details;
    this.rawOutput = rawOutput;
  }
}

/**
 * Executes triage with:
 * - JSON parse & Zod schema validation
 * - Exactly one repair retry on parse/schema failure
 * - Quarantine logging on persistent failure (logs/quarantine.jsonl)
 * - Returns clean validated JSON or throws 422 SchemaValidationError
 */
export async function triageMessage(text) {
  // Stub mode: zero model calls, deterministic valid response
  if (process.env.LLM_STUB === "1") {
    return { data: STUB_RESPONSE, repairCount: 0 };
  }

  const client = getLLMClient();
  const systemPrompt = getSystemPrompt();
  const model = process.env.LLM_MODEL || "openrouter/free";
  const userContent = JSON.stringify({ text });

  // --- ATTEMPT 1 ---
  const messages = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userContent },
  ];

  const response1 = await client.chat.completions.create({
    model,
    temperature: 0.1,
    messages,
  });

  const raw1 = response1.choices[0]?.message?.content || "";
  const parseResult1 = extractAndParseJson(raw1);

  if (parseResult1.success) {
    const valResult1 = validateOutput(parseResult1.data);
    if (valResult1.valid) {
      return { data: valResult1.data, repairCount: 0, usage: response1.usage };
    }
  }

  // --- REPAIR RETRY (Attempt 2) ---
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

  const response2 = await client.chat.completions.create({
    model,
    temperature: 0.1,
    messages: repairMessages,
  });

  const raw2 = response2.choices[0]?.message?.content || "";
  const parseResult2 = extractAndParseJson(raw2);

  if (parseResult2.success) {
    const valResult2 = validateOutput(parseResult2.data);
    if (valResult2.valid) {
      return { data: valResult2.data, repairCount: 1, usage: response2.usage };
    }
  }

  // --- REPAIR FAILED: QUARANTINE & 422 ---
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
