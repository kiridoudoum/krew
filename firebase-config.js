// Import the functions you need from the SDKs you need
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyAOb6naVQ8GIN4irJuT4VuAK3x-S7xSHtk",
  authDomain: "krew-9d6e4.firebaseapp.com",
  projectId: "krew-9d6e4",
  storageBucket: "krew-9d6e4.firebasestorage.app",
  messagingSenderId: "407652934183",
  appId: "1:407652934183:web:d9825c9334bd1453286402",
  measurementId: "G-LM0HED743L"
};

// Initialisation de Firebase (Mode Compatibilité)
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();