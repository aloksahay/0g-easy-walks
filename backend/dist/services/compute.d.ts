interface ChatMessage {
    role: "system" | "user" | "assistant";
    content: string;
}
/**
 * Call 0G Compute's OpenAI-compatible chat completions endpoint.
 * Uses Node built-in fetch — no axios.
 */
export declare function chatCompletion(messages: ChatMessage[]): Promise<string>;
export {};
//# sourceMappingURL=compute.d.ts.map