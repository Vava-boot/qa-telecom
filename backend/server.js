/**
 * QA Telecom — Back-end seguro (Node.js + Express)
 *
 * COMO USAR:
 *   1. npm install express cors express-rate-limit dotenv
 *   2. Crie um arquivo .env com: OPENROUTER_API_KEY=sk-or-...
 *   3. node server.js
 *
 * A chave da API NUNCA sai deste servidor. O front-end
 * chama /api/evaluate e este servidor chama o OpenRouter.
 */

require("dotenv").config();
const express    = require("express");
const cors       = require("cors");
const rateLimit  = require("express-rate-limit");

const app = express();

// 👇 ADICIONE AQUI
app.set("trust proxy", 1);

const PORT = process.env.PORT || 3001;

// ── Middlewares ──────────────────────────────────────────────────────────────

app.use(express.json({ limit: "1mb" })); // limite no tamanho do body

// CORS: em produção, troque pela URL real do seu front-end
const allowedOrigins = (process.env.ALLOWED_ORIGINS || "http://localhost:5173").split(",");
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error("Not allowed by CORS"));
  }
}));

// Rate limiting: máximo 30 avaliações por IP a cada 15 minutos
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { error: "Muitas requisições. Tente novamente em alguns minutos." }
});
app.use("/api/", limiter);

// ── Validação de input ───────────────────────────────────────────────────────

function sanitize(str, maxLen = 8000) {
  if (typeof str !== "string") return "";
  return str.replace(/<[^>]*>/g, "").trim().slice(0, maxLen); // remove HTML tags, limita tamanho
}

function validateEvalRequest(body) {
  const { agent, company, type, transcript } = body;
  if (!agent || typeof agent !== "string" || agent.trim().length < 2)
    return "Campo 'agent' inválido.";
  if (!company || typeof company !== "string" || company.trim().length < 1)
    return "Campo 'company' inválido.";
  if (!["Ligação", "Chat"].includes(type))
    return "Campo 'type' deve ser 'Ligação' ou 'Chat'.";
  if (!transcript || typeof transcript !== "string" || transcript.trim().length < 10)
    return "Transcrição muito curta ou ausente.";
  return null;
}

// ── Prompt da skill QA Telecom ───────────────────────────────────────────────

function buildPrompt(agent, company, type, transcript) {
  const criteriosLigacao = `saudacao (Saudação), tom_voz (Tom de Voz), tempo_espera (Tempo de Espera), tempo_atendimento (Tempo de Atendimento), uso_mudo (Utilização do Mudo), personalizacao (Personalização), tratativa (Tratativa sondagem resolução), gramatica (Gramática), dados_obrigatorios (Dados obrigatórios), protocolo_encerramento (Protocolo e Encerramento)`;
  const criteriosChat = `saudacao (Saudação), empatia (Empatia), tempo_espera (Tempo de Espera), tempo_atendimento (Tempo de Atendimento), tempo_resposta (Tempo de Resposta), gramatica (Gramática), sondagem (Sondagem), confirmacao_dados (Confirmação de Dados), personalizacao (Personalização), protocolo_encerramento (Protocolo e Encerramento)`;

  const criterios = type === "Chat" ? criteriosChat : criteriosLigacao;

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
${criterios}

Responda SOMENTE em JSON válido, sem markdown, sem explicações fora do JSON:
{"criteria":[{"id":"saudacao","score":8,"obs":"observação detalhada"},{"id":"tom_voz","score":7,"obs":"..."},{"id":"tempo_espera","score":9,"obs":"..."},{"id":"tempo_atendimento","score":7,"obs":"..."},{"id":"uso_mudo","score":6,"obs":"..."},{"id":"personalizacao","score":7,"obs":"..."},{"id":"tratativa","score":8,"obs":"..."},{"id":"gramatica","score":8,"obs":"..."},{"id":"dados_obrigatorios","score":9,"obs":"..."},{"id":"protocolo_encerramento","score":6,"obs":"..."}],"pontos_fortes":"texto curto e direto","pontos_desenvolver":"texto curto e direto","feedback":"Feedback construtivo usando primeiro nome do agente"}`;
}

// ── Rota principal ───────────────────────────────────────────────────────────

app.post("/api/evaluate", async (req, res) => {
  // 1. Validar
  const validationError = validateEvalRequest(req.body);
  if (validationError) {
    return res.status(400).json({ error: validationError });
  }

  const { agent, company, type, transcript } = req.body;

  // 2. Checar se a chave existe
  if (!process.env.OPENROUTER_API_KEY) {
    return res.status(500).json({ error: "Chave de API não configurada no servidor." });
  }

  try {
    // 3. Chamar OpenRouter (a chave fica AQUI, no servidor)
    const response = await fetch("https://api.openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`
      },
      body: JSON.stringify({
        model: "google/gemini-2.0-flash-001", // Melhor custo-benefício para PT-BR estruturado
        max_tokens: 1200,
        temperature: 0.3, // baixo para respostas mais consistentes e precisas
        messages: [
          {
            role: "system",
            content: "Você é um sistema de avaliação de qualidade de atendimento. Responda SEMPRE e SOMENTE em JSON válido, sem markdown."
          },
          {
            role: "user",
            content: buildPrompt(agent, company, type, transcript)
          }
        ]
      })
    });

    if (!response.ok) {
      const errBody = await response.text();
      console.error("OpenRouter error:", response.status, errBody);
      return res.status(502).json({ error: "Erro ao consultar IA. Tente novamente." });
    }

    const data = await response.json();
    const raw  = data.choices?.[0]?.message?.content || "";

    // 4. Parsear JSON com segurança
    let parsed;
    try {
      const clean = raw.replace(/```json|```/gi, "").trim();
      parsed = JSON.parse(clean);
    } catch {
      console.error("JSON parse failed. Raw response:", raw);
      return res.status(502).json({ error: "Resposta da IA em formato inválido. Tente novamente." });
    }

    // 5. Validar estrutura da resposta
    if (!Array.isArray(parsed.criteria) || parsed.criteria.length < 10) {
      return res.status(502).json({ error: "Resposta da IA incompleta. Tente novamente." });
    }

    // 6. Calcular média no servidor (não confiar no cliente)
    const avg   = parsed.criteria.reduce((s, c) => s + Number(c.score), 0) / parsed.criteria.length;
    const score = Math.round(avg * 10) / 10;

    return res.json({
      criteria:          parsed.criteria,
      score,
      pontos_fortes:     parsed.pontos_fortes     || "",
      pontos_desenvolver: parsed.pontos_desenvolver || "",
      feedback:          parsed.feedback           || ""
    });

  } catch (err) {
    console.error("Server error:", err);
    return res.status(500).json({ error: "Erro interno. Tente novamente." });
  }
});

// Health check
app.get("/api/health", (_req, res) => res.json({ status: "ok" }));

app.listen(PORT, () => {
  console.log(`✅ QA Telecom API rodando na porta ${PORT}`);
  console.log(`🔑 OpenRouter key: ${process.env.OPENROUTER_API_KEY ? "configurada ✓" : "NÃO CONFIGURADA ✗"}`);
});
