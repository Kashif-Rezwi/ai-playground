# Phase 1.3 — Streaming

> **AI Playground Series** · Phase 1 · Core LLM Primitives

---

## What Is This?

In Phase 1.1 and 1.2, every API call followed the same pattern — you send a request, you **wait**, and eventually the full response arrives at once. This is called a **blocking** or **batch** response.

For short responses this feels fine. But for longer generations — a detailed explanation, a code review, a long analysis — the user stares at a blank screen for 3–10 seconds before anything appears. That's a terrible experience.

Streaming fixes this. Instead of waiting for the model to finish generating the *entire* response before sending it, the API **pushes tokens to you as they are generated** — one by one, in real time.

This phase is about understanding *how* that works under the hood, not just calling `.stream()` on an SDK method.

---

## Concept Deep Dive

### Why Streaming Exists

LLMs generate text **autoregressively** — one token at a time. Token 2 depends on token 1. Token 3 depends on tokens 1 and 2. The model cannot generate token 50 without first generating tokens 1–49.

This means the model *already has* token 1 ready long before it finishes generating the full response. Without streaming, the API holds all those tokens in a buffer and sends them only after the final token is generated. With streaming, each token is forwarded to you the moment it exists.

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

The `delta` field contains only the **new content** in this chunk — not the full response so far. You accumulate these deltas yourself to reconstruct the full message.

The final chunk has `finish_reason` set to `"stop"` (or `"length"` if it hit `max_tokens`) and an empty delta.

---

### Backpressure

Backpressure is what happens when the **producer generates data faster than the consumer can process it**.

In streaming LLM responses, the model generates tokens at a fairly steady rate. Your consumer (the code reading the stream) needs to keep up. If it falls behind — due to slow rendering, heavy processing, or a slow network — chunks pile up in a buffer.

In a simple CLI app this rarely matters. But in production systems — especially when you're doing something with each chunk (parsing, storing, forwarding to another stream) — backpressure becomes a real concern.

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

Streams can fail mid-way. The connection can drop after 10 tokens have been sent. The model can hit an error mid-generation. Your app needs to handle this gracefully:

- **Track whether the stream completed** — did you receive the `[DONE]` sentinel or did the connection close unexpectedly?
- **Partial responses** — decide what to do with an incomplete assistant message (discard it, show it with a warning, retry)
- **Timeouts** — set a timeout on the stream connection; don't let it hang indefinitely
- **Retry logic** — for transient network errors, you may want to retry the full request (you cannot resume a dropped stream mid-way)

---

### Streaming with Conversation History

Streaming integrates cleanly with your Phase 1.2 conversation loop with one important rule:

> **Never append a partial streamed response to conversation history.**

Wait until the stream is fully complete, then append the full accumulated `assistant` message. If you append mid-stream and the stream fails, you'll have a corrupted history with a truncated assistant message — which will confuse the model on the next turn.

---

## What This App Builds

Extend your Phase 1.2 conversation loop to:

1. Switch the API call to **streaming mode** (`stream: true`)
2. Read the SSE stream chunk by chunk using an async iterator
3. **Print each token to the terminal as it arrives** — character by character, no newline until done
4. Accumulate the full response string across all chunks
5. Measure and log **Time to First Token (TTFT)** and **total generation time**
6. Only append the completed response to conversation history after the stream ends
7. Handle a mid-stream connection drop gracefully — log a warning, discard the partial response
8. Support both streaming and non-streaming mode via an environment variable flag so you can compare them side by side

No UI. The terminal *is* the streaming interface here. Watching tokens appear one by one in your CLI is the whole point.

---

## What You'll Learn

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

| Experiment | What to observe |
|---|---|
| Run the same prompt in streaming vs buffered mode | Feel the UX difference in perceived latency |
| Log a timestamp on the first chunk received | Measure your actual TTFT |
| Print each raw chunk object before extracting delta | See the full SSE chunk structure |
| Simulate a slow consumer (add a delay per chunk) | Observe backpressure in action |
| Kill the process mid-stream (Ctrl+C) | What happens to your history array? |
| Send a very short prompt vs a very long one | How does TTFT change? |
| Log total tokens generated per second | Understand model throughput |

---

## Common Mistakes to Avoid

**Mistake 1 — Rendering the delta instead of the accumulated string**  
Always render `fullResponse` (the accumulated string), not just the new delta chunk. Partial deltas can be as small as a single character.

**Mistake 2 — Appending partial responses to history**  
Only append after `[DONE]`. A truncated assistant message in history will corrupt subsequent turns.

**Mistake 3 — Not handling stream termination**  
Always check if you received the final `[DONE]` sentinel. A closed connection without `[DONE]` means something went wrong.

**Mistake 4 — Doing heavy work inside the chunk loop**  
Keep the chunk processing loop as lightweight as possible. Accumulate text, nothing else. Do any post-processing after the stream ends.

**Mistake 5 — Confusing SSE with WebSockets**  
SSE is HTTP, unidirectional, and simpler. WebSockets are bidirectional and stateful. LLM streaming uses SSE — don't overcomplicate it.

---

## Key Takeaways

- LLMs generate tokens one at a time — streaming just stops hiding this from you
- SSE is a simple, standard HTTP mechanism — not magic
- TTFT is the metric that matters for user experience, not total generation time
- Streaming and conversation history are fully compatible — just wait for `[DONE]` before appending
- Backpressure is a real concern in production; in a CLI it's invisible
- Knowing *when not* to stream (structured output, tool calls) is as important as knowing how to stream

---

## Next Up

**Phase 1.4 — Structured Output**  
Force the model to return valid, schema-conforming JSON every time. Understand why this is hard with streaming, how providers solve it, and why structured output is the foundation of every reliable agentic system.

---

*AI Playground · Built to learn, not to ship.*