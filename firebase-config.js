// REMPLACEZ LES VALEURS CI-DESSOUS PAR VOTRE CONFIGURATION FIREBASE
// Vous les trouverez dans les paramètres de votre projet sur https://console.firebase.google.com/
const firebaseConfig = {
  apiKey: "VOTRE_API_KEY",
  authDomain: "VOTRE_AUTH_DOMAIN",
  projectId: "VOTRE_PROJECT_ID",
  storageBucket: "VOTRE_STORAGE_BUCKET",
  messagingSenderId: "VOTRE_MESSAGING_SENDER_ID",
  appId: "VOTRE_APP_ID"
};

// Initialisation de Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
