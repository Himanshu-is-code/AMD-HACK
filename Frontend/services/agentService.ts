import { extractDate } from '../utils/dateUtils';

const AGENT_URL = import.meta.env.VITE_AGENT_URL || "http://localhost:8000";

export async function sendToAgent(text: string, dismissedIntents: string[] = []) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 310000); // 310s timeout

    // Extract date synchronously before sending
    const extractedTime = extractDate(text);
    if (extractedTime) {
        console.log(`Frontend Extracted Time: ${extractedTime}`);
    }

    try {
        const res = await fetch(`${AGENT_URL}/agent`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                text,
                client_time: new Date().toString(),
                extracted_time: extractedTime,
                dismissed_intents: dismissedIntents
            }),
            signal: controller.signal
        });

        if (!res.ok) {
            throw new Error(`Agent backend error: ${res.status}`);
        }

        return res.json();
    } catch (error: any) {
        if (error.name === 'AbortError') {
            throw new Error("Request timed out. The agent provided no response.");
        }
        throw error;
    } finally {
        clearTimeout(timeoutId);
    }
}

export async function getTask(taskId: string) {
    try {
        const res = await fetch(`${AGENT_URL}/tasks/${taskId}`);
        if (!res.ok) {
            throw new Error(`Failed to fetch task: ${res.status}`);
        }
        return res.json();
    } catch (error) {
        console.error("Error fetching task:", error);
        return null;
    }
}

export async function completeTask(taskId: string, planUpdate: string, sources: any[]) {
    try {
        const res = await fetch(`${AGENT_URL}/tasks/${taskId}/complete`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ plan_update: planUpdate, sources: sources })
        });
        if (!res.ok) {
            throw new Error(`Failed to complete task: ${res.status}`);
        }
        return res.json();
    } catch (error) {
        console.error("Error completing task:", error);
        return null;
    }
}

// Auth Types
export interface AuthResponse {
    token: string;
    refresh_token: string;
    expiry?: string;
}

export async function exchangeAuthCode(code: string): Promise<AuthResponse> {
    try {
        const res = await fetch(`${AGENT_URL}/auth/google`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ code })
        });

        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.detail || "Auth failed");
        }
        return res.json();
    } catch (error) {
        console.error("Auth Error:", error);
        throw error;
    }
}

export async function getAuthStatus(): Promise<{ connected: boolean }> {
    try {
        const res = await fetch(`${AGENT_URL}/auth/status`);
        if (!res.ok) return { connected: false };
        return res.json();
    } catch (e) {
        return { connected: false };
    }
}

export async function getGoogleUser(): Promise<{ name: string, picture: string, email: string } | null> {
    try {
        const res = await fetch(`${AGENT_URL}/auth/user`);
        if (!res.ok) return null;
        return res.json();
    } catch (e) {
        return null;
    }
}

export async function logoutGoogle() {
    try {
        await fetch(`${AGENT_URL}/auth/logout`, { method: "POST" });
        localStorage.removeItem('isGoogleConnected');
        localStorage.removeItem('googleUser');
    } catch (e) {
        console.error("Logout failed", e);
    }
}

export async function getSettings(): Promise<{ calendar_sync_enabled: boolean }> {
    try {
        const res = await fetch(`${AGENT_URL}/settings`);
        if (!res.ok) return { calendar_sync_enabled: true };
        return res.json();
    } catch (e) {
        return { calendar_sync_enabled: true };
    }
}

export async function updateSetting(key: string, value: boolean) {
    try {
        await fetch(`${AGENT_URL}/settings`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ key, value })
        });
    } catch (e) {
        console.error("Failed to update setting", e);
    }
}




