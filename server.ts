import dotenv from "dotenv";
import fs from "fs";
import { posts } from "./data/posts";
import express, { Request, Response } from "express";
import { createServer } from "https";
import { createServer as createHttpServer } from "http";
import cors from "cors";
import { Ollama, ChatResponse } from "ollama";
import safetyFilter from "./middleware/safetyFilter";
import { getCollection, embed } from "./chroma-collection";

// Select Environment Variables
dotenv.config({
  path:
    process.env.NODE_ENV === "production" ? ".env.production.local" : ".env",
});

// Ollama clients
const ollama = new Ollama();
const guard = new Ollama();

// Express app
const app = express();
app.use(express.json());
app.use(express.static("public"));

// CORS
app.use(
  cors({
    origin: ["http://localhost:3000", "https://krauscloud.com:3000"],
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
  }),
);

// -----------------------------
// RAG Retrieval
// -----------------------------
async function retrieveContext(query: string, k = 5): Promise<string[]> {
  const queryEmbedding = await embed(query);
  const collection = await getCollection("data");

  const results = await collection.query({
    nResults: k,
    queryEmbeddings: [queryEmbedding],
    include: ["documents", "metadatas", "distances"],
  });

  return (results.documents?.[0] || []).filter(
    (doc): doc is string => doc !== null,
  );
}

// -----------------------------
// GET Posts
// -----------------------------
app.get("/api/posts", (req: Request, res: Response) => {
  res.json(posts);
});

// -----------------------------
// System Prompt
// -----------------------------
const systemPrompt = {
  role: "system" as const,
  content: ``,
};

// -----------------------------
// Session Store
// -----------------------------
interface SessionData {
  messages: { role: "user" | "assistant" | "system"; content: string }[];
  context: number[];
}

const sessions: Record<string, SessionData> = {};

function ensureSession(sessionId: string) {
  if (
    !sessions[sessionId] ||
    typeof sessions[sessionId] !== "object" ||
    !Array.isArray(sessions[sessionId].messages) ||
    !Array.isArray(sessions[sessionId].context)
  ) {
    sessions[sessionId] = { messages: [], context: [] };
  }
}

// -----------------------------
// Optional Llama Guard
// -----------------------------
async function runLlamaGuard(input: string): Promise<string> {
  try {
    const response = await guard.chat({
      model: "llama-guard3:8b",
      messages: [{ role: "user", content: input }],
      stream: false,
    });

    return response.message?.content || "UNKNOWN";
  } catch (err) {
    console.error("Llama Guard error:", err);
    return "ERROR";
  }
}

// -----------------------------
// API Endpoints
// -----------------------------

// GET Collection
app.get("/api/collection", async (req: Request, res: Response) => {
  const collection = await getCollection("data");
  const items = await collection.get();
  console.log();
  res.json({
    items,
  });
});

// POST Chat Streaming API
app.post(
  "/api/chat-stream",
  safetyFilter,
  async (req: Request, res: Response) => {
    const sessionId = String(req.body.sessionId || "default");
    const userMessage: string = req.body.message;

    ensureSession(sessionId);

    // Add user message
    sessions[sessionId].messages.push({
      role: "user",
      content: userMessage,
    });

    // RAG retrieval
    const ragChunks = await retrieveContext(userMessage, 5);
    const ragContext = ragChunks.join("\n\n");

    const ragSystemPrompt = {
      role: "system" as const,
      content: `Context: ${ragContext}
    `.trim(),
    };

    const messages = [
      ragSystemPrompt,
      systemPrompt,
      ...sessions[sessionId].messages,
    ];

    res.setHeader("Content-Type", "text/plain; charset=utf-8");

    const stream = await ollama.chat({
      model: "kraus-cloud-llama",
      messages,
      stream: true,
      context: sessions[sessionId].context ?? [],
    } as any);

    let lastChunk: ChatResponse | null = null;
    let assistantReply = "";

    for await (const chunk of stream) {
      lastChunk = chunk;
      const text = chunk.message?.content || "";
      assistantReply += text;
      res.write(text);
    }

    res.end();

    if (assistantReply.trim().length > 0) {
      sessions[sessionId].messages.push({
        role: "assistant",
        content: assistantReply,
      });
    }

    if (lastChunk && (lastChunk as any).context) {
      sessions[sessionId].context = (lastChunk as any).context;
    }
  },
);

// POST Chat JSON API
app.post(
  "/api/chat-json",
  safetyFilter,
  async (req: Request, res: Response) => {
    const sessionId = String(req.body.sessionId || "default");
    const userMessage: string = req.body.message;

    ensureSession(sessionId);

    // Safety check
    const verdict = await runLlamaGuard(userMessage);
    console.log(verdict);
    if (!verdict.toLowerCase().includes("safe")) {
      return res.json({
        message: "Your request was blocked by safety filters.",
        safety: verdict,
      });
    }

    // Add user message to history
    sessions[sessionId].messages.push({
      role: "user",
      content: userMessage,
    });

    // RAG retrieval
    const ragChunks = await retrieveContext(userMessage, 5);
    const ragContext = ragChunks.join("\n\n");

    const ragSystemPrompt = {
      role: "system" as const,
      content: `Context: ${ragContext}`.trim(),
    };

    // Build messages exactly like streaming endpoint
    const messages = [
      ragSystemPrompt,
      systemPrompt,
      ...sessions[sessionId].messages,
    ];

    // Call Ollama (non-streaming)
    const response: ChatResponse = await ollama.chat({
      model: "kraus-cloud-llama",
      messages,
      stream: false,
    });

    const assistantMessage = response.message?.content || "";

    // Save assistant reply
    sessions[sessionId].messages.push({
      role: "assistant",
      content: assistantMessage,
    });

    // Save updated KV cache
    const responseWithContext = response as any;
    if (responseWithContext.context) {
      sessions[sessionId].context = responseWithContext.context;
    }

    res.json({
      reply: assistantMessage,
      context: (response as any).context,
    });
  },
);

// -----------------------------
// Start Server
// -----------------------------
console.log(`Starting server in ${process.env.NODE_ENV} mode...`);
console.log(`Starting server with ${process.env.DEV_ENV_IP_ADDR} address...`);
console.log(`Chroma URL ${process.env.CHROMA_URL}`);

if (process.env.NODE_ENV === "development") {
  createHttpServer(app).listen(8000, "0.0.0.0", () => {
    console.log("HTTP server running on http://0.0.0.0:8000");
  });
} else {
  createHttpServer(app).listen(8000, "0.0.0.0", () => {
    console.log("HTTP server running on http://0.0.0.0:8000");
  });
}
