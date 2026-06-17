import OpenAI from 'openai';
import { MODEL } from './config';
import { Message, ToolCall } from './types';
import { executeTool, TOOLS } from './tools';

// Initialize the OpenAI client
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Runs a single turn of the conversation, handling tool calls if necessary.
export async function runTurn(history: Message[]): Promise<Message> {

    // --- STEP 1: Initial Request ---
    const response1 = await openai.chat.completions.create({
        model: MODEL,
        messages: history,
        tools: TOOLS,
        tool_choice: "auto",
    });

    const message1 = response1.choices[0].message;
    const finishReason = response1.choices[0].finish_reason;

    console.log(`\n[LOOP] finish_reason: "${finishReason}"`);

    // --- STEP 2: Check Model Decision ---
    if (finishReason === "tool_calls" && message1.tool_calls) {

        history.push(message1);

        const toolCall = message1.tool_calls[0] as ToolCall;
        const toolName = toolCall.function.name;
        const toolArgs = toolCall.function.arguments;

        // --- STEP 3: Execute the Tool ---
        const toolResultJson = executeTool(toolName, toolArgs);
        console.log(`[TOOL] Result: ${toolResultJson}`);

        history.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: toolResultJson
        });

        // --- STEP 4: Second API Call ---
        const response2 = await openai.chat.completions.create({
            model: MODEL,
            messages: history,
        });

        const message2 = response2.choices[0].message;
        return message2;
    }

    // --- DIRECT ANSWER PATH ---
    return message1;
}
