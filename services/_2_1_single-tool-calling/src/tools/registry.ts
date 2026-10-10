import { getWeather, WeatherArgsSchema } from "./weather";
import { ToolDefinition } from "../utils/types";

// Tool registry: name → { definition (the model's view) + execute (the app's view) }
const TOOL_REGISTRY = {
    get_weather: {
        definition: {
            type: "function",
            function: {
                name: "get_weather",
                description: "Get the current weather for a city. Use whenever the user asks about weather or temperature — never guess.",
                parameters: {
                    type: "object",
                    properties: {
                        city: { type: "string", description: "City name, e.g. 'Mumbai'" },
                        unit: { type: "string", enum: ["celsius", "fahrenheit"], description: "Temperature unit" },
                    },
                    required: ["city"],
                    additionalProperties: false,
                },
            },
        },
        execute: (argsJson: string) => {
            // Layer 1 — is it valid JSON? (model emits a raw JSON *string*, never an object)
            let parsed: unknown;
            try {
                parsed = JSON.parse(argsJson);
            } catch {
                return JSON.stringify({ error: "Failed to parse tool arguments. Ensure they are valid JSON." });
            }
            
            // Layer 2 — does it match the schema? (missing city, wrong unit, bad types)
            const result = WeatherArgsSchema.safeParse(parsed);
            if (!result.success) {
                const issues = result.error.issues
                    .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
                    .join("; ");
                return JSON.stringify({ error: `Invalid tool arguments: ${issues}` });
            }
            return getWeather(result.data);
        },
    },
};

// The tools array passed to the API — derived, never hand-duplicated
export const TOOLS: ToolDefinition[] = Object.values(TOOL_REGISTRY).map((tool) => tool.definition);

// Execute a tool by name with the model's raw JSON args. Never throws — error JSON back to the model.
export function executeTool(name: string, argsJson: string): string {
    const tool = TOOL_REGISTRY[name as keyof typeof TOOL_REGISTRY];
    if (!tool) return JSON.stringify({ error: `Tool '${name}' is not recognized.` });
    try {
        return tool.execute(argsJson);
    } catch {
        return JSON.stringify({ error: "Tool execution failed unexpectedly." });
    }
}