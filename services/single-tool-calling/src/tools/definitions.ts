import { ToolDefinition } from '../types';

export const TOOLS: ToolDefinition[] = [
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
                        description: "The name of the city, e.g. 'Mumbai', 'Delhi', 'Bangalore'"
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
];
