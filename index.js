require('dotenv').config();
const express = require('express');
const Anthropic = require('@anthropic-ai/sdk');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');
const multer = require('multer');
const Groq = require('groq-sdk');
const { Client } = require('@notionhq/client');
const admin = require('firebase-admin');

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

const notionClientId = process.env.NOTION_CLIENT_ID || 'MISSING';
const notionClientSecret = process.env.NOTION_CLIENT_SECRET || 'MISSING';
const appUrl = process.env.APP_URL || 'http://localhost:3000';

// initialization Firebase Admin
const serviceAccountVar = process.env.FIREBASE_SERVICE_ACCOUNT;
if (serviceAccountVar) {
  try {
    const serviceAccount = JSON.parse(serviceAccountVar);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    console.log("Firebase Admin Initialized");
  } catch (e) {
    console.error("Firebase Admin Init Error:", e);
  }
} else {
  console.log("FIREBASE_SERVICE_ACCOUNT variable missing");
}
const db = admin.apps.length > 0 ? admin.firestore() : null;

const prompts = {
  'droit': "Ton créateur est Antoine. Tu es Maître Durand, un avocat d'affaires de très haut niveau...",
  'com': "Ton créateur est Antoine. Tu es Léa Social, Directrice Stratégie Social Media...",
  'marketing': "Ton créateur est Antoine. Tu es Maxime Growth, Head of Growth...",
  'ventes': "Ton créateur est Antoine. Tu es Ryan Sales, Directeur Commercial..."
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
    const ext = path.extname(req.file.originalname) || '.mp3';
    const newPath = `${req.file.path}${ext}`;
    fs.renameSync(req.file.path, newPath);

    const transcription = await groq.audio.transcriptions.create({
      file: fs.createReadStream(newPath),
      model: "whisper-large-v3",
      language: "fr"
    });

    // Nettoyer le fichier renommé
    if (fs.existsSync(newPath)) fs.unlinkSync(newPath);

    res.json({ success: true, transcription: transcription.text });
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
  }
});

// NOUVEAU : Structuration du texte après transcription
app.post('/api/format-transcription', async (req, res) => {
  if (anthropicApiKey === 'MISSING') return res.status(500).json({ error: "Missing Anthropic API Key" });
  try {
    const { rawText } = req.body;
    if (!rawText) return res.status(400).json({ error: "Texte manquant" });

    const formattedResponse = await anthropic.messages.create({
      model: "claude-3-haiku-20240307",
      max_tokens: 1500,
      system: "Tu es un assistant expert en rédaction et structuration de comptes-rendus. Ton rôle est de transformer une transcription brute en un document structuré, élégant et facile à lire. Utilise des balises HTML simples : <h3> pour les titres, <p> pour les paragraphes, <strong> pour les mots clés importants, et <ul>/<li> pour les listes. Ne mets pas de balise <html> ou <body>, renvoie juste le contenu. Reste fidèle au contenu original mais rends-le très 'visuel' et organisé.",
      messages: [{ role: 'user', content: `Structure et formate ce texte brut de façon professionnelle et visuelle : ${rawText}` }],
    });

    res.json({ success: true, formattedText: formattedResponse.content[0].text.trim() });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/notion/auth', (req, res) => {
  const { email } = req.query;
  if (!email) return res.status(400).send("Email requis pour associer le compte Notion.");
  
  const authUrl = `https://api.notion.com/v1/oauth/authorize?client_id=${notionClientId}&response_type=code&owner=user&redirect_uri=${encodeURIComponent(appUrl + '/api/notion/callback')}&state=${encodeURIComponent(email)}`;
  res.redirect(authUrl);
});

app.get('/api/notion/callback', async (req, res) => {
  const { code, state, error } = req.query;
  if (error) return res.status(400).send(`Erreur lors de la connexion Notion: ${error}`);
  if (!code || !state) return res.status(400).send("Paramètres manquants.");

  const email = state;
  const redirectUri = `${appUrl}/api/notion/callback`;
  const encoded = Buffer.from(`${notionClientId}:${notionClientSecret}`).toString('base64');

  try {
    const response = await fetch('https://api.notion.com/v1/oauth/token', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': `Basic ${encoded}`
      },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: redirectUri
      })
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Erreur lors de l'échange du token");

    if (db) {
      // SAUVEGARDE DANS FIRESTORE (Persistant sur Vercel)
      await db.collection('users').doc(email).set({
        notion_access_token: data.access_token
      }, { merge: true });
      
      console.log(`Token Notion sauvegardé pour ${email}`);
      res.redirect('/app.html?notion=success');
    } else {
      // Fallback local (peu fiable sur Vercel car le fichier /tmp/users.json est éphémère)
      console.error("ERREUR CRITIQUE: Firebase Admin n'est pas initialisé sur Vercel.");
      res.status(500).send("ERREUR SERVEUR: La variable d'environnement FIREBASE_SERVICE_ACCOUNT n'est pas détectée ou mal configurée sur Vercel. Veuillez vérifier vos variables d'environnement et faire un 'Redeploy'.");
    }
  } catch (err) {
    console.error("Notion OAuth Error:", err);
    res.status(500).send(`Erreur : ${err.message}`);
  }
});

app.post('/api/notion-create', async (req, res) => {
  const { title, content, email } = req.body;
  if (!email) return res.status(400).json({ error: "Email utilisateur manquant" });

  let notion_token = null;

  if (db) {
    // RÉCUPÉRATION DEPUIS FIRESTORE
    const userDoc = await db.collection('users').doc(email).get();
    if (userDoc.exists) {
        notion_token = userDoc.data().notion_access_token;
        console.log("Token Notion trouvé dans Firestore pour:", email);
    } else {
        console.log("Aucun document trouvé dans Firestore pour:", email);
    }
  } else {
    // Fallback local
    let users = loadUsers();
    const user = users.find(u => u.email === email);
    if (user) notion_token = user.notion_access_token;
  }

  if (!notion_token) {
    return res.status(401).json({ error: "Veuillez d'abord connecter votre compte Notion dans votre profil (ou verifiez que FIREBASE_SERVICE_ACCOUNT est configuré)." });
  }

  const userNotion = new Client({ auth: notion_token });

  try {
    if (!content) return res.status(400).json({ error: "Contenu manquant" });

    // Step 1: Find a database or page
    let targetDbId = null;
    let targetPageId = null;

    const searchRes = await userNotion.search({
      filter: { property: 'object', value: 'database' },
      sort: { direction: 'descending', timestamp: 'last_edited_time' }
    });

    if (searchRes.results.length > 0) {
      targetDbId = searchRes.results[0].id;
    } else {
      const pageRes = await userNotion.search({
        filter: { property: 'object', value: 'page' },
        sort: { direction: 'descending', timestamp: 'last_edited_time' },
        page_size: 1
      });
      if (pageRes.results.length > 0) {
        targetPageId = pageRes.results[0].id;
        console.log("Page Notion cible trouvée:", targetPageId);
      } else {
        console.log("Aucune page/DB partagée trouvée.");
        return res.status(404).json({ error: "Aucune page ou base de données trouvée. Avez-vous partagé une page avec Krew+ sur Notion ?" });
      }
    }

    const blocks = [];
    const textChunks = content.match(/[\s\S]{1,2000}/g) || ["Contenu vide"];
    for (const chunk of textChunks) {
        blocks.push({
            object: 'block',
            type: 'paragraph',
            paragraph: {
                rich_text: [{ type: 'text', text: { content: chunk } }]
            }
        });
    }

    let createPayload = { children: blocks };
    
    if (targetDbId) {
      createPayload.parent = { database_id: targetDbId };
      // Most DBs have a title property named 'title' theoretically, wait, it is a key mapping. Let's send basic structure.
      // Notion creates pages in databases using properties where the key matching `title` type is expected
      createPayload.properties = {
        title: {
          title: [{ text: { content: title || "Nouvelle transcription audio" } }]
        }
      };
    } else if (targetPageId) {
      createPayload.parent = { page_id: targetPageId };
      createPayload.properties = {
        title: [{ text: { content: title || "Nouvelle transcription audio" } }]
      };
    }

    const response = await userNotion.pages.create(createPayload);
    res.json({ success: true, url: response.url });
  } catch (error) {
    console.error("Notion Create Error:", error);
    if (error.code === 'validation_error' && targetDbId) {
        return res.status(500).json({ error: "La structure de votre base de données ne correspond pas ou le champ titre par défaut a été renommé. Créez plutôt une page standard sur Notion et partagez-la avec l'application." });
    }
    res.status(500).json({ error: error.message });
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
