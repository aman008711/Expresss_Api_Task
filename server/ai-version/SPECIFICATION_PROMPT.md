# AI Rematch Specification Prompt

Write a production-grade Node.js Express endpoint `POST /triage` that classifies customer support messages.
Requirements:
1. Input Validation: Validate that `req.body.text` is a string between 1 and 2000 characters using Zod. Return 400 Bad Request with field name on failure.
2. Output Schema: Enforce output shape with Zod:
   - `category`: one of ['billing', 'bug', 'feature', 'other']
   - `urgency`: one of ['low', 'normal', 'high']
   - `confidence`: number 0.0 - 1.0
   - `reason`: string
3. Prompt: System prompt in `prompts/triage-v1.md`. Send user message as a separate user role message.
4. Parsing & Repair: Strip markdown fences and parse JSON. If schema validation fails, perform exactly one repair retry sending the error back to the model. If it fails again, log to `logs/quarantine.jsonl` and return 422 Unprocessable Entity.
5. Timeout & Retries: Set a 30s timeout (return 504). Retry only timeouts, 429, and 5xx with exponential backoff and jitter. Never retry 400, 401, or 403.
6. Cost Logging: Structured JSON log per call recording prompt version, model, token counts, duration, and repair flag.
7. Kill Switch: If `LLM_ENABLED=false`, return a deterministic fallback immediately.
