# `POST /generate` — API Guide

> **AI Playground Series** · Phase 1 · Core LLM Primitives

Single-turn LLM endpoint on top of [Groq](https://console.groq.com): one prompt in, the **raw provider
response** out, nothing reshaped. This is the contract; for what the parameters *mean* — and experiments
that prove it — see [`basic-text-generation.md`](./basic-text-generation.md).

`POST http://localhost:3001/generate` · `Content-Type: application/json` · no auth on this route (the Groq
key stays server-side) · not streamed.

---

## Run It

```bash
# from the repo root — LLM_API_KEY must be in the root .env
npm run dev:text-gen     # or: npm run dev → select "text-generation"
```

The service exits at boot if `LLM_API_KEY` is missing and listens on `PORT` (default `3001`). Health check:
`GET /` → `{"status":"ok","message":"Text Generation Service is running!"}`.

---

## Request

Model: `openai/gpt-oss-20b` — 131,072-token context, up to 65,536 output tokens.

| Field | Type | Default | Notes |
|---|---|---|---|
| `prompt` | `string` | — | Sent as the `user` message. Omitting it returns **500**. |
| `systemPrompt` | `string` | — | Sent as the `system` message. Omitting it returns **500**; sending `""` works. |
| `maxTokens` | `number` | `500` | Groq's `max_tokens` — caps **reasoning and answer together**. |
| `temperature` | `number` | `0.7` | Forwarded as-is. |
| `topP` | `number` | `1.0` | Groq's `top_p`. |

> **Defaults are applied with `||`** (`maxTokens || 500`, `temperature || 0.7`, `topP || 1.0`), so a `0` is
> silently replaced by the default — for near-deterministic output send `temperature: 0.01`, never `0`.
> Nothing is validated either: out-of-range values reach Groq and come back as a generic **500**.

---

## Examples

The payload behind the response below:

```bash
curl -X POST http://localhost:3001/generate \
  -H "Content-Type: application/json" \
  -d '{
    "systemPrompt": "You are a deeply introspective philosopher; answer every question through existential wisdom, keeping responses under 100 characters total.",
    "prompt": "What is the nature and deeper philosophical meaning behind everything?",
    "maxTokens": 2048,
    "temperature": 0.7,
    "topP": 1.0
  }'
```

Cutting it short — `finish_reason` becomes `"length"` and `content` comes back empty:

```bash
curl -X POST http://localhost:3001/generate \
  -H "Content-Type: application/json" \
  -d '{"systemPrompt": "You are a concise assistant.", "prompt": "List and explain ten common software design patterns in detail.", "maxTokens": 40}'
```

---

## Response

`200` with one top-level key, `rawResponse`, holding the untouched Groq `chat.completion` object:

```json
{
  "rawResponse": {
    "id": "chatcmpl-9911498b-7f8f-47a0-a502-45f1c4f1e227",
    "object": "chat.completion",
    "created": 1790268605,
    "model": "openai/gpt-oss-20b",
    "choices": [
      {
        "index": 0,
        "message": {
          "role": "assistant",
          "content": "Existence mirrors itself— we reflect, question, and become the unknown.",
          "reasoning": "We need to respond with existential wisdom, keep under 100 characters. The user asks: \"What is the nature and deeper philosophical meaning behind everything?\" ... [abridged — the full field was 603 reasoning tokens]"
        },
        "logprobs": null,
        "finish_reason": "stop"
      }
    ],
    "usage": {
      "queue_time": 0.346214996,
      "prompt_tokens": 108,
      "prompt_time": 0.034002982,
      "completion_tokens": 627,
      "completion_time": 0.838148555,
      "total_tokens": 735,
      "total_time": 0.872151537,
      "completion_tokens_details": {
        "reasoning_tokens": 603
      }
    },
    "usage_breakdown": null,
    "system_fingerprint": "fp_66f3850a1a",
    "x_groq": {
      "id": "req_01m3a560a3ekatkadc8vqqv5sh",
      "seed": 140398991
    },
    "service_tier": "on_demand"
  }
}
```

### Reading It

- `choices[0].message.content` — the answer to show a user. An empty string means the budget ran out, not
  that the model had nothing to say.
- `choices[0].message.reasoning` — the chain of thought, returned by default for `gpt-oss` models. It is not
  the answer, and it is usually the bulk of the output: here **603 of 627 completion tokens** produced a
  71-character reply.
- `choices[0].finish_reason` — `"stop"` finished cleanly, `"length"` was cut off by `maxTokens`. Always check
  it: with the default `maxTokens: 500`, this same prompt returns `finish_reason: "length"` and an empty
  `content`, because reasoning consumed the whole budget.
- `usage.completion_tokens_details.reasoning_tokens` — how much of the output was thinking. The `*_time`
  fields are Groq extensions in seconds; `x_groq.id` is the request ID to quote when debugging.

---

## Errors

| Case | Status | Body |
|---|---|---|
| Malformed JSON body | `400` | Express HTML error page — never reaches the handler |
| `prompt` or `systemPrompt` omitted | `500` | `{"error":"Error generating text"}` |
| Out-of-range parameter (e.g. `temperature: 5`) | `500` | same |
| Bad key, rate limit, or Groq outage | `500` | same |

The first three rows were reproduced live; the last is how Groq's documented `401`/`429`/`5xx` responses
surface through the same handler. Every provider failure collapses into that one 500, and the real message
only reaches the server console — debug from the terminal running the service.

---

## Good to Know

- `0` is unsettable for `maxTokens`, `temperature`, and `topP` (the `||` defaults).
- No validation, timeout, retry, or rate limiting on the Groq call.
- The model is hardcoded in `src/server.ts`.
- Single-turn and stateless — no history (Phase 1.2), no streaming (Phase 1.3).

See also: [`basic-text-generation.md`](./basic-text-generation.md) · [`docs/roadmap.md`](../../../docs/roadmap.md)

---

*Verified 24 Sep 2026 against `openai/gpt-oss-20b` via Groq.*

*AI Playground · Built to learn, not to ship.*
