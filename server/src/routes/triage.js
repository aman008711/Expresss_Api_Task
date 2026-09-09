import { Router } from "express";
import { InputSchema } from "../llm/schema.js";
import { triageMessage, SchemaValidationError } from "../llm/triageService.js";

const router = Router();

router.post("/", async (req, res, next) => {
  try {
    // 1. Validate the input with Zod before anything else happens
    const parseResult = InputSchema.safeParse(req.body);
    if (!parseResult.success) {
      const firstIssue = parseResult.error.issues[0];
      const fieldName = firstIssue.path.join(".") || "text";
      return res.status(400).json({
        error: "Bad Request",
        field: fieldName,
        message: firstIssue.message,
      });
    }

    // 2. Triage message through LLM pipeline (parse, validate, repair once, quarantine)
    const result = await triageMessage(parseResult.data.text);
    return res.status(200).json(result.data);
  } catch (err) {
    if (err instanceof SchemaValidationError) {
      return res.status(422).json({
        error: "Unprocessable Entity",
        message: err.message,
        details: err.details,
      });
    }
    return next(err);
  }
});

export default router;
