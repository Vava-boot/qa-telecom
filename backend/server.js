require("dotenv").config();
const express   = require("express");
const cors      = require("cors");
const rateLimit = require("express-rate-limit");

const app  = express();
const PORT = process.env.PORT || 3001;

// ── IMPORTANTE PARA RAILWAY ────────────────────────────────────────────────
app.set("trust proxy", 1);

// 🔥 DEBUG GLOBAL (RODA AO INICIAR)
console.log("=================================");
console.log("🔑 OPENROUTER_API_KEY (raw):", process.env.OPENROUTER_API_KEY);
console.log("🔑 LENGTH:", process.env.OPENROUTER_API_KEY?.length);
console.log("=================================");

// ── CORS ──────────────────────────────────────────────────────────────────
app.use(cors({
  origin: true,
  methods: ["GET","POST","OPTIONS"],
  credentials: false
}));
app.options("*", cors());

// ── BODY ──────────────────────────────────────────────────────────────────
app.use(express.json({ limit: "1mb" }));

// ── RATE LIMIT ─────────────────────────────────────────────────────────────
app.use("/api/", rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false
}));

// ── HELPERS ────────────────────────────────────────────────────────────────
function sanitize(str, maxLen = 8000) {
  if (typeof str !== "string") return "";
  return str.replace(/<[^>]*>/g, "").trim().slice(0, maxLen);
}

function validateEvalRequest(body) {
  const { agent, company, type, transcript } = body;

  if (!agent || agent.trim().length < 2) return "Campo 'agent' inválido.";
  if (!company || company.trim().length < 1) return "Campo 'company' inválido.";
  if (!["Ligação", "Chat"].includes(type)) return "Tipo inválido.";
  if (!transcript || transcript.trim().length < 10) return "Transcrição inválida.";

  return null;
}

function buildPrompt(agent, company, type, transcript) {
  return `Avalie o atendimento de ${agent} (${type}) na empresa ${company}.

Transcrição:
${transcript}

Responda SOMENTE em JSON com:
criteria[], pontos_fortes, pontos_desenvolver, feedback`;
}

// ── HEALTH ────────────────────────────────────────────────────────────────
app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    key_exists: !!process.env.OPENROUTER_API_KEY
  });
});

// ── ROTA PRINCIPAL ────────────────────────────────────────────────────────
app.post("/api/evaluate", async (req, res) => {

  console.log("=================================");
  console.log("🚀 NOVA REQUISIÇÃO /api/evaluate");

  // 🔥 DEBUG POR REQUEST
  console.log("🔑 KEY PRESENTE?", !!process.env.OPENROUTER_API_KEY);
  console.log("🔑 KEY LENGTH:", process.env.OPENROUTER_API_KEY?.length);
  console.log("=================================");

  const error = validateEvalRequest(req.body);
  if (error) return res.status(400).json({ error });

  if (!process.env.OPENROUTER_API_KEY) {
    return res.status(500).json({ error: "API Key não configurada" });
  }

  try {
    const { agent, company, type, transcript } = req.body;

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "HTTP-Referer": "https://qa-telecom-jzym.vercel.app",
        "X-Title": "QA Telecom"
      },
      body: JSON.stringify({
        model: "openai/gpt-4o-mini",
        messages: [
          { role: "system", content: "Responda somente JSON válido" },
          { role: "user", content: buildPrompt(agent, company, type, transcript) }
        ]
      })
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("❌ ERRO OPENROUTER:", err);
      return res.status(502).json({ error: err });
    }

    const data = await response.json();

    console.log("📦 RESPONSE:", JSON.stringify(data, null, 2));

    let raw = data.choices?.[0]?.message?.content;

    if (Array.isArray(raw)) {
      raw = raw.map(p => p.text || "").join("");
    }

    raw = raw || "";

    console.log("🧠 RAW:", raw);

    const cleaned = raw.replace(/```json|```/gi, "").trim();
    const match = cleaned.match(/\{[\s\S]*\}/);

    if (!match) {
      return res.status(502).json({ error: "JSON inválido" });
    }

    const parsed = JSON.parse(match[0]);

    const avg = parsed.criteria.reduce((s, c) => s + Number(c.score), 0) / parsed.criteria.length;

    return res.json({
      criteria: parsed.criteria,
      score: Math.round(avg * 10) / 10,
      pontos_fortes: parsed.pontos_fortes || "",
      pontos_desenvolver: parsed.pontos_desenvolver || "",
      feedback: parsed.feedback || ""
    });

  } catch (err) {
    console.error("💥 ERRO GERAL:", err);
    return res.status(500).json({ error: "Erro interno" });
  }
});

// ── START ────────────────────────────────────────────────────────────────
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
});
