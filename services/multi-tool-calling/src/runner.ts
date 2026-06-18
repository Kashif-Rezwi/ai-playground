import OpenAI from 'openai';
import { MODEL } from './config';
import { Message, ToolCall } from './types';
import { executeTool } from './tools';
import { TOOLS } from './tools/definition';

// Initialize the OpenAI client
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Runs a single turn of the conversation, handling tool calls if necessary.
export async function runTurn(history: Message[]): Promise<Message> {

    // --- STEP 1: Initial Request ---
    const response1 = await openai.chat.completions.create({
        model: MODEL,
        messages: history,
        tools: TOOLS,
        tool_choice: "auto", // Model decides whether to use a tool and which one(s)
    });

    const message1 = response1.choices[0].message;
    const finishReason = response1.choices[0].finish_reason;

    console.log(`\n[LOOP] finish_reason: "${finishReason}"`);

    // --- STEP 2: Check Model Decision ---
    if (finishReason === "tool_calls" && message1.tool_calls) {

        // The model decided to call one or more tools. 
        // RULE 1: The assistant message must be appended to history first!
        history.push(message1);

        // RULE 2: We must execute ALL tool calls before making the second API call.
        // We iterate through every tool the model wants to call.
        for (const toolCall of message1.tool_calls as ToolCall[]) {
            if (toolCall.type !== 'function') continue;

            const toolName = toolCall.function.name;
            const toolArgs = toolCall.function.arguments;

            console.log(`[TOOL] Executing: ${toolName}(${toolArgs})`);

            // --- STEP 3: Execute the Tool ---
            const toolResultJson = executeTool(toolName, toolArgs);

            console.log(`[TOOL] Result: ${toolResultJson}`);

            // RULE 3: Append the result to history using the EXACT tool_call_id
            history.push({
                role: "tool",
                tool_call_id: toolCall.id,
                content: toolResultJson
            });
        }

        // --- STEP 4: Second API Call ---
        // Now that ALL tool results are in history, we ask the model to form its final answer.
        const response2 = await openai.chat.completions.create({
            model: MODEL,
            messages: history,
        });

        const message2 = response2.choices[0].message;
        return message2;
    }

    // --- DIRECT ANSWER PATH ---
    // If finish_reason was "stop", the model didn't need any tools.
    return message1;
}
