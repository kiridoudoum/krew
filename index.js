require('dotenv').config();
const express = require('express');
const Anthropic = require('@anthropic-ai/sdk');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');
const multer = require('multer');
const Groq = require('groq-sdk');

const app = express();
app.use(cors());

// --- MIDDLEWARE ---
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// --- USERS DATABASE (TEMP) ---
const USERS_FILE = '/tmp/users.json';

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

const groqApiKey = process.env.GROQ_API_KEY || 'MISSING';
const groq = new Groq({ apiKey: groqApiKey });

const prompts = {
  'droit': "Tu es Maître Durand, un avocat d'affaires de très haut niveau...",
  'com': "Tu es Léa Social, Directrice Stratégie Social Media...",
  'marketing': "Tu es Maxime Growth, Head of Growth...",
  'ventes': "Tu es Ryan Sales, Directeur Commercial..."
};

// --- DIAGNOSTICS ---
console.log("Server Starting...");
console.log("Anthropic Key Present:", anthropicApiKey !== 'MISSING');
console.log("Groq Key Present:", groqApiKey !== 'MISSING');
console.log("Email User:", process.env.EMAIL_USER || 'Using default');

// --- ROUTES ---
app.get('/api/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString(), keys: { anthropic: anthropicApiKey !== 'MISSING', groq: groqApiKey !== 'MISSING' } }));

const chatHandler = async (req, res) => {
  if (anthropicApiKey === 'MISSING') return res.status(500).json({ error: "Missing Anthropic API Key" });
  try {
    const agentType = req.body.agent || 'droit';
    const systemPrompt = req.body.systemPrompt || prompts[agentType] || prompts['droit'];
    let messages = [];
    if (req.body.messages && Array.isArray(req.body.messages)) {
      messages = req.body.messages.map(msg => {
        return { role: msg.role === 'ai' ? 'assistant' : 'user', content: [{ type: "text", text: msg.text }] };
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
    console.error("Anthropic Error:", error);
    if (error.status === 401 || error.message?.includes('api-key')) {
      return res.status(401).json({ error: "Clé API Anthropic invalide ou manquante. Veuillez vérifier vos variables d'environnement sur Vercel." });
    }
    res.status(500).json({ error: error.message });
  }
};

app.post('/chat', chatHandler);
app.post('/api/chat', chatHandler);

app.post('/api/generate-mail', async (req, res) => {
  if (anthropicApiKey === 'MISSING') return res.status(500).json({ error: "Missing Anthropic API Key" });
  try {
    const { subject, body } = req.body;
    const response = await anthropic.messages.create({
      model: "claude-3-haiku-20240307",
      max_tokens: 1024,
      system: "Tu es un assistant rédacteur d'emails professionnel.",
      messages: [{ role: 'user', content: `Réécris cet email avec un ton professionnel. Sujet: ${subject}. Corps: ${body}` }],
    });
    res.json({ success: true, generatedSubject: subject, generatedBody: response.content[0].text.trim() });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER || 'krew.plus.mail@gmail.com',
    pass: process.env.EMAIL_APP_PASSWORD
  }
});

app.post('/api/send-mail', async (req, res) => {
  try {
    const { targetEmail, subject, body } = req.body;
    await transporter.sendMail({
      from: '"Mon IA Perso" <krew.plus.mail@gmail.com>',
      to: targetEmail,
      subject: subject,
      text: body
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// NOUVEAU : ENVOI VIA GMAIL OAUTH2 (TOKEN UTILISATEUR)
app.post('/api/send-gmail-oauth', async (req, res) => {
  const { accessToken, targetEmail, subject, body } = req.body;
  
  if (!accessToken) return res.status(401).json({ error: "Token manquant" });

  try {
    // Construire le mail au format RFC822
    const str = [
      "Content-Type: text/plain; charset=\"UTF-8\"\n",
      "MIME-Version: 1.0\n",
      "Content-Transfer-Encoding: 7bit\n",
      "to: ", targetEmail, "\n",
      "subject: ", subject, "\n\n",
      body
    ].join('');

    // Encoder en Base64 URL-safe (requis par Gmail API)
    const encodedMail = Buffer.from(str).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

    const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ raw: encodedMail })
    });

    const result = await response.json();
    if (!response.ok) throw new Error(result.error?.message || "Erreur Gmail API");

    res.json({ success: true, result });
  } catch (error) {
    console.error("Gmail OAuth Error:", error);
    res.status(500).json({ error: error.message });
  }
});

const upload = multer({ dest: '/tmp/' });
app.post('/api/transcribe-audio', upload.single('audioFile'), async (req, res) => {
  if (groqApiKey === 'MISSING') return res.status(500).json({ error: "Missing Groq API Key" });
  if (!req.file) return res.status(400).json({ error: "No file" });
  try {
    const transcription = await groq.audio.transcriptions.create({
      file: fs.createReadStream(req.file.path),
      model: "whisper-large-v3",
      language: "fr"
    });
    res.json({ success: true, transcription: transcription.text });
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
  }
});

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

app.put('/api/profile', (req, res) => {
  const { currentEmail, updates } = req.body;
  let users = loadUsers();
  const index = users.findIndex(u => u.email === currentEmail);
  if (index === -1) return res.status(404).json({ error: "User not found" });
  
  users[index] = { ...users[index], ...updates };
  saveUsers(users);
  res.json({ success: true, user: users[index] });
});

module.exports = app;

if (process.env.NODE_ENV !== 'production' && require.main === module) {
  app.use(express.static(path.join(__dirname, '.')));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/') || req.path === '/chat') return next();
    res.sendFile(path.join(__dirname, 'index.html'));
  });
  app.listen(3000, () => console.log("Local Server on 3000"));
}
