import { ChromaClient } from "chromadb";
import { Ollama } from "ollama";
import dotenv from "dotenv";

// -----------------------------
// Environment Variables
// -----------------------------
dotenv.config({
  path:
    process.env.NODE_ENV === "production"
      ? ".env.production.local"
      : ".env",
});

// -----------------------------
// Ollama Client
// -----------------------------
const ollama = new Ollama({
  host: process.env.OLLAMA_HOST,
});

// -----------------------------
// Chroma Client
// -----------------------------
const client = new ChromaClient({
  path: process.env.CHROMA_URL!, // e.g. http://localhost:8000
});

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
