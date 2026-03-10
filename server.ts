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
  content: `You are a safe and helpful assistant. You do not execute code, run commands, create files, or generate binary or base64-encoded data. If a user asks you to run code, produce executable output, or perform actions on a system, you must refuse. You only provide natural-language explanations, guidance, and reasoning. If you are unsure whether a request is safe, you choose the safest option and refuse.`,
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
      model: "llama-guard:8b",
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
// POST Chat Streaming API
// -----------------------------
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
      content: `
You are the Missouri Vehicle Registration Virtual Assistant.
Use ONLY the information provided in the context below.
If the answer is not present in the context, respond with:
"I cannot find that information in the state records."

Context:
${ragContext}
    `.trim(),
    };

    const messages = [
      ragSystemPrompt,
      systemPrompt,
      ...sessions[sessionId].messages,
    ];

    res.setHeader("Content-Type", "text/plain; charset=utf-8");

    const stream = await ollama.chat({
      model: "llama3.1:8b",
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

// -----------------------------
// GET Collection
// -----------------------------
app.get("/api/collection", async (req: Request, res: Response) => {
  const collection = await getCollection("data");
  const items = await collection.get();
  console.log();
  res.json({
    items,
  });
});

// -----------------------------
// POST Chat JSON API
// -----------------------------
app.post(
  "/api/chat-json",
  safetyFilter,
  async (req: Request, res: Response) => {
    const sessionId = String(req.body.sessionId || "default");
    const { message } = req.body;

    ensureSession(sessionId);

    const verdict = await runLlamaGuard(message);
    if (!verdict.toLowerCase().includes("safe")) {
      return res.json({
        message: "Your request was blocked by safety filters.",
        safety: verdict,
      });
    }

    sessions[sessionId].messages.push({
      role: "user",
      content: message,
    });

    const messages = [systemPrompt, ...sessions[sessionId].messages];

    const response = (await ollama.chat({
      model: "llama3.1:8b",
      messages,
      stream: false,
    })) as any;

    const assistantMessage = response.message?.content || "";
    sessions[sessionId].messages.push({
      role: "assistant",
      content: assistantMessage,
    });

    if (response.context) {
      sessions[sessionId].context = response.context;
    }

    res.json({
      reply: assistantMessage,
      context: response.context,
    });
  },
);

// -----------------------------
// Start Server
// -----------------------------
console.log(`Starting server in ${process.env.NODE_ENV} mode...`);

createHttpServer(app).listen(8000, "0.0.0.0", () => {
  console.log("HTTP server running on http://0.0.0.0:8000");
});
