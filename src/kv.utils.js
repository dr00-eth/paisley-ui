
export async function getKv(context, key) {
    const workerURL = context.workerUrl;
    try {
        const response = await fetch(workerURL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ method: "getStates", agentProfileUserId: key }),
        });

        if (response.ok) {
            const states = await response.json();
            return states;
        } else {
            throw new Error("Failed to get KV from Cloudflare Worker");
        }
    } catch (error) {
        console.error("No states:", error);
        return [];
    }
}
;

export async function storeKv(context, key, value) {
    const workerURL = context.workerUrl;
    const { privateMode } = context.state;

    if (Boolean(privateMode) === true) {
        return;
    }

    try {
        const response = await fetch(workerURL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ method: "storeStates", agentProfileUserId: key, states: value }),
        });

        if (!response.ok) {
            throw new Error("Failed to store KV in Cloudflare Worker");
        }
    } catch (error) {
        console.error("Error storing KV:", error);
    }
}
;
