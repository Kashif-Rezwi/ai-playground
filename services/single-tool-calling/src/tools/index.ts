import { getWeather, WeatherArgs } from './weather';

// The dispatcher function
export function executeTool(name: string, argsJson: string): string {
    try {
        console.log(`\n⚙️  Executing tool: [${name}] with args: ${argsJson}`);

        // The model gives us a raw JSON string. We parse it here in the app layer.
        const parsedArgs = JSON.parse(argsJson);

        switch (name) {
            case 'get_weather':
                return getWeather(parsedArgs as WeatherArgs);
            default:
                return JSON.stringify({ error: `Tool '${name}' is not recognized.` });
        }
    } catch (e) {
        // If the model gave us invalid JSON, we tell it that!
        return JSON.stringify({ error: "Failed to parse tool arguments. Ensure they are valid JSON." });
    }
}

// Export the tool definitions so our runner can pass them to the API
export { TOOLS } from './definitions';
