import { config } from "../config";

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface ChatCompletionResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

/**
 * Call 0G Compute's OpenAI-compatible chat completions endpoint.
 * Uses Node built-in fetch — no axios.
 */
export async function chatCompletion(messages: ChatMessage[]): Promise<string> {
  if (!config.compute.authToken) {
    throw new Error("OG_COMPUTE_TOKEN not configured");
  }

  const response = await fetch(`${config.compute.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.compute.authToken}`,
    },
    body: JSON.stringify({
      model: config.compute.model,
      messages,
      temperature: 0.7,
      max_tokens: 2000,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`0G Compute error ${response.status}: ${body}`);
  }

  const data = (await response.json()) as ChatCompletionResponse;
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("Empty response from 0G Compute");
  }
  return content;
}
