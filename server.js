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

// POST Chat Streaming API
app.post("/api/chat-stream", async (req, res) => {
  const sessionId = String(req.body.sessionId || "default");
  const userMessage = req.body.message;

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
    messages: sessions[sessionId].messages, // <-- full history
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
app.post("/api/chat-json", async (req, res) => {
  const sessionId = String(req.body.sessionId || "default");
  const { message } = req.body;

  ensureSession(sessionId);

  //Run Llama Guard
  const verdict = await runLlamaGuard(message);
  if (!verdict.includes("SAFE")) {
    return res.json({
      reply: "Your request was blocked by safety filters.",
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
    messages: sessions[sessionId].messages, // <-- THIS is the real memory
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

// Posts Database (move to PostgreSQL in Production)
let posts = [
  {
    id: "5",
    title: "Lab 3 — Switch",
    date: "2-16-2025",
    length: {
      minutes: "40",
      seconds: "00",
    },
    icon: "fas fa-mug-hot",
    mugs: 4,
    tagline: "Connect your network.",
    path: "/pages/switch",
    imagePath: "/images/infrared-eye.webp",
    imageAltText: "Infrared eye.",
    priority: true,
    previewText: `Our Netgate security appliance comes with four wired ethernet
      interfaces, but one is already in use as our uplink and the other
      three aren't enough to meet our lab's needs. We're going to need
      more interfaces so we'll be connecting an 8-port (interface)
      gigabit ethernet switch to our firewall in this post. In fact, we'll be
      doing a lot more than just connecting our switch to our firewall. 
      Other objectives include dividing our ten (10) physical interfaces
      into five (5) separate Virtual Local Area Networks (VLANs), disabling 
      inter-VLAN routing, hardening our switch, and backing up our configuration.
      `,
  },
  {
    id: "4",
    title: "Lab 2 — pfSense",
    date: "11-15-2024",
    length: {
      minutes: "60",
      seconds: "00",
    },
    icon: "fas fa-mug-hot",
    mugs: 4,
    tagline: "Secure your network.",
    path: "/pages/pfsense",
    imagePath: "/images/fire.webp",
    imageAltText: "Flame",
    priority: true,
    previewText: `pfSense running on a Netgate 4200 appliance not only provides our
      lab with network security, but it will also serve as our lab's
      core router. pfSense also boasts a lot of other functionality that
      we'll be leveraging throughout this series and beyond. The best
      part, pfSense is completely free and open source! This post is a
      bit on the longer side, but hang in there because it's chock-full
      of good stuff that's at the foundation of our home lab and core to
      learning networking and cybersecurity.`,
  },
  {
    id: "3",
    title: "Lab 1 — Gear Up",
    date: "10-31-2024",
    length: {
      minutes: "10",
      seconds: "00",
    },
    icon: "fas fa-mug-hot",
    mugs: 2,
    tagline: "Building a home lab? Let's gear up.",
    path: "/pages/lab-components",
    imagePath: "/images/sparkle.webp",
    imageAltText: "Sparkle",
    priority: true,
    previewText: `By the end of this lab, you will have built your own personal
      cloud consisting of a virtualization server to run your applications, a security appliance
      to help ensure your network is locked down, a network switch
      virtualized into four separate virtual networks, and an endless
      number of possibitlies for how to use your home lab. It's not much
      of a cloud if you don't have a presence on the web, so this lab
      will also include guidance on how to build a NextJS web app and
      deploy it on your own NGINX web server. Start thinking of a name
      for your cloud and review the rundown of required components
      listed below. Let's gear up and go!`,
  },
  {
    id: "2",
    title: "Figma Slider",
    date: "7-14-2022",
    length: {
      minutes: "15",
      seconds: "00",
    },
    icon: "fas fa-mug-hot",
    mugs: 3,
    tagline: "Create a range slider in Figma.",
    path: "/pages/figma-slider",
    imagePath: "/images/spring.webp",
    imageAltText: "Spring",
    priority: true,
    unoptomized: true,
    previewText: `I'm building a mockup in Figma for a new feature at work and I've
      been asked to include a range slider that allows a user to change
      "synonym sensitivity" on a scale from 1 to 100. I figured building a
      slider in Figma would be a worthy challenge and one worth sharing.
      What's more, this tutorial will expose you to highly useful Figma
      concepts such as components/variants, constraints, interactions, and
      basic styling. Let's jump in!`,
  },
  {
    id: "1",
    title: "Ready Set Go",
    date: "6-3-2021",
    length: {
      minutes: "10",
      seconds: "00",
    },
    icon: "fas fa-mug-hot",
    mugs: 2,
    tagline: "Publish your app with GitHub Pages.",
    path: "/pages/ready-set-go",
    imagePath: "/images/code.webp",
    imageAltText: "Code",
    priority: true,
    previewText: `So, you've dabbled with create-react-app and you're ready to build and share something amazing with the world. Now what? This post will walk you through creating a GitHub repository to manage and back up your application as well as using GitHub Pages to publish your app to the web.`,
  },
];
