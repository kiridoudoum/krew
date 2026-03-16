require('dotenv').config();
const express = require('express');
const Anthropic = require('@anthropic-ai/sdk');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());

// USERS_FILE in /tmp/ for Vercel persistence (temp) or project root for local
const USERS_FILE = process.env.VERCEL ? '/tmp/users.json' : path.join(__dirname, 'users.json');

// Helper to load users safely
function loadUsers() {
  try {
    if (fs.existsSync(USERS_FILE)) {
      return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
    }
  } catch (e) {
    console.error("Error reading users:", e);
  }
  return [];
}

// Helper to save users safely
function saveUsers(users) {
  try {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
    return true;
  } catch (e) {
    console.error("Error saving users:", e);
    return false;
  }
}

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

const anthropicApiKey = process.env.ANTHROPIC_API_KEY || 'MISSING';
const anthropic = new Anthropic({ apiKey: anthropicApiKey });

const prompts = {
  'droit': "Tu es Maître Durand, un avocat d'affaires de très haut niveau...",
  'com': "Tu es Léa Social, Directrice Stratégie Social Media...",
  'marketing': "Tu es Maxime Growth, Head of Growth...",
  'ventes': "Tu es Ryan Sales, Directeur Commercial..."
};

// --- API ROUTES ONLY ---
// Vercel will handle static files (index.html, css, images) automatically.

app.post('/chat', async (req, res) => {
  if (anthropicApiKey === 'MISSING') return res.status(500).json({ error: "Missing Anthropic API Key" });
  try {
    const agentType = req.body.agent || 'droit';
    const systemPrompt = req.body.systemPrompt || prompts[agentType] || prompts['droit'];
    let messages = [];
    if (req.body.messages && Array.isArray(req.body.messages)) {
      messages = req.body.messages.map(msg => {
        let content = [];
        if (msg.imageSrc && msg.imageSrc.startsWith('data:')) {
          const [mimeInfo, base64Data] = msg.imageSrc.split(',');
          const mediaType = mimeInfo.split(':')[1].split(';')[0];
          content.push({ type: "image", source: { type: "base64", media_type: mediaType, data: base64Data } });
        }
        content.push({ type: "text", text: msg.text });
        return { role: msg.role === 'ai' ? 'assistant' : 'user', content: content };
      });
    } else {
      let contentBlocks = [];
      if (req.body.image && req.body.image.data) {
        contentBlocks.push({ type: "image", source: { type: "base64", media_type: req.body.image.mediaType, data: req.body.image.data } });
      }
      contentBlocks.push({ type: "text", text: req.body.message || "" });
      messages.push({ role: "user", content: contentBlocks });
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

app.post('/api/generate-mail', async (req, res) => {
  if (anthropicApiKey === 'MISSING') return res.status(500).json({ error: "Missing Anthropic API Key" });
  try {
    const { tone, subject, body } = req.body;
    const response = await anthropic.messages.create({
      model: "claude-3-haiku-20240307",
      max_tokens: 1024,
      system: `Assistant redacteur...`,
      messages: [{ role: 'user', content: 'Rédige l\'email s\'il te plaît.' }],
    });
    const fullText = response.content[0].text;
    res.json({ success: true, generatedSubject: subject, generatedBody: fullText.trim() });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const nodemailer = require('nodemailer');
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_APP_PASSWORD }
});

app.post('/api/send-mail', async (req, res) => {
  try {
    const { targetEmail, subject, body } = req.body;
    await transporter.sendMail({ from: '"Mon IA Perso"', to: targetEmail, subject, text: body });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const multer = require('multer');
const upload = multer({ dest: '/tmp/' });
const Groq = require('groq-sdk');
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY || 'MISSING' });

app.post('/api/transcribe-audio', upload.single('audioFile'), async (req, res) => {
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
  if (!user) return res.status(401).json({ error: "Invalid credentials" });
  res.json({ success: true, user });
});

module.exports = app;
if (process.env.NODE_ENV !== 'production') {
  app.use(express.static(path.join(__dirname, '.')));
  app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
  app.listen(3000, () => console.log("Local Dev Server on 3000"));
}