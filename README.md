# 📊 QA Telecom Monitor

Sistema de monitoria e avaliação de qualidade de atendimentos (Ligação e Chat) com análise automatizada por IA.

---

## ✨ Funcionalidades

- Avaliação automática de atendimentos via IA (Google Gemini 2.0 Flash)
- Suporte a **Ligações** e **Chats** com critérios específicos para cada tipo
- Upload de **áudio** com player integrado (MP3, WAV, OGG, M4A, AAC, WEBM)
- Upload de **transcrição** em arquivo (`.txt`, `.csv`, `.md`) ou colagem direta
- Painel de dashboard com estatísticas, filtros e busca
- Detalhamento por critério com notas, observações e feedback personalizado
- API Key protegida no back-end — nunca exposta no navegador

---

## 🗂️ Estrutura do Projeto

```
qa-telecom/
├── backend/
│   ├── server.js          ← API Node.js + Express (guarda a chave da IA)
│   ├── package.json
│   ├── .env               ← CRIAR MANUALMENTE (não commitar!)
│   └── .env.example       ← Template do .env
│
├── frontend/
│   ├── src/
│   │   ├── main.jsx       ← Entry point React
│   │   └── App.jsx        ← Interface completa
│   ├── index.html
│   ├── vite.config.js
│   ├── package.json
│   ├── .env               ← CRIAR MANUALMENTE (não commitar!)
│   └── .env.example       ← Template do .env
│
├── .gitignore
└── README.md
```

---

## 🚀 Como Rodar (Desenvolvimento)

### Pré-requisitos

- [Node.js](https://nodejs.org/) v18 ou superior
- Chave de API da [OpenRouter](https://openrouter.ai/keys) (gratuito para começar)

---

### 1. Clonar o repositório

```bash
git clone https://github.com/seu-usuario/qa-telecom.git
cd qa-telecom
```

---

### 2. Configurar o Back-end

```bash
cd backend
npm install
cp .env.example .env
```

Abra o arquivo `.env` e insira sua chave:

```env
OPENROUTER_API_KEY=sk-or-SUA_CHAVE_AQUI
PORT=3001
ALLOWED_ORIGINS=http://localhost:5173
```

Inicie o servidor:

```bash
npm run dev        # com hot-reload (Node 18+)
# ou
npm start          # sem hot-reload
```

O servidor estará disponível em: `http://localhost:3001`

Teste rápido:
```bash
curl http://localhost:3001/api/health
# Resposta esperada: {"status":"ok"}
```

---

### 3. Configurar o Front-end

Em outro terminal:

```bash
cd frontend
npm install
cp .env.example .env
```

O `.env` já vem configurado para desenvolvimento. Inicie:

```bash
npm run dev
```

A interface estará disponível em: `http://localhost:5173`

---

## 🌐 Deploy em Produção

### Back-end (Railway, Render, Fly.io, VPS...)

1. Faça o deploy da pasta `backend/`
2. Configure as variáveis de ambiente no painel:
   - `OPENROUTER_API_KEY` — sua chave da OpenRouter
   - `PORT` — geralmente definido automaticamente pela plataforma
   - `ALLOWED_ORIGINS` — URL do seu front-end em produção (ex: `https://qa.seudominio.com.br`)
3. O comando de start é `node server.js`

### Front-end (Vercel, Netlify, Cloudflare Pages...)

1. Faça o deploy da pasta `frontend/`
2. Configure a variável de ambiente:
   - `VITE_API_URL` — URL do seu back-end em produção (ex: `https://api.seudominio.com.br`)
3. O comando de build é `npm run build` e o diretório de saída é `dist/`

---

## 🤖 Modelo de IA

| Configuração | Valor |
|---|---|
| Provedor | [OpenRouter](https://openrouter.ai) |
| Modelo padrão | `google/gemini-2.0-flash-001` |
| Temperatura | `0.3` (respostas consistentes) |
| Max tokens | `1200` |

Para trocar o modelo, edite `backend/server.js`:

```js
model: "google/gemini-2.0-flash-001"
// Alternativa premium:
// model: "anthropic/claude-sonnet-4-5"
```

---

## 🔐 Segurança

| Proteção | Onde | Como |
|---|---|---|
| API Key protegida | Back-end | Variável de ambiente, nunca vai ao browser |
| CORS restrito | Back-end | Aceita apenas requisições do domínio configurado |
| Rate limiting | Back-end | 30 req / 15 min por IP |
| Sanitização de input | Back-end | Remove HTML, limita tamanho |
| Validação de campos | Back-end + Front-end | Campos obrigatórios e tipos verificados |
| Limite de caracteres | Front-end | Textarea limitada a 8.000 caracteres |

---

## 📋 Critérios de Avaliação

### Ligação (10 critérios)
Saudação · Tom de Voz · Tempo de Espera · Tempo de Atendimento · Utilização do Mudo · Personalização · Tratativa/Sondagem/Resolução · Gramática · Dados Obrigatórios · Protocolo e Encerramento

### Chat (10 critérios)
Saudação · Empatia · Tempo de Espera · Tempo de Atendimento · Tempo de Resposta · Gramática · Sondagem · Confirmação de Dados · Personalização · Protocolo e Encerramento

### Escala de Notas
| Nota | Classificação |
|---|---|
| 9.0 – 10.0 | ✅ Excelente |
| 7.5 – 8.9 | 🟢 Muito Bom |
| 6.0 – 7.4 | 🟡 Regular |
| 4.0 – 5.9 | 🟠 Insatisfatório |
| 0.0 – 3.9 | 🔴 Crítico |

---

## 🛠️ Stack Tecnológica

**Back-end:** Node.js · Express · express-rate-limit · dotenv · cors

**Front-end:** React 18 · Vite · JavaScript puro (sem bibliotecas de UI externas)

**IA:** OpenRouter → Google Gemini 2.0 Flash

---

## 📄 Licença

MIT — fique à vontade para usar, modificar e distribuir.
