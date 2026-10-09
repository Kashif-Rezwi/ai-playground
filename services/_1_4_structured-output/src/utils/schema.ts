import { z } from "zod";

// Each individual issue
const IssueSchema = z.object({
    severity: z.enum(["critical", "warning", "suggestion"]),
    line: z.number().nullable(),
    title: z.string(),
    description: z.string(),
});

// Sub-metrics
const MetricsSchema = z.object({
    readability: z.number().min(0).max(10),
    maintainability: z.number().min(0).max(10),
    testability: z.number().min(0).max(10),
});

// Top-level review result
export const CodeReviewSchema = z.object({
    language: z.string(),
    summary: z.string(),
    overallScore: z.number().min(0).max(100),
    recommendation: z.enum(["approve", "request_changes", "needs_major_work"]),
    issues: z.array(IssueSchema),
    strengths: z.array(z.string()),
    metrics: MetricsSchema,
});

// Auto-infer the TypeScript type from the schema
export type CodeReview = z.infer<typeof CodeReviewSchema>;

// Convert the Zod schema to a JSON Schema object for use with the API's response_format: 
// json_schema enforcement knob. The $schema property is removed because 
// the API doesn't need it, and it can cause validation errors if present.
const converted = z.toJSONSchema(CodeReviewSchema) as { $schema?: string } & Record<string, unknown>;
delete converted.$schema;
export const CodeReviewJSONSchema: Record<string, unknown> = converted;

