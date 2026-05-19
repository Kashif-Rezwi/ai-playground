# Phase 1.4 — Structured Output

> **AI Playground Series** · Phase 1 · Core LLM Primitives

---

## What Is This?

In Phases 1.1–1.3 the model returned free-form text — a paragraph, a sentence, a stream of tokens. That's fine for chat. But the moment there is a need to **do something programmatic with the response** — parse it, store it in a database, pass it to another function, render it in a UI — free-form text becomes a liability.

Prose cannot be reliably parsed. Structure is required.

This phase is about forcing the model to return **valid, schema-conforming JSON every single time** — and understanding the multiple layers of how that is achieved, what can still go wrong, and why structured output is the silent foundation of every agentic system built from Phase 2 onwards.

---

## Concept Deep Dive

### The Problem With Free-Form Output

Imagine asking an LLM to extract a person's name, email, and role from a paragraph of text. Without structured output, the response might look like this:

```
"The person's name is Jane Smith. Her email is jane@example.com and she works as a Product Manager."
```

Now the response has to be parsed from a sentence. What happens if the model says **“Her name is”** instead of **“The person's name is”**? What if it adds an extra sentence? What if the wording or email formatting changes?

The parser breaks.

Free-form language is inherently inconsistent. Even if the information is correct, the formatting can vary across responses, making programmatic handling fragile, error-prone, and unpredictable at scale.

Structured output solves this by making the model return:

```json
{
  "name": "Jane Smith",
  "email": "jane@example.com",
  "role": "Product Manager"
}
```

Deterministic. Parseable. Validatable. Pipeline-safe.

---

### Three Approaches to Structured Output

There are three ways to get structured output from an LLM, each with different tradeoffs.

---

#### Approach 1 — Prompt Engineering (Naive)

The model is instructed in the system prompt to always return JSON:

```
"Always respond with valid JSON. Never include prose outside the JSON block."
```

**How it works:** The model tries to comply based on instruction following. No enforcement at the API level.

**Tradeoffs:**
- Zero setup required
- Works most of the time with capable models
- Breaks unpredictably — model adds apology text before JSON, wraps in markdown code fences, adds a trailing comment
- Not reliable enough for production pipelines

**When to use it:** Prototyping only. Never in production.

---

#### Approach 2 — JSON Mode

Most providers offer a `response_format: { type: "json_object" }` parameter. This tells the API to enforce that the output is valid JSON at the decoding level.

**How it works:** The provider constrains the token sampling to only allow tokens that produce valid JSON. Structurally invalid JSON tokens are filtered out before they can be selected.

**Tradeoffs:**
* Guarantees valid JSON syntax — no more broken braces or trailing commas
* Does **NOT** guarantee the JSON matches the intended schema — `{ "foo": "bar" }` may still be returned when `{ "name": "...", "email": "..." }` was expected
* Mentioning **"JSON"** in the prompt is required, or some providers may throw an error
* Validation of the structure is still required after parsing

**When to use it:** Suitable when valid JSON is needed but a flexible schema is acceptable (e.g., open-ended extraction tasks).

---

#### Approach 3 — Structured Output with Schema (Best)

The most robust approach. A **JSON Schema** (or a Zod schema converted into JSON Schema) is passed directly to the API alongside the prompt. The provider uses constrained decoding to guarantee the output matches the schema exactly.

**How it works:** The provider builds a grammar from the schema and constrains token sampling to allow only outputs that conform to it. Invalid field names, incorrect types, or missing required fields are prevented during generation itself — not detected afterward through validation.

**Tradeoffs:**
- Guarantees both valid JSON *and* correct schema shape
- Some schema features are not supported (recursive schemas, certain `anyOf` patterns)
- Slightly higher latency due to constrained decoding
- Not all providers support it equally — check the provider's docs

**When to use it:** Always, in production. This is the gold standard.

---

### JSON Schema — What Needs to Be Known

JSON Schema is the standard format for describing the shape of a JSON object. Understanding it is essential because every structured output implementation — Zod, provider APIs, validation libraries — ultimately compiles down to JSON Schema.

Key concepts:

**`type`** — the data type of a field (`string`, `number`, `boolean`, `array`, `object`, `null`)

**`properties`** — defines the fields of an object and their types

**`required`** — array of field names that must be present

**`enum`** — restricts a field to a specific set of allowed values

**`array` with `items`** — defines the shape of items in an array

**`$defs` / `$ref`** — allows reusable schema definitions (**Caution**: not all providers support nested refs)

A simple schema example:

```json
{
  "type": "object",
  "properties": {
    "name": { "type": "string" },
    "score": { "type": "number" },
    "tags": {
      "type": "array",
      "items": { "type": "string" }
    },
    "status": {
      "type": "string",
      "enum": ["active", "inactive", "pending"]
    }
  },
  "required": ["name", "score", "status"]
}
```

---

### Zod — Schema First, JSON Schema Second

In TypeScript projects, schemas are typically defined using **Zod**, then converted into **JSON Schema** for the API call. This provides:

* **Type safety** in application code
* **Runtime validation** of the parsed response
* **A single source of truth** for the data shape

The flow is:

```
Zod Schema → JSON Schema (via zod-to-json-schema) → API call → JSON response → Zod parse → typed object
```

The Zod `.parse()` step at the end is critical — it validates that the API actually returned what is asked for, and gives a fully typed TypeScript object. Even with constrained decoding, always validate.

---

### Structured Output vs Streaming

As flagged in Phase 1.3 — structured output and streaming are fundamentally in tension.

**Why:** Partial JSON cannot be parsed. A half-received JSON object is syntactically invalid. Attempting to parse something like `{"name": "Jane", "em` results in an error.

**The solutions:**
1. **Buffer then parse (simplest):** Avoid streaming. Wait for the full response, then parse it. Suitable for background jobs, pipelines, and agent steps.

2. **Stream and parse at the end:** Stream for display purposes (showing raw text token by token), but delay parsing until `[DONE]`. Useful for streaming UX while still working with structured data.

3. **Streaming JSON parsers:** Libraries like `partial-json` can incrementally parse incomplete JSON and fill in defaults for missing fields. Useful for progressively rendering structured data in a UI, but more complex to implement correctly.

For this phase, **approach 1 (buffer then parse)** is recommended. Streaming structured output is an advanced optimization, not a foundational requirement.

---

### Validation After Parsing

Even with schema-enforced structured output, always validate after parsing. Reasons:

- The model may return `null` for a required field (some providers allow this)
- Numeric fields may return as strings in edge cases
- Nested objects may be missing properties
- The schema may have been updated, but old prompts are still running

**Validation layers:**
1. `JSON.parse()` — is it valid JSON syntax?
2. Zod `.parse()` or `.safeParse()` — does it match the schema?
3. Business logic validation — are the values sensible? (e.g., is the score between 0 and 100?)

Always use `.safeParse()` (non-throwing) in production so that validation errors can be handled gracefully without crashing.

---

### Error Handling Patterns

When structured output fails validation, there are four options:

**1 — Throw and retry**
Re-send the request with an additional message telling the model what went wrong. This works well for schema mismatches. Cap retries at 2–3.

**2 — Return a default / fallback**
If the field is non-critical, use a sensible default and log the failure for monitoring.

**3 — Ask the model to fix it**
Send the invalid output back to the model with an instruction: "The previous response was invalid. The `score` field must be a number between 0 and 100. Please fix it." Feed this as a follow-up user message.

**4 — Fail loudly**
For critical pipelines where bad data is worse than no data — throw a hard error, alert, and stop processing.

---

### Structured Output in Agentic Systems

This phase is the last of Phase 1, but it's the bridge to everything in Phase 2 onwards.

Every agentic pattern — tool calling, multi-agent coordination, supervisor/worker — relies on structured output:

- **Tool calling:** The model returns a structured `tool_call` object (tool name + arguments). If this isn't valid structured JSON, the tool can't execute.
- **Agent reasoning:** The model returns a structured `{ thought, action, action_input }` object in ReAct loops.
- **Multi-agent delegation:** A supervisor returns a structured task assignment to workers.
- **Data extraction pipelines:** Every stage produces structured output that feeds the next stage.

Mastering structured output here means all of Phase 2–9 becomes significantly easier to implement and debug.

---

## What This App Builds

### Code Review Analyzer

A standalone CLI tool that accepts a **raw code snippet** as input and returns a fully structured, schema-validated code review — no chat loop, no streaming, no conversation history. Just input in, structured data out.

This is a minimal, from-scratch version of the core concept behind the Agentic Code Reviewer — which makes it doubly valuable. You'll understand the structured output foundation that every real code review agent is built on.

---

### The Schema

Design the Zod schema to capture a meaningful code review. A good starting point:

```
CodeReviewResult
├── language          (string)         — detected programming language
├── summary           (string)         — one paragraph overview of the code
├── overallScore      (number)         — 0–100 quality score
├── recommendation    (enum)           — "approve" | "request_changes" | "needs_major_work"
├── issues[]
│   ├── severity      (enum)           — "critical" | "warning" | "suggestion"
│   ├── line          (number | null)  — line number if identifiable
│   ├── title         (string)         — short issue label
│   └── description   (string)        — explanation and fix guidance
├── strengths[]       (string[])       — what the code does well
└── metrics
    ├── readability   (number)         — 0–10
    ├── maintainability (number)       — 0–10
    └── testability   (number)        — 0–10
```

This schema is non-trivial — it has nested objects, arrays of objects, enums, and nullable fields. It will exercise every part of structured output that needs to be understood.

---

### What to Build

1. Accept a raw code snippet via **stdin or a local file path** — no hardcoded samples
2. Define the full schema above in **Zod** and convert it to JSON Schema
3. Make a single **buffered API call** (no streaming) with schema-enforced structured output
4. **Validate the response** with Zod `.safeParse()` — never assume the output is correct
5. On validation failure — implement the **retry with correction** pattern: re-send with the Zod error message appended, max 2 retries
6. On success — pretty-print the structured result to the terminal in a readable format (not raw JSON)
7. Implement all **three approaches** as separate runnable modes (flag-controlled): prompt-only, JSON mode, schema-enforced — run the same snippet through all three and compare output consistency
8. Log the **approach used**, **retry count**, **token usage**, and **total latency** on every run

No UI. No database. No conversation history. One code snippet in, one structured review out — clean and transparent.

---

## What You'll Learn

By completing this mini-app, you will:

- [ ] Understand why free-form LLM output is unreliable for programmatic use
- [ ] Know the difference between prompt-only, JSON mode, and schema-enforced structured output
- [ ] Be able to write a JSON Schema by hand and understand its key keywords
- [ ] Use Zod to define schemas and validate parsed responses
- [ ] Understand why structured output and streaming are in tension
- [ ] Implement retry-with-correction for validation failures
- [ ] Know when to use `.parse()` vs `.safeParse()`
- [ ] Understand why structured output is the foundation of agentic systems

---

## Experiments to Run

| Experiment | What to observe |
|---|---|
| Use prompt-only approach, run 10 times | How often does the format break? |
| Use JSON mode, run 10 times | Does it always produce valid JSON? Does the schema hold? |
| Use schema-enforced mode, run 10 times | How does reliability compare? |
| Pass a deliberately complex schema (deeply nested) | Does the provider handle it? Any errors? |
| Remove a required field from your prompt description | Does the model still populate it? |
| Send a response that fails Zod validation back to the model | Does the correction pattern work? |
| Try `.parse()` vs `.safeParse()` on a bad response | See how each handles failure |

---

## Common Mistakes to Avoid

**Mistake 1 — Trusting JSON mode to enforce schema shape**
JSON mode only guarantees valid JSON syntax — not that the fields match your schema. Always validate with Zod after parsing.

**Mistake 2 — Using recursive or overly complex schemas**
Not all providers support recursive schemas or deeply nested `$ref` patterns. Keep schemas flat where possible.

**Mistake 3 — Not handling `.safeParse()` failures**
Always check `result.success` before accessing `result.data`. Assume it can fail.

**Mistake 4 — Trying to stream and parse JSON simultaneously**
Buffer first, parse after `[DONE]`. Streaming JSON parsing is an optimization, not a starting point.

**Mistake 5 — Skipping business logic validation**
Schema validation tells you the shape is correct. It doesn't tell you the values make sense. Always add a layer of domain validation on top.

---

## Key Takeaways

- Free-form LLM output is not suitable for production pipelines — structured output is non-negotiable
- There are three levels of structure enforcement — prompt, JSON mode, schema. Always prefer schema.
- JSON Schema is the universal language — Zod compiles to it, APIs consume it, learn to read it
- Streaming and structured output are fundamentally incompatible — buffer first, parse after
- Always validate with Zod even when using schema-enforced mode — defense in depth
- Structured output is not a Phase 1 detail — it is the foundation of every phase that follows

---

## Phase 1 Complete 🎉

You've now covered all four Core LLM Primitives:

| Phase | Concept | What You Built |
|---|---|---|
| 1.1 | Basic Text Generation | Raw API call, parameters, context window intuition |
| 1.2 | Conversation & Memory | Message history, token budgeting, context management |
| 1.3 | Streaming | SSE, chunk accumulation, TTFT, error handling |
| 1.4 | Structured Output | JSON Schema, Zod validation, retry patterns |

Everything from Phase 2 onwards — tool calling, RAG, agents, memory systems — builds directly on these four primitives. You now have the foundation.

---

## Next Up

**Phase 2.1 — Single Tool Calling**  
Give the model the ability to call external functions. Understand the tool definition schema, the request → tool call → result → response loop, and how the model decides when to use a tool vs answer directly.

---

*AI Playground · Built to learn, not to ship.*