"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.chatCompletion = chatCompletion;
const config_1 = require("../config");
/**
 * Call 0G Compute's OpenAI-compatible chat completions endpoint.
 * Uses Node built-in fetch — no axios.
 */
async function chatCompletion(messages) {
    if (!config_1.config.compute.authToken) {
        throw new Error("OG_COMPUTE_TOKEN not configured");
    }
    const response = await fetch(`${config_1.config.compute.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${config_1.config.compute.authToken}`,
        },
        body: JSON.stringify({
            model: config_1.config.compute.model,
            messages,
            temperature: 0.7,
            max_tokens: 2000,
        }),
    });
    if (!response.ok) {
        const body = await response.text();
        throw new Error(`0G Compute error ${response.status}: ${body}`);
    }
    const data = (await response.json());
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
        throw new Error("Empty response from 0G Compute");
    }
    return content;
}
//# sourceMappingURL=compute.js.map