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
  'droit': "Tu es Maître Durand...",
  'com': "Tu es Léa Social...",
  'marketing': "Tu es Maxime Growth...",
  'ventes': "Tu es Ryan Sales..."
};

// --- ROUTES ---

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

module.exports = app;

if (process.env.NODE_ENV !== 'production' && require.main === module) {
  app.use(express.static(path.join(__dirname, '../public')));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/') || req.path === '/chat') return next();
    res.sendFile(path.join(__dirname, '../public/index.html'));
  });
  app.listen(3000, () => console.log("Local Server on 3000 (serving public)"));
}