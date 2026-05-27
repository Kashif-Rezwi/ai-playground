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

## What This Covers

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

Once the app is working, run each of these deliberately. Each one is designed to surface a specific concept from this phase.

---

### Experiment 1 — Three Approaches Side by Side
**Covers:** Prompt-only, JSON mode, schema-enforced structured output — reliability comparison

**Setup:** The app supports running all three approaches via a flag. Use the same code snippet for every run.

**Steps:**
1. Run the prompt-only approach 5 times with the same snippet — record each raw response
2. Run JSON mode 5 times — log the parsed JSON and note whether it matches the expected schema
3. Run schema-enforced mode 5 times — compare consistency across runs
4. In the prompt-only runs, look for responses that include apology text, markdown fences, or trailing prose outside the JSON block

**What to observe:**
- How many prompt-only runs produce parseable JSON without any manual cleanup?
- Does JSON mode always produce valid JSON? Does it always match the expected schema shape?
- In schema-enforced mode, is the output shape identical across all 5 runs?
- Which approach fails most often and in what way?

**Expected insight:** Prompt-only is non-deterministic — the model may comply or may not, and there's no enforcement. JSON mode guarantees syntax, not schema. Schema-enforced mode is the only approach that guarantees both. This experiment makes that difference viscerally clear.

---

### Experiment 2 — Zod Validation in Action
**Covers:** Zod `.parse()` vs `.safeParse()`, schema mismatch handling, runtime validation

**Setup:** Use the schema-enforced mode. Temporarily disable schema enforcement at the API level so the model can return anything, then re-enable it after.

**Steps:**
1. With schema enforcement disabled, ask: `"Review this code: x = 1 + 1"` — observe the raw response
2. Run `zodSchema.safeParse(rawResponse)` on the result — log `result.success`, `result.error`
3. Now try `zodSchema.parse(rawResponse)` on the same bad response — observe what happens vs `safeParse`
4. Re-enable schema enforcement and run the same snippet — does `safeParse` now return `result.success: true`?

**What to observe:**
- What does `result.error` look like when the response doesn't match the schema? Is it readable?
- What happens when `.parse()` fails vs when `.safeParse()` fails? Which one crashes the process?
- Does the schema-enforced API response pass `.safeParse()` on the first try, every time?

**Expected insight:** `.parse()` throws on failure — it's fatal in a production pipeline. `.safeParse()` returns a typed result object you can check before accessing `.data`. Always use `.safeParse()` in production and handle the failure branch explicitly.

---

### Experiment 3 — Retry With Correction
**Covers:** Validation failure recovery, retry-with-correction pattern, max retry cap

**Setup:** Force a validation failure by temporarily making the Zod schema stricter than what the model returns (e.g., add a required field the model doesn't know about). Watch the retry log.

**Steps:**
1. Add a required `authorEmail` field to the Zod schema but do not mention it in the prompt
2. Run the app — it will fail Zod validation on the first attempt
3. Watch the `[RETRY 1/2]` log line — inspect the message sent back to the model with the Zod error appended
4. After the second retry, check whether the model could produce the missing field or whether it exhausted all retries
5. Remove the artificial field, re-run, and confirm clean validation on the first try

**What to observe:**
- What does the correction message sent to the model look like? Is the Zod error message human-readable enough for the model to understand?
- Does the model successfully correct the output on retry 1, or does it take 2?
- What happens when all retries are exhausted — does the app fail loudly or silently?

**Expected insight:** The retry-with-correction pattern works because Zod error messages are structured and descriptive — the model can understand what went wrong and fix it. But retries are not free: each one adds latency and cost. The pattern is a safety net, not a crutch. Fix the schema and prompt first.

---

### Experiment 4 — Schema Complexity Limits
**Covers:** Provider schema support, nested objects, `$ref` patterns, schema constraints

**Setup:** Progressively deepen the schema. Start with the default schema, then add complexity in steps.

**Steps:**
1. Run the default schema — confirm it works end to end
2. Add a deeply nested object: `issues[].context.file.path` (3 levels of nesting) — run the app, observe whether the provider accepts the schema
3. Add a `$ref` self-reference (recursive schema) to the issues array — run and observe
4. Remove the recursive ref, add an `anyOf` with two possible object shapes on the `metrics` field — observe

**What to observe:**
- At what nesting depth does the provider start returning an error or silently ignoring schema constraints?
- Does the provider reject the recursive `$ref` at the API level, or does it fail silently?
- What error message is returned when a schema feature is unsupported?

**Expected insight:** Providers implement JSON Schema support selectively. Recursive schemas and certain `anyOf` patterns are the most commonly unsupported features. When a schema fails, flatten it — use an `enum` or `string` instead of a recursive type. Know your provider's limits before designing complex schemas.

---

### Experiment 5 — Buffered vs Streaming for Structured Output
**Covers:** Structured output and streaming tension, partial JSON parsing, buffer-then-parse pattern

**Setup:** The app runs in buffered mode by default. For this experiment, temporarily enable streaming and attempt to parse each chunk as it arrives.

**Steps:**
1. Enable streaming mode — attempt `JSON.parse(chunk.delta)` inside the `for await...of` loop
2. Log the error thrown on each partial-JSON parse attempt
3. Now collect all deltas into a single `fullResponse` string and parse only at the end — confirm it succeeds
4. Compare latency: does buffering for the full response feel noticeably slower than seeing streamed tokens?

**What to observe:**
- How many chunks does the response arrive in? What does a mid-stream chunk look like as raw JSON?
- At what point in the stream does the output become valid parseable JSON?
- Is the added latency from waiting for the full response noticeable for a structured payload of this size?

**Expected insight:** Partial JSON is unparseable by design — a half-received object is syntactically invalid. For structured output, streaming tokens to screen and then parsing at the end is the correct hybrid pattern. For background pipelines where no UX is needed, buffered mode is simpler and more reliable.

---

### Experiment 6 — Approach Performance & Token Usage
**Covers:** Token usage comparison across approaches, latency measurement, logging

**Setup:** Watch the approach, retry count, token usage, and latency logs on every run. Use the same code snippet across all three approaches.

**Steps:**
1. Run the same snippet through prompt-only, JSON mode, and schema-enforced — record `input_tokens`, `output_tokens`, and total latency for each
2. Run schema-enforced mode 5 times — average the latency. Compare to JSON mode averaged over 5 runs
3. Force 1 retry in schema-enforced mode — observe the latency spike from the second API call

**What to observe:**
- Does schema-enforced mode show higher latency than JSON mode due to constrained decoding?
- How much does a single retry add to total latency (one extra round-trip to the API)?
- Do the output token counts differ across approaches for the same code input?

**Expected insight:** Schema-enforced mode adds a small constant overhead from constrained decoding, but this is typically 50–150ms — negligible compared to the cost of a retry. One retry doubles the total latency. This is why a well-designed schema and prompt that avoids validation failures is worth the upfront investment.

---

## Key Takeaways

- Prompt-only, JSON mode, and schema-enforced are not interchangeable — only schema-enforced guarantees both valid JSON syntax *and* the correct shape. The difference is stark when run side by side (Experiment 1)
- JSON mode is a syntax guarantee, not a schema guarantee — `{ "foo": "bar" }` is valid JSON mode output even when `{ "name": "...", "issues": [...] }` was expected. Always validate with Zod regardless of which approach is used (Common Mistake 1)
- `.safeParse()` is the only acceptable pattern in production — `.parse()` throws and can crash the process. Always check `result.success` before accessing `result.data` (Experiment 2)
- The retry-with-correction pattern works, but retries are expensive — each one adds a full round-trip. Fix the schema and prompt first; treat retries as a last-resort safety net, not a primary strategy (Experiment 3)
- Providers implement JSON Schema selectively — recursive schemas, certain `anyOf` patterns, and deep `$ref` nesting are commonly unsupported. Design schemas flat and test provider limits before shipping (Experiment 4)
- Streaming and structured output are fundamentally incompatible — partial JSON is unparseable. Buffer the full stream first, then parse once at the end. Streaming structured output is an optimization, not a starting point (Experiment 5)
- Schema-enforced mode adds a small constant latency overhead from constrained decoding — this is negligible compared to the latency of a single retry. A well-designed schema that avoids retries is always faster in aggregate (Experiment 6)
- Structured output is the silent foundation of every agentic system — tool calls, ReAct loops, and multi-agent delegation all depend on it. Mastering it here makes every phase from 2 onwards significantly easier to debug

---

## Phase 1 Complete 🎉

What covered: all four Core LLM Primitives (Foundation for Phase 2)

| Phase | Concept | What You Built |
|---|---|---|
| 1.1 | Basic Text Generation | Raw API call, parameters, context window intuition |
| 1.2 | Conversation & Memory | Message history, token budgeting, context management |
| 1.3 | Streaming | SSE, chunk accumulation, TTFT, error handling |
| 1.4 | Structured Output | JSON Schema, Zod validation, retry patterns |

Everything from Phase 2 onwards — tool calling, RAG, agents, memory systems — builds directly on these four primitives.

---

## Next Up

**Phase 2.1 — Single Tool Calling**  
Give the model the ability to call external functions. Understand the tool definition schema, the request → tool call → result → response loop, and how the model decides when to use a tool vs answer directly.

---

*AI Playground · Built to learn, not to ship.*