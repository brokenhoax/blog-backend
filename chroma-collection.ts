import { ChromaClient } from "chromadb";
import { Ollama } from "ollama";
import dotenv from "dotenv";
const ollama = new Ollama();

// Select Environment Variables
dotenv.config({
  path:
    process.env.NODE_ENV === "production" ? ".env.production.local" : ".env",
});

const client = new ChromaClient({
  path: process.env.CHROMA_URL!,
});

// embed one text → number[]
export async function embed(text: string): Promise<number[]> {
  const res = await ollama.embeddings({
    model: "nomic-embed-text:v1.5",
    prompt: text,
  });
  return res.embedding;
}

// get or create a v2 collection
export async function getCollection(name: string) {
  return await client.getOrCreateCollection({
    name,
    metadata: { "hnsw:space": "cosine" },
  });
}
