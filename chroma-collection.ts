import { ChromaClient } from "chromadb";
import { Ollama } from "ollama";
import "./load-env.js";

function parseChromaUrl(url: string) {
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: parsed.port
      ? Number(parsed.port)
      : parsed.protocol === "https:" ? 443 : 80,
    ssl: parsed.protocol === "https:",
  };
}

const chromaUrl = process.env.CHROMA_URL;
if (!chromaUrl) {
  throw new Error(
    "CHROMA_URL is not set. Add it to .env.production (local dev) or .env.production.local (production).",
  );
}

// -----------------------------
// Ollama Client
// -----------------------------
const ollama = new Ollama({
  host: process.env.OLLAMA_HOST,
});

// -----------------------------
// Chroma Client
// -----------------------------
const client = new ChromaClient(parseChromaUrl(chromaUrl));

// -----------------------------
// Embedding Function
// -----------------------------
export async function embed(text: string): Promise<number[]> {
  const res = await ollama.embeddings({
    model: "nomic-embed-text:v1.5",
    prompt: text,
  });

  return res.embedding;
}

// -----------------------------
// Collection Helper (Correct)
// -----------------------------
export async function getOrCreateCollection(name: string) {
  return await client.getOrCreateCollection({
    name,
    metadata: {
      "hnsw:space": "cosine",
    },
  });
}
