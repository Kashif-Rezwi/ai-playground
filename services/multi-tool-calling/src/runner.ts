import OpenAI from 'openai';
import { MODEL, MAX_TOOL_ROUNDS } from './config';
import { Message, ToolCall } from './types';
import { executeTool } from './tools';
import { TOOLS } from './tools/definition';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Runs a turn, looping until the model stops calling tools (parallel + sequential support).
export async function runTurn(history: Message[]): Promise<Message> {
    let rounds = 0;

    while (rounds < MAX_TOOL_ROUNDS) {
        rounds++;

        const response = await openai.chat.completions.create({
            model: MODEL,
            messages: history,
            tools: TOOLS,
            tool_choice: "auto",
        });

        const assistantMsg = response.choices[0].message;
        const finishReason = response.choices[0].finish_reason;

        console.log(`\n[LOOP] finish_reason: "${finishReason}"`);

        if (finishReason === "tool_calls" && assistantMsg.tool_calls) {

            // RULE 1: Assistant message (with tool_calls) must be appended first.
            history.push(assistantMsg);

            // RULE 2: Execute every tool call and append result (loop must always complete fully).
            for (const toolCall of assistantMsg.tool_calls as ToolCall[]) {
                if (toolCall.type !== 'function') continue;

                const toolName = toolCall.function.name;
                const toolArgs = toolCall.function.arguments;

                console.log(`[TOOL] Executing: ${toolName}(${toolArgs})`);

                // RULE 3: try/catch inside the loop — every tool_call_id must get a result.
                let toolResultJson: string;
                try {
                    toolResultJson = executeTool(toolName, toolArgs);
                } catch (err: any) {
                    toolResultJson = JSON.stringify({ error: err?.message ?? 'Tool execution failed.' });
                }

                console.log(`[TOOL] Result: ${toolResultJson}`);

                history.push({ role: "tool", tool_call_id: toolCall.id, content: toolResultJson });
            }

            continue; // Loop back, the model may chain another tool or produce final answer.
        }

        return assistantMsg; // finish_reason === "stop" → return final text response.
    }

    throw new Error(`[runTurn] Exceeded MAX_TOOL_ROUNDS (${MAX_TOOL_ROUNDS}). Possible infinite loop.`);
}
