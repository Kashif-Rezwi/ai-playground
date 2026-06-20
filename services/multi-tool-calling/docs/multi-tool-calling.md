# Phase 2.2 — Multi-Tool Calling

> **AI Playground Series** · Phase 2 · Tool Use & Function Calling

---

## What Is This?

In Phase 2.1, the model had one tool available and the loop was straightforward: detect a tool call, execute it, feed the result back. The single-tool constraint kept the mechanics simple, there was no ambiguity about which tool ran, and each turn produced at most one tool result message.

Phase 2.2 breaks that constraint in two ways.

First: the model now has **multiple tools** to choose from. For every user message, it must reason about which tool is appropriate or whether any tool is needed at all. This is the first time the model is doing real agentic reasoning: surveying a registry, evaluating intent, and selecting the right capability.

Second: the model can call **multiple tools in a single response**. Instead of one `tool_calls` entry, a single assistant message may contain two, three, or more calls issued simultaneously. These are **parallel tool calls**, the model determined that all the information it needs can be fetched independently and in one shot, without waiting for intermediate results.

The runner built in Phase 2.1 hardcoded execution for only the first tool call (`message.tool_calls[0]`). Phase 2.2 replaces this with a proper `for` loop over `assistantMsg.tool_calls`, executing all calls returned by the model. The difference between a working parallel implementation and a broken one comes down to getting the history append sequence right.

---

## Concept Deep Dive

### A Registry, Not a Single Tool

Phase 2.1 had a single entry in the `tools` array passed to the API. Phase 2.2 has several. Every tool in the array is available to the model on every call. The model reads each definition and decides at inference time which, if any, to invoke.

This changes how tool definitions should be written. With one tool, the description just needs to say when to use it. With multiple tools, descriptions need to be **mutually exclusive**, clear enough that the model never confuses which tool handles which kind of request.

A travel assistant with three tools illustrates this well:

```typescript
tools: [
    get_weather,    // current conditions for a city
    get_time,       // current local time for a city
    convert_currency // exchange rate between two currencies
]
```

These three descriptions must collectively cover the space without overlap. If `get_weather` and `get_time` had vague descriptions that both mentioned "information about a city", the model might call either one unpredictably. The descriptions are the routing table, treat them with the same care as routing rules in a backend.

---

### Parallel Tool Calls

This is the central new mechanism in Phase 2.2. When the model identifies that a user request requires information from multiple independent sources, it can issue all the calls in a single response rather than making one call, waiting, then making another.

A prompt like "I'm flying to Tokyo tonight, what's the weather and what time is it there?" requires two independent data fetches. The weather in Tokyo and the current time in Tokyo don't depend on each other. The model recognizes this and returns:

```typescript
// finish_reason: "tool_calls"
// choices[0].message.tool_calls: [
//   { id: "call_abc1", function: { name: "get_weather", arguments: '{"city":"Tokyo"}' } },
//   { id: "call_def2", function: { name: "get_time",    arguments: '{"city":"Tokyo"}' } }
// ]
```

Two calls, one response. The application executes both, appends both results, then makes the second API call. The model composes a final answer from both results.

This matters for latency in real systems: two sequential tool calls require three API calls minimum (initial + tool1 result + tool2 result). Two parallel tool calls require only two API calls (initial + both results together). Parallel calls also feel more natural to users, as the final response arrives with all the information at once rather than in two chunks.

---

### The Parallel History Structure

This is where Phase 2.2 demands more precision than Phase 2.1. After a parallel tool call turn, the history must look exactly like this:

```
[system]
[user]          "What's the weather and time in Tokyo?"
[assistant]     content: null, tool_calls: [call_abc1, call_def2]
[tool]          tool_call_id: "call_abc1", content: '{"city":"Tokyo","temperature":22,...}'
[tool]          tool_call_id: "call_def2", content: '{"city":"Tokyo","local_time":"11:47 PM",...}'
[assistant]     content: "In Tokyo it's currently 22°C and partly cloudy. The local time is 11:47 PM."
```

Three rules govern this structure:

**Rule 1: The assistant tool_call message comes first, always.** All tool call IDs referenced in subsequent `tool` messages must already exist in history before any `tool` message is appended. Appending tool results before the assistant decision message causes an API error.

**Rule 2: All tool results must be present before the second API call.** The model needs every tool result in context to generate a coherent final answer. Making the second API call after appending only one of two tool results causes the model to either wait for the missing result (which it can't) or generate an incomplete response.

**Rule 3: Each `tool` message references exactly one `tool_call_id`.** There is no "batch result" format. Two tool calls → two `tool` messages → two distinct `tool_call_id` values. The IDs are generated by the model on the first call and must be copied verbatim into the corresponding `tool` messages.

---

### The Correct Iteration Pattern

The runner from Phase 2.1 hardcoded `tool_calls[0]`. Phase 2.2 introduces the proper loop:

```typescript
// Step 1: append assistant message with ALL tool_calls
conversationHistory.push({
    role: "assistant",
    content: assistantMsg.content,       // null
    tool_calls: assistantMsg.tool_calls, // could be 1, 2, or more
});

// Step 2: execute each tool and append its result
// This loop is sequential in execution (one at a time),
// but the model treats all the results as if they arrived in parallel.
for (const toolCall of assistantMsg.tool_calls) {
    const result = executeTool(toolCall);
    conversationHistory.push({
        role: "tool",
        tool_call_id: toolCall.id,  // must match the call that requested it
        content: result,
    });
}

// Step 3: ALL results are in history — now make the second API call
const secondResponse = await client.chat.completions.create({ ... });
```

The execution of tools in this loop is sequential, as the application runs them one after another. But from the model's perspective on the second call, all results are in context simultaneously. The parallelism is logical, not necessarily physical. In a real system, this loop could use `Promise.all()` to execute tool functions concurrently (since they hit independent APIs), but the appending to history must still be sequential and in the same order as the `tool_calls` array.

---

### How the Model Decides Which Tool(s) to Call

When multiple tools are available, the model's tool selection process involves three factors:

**Semantic matching.** The model compares the user's request to each tool's `name` and `description`. It picks the tool whose description most closely matches what the user is asking for. This is why descriptions must be specific and non-overlapping.

**Independence detection.** Before issuing parallel calls, the model evaluates whether the needed information is independent. If the answer to question A depends on the answer to question B, the model will make sequential calls across multiple turns. If the answers are independent (weather and time for the same city), it issues them in parallel in one response.

**Completeness reasoning.** The model asks itself: can I answer this fully with one call, or do I need more? 
- "What's the weather in Paris?" → one call.
- "What's the weather in Paris and what time is it there?" → two parallel calls.
- "What's the weather in the cheapest city to fly to from London?" → this requires sequential reasoning (find the city first, then get weather), not parallel.

This third factor is important to internalize: parallel calls require **known** information targets. If the result of call A determines the arguments for call B, the model cannot parallelize them. It will make call A first, receive the result, then in a second turn make call B. Phase 2.2's experiments surface this distinction clearly.

---

### Tool Count and Context Budget

Each tool definition costs tokens. A well-specified tool with a detailed description and a multi-field parameters schema might consume 100–200 tokens just for its definition. With three tools, the tool definitions alone add 300–600 tokens to every API call, before the system prompt or conversation history.

This is worth understanding now, before building large tool registries. At 10 tools with detailed schemas, a non-trivial chunk of the context budget is consumed by definitions that may never be called in a given turn. Tool description quality vs. brevity is a real tradeoff in production systems, lean descriptions that still produce accurate routing behavior are worth investing in.

For Phase 2.2, three tools is the right number: enough to demonstrate multi-tool reasoning and parallel calls, few enough that tool definition overhead stays negligible.

---

### Partial Failure in Parallel Calls

When two tools are called in parallel and one fails, the application has a decision: fail the entire turn, or return what it has. The correct production behavior is to **return a structured error for the failed tool and let the model decide how to handle it**.

The model is surprisingly good at this. Given one successful result and one error result, it will typically compose a response that answers the part it can and acknowledges the failure for the part it can't. It behaves like a human who got partial information and uses what's available.

The key is that both `tool` messages must still be appended. A pending `tool_call_id` in the assistant message that never gets a corresponding `tool` result leaves the history in an invalid state and causes the second API call to fail.

```typescript
// Even on failure, always append a tool message for every tool_call in the loop
const result = (() => {
    try {
        return executeTool(toolCall);
    } catch {
        return JSON.stringify({ error: "Tool execution failed unexpectedly" });
    }
})();

conversationHistory.push({
    role: "tool",
    tool_call_id: toolCall.id,
    content: result,  // error JSON or success JSON, as the loop always completes
});
```

This is a strengthening of the Phase 2.1 rule (never throw inside a tool). In Phase 2.2, the consequence of a throw is worse: it leaves multiple unresolved `tool_call_id` references in the assistant message, making the history unrecoverable without a full rollback.

---

## What This App Builds

A CLI travel assistant with three registered tools:

1. **`get_weather(city, unit?)`** — ported from Phase 2.1, mock implementation
2. **`get_time(city)`** — returns the current local time for a city, mock with realistic timezone offsets
3. **`convert_currency(amount, from_currency, to_currency)`** — exchange rate calculation, mock with realistic rates

These three tools create a natural surface for all the scenarios this phase covers:

- **Single tool, unambiguous** — "What time is it in Seoul?" calls only `get_time`
- **Single tool, chosen from multiple** — "Is it hot in Dubai?" calls only `get_weather`
- **Parallel tools, same city** — "What's the weather and time in Berlin?" calls both `get_weather` and `get_time`
- **Parallel tools, different domains** — "Convert 500 USD to EUR and tell me the weather in Paris" calls `convert_currency` and `get_weather`
- **Sequential reasoning** — "Should I bring a jacket if I'm converting 100 GBP for a trip to Tokyo?" the model may call `convert_currency` first, then reason about weather, or call both in parallel, observe which pattern emerges
- **No tool** — "What documents do I need for a UK passport?" answers directly

---

## File Structure

```
services/multi-tool-calling/
├── package.json
├── tsconfig.json
├── docs/
│   └── multi-tool-calling.md
└── src/
    ├── chat.ts             ← REPL loop, entry point (minimal — same pattern as 2.1)
    ├── config.ts           ← MODEL, MAX_RESPONSE_TOKENS, SYSTEM_PROMPT
    ├── types.ts            ← Same four-role type union as 2.1 (no changes needed)
    ├── runner.ts           ← Extended loop: iterates full tool_calls array
    └── tools/
        ├── index.ts        ← Dispatcher: routes name → function, wraps errors
        ├── definitions.ts  ← Three tool schemas (get_weather, get_time, convert_currency)
        ├── weather.ts      ← Ported from Phase 2.1
        ├── time.ts         ← New: mock local time by city
        └── currency.ts     ← New: mock exchange rates
```

The runner change from Phase 2.1 to Phase 2.2 is minimal in code but significant in behavior. We replace the hardcoded `tool_calls[0]` with a `for` loop over `tool_calls`, wrapping the execution in a try/catch to ensure every tool call always produces a corresponding result message even on failure. Everything else is additive: two new tool files, two new entries in `definitions.ts`, two new `case` branches in the dispatcher.

This is intentional. Phase 2.2 is an extension of Phase 2.1, not a rewrite. The architecture should feel like adding capabilities, not restructuring.

---

## What This Covers

By completing this mini-app:

- [x] Registering and managing multiple tools in a single session
- [x] Understanding how tool descriptions function as a routing table
- [x] Writing mutually exclusive descriptions that prevent tool confusion
- [x] Observing parallel tool calls in the raw `tool_calls` array
- [x] Understanding why parallel calls require at least two API calls regardless of the tool count
- [x] Implementing the correct parallel history append sequence (assistant → all tools → second call)
- [x] Understanding why `tool_call_id` ordering matters in parallel execution
- [x] Distinguishing parallel from sequential tool call patterns and knowing when each occurs
- [x] Handling partial failure in parallel calls without corrupting history
- [x] Understanding how tool definition token cost affects context budget
- [x] Observing model tool selection reasoning across ambiguous and unambiguous prompts

---

## Experiments to Run

Once the app is working, run each of these deliberately. Each one surfaces a specific concept from this phase.

---

### Experiment 1 — Single Tool Selection From a Registry
**Covers:** Tool routing, description-based selection, `finish_reason` branching

**Setup:** Start the app. All three tools are registered. Watch the `[LOOP] finish_reason:` and `[TOOL] Executing:` logs.

**Steps:**
1. Send: `"What's the current time in Seoul?"` — note which tool runs
2. Send: `"Is it raining in Lisbon right now?"` — note which tool runs
3. Send: `"I need to convert 250 GBP to JPY"` — note which tool runs
4. Send: `"What's the best season to visit Kyoto?"` — does any tool run?
5. For each tool-call turn, type `history` and count the messages added

**What to observe:**
- Does the model call the correct single tool for each of steps 1–3?
- Does step 4 trigger a tool call, or does the model answer from training knowledge?
- How many messages are added to history per tool-call turn vs per direct-answer turn?
- Do any of the tool calls produce unexpected tool selections e.g. `get_weather` being called for a time question?

**Expected insight:** With well-written descriptions, the model consistently routes to the correct tool. The description boundary between `get_weather` and `get_time` matters most, both relate to a city, but one is about conditions and the other is about clock time. If routing errors appear, the tool descriptions are the first place to look, not the implementation.

---

### Experiment 2 — Triggering a Parallel Tool Call
**Covers:** Parallel `tool_calls` array, two tools in one response, history after parallel execution

**Setup:** Normal config. The key observable is the `tool_calls` array length in the first response.

**Steps:**
1. Send: `"I'm flying to Tokyo tonight — what's the weather like and what time will it be when I land?"` — watch the logs
2. After the response, type `history` and inspect the full array
3. Count: how many messages were added this turn?
4. Find the assistant message with `tool_calls`. How many entries does the array have?
5. Find the two `tool` messages. What are their `tool_call_id` values? Do they match the entries in the assistant message?
6. Now send a single-tool question to compare history structure: `"What time is it in Tokyo?"`

**What to observe:**
- Does the single prompt "weather and time" produce one assistant message with two `tool_calls` entries, or two separate assistant messages each with one?
- After the parallel call, how many total messages are in history for this turn? (Answer: 5 — user + assistant-with-two-tool-calls + tool-result-1 + tool-result-2 + final-assistant)
- Compare that to the single-tool turn. How many messages does that add? (Answer: 4)
- Are the two `tool` messages appended in the same order as the `tool_calls` array? Does order matter?

**Expected insight:** A parallel tool call produces one assistant message with multiple `tool_calls` entries, not multiple assistant messages. The loop executes them sequentially and appends a `tool` message for each, in order. The final count for a parallel turn is 5 messages added vs 4 for a single-tool turn. The extra message is the second tool result. Understanding this growth rate matters when building agents that make many calls in long sessions.

---

### Experiment 3 — The Boundary Between Parallel and Sequential
**Covers:** Independence detection, when the model parallelizes vs chains, agentic reasoning

**Setup:** Normal config. The goal is to find the conditions under which the model does and does not parallelize.

**Steps:**
1. Send: `"What's the weather in Berlin and what time is it there?"` — parallel or sequential?
2. Send: `"Convert 100 USD to EUR, and also tell me the weather in Paris"` — parallel or sequential?
3. Send: `"What's the weather like in the warmest European capital right now?"` — how many turns and calls does this take?
4. Send: `"I have 500 USD. How many Euros can I get, and is the weather in Paris good for sightseeing with that budget?"` — observe carefully
5. For steps 3 and 4, type `history` after each response and count the distinct assistant messages (each represents a model "turn")

**What to observe:**
- Do steps 1 and 2 produce parallel calls (one assistant message with multiple `tool_calls`) or sequential calls (multiple assistant messages each with one)?
- For step 3, does the model attempt to call a "get warmest city" tool (which doesn't exist), answer from knowledge, or refuse?
- Does step 4 produce a single parallel call, two sequential calls, or something else?
- In any case where multiple turns happen, how many total API calls were made?

**Expected insight:** The model parallelizes when targets are known and independent. "Weather in Berlin and time in Berlin" → parallel, both targets are explicit. "Warmest European capital" → sequential or direct answer because the target city isn't known upfront, as the model has to reason to a city before it can call a weather tool (or it just answers from training). This is the difference between retrieval (known target) and reasoning (unknown target that must be computed). Phase 4.1's ReAct pattern is built on exactly this distinction.

---

### Experiment 4 — Inspecting Raw Parallel Tool Calls
**Covers:** `tool_calls` array structure, `id` uniqueness, argument parsing per call

**Setup:** Add a temporary `console.log(JSON.stringify(assistantMsg.tool_calls, null, 2))` in `runner.ts` after receiving the first API response, before the execution loop. Remove it after.

**Steps:**
1. Send: `"What's the weather in London and what time is it there?"`
2. Inspect the raw `tool_calls` array logged to the terminal
3. Find: the `id` for each call — are they unique strings? What format are they?
4. Find: the `arguments` for each call — are they JSON strings or objects?
5. Now temporarily modify the runner to only iterate the first tool call (`for (const toolCall of [assistantMsg.tool_calls[0]])`) — restart and send the same prompt
6. What happens on the second API call when only one of the two tool results is present?

**What to observe:**
- How many entries are in `tool_calls` for the parallel prompt?
- Are the `id` values distinct across the two calls? What do they look like (format, prefix)?
- When only one tool result is appended and the second API call is made, does it succeed, fail, or produce a partial response?
- Does the API throw an error for the unresolved `tool_call_id`, or does the model just answer with partial information?

**Expected insight:** The `id` values are generated by the model (e.g. `"call_abc123"`) and are unique per turn. They serve as the join key between `tool_calls` entries and `tool` result messages. Leaving a `tool_call_id` unresolved in history causes an API error on the next call, as the history structure is invalid. This is why the iteration loop must be unconditional: every entry in `tool_calls` must produce exactly one `tool` result message before the second call.

---

### Experiment 5 — Partial Tool Failure in Parallel Execution
**Covers:** Error handling in the loop, history integrity under failure, model response with partial results

**Setup:** Temporarily modify `tools/currency.ts` to throw or return an error for a specific currency pair.

**Steps:**
1. In `currency.ts`, add this at the top of `convertCurrency()`:
   ```typescript
   if (args.to_currency === "BLORP") {
       return { error: "Unknown currency: BLORP", from: args.from_currency, to: args.to_currency };
   }
   ```
2. Send: `"What's the weather in Tokyo and convert 100 USD to BLORP"`
3. Watch both `[TOOL]` log lines — what does each return?
4. Read the final response — how does the model handle one success and one failure?
5. Type `history` — are there two `tool` messages? Is the `tool_call_id` for the failed call present?
6. Now instead of returning an error, throw from `convertCurrency()` and observe what happens to the runner

**What to observe:**
- When one tool returns error JSON and the other succeeds, does the model compose a useful partial response or refuse entirely?
- Are both `tool` messages present in history even when one contains error JSON?
- Is the conversation still usable after the partial failure, can a follow-up message be sent successfully?
- When `throw` is used instead of returning error JSON, does the runner crash and is history left in a recoverable state?

**Expected insight:** Returning structured error JSON keeps history intact. The model receives both results, sees one is an error, and composes a response that addresses what it can ("The weather in Tokyo is 22°C. I couldn't convert to BLORP, as that currency isn't recognized."). Throwing inside a tool corrupts the history because the `tool_call_id` for the throwing tool has an unresolved reference in the assistant message. The try/catch wrapper in the runner's iteration loop exists precisely for this: it guarantees every call_id gets a result message, even under failure.

---

### Experiment 6 — Tool Description Quality and Routing Accuracy
**Covers:** Description as routing table, ambiguity effects, description tuning

**Setup:** This experiment deliberately degrades description quality to observe routing errors.

**Steps:**
1. In `definitions.ts`, replace `get_weather`'s description with: `"Gets information about a city."`
2. Replace `get_time`'s description with: `"Gets information about a city."`
3. Restart and run these prompts, noting which tool is called each time:
   - `"What's the temperature in Madrid?"`
   - `"What time is it in Madrid?"`
   - `"Tell me about Madrid."`
4. Restore the original descriptions and run the same three prompts. Compare results.
5. With original descriptions, send: `"What's the situation in Madrid right now?"` ambiguous with no clear tool signal. What happens?

**What to observe:**
- With identical vague descriptions, does the model consistently call the right tool, or is it unpredictable?
- After the identical descriptions, does `"temperature"` reliably route to `get_weather`? Does `"time"` reliably route to `get_time`?
- With restored descriptions, does the routing improve immediately?
- For the ambiguous prompt "What's the situation in Madrid right now?", does the model call one tool, both tools, or answer directly?

**Expected insight:** Identical or vague descriptions cause inconsistent routing, as the model falls back to semantic guessing from the tool name alone. Precise, mutually exclusive descriptions with explicit trigger conditions ("Use this whenever the user asks about weather or temperature") are what actually determine routing reliability. This is directly analogous to writing precise routing rules in a backend: the clearer the rule, the more predictable the behavior. The ambiguous prompt also reveals that the model uses the most prominent signal in the user's message, "situation" is broad, so it may call one tool, both, or neither depending on how it interprets intent.

---

## Common Mistakes to Avoid

**Mistake 1 — Making the second API call before all tool results are appended**
Iterating over `tool_calls`, making the second API call after the first result, and appending remaining results after the call is the most common structural error in parallel tool calling. The second API call must come after the entire `for` loop completes, not inside it. All pending `tool_call_id` references must be resolved before the next model call.

**Mistake 2 — Appending tool results without first appending the assistant tool_call message**
The assistant message containing `tool_calls` must come first in history, before any of the corresponding `tool` result messages. Appending tool results before the assistant decision causes an API error because the `tool_call_id` references a message that doesn't yet exist in history.

**Mistake 3 — Stopping the loop on the first tool failure**
If one tool in a parallel batch throws or errors and the loop is broken early, any remaining `tool_call_id` entries in the assistant message are left unresolved. The history is invalid and the next API call fails. Every entry in `tool_calls` must produce a `tool` result message, success or failure. The try/catch must be inside the loop, not around it.

**Mistake 4 — Overlapping tool descriptions**
Two tools with descriptions that cover the same semantic territory produce inconsistent model behavior. "Gets city data" as a description for both `get_weather` and `get_time` means the model selects based on `name` alone, which is unreliable. Each description should describe a distinct, non-overlapping capability with an explicit trigger condition.

**Mistake 5 — Assuming parallel calls are always faster end-to-end**
Parallel tool calls still require two API calls (initial + second with all results). If the tool functions themselves are fast (mocks, simple lookups), the API call latency dominates. Running tools concurrently with `Promise.all()` helps in real API scenarios but doesn't change the two API call minimum. Count API calls, not tool calls, for latency estimates.

**Mistake 6 — Conflating execution parallelism with logical parallelism**
The model decides logical parallelism (can I fetch these together?). The application decides execution parallelism (do I run these concurrently?). Both are independent choices. The runner can execute tools sequentially (simpler, easier to reason about) while still correctly handling a parallel tool call from the model. Don't conflate the two: the model's `tool_calls` array length determines how many results to append, that's logic. Whether those tool functions run with `await` in sequence or `Promise.all()` in parallel is a performance optimization, not a correctness requirement.

**Mistake 7 — Not accounting for tool definition token cost**
Each tool schema consumes tokens on every API call, whether or not the tool is used. With large registries and detailed schemas, tool definitions can consume a significant portion of the context budget. Measure `usage.input_tokens` with and without tools registered. Lean descriptions that still produce correct routing behavior are worth the investment as tool registries grow.

---

## Key Takeaways

- Multiple tools require descriptions that function as a routing table, each description must clearly delineate when to use that tool and not another. Overlapping descriptions produce inconsistent routing (Experiment 6)
- Parallel tool calls produce one assistant message with multiple `tool_calls` entries. The iteration loop must complete fully before making the second API call, appending all results first is the only valid sequence (Experiments 2, 4)
- Every `tool_call_id` in the assistant message must have a corresponding `tool` result message before the next API call. A broken loop on failure leaves unresolved IDs and corrupts history. The try/catch must be inside the loop, not around it (Experiment 5)
- Parallel calls occur when targets are known and independent. Unknown targets (e.g. "warmest city") require sequential reasoning, the model must determine the target before it can call the retrieval tool. This distinction is the foundation of Phase 4's ReAct pattern (Experiment 3)
- Returning structured error JSON from a failed tool keeps history intact and lets the model compose a partial response. Throwing corrupts the `tool_calls` / `tool` pairing and makes history unrecoverable without a full rollback (Experiment 5)
- Tool definition schemas consume tokens on every API call regardless of whether the tool runs. In large registries, definition overhead becomes a real context budget line item (Concept section)
- The runner's loop is the same as Phase 2.1, the difference is that it now actually iterates more than once. All Phase 2.2 complexity comes from correctly handling that iteration under multiple outcomes (all succeed, partial failure, all fail) (Experiments 2–5)

---

## Next Up

**Phase 2.3 — Human-in-the-Loop Tool Use**
Pause execution between the model's tool call decision and the actual execution. Let the user review the tool name and arguments, then confirm or reject. Understand why this matters for safety-critical actions, and what to send back to the model when an execution is rejected mid-loop.

---

*AI Playground · Built to learn, not to ship.*
