import * as chrono from 'chrono-node';

/**
 * Extracts a date/time from the given text and returns it as an ISO string.
 * It uses the 'en' locale by default.
 * 
 * @param text The user's input text (e.g., "Lunch at 1pm tomorrow")
 * @returns ISO 8601 string with timezone (e.g., "2026-02-06T13:00:00+05:30") or null if no date found.
 */
export function extractDate(text: string): string | null {
    // Parse the text relative to "now"
    const results = chrono.parse(text, new Date());

    if (results.length === 0) {
        return null;
    }

    // Get the first result (usually the most relevant)
    const result = results[0];
    let date = result.start.date();

    // FORCE TODAY FIX:
    // If the user explicitly said "today", we must ensure the date component matches today's date,
    // ignoring chrono's tendency to shift past times to tomorrow.
    if (text.toLowerCase().includes('today')) {
        const now = new Date();
        // Check if the parsed date is different from today (e.g. tomorrow)
        if (date.getDate() !== now.getDate() || date.getMonth() !== now.getMonth()) {
            // Reset to today, keeping the parsed time
            date.setFullYear(now.getFullYear());
            date.setMonth(now.getMonth());
            date.setDate(now.getDate());
            console.log("Detected 'today' keyword. Forcing date to Today.");
        }
    }

    // chrono-node returns a Date object.
    // To send it to Python effectively, we want ISO format but creating it manually 
    // to preserve the "local" aspect is often safer, OR we just depend on 
    // toISOString() which gives UTC (ending in Z). 
    // Google Calendar API works well with explicit offsets or UTC. 

    // However, our backend logic expects "YYYY-MM-DDTHH:MM..."
    // Let's return a full ISO string. 
    // Note: parsed date obeys the browser's local timezone unless specified otherwise.

    // Let's format it to preserve the local timezone offset if possible, 
    // or just return the Date object and let the caller handle it? 
    // For simplicity, let's return the standard ISO string (UTC) and let Python convert, 
    // OR construct a local ISO string.

    // Construct local ISO string:
    const tzOffset = -date.getTimezoneOffset();
    const diff = tzOffset >= 0 ? '+' : '-';
    const pad = (n: number) => (n < 10 ? '0' + n : n);

    const year = date.getFullYear();
    const month = pad(date.getMonth() + 1);
    const day = pad(date.getDate());
    const hour = pad(date.getHours());
    const minute = pad(date.getMinutes());
    const second = pad(date.getSeconds());

    // Timezone HH:MM
    const tzHour = pad(Math.floor(Math.abs(tzOffset) / 60));
    const tzMinute = pad(Math.abs(tzOffset) % 60);

    return `${year}-${month}-${day}T${hour}:${minute}:${second}${diff}${tzHour}:${tzMinute}`;
}
