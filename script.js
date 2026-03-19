const userInput = document.getElementById('user-input');
const sendBtn = document.getElementById('send-btn');
const chatMessages = document.getElementById('chat-messages');

let currentAgent = null;
let currentCustomPrompt = null;

let currentSessionId = null; // null signifie qu'on va créer un nouveau projet
let currentImageBase64 = null;
let currentImageMimeType = null;

function generateId() {
    return Math.random().toString(36).substr(2, 9);
}

function setAgent(agentType, element, customPrompt = null) {
    currentAgent = agentType === 'polyvalent' ? null : agentType;
    currentCustomPrompt = customPrompt;
    
    // Bascule de la sidebar entre la grille d'agents et la grille d'outils
    const agentsGrid = document.querySelector('.agents-grid:not(.tools-grid)');
    const toolsGrid = document.getElementById('tools-grid');
    if (agentsGrid && toolsGrid) {
        if (agentType) {
            agentsGrid.style.display = 'none';
            toolsGrid.style.display = 'grid';
        } else {
            agentsGrid.style.display = 'grid';
            toolsGrid.style.display = 'none';
        }
    }

    document.querySelectorAll('.agents-grid:not(.tools-grid) .agent-card').forEach(card => card.classList.remove('active'));
    if (element) {
        element.classList.add('active');
    }
    
    if (agentType && document.getElementById('tool-chat-card')) {
        activateTool('chat', document.getElementById('tool-chat-card'));
    }

    // Cacher l'écran audio si ouvert
    const audioScreen = document.getElementById('audio-to-text-screen');
    if (audioScreen && audioScreen.style.display !== 'none') {
        audioScreen.style.display = 'none';
        const chatMessages = document.getElementById('chat-messages');
        if (chatMessages) chatMessages.style.display = 'flex';
        const inputArea = document.querySelector('.input-area');
        if (inputArea) inputArea.style.display = 'flex';
    }

    // Cacher les suggestions quand un agent est sélectionné
    const suggestionsEl = document.getElementById('welcome-suggestions');
    if (suggestionsEl) {
        if (agentType) {
            suggestionsEl.style.display = 'none';
        } else {
            suggestionsEl.style.display = 'flex';
        }
    }

    const placeholders = {
        'polyvalent': "POSE TA QUESTION À L'AGENT POLYVALENT...",
        'droit': "POSE TA QUESTION À MAÎTRE DURAND...",
        'com': "PARLE AVEC LÉA...",
        'marketing': "FAIT MOI L'INSIGHT...",
        'ventes': "STRATÉGIE DE VENTE AVEC RYAN..."
    };

    // Nouveaux Titres Dynamiques
    const agentTitles = {
        'polyvalent': { light: "AGENT", bold: "POLYVALENT" },
        'droit': { light: "MAITRE DURAND", bold: "EXPERT EN DROIT" },
        'com': { light: "LÉA", bold: "EXPERT SOCIAL" },
        'marketing': { light: "MAXIME", bold: "EXPERT GROWTH" },
        'ventes': { light: "RYAN", bold: "EXPERT SALES" }
    };

    const titleLightEl = document.getElementById('welcome-title-light');
    const titleBoldEl = document.getElementById('welcome-title-bold');

    if (!agentType) {
        document.getElementById('user-input').placeholder = "POSE TA QUESTION A ...";
        if (titleLightEl) titleLightEl.innerText = "PRÊT";
        if (titleBoldEl) titleBoldEl.innerText = "A VOUS AIDER";
        return;
    }

    if (customPrompt) {
        document.getElementById('user-input').placeholder = `PARLE AVEC ${agentType.toUpperCase()}...`;
        if (titleLightEl) titleLightEl.innerText = agentType.toUpperCase();
        if (titleBoldEl) titleBoldEl.innerText = "IA PERSONNALISÉE";
    } else {
        document.getElementById('user-input').placeholder = placeholders[agentType] || "POSE TA QUESTION...";
        if (agentTitles[agentType]) {
            if (titleLightEl) titleLightEl.innerText = agentTitles[agentType].light;
            if (titleBoldEl) titleBoldEl.innerText = agentTitles[agentType].bold;
        }
    }
}

// 1. Initialisation au chargement
window.onload = () => {
    loadCustomAgents();
    renderHistory();
};

function resetToHome() {
    // Cacher tous les écrans secondaires
    const chatMessages = document.getElementById('chat-messages');
    if (chatMessages) chatMessages.style.display = 'none';

    const mailScreen = document.getElementById('mail-factory-screen');
    if (mailScreen) mailScreen.style.display = 'none';

    const audioScreen = document.getElementById('audio-to-text-screen');
    if (audioScreen) audioScreen.style.display = 'none';

    // Afficher l'écran principal
    const welcomeScreen = document.getElementById('welcome-screen');
    if (welcomeScreen) welcomeScreen.style.display = 'flex';

    const inputArea = document.querySelector('.input-area');
    if (inputArea) inputArea.style.display = 'flex';

    // Désélectionner l'agent actif et vider le contexte
    setAgent(null);
    document.querySelectorAll('.agent-card').forEach(c => c.classList.remove('active'));
    currentSessionId = null;
}

function selectWelcomeAgent(agentType, index) {
    const cards = document.querySelectorAll('.agent-card');
    if (cards[index]) {
        setAgent(agentType, cards[index]);
    } else {
        setAgent(agentType);
    }
    document.getElementById('user-input').focus();
}

// Fonction pour écrire progressivement du HTML (effet machine à écrire)
function typeHTML(element, htmlContent, speed = 10, onComplete) {
    let index = 0;
    let isTag = false;
    let currentHtml = '';
    const length = htmlContent.length;

    element.innerHTML = '';

    function typeChar() {
        if (index < length) {
            let char = htmlContent[index];
            currentHtml += char;
            index++;

            if (char === '<') {
                isTag = true;
            } else if (char === '>') {
                isTag = false;
            }

            if (isTag) {
                // Lire tout le tag d'un coup
                while (index < length && htmlContent[index - 1] !== '>') {
                    currentHtml += htmlContent[index];
                    index++;
                    if (htmlContent[index - 1] === '>') isTag = false;
                }
            }

            element.innerHTML = currentHtml;
            const chatMessages = document.getElementById('chat-messages');
            if (chatMessages) chatMessages.scrollTop = chatMessages.scrollHeight;

            setTimeout(typeChar, isTag ? 0 : speed);
        } else if (onComplete) {
            onComplete();
        }
    }
    typeChar();
}

function appendMessage(role, text, imageSrc = null, typewrite = false) {
    const div = document.createElement('div');
    div.className = `message ${role}`;

    let imgHTML = '';
    if (imageSrc) {
        imgHTML += `<div class="message-image-container"><img src="${imageSrc}"></div>`;
    }

    div.innerHTML = imgHTML + `<div class="content" style="width: 100%;"></div>`;
    const chatMessages = document.getElementById('chat-messages');
    chatMessages.appendChild(div);

    const contentDiv = div.querySelector('.content');

    if (text) {
        if (role === 'ai') {
            const parsedHTML = typeof marked !== 'undefined' ? marked.parse(text) : text;
            if (typewrite) {
                typeHTML(contentDiv, parsedHTML, 10);
            } else {
                contentDiv.innerHTML = parsedHTML;
            }
        } else {
            contentDiv.textContent = text;
        }
    }
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

async function sendMessage() {
    let text = userInput.value.trim();
    if (!text && !currentImageBase64) return;

    // Provide a default text if only sending an image to prompt the AI explicitly
    if (!text && currentImageBase64) {
        text = "Qu'est ce qu'on voit sur cette photo ?";
    }

    console.log("Envoi du message en cours...");

    // Preparer la source de l'image pour affichage visuel coté chat si presente
    let sentImageSrc = null;
    if (currentImageBase64) {
        sentImageSrc = `data:${currentImageMimeType};base64,${currentImageBase64}`;
    }

    appendMessage('user', text, sentImageSrc);

    // Initialiser une nouvelle session si nécessaire
    if (!currentSessionId) {
        currentSessionId = generateId();
    }

    // Sauvegarder le message utilisateur dans la session
    saveMessageToSession(currentSessionId, 'user', text || "Image envoyée", sentImageSrc, currentAgent, currentCustomPrompt);

    userInput.value = '';

    // Afficher l'indicateur de frappe
    const typingIndicatorId = 'typing-' + Date.now();
    const indicatorHTML = `
        <div id="${typingIndicatorId}" class="message ai" style="background: transparent; border: none; padding: 0; box-shadow: none;">
            <div class="typing-indicator">
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
            </div>
        </div>
    `;
    chatMessages.insertAdjacentHTML('beforeend', indicatorHTML);
    chatMessages.scrollTop = chatMessages.scrollHeight;

    try {
        const userEmail = localStorage.getItem('userEmail');
        let sessionMessages = [];

        if (userEmail && currentSessionId) {
            const historyKey = `chatSessions_${userEmail}`;
            const history = JSON.parse(localStorage.getItem(historyKey)) || [];
            const session = history.find(s => s.id === currentSessionId);
            if (session && session.messages) {
                // Send all messages from the session (which now includes the user's latest text due to the saveMessageToSession call above)
                sessionMessages = session.messages.map(msg => ({
                    role: msg.role,
                    text: msg.text,
                    imageSrc: msg.imageSrc
                }));
            }
        }

        const payload = {
            message: text, // Fallback
            messages: sessionMessages, // Historique complet pour la mémoire
            agent: currentAgent
        };

        // Injecter le contexte de la base de données + prompt personnalisé si existant
        let finalPrompt = "";
        let kbContext = getKnowledgeBaseContext();

        if (currentCustomPrompt) {
            finalPrompt = currentCustomPrompt;
        }

        if (kbContext) {
            finalPrompt += kbContext;
        }

        if (finalPrompt) {
            payload.systemPrompt = finalPrompt;
        }

        if (currentImageBase64) {
            payload.image = {
                data: currentImageBase64,
                mediaType: currentImageMimeType
            };
        }

        const response = await fetch('/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        // Supprimer l'indicateur
        const indicatorEl = document.getElementById(typingIndicatorId);
        if (indicatorEl) indicatorEl.remove();

        // Reset image state for next message
        currentImageBase64 = null;
        currentImageMimeType = null;

        // Cacher la prévisualisation d'image
        document.getElementById('image-preview-container').classList.remove('open');
        document.getElementById('image-preview-img').src = '';

        // Vider les inputs pour permettre de reprendre la même image au prochain clic
        document.getElementById('file-input-image').value = '';
        document.getElementById('file-input-generic').value = '';

        const data = await response.json();

        if (data.reply) {
            appendMessage('ai', data.reply, null, true); // typewrite = true
            saveMessageToSession(currentSessionId, 'ai', data.reply, null, currentAgent, currentCustomPrompt);
        } else {
            appendMessage('ai', "Erreur: " + (data.error || "Réponse vide"));
        }
    } catch (error) {
        console.error("Erreur lors de l'appel API:", error);

        // Supprimer l'indicateur en cas d'erreur
        const indicatorEl = document.getElementById(typingIndicatorId);
        if (indicatorEl) indicatorEl.remove();

        appendMessage('ai', "Le serveur ne répond pas. Vérifie ton terminal.");
    }
}

sendBtn.addEventListener('click', () => {
    sendMessage();
});

userInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        sendMessage();
    }
});

// --- MENU PIÈCES JOINTES ---
const attachmentBtn = document.getElementById('attachment-btn');
const attachmentMenu = document.getElementById('attachment-menu');

attachmentBtn.addEventListener('click', () => {
    attachmentMenu.classList.toggle('open');
    if (attachmentMenu.classList.contains('open')) {
        attachmentBtn.innerText = '−'; // Minus symbol
        attachmentBtn.style.fontSize = '24px';
    } else {
        attachmentBtn.innerText = '+';
        attachmentBtn.style.fontSize = '20px';
    }
});

// Fermer le menu si on clique ailleurs
document.addEventListener('click', (e) => {
    if (!attachmentBtn.contains(e.target) && !attachmentMenu.contains(e.target)) {
        attachmentMenu.classList.remove('open');
        attachmentBtn.innerText = '+';
        attachmentBtn.style.fontSize = '20px';
    }
});

// Gestion des clics sur les boutons d'importation
const btnImportImage = document.getElementById('btn-import-image');
const btnImportFile = document.getElementById('btn-import-file');
const fileInputImage = document.getElementById('file-input-image');
const fileInputGeneric = document.getElementById('file-input-generic');

btnImportImage.addEventListener('click', () => {
    fileInputImage.click();
});

btnImportFile.addEventListener('click', () => {
    fileInputGeneric.click();
});

// Gérer la sélection du fichier
fileInputImage.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
        const file = e.target.files[0];
        console.log("Image sélectionnée:", file.name);

        const reader = new FileReader();
        reader.onload = (event) => {
            // event.target.result a le format "data:image/jpeg;base64,...base64..."
            currentImageBase64 = event.target.result.split(',')[1];
            currentImageMimeType = file.type;

            // Afficher la prévisualisation
            document.getElementById('image-preview-img').src = event.target.result;

            // Formater le nom du fichier
            let nameParts = file.name.split('.');
            let ext = nameParts.length > 1 ? nameParts.pop() : '';
            let base = nameParts.join('.');
            if (base.length > 12) base = base.substring(0, 10) + '...';

            document.getElementById('preview-text-name').innerHTML = `${base.toUpperCase()}<br>${ext.toUpperCase()}`;
            document.getElementById('image-preview-container').classList.add('open');
        };
        reader.readAsDataURL(file);

        attachmentMenu.classList.remove('open');
        attachmentBtn.innerText = '+';
        attachmentBtn.style.fontSize = '20px';
    }
});

// Gérer la fermeture de la prévisualisation
document.getElementById('image-preview-close').addEventListener('click', () => {
    currentImageBase64 = null;
    currentImageMimeType = null;
    document.getElementById('image-preview-container').classList.remove('open');
    document.getElementById('image-preview-img').src = '';
    fileInputImage.value = ''; // Réinitialiser le champ
});

fileInputGeneric.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
        console.log("Fichier sélectionné:", e.target.files[0].name);
        // Optionnel : afficher le nom du fichier dans le chat
        attachmentMenu.classList.remove('open');
        attachmentBtn.innerText = '+';
        attachmentBtn.style.fontSize = '20px';
    }
});

// --- BASE DE CONNAISSANCES GLOBALE ---
const knowledgeUploadInput = document.getElementById('knowledge-upload-input');
const knowledgeFilesList = document.getElementById('knowledge-files-list');

function loadKnowledgeBase() {
    const userEmail = localStorage.getItem('userEmail');
    if (!userEmail) return;

    const knowledge = JSON.parse(localStorage.getItem(`knowledgeBase_${userEmail}`)) || [];

    if (knowledgeFilesList) {
        knowledgeFilesList.innerHTML = '';
        knowledge.forEach((doc, index) => {
            const item = document.createElement('div');
            item.style.display = 'flex';
            item.style.justifyContent = 'space-between';
            item.style.alignItems = 'center';
            item.style.background = '#ebebeb';
            item.style.padding = '8px 15px';
            item.style.borderRadius = '6px';
            item.style.fontSize = '12px';
            item.style.fontWeight = 'bold';

            const nameSpan = document.createElement('span');
            nameSpan.innerText = doc.name;

            const delBtn = document.createElement('button');
            delBtn.innerText = '✕';
            delBtn.style.background = 'transparent';
            delBtn.style.border = 'none';
            delBtn.style.color = '#ff4a4a';
            delBtn.style.cursor = 'pointer';
            delBtn.style.fontWeight = 'bold';
            delBtn.onclick = () => deleteKnowledgeDoc(index);

            item.appendChild(nameSpan);
            item.appendChild(delBtn);
            knowledgeFilesList.appendChild(item);
        });
    }
}

function deleteKnowledgeDoc(index) {
    const userEmail = localStorage.getItem('userEmail');
    if (!userEmail) return;
    let knowledge = JSON.parse(localStorage.getItem(`knowledgeBase_${userEmail}`)) || [];
    knowledge.splice(index, 1);
    localStorage.setItem(`knowledgeBase_${userEmail}`, JSON.stringify(knowledge));
    loadKnowledgeBase();
}

if (knowledgeUploadInput) {
    knowledgeUploadInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            const file = e.target.files[0];
            const reader = new FileReader();

            reader.onload = (event) => {
                const content = event.target.result;
                const userEmail = localStorage.getItem('userEmail');
                if (!userEmail) return;

                let knowledge = JSON.parse(localStorage.getItem(`knowledgeBase_${userEmail}`)) || [];
                knowledge.push({
                    name: file.name,
                    content: content
                });

                localStorage.setItem(`knowledgeBase_${userEmail}`, JSON.stringify(knowledge));
                loadKnowledgeBase();
                knowledgeUploadInput.value = ''; // Reset
            };

            // On lit en tant que texte pour pouvoir l'injecter facilement
            reader.readAsText(file);
        }
    });
}

function getKnowledgeBaseContext() {
    const userEmail = localStorage.getItem('userEmail');
    if (!userEmail) return "";

    const knowledge = JSON.parse(localStorage.getItem(`knowledgeBase_${userEmail}`)) || [];
    if (knowledge.length === 0) return "";

    let context = "\n\n=== CONTEXTE D'ENTREPRISE (BASE DE DONNÉES) ===\nVoici des documents internes de l'entreprise. Tu dois absolument prendre en compte ces informations pour tes réponses si elles sont pertinentes :\n";
    knowledge.forEach(doc => {
        context += `\n--- Document: ${doc.name} ---\n${doc.content}\n---------------------------\n`;
    });

    return context;
}

// Initial Call
document.addEventListener('DOMContentLoaded', loadKnowledgeBase);

// --- LOGIQUE D'HISTORIQUE (BLOCS PROJETS) ---

function saveMessageToSession(sessionId, role, text, imageSrc, agent, customPrompt = null) {
    const userEmail = localStorage.getItem('userEmail');
    if (!userEmail) return;
    const historyKey = `chatSessions_${userEmail}`;
    let history = JSON.parse(localStorage.getItem(historyKey)) || [];

    // Chercher si la session existe déjà
    let sessionIndex = history.findIndex(s => s.id === sessionId);

    if (sessionIndex === -1) {
        // Nouvelle session
        history.unshift({
            id: sessionId,
            title: text.substring(0, 30),
            agent: agent,
            customPrompt: customPrompt,
            messages: [{ role, text, imageSrc }]
        });
        // Garder les 15 derniers projets maximum
        if (history.length > 15) history.pop();
    } else {
        // Mettre à jour la session existante
        history[sessionIndex].messages.push({ role, text, imageSrc });
    }

    localStorage.setItem(historyKey, JSON.stringify(history));
    renderHistory();
}

function renderHistory() {
    const historyList = document.getElementById('history-list');
    if (!historyList) return;

    const userEmail = localStorage.getItem('userEmail');
    if (!userEmail) {
        historyList.innerHTML = '';
        return;
    }
    const historyKey = `chatSessions_${userEmail}`;
    let history = JSON.parse(localStorage.getItem(historyKey)) || [];

    // Nettoyer l'historique des anciennes entrées invalides (si existantes)
    history = history.filter(session => typeof session === 'object' && session.id && session.title);

    historyList.innerHTML = history.map(session => `
        <div class="history-item" onclick="loadSession('${session.id}')">
            <div class="history-content">
                <span>PROJET :</span>
                ${session.title.toUpperCase()}...
            </div>
            <button class="delete-session-btn" onclick="deleteSession(event, '${session.id}')">✕</button>
        </div>
    `).join('');
}

function loadSession(sessionId) {
    const userEmail = localStorage.getItem('userEmail');
    if (!userEmail) return;
    const historyKey = `chatSessions_${userEmail}`;
    const history = JSON.parse(localStorage.getItem(historyKey)) || [];
    const session = history.find(s => s.id === sessionId);

    if (!session) return;

    currentSessionId = sessionId;

    // Mettre à jour l'agent actif dans l'UI
    const agentMap = {
        'droit': 0,
        'com': 1,
        'marketing': 2,
        'ventes': 3
    };

    let cardElement = null;
    const cards = document.querySelectorAll('.agent-card');
    if (agentMap[session.agent] !== undefined) {
        cardElement = cards[agentMap[session.agent]];
    } else {
        cards.forEach(card => {
            if (card.querySelector('.name') && card.querySelector('.name').innerText.toUpperCase() === session.agent.toUpperCase()) {
                cardElement = card;
            }
        });
    }

    setAgent(session.agent, cardElement, session.customPrompt);

    // Vider et recharger les messages
    chatMessages.innerHTML = '';
    session.messages.forEach(msg => {
        appendMessage(msg.role, msg.text, msg.imageSrc);
    });

    console.log("Session chargée :", sessionId);
}

function deleteSession(event, sessionId) {
    event.stopPropagation(); // Éviter de déclencher le select() au clic

    const userEmail = localStorage.getItem('userEmail');
    if (!userEmail) return;
    const historyKey = `chatSessions_${userEmail}`;

    let history = JSON.parse(localStorage.getItem(historyKey)) || [];
    history = history.filter(s => s.id !== sessionId);
    localStorage.setItem(historyKey, JSON.stringify(history));

    if (currentSessionId === sessionId) {
        startNewChat();
    } else {
        renderHistory();
    }
}

function startNewChat() {
    chatMessages.innerHTML = '';
    currentSessionId = null;
    setAgent(null); // Réinitialiser l'interface par défaut
    console.log("Nouveau dialogue lancé !");
}

const newChatBtn = document.getElementById('new-chat-btn');

newChatBtn.addEventListener('click', startNewChat);

// --- CRÉATION D'AGENTS PERSONNALISÉS ---

let draggedAgentCard = null;

function deleteCustomAgent(e, agentId) {
    e.stopPropagation();
    if (!confirm("Voulez-vous vraiment supprimer cet agent personnalisé ?")) return;

    const userEmail = localStorage.getItem('userEmail');
    if (!userEmail) return;

    let customAgents = JSON.parse(localStorage.getItem(`customAgents_${userEmail}`)) || [];
    customAgents = customAgents.filter(a => a.id !== agentId && a.name !== agentId); // Fallback to name if id not present
    localStorage.setItem(`customAgents_${userEmail}`, JSON.stringify(customAgents));

    // Si l'agent supprimé était actif
    const activeCard = document.querySelector('.agent-card.active');
    if (activeCard && (activeCard.dataset.id === agentId || activeCard.dataset.name === agentId)) {
        // Rebasculer vers le premier agent par défaut (ex: 'droit')
        const firstDefault = document.querySelector('.agent-card:not(.custom)');
        if (firstDefault) setAgent('droit', firstDefault);
    }

    loadCustomAgents();
}
// --- AUDIO TO TEXT LOGIC ---
function showAudioToTextScreen() {
    const welcomeScreen = document.getElementById('welcome-screen');
    if (welcomeScreen) welcomeScreen.style.display = 'none';

    const chatMessages = document.getElementById('chat-messages');
    if (chatMessages) chatMessages.style.display = 'none';

    const inputArea = document.querySelector('.input-area');
    if (inputArea) inputArea.style.display = 'none';

    const audioScreen = document.getElementById('audio-to-text-screen');
    if (audioScreen) {
        audioScreen.style.display = 'flex';

        // Reset internal states
        const mainContent = document.getElementById('audio-main-content');
        if (mainContent) mainContent.style.display = 'flex';

        const resultView = document.getElementById('audio-result-view');
        if (resultView) resultView.style.display = 'none';

        const notionContainer = document.getElementById('audio-notion-container');
        if (notionContainer) notionContainer.style.display = 'none';

        const notionActions = document.getElementById('audio-notion-actions');
        if (notionActions) notionActions.style.display = 'none';

        const resultCard = document.getElementById('audio-result-card');
        if (resultCard) resultCard.style.display = 'none';

        const titleDisplay = document.getElementById('audio-title-display');
        if (titleDisplay) {
            titleDisplay.innerHTML = `AJOUTER VOTRE FICHIER AUDIO<br><span class="audio-card-subtitle">(REUNION DISCUTION COUR ...)</span>`;
        }

        const finalTextInput = document.getElementById('audio-final-text');
        if (finalTextInput) finalTextInput.value = '';

        const docTitleInput = document.getElementById('audio-doc-title');
        if (docTitleInput) docTitleInput.value = '';
    }
}

function closeAudioToTextScreen() {
    const audioScreen = document.getElementById('audio-to-text-screen');
    if (audioScreen) audioScreen.style.display = 'none';

    if (!currentAgent) {
        const welcomeScreen = document.getElementById('welcome-screen');
        if (welcomeScreen) welcomeScreen.style.display = 'flex';
    } else {
        const chatMessages = document.getElementById('chat-messages');
        if (chatMessages) chatMessages.style.display = 'flex';
    }

    const inputArea = document.querySelector('.input-area');
    if (inputArea) inputArea.style.display = 'flex';
}

// --- AUDIO TO TEXT UI BINDINGS ---
document.addEventListener('DOMContentLoaded', () => {
    const uploadBtn = document.getElementById('audio-upload-btn-container');
    const fileInput = document.getElementById('audio-file-input');
    const titleDisplay = document.getElementById('audio-title-display');
    const btnGoAudio = document.getElementById('audio-go-btn');
    const btnYes = document.getElementById('audio-btn-yes');
    const btnNo = document.getElementById('audio-btn-no');

    // 1. Clic sur le cercle '+' ouvre l'explorateur de fichiers
    if (uploadBtn && fileInput) {
        uploadBtn.addEventListener('click', () => fileInput.click());
    }

    // 2. Afficher le nom du fichier une fois sélectionné
    if (fileInput && titleDisplay) {
        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                const fileName = e.target.files[0].name;
                titleDisplay.innerHTML = `FICHIER PRÊT<br><span class="audio-card-subtitle" style="color: #a855f7;">${fileName}</span>`;
            }
        });
    }

    // 3. Bouton GO : Envoyer l'audio au serveur Node.js
    if (btnGoAudio) {
        btnGoAudio.addEventListener('click', async () => {
            if (!fileInput || fileInput.files.length === 0) {
                alert("Veuillez d'abord sélectionner un fichier audio !");
                return;
            }

            const audioFile = fileInput.files[0];
            
            // --- NOUVEAU : VERIFICATION TAILLE (LIMITE VERCEL 4.5MB) ---
            const maxSize = 4 * 1024 * 1024; // 4MB pour être sûr
            if (audioFile.size > maxSize) {
                alert(`Fichier trop volumineux (${(audioFile.size / (1024 * 1024)).toFixed(2)} Mo). La limite est de 4 Mo. Essayez un fichier plus court ou compressé.`);
                return;
            }

            const formData = new FormData();
            formData.append('audioFile', audioFile);

            const originalBtnText = btnGoAudio.innerText;
            btnGoAudio.innerText = "⏳";
            btnGoAudio.disabled = true;

            const plusImg = document.getElementById('audio-plus-img');
            if (plusImg) plusImg.classList.add('rotating');

            try {
                const response = await fetch('/api/transcribe-audio', {
                    method: 'POST',
                    body: formData
                });

                if (response.status === 413) {
                    throw new Error("Le fichier est trop lourd pour le serveur Vercel (Max 4.5 Mo).");
                }

                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(errorText || `Erreur serveur (${response.status})`);
                }

                const data = await response.json();

                if (data.success) {
                    const rawText = data.transcription;

                    // Étape 2 : Demander le formatage structuré
                    btnGoAudio.innerText = "✍️"; // Indiquer qu'on structure
                    const formatResponse = await fetch('/api/format-transcription', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ rawText: rawText })
                    });
                    
                    const formatData = await formatResponse.json();

                    if (formatData.success) {
                        const finalTextarea = document.getElementById('audio-final-text');
                        if (finalTextarea) {
                            finalTextarea.innerHTML = formatData.formattedText;
                        }
                    } else {
                        // Fallback au texte brut si le formatage échoue
                        const finalTextarea = document.getElementById('audio-final-text');
                        if (finalTextarea) finalTextarea.innerText = rawText;
                        console.error("Format Error:", formatData.error);
                    }

                    // --- NOUVEAU : Afficher le choix Notion seulement quand le texte est prêt ---
                    const resultCard = document.getElementById('audio-result-card');
                    if (resultCard) resultCard.style.display = 'flex';
                    const notionContainer = document.getElementById('audio-notion-container');
                    if (notionContainer) notionContainer.style.display = 'flex';
                    const notionActions = document.getElementById('audio-notion-actions');
                    if (notionActions) notionActions.style.display = 'flex';
                    
                    // Masquer le bouton GO car l'action est finie
                    if (btnGoAudio) btnGoAudio.style.display = 'none';
                } else {
                    alert("Erreur: " + (data.error || "Inconnue"));
                }
            } catch (error) {
                console.error("Erreur d'envoi audio:", error);
                alert("Erreur: " + error.message);
            } finally {
                btnGoAudio.innerText = originalBtnText;
                btnGoAudio.disabled = false;
                if (plusImg) plusImg.classList.remove('rotating');
            }
        });
    }

    // 4. Clic sur NON (On affiche la nouvelle interface au lieu de Notion)
    if (btnNo) {
        btnNo.addEventListener('click', () => {
            const mainContent = document.getElementById('audio-main-content');
            const resultView = document.getElementById('audio-result-view');

            if (mainContent) mainContent.style.display = 'none';

            // Show new Full Screen Result View
            if (resultView) {
                resultView.style.display = 'flex';
                // Trigger reflow for smooth display if needed
                resultView.offsetHeight;
            }
        });
    }

    // 4.5 Clic sur OUI (On crée la page Notion puis on affiche l'interface)
    if (btnYes) {
        btnYes.addEventListener('click', async () => {
            const docTitle = document.getElementById('audio-doc-title')?.value || 'Transcription Audio';
            // Extract text from the HTML formatted output
            const finalHtml = document.getElementById('audio-final-text')?.innerHTML || '';
            // Basic html-to-text to avoid sending raw html tags to Notion blocks
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = finalHtml;
            const docText = tempDiv.innerText || tempDiv.textContent || '';
            
            const originalText = btnYes.innerText;
            btnYes.innerText = "⏳ EN COURS...";
            btnYes.disabled = true;

            try {
                // Determine API root
                const apiRoot = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
                                ? 'http://localhost:3000' : '';
                
                const userEmail = localStorage.getItem('userEmail');
                const response = await fetch(`${apiRoot}/api/notion-create`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ title: docTitle, content: docText, email: userEmail })
                });

                const contentType = response.headers.get("content-type");
                if (!response.ok) {
                    let errorMessage = "Erreur Serveur";
                    if (contentType && contentType.includes("application/json")) {
                        const errorData = await response.json();
                        errorMessage = errorData.error || errorMessage;
                    } else {
                        errorMessage = await response.text();
                    }
                    throw new Error(errorMessage);
                }

                const data = await response.json();
                if (data.success) {
                    btnYes.innerText = "VOIR SUR NOTION";
                    btnYes.style.background = "#000000";
                    btnYes.style.color = "#ffffff";
                    btnYes.onclick = () => window.open(data.url, '_blank');
                    
                    // On ne ferme plus automatiquement tout de suite pour laisser le temps de cliquer
                    setTimeout(() => {
                        // On pourrait ajouter un bouton "Fermer" ou laisser comme ça
                    }, 5000);
                } else {
                    throw new Error(data.error || "Inconnue");
                }
            } catch (error) {
                console.error("Erreur Notion:", error);
                alert("Erreur Notion: " + error.message);
                btnYes.innerText = originalText;
                btnYes.disabled = false;
            }
        });
    }

    // 5. Clic sur COPIER (Audio)
    const btnCopyAudio = document.getElementById('audio-copy-btn');
    if (btnCopyAudio) {
        btnCopyAudio.addEventListener('click', () => {
            const docTitle = document.getElementById('audio-doc-title')?.value || '';
            const docText = document.getElementById('audio-final-text')?.innerText || ''; 

            const fullText = docTitle ? `${docTitle}\n\n${docText}` : docText;

            if (!fullText) return;

            navigator.clipboard.writeText(fullText).then(() => {
                const originalText = btnCopyAudio.innerText;
                btnCopyAudio.innerText = "COPIÉ !";
                setTimeout(() => btnCopyAudio.innerText = originalText, 2000);
            }).catch(err => {
                console.error('Erreur de copie:', err);
                alert("Erreur lors de la copie");
            });
        });
    }

    // 6. Clic sur CONNECTER NOTION (Profil)
    const btnConnectNotion = document.getElementById('connect-notion-btn');
    if (btnConnectNotion) {
        btnConnectNotion.addEventListener('click', () => {
            const userEmail = localStorage.getItem('userEmail');
            if (!userEmail) return alert("Veuillez vous reconnecter pour pouvoir lier Notion.");
            const apiRoot = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
                            ? 'http://localhost:3000' : '';
            window.location.href = `${apiRoot}/api/notion/auth?email=${encodeURIComponent(userEmail)}`;
        });
    }
});

// --- MAIL FACTORY LOGIC ---
function showMailFactoryScreen() {
    const welcomeScreen = document.getElementById('welcome-screen');
    if (welcomeScreen) welcomeScreen.style.display = 'none';

    const chatMessages = document.getElementById('chat-messages');
    if (chatMessages) chatMessages.style.display = 'none';

    const inputArea = document.querySelector('.input-area');
    if (inputArea) inputArea.style.display = 'none';

    // also hide audio screen if it's open somehow
    const audioScreen = document.getElementById('audio-to-text-screen');
    if (audioScreen) audioScreen.style.display = 'none';

    const mailScreen = document.getElementById('mail-factory-screen');
    if (mailScreen) mailScreen.style.display = 'flex';
}

function closeMailFactoryScreen() {
    const mailScreen = document.getElementById('mail-factory-screen');
    if (mailScreen) mailScreen.style.display = 'none';

    if (!currentAgent) {
        const welcomeScreen = document.getElementById('welcome-screen');
        if (welcomeScreen) welcomeScreen.style.display = 'flex';
    } else {
        const chatMessages = document.getElementById('chat-messages');
        if (chatMessages) chatMessages.style.display = 'flex';
    }

    const inputArea = document.querySelector('.input-area');
    if (inputArea) inputArea.style.display = 'flex';
}

// Mail Factory UI Bindings
document.addEventListener('DOMContentLoaded', () => {
    // Retour Accueil avec le logo principal
    const mainLogo = document.getElementById('main-krew-logo');
    if (mainLogo) {
        mainLogo.addEventListener('click', resetToHome);
    }

    // 1. Gestion des pilules (Tons)
    const pills = document.querySelectorAll('.mail-pill');
    pills.forEach(pill => {
        pill.addEventListener('click', function () {
            pills.forEach(p => p.classList.remove('active-pill'));
            this.classList.add('active-pill');
        });
    });

    // 2. Bouton GO (Génération)
    const btnGo = document.getElementById('mail-go-btn');
    if (btnGo) {
        btnGo.addEventListener('click', async () => {
            const activePill = document.querySelector('.mail-pill.active-pill');
            const pillText = activePill ? activePill.innerText.trim().toUpperCase() : 'AUTRE';

            let tone = "Professionnel et standard";
            if (pillText === "MON BOSSE") {
                tone = "Très formel, extrêmement sérieux et respectueux. Tu t'adresses au grand patron ou à la direction générale de l'entreprise. Utilise le vouvoiement, un ton solennel et des formules de politesse de très haut niveau institutionnel. Ne sois pas du tout familier.";
            } else if (pillText === "UN COLLÈGE") {
                tone = "Professionnel mais cordial et collaboratif. Tu t'adresses à un collègue de travail régulier. Tutoiement ou vouvoiement de bureau.";
            } else if (pillText === "UN AMIE") {
                tone = "Décontracté, amical et chaleureux. Tutoiement obligatoire, pas de formules de politesse rigides.";
            } else if (pillText === "LA FAMILLE") {
                tone = "Affectueux, familier et protecteur. Tutoiement obligatoire.";
            } else {
                tone = "Professionnel et adapté au contexte classique.";
            }
            const subjectInput = document.getElementById('mail-subject-input');
            const bodyInput = document.getElementById('mail-body-input');

            const subject = subjectInput ? subjectInput.value.trim() : '';
            const body = bodyInput ? bodyInput.value.trim() : '';

            if (!subject || !body) {
                alert("Veuillez remplir le sujet et le texte.");
                return;
            }

            const originalBtnText = btnGo.innerText;
            btnGo.innerText = "⏳";
            btnGo.disabled = true;

            const plusImg = document.getElementById('mail-plus-icon');
            if (plusImg) plusImg.classList.add('rotating');

            try {
                const response = await fetch('/api/generate-mail', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ tone, subject, body })
                });

                const data = await response.json();

                if (data.success) {
                    const generatedTitle = document.getElementById('mail-generated-title');
                    const generatedBody = document.getElementById('mail-generated-body');
                    if (generatedTitle) generatedTitle.innerText = data.generatedSubject;
                    if (generatedBody) generatedBody.value = data.generatedBody;
                } else {
                    alert("Erreur lors de la génération : " + (data.error || "Inconnue"));
                }
            } catch (error) {
                console.error("Erreur serveur:", error);
                alert("Impossible de contacter le serveur.");
            } finally {
                btnGo.innerText = originalBtnText;
                btnGo.disabled = false;
                if (plusImg) plusImg.classList.remove('rotating');
            }
        });
    }

    // 3. Bouton COPIER
    const btnCopy = document.getElementById('mail-copy-btn');
    if (btnCopy) {
        btnCopy.addEventListener('click', () => {
            const bodyText = document.getElementById('mail-generated-body')?.value || '';
            const subjectText = document.getElementById('mail-generated-title')?.innerText || '';

            const fullText = `Objet: ${subjectText}\n\n${bodyText}`;

            if (!bodyText) return;

            navigator.clipboard.writeText(fullText).then(() => {
                const originalText = btnCopy.innerText;
                btnCopy.innerText = "COPIÉ !";
                setTimeout(() => btnCopy.innerText = originalText, 2000);
            }).catch(err => {
                console.error('Erreur de copie:', err);
                alert("Erreur lors de la copie");
            });
        });
    }

    // 4. Bouton ENVOYER (Automatique en arrière-plan)
    const btnSend = document.getElementById('mail-send-btn');
    if (btnSend) {
        btnSend.addEventListener('click', async () => {
            const targetEmail = document.getElementById('mail-target-email')?.value.trim() || '';
            const subjectText = document.getElementById('mail-generated-title')?.innerText || '';
            const bodyText = document.getElementById('mail-generated-body')?.value || '';

            if (!bodyText) {
                alert("Générez d'abord un email.");
                return;
            }

            if (!targetEmail) {
                alert("Veuillez saisir l'adresse email du destinataire.");
                return;
            }

            const userEmail = localStorage.getItem('userEmail');

            // --- NOUVEAU : GESTION INCREMENTALE GMAIL ---
            async function trySendMail(token) {
                const endpoint = token ? '/api/send-gmail-oauth' : '/api/send-mail';
                const bodyData = { 
                    targetEmail: targetEmail,
                    subject: subjectText,
                    body: bodyText
                };
                if (token) bodyData.accessToken = token;

                const response = await fetch(endpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(bodyData)
                });

                if (response.ok) {
                    btnSend.innerText = "ENVOYÉ ! ✅";
                    setTimeout(() => {
                        btnSend.innerText = originalBtnText;
                        btnSend.disabled = false;
                    }, 3000);
                } else {
                    const errorData = await response.json();
                    if (response.status === 401 && token) {
                        localStorage.removeItem('googleAccessToken');
                        alert("Session expirée. Re-tentez l'envoi.");
                    } else {
                        alert("Erreur lors de l'envoi : " + (errorData.error || "Inconnu"));
                    }
                    btnSend.innerText = originalBtnText;
                    btnSend.disabled = false;
                }
            }

            try {
                let accessToken = localStorage.getItem('googleAccessToken');
                const user = auth.currentUser;

                // Si pas de token mais connecté avec Google -> Demander permission
                if (!accessToken && user && user.providerData.some(p => p.providerId === 'google.com')) {
                    const confirmAccess = confirm("Pour envoyer ce mail depuis votre adresse Gmail, une autorisation supplémentaire est nécessaire. Voulez-vous continuer ?");
                    if (confirmAccess) {
                        const provider = new firebase.auth.GoogleAuthProvider();
                        provider.addScope('https://www.googleapis.com/auth/gmail.send');
                        
                        try {
                            const result = await auth.currentUser.reauthenticateWithPopup(provider);
                            accessToken = result.credential.accessToken;
                            localStorage.setItem('googleAccessToken', accessToken);
                        } catch (popupError) {
                            console.error("Popup Error:", popupError);
                            alert("L'autorisation a été annulée ou a échoué.");
                            btnSend.innerText = originalBtnText;
                            btnSend.disabled = false;
                            return;
                        }
                    } else {
                        // L'utilisateur refuse : on tente l'envoi classique via Krew assistant
                        accessToken = null;
                    }
                }

                await trySendMail(accessToken);

            } catch (error) {
                console.error("Erreur d'envoi:", error);
                alert("Impossible de joindre le serveur pour l'envoi.");
                btnSend.innerText = originalBtnText;
                btnSend.disabled = false;
            }
        });
    }
});

function loadCustomAgents() {
    const userEmail = localStorage.getItem('userEmail');
    if (!userEmail) return;

    const customAgents = JSON.parse(localStorage.getItem(`customAgents_${userEmail}`)) || [];
    const grid = document.querySelector('.agents-grid');
    if (!grid) return;

    // Nettoyer les custom agents existants de la grille pour éviter les doublons
    document.querySelectorAll('.agent-card.custom').forEach(el => el.remove());

    customAgents.forEach((agent, index) => {
        // S'assurer qu'il a un ID
        if (!agent.id) agent.id = agent.name + '_' + index;

        const card = document.createElement('div');
        card.className = 'agent-card custom';
        card.dataset.id = agent.id;
        card.dataset.name = agent.name;
        card.draggable = true;

        card.onclick = function () { setAgent(agent.name, this, agent.prompt); };

        // --- Drag and Drop Events ---
        card.addEventListener('dragstart', function (e) {
            draggedAgentCard = this;
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', this.dataset.id);
            setTimeout(() => this.style.opacity = '0.4', 0);
        });

        card.addEventListener('dragend', function () {
            this.style.opacity = '1';
            document.querySelectorAll('.agent-card.custom').forEach(c => c.classList.remove('over'));
            draggedAgentCard = null;
        });

        card.addEventListener('dragover', function (e) {
            e.preventDefault(); // Nécessaire pour le drop
            e.dataTransfer.dropEffect = 'move';
            return false;
        });

        card.addEventListener('dragenter', function () {
            if (this !== draggedAgentCard) {
                this.classList.add('over');
            }
        });

        card.addEventListener('dragleave', function () {
            this.classList.remove('over');
        });

        card.addEventListener('drop', function (e) {
            e.stopPropagation();
            if (draggedAgentCard !== this) {
                const draggedId = draggedAgentCard.dataset.id;
                const targetId = this.dataset.id;

                let agents = JSON.parse(localStorage.getItem(`customAgents_${userEmail}`)) || [];

                // Si l'agent n'a pas d'ID, s'assurer que c'est géré (fallback sur agent généré récemment)
                const draggedIndex = agents.findIndex(a => (a.id || a.name + '_' + agents.indexOf(a)) === draggedId);
                const targetIndex = agents.findIndex(a => (a.id || a.name + '_' + agents.indexOf(a)) === targetId);

                if (draggedIndex > -1 && targetIndex > -1) {
                    const [removed] = agents.splice(draggedIndex, 1);
                    agents.splice(targetIndex, 0, removed);
                    localStorage.setItem(`customAgents_${userEmail}`, JSON.stringify(agents));
                    loadCustomAgents();
                }
            }
            return false;
        });

        card.innerHTML = `
            <div class="agent-card-delete" onclick="deleteCustomAgent(event, '${agent.id}')">✕</div>
            <div class="agent-emoji">${agent.emoji}</div>
            <div class="agent-info">
                <span class="name">${agent.name.toUpperCase()}</span>
                <span class="role">PERSO</span>
            </div>
        `;
        grid.appendChild(card);
    });

    // --- Mettre à jour les agents dans la modale Profil ---
    const allAgentsContainer = document.querySelector('.all-agents-container');
    if (allAgentsContainer) {
        allAgentsContainer.innerHTML = '';

        customAgents.forEach(agent => {
            const slot = document.createElement('div');
            slot.className = 'agent-slot';
            slot.innerHTML = `<div style="font-size:30px; pointer-events: none;">${agent.emoji}</div>`;
            slot.title = agent.name;
            slot.style.cursor = 'grab';
            slot.draggable = true;

            slot.ondragstart = (e) => {
                e.dataTransfer.effectAllowed = 'copyMove';
                e.dataTransfer.setData('application/json', JSON.stringify({ source: 'custom', id: agent.id || agent.name }));
            };

            slot.onclick = () => {
                const profileModal = document.getElementById('profile-modal');
                if (profileModal) profileModal.classList.remove('active');

                const correspondingCard = document.querySelector(`.agent-card.custom[data-id="${agent.id}"]`);
                if (correspondingCard) setAgent(agent.name, correspondingCard, agent.prompt);
            };
            allAgentsContainer.appendChild(slot);
        });

        // Ajouter le bouton +
        const addBtn = document.createElement('div');
        addBtn.className = 'add-agent-btn';
        addBtn.id = 'open-create-agent-btn-new';
        addBtn.innerHTML = '<span>+</span>';
        addBtn.onclick = () => {
            const profileModal = document.getElementById('profile-modal');
            if (profileModal) profileModal.classList.remove('active');
            const createAgentModal = document.getElementById('create-agent-modal');
            if (createAgentModal) createAgentModal.classList.add('active');
        };
        allAgentsContainer.appendChild(addBtn);
    }
}

const openCreateAgentBtn = document.getElementById('open-create-agent-btn');
const openCreateAgentBtnNew = document.getElementById('open-create-agent-btn-new');
const createAgentModal = document.getElementById('create-agent-modal');
const closeCreateAgentModalBtn = document.getElementById('close-create-agent-modal');
const createAgentForm = document.getElementById('create-agent-form');

const openWizardHandler = () => {
    const profileModal = document.getElementById('profile-modal');
    if (profileModal) profileModal.classList.remove('active');
    createAgentModal.classList.add('active');
};

if (openCreateAgentBtn) openCreateAgentBtn.addEventListener('click', openWizardHandler);
if (openCreateAgentBtnNew) openCreateAgentBtnNew.addEventListener('click', openWizardHandler);



if (closeCreateAgentModalBtn) {
    closeCreateAgentModalBtn.addEventListener('click', () => {
        createAgentModal.classList.remove('active');
    });
}

if (createAgentModal) {
    createAgentModal.addEventListener('click', (e) => {
        if (e.target === createAgentModal) {
            createAgentModal.classList.remove('active');
        }
    });
}

// --- SIDEBAR TOGGLE LOGIC ---
const toggleSidebarBtn = document.getElementById('toggle-sidebar-btn');
const sidebar = document.querySelector('.sidebar');

if (toggleSidebarBtn && sidebar) {
    toggleSidebarBtn.addEventListener('click', () => {
        sidebar.classList.toggle('expanded');
    });
}

// --- WIZARD LOGIC ---
const wizardSteps = [
    {
        key: 'job',
        question: 'Quel est son métier précis ?',
        options: [
            'Expert en SEO technique',
            'Rédacteur publicitaire créatif',
            'Avocat en droit des affaires',
            'Développeur Senior Python',
            'Commercial BtoB'
        ]
    },
    {
        key: 'tone',
        question: 'Quel est son ton ?',
        options: [
            'Institutionnel et formel',
            'Direct et incisif',
            'Pédagogique et patient',
            'Enthousiaste et motivant',
            'Sarcastique'
        ]
    },
    {
        key: 'posture',
        question: 'Quelle est sa posture ?',
        options: [
            'Un mentor encourageant',
            'Un assistant exécutif discret',
            'Un consultant expert factuel',
            'Un critique sévère mais juste'
        ]
    },
    {
        key: 'task',
        question: 'Quelle est la tâche finale concrète ?',
        options: [
            'Rédiger du contenu optimisé',
            'Analyser un document complexe',
            'Simuler une interview client',
            'Proposer une stratégie d\'acquisition',
            'Corriger du code'
        ]
    },
    {
        key: 'problem',
        question: 'Quel est le problème spécifique à résoudre ?',
        options: [
            'Augmenter le taux de conversion',
            'Simplifier un jargon technique',
            'Trouver des failles juridiques',
            'Optimiser la performance de l\'application'
        ]
    },
    {
        key: 'reasoning',
        question: 'Comment doit-il réfléchir ?',
        options: [
            'Étape par étape (Chain of thought)',
            'Aller droit au but avec la solution',
            'Proposer 3 options puis choisir la meilleure',
            'Poser des questions avant de répondre'
        ]
    },
    {
        key: 'audience',
        question: 'À qui s\'adresse-t-il ?',
        options: [
            'Grand public (débutants)',
            'Directeurs / Cadres dirigeants',
            'Développeurs expérimentés',
            'Enfants ou adolescents'
        ]
    },
    {
        key: 'sources',
        question: 'Ses sources de références ?',
        options: [
            'Connaissances générales à jour',
            'Théories académiques et scientifiques',
            'Règlementation française stricte',
            'Best-practices du web'
        ]
    },
    {
        key: 'format',
        question: 'Format de la réponse attendue ?',
        options: [
            'Paragraphes aérés',
            'Markdown structuré (titres, gras)',
            'Tableau comparatif (CSV ou Markdown)',
            'Liste à puces (Bullets)'
        ]
    },
    {
        key: 'constraints',
        question: 'Règles d\'exclusion (Ce qu\'il ne doit JAMAIS faire) ?',
        options: [
            'Ne jamais donner de faux espoirs',
            'Ne pas utiliser de jargon',
            'Ne pas dépasser 3 phrases par paragraphe',
            'Aucune introduction ni conclusion superflue'
        ]
    },
    {
        key: 'length',
        question: 'Longueur attendue ?',
        options: [
            'Ultra-concis (1-2 phrases)',
            'Court (1 petit paragraphe)',
            'Moyen (3-4 paragraphes structurés)',
            'Long et détaillé'
        ]
    }
];

let currentWizStep = 0;
let wizData = {};

const wizStepIdentity = document.getElementById('wiz-step-identity');
const wizStepQuestions = document.getElementById('wiz-step-questions');
const wizCurrentIdentity = document.getElementById('wiz-current-identity');
const wizQuestionTitle = document.getElementById('wiz-question-title');
const wizAnswersContainer = document.getElementById('wiz-answers-container');
const wizCustomAnswer = document.getElementById('wiz-custom-answer');
const wizPrevBtn = document.getElementById('wiz-prev-btn');
const wizNextBtn = document.getElementById('wiz-next-btn');
const wizStartBtn = document.getElementById('wiz-start-btn');

if (wizStartBtn) {
    wizStartBtn.addEventListener('click', (e) => {
        e.preventDefault();
        const nameVal = document.getElementById('wiz-name').value.trim();
        const jobVal = document.getElementById('wiz-job').value.trim();

        if (!nameVal || !jobVal) {
            alert('Veuillez renseigner un nom et un métier.');
            return;
        }

        if (wizStepIdentity && wizStepQuestions) {
            wizStepIdentity.style.display = 'none';
            wizStepQuestions.style.display = 'flex';
        }

        if (wizCurrentIdentity) {
            wizCurrentIdentity.innerText = `Création de ${nameVal} - ${jobVal}`;
        }

        renderWizardStep(0);
    });
}

function renderWizardStep(stepIndex) {
    if (!wizQuestionTitle || stepIndex >= wizardSteps.length) return;

    const step = wizardSteps[stepIndex];
    wizQuestionTitle.innerText = step.question;

    // Nettoyer les pilules
    wizAnswersContainer.innerHTML = '';
    wizCustomAnswer.style.display = 'none';
    wizCustomAnswer.value = wizData[step.key] || ''; // Pré-remplir si existant

    let selectedPillVal = wizData[step.key] || null;
    let isCustomSelected = false;

    // Créer les pilules (Options prédéfinies)
    step.options.forEach(opt => {
        const btn = document.createElement('button');
        btn.className = 'wiz-option';
        if (selectedPillVal === opt) btn.classList.add('selected');

        btn.innerHTML = `<span>${opt}</span><span style="font-weight:900;">›</span>`;

        btn.onclick = (e) => {
            e.preventDefault();
            // Désélectionner toutes les autres
            document.querySelectorAll('.wiz-option').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');

            wizData[step.key] = opt;
            wizCustomAnswer.style.display = 'none';
        };
        wizAnswersContainer.appendChild(btn);
    });

    // Bouton "Autre"
    const autreBtn = document.createElement('button');
    autreBtn.className = 'wiz-option';
    // Si la valeur existe mais n'est pas dans les options, alors c'est un champ "Autre"
    if (selectedPillVal && !step.options.includes(selectedPillVal)) {
        autreBtn.classList.add('selected');
        wizCustomAnswer.style.display = 'block';
        isCustomSelected = true;
    }

    autreBtn.innerHTML = `<span>AUTRE</span><span style="font-weight:900;">+</span>`;
    autreBtn.onclick = (e) => {
        e.preventDefault();
        document.querySelectorAll('.wiz-option').forEach(b => b.classList.remove('selected'));
        autreBtn.classList.add('selected');

        wizCustomAnswer.style.display = 'block';
        wizCustomAnswer.focus();
        wizData[step.key] = wizCustomAnswer.value; // Initialiser ave la valeur du champ
    };
    wizAnswersContainer.appendChild(autreBtn);

    // Mettre à jour la valeur "Autre" lorsqu'on l'édite
    wizCustomAnswer.oninput = (e) => {
        if (autreBtn.classList.contains('selected')) {
            wizData[step.key] = e.target.value.trim();
        }
    };

    // Boutons de navigation
    wizPrevBtn.style.visibility = stepIndex === 0 ? 'hidden' : 'visible';

    if (stepIndex === wizardSteps.length - 1) {
        wizNextBtn.innerText = 'GÉNÉRER L\'AGENT ✓';
        wizNextBtn.style.background = '#00C853'; // Vert pour la fin
    } else {
        wizNextBtn.innerText = 'SUIVANT →';
        wizNextBtn.style.background = 'var(--accent-purple)';
    }
}

if (wizNextBtn) {
    wizNextBtn.addEventListener('click', (e) => {
        e.preventDefault();

        // Récupérer la dernière valeur saisie dans "Autre" si sélectionné
        const isAutreSelected = document.querySelector('.wiz-option:last-child').classList.contains('selected');
        if (isAutreSelected) {
            wizData[wizardSteps[currentWizStep].key] = wizCustomAnswer.value.trim();
        }

        const currentKey = wizardSteps[currentWizStep].key;
        if (!wizData[currentKey]) {
            alert('Veuillez sélectionner ou écrire une réponse.');
            return;
        }

        if (currentWizStep < wizardSteps.length - 1) {
            currentWizStep++;
            renderWizardStep(currentWizStep);
        } else {
            generateAgentFromWizard();
        }
    });
}

if (wizPrevBtn) {
    wizPrevBtn.addEventListener('click', (e) => {
        e.preventDefault();
        if (currentWizStep > 0) {
            currentWizStep--;
            renderWizardStep(currentWizStep);
        }
    });
}

function generateAgentFromWizard() {
    const name = document.getElementById('wiz-name').value.trim() || 'IA Anonyme';
    const emoji = document.getElementById('wiz-emoji').value.trim() || '🤖';
    const job = document.getElementById('wiz-job').value.trim() || wizData['job'] || '';

    const tone = wizData['tone'] || '';
    const posture = wizData['posture'] || '';
    const task = wizData['task'] || '';
    const problem = wizData['problem'] || '';
    const reasoning = wizData['reasoning'] || '';
    const audience = wizData['audience'] || '';
    const sources = wizData['sources'] || '';
    // Optional fields not strictly required by wizard but part of old prompt
    const examples = ''; // We removed this from the visual steps to simplify
    const format = wizData['format'] || '';
    const constraints = wizData['constraints'] || '';
    const length = wizData['length'] || '';

    const prompt = `Tu es ${name}, ${job}. Ton ton est ${tone} et ta posture est ${posture}.
Ta mission est de ${task}. Le problème spécifique que tu dois résoudre est : ${problem}.
Voici tes étapes de raisonnement : ${reasoning}.
Tu t'adresses à : ${audience}.
Sources de référence : ${sources}.
Format attendu : ${format}.
Contraintes à respecter absolument : ${constraints}.
Longueur attendue : ${length}.`;

    const userEmail = localStorage.getItem('userEmail');
    if (!userEmail) return alert("Vous n'êtes pas connecté");

    const customAgents = JSON.parse(localStorage.getItem(`customAgents_${userEmail}`)) || [];
    customAgents.push({ id: generateId(), name, emoji, prompt });
    localStorage.setItem(`customAgents_${userEmail}`, JSON.stringify(customAgents));

    loadCustomAgents();

    if (createAgentModal) {
        createAgentModal.classList.remove('active');
    }

    // Réinitialiser le Wizard
    currentWizStep = 0;
    wizData = {};
    document.getElementById('wiz-name').value = '';
    document.getElementById('wiz-job').value = '';

    // Sélectionner le nouvel agent fraîchement ajouté
    setTimeout(() => {
        const newCards = document.querySelectorAll('.agent-card.custom');
        if (newCards.length > 0) {
            const lastCard = newCards[newCards.length - 1];
            setAgent(name, lastCard, prompt);
            document.getElementById('user-input').focus();
        }
    }, 100);
}

// Initialiser le Wizard lors de l'ouverture
if (openCreateAgentBtn) {
    openCreateAgentBtn.addEventListener('click', () => {
        // ... previous code to close profile modal ...
        const profileModal = document.getElementById('profile-modal');
        if (profileModal) profileModal.classList.remove('active');

        if (createAgentModal) {
            createAgentModal.classList.add('active');
            // reset and render
            currentWizStep = 0;
            wizData = {};
            document.getElementById('wiz-name').value = '';
            document.getElementById('wiz-job').value = '';

            // Show identity step, hide questions step
            if (wizStepIdentity && wizStepQuestions) {
                wizStepIdentity.style.display = 'flex';
                wizStepQuestions.style.display = 'none';
            }
        }
    });

    // --- GESTION DES FAVORIS ---
    function renderFavorites() {
        const userEmail = localStorage.getItem('userEmail');
        if (!userEmail) return;

        let favs = JSON.parse(localStorage.getItem(`favoriteAgents_${userEmail}`));
        if (!favs || favs.length !== 4) {
            favs = [
                { id: 'droit', type: 'default', colorClass: 'bg-blue', colorHex: '#92c5fd', emoji: '👩🏻‍⚖️', name: 'droit', shortName: 'MAÎTRE', shortRole: 'DURAND', prompt: null },
                { id: 'com', type: 'default', colorClass: 'bg-pink', colorHex: '#fd8bca', emoji: '👔', name: 'com', shortName: 'LÉA', shortRole: 'SOCIAL', prompt: null },
                { id: 'marketing', type: 'default', colorClass: 'bg-green', colorHex: '#a7f3d0', emoji: '🚀', name: 'marketing', shortName: 'MAXIME', shortRole: 'GROWTH', prompt: null },
                { id: 'ventes', type: 'default', colorClass: 'bg-yellow', colorHex: '#fde047', emoji: '💻', name: 'ventes', shortName: 'RYAN', shortRole: 'SALES', prompt: null }
            ];
            localStorage.setItem(`favoriteAgents_${userEmail}`, JSON.stringify(favs));
        }

        // Modal Favoris (Top Section)
        const favSlots = document.querySelectorAll('.favorite-slot');
        favSlots.forEach((slot, index) => {
            const ag = favs[index];
            slot.innerHTML = `<div style="font-size:30px; pointer-events: none;">${ag.emoji || '🤖'}</div>`;
            slot.style.background = ag.colorHex || ag.color || '#e0e0e0';

            slot.draggable = true;
            slot.style.cursor = 'grab';

            // Drag start from a favorite slot (to swap)
            slot.ondragstart = (e) => {
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('application/json', JSON.stringify({ source: 'favorite', index: index }));
                setTimeout(() => slot.style.opacity = '0.4', 0);
            };

            slot.ondragend = (e) => {
                slot.style.opacity = '1';
            };

            slot.ondragover = e => {
                e.preventDefault();
                slot.style.border = '2px dashed rgba(0,0,0,0.5)';
                slot.style.opacity = '0.7';
            };

            slot.ondragleave = e => {
                slot.style.border = 'none';
                slot.style.opacity = '1';
            };

            slot.ondrop = e => {
                e.preventDefault();
                slot.style.border = 'none';
                slot.style.opacity = '1';

                try {
                    const rawData = e.dataTransfer.getData('application/json');
                    if (!rawData) return;
                    const data = JSON.parse(rawData);

                    if (data.source === 'favorite') {
                        // Swap favorites
                        if (data.index !== index) {
                            const temp = favs[index];
                            favs[index] = favs[data.index];
                            favs[data.index] = temp;
                            localStorage.setItem(`favoriteAgents_${userEmail}`, JSON.stringify(favs));
                            renderFavorites();
                        }
                    } else if (data.source === 'custom') {
                        // Replace favorite with custom agent
                        let customAgents = JSON.parse(localStorage.getItem(`customAgents_${userEmail}`)) || [];
                        const customAgent = customAgents.find(a => (a.id || a.name) === data.id);

                        if (customAgent) {
                            favs[index] = {
                                id: customAgent.id || customAgent.name,
                                type: 'custom',
                                colorHex: '#e0e0e0',
                                colorClass: '',
                                emoji: customAgent.emoji,
                                name: customAgent.name,
                                shortName: customAgent.name.toUpperCase().substring(0, 10),
                                shortRole: 'PERSO',
                                prompt: customAgent.prompt
                            };
                            localStorage.setItem(`favoriteAgents_${userEmail}`, JSON.stringify(favs));
                            renderFavorites();
                        }
                    }
                } catch (err) {
                    console.error("Drop error", err);
                }
            };
        });

        // Sidebar Update
        const sidebarGrid = document.querySelector('.agents-grid');
        if (!sidebarGrid) return;

        // Selecting the first 4 elements which are our pinned agents
        const cards = sidebarGrid.querySelectorAll('.agent-card');

        for (let i = 0; i < 4; i++) {
            if (cards[i]) {
                const ag = favs[i];
                const card = cards[i];

                // Retain active status visually
                const isActive = card.classList.contains('active');

                // Reset classes
                card.className = `agent-card ${ag.colorClass}`;
                if (isActive) card.classList.add('active');

                if (ag.type === 'custom') {
                    card.classList.add('favorite-card'); // Exclude from loadCustomAgents cleanup
                    card.style.background = '#f5f5f5'; // light grey for custom
                    card.dataset.id = ag.id;
                } else {
                    card.classList.remove('favorite-card');
                    card.style.background = ''; // Defined by CSS
                    card.removeAttribute('data-id');
                }

                card.innerHTML = `
                <div class="agent-emoji">${ag.emoji || '🤖'}</div>
                <div class="agent-info">
                    <span class="name">${ag.shortName}</span>
                    <span class="role">${ag.shortRole}</span>
                </div>
            `;

                card.onclick = function () {
                    setAgent(ag.name, this, ag.prompt);
                };
            }
        }
    }

    // Ensure favorites are rendered on load
    document.addEventListener('DOMContentLoaded', () => {
        // Call renderFavorites and loadCustomAgents
        renderFavorites();
        loadCustomAgents();
    });
}

// --- EXTRA POST-CONNECTION SELECTION SCREEN LOGIC ---
function selectNasaAgent(type) {
    const screen = document.getElementById('new-agent-selection-screen');
    if (screen) screen.style.display = 'none';
    
    // Select the corresponding card in the sidebar if exists
    let sidebarCard = null;
    const colorMap = {
        'droit': '.bg-blue',
        'com': '.bg-pink',
        'marketing': '.bg-green'
    };
    const selector = colorMap[type];
    if (selector) {
        sidebarCard = document.querySelector(`.agent-card${selector}`);
    }
    
    setAgent(type, sidebarCard);
    document.getElementById('user-input').focus();
}
// Sync Avatar and Handle Screen Display Logic
document.addEventListener('DOMContentLoaded', () => {
    // If we're on a new login (no session), the screen is naturally visible.
    // If the user already has an active session picked, we might want to hide it
    // But per instructions "ajoute cette partie apres la connextion", it should always show 
    // when arriving on app.html unless specifically clicking somewhere.
    
    // Piggyback auth state to sync avatar image
    if (typeof auth !== 'undefined') {
        auth.onAuthStateChanged(async (user) => {
            if (user) {
                try {
                    const userDoc = await db.collection('users').doc(user.email).get();
                    if (userDoc.exists && userDoc.data().avatar) {
                        const nasaAvatar = document.getElementById('nasa-avatar-display');
                        if (nasaAvatar) {
                            nasaAvatar.innerHTML = `<img src="${userDoc.data().avatar}" alt="Avatar">`;
                        }
                    }
                } catch(e) {
                    console.log("Error loading avatar for nasa overlay", e);
                }
            }
        });
    }
    
    // Enhance startNewChat to also show our screen instead of the default "PRÊT" text
    const oldNewChatBtn = document.getElementById('new-chat-btn');
    if (oldNewChatBtn) {
        oldNewChatBtn.addEventListener('click', () => {
            const screen = document.getElementById('new-agent-selection-screen');
            if (screen) screen.style.display = 'flex';
        });
    }
    
    // Enhance main logo click to also show our screen
    const mainLogo = document.getElementById('main-krew-logo');
    if (mainLogo) {
        mainLogo.addEventListener('click', () => {
            resetToHome();
            const screen = document.getElementById('new-agent-selection-screen');
            if (screen) screen.style.display = 'flex';
        });
    }
});

// --- OUTILS SIDEBAR LOGIC ---
function activateTool(toolName, element) {
    // 1. Mettre à jour la classe "active" dans la grille d'outils
    const toolCards = document.querySelectorAll('#tools-grid .agent-card');
    toolCards.forEach(card => card.classList.remove('active'));
    if (element) {
        element.classList.add('active');
    }

    // 2. Cacher tous les écrans principaux
    const chatMessages = document.getElementById('chat-messages');
    const inputArea = document.querySelector('.input-area');
    const audioScreen = document.getElementById('audio-to-text-screen');
    const mailScreen = document.getElementById('mail-factory-screen');
    const welcomeScreen = document.getElementById('welcome-screen');
    
    if (chatMessages) chatMessages.style.display = 'none';
    if (inputArea) inputArea.style.display = 'none';
    if (audioScreen) audioScreen.style.display = 'none';
    if (mailScreen) mailScreen.style.display = 'none';
    if (welcomeScreen) welcomeScreen.style.display = 'none';

    // 3. Afficher l'écran correspondant
    if (toolName === 'chat') {
        if (chatMessages) {
            chatMessages.style.display = 'flex';
            // Supprimer d'éventuels messages "bientôt" si existants !
            if (chatMessages.innerHTML.includes('Nouveaux outils bientôt')) {
                // If history isn't re-rendered, we might just empty it for 'other', but let's just use loadSession rendering normally
                // Since this might clear actual chat log if we just clear it. Actually, `chatMessages` stores real divs.
                // Best to not blindly wipe it. Just remove the specific placeholder if found.
                // It's handled by history load mostly anyway.
            }
        }
        if (inputArea) inputArea.style.display = 'flex';
    } else if (toolName === 'audio') {
        if (typeof showAudioToTextScreen === 'function') {
            showAudioToTextScreen(); 
        } else if (audioScreen) {
             audioScreen.style.display = 'flex';
        }
    } else if (toolName === 'mail') {
        if (typeof showMailFactoryScreen === 'function') {
            showMailFactoryScreen();
        } else if (mailScreen) {
            mailScreen.style.display = 'flex';
        }
    } else if (toolName === 'other') {
        if (chatMessages) {
            chatMessages.style.display = 'flex';
        }
    }
}