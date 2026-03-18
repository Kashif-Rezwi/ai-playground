# Phase 1.1 — Basic Text Generation

> **AI Playground Series** · Phase 1 · Core LLM Primitives

---

## What Is This?

This is the foundational mini-app of the AI Playground series. Before building agents, RAG pipelines, or multi-step workflows — you need to deeply understand what happens when you send a single prompt to an LLM and get a response back.

This app strips everything down to the bare metal:
- No frameworks wrapping the AI call
- No abstraction layers
- Just you, the model, and the API

By the end of this, you will understand exactly what a prompt *is*, what the model actually receives, and how the key generation parameters shape the output you get back.

---

## Concept Deep Dive

### What Is Text Generation?

At its core, an LLM is a **next-token predictor**. Given a sequence of tokens (chunks of text), it predicts the most probable next token — and repeats this process until it decides to stop. Text generation is just this loop, run hundreds or thousands of times to produce a coherent response.

When you call an LLM API, you are not sending a "question". You are sending a **structured prompt** — a carefully formatted sequence of messages — and the model continues that sequence.

---

### The Prompt Structure

Every API call is built from **roles**. Each message in the conversation belongs to one of three roles:

| Role | Purpose |
|---|---|
| `system` | Sets the model's behavior, persona, and constraints. Sent once, at the top. |
| `user` | The human's input — a question, instruction, or message. |
| `assistant` | The model's previous responses (used in multi-turn conversations). |

In a single-turn call, you typically send:
1. A `system` message defining how the model should behave
2. A `user` message with the actual input

The model then generates the `assistant` response.

**Why does the system prompt matter?**
The model treats the system prompt as high-priority context. It shapes tone, format, and constraints for everything that follows. A well-written system prompt is the difference between a generic response and a precise, useful one.

---

### Key Generation Parameters

These parameters sit *outside* the prompt but profoundly affect what the model outputs. Understanding them is non-negotiable.

#### `temperature`
Controls **randomness** in token selection.

- Range: `0.0` to `2.0` (varies by provider)
- `0.0` → near-deterministic. The model almost always picks the highest-probability token. Best for factual, structured output.
- `1.0` → balanced. The model picks from a wider range of probable tokens. Natural, varied responses.
- `2.0` → highly random. Creative but often incoherent.

> **Mental model:** Temperature is like a volume knob on the model's confidence. Turn it down and it gets very precise. Turn it up and it starts taking creative risks.

#### `top_p` (Nucleus Sampling)
Controls **which tokens are even considered** during selection.

- The model sorts all tokens by probability and only considers the top group whose cumulative probability reaches `p`.
- `top_p: 0.1` → only the top 10% most likely tokens are considered (very focused)
- `top_p: 1.0` → all tokens are on the table (full distribution)

> **Mental model:** While `temperature` reshapes the probability distribution, `top_p` cuts off the tail entirely. They work together but you rarely need to tune both at once — pick one to experiment with.

#### `max_tokens`
Sets a hard cap on **how long the response can be**.

- The model will stop generating once it hits this limit, even mid-sentence.
- Does not guarantee the model *will* generate that many tokens — it may stop earlier if it naturally finishes.
- Setting this too low truncates responses. Setting it too high wastes cost on padding.

> **Rule of thumb:** Estimate the typical response length for your use case and set `max_tokens` at ~1.5x that. Always handle truncated responses gracefully in your app.

#### `stop` sequences
A list of strings that will cause the model to **immediately stop generating** when encountered.

- Useful for structured output where you know the response ends at a specific marker (e.g., `["END", "\n\n"]`)
- The stop sequence itself is not included in the output

---

### What Is a Context Window?

Every model has a **context window** — a maximum number of tokens it can process in a single call. This includes:
- Your system prompt
- All user and assistant messages in the conversation history
- The response it generates

If the total exceeds the context window, the API will throw an error (or silently truncate, depending on provider).

**Why does this matter for text generation?**
Even for a simple single-turn app, understanding context limits helps you:
- Write lean, efficient system prompts
- Avoid hitting limits as you test with long inputs
- Build intuition you'll need when working on RAG and multi-turn systems

> **Token ≠ Word.** A token is roughly 3–4 characters of English text. "tokenization" = ~3 tokens. 1,000 words ≈ ~1,300 tokens. Always think in tokens, not words.

---

## What This App Builds

A minimal Node.js/TypeScript CLI or simple server that:

1. Accepts a **user prompt** as input
2. Sends it to an LLM with a configurable **system prompt**
3. Logs the **full request payload** so you can see exactly what was sent
4. Displays the **raw response** from the API
5. Lets you toggle **temperature**, **top_p**, and **max_tokens** via environment variables or CLI flags so you can observe how they change the output

No UI. No database. No streaming (that's Phase 1.3). Just a raw, transparent API call you can inspect end-to-end.

---

## What You'll Learn

By completing this mini-app, you will:

- [x] Understand the role-based message structure (`system`, `user`, `assistant`)
- [x] Know what a context window is and how to reason about token budgets
- [x] See the direct impact of `temperature` on output variation
- [x] Understand the difference between `temperature` and `top_p`
- [x] Know how `max_tokens` affects response length and truncation
- [x] Be able to read and interpret a raw LLM API response object
- [x] Understand what the model actually receives vs what you typed

---

## Experiments to Run

Once the app is working, try these deliberately:

| Experiment | What to observe |
|---|---|
| Set `temperature: 0` and run the same prompt 5 times | How deterministic is the output? |
| Set `temperature: 1.5` and run the same prompt 5 times | How much does variance increase? |
| Write a vague system prompt vs a specific one | How much does specificity matter? |
| Set `max_tokens: 10` on a long-answer question | What does truncation look like? |
| Remove the system prompt entirely | How does the model behave without it? |
| Log the full token count of your request | Build intuition for token budgets |

---

## Key Takeaways

- The model doesn't "understand" your question — it continues a token sequence based on everything you send it
- The system prompt is not magic — it's just tokens with a privileged position
- Temperature and top_p are probabilistic controls, not switches — small changes compound across hundreds of tokens
- `max_tokens` is a ceiling, not a target
- Every token costs money and latency — building intuition for token budgets now pays off massively later

---

## Next Up

**Phase 1.2 — Conversation & Memory**
Add message history to your app. Send multiple turns. Watch the model reference earlier messages. Then fill up the context window and figure out how to handle it.

---

*AI Playground · Built to learn, not to ship.*