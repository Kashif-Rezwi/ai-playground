import { getWeather, WeatherArgs } from "./weather";
import { getTime, TimeArgs } from "./time";
import { convertCurrency, CurrencyArgs } from "./currency";

// The central dispatcher that routes a tool call to its implementation
export function executeTool(toolName: string, toolArgsString: string): string {
    let args: any;
    try {
        args = JSON.parse(toolArgsString);
    } catch (e) {
        return JSON.stringify({ error: "Failed to parse tool arguments as JSON." });
    }

    try {
        switch (toolName) {
            case "get_weather":
                return getWeather(args as WeatherArgs);
            case "get_time":
                return getTime(args as TimeArgs);
            case "convert_currency":
                return convertCurrency(args as CurrencyArgs);
            default:
                return JSON.stringify({ error: `Tool '${toolName}' is not implemented.` });
        }
    } catch (e) {
        // Fallback catch-all in case a tool throws instead of returning an error string
        return JSON.stringify({ error: `An unexpected error occurred while executing ${toolName}.` });
    }
}
