require("dotenv").config({
  path: process.env.NODE_ENV === "production" ? ".env.production" : ".env",
});
const express = require("express");
const fs = require("fs");
const https = require("https");
const http = require("http");
const cors = require("cors");
const { Ollama } = require("ollama");
const ollama = new Ollama();
const guard = new Ollama();
const safetyFilter = require("./middleware/safetyFilter");
const posts = require("./data/posts");

const app = express();
app.use(express.json());

app.use(
  cors({
    origin: ["http://localhost:3000", "https://krauscloud.com:3000"],
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
  }),
);

//  GET Posts API
app.get("/api/posts", (req, res) => {
  res.json(posts);
});

// System Prompt
const systemPrompt = {
  role: "system",
  content: ` You are a safe and helpful assistant. You do not execute code, run commands, create files, or generate binary or base64-encoded data. If a user asks you to run code, produce executable output, or perform actions on a system, you must refuse. You only provide natural-language explanations, guidance, and reasoning. If you are unsure whether a request is safe, you choose the safest option and refuse. `,
};

const sessions = {}; // in-memory store

// Ensure session structure
function ensureSession(sessionId) {
  if (
    !sessions[sessionId] ||
    typeof sessions[sessionId] !== "object" ||
    !Array.isArray(sessions[sessionId].messages) ||
    !Array.isArray(sessions[sessionId].context)
  ) {
    sessions[sessionId] = { messages: [], context: [] };
  }
}

// Run Llama Guard
async function runLlamaGuard(input) {
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

// POST Chat Streaming API
app.post("/api/chat-stream", safetyFilter, async (req, res) => {
  const sessionId = String(req.body.sessionId || "default");
  const userMessage = req.body.message;
  const messages = [systemPrompt, ...sessions[sessionId].messages];

  ensureSession(sessionId);

  //Run Llama Guard
  const verdict = await runLlamaGuard(userMessage);
  if (!verdict.includes("SAFE")) {
    res.write("Your request was blocked by safety filters.");
    return res.end();
  }

  // Initialize session if needed
  if (!sessions[sessionId]) {
    sessions[sessionId] = { messages: [], context: [] };
  }

  // Add the new user message to the conversation history
  sessions[sessionId].messages.push({
    role: "user",
    content: userMessage,
  });

  res.setHeader("Content-Type", "text/plain; charset=utf-8");

  // Call Ollama with full message history + context
  const stream = await ollama.chat({
    model: "llama3.1:8b",
    messages: messages, // <-- full history
    context: sessions[sessionId].context, // <-- KV cache
    stream: true,
  });

  let lastChunk = null;
  let assistantReply = "";

  // Stream chunks to client
  for await (const chunk of stream) {
    lastChunk = chunk;

    const text = chunk.message?.content || "";
    assistantReply += text;

    res.write(text);
  }

  res.end();

  // Add assistant reply to message history
  if (assistantReply.trim().length > 0) {
    sessions[sessionId].messages.push({
      role: "assistant",
      content: assistantReply,
    });
  }

  // Save updated context
  if (lastChunk?.context) {
    sessions[sessionId].context = lastChunk.context;
  }
});

// POST Chat JSON API
app.post("/api/chat-json", safetyFilter, async (req, res) => {
  const sessionId = String(req.body.sessionId || "default");
  const { message } = req.body;
  const messages = [systemPrompt, ...sessions[sessionId].messages];

  ensureSession(sessionId);

  //Run Llama Guard
  const verdict = await runLlamaGuard(message);
  if (!verdict.includes("safe")) {
    return res.json({
      message: "Your request was blocked by safety filters.",
      safety: verdict,
    });
  }

  // Initialize session if needed
  if (!sessions[sessionId]) {
    sessions[sessionId] = { messages: [], context: [] };
  }

  // Add the new user message
  sessions[sessionId].messages.push({
    role: "user",
    content: message,
  });

  const response = await ollama.chat({
    model: "llama3.1:8b",
    messages: messages, // <-- THIS is the real memory
    context: sessions[sessionId].context, // <-- optional speed boost
    stream: false,
  });

  // Add assistant reply to message history
  sessions[sessionId].messages.push(response.message);

  // Save updated context (optional)
  if (response.context) {
    sessions[sessionId].context = response.context;
  }

  res.json({
    reply: response.message?.content || "",
    context: response.context,
  });
});

// Start server
console.log(`Starting server in ${process.env.NODE_ENV} mode...`);
if (process.env.NODE_ENV === "production") {
  // Load certs for HTTPS in Production
  const options = {
    key: fs.readFileSync(process.env.CERT_KEY_PATH),
    cert: fs.readFileSync(process.env.CERT_CERT_PATH),
  };
  // Create HTTPS server in Production
  https.createServer(options, app).listen(8000, "0.0.0.0", () => {
    console.log("HTTPS server running on https://0.0.0.0:8000");
  });
} else {
  // Create HTTP server in Development
  http.createServer(app).listen(8000, "0.0.0.0", () => {
    console.log("HTTP server running on http://0.0.0.0:8000");
  });
}
