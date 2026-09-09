import OpenAI from "openai";

const isStub = process.env.LLM_STUB === "1" || !process.env.LLM_API_KEY || process.env.LLM_API_KEY === "YOUR_KEY";

if (isStub) {
  console.log("ready (running in stub mode: provide valid LLM_API_KEY in .env for live OpenRouter API calls)");
} else {
  const client = new OpenAI({
    baseURL: process.env.LLM_BASE_URL || "https://openrouter.ai/api/v1",
    apiKey: process.env.LLM_API_KEY,
  });

  try {
    const res = await client.chat.completions.create({
      model: process.env.LLM_MODEL || "openrouter/free",
      messages: [{ role: "user", content: "Reply with exactly the word: ready" }],
    });
    console.log(res.choices[0].message.content);
  } catch (err) {
    console.error("Error from LLM provider:", err.message);
    process.exit(1);
  }
}
