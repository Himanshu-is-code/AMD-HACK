const AGENT_URL = import.meta.env.VITE_AGENT_URL || "http://localhost:8000";

export async function sendToAgent(text: string) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 310000); // 310s timeout

    try {
        const res = await fetch(`${AGENT_URL}/agent`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ text }),
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




