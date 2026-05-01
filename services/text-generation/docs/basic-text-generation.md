# Phase 1.1 — Basic Text Generation

> **AI Playground Series** · Phase 1 · Core LLM Primitives

---

## What Is This?

This is the core mini-app in the AI Playground series. Before diving into agents, RAG pipelines, or multi-step workflows, it focuses on helping deeply understand what actually happens when a user sends a single prompt to an LLM and receives a response.

This app strips everything down to the bare metal:
- No frameworks wrapping the AI call
- No abstraction layers
- Just me, the model, and the API

By the end of this, there will be a clear understanding of what a prompt *is*, what the model actually receives, and how key generation parameters shape the resulting output.

---

## Concept Deep Dive

### What Is Text Generation?

At its core, an LLM is a **next-token predictor**. Given a sequence of tokens (chunks of text), it predicts the most probable next token — and repeats this process until it decides to stop. Text generation is just this loop, run hundreds or thousands of times to produce a coherent response.

When an LLM API is called, it is not a “question” being sent. Instead, it is a **structured prompt**—a carefully formatted sequence of messages—which the model then continues.

---

### The Prompt Structure

Every API call is built from **roles**. Each message in the conversation belongs to one of three roles:

| Role | Purpose |
|---|---|
| `system` | Sets the model's behavior, persona, and constraints. Sent once, at the top. |
| `user` | The human's input — a question, instruction, or message. |
| `assistant` | The model's previous responses (used in multi-turn conversations). |

In a single-turn call, it typically send:
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

> **Mental model:** While `temperature` reshapes the probability distribution, `top_p` cuts off the tail entirely.

#### `max_tokens`
Sets a hard cap on **how long the response can be**.

- The model will stop generating once it hits this limit, even mid-sentence.
- Does not guarantee the model *will* generate that many tokens — it may stop earlier if it naturally finishes.
- Setting this too low truncates responses. Setting it too high wastes cost on padding.

> **Rule of thumb:** Estimate the typical response length for the use case and set `max_tokens` to roughly 1.5× that amount. Ensure the application gracefully handles truncated responses.

#### `stop` sequences
A list of strings that will cause the model to **immediately stop generating** when encountered.

- Useful for structured output where users know the response ends at a specific marker (e.g., `["END", "\n\n"]`)
- The stop sequence itself is not included in the output

---

### What Is a Context Window?

Every model has a **context window** — a maximum number of tokens it can process in a single call. This includes:
- System prompt
- All user and assistant messages in the conversation history
- The response it generates

If the total exceeds the context window, the API will throw an error (or silently truncate, depending on provider).

**Why does this matter for text generation?**
Even for a simple single-turn app, understanding context limits helps:
- Write lean, efficient system prompts
- Prevent hitting limits during testing by avoiding excessively long inputs.
- Build intuition when working on RAG and multi-turn systems

> **Token ≠ Word.** A token is roughly 3–4 characters of English text. "tokenization" = ~3 tokens. 1,000 words ≈ ~1,300 tokens. Always think in tokens, not words.

---

## What This App Builds

A minimal Node.js/TypeScript CLI or simple server that:

1. Accepts a **user prompt** as input
2. Sends it to an LLM with a configurable **system prompt**
3. Logs the **full request payload** so the users can see exactly what was sent
4. Displays the **raw response** from the API
5. Let the users toggle **temperature**, **top_p**, and **max_tokens** via environment variables or CLI flags so the users can observe how they change the output

No UI. No database. No streaming (that's Phase 1.3). Just a raw, transparent API call users can inspect end-to-end.

---

## What This Covers

By completing this mini-app, it will help with:

- [x] Understanding the role-based message structure (`system`, `user`, `assistant`)
- [x] Learning what a context window is and how to reason about token budgets
- [x] Observing the impact of `temperature` on output variation
- [x] Understanding the difference between `temperature` and `top_p`
- [x] Learning how `max_tokens` affects response length and truncation
- [x] Interpreting a raw LLM API response object
- [x] Understanding what the model actually receives vs what users typed

---

## Experiments to Run

Once the app is working, run each of these deliberately. Each one is designed to surface a specific concept from this phase.

---

### Experiment 1 — Temperature & Determinism
**Covers:** `temperature` parameter, token prediction, output variance

**Setup:** Use a fixed prompt: `"Describe the feeling of rain in one sentence."`

**Steps:**
1. Set `temperature: 0` — run the prompt 5 times and record each response verbatim
2. Set `temperature: 1.0` — run the same prompt 5 times and record each response verbatim
3. Set `temperature: 1.5` — run the same prompt 5 times and record each response verbatim

**What to observe:**
- At `0`, are the outputs identical or near-identical? Does punctuation or word order shift?
- At `1.0`, how much natural variation appears?
- At `1.5`, does coherence degrade or does it stay readable?

**Expected insight:** Temperature doesn't flip a switch — it reshapes the probability distribution across every token. Even at `0`, some models show minor variance due to floating-point non-determinism.

---

### Experiment 2 — `top_p` vs `temperature`
**Covers:** `top_p` (nucleus sampling), how it differs from `temperature`

**Setup:** Use a creative prompt like `"Write the opening line of a noir detective story."` Hold `temperature: 1.0` constant.

**Steps:**
1. Run with `top_p: 0.1` — log the output
2. Run with `top_p: 0.5` — log the output
3. Run with `top_p: 1.0` — log the output
4. Now flip it: hold `top_p: 1.0` and vary `temperature` from `0.2` to `1.5`

**What to observe:**
- Low `top_p` forces the model into a narrow vocabulary. Does it feel repetitive?
- Does varying `temperature` produce a qualitatively different kind of variation than varying `top_p`?

**Expected insight:** `top_p` limits *which* tokens are on the table. `temperature` reshapes *how likely* those tokens are to be chosen. They're complementary controls, not interchangeable.

---

### Experiment 3 — System Prompt Specificity
**Covers:** Role-based message structure, system prompt impact

**Setup:** Use the same user message: `"Explain recursion."`

**Steps:**
1. Run with no system prompt at all — log the output
2. Run with a vague system prompt: `"You are a helpful assistant."`
3. Run with a specific system prompt: `"You are a computer science tutor explaining concepts to a 16-year-old with no prior programming experience. Use one analogy and keep the explanation under 100 words."`

**What to observe:**
- How dramatically does the tone, length, and depth shift between versions?
- Does removing the system prompt entirely produce a noticeably different default behavior?
- Does the specific system prompt actually constrain the output to the defined format?

**Expected insight:** The system prompt is just tokens with a privileged position — but that position matters. Precision in the system prompt directly translates to precision in output.

---

### Experiment 4 — `max_tokens` and Truncation
**Covers:** `max_tokens` parameter, truncation behavior

**Setup:** Ask a question that naturally requires a long answer: `"List and explain 10 common software design patterns."`

**Steps:**
1. Run with `max_tokens: 20` — observe where the cut happens
2. Run with `max_tokens: 100` — does it cut mid-thought or mid-sentence?
3. Run with `max_tokens: 2000` — does the model naturally stop before the limit?

**What to observe:**
- Does truncation happen mid-word, mid-sentence, or mid-list?
- How does the raw API response signal that the output was cut? (check `stop_reason` in the response object)
- Does the model ever *not* use all of `max_tokens`?

**Expected insight:** `max_tokens` is a ceiling, not a target. The model will stop when it's done or when it hits the cap — whichever comes first. Always check `stop_reason` to know which happened.

---

### Experiment 5 — Inspecting the Raw API Response
**Covers:** Reading and interpreting the raw LLM response object

**Setup:** Any prompt. The focus is on the *response structure*, not the content.

**Steps:**
1. Log the full raw response object from the API (don't just extract `content`)
2. Identify: `id`, `model`, `usage.input_tokens` / `usage.prompt_tokens`, `usage.output_tokens` / `usage.completion_tokens`, `stop_reason`
3. Run three prompts of different lengths and compare `usage.input_tokens` / `usage.prompt_tokens`

**What to observe:**
- How does `input_tokens` / `prompt_tokens` change as the system prompt grows?
- What is the `stop_reason` value when the model finishes naturally vs when `max_tokens` is hit?
- Does the model's `id` in the response match what was requested?

**Expected insight:** The response object is a contract. `stop_reason`, token counts, and model ID are production-critical fields — not just debug noise.

---

### Experiment 6 — Token Budget Intuition
**Covers:** Context windows, token ≠ word, token budgets

**Setup:** Log `usage.input_tokens` / `usage.prompt_tokens` on every request throughout the other experiments.

**Steps:**
1. Write a system prompt (exactly 50 words): `"You are a helpful assistant. You answer questions clearly and concisely. You do not use jargon. You always explain technical terms when you use them. You format your responses in plain text. You do not use bullet points unless asked. You keep answers under 100 words."` — send any short user message and record `input_tokens` / `prompt_tokens` 
2. Double the system prompt length by appending: `"You ask a clarifying question if the user's request is ambiguous. You cite your reasoning when giving advice. You never make assumptions about the user's background. You prefer simple words over complex ones. You always end with a one-sentence summary of your answer."` — record `input_tokens` again. Does it exactly double?
3. Send a plain English prompt: `"Explain what a function is in programming."` — record `input_tokens` / `prompt_tokens` 
4. Send a prompt of similar word count but containing a code block:
   ```
   "Here is a Python function:
   def add(a, b):
       return a + b
   What does this do?"
   ```
   Compare `input_tokens` / `prompt_tokens`  — does code tokenize the same as prose?

**What to observe:**
- What's the tokens-per-word ratio for plain English vs code vs JSON?
- How much of the context budget is consumed by just the system prompt?
- How quickly does token usage grow as prompt size increases?

**Expected insight:** Code and structured data tokenize differently than prose. Building token intuition now, prevents silent truncation bugs in every future phase.

---

## Key Takeaways

- The model doesn't "understand" the question — it continues a token sequence based on everything sent to it (Experiment 1)
- Even with `temperature: 0`, outputs may still vary slightly due to small floating-point computation differences that can influence token selection when probabilities are very close. (Experiment 1)
* `temperature` and `top_p` work together, not as substitutes — one controls how random the choices feel, while the other limits the selection to the most likely options (Experiment 2)
- The system prompt is not magic — it's just tokens with a privileged position, and precision in it directly shapes output (Experiment 3)
- `max_tokens` is a ceiling, not a target — always check `stop_reason` to know if the model finished or was cut off (Experiment 4)
- The raw API response is a contract — `stop_reason`, token counts, and model ID are production-critical fields, not debug noise (Experiment 5)
- Code and structured data tokenize differently than prose — token count ≠ word count, and building this intuition helps avoid hidden truncation, lost context, and incomplete responses later (Experiment 6)

---

## Next Up

**Phase 1.2 — Conversation & Memory**
Add message history to the app. Send multiple turns. Watch the model reference earlier messages. Then fill up the context window and figure out how to handle it.

---

*AI Playground · Built to learn, not to ship.*