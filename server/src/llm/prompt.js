import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const PROMPT_VERSION = "triage-v1";
const promptPath = path.resolve(__dirname, "../../prompts/triage-v1.md");

let cachedPrompt = null;

export function getSystemPrompt() {
  if (!cachedPrompt) {
    cachedPrompt = fs.readFileSync(promptPath, "utf-8");
  }
  return cachedPrompt;
}
