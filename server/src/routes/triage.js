import { Router } from "express";
import { InputSchema } from "../llm/schema.js";
import {
  triageMessage,
  SchemaValidationError,
  GatewayTimeoutError,
  ProviderAuthError,
} from "../llm/triageService.js";

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

    // 2. Execute triage pipeline (kill switch, client call, retry, parse, repair, quarantine, cost log)
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

    if (err instanceof GatewayTimeoutError) {
      return res.status(504).json({
        error: "Gateway Timeout",
        message: err.message,
      });
    }

    if (err instanceof ProviderAuthError) {
      return res.status(401).json({
        error: "Unauthorized",
        message: err.message,
      });
    }

    return next(err);
  }
});

export default router;
