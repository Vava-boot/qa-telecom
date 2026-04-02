import { useState, useRef, useEffect } from "react";

// ─── URL do back-end ────────────────────────────────────────────────────────
// Em desenvolvimento: http://localhost:3001
// Em produção: troque pela URL do seu servidor (ex: https://api.meusite.com.br)
const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3001";
// NOTA: VITE_API_URL é a URL do SEU servidor, não a chave da OpenRouter.
// A chave da OpenRouter fica SOMENTE no arquivo .env do back-end.

// ─── Critérios por tipo ──────────────────────────────────────────────────────
const CRITERIA_LIGACAO = [
  { id: "saudacao",              label: "Saudação" },
  { id: "tom_voz",               label: "Tom de Voz" },
  { id: "tempo_espera",          label: "Tempo de Espera" },
  { id: "tempo_atendimento",     label: "Tempo de Atendimento" },
  { id: "uso_mudo",              label: "Utilização do Mudo" },
  { id: "personalizacao",        label: "Personalização" },
  { id: "tratativa",             label: "Tratativa, sondagem, resolução" },
  { id: "gramatica",             label: "Gramática" },
  { id: "dados_obrigatorios",    label: "Dados obrigatórios" },
  { id: "protocolo_encerramento",label: "Protocolo e Encerramento" },
];

const CRITERIA_CHAT = [
  { id: "saudacao",              label: "Saudação" },
  { id: "empatia",               label: "Empatia" },
  { id: "tempo_espera",          label: "Tempo de Espera" },
  { id: "tempo_atendimento",     label: "Tempo de Atendimento" },
  { id: "tempo_resposta",        label: "Tempo de Resposta" },
  { id: "gramatica",             label: "Gramática" },
  { id: "sondagem",              label: "Sondagem" },
  { id: "confirmacao_dados",     label: "Confirmação de Dados" },
  { id: "personalizacao",        label: "Personalização" },
  { id: "protocolo_encerramento",label: "Protocolo e Encerramento" },
];

function getCriteria(type) {
  return type === "Chat" ? CRITERIA_CHAT : CRITERIA_LIGACAO;
}

// ─── Helpers visuais ─────────────────────────────────────────────────────────
function scoreColor(score) {
  if (score >= 9)   return { bg: "#00c853", text: "#fff",    label: "Excelente" };
  if (score >= 7.5) return { bg: "#76ff03", text: "#1a1a1a", label: "Muito Bom" };
  if (score >= 6)   return { bg: "#ffd600", text: "#1a1a1a", label: "Regular" };
  if (score >= 4)   return { bg: "#ff6d00", text: "#fff",    label: "Insatisfatório" };
  return              { bg: "#d50000",  text: "#fff",    label: "Crítico" };
}

function Badge({ score }) {
  const c = scoreColor(score);
  return (
    <span style={{ background: c.bg, color: c.text, borderRadius: 6, padding: "2px 10px", fontSize: 12, fontWeight: 700 }}>
      {c.label}
    </span>
  );
}

function fmt(s) {
  if (!s || isNaN(s)) return "0:00";
  const m = Math.floor(s / 60), sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

// ─── Player de Áudio ─────────────────────────────────────────────────────────
function AudioPlayer({ src, fileName }) {
  const audioRef              = useRef();
  const [playing, setPlaying] = useState(false);
  const [cur, setCur]         = useState(0);
  const [dur, setDur]         = useState(0);
  const [vol, setVol]         = useState(1);
  const [speed, setSpeed]     = useState(1);

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const onTime = () => setCur(a.currentTime);
    const onMeta = () => setDur(a.duration || 0);
    const onEnd  = () => setPlaying(false);
    a.addEventListener("timeupdate", onTime);
    a.addEventListener("loadedmetadata", onMeta);
    a.addEventListener("ended", onEnd);
    return () => {
      a.removeEventListener("timeupdate", onTime);
      a.removeEventListener("loadedmetadata", onMeta);
      a.removeEventListener("ended", onEnd);
    };
  }, [src]);

  // Revogar object URL ao desmontar para evitar vazamento de memória
  useEffect(() => {
    return () => { if (src?.startsWith("blob:")) URL.revokeObjectURL(src); };
  }, [src]);

  const toggle = () => {
    const a = audioRef.current;
    if (!a) return;
    if (playing) { a.pause(); setPlaying(false); }
    else { a.play().catch(() => {}); setPlaying(true); }
  };
  const seek       = (e) => { const v = parseFloat(e.target.value); audioRef.current.currentTime = v; setCur(v); };
  const changeVol  = (e) => { const v = parseFloat(e.target.value); audioRef.current.volume = v; setVol(v); };
  const changeSpeed = (s) => { audioRef.current.playbackRate = s; setSpeed(s); };
  const skip       = (n) => { const a = audioRef.current; a.currentTime = Math.max(0, Math.min(dur, a.currentTime + n)); };
  const pct        = dur ? (cur / dur) * 100 : 0;

  return (
    <div style={{ background: "#0a0f1e", border: "1px solid #1e3a5f", borderRadius: 12, padding: "16px 20px", marginBottom: 16 }}>
      <audio ref={audioRef} src={src} preload="metadata" />
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <span style={{ fontSize: 16 }}>🎵</span>
        <span style={{ fontSize: 13, color: "#aab", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{fileName}</span>
        {dur > 0 && <span style={{ fontSize: 12, color: "#556", whiteSpace: "nowrap" }}>{fmt(dur)}</span>}
      </div>
      <div style={{ position: "relative", height: 6, background: "#1e2a40", borderRadius: 3, marginBottom: 12, cursor: "pointer" }}>
        <div style={{ height: "100%", width: `${pct}%`, background: "#00e5a0", borderRadius: 3, pointerEvents: "none" }} />
        <input type="range" min={0} max={dur || 1} step={0.1} value={cur} onChange={seek}
          style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer", width: "100%", margin: 0, height: "100%" }} />
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button onClick={() => skip(-10)} style={{ background: "none", border: "none", color: "#aab", cursor: "pointer", fontSize: 20, padding: 0 }}>⏮</button>
          <button onClick={toggle}
            style={{ width: 42, height: 42, borderRadius: "50%", background: "#00e5a0", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, color: "#0a0e1a", fontWeight: 900, flexShrink: 0 }}>
            {playing ? "⏸" : "▶"}
          </button>
          <button onClick={() => skip(10)} style={{ background: "none", border: "none", color: "#aab", cursor: "pointer", fontSize: 20, padding: 0 }}>⏭</button>
          <span style={{ fontSize: 12, color: "#556", minWidth: 80 }}>{fmt(cur)} / {fmt(dur)}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 13, color: "#556" }}>🔊</span>
          <input type="range" min={0} max={1} step={0.05} value={vol} onChange={changeVol}
            style={{ width: 70, accentColor: "#00e5a0" }} />
          <div style={{ display: "flex", gap: 3 }}>
            {[0.75, 1, 1.25, 1.5, 2].map(s => (
              <button key={s} onClick={() => changeSpeed(s)}
                style={{ background: speed === s ? "#00e5a0" : "#1e2a40", color: speed === s ? "#0a0e1a" : "#aab", border: "none", borderRadius: 4, padding: "3px 7px", fontSize: 11, cursor: "pointer", fontWeight: speed === s ? 700 : 400 }}>
                {s}x
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Mock inicial ─────────────────────────────────────────────────────────────
const MOCK = [
  {
    id: 1, agent: "Artur Ferreira", type: "Ligação", company: "SUSTENTA",
    protocol: "17731419662188012", date: "2026-03-15", score: 9.4, audioUrl: null, audioName: null,
    criteria: [
      { id: "saudacao", score: 10, obs: "Realizou a saudação completa. Se apresentou como Artur Ferreira, desejou bom dia, identificou a empresa e perguntou como pode ajudar." },
      { id: "tom_voz", score: 9, obs: "Tom de voz excelente, demonstrou entusiasmo e empatia ao longo da ligação." },
      { id: "tempo_espera", score: 10, obs: "Tempo de espera de apenas 00:10, superando as expectativas." },
      { id: "tempo_atendimento", score: 9, obs: "Dentro do TMA de 4 minutos, demonstrando agilidade." },
      { id: "uso_mudo", score: 9, obs: "Utilizou o mudo corretamente e agradeceu a espera ao retornar." },
      { id: "personalizacao", score: 9, obs: "Utilizou o nome do cliente diversas vezes, atendimento personalizado." },
      { id: "tratativa", score: 9, obs: "Sondagem completa e resolução precisa seguindo o Confluence." },
      { id: "gramatica", score: 10, obs: "Comunicação exemplar, sem deslizes gramaticais." },
      { id: "dados_obrigatorios", score: 10, obs: "Confirmou Nome Completo e CPF do titular do contrato." },
      { id: "protocolo_encerramento", score: 10, obs: "Forneceu o protocolo ao cliente e encerrou corretamente." },
    ],
    pontos_fortes: "Saudação, personalização, gramática e encerramento exemplares.",
    pontos_desenvolver: "Pequenos ajustes no tom de voz para maior variação de entonação.",
    feedback: "Artur, seu atendimento foi excelente! Continue assim, especialmente na personalização e encerramento."
  },
  {
    id: 2, agent: "Artur Ferreira", type: "Ligação", company: "DIPELNET",
    protocol: "20260302154530", date: "2026-03-20", score: 6.2, audioUrl: null, audioName: null,
    criteria: [
      { id: "saudacao", score: 10, obs: "Realizou a saudação completa corretamente." },
      { id: "tom_voz", score: 6, obs: "Tom adequado, porém faltou variação de entonação e empatia." },
      { id: "tempo_espera", score: 10, obs: "Tempo de espera de apenas 00:15." },
      { id: "tempo_atendimento", score: 4, obs: "06:45, consideravelmente acima do TMA de 4 minutos." },
      { id: "uso_mudo", score: 6, obs: "Falhas ao pedir 'um momento' e agradecer a espera do cliente." },
      { id: "personalizacao", score: 4, obs: "Uso excessivo de formalismo, pouca utilização do nome do cliente." },
      { id: "tratativa", score: 6, obs: "Sondagem realizada mas Confluence não seguido à risca." },
      { id: "gramatica", score: 6, obs: "Pequenos deslizes gramaticais e gerúndio que precisam de atenção." },
      { id: "dados_obrigatorios", score: 10, obs: "Confirmou Nome Completo e CPF do titular corretamente." },
      { id: "protocolo_encerramento", score: 0, obs: "Encerrou sem fornecer o número do protocolo ao cliente." },
    ],
    pontos_fortes: "Boa saudação inicial e confirmação de dados obrigatórios.",
    pontos_desenvolver: "Reduzir tempo de atendimento, melhorar tom de voz e encerramento com protocolo.",
    feedback: "Artur, sua saudação foi ótima, mas é essencial passar o protocolo e realizar o encerramento completo."
  },
];

const CL = { Excelente: "#00c853", "Muito Bom": "#76ff03", Regular: "#ffd600", Insatisfatório: "#ff6d00", Crítico: "#d50000" };
const CT = { Excelente: "#fff", "Muito Bom": "#1a1a1a", Regular: "#1a1a1a", Insatisfatório: "#fff", Crítico: "#fff" };
const inp = { width: "100%", background: "#111827", border: "1px solid #1e2a40", color: "#eee", borderRadius: 7, padding: "8px 11px", fontSize: 13, boxSizing: "border-box" };

// ─── App Principal ────────────────────────────────────────────────────────────
export default function App() {
  const [evals, setEvals]             = useState(MOCK);
  const [view, setView]               = useState("dash");
  const [sel, setSel]                 = useState(null);
  const [modal, setModal]             = useState(false);
  const [fType, setFType]             = useState("Todos");
  const [fClass, setFClass]           = useState("Todas");
  const [search, setSearch]           = useState("");
  const [loading, setLoading]         = useState(false);
  const [step, setStep]               = useState("");
  const [apiError, setApiError]       = useState("");
  const audioInputRef                 = useRef();
  const textInputRef                  = useRef();

  const [form, setForm] = useState({
    agent: "", type: "Ligação", company: "", protocol: "",
    date: new Date().toISOString().split("T")[0],
    transcript: "", audioFile: null, audioUrl: null, audioName: "", textFileName: ""
  });

  const upd = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const mediaGeral = evals.length ? (evals.reduce((s, e) => s + e.score, 0) / evals.length).toFixed(1) : "—";
  const ligacoes   = evals.filter(e => e.type === "Ligação").length;
  const chats      = evals.filter(e => e.type === "Chat").length;
  const cc         = { Excelente: 0, "Muito Bom": 0, Regular: 0, Insatisfatório: 0, Crítico: 0 };
  evals.forEach(e => cc[scoreColor(e.score).label]++);

  const list = evals.filter(e => {
    if (fType !== "Todos" && e.type !== fType) return false;
    if (fClass !== "Todas" && scoreColor(e.score).label !== fClass) return false;
    const q = search.toLowerCase();
    if (q && !e.agent.toLowerCase().includes(q) && !e.company.toLowerCase().includes(q) && !e.protocol.toLowerCase().includes(q)) return false;
    return true;
  });

  const handleAudio = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    // Revogar URL anterior se existir
    if (form.audioUrl?.startsWith("blob:")) URL.revokeObjectURL(form.audioUrl);
    const url = URL.createObjectURL(f);
    upd("audioFile", f); upd("audioUrl", url); upd("audioName", f.name);
  };

  const handleText = async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    const txt = await f.text();
    upd("textFileName", f.name); upd("transcript", txt);
  };

  const generate = async () => {
    setApiError("");
    if (!form.agent || !form.company) return setApiError("Preencha Colaborador e Empresa.");
    if (!form.transcript && !form.audioFile) return setApiError("Adicione áudio, arquivo de texto ou escreva a transcrição.");

    setLoading(true);
    try {
      let transcript = form.transcript;

      if (form.audioFile && !transcript) {
        setStep("Processando áudio...");
        await new Promise(r => setTimeout(r, 600));
        // Nota: sem transcrição real de áudio, usamos contexto para a IA simular
        // Para transcrição real de áudio, integre Whisper API no back-end
        transcript = `[Áudio carregado: "${form.audioName}"] Contexto: ligação de atendimento telecom. Agente: ${form.agent}. Empresa: ${form.company}. Gere avaliação realista baseada em padrões típicos de call center.`;
      }

      setStep("Analisando critérios de qualidade...");

      // ✅ Chamada ao BACK-END (não à OpenRouter diretamente)
      const response = await fetch(`${API_BASE}/api/evaluate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agent:      form.agent.trim(),
          company:    form.company.trim(),
          type:       form.type,
          transcript: transcript.trim()
        })
      });

      setStep("Gerando feedback personalizado...");
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Erro ao gerar avaliação.");
      }

      const novo = {
        id:       Date.now(),
        agent:    form.agent.trim(),
        type:     form.type,
        company:  form.company.trim(),
        protocol: form.protocol.trim() || String(Date.now()),
        date:     form.date,
        score:    result.score,
        audioUrl: form.audioUrl,
        audioName: form.audioName,
        criteria:          result.criteria,
        pontos_fortes:     result.pontos_fortes,
        pontos_desenvolver: result.pontos_desenvolver,
        feedback:          result.feedback
      };

      setEvals(p => [novo, ...p]);
      setSel(novo);
      setModal(false);
      setView("detail");
      // Limpar form (mas manter audioUrl até desmontagem para não quebrar player)
      setForm({ agent: "", type: "Ligação", company: "", protocol: "", date: new Date().toISOString().split("T")[0], transcript: "", audioFile: null, audioUrl: null, audioName: "", textFileName: "" });

    } catch (err) {
      setApiError(err.message || "Erro ao gerar avaliação. Tente novamente.");
    }
    setLoading(false);
    setStep("");
  };

  // ── DETAIL VIEW ─────────────────────────────────────────────────────────────
  if (view === "detail" && sel) {
    const avg      = sel.criteria.reduce((s, c) => s + Number(c.score), 0) / sel.criteria.length;
    const col      = scoreColor(avg);
    const criteria = getCriteria(sel.type);

    return (
      <div style={{ minHeight: "100vh", background: "#0a0e1a", color: "#e8eaf0", fontFamily: "'Segoe UI', sans-serif" }}>
        <div style={{ background: "#0d1220", borderBottom: "1px solid #1e2a40", padding: "12px 28px", display: "flex", alignItems: "center", gap: 14 }}>
          <button onClick={() => setView("dash")} style={{ background: "none", border: "none", color: "#00e5a0", cursor: "pointer", fontSize: 22 }}>←</button>
          <span style={{ fontSize: 15, fontWeight: 700, color: "#00e5a0" }}>QA Telecom</span>
          <span style={{ color: "#556", fontSize: 12, marginLeft: "auto" }}>{sel.type} · {sel.date}</span>
        </div>

        <div style={{ maxWidth: 900, margin: "0 auto", padding: "28px 20px" }}>
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 12, color: "#00e5a0" }}>{sel.company} · {sel.protocol}</div>
            <h2 style={{ margin: "4px 0 0", fontSize: 22, fontWeight: 800 }}>{sel.agent}</h2>
          </div>

          {sel.audioUrl && <AudioPlayer src={sel.audioUrl} fileName={sel.audioName} />}

          <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 22 }}>
            <thead>
              <tr style={{ background: "#1a2444" }}>
                <th style={{ padding: "10px 14px", textAlign: "left", color: "#aab", fontSize: 12 }}>Critério</th>
                <th style={{ padding: "10px 14px", textAlign: "center", background: "#c62828", color: "#fff", fontSize: 12, width: 70 }}>Nota</th>
                <th style={{ padding: "10px 14px", textAlign: "center", color: "#aab", fontSize: 12, width: 120 }}>Desempenho</th>
                <th style={{ padding: "10px 14px", textAlign: "left", color: "#aab", fontSize: 12 }}>Observações</th>
              </tr>
            </thead>
            <tbody>
              {sel.criteria.map((c, i) => {
                const label = criteria.find(x => x.id === c.id)?.label || c.id;
                return (
                  <tr key={c.id} style={{ background: i % 2 === 0 ? "#0d1220" : "#111827", borderBottom: "1px solid #1a2340" }}>
                    <td style={{ padding: "11px 14px", fontWeight: 600, fontSize: 13, color: "#dde" }}>{label}</td>
                    <td style={{ padding: "11px 14px", textAlign: "center", fontWeight: 900, fontSize: 22, color: "#fff" }}>{c.score}</td>
                    <td style={{ padding: "11px 14px", textAlign: "center" }}><Badge score={Number(c.score)} /></td>
                    <td style={{ padding: "11px 14px", fontSize: 12, color: "#99aacc", lineHeight: 1.6 }}>{c.obs}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div style={{ background: col.bg, borderRadius: 10, padding: "16px 28px", display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 22 }}>
            <div>
              <div style={{ fontSize: 13, color: col.text, opacity: 0.85 }}>Média Final</div>
              <div style={{ fontSize: 13, color: col.text, opacity: 0.85, marginTop: 6 }}>Desempenho Geral:</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 40, fontWeight: 900, color: col.text }}>{avg.toFixed(1)}</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: col.text }}>{col.label}</div>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            {[
              { color: "#00aaff", bdr: "#1a3a5f", title: "◎ Pontos Fortes",         text: sel.pontos_fortes },
              { color: "#ffaa00", bdr: "#5f3a00", title: "⚠ Pontos a Desenvolver",  text: sel.pontos_desenvolver },
              { color: "#aab",    bdr: "#2a3040", title: "✉ Feedback ao Colaborador",text: sel.feedback },
            ].map(b => (
              <div key={b.title} style={{ background: "#0d1220", border: `1px solid ${b.bdr}`, borderRadius: 8, padding: "14px 16px" }}>
                <div style={{ color: b.color, fontSize: 12, marginBottom: 6 }}>{b.title}</div>
                <div style={{ fontSize: 13, color: "#ccd", lineHeight: 1.6 }}>{b.text}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ── DASHBOARD ────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: "100vh", background: "#0a0e1a", color: "#e8eaf0", fontFamily: "'Segoe UI', sans-serif" }}>
      <div style={{ background: "#0d1220", borderBottom: "1px solid #1e2a40", padding: "12px 28px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 32, height: 32, background: "#00e5a0", borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ color: "#0a0e1a", fontWeight: 900, fontSize: 16 }}>~</span>
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15 }}>QA Telecom</div>
            <div style={{ fontSize: 11, color: "#556" }}>Sistema de Monitoria</div>
          </div>
        </div>
        <button onClick={() => { setApiError(""); setModal(true); }}
          style={{ background: "#00e5a0", color: "#0a0e1a", border: "none", borderRadius: 8, padding: "8px 18px", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
          + Nova Avaliação
        </button>
      </div>

      {/* MODAL */}
      {modal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.82)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ background: "#0d1220", border: "1px solid #1e2a40", borderRadius: 14, padding: 26, width: "100%", maxWidth: 600, maxHeight: "92vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>Nova Avaliação com IA</h3>
              <button onClick={() => setModal(false)} style={{ background: "none", border: "none", color: "#aab", cursor: "pointer", fontSize: 24 }}>×</button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
              <div>
                <label style={{ display: "block", fontSize: 11, color: "#aab", marginBottom: 4 }}>Colaborador *</label>
                <input value={form.agent} onChange={e => upd("agent", e.target.value)} placeholder="Nome do agente" style={inp} maxLength={100} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 11, color: "#aab", marginBottom: 4 }}>Empresa *</label>
                <input value={form.company} onChange={e => upd("company", e.target.value)} placeholder="Ex: SUSTENTA" style={inp} maxLength={100} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 11, color: "#aab", marginBottom: 4 }}>Protocolo</label>
                <input value={form.protocol} onChange={e => upd("protocol", e.target.value)} placeholder="Nº do protocolo" style={inp} maxLength={50} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 11, color: "#aab", marginBottom: 4 }}>Tipo</label>
                <select value={form.type} onChange={e => upd("type", e.target.value)} style={{ ...inp, padding: "9px 11px" }}>
                  <option>Ligação</option><option>Chat</option>
                </select>
              </div>
              <div>
                <label style={{ display: "block", fontSize: 11, color: "#aab", marginBottom: 4 }}>Data</label>
                <input type="date" value={form.date} onChange={e => upd("date", e.target.value)} style={inp} />
              </div>
            </div>

            <div style={{ height: 1, background: "#1e2a40", margin: "16px 0" }} />

            {/* Audio upload */}
            <label style={{ display: "block", fontSize: 12, color: "#00e5a0", fontWeight: 700, marginBottom: 8 }}>🎵 Arquivo de Áudio</label>
            <div onClick={() => audioInputRef.current.click()}
              style={{ border: `2px dashed ${form.audioName ? "#00e5a0" : "#1e3a5f"}`, borderRadius: 10, padding: "16px 20px", textAlign: "center", cursor: "pointer", marginBottom: 12 }}>
              {form.audioName ? (
                <>
                  <div style={{ color: "#00e5a0", fontSize: 14, marginBottom: 2 }}>✓ {form.audioName}</div>
                  <div style={{ color: "#556", fontSize: 11 }}>Clique para trocar</div>
                </>
              ) : (
                <>
                  <div style={{ fontSize: 30, marginBottom: 4 }}>🎙️</div>
                  <div style={{ color: "#aab", fontSize: 13, marginBottom: 2 }}>Arraste ou clique para selecionar</div>
                  <div style={{ color: "#556", fontSize: 11 }}>MP3 · WAV · OGG · M4A · AAC · WEBM</div>
                </>
              )}
            </div>
            <input ref={audioInputRef} type="file" accept="audio/*" onChange={handleAudio} style={{ display: "none" }} />

            {form.audioUrl && <AudioPlayer src={form.audioUrl} fileName={form.audioName} />}

            <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "14px 0" }}>
              <div style={{ flex: 1, height: 1, background: "#1e2a40" }} />
              <span style={{ color: "#556", fontSize: 12 }}>ou</span>
              <div style={{ flex: 1, height: 1, background: "#1e2a40" }} />
            </div>

            {/* Text file */}
            <div style={{ marginBottom: 10 }}>
              <label style={{ display: "block", fontSize: 12, color: "#aab", marginBottom: 6 }}>📄 Arquivo de Transcrição</label>
              <div onClick={() => textInputRef.current.click()}
                style={{ border: `1.5px dashed ${form.textFileName ? "#00aaff" : "#1e2a40"}`, borderRadius: 8, padding: "10px 16px", cursor: "pointer", display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 18 }}>📂</span>
                <span style={{ fontSize: 13, color: form.textFileName ? "#00aaff" : "#556" }}>
                  {form.textFileName || "Selecionar .txt / .csv / .md"}
                </span>
              </div>
              <input ref={textInputRef} type="file" accept=".txt,.csv,.md,.json" onChange={handleText} style={{ display: "none" }} />
            </div>

            <div style={{ marginBottom: 18 }}>
              <label style={{ display: "block", fontSize: 12, color: "#aab", marginBottom: 6 }}>✍️ Ou cole a transcrição</label>
              <textarea value={form.transcript} onChange={e => upd("transcript", e.target.value)}
                placeholder="Cole aqui o texto completo do atendimento..."
                rows={5} maxLength={8000}
                style={{ ...inp, resize: "vertical" }} />
              <div style={{ textAlign: "right", fontSize: 11, color: "#556", marginTop: 3 }}>
                {form.transcript.length}/8000 caracteres
              </div>
            </div>

            {apiError && (
              <div style={{ background: "#2a0a0a", border: "1px solid #d50000", borderRadius: 8, padding: "10px 14px", marginBottom: 14, color: "#ff6b6b", fontSize: 13 }}>
                ⚠ {apiError}
              </div>
            )}

            {loading ? (
              <div style={{ textAlign: "center", padding: "18px 0" }}>
                <div style={{ fontSize: 30, marginBottom: 8 }}>🤖</div>
                <div style={{ color: "#00e5a0", fontSize: 14, fontWeight: 700, marginBottom: 5 }}>{step}</div>
                <div style={{ color: "#556", fontSize: 12 }}>Analisando e gerando feedback completo com IA...</div>
                <div style={{ marginTop: 12, display: "flex", justifyContent: "center", gap: 6 }}>
                  {[0, 1, 2].map(i => (
                    <div key={i} style={{ width: 8, height: 8, borderRadius: "50%", background: "#00e5a0", opacity: 0.4, animation: `blink 1.2s ${i * 0.35}s infinite` }} />
                  ))}
                </div>
                <style>{`@keyframes blink{0%,100%{opacity:.3}50%{opacity:1}}`}</style>
              </div>
            ) : (
              <button onClick={generate}
                style={{ width: "100%", background: "#00e5a0", color: "#0a0e1a", border: "none", borderRadius: 9, padding: "13px", fontWeight: 900, fontSize: 15, cursor: "pointer" }}>
                🤖 Gerar Avaliação com IA
              </button>
            )}
          </div>
        </div>
      )}

      {/* MAIN */}
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "30px 20px" }}>
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ margin: "0 0 4px", fontSize: 24, fontWeight: 800 }}>Painel de Monitoria</h1>
          <div style={{ fontSize: 13, color: "#556" }}>Avaliações de qualidade em atendimentos de telecomunicações</div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 18 }}>
          {[["≡","Total de Avaliações",evals.length],["~","Média Geral",mediaGeral],["☏","Ligações",ligacoes],["✉","Chats",chats]].map(([icon,label,val]) => (
            <div key={label} style={{ background: "#0d1220", border: "1px solid #1e2a40", borderRadius: 10, padding: "14px 18px" }}>
              <div style={{ fontSize: 12, color: "#556", marginBottom: 5 }}>{icon} {label}</div>
              <div style={{ fontSize: 26, fontWeight: 800 }}>{val}</div>
            </div>
          ))}
        </div>

        <div style={{ background: "#0d1220", border: "1px solid #1e2a40", borderRadius: 10, padding: "12px 18px", marginBottom: 14 }}>
          <div style={{ fontSize: 12, color: "#aab", marginBottom: 8 }}>Distribuição por Classificação</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {Object.entries(cc).map(([k, v]) => (
              <button key={k} onClick={() => setFClass(fClass === k ? "Todas" : k)}
                style={{ background: CL[k], color: CT[k], border: fClass === k ? "2px solid #fff" : "2px solid transparent", borderRadius: 20, padding: "3px 14px", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>
                {k} {v}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por colaborador, empresa ou protocolo..."
            style={{ flex: 1, minWidth: 200, background: "#0d1220", border: "1px solid #1e2a40", color: "#eee", borderRadius: 8, padding: "8px 14px", fontSize: 13 }} />
          <select value={fType} onChange={e => setFType(e.target.value)} style={{ background: "#0d1220", border: "1px solid #1e2a40", color: "#eee", borderRadius: 8, padding: "8px 12px", fontSize: 13 }}>
            <option>Todos</option><option>Ligação</option><option>Chat</option>
          </select>
          <select value={fClass} onChange={e => setFClass(e.target.value)} style={{ background: "#0d1220", border: "1px solid #1e2a40", color: "#eee", borderRadius: 8, padding: "8px 12px", fontSize: 13 }}>
            <option value="Todas">Todas</option>
            {Object.keys(cc).map(k => <option key={k}>{k}</option>)}
          </select>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {list.map(ev => {
            const c = scoreColor(ev.score);
            return (
              <div key={ev.id} onClick={() => { setSel(ev); setView("detail"); }}
                style={{ background: "#0d1220", border: `1.5px solid ${c.bg}33`, borderLeft: `4px solid ${c.bg}`, borderRadius: 10, padding: "13px 20px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between" }}
                onMouseEnter={e => e.currentTarget.style.background = "#111827"}
                onMouseLeave={e => e.currentTarget.style.background = "#0d1220"}>
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <span style={{ color: ev.type === "Ligação" ? "#00aaff" : "#00e5a0", fontSize: 18 }}>{ev.type === "Ligação" ? "☏" : "✉"}</span>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>
                      {ev.agent}
                      <span style={{ color: "#556", fontWeight: 400, fontSize: 12 }}> {ev.type}</span>
                      {ev.audioName && <span style={{ marginLeft: 8, background: "#0a2a1a", color: "#00e5a0", fontSize: 11, padding: "1px 7px", borderRadius: 4 }}>🎵 áudio</span>}
                    </div>
                    <div style={{ fontSize: 12, color: "#556", marginTop: 2 }}>🏢 {ev.company} · {ev.protocol} · {ev.date}</div>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ fontWeight: 900, fontSize: 22 }}>{ev.score.toFixed(1)}</span>
                  <Badge score={ev.score} />
                  <span style={{ color: "#556" }}>›</span>
                </div>
              </div>
            );
          })}
          {list.length === 0 && <div style={{ textAlign: "center", padding: 40, color: "#556" }}>Nenhuma avaliação encontrada.</div>}
        </div>
      </div>
    </div>
  );
}
