require("dotenv").config();
const express   = require("express");
const cors      = require("cors");
const rateLimit = require("express-rate-limit");

const app  = express();
const PORT = process.env.PORT || 3001;

// ── IMPORTANTE PARA RAILWAY ────────────────────────────────────────────────
app.set("trust proxy", 1);

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
  legacyHeaders: false,
  message: { error: "Muitas requisições. Tente novamente em alguns minutos." }
}));

// ── HELPERS ────────────────────────────────────────────────────────────────
function sanitize(str, maxLen = 8000) {
  if (typeof str !== "string") return "";
  return str.replace(/<[^>]*>/g, "").trim().slice(0, maxLen);
}

function validateEvalRequest(body) {
  const { agent, company, type, transcript } = body;

  if (!agent || agent.trim().length < 2)
    return "Campo 'agent' inválido.";

  if (!company || company.trim().length < 1)
    return "Campo 'company' inválido.";

  if (!["Ligação", "Chat"].includes(type))
    return "Campo 'type' deve ser 'Ligação' ou 'Chat'.";

  if (!transcript || transcript.trim().length < 10)
    return "Transcrição muito curta ou ausente.";

  return null;
}

function buildPrompt(agent, company, type, transcript) {
  const criteriosLigacao = `saudacao, tom_voz, tempo_espera, tempo_atendimento, uso_mudo, personalizacao, tratativa, gramatica, dados_obrigatorios, protocolo_encerramento`;
  const criteriosChat    = `saudacao, empatia, tempo_espera, tempo_atendimento, tempo_resposta, gramatica, sondagem, confirmacao_dados, personalizacao, protocolo_encerramento`;

  return `Você é um QA Sênior de Telecom.

Analise o atendimento (${type}) do agente ${sanitize(agent)} na empresa ${sanitize(company)}.

REGRAS:
- Nota 10 = perfeito
- Seja rigoroso
- NÃO invente dados
- Use o primeiro nome no feedback
- Responda SOMENTE JSON válido

TRANSCRIÇÃO:
${sanitize(transcript)}

CRITÉRIOS:
${type === "Chat" ? criteriosChat : criteriosLigacao}

FORMATO:
{
  "criteria":[{"id":"saudacao","score":8,"obs":"texto"}],
  "pontos_fortes":"...",
  "pontos_desenvolver":"...",
  "feedback":"..."
}`;
}

// ── HEALTH ────────────────────────────────────────────────────────────────
app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    key_configured: !!process.env.OPENROUTER_API_KEY
  });
});

// ── ROTA PRINCIPAL ────────────────────────────────────────────────────────
app.post("/api/evaluate", async (req, res) => {
  const error = validateEvalRequest(req.body);
  if (error) return res.status(400).json({ error });

  const { agent, company, type, transcript } = req.body;

  if (!process.env.OPENROUTER_API_KEY) {
    return res.status(500).json({ error: "API Key não configurada" });
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25000);

    let openRouterRes;

    try {
      openRouterRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "HTTP-Referer": "https://qa-telecom-jzym.vercel.app",
          "X-Title": "QA Telecom"
        },
        body: JSON.stringify({
          model: "openai/gpt-4o-mini", // 🔥 MAIS ESTÁVEL
          temperature: 0.3,
          max_tokens: 1200,
          messages: [
            {
              role: "system",
              content: "Responda SOMENTE JSON válido."
            },
            {
              role: "user",
              content: buildPrompt(agent, company, type, transcript)
            }
          ]
        })
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!openRouterRes.ok) {
      const err = await openRouterRes.text();
      console.error("OpenRouter erro:", err);
      return res.status(502).json({ error: "Erro na IA" });
    }

    const data = await openRouterRes.json();

    // 🔥 DEBUG
    console.log("OPENROUTER RESPONSE:", JSON.stringify(data, null, 2));

    // ── TRATAMENTO UNIVERSAL ─────────────────────────────
    let raw = data.choices?.[0]?.message?.content;

    if (Array.isArray(raw)) {
      raw = raw.map(p => p.text || "").join("");
    }

    raw = raw || "";

    if (!raw) {
      return res.status(502).json({ error: "Resposta vazia da IA" });
    }

    console.log("RAW:", raw);

    // ── EXTRAÇÃO SEGURA DE JSON ──────────────────────────
    const cleaned = raw.replace(/```json|```/gi, "").trim();
    const match = cleaned.match(/\{[\s\S]*\}/);

    if (!match) {
      return res.status(502).json({ error: "JSON inválido da IA" });
    }

    let parsed;

    try {
      parsed = JSON.parse(match[0]);
    } catch (e) {
      console.error("Erro parse:", e.message);
      return res.status(502).json({ error: "Erro ao interpretar IA" });
    }

    if (!Array.isArray(parsed.criteria)) {
      return res.status(502).json({ error: "Resposta incompleta" });
    }

    const avg = parsed.criteria.reduce((s, c) => s + Number(c.score), 0) / parsed.criteria.length;

    return res.json({
      criteria: parsed.criteria,
      score: Math.round(avg * 10) / 10,
      pontos_fortes: parsed.pontos_fortes || "",
      pontos_desenvolver: parsed.pontos_desenvolver || "",
      feedback: parsed.feedback || ""
    });

  } catch (err) {
    if (err.name === "AbortError") {
      return res.status(502).json({ error: "Timeout da IA" });
    }

    console.error("Erro geral:", err);
    return res.status(500).json({ error: "Erro interno" });
  }
});

// ── START ────────────────────────────────────────────────────────────────
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
