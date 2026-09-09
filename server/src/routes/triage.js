import { Router } from "express";
import { InputSchema } from "../llm/schema.js";
import { triageMessage } from "../llm/triageService.js";

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

    // 2. Call triage service
    const result = await triageMessage(parseResult.data.text);
    return res.status(200).json(result);
  } catch (err) {
    return next(err);
  }
});

export default router;
