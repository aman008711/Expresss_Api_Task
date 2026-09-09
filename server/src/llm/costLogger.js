import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const logsDir = path.resolve(__dirname, "../../logs");
const costLogPath = path.resolve(logsDir, "cost.log");

if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

export function logCost({ promptVersion, model, inputTokens, outputTokens, durationMs, neededRepair }) {
  const totalTokens = (inputTokens || 0) + (outputTokens || 0);

  const entry = {
    timestamp: new Date().toISOString(),
    prompt_version: promptVersion,
    model,
    input_tokens: inputTokens ?? 0,
    output_tokens: outputTokens ?? 0,
    total_tokens: totalTokens,
    duration_ms: durationMs,
    needed_repair: Boolean(neededRepair),
  };

  const line = JSON.stringify(entry);

  // 1. Output structured log to stdout (Twelve-Factor App best practice)
  console.log(`[COST_LOG] ${line}`);

  // 2. Append to logs/cost.log
  try {
    fs.appendFileSync(costLogPath, line + "\n", "utf-8");
  } catch (err) {
    console.error("[COST_LOG] Error appending to cost.log:", err.message);
  }

  return entry;
}
