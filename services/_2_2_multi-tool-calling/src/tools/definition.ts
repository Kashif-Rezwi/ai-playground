import { ToolDefinition } from "../types";

export const TOOLS: ToolDefinition[] = [
    {
        type: "function",
        function: {
            name: "get_weather",
            // description: "Gets information about a city.", // for testing tool identification
            description: "Get the current weather conditions or temperature for a specific city. Use this ONLY when the user asks about weather, temperature, or current conditions. Do NOT use this to get the local time.",
            parameters: {
                type: "object",
                properties: {
                    city: {
                        type: "string",
                        description: "The name of the city, e.g. 'London', 'Tokyo'"
                    },
                    unit: {
                        type: "string",
                        description: "Temperature unit. Defaults to celsius.",
                        enum: ["celsius", "fahrenheit"]
                    }
                },
                required: ["city"],
                additionalProperties: false
            }
        }
    },
    {
        type: "function",
        function: {
            name: "get_time",
            // description: "Gets information about a city.", // for testing tool identification
            description: "Get the current local time for a specific city. Use this ONLY when the user asks about the clock time, timezone, or what time it is. Do NOT use this to get weather.",
            parameters: {
                type: "object",
                properties: {
                    city: {
                        type: "string",
                        description: "The name of the city, e.g. 'London', 'Tokyo'"
                    }
                },
                required: ["city"],
                additionalProperties: false
            }
        }
    },
    {
        type: "function",
        function: {
            name: "convert_currency",
            description: "Convert a specific amount of money from one currency to another using current exchange rates.",
            parameters: {
                type: "object",
                properties: {
                    amount: {
                        type: "number",
                        description: "The numerical amount of money to convert"
                    },
                    from_currency: {
                        type: "string",
                        description: "The 3-letter currency code to convert from, e.g. 'USD', 'GBP'"
                    },
                    to_currency: {
                        type: "string",
                        description: "The 3-letter currency code to convert to, e.g. 'EUR', 'JPY'"
                    }
                },
                required: ["amount", "from_currency", "to_currency"],
                additionalProperties: false
            }
        }
    }
];
