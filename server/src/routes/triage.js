import { Router } from "express";
import { InputSchema, STUB_RESPONSE } from "../llm/schema.js";

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

    // 2. Stub mode: skip model completely when LLM_STUB=1
    if (process.env.LLM_STUB === "1") {
      return res.status(200).json(STUB_RESPONSE);
    }

    // Pass validated data forward (Stage 2+ will wire LLM completion)
    req.validatedInput = parseResult.data;
    return next();
  } catch (err) {
    return next(err);
  }
});

export default router;
