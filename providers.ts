import { Ollama } from "ollama";

const ollama = new Ollama();

/**
 * Local Llama provider (Ollama)
 */
export async function callLlama(messages: any[]) {
  const response = await ollama.chat({
    model: "kraus-cloud-llama",
    messages,
    stream: false,
  });

  return {
    reply: response.message?.content || "",
    context: (response as any).context,
  };
}

/**
 * xAI Grok provider
 */
export async function callXAI(messages: any[]) {
  const payload = {
    model: "grok-4-1-fast-reasoning",
    input: messages.map((m) => ({
      role: m.role,
      content: m.content,
    })),
  };

  const response = await fetch("https://api.x.ai/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.XAI_API_KEY}`,
    },
    body: JSON.stringify(payload),
  });

  const json = await response.json();

  // Extract assistant reply
  const reply =
    json?.output?.[0]?.content ??
    json?.output_text ??
    "No response from xAI model.";

  return {
    reply,
    context: null, // xAI does not return KV cache
  };
}
