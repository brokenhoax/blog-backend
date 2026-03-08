import { ChromaClient } from "chromadb";
import { Ollama } from "ollama";

const ollama = new Ollama();

const client = new ChromaClient({
  path: "http://localhost:8001",
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
