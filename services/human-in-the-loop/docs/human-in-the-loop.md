# Phase 2.3 — Human-in-the-Loop Tool Use

> **AI Playground Series** · Phase 2 · Tool Use & Function Calling

---

## What Is This?

Phases 2.1 and 2.2 treated tool execution as automatic. The model decides to call a tool, the application executes it, the result goes back to the model. Fast, clean, fully autonomous.

But autonomous execution assumes something that most production tools cannot guarantee: that the action is **reversible**.

Getting the current weather is reversible in a meaningful sense because if the tool runs unnecessarily, nothing is harmed. But sending an email is not reversible. Neither is deleting a file, submitting a payment, booking a calendar invite, posting to social media, or making any call that modifies state in the outside world. If the model misunderstands the request, halluccinates arguments, or is manipulated into calling a tool it shouldn't, the consequences are real and potentially unrecoverable.

Human-in-the-loop (HITL) tool use inserts a confirmation gate between the model's decision and the application's execution. The model says what it wants to do. The user sees it, reads the proposed arguments, and decides whether to let it happen. Only with explicit approval does the tool actually run.

This phase builds that gate and explores every edge case it introduces: what the model receives when a call is rejected, how partial approval works in parallel call scenarios, and how to design a tool registry that routes some tools through the confirmation gate and others directly to execution.

---

## Concept Deep Dive

### Why Tool Execution Is Not Equivalent to Tool Decision

The model does not execute tools. It requests them. This distinction from Phase 2.1 becomes architecturally important here.

Because execution is the application's responsibility, the application has full authority to decide whether, when, and how to honour the model's request. This is not a limitation, it is the safety primitive that makes autonomous agents deployable in production.

The gap between decision and execution is where human oversight lives. In fully autonomous systems, that gap is closed immediately and programmatically. In HITL systems, a human occupies that gap for a subset of tool calls, the ones with consequences that justify the latency of waiting for approval.

Framing this correctly matters: HITL is not distrust of the model. The model's reasoning may be entirely correct. HITL is the acknowledgment that **the consequences of a wrong execution cannot be undone**, and that a brief confirmation is cheaper than the cost of a mistake.

---

### The Pause Point

Every tool call loop has a natural seam between two operations:

```
[Pause point lives here]
        ↓
finish_reason === "tool_calls"    ← model's decision is known
        ↓
executeTool(toolCall)             ← application acts on it
```

In Phase 2.1 and 2.2, nothing occupies that seam, the code moves immediately from detection to execution. In Phase 2.3, the seam becomes explicit: after detecting `finish_reason === "tool_calls"` and before calling `executeTool()`, the runner presents the proposed call to the user and waits for a response.

The model is already done with its turn. It has emitted its decision and is waiting. The conversation is paused at the API level, no second call has been made yet. The application holds the state. This is the moment of human control.

---

### The Confirmation Flow

For each tool call in the `tool_calls` array, the runner must:

1. **Present** — display the tool name and its parsed arguments in readable form
2. **Prompt** — ask the user to approve or reject
3. **Branch** — execute on approval, skip on rejection

For approval, the flow is identical to Phase 2.2: execute the tool, return the result as a JSON string, append a `tool` message with the result.

For rejection, the key constraint is this: **the assistant message with `tool_calls` has already been appended to history**. That message contains `tool_call_id` references. Every referenced `tool_call_id` must have a corresponding `tool` result message before the next API call. There is no way to undo the assistant message append and still make a valid second API call.

This means rejection does not mean silence. A rejected tool call still requires a `tool` result message, it just carries rejection content instead of execution content:

```typescript
// On rejection — the tool does not run, but a message must still be appended
conversationHistory.push({
    role: "tool",
    tool_call_id: toolCall.id,    // must match the assistant message's entry
    content: JSON.stringify({
        status: "rejected",
        reason: "User declined to execute this action."
    })
});
```

The model receives this on the second API call. It reads the rejection content and responds accordingly, typically by acknowledging it could not complete the action and asking if there is another way it can help, or asking for clarification before trying again.

---

### What the Model Does After Rejection

The model's behaviour after receiving a rejection message is not specified by the API, it depends on the rejection content and the system prompt. Observed behaviours:

**Acknowledgment and pivot.** The most common response. The model reads the rejection, acknowledges it cannot proceed, and either asks for clarification or pivots to another approach. "I tried to send that email but you declined. Would you like me to draft it differently, or would you prefer to send it yourself?"

**Retry with the same arguments.** Less common but possible, especially if the system prompt instructs the model to be persistent or if the rejection message is vague. A clear rejection message ("User explicitly declined. Do not attempt this action again in this turn.") discourages retry.

**Retry with modified arguments.** The model may interpret the rejection as feedback on the arguments rather than the action itself. If the user rejected a tool call with ambiguous arguments, the model might re-call the tool with different arguments on the next turn. This is often the intended behavior, as the user rejected the specific call, not the concept of calling the tool.

Which behaviour the model exhibits depends on how the rejection content is phrased. The rejection message is the model's only signal. Design it to produce the behavior the application wants.

---

### The Append-Before-Prompt Problem

There is a subtle ordering question in the HITL loop: when should the assistant message (with `tool_calls`) be appended to history, before or after presenting the confirmation prompt to the user?

**Before presenting the prompt.** This is the correct approach. History should reflect the model's decision as soon as it is known. If the user's process crashes after they see the confirmation prompt but before they respond, history already contains the assistant decision. A recovery mechanism can read history and re-present the prompt.

**After the user responds.** Tempting because it feels cleaner, "only commit to history once we know the outcome." But this creates a race condition: if the application or process exits between prompt and response, the model's decision is lost. More practically, the `tool_call_id` references in subsequent `tool` messages must correspond to IDs in history, if the assistant message isn't there yet, the pairing cannot be validated.

Always append the assistant `tool_calls` message first, then prompt, then handle the response.

---

### Partial Approval in Parallel Calls

Phase 2.2 established that the model can issue multiple tool calls in one response. Phase 2.3 extends this with a new scenario: the user approves some calls and rejects others.

The iteration loop must handle each call independently. Every `tool_call_id` in the assistant message needs a result, approved calls get execution results, rejected calls get rejection messages. The loop completes fully before the second API call, regardless of the approval pattern.

```
tool_calls: [call_A (get_weather), call_B (send_email)]

User sees:   "The model wants to run get_weather(city='London')"
User:        [approve]
→ execute get_weather, append result for call_A

User sees:   "The model wants to run send_email(to='team@co.com', subject='Update', ...)"
User:        [reject]
→ do NOT execute, append rejection message for call_B

Second API call → model has weather result + email rejection in context
Model responds: "London is overcast at 14°C. The email wasn't sent, would you like to revise it?"
```

The mixed outcome case reveals something important: the model composes its final response from whatever mix of results and rejections it receives. It doesn't treat a partial rejection as a complete failure. This is useful behavior, an agent that gives up entirely because one out of three tool calls was rejected is less useful than one that reports what it could complete and asks about the rest.

---

### Tool Risk Tiers

Not all tools carry the same risk profile. Treating every tool call as equally in need of confirmation creates friction that makes the system unusable. A weather check that pauses for human approval on every call is annoying, not safe.

The practical approach is to classify tools into risk tiers at the application level:

**Tier 0 — Auto-approved.** Read-only operations with no side effects. `get_weather`, `get_time`, `convert_currency`, database reads, search queries. These run without presenting a confirmation prompt. The user never sees them.

**Tier 1 — Confirmation required.** Write operations or calls with external side effects. `send_email`, `create_event`, `post_message`, `update_record`. These pause for user approval with the full argument display.

**Tier 2 — Hard-blocked.** Actions the system should never take autonomously regardless of user approval, either because the tool is too dangerous to expose through this interface or because no confirmation UI is sufficient. These return a hard error message without even presenting to the user.

The runner implements this through a lookup: before the loop executes a tool, it checks the tool's risk tier. Tier 0 runs immediately. Tier 1 prompts. Tier 2 appends a rejection without prompting.

```typescript
const RISK_TIER: Record<string, 0 | 1 | 2> = {
    get_weather:       0,   // auto-approve
    get_time:          0,   // auto-approve
    send_email:        1,   // confirm before executing
    create_reminder:   1,   // confirm before executing
};
```

This design keeps the runner's core logic clean. The loop doesn't need to know which specific tools need confirmation, it only checks the tier. Adding a new tool means adding a registry entry, not changing the runner.

---

### Loop Termination Under Repeated Rejection

A scenario worth thinking through: the model keeps requesting the same tool call, and the user keeps rejecting it. This can happen when the system prompt makes the tool strongly preferred, or when the model interprets each rejection as ambiguous feedback rather than a clear refusal.

Without a termination condition, this loop can run indefinitely. Three reasonable stopping conditions:

**Turn-level rejection cap.** If the same tool name is rejected more than N times in a single turn (across the loop iterations), return a hard error rather than passing another rejection to the model. N = 2 is reasonable.

**Session-level rejection memory.** Track which tool calls have been rejected in this session and include that context in subsequent prompts. If a tool was rejected three turns ago, the runner can add a note to the system prompt or a user message: "Note: send_email has been explicitly declined by the user. Do not attempt it again."

**User-facing abort.** Present an explicit "stop trying" option alongside the rejection prompt. The user can either reject the individual call or reject all future calls to this tool for the session.

Phase 2.3 implements a simple turn-level cap. The more sophisticated session-level approaches are explored in Phase 5 when persistent memory is introduced.

---

## What This App Builds

A CLI assistant with a mixed tool registry: two auto-approved read-only tools and two confirmation-required action tools.

**Auto-approved (Tier 0):**
- **`get_weather(city, unit?)`** — ported from Phase 2.2

**Confirmation-required (Tier 1):**
- **`send_email(to, subject, body)`** — mock, logs to terminal instead of sending, requires approval
- **`create_reminder(title, due_date, priority)`** — mock, logs to terminal, requires approval

The confirmation prompt shows:
- The tool name in readable form
- Each argument key and its value, formatted clearly
- An `[approve / reject]` prompt

On approval: executes the tool, appends the result.  
On rejection: appends a structured rejection message, does not execute.

The runner also logs which tools ran automatically (Tier 0) vs which paused for confirmation (Tier 1), making the tier system visible during experimentation.

---

## File Structure

```
services/human-in-the-loop/
├── package.json
├── tsconfig.json
├── docs/
│   └── human-in-the-loop.md
└── src/
    ├── chat.ts                  ← REPL loop, entry point
    ├── config.ts                ← MODEL, SYSTEM_PROMPT, RISK_TIER registry
    ├── types.ts                 ← Same four-role union as 2.1–2.2, no changes
    ├── runner.ts                ← Extended: confirmation gate before executeTool()
    ├── confirm.ts               ← Prompts the user and returns approve/reject
    └── tools/
        ├── index.ts             ← Dispatcher (same pattern, two new cases)
        ├── definitions.ts       ← Four tool schemas
        ├── weather.ts           ← From Phase 2.2
        ├── email.ts             ← New: mock send_email
        └── reminder.ts          ← New: mock create_reminder
```

The key new file is `confirm.ts`. It isolates the readline prompt and approval logic entirely, the runner imports it as a single function `confirmToolCall(toolCall): Promise<boolean>`. This keeps the runner's loop readable: it calls `confirmToolCall`, branches on the result, and either executes or appends a rejection. The confirmation UX is not mixed into the execution logic.

The `RISK_TIER` registry lives in `config.ts` so it can be read by the runner without coupling the runner to any specific tool list. Adding a new tool means adding it to `definitions.ts`, implementing it in its own file, adding a `case` to the dispatcher, and adding a tier entry to `config.ts`. The runner itself does not change.

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

**Phase 2.4 — Tool Use with External APIs**
Replace mock tool implementations with real external API calls, like a live weather API, a real search endpoint, or similar. Handle network failures, timeouts, malformed responses, and rate limits gracefully. Understand how to sanitize and validate external API results before feeding them back into the model's context.

---

*AI Playground · Built to learn, not to ship.*
