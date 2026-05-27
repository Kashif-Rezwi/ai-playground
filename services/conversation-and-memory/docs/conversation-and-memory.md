# Phase 1.2 — Conversation & Memory

> **AI Playground Series** · Phase 1 · Core LLM Primitives

---

## What Is This?

In Phase 1.1, a single prompt produced a single response. That setup is a **stateless, single-turn call** — the model has no awareness of anything before or after that one interaction.

Real conversational AI doesn’t work that way. It needs to reference earlier context, build on previous messages, and maintain continuity across interactions. The challenge is that **LLMs are stateless by design**. There is no built-in memory between API calls.

So how does ChatGPT seem to remember something mentioned three messages earlier?

This mini-app explores that question and guides the implementation from scratch.

---

## Concept Deep Dive

### The Statelessness Problem

Every API call to an LLM is independent. When a second message is sent, the model has no awareness of the first unless that context is explicitly included again.

This means the responsibility of maintaining conversation state lies with the developer. The model itself does not retain memory; the application manages it.

This is a key mindset shift when building AI systems. The “memory” experienced in chat applications is not an inherent capability of the model, but something constructed at the application layer.

---

### How Conversation History Works

The solution is simple but powerful: **send the entire conversation history on every API call.**

Each time a new user message is received:

1. Append the new `user` message to the conversation history array
2. Send the complete history (system message, all previous turns, and the new message) to the API
3. Receive the `assistant` response
4. Append the `assistant` response to the history array
5. Repeat the process for every new message

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

This is where the context window concept from Phase 1.1 becomes a real engineering constraint.

Every model has a maximum context window, measured in tokens. As the conversation history grows, that limit is eventually reached. When that happens, the API will either:

- **Throws an error** — you exceeded the limit
- **Silently truncates** — older messages get dropped (provider-dependent)

Neither outcome is acceptable in a production system. A clear strategy is required to manage and control how much context is sent with each request.

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
Count tokens accurately, then remove the oldest messages one at a time until the total fits within the target limit, keeping enough space reserved for the model’s response.

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
5. Implements at least **one context management strategy** with a configurable token budget
6. Logs a warning when trimming or summarizing kicks in
7. Supports a `clear` command to reset history
8. Supports a `history` command to print the full current message array

No UI and no disk persistence at this stage. Focus on a clean, transparent conversation loop that can be inspected step by step.

---

## What This Covers

By completing this mini-app, it will help with:

- [x] Understanding why LLMs are stateless and what that implies for application design
- [x] Learning how to maintain and send conversation history correctly
- [x] Understanding the alternating `user → assistant` message structure
- [x] Observing how token usage grows with each interaction
- [x] Implementing at least one strategy for managing or trimming context
- [x] Understanding the distinction between short-term conversation history and long-term memory
- [x] Learning how to count tokens accurately rather than relying on word count
- [x] Understanding what a context window budget is and how to manage it effectively

---

## Experiments to Run

Once the app is working, run each of these deliberately. Each one is designed to surface a specific concept from this phase.

---

### Experiment 1 — Watching the History Grow
**Covers:** Conversation history structure, token growth per turn, the `history` command

**Setup:** Start the app. Use the default system prompt (`"You are a helpful assistant."`).

**Steps:**
1. Send: `"My name is Alex and I work as a backend engineer."`
2. After the response, type `history` — inspect the message array
3. Send: `"What are the most common databases used in backend systems?"`
4. After the response, type `history` again
5. Repeat for 3 more turns. Watch the `📊 [TOKENS]` log line on each turn.

**What to observe:**
- How does the history array structure look after each turn? Does it always alternate `user → assistant`?
- What does `input_tokens` / `prompt_tokens` look like on turn 1 vs turn 5?
- Does token count grow linearly or in jumps?

**Expected insight:** Each turn adds two messages (user + assistant) to history. Token cost grows with every exchange — what was 100 tokens on turn 1 may be 600+ by turn 5. This is the core cost/latency tradeoff of conversational AI.

---

### Experiment 2 — The Model Uses What You Send It
**Covers:** Statelessness, history as the model's only context

**Steps:**
1. Send: `"I'm building a REST API using Node.js and Express. My main concern is rate limiting."`
2. Send: `"What library would you recommend for that?"`
3. Send: `"How would I configure it to allow 100 requests per minute per IP?"`
4. Now type `clear` to reset history
5. Send: `"How would I configure it to allow 100 requests per minute per IP?"`

**What to observe:**
- In steps 2–3, does the model correctly reference the Node.js/Express context from turn 1?
- After `clear`, does the model respond coherently or ask for clarification?
- Type `history` after `clear` — what is the state of the array?

**Expected insight:** The model’s apparent “memory” comes entirely from the conversation history array managed and sent with each request. After `clear`, the model has no awareness of any prior exchange. The app is the memory system, not the model.

---

### Experiment 3 — Triggering Summarization
**Covers:** Summarization strategy, the `🧠 [SUMMARIZE]` log, token budget enforcement

**Setup:** Ensure summarization is the active strategy in `chat.ts` (it is by default). The threshold is 2000 tokens total / 1500 for history.

**Steps:**
1. Have a long, detailed conversation — share personal or technical context in each turn. Use verbose prompts like:
   - `"Tell me everything about how garbage collection works in JavaScript — cover all major algorithms."`
   - `"Now compare that to how Go handles memory management in detail."`
   - `"What are the trade-offs between the two approaches in high-throughput server applications?"`
   - Continue until you see the `🧠 [SUMMARIZE]` log appear
2. After summarization triggers, type `history` and inspect the array
3. Ask: `"What was the first language we discussed?"`

**What to observe:**
- At what turn does summarization trigger?
- In the history array after summarization, what does the injected summary message look like? (`"Summary of earlier conversation: ..."`)
- Does the model still correctly answer questions about early turns using the summary?
- Compare token count before and after summarization kicks in

**Expected insight:** Summarization compresses old context into a single dense message. The model can still reference early topics — but through a lossy summary, not the original words. Semantic meaning is preserved, verbatim details are not.

---

### Experiment 4 — Comparing Context Management Strategies
**Covers:** Hard truncation, sliding window, token-aware trimming — tradeoffs between strategies

**Setup:** The active strategy is set by commenting/uncommenting lines in `chat.ts`. Run this experiment three times, once per strategy.

**Steps (repeat for each strategy):**
1. Set the strategy (comment/uncomment the relevant line in `chat.ts`)
2. Start a fresh conversation. Send these 6 turns:
   - `"My project is called Orion and it's a real-time analytics platform."`
   - `"It processes about 50,000 events per second at peak load."`
   - `"We use Kafka for ingestion and ClickHouse for storage."`
   - `"What are common bottlenecks at this scale?"`
   - `"How would you approach horizontal scaling for the ingestion layer?"`
   - `"What did I say the project was called?"` ← key reference test
3. Watch the trim/truncation log on each turn (`⚠️ [TRIM]`, `✂️ [TRUNCATE]`, `🪟 [SLIDING WINDOW]`)
4. Note the response to the final question

**What to observe:**
- Does the model correctly answer `"What did I say the project was called?"` with each strategy?
- At what turn does each strategy kick in? (watch logs)
- How does hard truncation (`✂️`) compare to sliding window (`🪟`) in terms of how many messages it keeps?
- Does token-aware trimming (`⚠️`) feel more gradual compared to the others?

**Expected insight:** Hard truncation is blunt — it drops messages in bulk. Sliding window preserves complete turn pairs. Token-aware trimming is the most precise but trims one message at a time. None of them are perfect — the right choice depends on your use case.

---

### Experiment 5 — Statelessness Across Sessions
**Covers:** In-memory history, no persistence across restarts, long-term memory distinction

**Steps:**
1. Start the app and share something specific: `"My API key is stored in an env file called .env.production and the project lives at ~/code/myapp."`
2. Continue the conversation for a few more turns
3. Stop the app completely (`Ctrl+C` or `exit`)
4. Restart the app
5. Send: `"Where did I say the project lives?"`

**What to observe:**
- Does the model have any awareness of the previous session?
- What does the `📜 [HISTORY]` output look like on a fresh start?
- Compare this to what happens mid-session if ask the same question (it should know)

**Expected insight:** History is in-memory only. Restarting the app wipes all conversation state. The model doesn't retain anything — the app doesn't either. Persistent memory across sessions requires a database, which is the focus of Phase 5.

---

### Experiment 6 — Token Counting Accuracy
**Covers:** `tiktoken` token counting, token overhead per message, why word count is wrong

**Setup:** Watch the `📊 [TOKENS]` log on every turn.

**Steps:**
1. Send a plain English message of about 20 words — record the reported `input_tokens` / `prompt_tokens`
2. Send a message of similar word count but containing a code block:
   ```
   "Here is a function: function debounce(fn, delay) { let t; return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), delay); }; } What does it do?"
   ```
   Record `input_tokens` / `prompt_tokens`
3. Send a very short message: `"Hi."` — record `input_tokens` / `prompt_tokens`
4. Compare the delta between a short and long system prompt by restarting the app with a verbose system prompt vs the default one-liner

**What to observe:**
- Does code tokenize to more or fewer tokens than equivalent-length prose?
- Even for `"Hi."`, how many tokens are reported? (hint: there's per-message overhead — 4 tokens per message for role/formatting)
- How much does the system prompt alone consume from the 1500-token history budget?

**Expected insight:** The app uses `tiktoken` with 4 tokens of overhead per message for role and formatting. A "short" code snippet often tokenizes heavier than it looks. This is why token counting must use a real tokenizer — word estimates routinely undercount by 30–50% for technical content.

---

## Common Mistakes to Avoid

**Mistake 1 — Assuming the model remembers between API calls**  
Every call is a blank slate. The model has no awareness of prior turns unless the full history is explicitly sent with each request. There is no server-side session state.

**Mistake 2 — Trimming the system prompt to save tokens**  
The system prompt defines the model's behavior and persona for the entire session. It must always be at index 0 and must never be removed by any trim strategy. All four strategies in this app preserve it unconditionally.

**Mistake 3 — Counting tokens by word count**  
Always use a proper tokenizer (this app uses `tiktoken` with `encoding_for_model("gpt-4o-mini")`). Word-based estimates undercount by 30–50% for code and technical content. Silent overflows cause `context_length_exceeded` errors at runtime.

**Mistake 4 — Not reserving space for the response**  
The context window is shared between input and output. The app allocates `max_tokens: 500` for the response and only allows `1500` tokens for history (`2000 - 500`). Not reserving this space means the model can get cut off mid-response or fail entirely.

**Mistake 5 — Breaking the alternating message structure**  
History must always follow `user → assistant → user → assistant`. Consecutive same-role messages will cause an API error. The hard truncation strategy in this app includes an explicit safety check: if truncation leaves an orphaned `assistant` message immediately after the system prompt, it removes that message before sending.

**Mistake 6 — Triggering summarization on every turn**  
Summarization makes a second API call to compress old history. Calling it every turn doubles latency and cost. This app only triggers it when token count actually exceeds the budget — not preemptively. Build the same gate into any summarization strategy.

**Mistake 7 — Assuming summarization is lossless**  
The summary is a compressed, semantic approximation — not a transcript. Verbatim details (exact phrasing, specific numbers, code snippets) are often lost. This app's summarization prompt is tuned for density and factual accuracy (`temperature: 0.3`), but it still cannot preserve everything. Design for graceful degradation.

---

## Key Takeaways

- LLMs have no memory — the app is the memory system. History is just an array the app manages and sends on every call (Experiment 2, 5)
- Sending full conversation history on every call is not a hack — it is the intended design. The model is always doing single-turn completion on everything sent to it (Experiment 1)
- Token count grows with every exchange — a 10-turn conversation can cost 10× the tokens of a single-turn call. Watch the `📊 [TOKENS]` log to see this in real time (Experiment 1)
- Context management is an engineering problem, not an AI problem — the right strategy depends on whether coherence, cost, or simplicity is the priority. No strategy is universally correct (Experiment 4)
- Token counting must use a real tokenizer like `tiktoken`. Word counts routinely undercount technical content by 30–50%, causing silent context overflows (Experiment 6)
- Summarization preserves semantic meaning but loses verbatim detail — it adds latency from a second API call and should only trigger when actually needed (Experiment 3)
- In-memory history disappears on restart. There is no persistence here — long-term memory across sessions requires a database, covered in Phase 5 (Experiment 5)
- The alternating `user → assistant` rule is enforced by the API, not just a convention — breaking it causes errors. The hard truncation strategy includes a safety check precisely because naive trimming can create orphaned messages (Common Mistake 5)

---

## Next Up

**Phase 1.3 — Streaming**  
Stop waiting for the full response. Stream tokens as they arrive. Understand SSE, backpressure, and how to build a responsive UI on top of a streaming API.

---

*AI Playground · Built to learn, not to ship.*