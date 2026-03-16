require('dotenv').config();
const express = require('express');
const Anthropic = require('@anthropic-ai/sdk');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());

// --- MIDDLEWARE ---
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Serve static files (Crucial for CSS/JS/Images)
app.use(express.static(path.join(__dirname, '.')));

// --- USERS DATABASE (TEMP) ---
const USERS_FILE = process.env.VERCEL ? '/tmp/users.json' : path.join(__dirname, 'users.json');

function loadUsers() {
  try {
    if (fs.existsSync(USERS_FILE)) {
      return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
    }
  } catch (e) {}
  return [];
}

function saveUsers(users) {
  try {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
    return true;
  } catch (e) {
    return false;
  }
}

// --- API KEYS ---
const anthropicApiKey = process.env.ANTHROPIC_API_KEY || 'MISSING';
const anthropic = new Anthropic({ apiKey: anthropicApiKey });

const prompts = {
  'droit': "Tu es Maître Durand...",
  'com': "Tu es Léa Social...",
  'marketing': "Tu es Maxime Growth...",
  'ventes': "Tu es Ryan Sales..."
};

// --- ROUTES ---

// 1. Root Route (Explicitly serve index.html)
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// 2. Chat API
app.post('/chat', async (req, res) => {
  if (anthropicApiKey === 'MISSING') return res.status(500).json({ error: "Missing Anthropic API Key" });
  try {
    const agentType = req.body.agent || 'droit';
    const systemPrompt = req.body.systemPrompt || prompts[agentType] || prompts['droit'];
    let messages = [];
    if (req.body.messages && Array.isArray(req.body.messages)) {
      messages = req.body.messages.map(msg => {
        let content = [{ type: "text", text: msg.text }];
        return { role: msg.role === 'ai' ? 'assistant' : 'user', content: content };
      });
    }
    const response = await anthropic.messages.create({
      model: "claude-3-haiku-20240307",
      max_tokens: 1024,
      system: systemPrompt,
      messages: messages,
    });
    res.json({ reply: response.content[0].text });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 3. Register/Login
app.post('/api/register', (req, res) => {
  const { email } = req.body;
  let users = loadUsers();
  if (users.find(u => u.email === email)) return res.status(400).json({ error: "Email taken" });
  users.push(req.body);
  saveUsers(users);
  res.status(201).json({ success: true });
});

app.post('/api/login', (req, res) => {
  const { email, password } = req.body;
  let users = loadUsers();
  const user = users.find(u => u.email === email && u.password === password);
  res.json({ success: !!user, user });
});

// --- EXPORT & LISTEN ---
module.exports = app;

if (process.env.NODE_ENV !== 'production') {
  app.listen(3000, () => console.log("Server on 3000"));
}