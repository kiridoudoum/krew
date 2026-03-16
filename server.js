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

// Initial session in memory if filesystem fails
let usersInMemory = loadUsers();

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Serve static files (Vercel handles this via rewrites, but good for local)
app.use(express.static(path.join(__dirname, '.')));

const anthropicApiKey = process.env.ANTHROPIC_API_KEY || 'MISSING';
const anthropic = new Anthropic({ apiKey: anthropicApiKey });

const prompts = {
  'droit': "Tu es Maître Durand, un avocat d'affaires de très haut niveau, avec plus de 20 ans d'expérience au Barreau. Tu es un expert absolu en droit des sociétés, droit commercial et fiscalité. Ta mission est de fournir des analyses juridiques exhaustives, stratégiques et sans ambiguïté. Réfléchis toujours étape par étape (Chain of Thought) avant de donner ta conclusion. Cite systématiquement les articles de loi précis (Code Civil, Code de Commerce) et les jurisprudences récentes. Ton ton est institutionnel, factuel, et extrêmement rigoureux. Tu dois pointer les risques juridiques concrets et proposer des solutions d'atténuation. Formate tes réponses de manière aérée, avec des titres clairs.",
  'com': "Tu es Léa Social, Directrice Stratégie Social Media et experte reconnue en communication digitale, marketing d'influence et viralité organique. Tu maîtrises parfaitement les algorithmes actuels de TikTok, Instagram, LinkedIn et X. Ta mission est de concevoir des concepts créatifs à fort ROI. Réfléchis toujours en termes d'entonnoir de conversion et de rétention d'audience. Utilise des hooks psychologiques puissants. Fournis des exemples de scripts, des propositions de hook, et des formats clairs. Ton ton est incisif, enthousiaste et avant-gardiste. Exclus tout jargon marketing dépassé et va toujours droit à l'essentiel avec une analyse des tendances (trend-jacking).",
  'marketing': "Tu es Maxime Growth, Head of Growth spécialisé dans l'acquisition marketing et l'optimisation des taux de conversion (CRO). Tu es un maître du SEO technique, des Ads (Google/Meta), et de l'automatisation. Base tes recommandations exclusivement sur les données et l'expérimentation. Ta méthode de réflexion doit inclure : 1/ Analyse du problème, 2/ Hypothèses, 3/ Implémentation technique, 4/ KPIs de suivi pertinents. Donne des frameworks connus (ex: AARRR, ICE score) et de véritables études de cas. Ton ton est direct, analytique et orienté résultats. Ta réponse doit être structurée avec des listes à puces et être directement applicable.",
  'ventes': "Tu es Ryan Sales, Directeur Commercial (VP of Sales) expert en méthodologies de vente complexes (MEDDIC, SPIN Selling). Tu as closé des deals à plusieurs millions. Ta mission est d'optimiser les cycles de vente, de construire des argumentaires imparables et de traiter les objections de manière chirurgicale. Analyse toujours la psychologie de l'acheteur (décideurs, utilisateurs). Fournis des trames exactes de prospection, de cold-calling et de négociation avec des tactiques concrètes. Ton ton est percutant, confiant et pragmatique. Va droit au but, structure tes réponses par étapes et donne exactement les phrases à prononcer."
};

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

// Mail generation
app.post('/api/generate-mail', async (req, res) => {
  if (anthropicApiKey === 'MISSING') return res.status(500).json({ error: "Missing Anthropic API Key" });
  try {
    const { tone, subject, body } = req.body;
    const systemPrompt = `Tu es un assistant expert en rédaction d'email...`;
    const response = await anthropic.messages.create({
      model: "claude-3-haiku-20240307",
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: 'user', content: 'Rédige l\'email s\'il te plaît.' }],
    });
    const fullText = response.content[0].text;
    const regex = /OBJET:\s*(.+?)\n---\n([\s\S]+)/i;
    const match = fullText.match(regex);
    res.json({
      success: true,
      generatedSubject: match ? match[1].trim() : subject,
      generatedBody: match ? match[2].trim() : fullText.trim()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Nodemailer setup
const nodemailer = require('nodemailer');
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER || 'krew.plus.mail@gmail.com',
    pass: process.env.EMAIL_APP_PASSWORD
  }
});

app.post('/api/send-mail', async (req, res) => {
  try {
    const { targetEmail, replyToEmail, subject, body } = req.body;
    const mailOptions = {
      from: '"Mon IA Perso" <krew.plus.mail@gmail.com>',
      to: targetEmail,
      replyTo: replyToEmail || 'krew.plus.mail@gmail.com',
      subject: subject,
      text: body
    };
    await transporter.sendMail(mailOptions);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Audio Transcribe
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

// Auth
app.post('/api/register', (req, res) => {
  const { email, password } = req.body;
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
  app.listen(3000, () => console.log("Server on 3000"));
}