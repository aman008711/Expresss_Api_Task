import { z } from "zod";

export const CATEGORIES = ["billing", "bug", "feature", "other"];
export const URGENCIES = ["low", "normal", "high"];

// Input schema validation (reject bad requests before touching the LLM)
export const InputSchema = z.object({
  text: z.string({
    required_error: "Field 'text' is required",
    invalid_type_error: "Field 'text' must be a string",
  })
  .min(1, "Field 'text' must not be empty")
  .max(2000, "Field 'text' must not exceed 2000 characters"),
});

// Output schema validation (strict contract for LLM outputs)
export const TriageOutputSchema = z.object({
  category: z.enum(CATEGORIES, {
    errorMap: () => ({ message: "Field 'category' must be one of: billing, bug, feature, other" }),
  }),
  urgency: z.enum(URGENCIES, {
    errorMap: () => ({ message: "Field 'urgency' must be one of: low, normal, high" }),
  }),
  confidence: z.number({
    required_error: "Field 'confidence' is required",
    invalid_type_error: "Field 'confidence' must be a number between 0.0 and 1.0",
  }).min(0, "Field 'confidence' must be >= 0.0").max(1, "Field 'confidence' must be <= 1.0"),
  reason: z.string({
    required_error: "Field 'reason' is required",
    invalid_type_error: "Field 'reason' must be a string",
  }).min(1, "Field 'reason' must not be empty"),
}).strict();

// Deterministic stub response satisfying the schema
export const STUB_RESPONSE = {
  category: "bug",
  urgency: "normal",
  confidence: 0.95,
  reason: "Stub response: reported issue matches application defect.",
};
