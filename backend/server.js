require("dotenv").config();
const express   = require("express");
const cors      = require("cors");
const rateLimit = require("express-rate-limit");

const app  = express();
const PORT = process.env.PORT || 3001;

// ── IMPORTANTE PARA RAILWAY ──
app.set("trust proxy", 1);

// ── CORS ──
app.use(cors({
  origin: true,
  methods: ["GET","POST","OPTIONS"],
  credentials: false
}));
app.options("*", cors());

// ── BODY ──
app.use(express.json({ limit: "1mb" }));

// ── RATE LIMIT ──
app.use("/api/", rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Muitas requisições. Tente novamente em alguns minutos." }
}));

// ── HELPERS ──
function sanitize(str, maxLen = 8000) {
  if (typeof str !== "string") return "";
  return str.replace(/<[^>]*>/g, "").trim().slice(0, maxLen);
}

function validateEvalRequest(body) {
  const { agent, company, type, transcript } = body;

  if (!agent || agent.trim().length < 2) return "Campo 'agent' inválido.";
  if (!company || company.trim().length < 1) return "Campo 'company' inválido.";
  if (!["Ligação", "Chat"].includes(type)) return "Campo 'type' inválido.";
  if (!transcript || transcript.trim().length < 10) return "Transcrição muito curta.";

  return null;
}

function buildPrompt(agent, company, type, transcript) {
  return `Você atua como Avaliador de Qualidade (QA) Sênior de Telecom.

Analise o atendimento do agente ${sanitize(agent)} da empresa ${sanitize(company)} (${type}).

Transcrição:
${sanitize(transcript, 7000)}

Responda SOMENTE em JSON válido:

{
  "criteria":[
    {"id":"saudacao","score":8,"obs":"..."}
  ],
  "pontos_fortes":"...",
  "pontos_desenvolver":"...",
  "feedback":"..."
}`;
}

// ── HEALTH ──
app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    key_configured: !!process.env.OPENROUTER_API_KEY,
    port: PORT
  });
});

// ── AVALIAÇÃO ──
app.post("/api/evaluate", async (req, res) => {
  console.log("=================================");
  console.log("🚀 NOVA REQUISIÇÃO /api/evaluate");
  console.log("🔑 KEY PRESENTE?", !!process.env.OPENROUTER_API_KEY);
  console.log("=================================");

  const error = validateEvalRequest(req.body);
  if (error) return res.status(400).json({ error });

  try {
    const { agent, company, type, transcript } = req.body;

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "HTTP-Referer": "https://qa-telecom-jzym.vercel.app",
        "X-Title": "QA Telecom Monitor"
      },
      body: JSON.stringify({
        model: "openai/gpt-4o-mini",
        temperature: 0.3,
        max_tokens: 1200,
        messages: [
          {
            role: "system",
            content: "Você é um sistema de avaliação de qualidade. Responda SOMENTE em JSON válido."
          },
          {
            role: "user",
            content: buildPrompt(agent, company, type, transcript)
          }
        ]
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("❌ ERRO OPENROUTER:", JSON.stringify(data));
      return res.status(502).json({ error: data.error?.message || "Erro na IA" });
    }

    const raw = data.choices?.[0]?.message?.content;

    if (!raw) {
      console.error("❌ Resposta vazia:", data);
      return res.status(502).json({ error: "Resposta vazia da IA" });
    }

    let parsed;

    try {
      parsed = JSON.parse(raw.replace(/```json|```/gi, "").trim());
    } catch (err) {
      console.error("❌ JSON inválido:", raw);
      return res.status(502).json({ error: "Resposta da IA em JSON inválido" });
    }

    console.log("✅ Avaliação gerada com sucesso");

    return res.json(parsed);

  } catch (err) {
    console.error("❌ ERRO GERAL:", err.message);
    return res.status(500).json({ error: "Erro interno no servidor" });
  }
});

// ── START ──
app.listen(PORT, "0.0.0.0", () => {
  console.log("=================================");
  console.log("🚀 Servidor rodando na porta", PORT);
  console.log("🔑 KEY CONFIGURADA?", !!process.env.OPENROUTER_API_KEY);
  console.log("=================================");
});
