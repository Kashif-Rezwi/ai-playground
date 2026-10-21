# Phase 2.3 — Human-in-the-Loop Tool Use

> **AI Playground Series** · Phase 2 · Tool Use & Function Calling

---

## What Is This?

In Phase 2.1, the model learned how to request one tool. In Phase 2.2, it learned how to choose from a registry and request multiple tools in a single response.

Those services execute every valid tool call immediately. That is acceptable for mock weather data, but unsafe for actions such as sending email, changing permissions, deleting records, creating infrastructure, or spending money.

Human-in-the-loop tool use adds an approval boundary between the model's request and the application's execution of that request.

The model decides which tool it wants to use and which arguments it wants to provide. The application decides whether the tool is allowed to run. A human supplies the final decision for operations that require confirmation.

This phase explores that boundary with an HTTP travel assistant, mock tools, a pending/resume approval workflow, SSE events, and multi-tool decisions. The CLI remains an adapter over the service so that human interaction does not become part of the orchestration logic.

---

## Concept Deep Dive

### A Tool Call Is Intent, Not Permission

A tool definition is an interface exposed to the model. It is not an authorization grant.

```typescript
{
    type: "function",
    function: {
        name: "convert_currency",
        description: "Convert an amount from one currency to another.",
        parameters: {
            type: "object",
            properties: {
                amount: { type: "number" },
                from_currency: { type: "string" },
                to_currency: { type: "string" }
            },
            required: ["amount", "from_currency", "to_currency"],
            additionalProperties: false
        }
    }
}
```

When the model returns a tool call, the application must still:

1. Check that the tool exists
2. Parse and validate the arguments
3. Apply the approval policy
4. Show the human what will happen
5. Record the decision
6. Execute only after approval
7. Return a result or structured rejection

Never treat a valid model tool call as an authorization decision.

### The Approval Boundary

The tool loop becomes:

```text
User message
    |
Model returns assistant tool_calls
    |
Application validates calls
    |
Application appends assistant tool-call message
    |
Human approves or rejects each call
    |
Application executes approved calls
    |
Application creates one result for every call
    |
Model receives results and produces the final answer
```

The approval gate belongs after the assistant tool-call message is recorded and before any tool executes.

The first invariant is:

> No tool with side effects may execute before its approval decision is recorded as approved.

The second invariant is inherited from Phase 2.2:

> Every model-issued `tool_call_id` must receive exactly one matching `tool` result message before the next model request.

That rule applies to rejected, expired, malformed, and failed calls as well as successful calls.

### Why HTTP Approval Is Two-Step

A CLI can pause for `readline` input. An HTTP request should not wait indefinitely for a human decision.

The service therefore separates starting a run from deciding an approval:

```text
POST /api/chat/generate
        |
        v
pending_approval response
        |
        +--> GET /api/chat/runs/:runId
        |
        +--> POST /api/chat/approvals/:approvalId/approve
        |
        +--> POST /api/chat/approvals/:approvalId/reject
```

This avoids abandoned requests, proxy timeouts, and accidental duplicate execution. The learning service keeps pending records in memory; a production system would persist them or hand them to a durable workflow worker.

### Run States

Use explicit states rather than inferring state from nullable fields:

| State              | Meaning                                                                      |
| ------------------ | ---------------------------------------------------------------------------- |
| `running`          | The service is making a model request or executing approved work.            |
| `pending_approval` | One or more tool calls are waiting for human decisions.                      |
| `completed`        | The model produced a final answer.                                           |
| `rejected`         | At least one call was rejected and the model resumed with rejection results. |
| `failed`           | The run failed due to an API, validation, or internal error.                 |
| `cancelled`        | The run was intentionally stopped before completion.                         |
| `expired`          | An approval remained undecided beyond its configured lifetime.               |

A rejected tool call does not necessarily fail the whole run. The model receives a structured rejection result and may still produce a useful answer.

### Rejection Is a Tool Result

A rejected call must not disappear from history:

```typescript
conversationHistory.push({
  role: 'tool',
  tool_call_id: toolCall.id,
  content: JSON.stringify({
    status: 'rejected',
    reason: 'The user rejected this tool call.',
  }),
});
```

This keeps history valid and lets the model explain what happened. Throwing for an ordinary rejection makes a user decision look like an infrastructure failure and can leave unresolved tool calls.

### Multi-Tool Approval

A model response may contain several calls:

```text
assistant tool_calls:
  call_1 -> get_weather
  call_2 -> get_time
  call_3 -> convert_currency
```

Review the complete batch before executing any call. Store one decision per call and resume only after every call has a terminal decision. Results must be appended in the original model order, regardless of the order in which humans respond.

Start with sequential execution. Physical parallel execution is an optional optimization and must preserve result ordering, idempotency, and exactly-once behavior.

### Approval Preview and Safety

An approval preview should show the approval ID, run ID, tool name, validated arguments, creation time, expiration time, and current status. Rendering the preview must not execute the tool.

Validation is not execution. A valid argument object still needs an approval decision. Sensitive arguments should be redacted, and approval/run IDs should be opaque.

### Idempotency

HTTP clients retry and users double-click. Approval endpoints must therefore be idempotent:

- A pending call transitions to `approved` or `rejected` once
- Repeating the same decision returns the recorded state
- A later opposite decision cannot reverse a terminal decision
- The executor has one authoritative execution boundary

An in-memory status check demonstrates the concept for this phase. It is not sufficient for multiple processes without shared storage or locking.

### SSE Is a Notification Channel

SSE can report live state transitions:

```text
event: run_started
data: {"runId":"run_123"}

event: approval_required
data: {"approvalId":"approval_456","toolCalls":[...]}
event: approval_decided
data: {"approvalId":"approval_456","decision":"approved"}
event: tool_result
data: {"toolCallId":"call_abc123","status":"success"}
event: completed
data: {"runId":"run_123","answer":"..."}
event: done
data: {}
```

SSE does not make state durable. If the connection closes while approval is pending, the client should query run status and reconnect or poll. The approval record remains the source of truth.

---

## What This App Builds

An HTTP travel assistant with three harmless mock tools:

1. `get_weather(city, unit?)` — returns mock current conditions
2. `get_time(city)` — returns mock local time
3. `convert_currency(amount, from_currency, to_currency)` — returns a mock exchange rate

The completed service demonstrates:

- Direct answers with no tool call
- Single tool calls that pause for approval
- Approved execution followed by a final model response
- Rejected calls represented as structured tool results
- Multiple tool calls reviewed as one pending batch
- Different decisions for calls in the same batch
- SSE events for a live client
- Run-status lookup after an SSE disconnect
- A final CLI adapter over the same service

State is process-local and disappears when the Node.js process restarts. External APIs and real side effects belong to Phase 2.4.

---

## File Structure

```text
services/_2_3_human-in-the-loop-tool-use/
├── package.json
├── tsconfig.json
├── docs/
│   ├── human-in-the-loop-tool-use.md
│   └── human-in-the-loop-tool-use-guide.md
├── src/
│   ├── cli.ts                         <- terminal adapter
│   ├── server.ts
│   ├── controllers/
│   │   └── chat.controller.ts
│   ├── routes/
│   │   ├── chat.route.ts
│   │   └── health.route.ts
│   ├── services/
│   │   ├── approval.service.ts        <- pending state and decisions
│   │   ├── chat.service.ts             <- model/tool orchestration
│   │   └── llm.service.ts
│   ├── tools/
│   │   ├── registry.ts
│   │   ├── weather.ts
│   │   ├── time.ts
│   │   └── currency.ts
│   └── utils/
│       ├── config.ts
│       ├── prompts.ts
│       ├── tool-loop.ts
│       └── types.ts
└── test/
    ├── approval.service.test.ts
    ├── chat.service.test.ts
    └── tool-loop.test.ts
```

The service boundaries should remain clear:

- Routes map URLs to controllers
- Controllers validate input and format HTTP/SSE responses
- Chat service owns model orchestration
- Approval service owns pending decisions and state transitions
- Registry owns tool lookup, argument validation, and execution
- CLI owns readline and terminal presentation

---

## What This Covers

By completing this mini-app, you will understand:

- [ ] Why model tool calls are requests, not permissions
- [ ] Where a human approval gate belongs in a tool loop
- [ ] Why HTTP approval should be a pending/resume workflow
- [ ] How to represent approval state explicitly
- [ ] How to keep CLI input outside the service layer
- [ ] How SSE reports events without owning durable state
- [ ] How to approve or reject individual calls in a multi-tool batch
- [ ] Why every `tool_call_id` needs exactly one result
- [ ] How structured rejection results preserve valid model history
- [ ] How to prevent duplicate tool execution
- [ ] How expiration and cancellation affect pending work
- [ ] How to test safety properties instead of only final text output

---

## Experiments to Run

### Experiment 1 — Direct Answer Versus Approval

Ask a general question, then ask for the weather in Tokyo. Compare the response statuses and history. Direct answers complete immediately; tool requests enter an intermediate state.

### Experiment 2 — Prove No Execution Before Approval

Add a counter to a mock tool. Start a tool request and verify the counter is unchanged while approval is pending. Reject it and verify it remains unchanged. Approve a second request and verify the counter increments exactly once.

### Experiment 3 — Approval, Rejection, and History

Approve one call and reject another. Inspect the `tool` messages and verify that both have matching `tool_call_id` values and that the rejection is structured JSON.

### Experiment 4 — SSE Event Ordering

Start an SSE run with `curl -N`, trigger a tool call, approve it from a second HTTP request, and verify the event sequence ends with `completed` and `done`. Disconnect before approval and use run status to confirm the approval remains pending.

### Experiment 5 — Mixed Multi-Tool Decisions

Request weather and local time together. Approve the weather call, reject the time call, and verify that the run resumes only after both decisions are terminal. Inspect that result order follows the model's original call order.

### Experiment 6 — Duplicate Approval Requests

Send the same approval request twice and inspect the execution counter. The tool must execute once, and the second request must return the recorded terminal state.

### Experiment 7 — Expired Approval

Configure a short approval timeout, let a pending call expire, then try to approve it. The late approval must not execute the tool.

### Experiment 8 — One Failed Tool in an Approved Batch

Make one approved mock tool return structured error JSON. Confirm every call still produces a result and that a follow-up conversation remains usable.

### Experiment 9 — Process Restart

Create a pending approval, restart the process, and query it. The state is intentionally lost because this phase uses in-memory storage.

---

## Common Mistakes to Avoid

**Mistake 1 — Putting `readline` inside `chat.service.ts`**  
Keep human I/O in adapters. The service must work over HTTP, SSE, tests, and CLI.

**Mistake 2 — Holding the original HTTP request open for approval**  
Return a pending state and resume through a separate decision request.

**Mistake 3 — Executing while creating the approval preview**  
Parsing and validating arguments is not execution. The preview path must be side-effect free.

**Mistake 4 — Treating tool availability as authorization**  
A tool in the `TOOLS` array is visible to the model, not automatically approved.

**Mistake 5 — Dropping rejected tool calls**  
Every model-issued call needs exactly one matching result.

**Mistake 6 — Resuming after only part of a batch is decided**  
Wait until every call has a terminal decision.

**Mistake 7 — Appending results in click order**  
Append results in the original `tool_calls` order.

**Mistake 8 — Allowing duplicate approval requests to execute twice**  
Record a terminal decision before execution and make repeated requests idempotent.

**Mistake 9 — Treating SSE as durable state**  
SSE is a view of state transitions. Run and approval records are the source of truth.

**Mistake 10 — Adding real external side effects too early**  
Use mock tools in this phase. External APIs belong in Phase 2.4.

**Mistake 11 — Adding the CLI before the service contract is stable**  
The CLI should expose the service, not define its orchestration behavior.

---

## Key Takeaways

- A model tool call is intent, not authorization.
- The application must validate and approve before executing.
- HTTP approval should be a pending/resume workflow.
- SSE is useful for live events, but it is not durable state.
- Every tool call, including a rejection, needs a matching result message.
- Multi-tool approval must resolve the complete batch before the model continues.
- Exactly-once execution and idempotent decisions matter as much as the final answer.
- Process-local state is useful for learning but insufficient for production recovery.
- The CLI should be a final adapter over a transport-neutral service.
- Real external side effects should wait until the approval mechanics are complete.

---

## Running the Service

From the repository root, run the service or its terminal adapter:

```bash
npm run dev --workspace human-in-the-loop-tool-use
npm run cli --workspace human-in-the-loop-tool-use
```

See the separate [human-in-the-loop-tool-use-guide.md](human-in-the-loop-tool-use-guide.md) for a detailed build walkthrough.

---

## Next Up

**Phase 2.4 — Tool Use with External APIs**  
Replace the mock tools with real integrations. Add provider errors, retries, result sanitization, rate limits, and the additional security concerns that appear when approved tools interact with external systems.

---

_AI Playground · Built to learn, not to ship._
