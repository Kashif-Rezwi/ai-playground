import { z } from "zod";
import { ToolDefinition } from "../utils/types";

export const timeToolDefinition: ToolDefinition = {
    type: "function",
    function: {
        name: "get_time",
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
};

// The arguments the model will try to provide (validated with Zod before execution)
export const TimeArgsSchema = z.object({
    city: z.string().trim().min(1, "city is required"),
});

export type TimeArgs = z.infer<typeof TimeArgsSchema>;

// A simple mock database of cities and their corresponding timezones
const MOCK_TIMEZONE_DB: Record<string, string> = {
    'london': 'Europe/London',
    'paris': 'Europe/Paris',
    'tokyo': 'Asia/Tokyo',
    'new york': 'America/New_York',
    'berlin': 'Europe/Berlin',
    'seoul': 'Asia/Seoul',
    'madrid': 'Europe/Madrid',
    'dubai': 'Asia/Dubai',
    'mumbai': 'Asia/Kolkata',
    'delhi': 'Asia/Kolkata',
};

// Mock implementation
export function getTime(args: TimeArgs): string {
    try {
        const { city } = args;
        const normalizedCity = city.trim().toLowerCase();
        const timeZone = MOCK_TIMEZONE_DB[normalizedCity];

        if (!timeZone) {
            return JSON.stringify({
                error: `Timezone for city '${city}' not found in mock database.`
            });
        }

        const formatter = new Intl.DateTimeFormat('en-US', {
            timeZone,
            dateStyle: 'full',
            timeStyle: 'long',
        });

        const localTime = formatter.format(new Date());

        return JSON.stringify({
            city,
            local_time: localTime,
            timezone: timeZone
        });
    } catch (error) {
        return JSON.stringify({ error: "An unexpected error occurred while fetching the time." });
    }
}
