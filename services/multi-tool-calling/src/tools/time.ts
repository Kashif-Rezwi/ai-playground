export interface TimeArgs {
    city: string;
}

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

export function getTime(args: TimeArgs): string {
    try {
        const { city } = args;
        const normalizedCity = city.toLowerCase();
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
