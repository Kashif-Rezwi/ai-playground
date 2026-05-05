# Phase 1.3 — Streaming

> **AI Playground Series** · Phase 1 · Core LLM Primitives

---

## What Is This?

In Phase 1.1 and 1.2, every API call followed the same pattern — a request is sent, then a wait occurs, and eventually the full response arrives all at once. This is called a **blocking** or **batch** response.

For short responses this feels fine. But for longer generations — a detailed explanation, a code review, a long analysis — the user stares at a blank screen for 3–10 seconds before anything appears. That's a terrible experience.

Streaming changes this behavior. Instead of waiting for the model to generate the entire response first, the API sends tokens as they are produced, one by one, in real time.

This phase is about understanding *how* that works under the hood, not just calling `.stream()` on an SDK method.

---

## Concept Deep Dive

### Why Streaming Exists

LLMs generate text **autoregressively** — one token at a time. Token 2 depends on token 1. Token 3 depends on tokens 1 and 2. The model cannot generate token 50 without first generating tokens 1–49.

This means the model *already has* token 1 ready long before it finishes generating the full response. Without streaming, the API holds all those tokens in a buffer and sends them only after the final token is generated. With streaming, each token is forwarded immediately as it becomes available.

The result: **perceived latency drops dramatically.** The user sees the first word in ~300ms instead of waiting 5 seconds for the full paragraph.

---

### How Streaming Works — SSE

The transport mechanism behind LLM streaming is **Server-Sent Events (SSE)**.

SSE is a web standard that allows a server to push data to a client over a single, long-lived HTTP connection. Unlike WebSockets (bidirectional), SSE is **unidirectional** — server to client only — which is exactly what streaming LLM responses need.

The flow looks like this:

```
Client → POST /completions (with stream: true)
Server → HTTP 200, Content-Type: text/event-stream
Server → data: {"token": "The"}
Server → data: {"token": " quick"}
Server → data: {"token": " brown"}
Server → data: {"token": " fox"}
...
Server → data: [DONE]
```

Each `data:` line is a **chunk** — a small piece of the response. The client reads these chunks as they arrive, appending each one to build the full response incrementally.

**Key SSE characteristics:**
- Single HTTP connection stays open until the stream ends
- Each event is a line starting with `data:`
- The stream ends with a special `[DONE]` sentinel
- If the connection drops, the client can reconnect with a `Last-Event-ID` header

---

### The Chunk Structure

Each chunk from the API is not just raw text — it's a structured object. A typical streaming chunk looks like:

```
{
  id: "chatcmpl-abc123",
  object: "chat.completion.chunk",
  choices: [{
    delta: {
      content: " quick"   ← the new token(s) in this chunk
    },
    finish_reason: null    ← null until the final chunk
  }]
}
```

The `delta` field includes only the new piece of content in that chunk, not the full response. These pieces are accumulated to rebuild the complete message.

The final chunk has `finish_reason` set to `"stop"` (or `"length"` if it hit `max_tokens`) and an empty delta.

---

### Backpressure

Backpressure is what happens when the **producer generates data faster than the consumer can process it**.

In streaming LLM responses, tokens are generated at a steady pace, and the consumer reading the stream needs to keep up. If it falls behind due to slow rendering, heavy processing, or network delays, incoming chunks begin to accumulate in a buffer.

In a simple CLI app, this usually isn’t an issue. In production systems, especially when each chunk is processed, stored, or forwarded elsewhere, backpressure becomes an important factor to handle.

**How to handle it:**
- Process chunks as lightweight as possible (accumulate text, don't parse on every chunk)
- Do heavy processing *after* the stream ends, not during
- Use async iterators (`for await...of`) which naturally respect backpressure in Node.js

---

### Streaming vs Buffering — When to Use Which

Streaming is not always the right choice. Know when each makes sense:

| Scenario | Use Streaming | Use Buffered |
|---|---|---|
| Chat UI — user is watching | ✅ Yes | ❌ No |
| Background processing job | ❌ No | ✅ Yes |
| Structured JSON output | ❌ No* | ✅ Yes |
| Long document generation | ✅ Yes | ❌ No |
| Tool calling / function call | ❌ No | ✅ Yes |
| Real-time logging / observability | ✅ Yes | ❌ No |

*Structured JSON is tricky to stream because you can't parse partial JSON. You typically buffer the full streamed response, then parse it. (This is exactly what Phase 1.4 covers.)

---

### Accumulating the Stream Correctly

A common mistake is treating each chunk as a complete unit. It's not — chunks are arbitrary splits of the token stream. A single word can sometimes arrive across two chunks.

The correct pattern is:

```
fullResponse = ""

for each chunk in stream:
    delta = chunk.choices[0].delta.content
    if delta exists:
        fullResponse += delta
        render(fullResponse)   ← re-render the accumulated string, not just the delta

on stream end:
    finalMessage = fullResponse
    append to conversation history
```

**Important:** Only append the *completed* assistant message to your conversation history after the stream finishes — not partial chunks. Your history array should always contain complete messages.

---

### Time to First Token (TTFT)

One of the key metrics in streaming systems is **Time to First Token (TTFT)** — how long from sending the request until the first chunk arrives.

TTFT is affected by:
- Model size (larger models are slower to start)
- Prompt length (longer prompts take longer to process)
- Server load
- Network latency

In a well-optimized system, TTFT should be under 500ms for most requests. Streaming makes TTFT *visible* to the user — which is why it dramatically improves perceived performance even when total generation time is the same.

---

### Error Handling in Streams

Streams can fail mid-way. The connection might drop after only a few tokens, or the model could encounter an error during generation. The application should handle these cases carefully:

* **Track completion** — verify whether the `[DONE]` sentinel was received or if the connection ended unexpectedly
* **Handle partial responses** — decide how to treat incomplete output, whether to discard it, display it with a warning, or retry
* **Set timeouts** — ensure the stream does not remain open indefinitely
* **Implement retry logic** — for temporary network issues, retry the entire request since a dropped stream cannot be resumed mid-way

---

### Streaming with Conversation History

Streaming integrates cleanly with Phase 1.2 conversation loop with one important rule:

> **Never append a partial streamed response to conversation history.**

Wait until the stream is fully complete, then append the full accumulated `assistant` message. Appending during the stream can lead to issues. If the stream fails midway, the history will contain a truncated assistant message, which can confuse the model in the next interaction.

---

## What This App Builds

Extend the Phase 1.2 conversation loop to:

1. Switch the API call to **streaming mode** (`stream: true`)
2. Read the SSE stream chunk by chunk using an async iterator
3. **Print each token to the terminal as it arrives** — character by character, no newline until done
4. Accumulate the full response string across all chunks
5. Measure and log **Time to First Token (TTFT)** and **total generation time**
6. Only append the completed response to conversation history after the stream ends
7. Handle a mid-stream connection drop gracefully — log a warning, discard the partial response
8. Support both streaming and non-streaming mode via an environment variable flag so behavior can be compared side by side.

No UI is needed. The terminal acts as the interface, where observing tokens appear one by one in the CLI demonstrates the streaming process.

---

## What This Covers

By completing this mini-app, you will:

- [ ] Understand what SSE is and how it works at the HTTP level
- [ ] Know the structure of a streaming chunk (`delta`, `finish_reason`)
- [ ] Correctly accumulate chunk deltas into a full response string
- [ ] Understand what backpressure is and why it matters
- [ ] Measure TTFT and understand what affects it
- [ ] Handle mid-stream errors and partial responses gracefully
- [ ] Integrate streaming cleanly with conversation history
- [ ] Know when streaming is the right choice vs buffered responses

---

## Experiments to Run

Once the app is working, run each of these deliberately. Each one is designed to surface a specific concept from this phase.

---

### Experiment 1 — Streaming vs Buffered — Perceived Latency
**Covers:** SSE streaming, perceived latency, TTFT vs total generation time

**Setup:** The app supports toggling between streaming and non-streaming mode via an environment variable flag.

**Steps:**
1. Set `STREAM=false` (or the equivalent env flag) — send this prompt: `"Write a detailed explanation of how TCP/IP works, covering all four layers with examples."`
2. Time how long the blank screen lasts before the response appears
3. Set `STREAM=true` — send the exact same prompt
4. Watch the `⚡ TTFT:` log line. Note when the first token arrives vs when the full response finishes

**What to observe:**
- How many seconds does the buffered version make you wait before anything appears?
- In streaming mode, does the first word appear in under 500ms even though the full response takes several seconds?
- Does the *total time* to receive the full response differ between modes?

**Expected insight:** Streaming doesn't make the model faster — total generation time is identical. It eliminates perceived latency by surfacing the first token immediately. The UX improvement is dramatic even though no actual computation is saved.

---

### Experiment 2 — Time to First Token (TTFT) — What Affects It
**Covers:** TTFT measurement, prompt length impact, model processing time

**Setup:** Watch the `⚡ TTFT: Xms` log line printed after the first chunk arrives. All tests use `STREAM=true`.

**Steps:**
1. Send a minimal prompt: `"Hi."` — record the TTFT
2. Send a medium prompt: `"Explain what a REST API is in plain English."` — record TTFT
3. Send a long, context-heavy prompt: `"You are reviewing a distributed system architecture with five microservices, a message queue, a caching layer, and a CDN. The services communicate via gRPC internally and REST externally. Describe the most common failure modes in this architecture and how you would instrument each layer for observability."` — record TTFT
4. Run each prompt 3 times and average the TTFT

**What to observe:**
- Does TTFT increase as the input prompt gets longer?
- Is the TTFT consistent across runs of the same prompt or does it vary?
- Does TTFT ever exceed 500ms? Under what conditions?

**Expected insight:** TTFT grows with prompt length because the model must process the entire input before it can produce the first output token. Longer prompts = longer prefill phase = higher TTFT. This is why lean system prompts matter for real-time applications.

---

### Experiment 3 — Inspecting the Raw Chunk Structure
**Covers:** SSE chunk structure, `delta` field, `finish_reason`, stream termination

**Setup:** Add a temporary `console.log(chunk)` inside the `for await...of` loop before extracting the delta, then run a short prompt.

**Steps:**
1. Send: `"Name three colors."` with raw chunk logging enabled
2. Scroll through the logged chunks — find the first chunk, a mid-stream chunk, and the final chunk
3. Look for:
   - `choices[0].delta.content` — what does the first chunk contain?
   - `choices[0].finish_reason` — when does this change from `null`?
   - The final chunk with empty delta and `finish_reason: "stop"` or `"length"`
4. Now send the same prompt with `max_tokens: 5` — does the final chunk show `finish_reason: "length"` instead of `"stop"`?

**What to observe:**
- Is the first chunk always a complete word or can it be a partial character/syllable?
- How many chunks does a short 3-item response produce?
- What distinguishes a natural stop (`"stop"`) from a truncated one (`"length"`)?

**Expected insight:** Chunks are not word-aligned — they can split tokens arbitrarily. The `finish_reason` field in the final chunk is the streaming equivalent of `stop_reason` from Phase 1.1. Always inspect it to know whether the response completed naturally or was cut off.

---

### Experiment 4 — Delta vs Accumulated Response
**Covers:** Correct stream accumulation, `fullResponse` vs `delta`, chunk arbitrariness

**Setup:** Temporarily modify the chunk loop to render *only* the delta instead of the accumulated `fullResponse`.

**Steps:**
1. Swap `process.stdout.write(delta)` rendering approach — for this experiment, log each delta separately with a visible separator: `process.stdout.write(`[${delta}]`)`
2. Send: `"Write a haiku about debugging code."`
3. Watch how the response fragments arrive
4. Now restore the accumulation pattern and send the same prompt — compare the output experience

**What to observe:**
- How small are individual deltas? Do any arrive as a single character or space?
- Can a single word arrive split across two chunks?
- How does the visual experience differ when rendering delta-by-delta vs appending to a growing string?

**Expected insight:** Deltas are arbitrary splits of the token stream — not words, not sentences. The correct pattern is always to accumulate into `fullResponse` and render that. The `⚡ Speed: X tokens/sec` metric is calculated over the entire stream, not per-chunk, precisely because individual deltas are meaningless units.

---

### Experiment 5 — Mid-Stream Abort & History Safety
**Covers:** Partial response handling, conversation history integrity, stream error path

**Setup:** Start a streaming response to a long-answer prompt. Uncomment the throw line in `chat.ts` at line 46 before running this experiment.

**Steps:**
1. Uncomment the throw line in `chat.ts`: `if (tokenCount === 5) throw new Error("Simulated mid-stream failure")`
2. Send: `"List and explain 20 common HTTP status codes with examples for each."`
3. Watch the terminal — partial tokens appear, then the `⚠️ Stream failed` and `Partial response discarded. History restored to last clean state.` messages log
4. Type `history` — inspect the conversation array
5. Re-comment the throw line when done
6. Send another message and confirm the conversation continues normally without an API error

**What to observe:**
- How many tokens appear before the error fires?
- After the error, does `history` show any trace of the failed turn — or is it fully restored to the state before the message was sent?
- Does the next message send correctly without breaking the conversation?

**Expected insight:** Both the partial assistant response and the dangling user message are discarded — `history` is fully restored to the last clean state, keeping the alternating structure intact for the next turn.

---

### Experiment 6 — Throughput & Tokens Per Second
**Covers:** Model throughput, `⚡ Speed:` metric, generation rate across prompt types

**Setup:** Watch the `⚡ Speed: X tokens/sec` log that appears after each stream completes. Run `STREAM=true` for all tests.

**Steps:**
1. Send a creative prose prompt: `"Write a short story about a lighthouse keeper who discovers a message in a bottle."` — record tokens/sec
2. Send a code generation prompt: `"Write a TypeScript function that deep-clones a nested object without using JSON.parse/stringify."` — record tokens/sec
3. Send a structured list prompt: `"List 15 JavaScript array methods with a one-line description of each."` — record tokens/sec
4. Run each prompt 3 times and average the tokens/sec across runs

**What to observe:**
- Is tokens/sec consistent across different prompt types or does it vary?
- Does creative prose generate faster or slower than code?
- Note: the app counts *chunks*, not actual tokens via a tokenizer. Does this measurement feel accurate or does it seem off?

**Expected insight:** The `⚡ Speed:` metric is a rough approximation — tokens/sec varies across prompt types and even across runs of the same prompt — server load and network latency are real factors. The number also feels inflated because the app counts chunks, not actual tokens (each chunk carries 1–3 tokens on average). For a true throughput figure, use the `usage` field from the final chunk instead.

---

## Common Mistakes to Avoid

**Mistake 1 — Rendering the delta instead of the accumulated string**  
Each delta is an arbitrary fragment — sometimes a single space or half a word. Always accumulate into `fullResponse` and render that. This app uses `process.stdout.write(delta)` for terminal output (which is fine for a CLI), but if building a UI, always render the accumulated string, not the raw delta.

**Mistake 2 — Appending a partial response to conversation history**  
The app only calls `conversationHistory.push({ role: "assistant", content: fullResponse })` after the `for await...of` loop completes fully. Appending during the stream — or in a catch block after a partial read — corrupts history with an incomplete assistant message, which confuses the model in the next turn.

**Mistake 3 — Not checking `finish_reason` on the final chunk**  
A stream that ends with `finish_reason: "stop"` completed naturally. One that ends with `finish_reason: "length"` was cut off by `max_tokens`. These require different handling — truncated responses may need a retry, a warning to the user, or a higher `max_tokens` setting.

**Mistake 4 — Doing heavy processing inside the chunk loop**  
The `for await...of` loop must stay lightweight. This app does only two things per chunk: append to `fullResponse` and write to stdout. Anything heavier — parsing, database writes, token counting — belongs after the stream ends. Blocking the loop creates backpressure and delays rendering.

**Mistake 5 — Measuring throughput with chunk count instead of real tokens**  
The `⚡ Speed: X tokens/sec` metric in this app counts chunks, not actual tokens. Each chunk contains 1–3 tokens on average, so the count can be off by 2–3×. For accurate throughput measurement, use the `usage` object returned in the final chunk (when the API supports it) or count tokens with `tiktoken` post-stream.

**Mistake 6 — Confusing SSE with WebSockets**  
SSE is a standard HTTP connection — unidirectional, server to client, over a single long-lived response. WebSockets are bidirectional, stateful, and require a handshake upgrade. LLM streaming uses SSE because the client never needs to send data mid-stream. Adding WebSockets here would be unnecessary complexity.

**Mistake 7 — Streaming structured JSON output**  
Streaming and structured JSON are incompatible — you cannot parse a partial JSON string. If the response needs to be a valid JSON object (for tool calls, function outputs, or schema-constrained responses), use buffered mode: stream to accumulate the full string, then parse once at the end. This is exactly what Phase 1.4 covers.

---

## Key Takeaways

- LLMs generate tokens one at a time — streaming just stops hiding this from the user. Total generation time is unchanged; only perceived latency drops (Experiment 1)
- TTFT is the metric that defines user experience, not total generation time — and it grows with input prompt length because the model must process the full prompt before producing the first output token (Experiment 2)
- Chunks are arbitrary splits of the token stream — a single word can arrive across two chunks. Always accumulate into `fullResponse`, never render raw deltas as complete units (Experiment 3, 4)
- SSE is a plain HTTP connection — unidirectional, simple, and exactly right for LLM streaming. WebSockets are unnecessary here (Common Mistake 6)
- Conversation history stays clean because the assistant message is only appended after the stream completes. A mid-stream abort means no push — history is never corrupted by partial responses (Experiment 5)
- The `⚡ Speed: X tokens/sec` metric is a rough approximation based on chunk count. For production accuracy, use the `usage` field from the final chunk or `tiktoken`(Experiment 6)
- Knowing when *not* to stream is as important as knowing how — structured JSON output, tool calls, and background jobs all need buffered responses, not streaming (Common Mistake 7)

---

## Next Up

**Phase 1.4 — Structured Output**  
Force the model to return valid, schema-conforming JSON every time. Understand why this is hard with streaming, how providers solve it, and why structured output is the foundation of every reliable agentic system.

---

*AI Playground · Built to learn, not to ship.*