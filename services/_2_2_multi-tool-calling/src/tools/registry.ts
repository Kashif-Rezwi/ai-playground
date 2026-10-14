import { getWeather, WeatherArgsSchema, weatherToolDefinition } from "./weather";
import { getTime, TimeArgsSchema, timeToolDefinition } from "./time";
import { convertCurrency, CurrencyArgsSchema, currencyToolDefinition } from "./currency";
import { ToolDefinition } from "../utils/types";

// The tools array passed to the API — the model's view
export const TOOLS: ToolDefinition[] = [
    weatherToolDefinition,
    timeToolDefinition,
    currencyToolDefinition
];

// Registry mapping tool names to their respective Zod schema and execution function
const toolRegistry = {
    get_weather: { schema: WeatherArgsSchema, execute: getWeather },
    get_time: { schema: TimeArgsSchema, execute: getTime },
    convert_currency: { schema: CurrencyArgsSchema, execute: convertCurrency },
};

// The central dispatcher that routes a tool call to its implementation.
export function executeTool(toolName: string, toolArgsString: string): string {
    // Layer 1 — is it valid JSON?
    let parsed: unknown;
    try {
        parsed = JSON.parse(toolArgsString);
    } catch {
        return JSON.stringify({ error: "Failed to parse tool arguments. Ensure they are valid JSON." });
    }

    // Look up the tool in the registry
    const tool = toolRegistry[toolName as keyof typeof toolRegistry];
    if (!tool) {
        return JSON.stringify({ error: `Tool '${toolName}' is not implemented.` });
    }

    // Layer 2 — does it match the tool's schema?
    const result = tool.schema.safeParse(parsed);
    if (!result.success) {
        return JSON.stringify({ error: `Invalid tool arguments: ${formatIssues(result.error.issues)}` });
    }

    // Execute the matched tool with validated data
    const toolExecutionFn = tool.execute as (data: any) => string;
    return toolExecutionFn(result.data);
}

// Human-readable Zod issue list: "city: Required; unit: Invalid value"
function formatIssues(issues: { path: PropertyKey[]; message: string }[]): string {
    return issues.map((i) => `${i.path.map(String).join(".") || "(root)"}: ${i.message}`).join("; ");
}