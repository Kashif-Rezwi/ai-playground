// The arguments the model will try to provide
export interface WeatherArgs {
    city: string;
    unit?: 'celsius' | 'fahrenheit';
}

// A simple mock database of cities
const MOCK_DB: Record<string, { tempC: number, condition: string, humidity: number, wind_speed: number }> = {
    'mumbai': { tempC: 32, condition: "humid and partly cloudy", humidity: 80, wind_speed: 15 },
    'delhi': { tempC: 40, condition: "sunny and hot", humidity: 25, wind_speed: 12 },
    'bangalore': { tempC: 24, condition: "pleasant with light rain", humidity: 65, wind_speed: 20 },
    'kolkata': { tempC: 35, condition: "thunderstorms", humidity: 85, wind_speed: 25 },
    'chennai': { tempC: 36, condition: "hot and sunny", humidity: 75, wind_speed: 18 }
};

// Helper to convert C to F
const toFahrenheit = (celsius: number) => Math.round((celsius * 9 / 5) + 32);

// Mock implementation
export function getWeather(args: WeatherArgs): string {
    try {
        const { city, unit = 'celsius' } = args;
        const normalizedCity = city.toLowerCase();

        // Look up the city in our mock database
        const weatherData = MOCK_DB[normalizedCity];

        // If the city isn't in our database, return a friendly error
        if (!weatherData) {
            return JSON.stringify({
                error: `City '${city}' not found in weather database. Try Mumbai, Delhi, Bangalore, Kolkata, or Chennai.`
            });
        }

        // Calculate the requested temperature
        const temperature = unit === 'fahrenheit'
            ? toFahrenheit(weatherData.tempC)
            : weatherData.tempC;

        const result = {
            city: city, // Use the user's casing
            temperature,
            condition: weatherData.condition,
            humidity: weatherData.humidity,
            wind_speed: weatherData.wind_speed,
            unit
        };

        // We MUST return a stringified JSON object for the LLM
        return JSON.stringify(result);

    } catch (error) {
        return JSON.stringify({ error: "An unexpected error occurred while fetching the weather." });
    }
}
