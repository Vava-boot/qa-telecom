require("dotenv").config();
const express   = require("express");
const cors      = require("cors");
const rateLimit = require("express-rate-limit");

const app  = express();
const PORT = process.env.PORT || 3001;

app.set("trust proxy", 1);

app.use(cors({ origin: true, methods: ["GET","POST","OPTIONS"], credentials: false }));
app.options("*", cors());

app.use(express.json({ limit: "1mb" }));

app.use("/api/", rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Muitas requisições. Tente novamente em alguns minutos." }
}));

function sanitize(str, maxLen = 8000) {
  if (typeof str !== "string") return "";
  return str.replace(/<[^>]*>/g, "").trim().slice(0, maxLen);
}

function validateEvalRequest(body) {
  const { agent, company, type, transcript } = body;
  if (!agent    || typeof agent    !== "string" || agent.trim().length < 2)          return "Campo 'agent' inválido.";
  if (!company  || typeof company  !== "string" || company.trim().length < 1)         return "Campo 'company' inválido.";
  if (!["Ligação", "Chat"].includes(type))                                            return "Campo 'type' deve ser 'Ligação' ou 'Chat'.";
  if (!transcript || typeof transcript !== "string" || transcript.trim().length < 10) return "Transcrição muito curta ou ausente.";
  return null;
}

function buildPrompt(agent, company, type, transcript) {
  const criteriosLigacao = `saudacao (Saudação), tom_voz (Tom de Voz), tempo_espera (Tempo de Espera), tempo_atendimento (Tempo de Atendimento), uso_mudo (Utilização do Mudo), personalizacao (Personalização), tratativa (Tratativa sondagem resolução), gramatica (Gramática), dados_obrigatorios (Dados obrigatórios), protocolo_encerramento (Protocolo e Encerramento)`;
  const criteriosChat    = `saudacao (Saudação), empatia (Empatia), tempo_espera (Tempo de Espera), tempo_atendimento (Tempo de Atendimento), tempo_resposta (Tempo de Resposta), gramatica (Gramática), sondagem (Sondagem), confirmacao_dados (Confirmação de Dados), personalizacao (Personalização), protocolo_encerramento (Protocolo e Encerramento)`;

  return `Você atua como Avaliador de Qualidade (QA) Sênior de Telecomunicações (N1/N2).
Analise o ${type} do agente ${sanitize(agent, 100)} na empresa ${sanitize(company, 100)}.

REGRAS:
- Nota 10 exige perfeição absoluta.
- Falhas críticas de processo (não confirmar CPF/dados, não fornecer protocolo) resultam em nota 0-4 no critério.
- Seja rigoroso. Não invente dados que não estejam na transcrição.
- Use o primeiro nome do agente no feedback (ex: "Artur, ...").
- Feedbacks construtivos: elogio genuíno + ponto de melhoria respeitoso.
- Pontos Fortes e Pontos a Desenvolver: máximo 2 frases diretas cada.

CONTEÚDO DO ATENDIMENTO:
${sanitize(transcript, 7000)}

CRITÉRIOS PARA AVALIAR (0-10 cada):
${type === "Chat" ? criteriosChat : criteriosLigacao}

Responda SOMENTE em JSON válido, sem markdown, sem explicações fora do JSON:
{"criteria":[{"id":"saudacao","score":8,"obs":"observação detalhada"},{"id":"tom_voz","score":7,"obs":"..."},{"id":"tempo_espera","score":9,"obs":"..."},{"id":"tempo_atendimento","score":7,"obs":"..."},{"id":"uso_mudo","score":6,"obs":"..."},{"id":"personalizacao","score":7,"obs":"..."},{"id":"tratativa","score":8,"obs":"..."},{"id":"gramatica","score":8,"obs":"..."},{"id":"dados_obrigatorios","score":9,"obs":"..."},{"id":"protocolo_encerramento","score":6,"obs":"..."}],"pontos_fortes":"texto curto e direto","pontos_desenvolver":"texto curto e direto","feedback":"Feedback construtivo usando primeiro nome do agente"}`;
}

app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    key_configured: !!process.env.OPENROUTER_API_KEY,
    node: process.version,
    port: PORT
  });
});

app.get("/api/test-openrouter", async (_req, res) => {
  if (!process.env.OPENROUTER_API_KEY)
    return res.status(500).json({ error: "Chave não configurada." });
  try {
    const r = await fetch("https://openrouter.ai/api/v1/models", {
      headers: {
        "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "HTTP-Referer":  "https://qa-telecom-jzym.vercel.app",
        "X-Title":       "QA Telecom Monitor"
      }
    });
    const data = await r.json();
    if (!r.ok) return res.status(r.status).json({ error: data });
    return res.json({ status: "ok", models_count: data.data?.length });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.post("/api/evaluate", async (req, res) => {
  const validationError = validateEvalRequest(req.body);
  if (validationError) return res.status(400).json({ error: validationError });

  const { agent, company, type, transcript } = req.body;

  if (!process.env.OPENROUTER_API_KEY) {
    console.error("[ERRO] OPENROUTER_API_KEY não configurada");
    return res.status(500).json({ error: "Chave de API não configurada no servidor." });
  }

  try {
    console.log(`[INFO] Avaliando — ${agent} | ${company} | ${type}`);

    const controller = new AbortController();
    const timeout    = setTimeout(() => controller.abort(), 25000);

    let openRouterRes;
    try {
      openRouterRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type":  "application/json",
          "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "HTTP-Referer":  "https://qa-telecom-jzym.vercel.app",
          "X-Title":       "QA Telecom Monitor"
        },
        body: JSON.stringify({
          // Modelo principal + fallback automático conforme docs do OpenRouter
          models: [
            "google/gemini-2.0-flash-001",
            "google/gemini-flash-1.5",
            "meta-llama/llama-3.1-8b-instruct:free"
          ],
          max_tokens:  1200,
          temperature: 0.3,
          // Garante que o OpenRouter só usa provedores que retornam JSON corretamente
          provider: {
            allow_fallbacks: true
          },
          messages: [
            {
              role:    "system",
              content: "Você é um sistema de avaliação de qualidade de atendimento. Responda SEMPRE e SOMENTE em JSON válido, sem markdown."
            },
            {
              role:    "user",
              content: buildPrompt(agent, company, type, transcript)
            }
          ]
        })
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!openRouterRes.ok) {
      const errText = await openRouterRes.text();
      console.error(`[ERRO] OpenRouter HTTP ${openRouterRes.status}:`, errText);
      return res.status(502).json({
        error: `Erro ao consultar IA (HTTP ${openRouterRes.status}). Verifique a chave e tente novamente.`
      });
    }

    const data = await openRouterRes.json();
    const raw  = data.choices?.[0]?.message?.content || "";

    console.log(`[INFO] Modelo usado: ${data.model}`);

    if (!raw) {
      console.error("[ERRO] Resposta vazia:", JSON.stringify(data));
      return res.status(502).json({ error: "Resposta vazia da IA. Tente novamente." });
    }

    let parsed;
    try {
      parsed = JSON.parse(raw.replace(/```json|```/gi, "").trim());
    } catch {
      console.error("[ERRO] JSON inválido:", raw);
      return res.status(502).json({ error: "Resposta da IA em formato inválido. Tente novamente." });
    }

    if (!Array.isArray(parsed.criteria) || parsed.criteria.length < 10) {
      console.error("[ERRO] Criteria insuficientes:", parsed.criteria?.length);
      return res.status(502).json({ error: "Resposta da IA incompleta. Tente novamente." });
    }

    const avg   = parsed.criteria.reduce((s, c) => s + Number(c.score), 0) / parsed.criteria.length;
    const score = Math.round(avg * 10) / 10;

    console.log(`[INFO] Concluído — score: ${score}`);

    return res.json({
      criteria:           parsed.criteria,
      score,
      pontos_fortes:      parsed.pontos_fortes      || "",
      pontos_desenvolver: parsed.pontos_desenvolver  || "",
      feedback:           parsed.feedback            || ""
    });

  } catch (err) {
    if (err.name === "AbortError") {
      console.error("[ERRO] Timeout — OpenRouter não respondeu em 25s");
      return res.status(502).json({ error: "A IA demorou muito para responder. Tente novamente." });
    }
    console.error("[ERRO] Exceção:", err.message);
    return res.status(500).json({ error: "Erro interno. Tente novamente." });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Servidor rodando na porta ${PORT}`);
  console.log(`🔑 Chave: ${!!process.env.OPENROUTER_API_KEY ? "configurada ✓" : "NÃO CONFIGURADA ✗"}`);
});
