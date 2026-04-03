require("dotenv").config();
const express   = require("express");
const cors      = require("cors");
const rateLimit = require("express-rate-limit");

const app  = express();
const PORT = process.env.PORT || 3001;

// ── IMPORTANTE PARA RAILWAY ─────────────────────────────────────
app.set("trust proxy", 1);

// ── CORS ────────────────────────────────────────────────────────
app.use(cors({
  origin: true,
  methods: ["GET","POST","OPTIONS"],
  credentials: false
}));
app.options("*", cors());

// ── BODY ────────────────────────────────────────────────────────
app.use(express.json({ limit: "1mb" }));

// ── RATE LIMIT ──────────────────────────────────────────────────
app.use("/api/", rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
}));

// ── HELPERS ─────────────────────────────────────────────────────
function sanitize(str, maxLen = 8000) {
  if (typeof str !== "string") return "";
  return str.replace(/<[^>]*>/g, "").trim().slice(0, maxLen);
}

function validateEvalRequest(body) {
  const { agent, company, type, transcript } = body;

  if (!agent || agent.length < 2) return "Campo 'agent' inválido.";
  if (!company) return "Campo 'company' inválido.";
  if (!["Ligação", "Chat"].includes(type)) return "Tipo inválido.";
  if (!transcript || transcript.length < 10) return "Transcrição inválida.";

  return null;
}

function buildPrompt(agent, company, type, transcript) {
  return `
Você é um avaliador de qualidade de atendimento telecom.

Analise o atendimento do agente ${agent} na empresa ${company}.

Transcrição:
${transcript}

Responda SOMENTE em JSON:
{
  "criteria":[{"id":"saudacao","score":8,"obs":"texto"}],
  "pontos_fortes":"texto",
  "pontos_desenvolver":"texto",
  "feedback":"texto"
}
`;
}

// ── HEALTH CHECK ────────────────────────────────────────────────
app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    key_configured: !!process.env.OPENROUTER_API_KEY,
  });
});

// ── TESTE DIRETO OPENROUTER ─────────────────────────────────────
app.get("/api/test-openrouter", async (_req, res) => {
  try {
    const response = await fetch("https://openrouter.ai/api/v1/models", {
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`
      }
    });

    const data = await response.json();

    return res.json({
      ok: response.ok,
      status: response.status,
      data
    });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ── AVALIAÇÃO ───────────────────────────────────────────────────
app.post("/api/evaluate", async (req, res) => {
  console.log("🚀 NOVA REQUISIÇÃO /api/evaluate");

  const validationError = validateEvalRequest(req.body);
  if (validationError) {
    return res.status(400).json({ error: validationError });
  }

  const { agent, company, type, transcript } = req.body;

  if (!process.env.OPENROUTER_API_KEY) {
    return res.status(500).json({ error: "API KEY não configurada." });
  }

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://qa-telecom-jzym.vercel.app",
        "X-Title": "QA Telecom Monitor"
      },
      body: JSON.stringify({
        model: "openai/gpt-4o-mini",
        messages: [
          { role: "system", content: "Responda apenas em JSON válido." },
          { role: "user", content: buildPrompt(agent, company, type, transcript) }
        ],
        temperature: 0.3
      })
    });

    const text = await response.text();

    if (!response.ok) {
      console.error("❌ ERRO OPENROUTER:", text);
      return res.status(502).json({ error: "Erro na IA", details: text });
    }

    let parsed;

    try {
      parsed = JSON.parse(text);
    } catch {
      console.error("❌ JSON inválido:", text);
      return res.status(502).json({ error: "JSON inválido da IA" });
    }

    const content = parsed.choices?.[0]?.message?.content;

    let final;

    try {
      final = JSON.parse(content);
    } catch {
      console.error("❌ JSON interno inválido:", content);
      return res.status(502).json({ error: "Resposta mal formatada" });
    }

    return res.json(final);

  } catch (err) {
    console.error("❌ ERRO GERAL:", err.message);
    return res.status(500).json({ error: "Erro interno" });
  }
});

// ── START ───────────────────────────────────────────────────────
app.listen(PORT, "0.0.0.0", () => {
  console.log("=================================");
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
  console.log(`🔑 KEY CONFIGURADA? ${!!process.env.OPENROUTER_API_KEY}`);
  console.log("=================================");
});
