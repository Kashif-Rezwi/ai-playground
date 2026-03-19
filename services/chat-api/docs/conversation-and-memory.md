# Phase 1.2 — Conversation & Memory

> **AI Playground Series** · Phase 1 · Core LLM Primitives

---

## What Is This?

In Phase 1.1 you sent a single prompt and got a single response. That was a **stateless, single-turn call** — the model had no knowledge of anything before or after that one message.

Real conversational AI isn't single-turn. It needs to remember what was said, reference earlier context, and build on previous exchanges. But here's the catch — **LLMs are stateless by design**. The model has no memory between API calls. It remembers nothing.

So how does ChatGPT "remember" what you said three messages ago?

This mini-app answers that question, and makes you implement it from scratch.

---

## Concept Deep Dive

### The Statelessness Problem

Every API call to an LLM is completely independent. When you send a second message, the model has absolutely no recollection of the first one unless you explicitly re-send it.

This means **you** — the developer — are responsible for maintaining conversation state. The model doesn't hold memory. Your application does.

This is one of the most important mental shifts in building AI systems. The "memory" you see in chat products is an illusion built by the application layer, not a feature of the model itself.

---

### How Conversation History Works

The solution is simple but powerful: **send the entire conversation history on every API call.**

Every time the user sends a new message, you:
1. Append the new `user` message to your history array
2. Send the full array (system + all previous turns + new message) to the API
3. Receive the `assistant` response
4. Append the `assistant` response to your history array
5. Repeat

The model receives the full conversation each time and uses it as context to generate a coherent continuation. From the model's perspective, it's always just doing single-turn completion — but the "single turn" now contains the entire conversation.

```
Turn 1 sent:  [system, user_1]
Turn 2 sent:  [system, user_1, assistant_1, user_2]
Turn 3 sent:  [system, user_1, assistant_1, user_2, assistant_2, user_3]
Turn 4 sent:  [system, user_1, assistant_1, user_2, assistant_2, user_3, assistant_3, user_4]
```

Notice what's happening: **each turn grows the total token count.** Turn 1 might be 50 tokens. Turn 10 might be 2,000 tokens. Long conversations get expensive and eventually hit the context window ceiling.

---

### The Context Window Problem

This is where Phase 1.1's context window concept becomes a real engineering constraint.

Every model has a maximum context window (measured in tokens). As conversation history grows, you eventually hit that limit. When you do, the API either:
- **Throws an error** — you exceeded the limit
- **Silently truncates** — older messages get dropped (provider-dependent)

Neither is acceptable in a production system. You need a strategy.

---

### Context Management Strategies

#### Strategy 1 — Hard Truncation
Keep only the last N messages in history. Simple but lossy — the model loses early context abruptly.

```
Keep only last 10 messages → drop everything older
```

**Pros:** Simple to implement  
**Cons:** Model loses context suddenly, can create incoherent responses

---

#### Strategy 2 — Sliding Window
Similar to truncation but always preserves the system prompt and the most recent N turns.

```
[system] + [last N user/assistant pairs]
```

**Pros:** Predictable token budget, easy to reason about  
**Cons:** Still loses older context entirely

---

#### Strategy 3 — Summarization
When history gets too long, use the LLM itself to summarize the older portion of the conversation. Replace the old messages with a compact summary, then continue.

```
[system] + [summary of turns 1–20] + [turns 21–present]
```

**Pros:** Preserves semantic meaning of older context  
**Cons:** Adds latency and cost at the summarization step, summary quality varies

---

#### Strategy 4 — Token-Aware Trimming
Count tokens precisely. Trim the oldest messages one by one until the total fits within your target budget (leave room for the response too).

```
While total_tokens > budget:
    remove oldest non-system message
```

**Pros:** Precise control over token usage  
**Cons:** Requires accurate token counting (use a tokenizer library, not word estimates)

---

### Token Counting — The Right Way

Never estimate tokens by word count. Always use the model provider's tokenizer or a compatible library (like `tiktoken` for OpenAI, or the Anthropic token counting API).

**Why it matters:** A message that looks short in words can be large in tokens (code, special characters, non-English text). Building on word estimates leads to silent overflows.

Always account for:
- System prompt tokens
- All message content tokens
- Overhead tokens per message (role labels, formatting)
- Reserved tokens for the response (`max_tokens`)

```
available_context = model_context_window - max_tokens_for_response - system_prompt_tokens
history must fit within: available_context
```

---

### Turn Structure In Depth

A well-managed conversation history has structure and discipline:

```
[system]          → always first, never removed
[user_1]          → oldest user turn
[assistant_1]     → model's response to user_1
[user_2]          → next user turn
[assistant_2]     → model's response to user_2
...
[user_N]          → latest user input (just added)
```

**Rules to follow:**
- The sequence must always alternate: `user → assistant → user → assistant`
- Never end history with an `assistant` message before a new `user` message
- Never have two consecutive `user` or `assistant` messages — most APIs will reject this
- The system message always stays at index 0 and is never trimmed

---

### What Is "Memory" vs "History"?

These are commonly confused. Here's the distinction:

| Concept | What It Is | Where It Lives |
|---|---|---|
| **Conversation History** | The raw message array sent to the API | In-memory array in your app |
| **Short-term Memory** | What the model "knows" from the current session | Inside the context window |
| **Long-term Memory** | Persisted information across sessions | Database (covered in Phase 5) |

This phase covers **conversation history** and **short-term memory** only. Long-term memory (storing facts across sessions, semantic retrieval) is a separate topic covered in Phase 5 — Memory Systems.

---

## What This App Builds

A minimal interactive CLI chat loop that:

1. Maintains a **message history array** in memory
2. Accepts user input in a loop (REPL-style)
3. Appends each user message to history, sends full history to API, appends assistant response
4. **Logs token usage** on every turn so you can watch it grow
5. Implements at least **one context management strategy** (your choice) with a configurable token budget
6. Logs a warning when trimming or summarizing kicks in
7. Supports a `clear` command to reset history
8. Supports a `history` command to print the full current message array

No UI. No persistence to disk (that's later). Just a clean, transparent conversation loop you can inspect at every step.

---

## What You'll Learn

By completing this mini-app, you will:

- [ ] Understand why LLMs are stateless and what that means for your app
- [ ] Know how to maintain and send conversation history correctly
- [ ] Understand the alternating `user → assistant` message structure rule
- [ ] See how token count grows with each turn in real time
- [ ] Implement at least one context management / trimming strategy
- [ ] Understand the difference between conversation history and long-term memory
- [ ] Know how to count tokens accurately (not by word count)
- [ ] Understand what "context window budget" means and how to manage it

---

## Experiments to Run

| Experiment | What to observe |
|---|---|
| Ask the model something in turn 1, reference it in turn 5 | Does it remember correctly? |
| Print the full history array before each API call | See exactly what the model receives |
| Let the conversation run until trimming kicks in | Watch the model lose earlier context |
| Implement summarization — compare quality to truncation | Which feels more coherent? |
| Send two consecutive `user` messages without an `assistant` in between | What error does the API return? |
| Start a new session without clearing history | Does persistence across sessions matter? |
| Ask about something you said in a "previous session" (without history) | Confirm the model has zero memory |

---

## Common Mistakes to Avoid

**Mistake 1 — Assuming the model remembers between API calls**  
It doesn't. Every call is a blank slate. If you don't send history, it's gone.

**Mistake 2 — Trimming the system prompt**  
Never remove the system message to make room. It should be the last thing you'd ever cut.

**Mistake 3 — Counting tokens by word count**  
Always use a proper tokenizer. Word-based estimates will silently overflow your context window.

**Mistake 4 — Not reserving space for the response**  
Your token budget calculation must account for `max_tokens`. The context window is shared between input and output.

**Mistake 5 — Breaking the alternating message rule**  
`user → assistant → user → assistant` — always. Consecutive same-role messages will cause API errors or unpredictable behavior.

---

## Key Takeaways

- LLMs have no memory — your app is the memory system
- Sending full conversation history on every call is not a hack — it's the intended design
- Token count grows linearly with conversation length — this is a real cost and latency concern
- Context management is an engineering problem, not an AI problem — you decide the strategy
- The difference between "history" and "memory" matters more as your systems get complex
- Everything you build here is the foundation for RAG, agents, and long-term memory systems later

---

## Next Up

**Phase 1.3 — Streaming**  
Stop waiting for the full response. Stream tokens as they arrive. Understand SSE, backpressure, and how to build a responsive UI on top of a streaming API.

---

*AI Playground · Built to learn, not to ship.*