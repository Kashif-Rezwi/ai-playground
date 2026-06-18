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

---

## Experiments to Run

---

## Common Mistakes to Avoid

---

## Key Takeaways

---

## Next Up

**Phase 2.3 — Human-in-the-Loop Tool Use**
Pause execution between the model's tool call decision and the actual execution. Let the user review the tool name and arguments, then confirm or reject. Understand why this matters for safety-critical actions, and what to send back to the model when an execution is rejected mid-loop.

---

*AI Playground · Built to learn, not to ship.*
