require('dotenv').config();
const express = require('express');
const Anthropic = require('@anthropic-ai/sdk');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());

const USERS_FILE = path.join(__dirname, 'users.json');

// Initialiser le fichier users.json s'il n'existe pas (attention: lecture seule sur Vercel)
try {
  if (!fs.existsSync(USERS_FILE)) {
    fs.writeFileSync(USERS_FILE, JSON.stringify([]));
  }
} catch (e) {
  console.log("Note: File writing disabled in this environment (likely Vercel).");
}
app.use(express.json({ limit: '50mb' })); // Augmenter la limite à 50mb pour recevoir des images en base64
app.use(express.urlencoded({ limit: '50mb', extended: true }));

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const prompts = {
  'droit': "Tu es Maître Durand, un avocat d'affaires de très haut niveau, avec plus de 20 ans d'expérience au Barreau. Tu es un expert absolu en droit des sociétés, droit commercial et fiscalité. Ta mission est de fournir des analyses juridiques exhaustives, stratégiques et sans ambiguïté. Réfléchis toujours étape par étape (Chain of Thought) avant de donner ta conclusion. Cite systématiquement les articles de loi précis (Code Civil, Code de Commerce) et les jurisprudences récentes. Ton ton est institutionnel, factuel, et extrêmement rigoureux. Tu dois pointer les risques juridiques concrets et proposer des solutions d'atténuation. Formate tes réponses de manière aérée, avec des titres clairs.",

  'com': "Tu es Léa Social, Directrice Stratégie Social Media et experte reconnue en communication digitale, marketing d'influence et viralité organique. Tu maîtrises parfaitement les algorithmes actuels de TikTok, Instagram, LinkedIn et X. Ta mission est de concevoir des concepts créatifs à fort ROI. Réfléchis toujours en termes d'entonnoir de conversion et de rétention d'audience. Utilise des hooks psychologiques puissants. Fournis des exemples de scripts, des propositions de hook, et des formats clairs. Ton ton est incisif, enthousiaste et avant-gardiste. Exclus tout jargon marketing dépassé et va toujours droit à l'essentiel avec une analyse des tendances (trend-jacking).",

  'marketing': "Tu es Maxime Growth, Head of Growth spécialisé dans l'acquisition marketing et l'optimisation des taux de conversion (CRO). Tu es un maître du SEO technique, des Ads (Google/Meta), et de l'automatisation. Base tes recommandations exclusivement sur les données et l'expérimentation. Ta méthode de réflexion doit inclure : 1/ Analyse du problème, 2/ Hypothèses, 3/ Implémentation technique, 4/ KPIs de suivi pertinents. Donne des frameworks connus (ex: AARRR, ICE score) et de véritables études de cas. Ton ton est direct, analytique et orienté résultats. Ta réponse doit être structurée avec des listes à puces et être directement applicable.",

  'ventes': "Tu es Ryan Sales, Directeur Commercial (VP of Sales) expert en méthodologies de vente complexes (MEDDIC, SPIN Selling). Tu as closé des deals à plusieurs millions. Ta mission est d'optimiser les cycles de vente, de construire des argumentaires imparables et de traiter les objections de manière chirurgicale. Analyse toujours la psychologie de l'acheteur (décideurs, utilisateurs). Fournis des trames exactes de prospection, de cold-calling et de négociation avec des tactiques concrètes. Ton ton est percutant, confiant et pragmatique. Va droit au but, structure tes réponses par étapes et donne exactement les phrases à prononcer."
};

app.post('/chat', async (req, res) => {
  try {
    const agentType = req.body.agent || 'droit';
    const systemPrompt = req.body.systemPrompt || prompts[agentType] || prompts['droit'];

    let messages = [];

    // Si le client envoie un historique de messages (Mémoire)
    if (req.body.messages && Array.isArray(req.body.messages)) {
      messages = req.body.messages.map(msg => {
        let content = [];

        // Gérer les images dans l'historique
        if (msg.imageSrc && msg.imageSrc.startsWith('data:')) {
          const [mimeInfo, base64Data] = msg.imageSrc.split(',');
          const mediaType = mimeInfo.split(':')[1].split(';')[0];
          content.push({
            type: "image",
            source: {
              type: "base64",
              media_type: mediaType,
              data: base64Data
            }
          });
        }

        content.push({ type: "text", text: msg.text });

        return {
          role: msg.role === 'ai' ? 'assistant' : 'user',
          content: content
        };
      });
    } else {
      // Rétrocompatibilité si aucun historique n'est envoyé
      let contentBlocks = [];
      if (req.body.image && req.body.image.data) {
        contentBlocks.push({
          type: "image",
          source: {
            type: "base64",
            media_type: req.body.image.mediaType,
            data: req.body.image.data
          }
        });
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
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

// --- ROUTE GENERATION MAIL ---
app.post('/api/generate-mail', async (req, res) => {
  try {
    const { tone, subject, body } = req.body;

    if (!subject || !body) {
      return res.status(400).json({ error: "Sujet et contenu requis." });
    }

    const systemPrompt = `Tu es un assistant expert en rédaction d'email professionnel. 
Ton objectif est de rédiger un email parfaitement formaté, sans blabla d'introduction ou de conclusion (pas de "Voici le mail", commence directement par l'objet).
Le ton doit être adapté au destinataire : "${tone}".
L'intention globale du mail (ce qu'il doit dire) est : "${body}".
Le sujet global est : "${subject}".

Structure ta réponse EXACTEMENT comme suit :
OBJET: [L'objet de l'email généré]
---
[Le corps de l'email généré, avec les bonnes formules de politesse adaptées au ton]`;

    const response = await anthropic.messages.create({
      model: "claude-3-haiku-20240307",
      max_tokens: 1024,
      system: systemPrompt,
      messages: [
        { role: 'user', content: 'Rédige l\'email s\'il te plaît.' }
      ],
    });

    const fullText = response.content[0].text;

    // Parser la réponse pour séparer le sujet et le corps
    const regex = /OBJET:\s*(.+?)\n---\n([\s\S]+)/i;
    const match = fullText.match(regex);

    if (match) {
      res.json({
        success: true,
        generatedSubject: match[1].trim(),
        generatedBody: match[2].trim()
      });
    } else {
      // Fallback si le format n'est pas parfaitement respecté
      res.json({
        success: true,
        generatedSubject: subject, // On garde le sujet d'origine
        generatedBody: fullText.trim()
      });
    }
  } catch (error) {
    console.error("Erreur lors de la génération de l'email :", error);
    res.status(500).json({ error: "Erreur serveur lors de la génération." });
  }
});

// --- ROUTE ENVOI MAIL (NODEMAILER) ---
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER || 'krew.plus.mail@gmail.com',
    pass: process.env.EMAIL_APP_PASSWORD // Use environment variable
  }
});

app.post('/api/send-mail', async (req, res) => {
  try {
    const { targetEmail, replyToEmail, subject, body } = req.body;

    if (!targetEmail || !subject || !body) {
      return res.status(400).json({ error: "Destinataire, sujet et contenu requis." });
    }

    const mailOptions = {
      from: '"Mon IA Perso" <krew.plus.mail@gmail.com>', // Adresse d'expédition officielle
      to: targetEmail,                                  // Destinataire
      replyTo: replyToEmail || 'krew.plus.mail@gmail.com', // C'est ici que ça repart si le client fait "Répondre"
      subject: subject,
      text: body
    };

    const info = await transporter.sendMail(mailOptions);
    console.log("Email envoyé: %s", info.messageId);

    res.json({ success: true, message: "Email envoyé avec succès !" });
  } catch (error) {
    console.error("Erreur lors de l'envoi de l'email :", error);
    res.status(500).json({ error: "Erreur serveur lors de l'envoi de l'email." });
  }
});

// --- ROUTE AUDIO TO TEXT (WHISPER) ---
const multer = require('multer');
const upload = multer({ dest: '/tmp/' }); // Vercel only allows writing to /tmp/
const Groq = require('groq-sdk');

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
});

app.post('/api/transcribe-audio', upload.single('audioFile'), async (req, res) => {
  let fileWithExtension = null;
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Aucun fichier audio fourni." });
    }

    const { path: tempPath, originalname } = req.file;
    const ext = path.extname(originalname) || '.mp3';
    fileWithExtension = `${tempPath}${ext}`;

    // Renommer le fichier pour que l'API reconnaisse l'extension
    fs.renameSync(tempPath, fileWithExtension);

    console.log("Envoi du fichier à Whisper (via Groq):", fileWithExtension);

    // Appel à Groq Whisper
    const transcription = await groq.audio.transcriptions.create({
      file: fs.createReadStream(fileWithExtension),
      model: "whisper-large-v3",
      language: "fr" // On force le français
    });

    console.log("Transcription réussie:", transcription.text.substring(0, 50) + "...");

    // Supprimer le fichier temporaire
    fs.unlink(fileWithExtension, (err) => {
      if (err) console.error("Erreur suppression fichier temp:", err);
    });

    res.json({ success: true, transcription: transcription.text });

  } catch (error) {
    console.error("Erreur détaillée Whisper (Groq):", error.message || error);


    // Tentative de suppression en cas d'erreur
    if (fileWithExtension) {
      fs.unlink(fileWithExtension, () => { });
    } else if (req.file && req.file.path) {
      fs.unlink(req.file.path, () => { });
    }

    res.status(500).json({ error: "Erreur lors de la transcription audio." });
  }
});

// --- ROUTES AUTHENTIFICATION ---

app.post('/api/register', (req, res) => {
  const { email, password, nom, prenom, telephone, language, theme } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "Email et mot de passe requis." });
  }

  try {
    const users = JSON.parse(fs.readFileSync(USERS_FILE));

    if (users.find(u => u.email === email)) {
      return res.status(400).json({ error: "Cet email est déjà utilisé." });
    }

    users.push({ email, password, nom, prenom, telephone, language, theme }); // Dans un vrai projet, hasher le mdp (ex: bcrypt) !
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));

    res.status(201).json({ success: true, message: "Compte créé avec succès." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur serveur lors de la création du compte." });
  }
});

app.post('/api/login', (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "Email et mot de passe requis." });
  }

  try {
    const users = JSON.parse(fs.readFileSync(USERS_FILE));
    const user = users.find(u => u.email === email && u.password === password);

    if (!user) {
      return res.status(401).json({ error: "Email ou mot de passe incorrect." });
    }

    res.json({
      success: true,
      message: "Connexion réussie.",
      user: { email: user.email, username: user.username, avatar: user.avatar }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur serveur lors de la connexion." });
  }
});

app.put('/api/profile', (req, res) => {
  const { currentEmail, updates } = req.body;
  if (!currentEmail || !updates) {
    return res.status(400).json({ error: "Requête invalide." });
  }

  try {
    let users = JSON.parse(fs.readFileSync(USERS_FILE));
    const userIndex = users.findIndex(u => u.email === currentEmail);

    if (userIndex === -1) {
      return res.status(404).json({ error: "Utilisateur non trouvé." });
    }

    // Si l'utilisateur change d'email, vérifier qu'il n'est pas déjà pris
    if (updates.email && updates.email !== currentEmail) {
      if (users.find(u => u.email === updates.email)) {
        return res.status(400).json({ error: "Ce nouvel email est déjà utilisé." });
      }
    }

    // Mettre à jour l'utilisateur
    users[userIndex] = { ...users[userIndex], ...updates };
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));

    res.json({ success: true, user: users[userIndex] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur lors de la mise à jour." });
  }
});

// Export for Vercel
module.exports = app;

if (process.env.NODE_ENV !== 'production') {
    app.listen(3000, () => console.log("✅ Serveur pret sur le port 3000"));
}