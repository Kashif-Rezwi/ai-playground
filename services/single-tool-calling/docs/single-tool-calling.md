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

---

## Experiments to Run

---

## Common Mistakes to Avoid

---

## Key Takeaways

---

## Next Up

**Phase 2.2 — Multi-Tool Calling**
Register multiple tools. Let the model choose which one(s) to call. Understand parallel tool calls where the model returns multiple `tool_calls` in a single response, and the iteration pattern required to handle them. Observe how the model reasons about which tool to use when several are available.

---

*AI Playground · Built to learn, not to ship.*
