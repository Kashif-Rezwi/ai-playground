# Phase 2.1 — Single Tool Calling

> **AI Playground Series** · Phase 2 · Tool Use & Function Calling

---

## What Is This?

In Phase 1, the model received a prompt and returned text. That's a knowledge lookup. The model draws on what it learned during training and generates a response. It cannot take actions, check current information, run calculations with guaranteed accuracy, or interact with any external system.

Tool calling changes this. It gives the model the ability to **request the execution of external functions** and use the results in its final response. The model doesn't run code itself, it asks the application to run something, then waits for the result before continuing.

This is the architectural shift from **chatbot** to **agent**.

Phase 2.1 strips tool calling down to its simplest possible form: one tool, one turn, the complete loop made fully transparent. No multi-tool routing, no parallel calls, no human approval gates. Just the raw request → tool_call → tool_result → response cycle, observed from every angle.

---

## Concept Deep Dive

### Why Tool Use Exists

LLMs are trained on static data with a knowledge cutoff. They cannot:
- Know what the current time or weather is
- Access a live database or API
- Run code with guaranteed correct output
- Take actions in external systems (send emails, write files, call services)

Tool use solves this by giving the model a **defined interface** to request things it cannot do itself. The model identifies when it needs external data, emits a structured tool call, and waits for the result before generating its final response.

The important framing: **the model doesn't execute tools.** It describes what it wants to call and with what arguments. The application decides whether and how to actually execute it. This separation is why tool use is safe to build on incrementally, the developer controls execution entirely.

---

### The Tool Definition Schema

Before making any API call, a set of available tools must be defined. Each tool is a JSON Schema object that tells the model:
- What the tool is called (`name`)
- What it does and when to use it (`description`)
- What arguments it accepts (`parameters`)

```typescript
{
    type: "function",
    function: {
        name: "get_weather",
        description: "Get the current weather conditions for a specific city. Use this whenever the user asks about weather, temperature, or current conditions — never guess at weather data.",
        parameters: {
            type: "object",
            properties: {
                city: {
                    type: "string",
                    description: "The name of the city, e.g. 'London', 'Tokyo', 'New York'"
                },
                unit: {
                    type: "string",
                    description: "Temperature unit",
                    enum: ["celsius", "fahrenheit"]
                }
            },
            required: ["city"],
            additionalProperties: false
        }
    }
}
```

A few things to notice here:

**The description is load-bearing.** The model's decision about whether to call a tool comes entirely from reading its `name` and `description`. A vague description produces unpredictable call behavior. A precise description including explicit guidance like "never guess at weather data" produces reliable behavior. This is the single most important thing to get right when defining tools.

**Parameters use JSON Schema.** The same JSON Schema concepts from Phase 1.4 apply here. `required` is an array of field names, `enum` restricts values, `additionalProperties: false` prevents the model from inventing extra fields.

**`unit` is optional.** When a field is not in `required`, the model may or may not include it depending on what the user specified. The implementation must handle both cases.

---

### The Tool Call Loop

This is the core of Phase 2.1. Every tool call interaction follows the same four-step pattern, and it always requires at least **two API calls**, never one.

```
Step 1 — Initial request
  Application → API
    messages: [system, user, ...history]
    tools: [tool_definitions]
    tool_choice: "auto"

Step 2 — Model decides to call a tool
  API → Application
    finish_reason: "tool_calls"
    message.tool_calls: [{ id, name, arguments }]
    message.content: null  ← expected, not an error

Step 3 — Application executes the tool
  Application runs the tool function with parsed arguments
  Appends two messages to history:
    { role: "assistant", content: null, tool_calls: [...] }  ← the model's decision
    { role: "tool", tool_call_id: id, content: result_json } ← the tool's output

Step 4 — Second API call with tool results
  Application → API
    messages: [system, user, assistant+tool_calls, tool_result]
  API → Application
    finish_reason: "stop"
    message.content: "final human-readable response"
```

The most common misunderstanding is thinking this is a single round-trip. It is not. Every tool call adds at minimum one additional API call. In a loop with multiple tool calls across multiple turns, API calls accumulate quickly.

---

### New Message Roles

Phase 1 worked with three roles: `system`, `user`, `assistant`. Tool calling introduces a fourth: **`tool`**.

Here is what the conversation history looks like after a single tool call turn:

```typescript
// Before the turn
[
    { role: "system", content: "You are a weather assistant..." },
    { role: "user", content: "What's the weather in London?" }
]

// After the turn (four messages added)
[
    { role: "system", content: "You are a weather assistant..." },
    { role: "user", content: "What's the weather in London?" },

    // Step 2: assistant's tool call decision
    {
        role: "assistant",
        content: null,                    // ← null is valid and expected here
        tool_calls: [{
            id: "call_abc123",
            type: "function",
            function: {
                name: "get_weather",
                arguments: '{"city":"London","unit":"celsius"}'  // ← JSON *string*, not an object
            }
        }]
    },

    // Step 3: tool result
    {
        role: "tool",
        tool_call_id: "call_abc123",      // ← must match the id above
        content: '{"city":"London","temperature":14,"condition":"overcast","humidity":78,"wind_speed":18,"unit":"celsius"}'
    },

    // Step 4: final assistant response
    {
        role: "assistant",
        content: "The weather in London is currently 14°C and overcast, with 78% humidity and winds at 18 km/h."
    }
]
```

Three things to internalize from this structure:

**`content: null` is valid.** When the assistant chooses to call a tool, it may have nothing to say as text. The SDK and the API both accept `null` here. Treating it as an error is a common bug.

**`arguments` is a JSON string.** Not a parsed object, a raw string that happens to contain JSON. The model serializes it. The application must call `JSON.parse()` before using the arguments. This is intentional: it creates a clean serialization boundary between the model's world and the application's world.

**`tool_call_id` must match.** The `tool` message must include the `tool_call_id` from the corresponding `tool_calls` entry. If they don't match, the API will reject the conversation history. This matters in Phase 2.2 when multiple tool calls happen in parallel.

---

### How the Model Decides When to Call a Tool

The model reads the tool definitions and decides at inference time whether the user's request warrants a tool call. It considers:

1. **The user's intent** — does the question require information the model cannot know?
2. **The tool's description** — does the description signal this is the right tool for this situation?
3. **The `tool_choice` parameter** — is the model being forced or prevented?

`tool_choice` has four possible values:

| Value | Behavior |
|---|---|
| `"auto"` | Model decides. Default. Use this almost always. |
| `"required"` | Model must call at least one tool, no direct answers allowed. |
| `"none"` | Model cannot call any tools, must answer directly. |
| `{ type: "function", function: { name: "..." } }` | Force a specific tool. |

`"auto"` is almost always the right choice. `"required"` is useful when testing tool definitions or building pipelines where tool execution is always expected. `"none"` lets the same tool-aware system also answer general questions without refactoring the API call.

---

### Finish Reason: The Branching Signal

After the first API call, the application branches based on `finish_reason`:

```typescript
const finishReason = response.choices[0].finish_reason;

if (finishReason === "tool_calls") {
    // Execute tools, build tool result messages, make second API call
} else {
    // finishReason === "stop" — model answered directly, no tool needed
}
```

`"tool_calls"` means the model produced one or more tool call requests in `message.tool_calls`. `"stop"` means the model answered the question directly with text content. This is the only branching condition needed for Phase 2.1.

---

### What Happens When the Model Answers Directly

Not every message triggers a tool call. If the user asks a general question that doesn't require the weather tool, the model answers directly and `finish_reason` is `"stop"`. The history in this case is simple: user message, then assistant message with content. No tool messages, no second API call.

This means the same REPL loop handles both paths:
- Tool call path: two API calls, four new messages appended to history
- Direct answer path: one API call, one message appended to history

The branching logic in the runner makes this explicit.

---

### Tool Result Format

The content of the `tool` message must be a **string**. The model will parse whatever is sent, so the format matters. Two conventions are common:

**JSON string (preferred):** Serialize the result to JSON. The model handles structured data well and can extract specific fields in its final response. Always use `JSON.stringify()`.

**Error as JSON:** When a tool fails, return an error as a JSON string so the model can communicate the failure gracefully: `JSON.stringify({ error: "City not found" })`. Never throw, a thrown error crashes the runner. Catch inside the tool function and return a structured error.

---

## What This App Builds

A CLI weather agent that demonstrates the complete single tool call loop:

1. One registered tool: `get_weather(city, unit?)` with a mock implementation (no external API key required)
2. A `runner.ts` module that encapsulates the full tool call loop, first API call, tool detection, execution, and second API call, returned as a single promise
3. A REPL chat loop that calls the runner and logs all intermediate state: `finish_reason`, tool name, raw arguments, tool result
4. Transparent history inspection via the `history` command so the full message array is visible after any turn
5. Both the "tool called" and "tool not called" paths observable in the same session, ask a weather question and a general question back to back

No external API required. No streaming (that's a Phase 2 enhancement to add later). No parallel tool calls (that's Phase 2.2). Just one tool, fully transparent, end to end.

---

## File Structure

```
services/single-tool-calling/
├── package.json
├── tsconfig.json
├── docs/
│   └── single-tool-calling.md
└── src/
    ├── chat.ts           ← REPL loop, entry point
    ├── config.ts         ← MODEL, MAX_RESPONSE_TOKENS, SYSTEM_PROMPT
    ├── types.ts          ← Message, ToolCall, ToolDefinition types
    ├── runner.ts         ← The two-call tool loop (core logic)
    └── tools/
        ├── index.ts      ← Tool dispatcher (name → function)
        ├── definitions.ts ← Tool schemas (OpenAI format)
        └── weather.ts    ← Mock weather implementation
```

The `runner.ts` separation is intentional. It keeps the tool call loop as a pure, importable function no readline, no REPL concerns. This makes it composable: Phase 2.2 will extend the runner, Phase 2.3 will wrap it with confirmation gates, Phase 2.4 will swap in real API implementations.

---

## What This Covers

By completing this mini-app:

- [x] Understanding why tool use exists and what it enables beyond text generation
- [x] Knowing the structure of a tool definition (name, description, parameters)
- [x] Understanding why the tool description is the single most important field
- [x] Knowing all four steps of the tool call loop and why at least two API calls are required
- [x] Understanding the `tool` message role and its `tool_call_id` requirement
- [x] Knowing why `content: null` on an assistant message is valid and expected
- [x] Understanding why `arguments` is a JSON string, not a parsed object
- [x] Knowing when to use `tool_choice: "auto"` vs `"required"` vs `"none"`
- [x] Observing the `finish_reason: "tool_calls"` vs `"stop"` branching in real time
- [x] Handling tool errors gracefully without crashing the runner

---

## Experiments to Run

Once the app is working, run each of these deliberately. Each one surfaces a specific concept from this phase.

---

### Experiment 1 — Tracing the Complete Loop
**Covers:** All four steps of the tool call loop, history structure, new message roles

**Setup:** Start the app with default config. `tool_choice` is `"auto"`.

**Steps:**
1. Send: `"What's the weather like in Tokyo right now?"`
2. Watch the `[LOOP] finish_reason: "tool_calls"` log
3. Watch the `[TOOL] Executing: get_weather(...)` and `[TOOL] Result: ...` logs
4. After the response arrives, type `history` and inspect the full message array

**What to observe:**
- How many messages are in history after this one turn? (Answer: 5 - system + user + assistant-with-tool-calls + tool-result + final-assistant)
- What does the assistant message at index 2 look like? Is `content` null? What's in `tool_calls`?
- What does the tool message at index 3 look like? What is `tool_call_id` set to?
- What does the final assistant message at index 4 look like? How does it use the tool data?

**Expected insight:** A single conversational turn that involves a tool call results in four messages added to history, not one. The model's "decision" (index 2) and the tool's "answer" (index 3) both live in history permanently. This matters for context budget management in long conversations with frequent tool calls.

---

### Experiment 2 — Tool vs Direct: The Decision Boundary
**Covers:** `finish_reason` branching, `tool_choice: "auto"` behavior, model reasoning

**Setup:** Alternate between questions that should and should not trigger the tool. Watch the `[LOOP] finish_reason:` log on every turn.

**Steps:**
1. Send: `"What's the weather in Sydney?"` → watch `finish_reason`
2. Send: `"What's the capital of Australia?"` → watch `finish_reason`
3. Send: `"Is it hot in Dubai right now?"` → watch `finish_reason`
4. Send: `"Explain how rainbows form."` → watch `finish_reason`
5. Send: `"I'm heading to Moscow tomorrow — what should I pack?"` → watch `finish_reason`

**What to observe:**
- Does the model call the tool for question 1 but not question 2?
- Does question 3 ("Is it hot in Dubai right now?") trigger a tool call? Does the word "right now" influence the decision?
- Does question 5 trigger a tool call even though the phrasing is indirect?
- Compare the number of messages added to history after a tool-call turn vs a direct-answer turn

**Expected insight:** `tool_choice: "auto"` gives the model real judgment. It doesn't call the tool for geography questions it knows the answer to, only for current weather data it cannot know. The phrase "right now" reliably triggers tool use because it signals recency. Indirect phrasings like "what should I pack" are context-dependent, the model infers the user wants weather data to decide.

---

### Experiment 3 — Inspecting the Raw Tool Call Message
**Covers:** `assistant` message structure when `finish_reason === "tool_calls"`, `content: null`, raw argument string

**Setup:** Add a temporary `console.log(JSON.stringify(assistantMessage, null, 2))` in `runner.ts` after receiving the first API response, before executing tools. Remove it after.

**Steps:**
1. Send: `"Weather in London please, in fahrenheit"`
2. Inspect the logged assistant message structure
3. Find: `content`, `tool_calls[0].id`, `tool_calls[0].function.name`, `tool_calls[0].function.arguments`
4. Check the type of `tool_calls[0].function.arguments` with a `typeof` check is it a string or an object?
5. Now run the same prompt without the `typeof` check and instead try `toolCall.function.arguments.city` directly, what happens?

**What to observe:**
- Is `content` exactly `null` or an empty string?
- Is `tool_calls[0].function.arguments` a JSON string or a parsed object? What does it look like raw?
- What happens when treating `arguments` as an object and accessing `.city` directly?

**Expected insight:** The assistant message has `content: null` not an empty string. These are different values and checking `if (!assistantMessage.content)` would incorrectly catch both. `arguments` is always a raw JSON string, never an object. Treating it as one causes a silent undefined access, no error thrown, just `undefined` values. `JSON.parse()` is not optional.

---

### Experiment 4 — Optional vs Required Arguments
**Covers:** How the model populates optional parameters, schema `required` vs omitted fields

**Setup:** The `unit` parameter is optional (not in `required`). The `city` parameter is required.

**Steps:**
1. Send: `"What's the weather in Cape Town?"` after the tool executes, type `history` and find `tool_calls[0].function.arguments`
2. Send: `"What's the weather in Cape Town in fahrenheit?"` check `arguments` again
3. Send: `"What's the temperature in Cape Town?"` does "temperature" hint differently than "weather"?
4. Now temporarily add `unit` to `required` in `definitions.ts`. Restart and send the first prompt again what does the model default to?

**What to observe:**
- When `unit` is not in `required` and the user doesn't specify it, does `arguments` include `unit` or not?
- When the user says "in fahrenheit", does `arguments` include `"unit":"fahrenheit"`?
- When `unit` is forced required, what does the model default to when the user doesn't specify?

**Expected insight:** The model only includes optional parameters in `arguments` when they are contextually relevant or explicitly mentioned. Making a parameter required forces the model to always include it, filling in a sensible default from the description. This is the primary lever for controlling argument completeness, the description for the optional param should explain what a missing value means so the tool implementation can handle it gracefully.

---

### Experiment 5 — `tool_choice` Forcing
**Covers:** `tool_choice: "auto"` vs `"required"` vs `"none"`, practical use cases

**Setup:** In `runner.ts`, change `tool_choice` from `"auto"` to `"required"` and restart.

**Steps:**
1. Send: `"What's the capital of France?"` observe what happens with `tool_choice: "required"`
2. Send: `"What's the weather in Paris?"` compare to normal behavior
3. Change `tool_choice` to `"none"` and restart
4. Send: `"What's the weather in Paris?"` observe the model's behavior without tool access
5. Restore `tool_choice: "auto"` when done

**What to observe:**
- With `"required"`, does the model call the weather tool when answering a geography question? What arguments does it pass?
- Does forcing a tool call when not needed produce useful or confusing results?
- With `"none"`, does the model acknowledge it can't check current weather, or does it guess?
- Compare `finish_reason` across all three modes for the same weather prompt

**Expected insight:** `"required"` forces a tool call even when the model wouldn't choose one, which often means the model invents a plausible city or passes empty arguments. It's useful for testing tool definitions in isolation but harmful in production. `"none"` lets the model reveal what it would say without tool access, useful for testing fallback behavior. `"auto"` is the correct default for real agent behavior.

---

### Experiment 6 — Tool Error Handling
**Covers:** Returning errors from tools, model communication of failures, graceful degradation

**Setup:** Temporarily modify `weather.ts` to return an error JSON for a specific city.

**Steps:**
1. In `weather.ts`, add this at the top of `getWeather()`:
   ```typescript
   if (args.city.toLowerCase() === "atlantis") {
       return { error: "City not found in weather database", city: args.city };
   }
   ```
2. Send: `"What's the weather in Atlantis?"`
3. Watch the `[TOOL] Result:` log what did the tool return?
4. Read the model's final response how does it communicate the error to the user?
5. Now try throwing instead of returning: `throw new Error("City not found")` what happens to the runner?
6. Revert both changes when done

**What to observe:**
- When the tool returns `{ error: "..." }` JSON, does the model communicate the failure gracefully?
- Does the model make up weather data for Atlantis, or does it correctly relay the error?
- When throwing instead of returning, does the runner crash? Is the conversation history left in a valid state?
- Compare the history after an error-return turn vs a throw turn, which state is recoverable?

**Expected insight:** Tools should never throw. A thrown error crashes the runner mid-turn, leaving an assistant message with `tool_calls` appended to history but no corresponding `tool` result message, this breaks the alternating structure and causes the next API call to fail with a history validation error. Returning structured error JSON instead lets the model communicate the failure naturally and keeps history intact. Error handling belongs inside the tool function, not above it.

---

## Common Mistakes to Avoid

**Mistake 1 — Treating `arguments` as a parsed object**
`toolCall.function.arguments` is always a raw JSON string. Accessing `.city` directly returns `undefined` silently, no error. Always `JSON.parse(rawArgs)` before using arguments, and wrap it in a try/catch in case the model emits malformed JSON.

**Mistake 2 — Not appending the assistant tool_call message before the tool result**
The history sequence must be: assistant-with-tool-calls → tool-result. Skipping the assistant message and appending only the tool result causes an API error on the second call ("tool result references an unknown tool_call_id"). The assistant decision and the tool result are paired by `tool_call_id`, both must be in history.

**Mistake 3 — Forgetting `tool_call_id` on the tool result message**
The `tool` message must include `tool_call_id` matching the `id` from the corresponding `tool_calls` entry. Missing or mismatched IDs cause a validation error on the second API call. In Phase 2.2 with parallel tool calls, this requires careful iteration, each tool result must reference its own call ID.

**Mistake 4 — Checking `content` with a falsy check**
`assistantMessage.content` is `null` when the model calls a tool, not an empty string. `if (!content)` evaluates to `true` for both `null` and `""`. Check `finish_reason === "tool_calls"` instead of inspecting `content` to detect the tool call branch.

**Mistake 5 — Throwing errors inside tool functions**
A thrown error breaks the runner and leaves history in an invalid state. The assistant message with `tool_calls` is appended before the throw, but the corresponding `tool` result never gets appended. The next API call fails because history ends on an assistant message with unresolved tool_calls. Always catch errors inside tool functions and return structured error JSON.

**Mistake 6 — Assuming one API call is enough**
Every tool call requires a minimum of two API calls, one to get the tool call decision, one to get the final response. In a multi-turn conversation with frequent tool calls, API costs accumulate faster than expected. Budget accordingly.

**Mistake 7 — Neglecting `additionalProperties: false` in the schema**
Without it, the model can invent extra fields in its arguments. These pass `JSON.parse()` silently but may break tool functions expecting only the defined parameters. Always include `additionalProperties: false` in every tool's `parameters` schema.

**Mistake 8 — Writing a vague tool description**
The model's decision to call (or not call) a tool comes entirely from reading the `description`. "Gets weather data" will produce inconsistent behavior. 

For example: "Get the current weather conditions for a specific city. Use this whenever the user asks about weather, temperature, or current conditions, never guess at weather data." 

This is precise and produces reliable behavior. The description is not metadata, it is the model's decision boundary.

---

## Key Takeaways

- Tool calling is a two-API-call minimum. The first call gets the tool call decision, the second gets the final response after execution. This is structural, not an optimization to avoid (Experiment 1)
- `finish_reason: "tool_calls"` is the only branching signal needed. Don't inspect `content` for null to detect tool calls check `finish_reason` (Common Mistake 4)
- `arguments` is always a JSON string. `JSON.parse()` is always required. Accessing fields directly returns `undefined` silently (Experiment 3)
- The `tool` message's `content` must be a string. Return `JSON.stringify(result)` for success and `JSON.stringify({ error: "..." })` for failure. Never throw inside a tool function (Experiment 6)
- `tool_call_id` ties the assistant decision to the tool result. The IDs must match exactly, the API validates this (Common Mistake 3)
- The tool description is the model's decision boundary. It determines when the model calls vs skips the tool. Vague descriptions produce unpredictable behavior; precise descriptions with explicit guidance produce consistent behavior (Experiment 2)
- Optional parameters appear in `arguments` only when contextually relevant. The `required` array forces inclusion. Handle missing optional fields gracefully in the tool function (Experiment 4)
- `tool_choice: "auto"` is the correct default for real agent behavior. `"required"` and `"none"` are testing and debugging tools, not production settings (Experiment 5)

---

## Next Up

**Phase 2.2 — Multi-Tool Calling**
Register multiple tools. Let the model choose which one(s) to call. Understand parallel tool calls where the model returns multiple `tool_calls` in a single response, and the iteration pattern required to handle them. Observe how the model reasons about which tool to use when several are available.

---

*AI Playground · Built to learn, not to ship.*
