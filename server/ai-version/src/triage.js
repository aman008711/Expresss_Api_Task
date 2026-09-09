import OpenAI from "openai";
import { z } from "zod";

// Typical unguided AI generation issues:
// 1. Forgot timeout: left SDK default (10 minutes)
// 2. Used SDK default retries: retries 2 times even on 401s
// 3. Concat user text or returned fallback without quarantine
const client = new OpenAI({
  apiKey: process.env.LLM_API_KEY,
  baseURL: process.env.LLM_BASE_URL,
});

const InputSchema = z.object({
  text: z.string().min(1).max(2000),
});

export async function aiTriageHandler(req, res) {
  if (process.env.LLM_ENABLED === "false") {
    return res.json({ category: "other", urgency: "low", confidence: 0, reason: "disabled" });
  }

  const parsed = InputSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid input" });
  }

  try {
    const response = await client.chat.completions.create({
      model: process.env.LLM_MODEL || "openrouter/free",
      messages: [
        { role: "system", content: "You are a support classifier. Return JSON." },
        { role: "user", content: parsed.data.text },
      ],
    });

    const content = response.choices[0].message.content;
    const json = JSON.parse(content);
    return res.json(json);
  } catch (err) {
    // Blind retry or return raw error message
    return res.status(500).json({ error: err.message });
  }
}
