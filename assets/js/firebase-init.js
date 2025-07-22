/**
 * firebase-init.js
 * 
 * Questo file inizializza la connessione con i servizi Firebase
 * e esporta le istanze di Authentication e Firestore per essere
 * utilizzate in altri script.
 */

// Importa le funzioni che ci servono direttamente dai CDN di Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// La tua configurazione Firebase (la stessa che hai fornito)
// ATTENZIONE: Proteggi queste chiavi in un progetto pubblico
const firebaseConfig = {
   apiKey: "AIzaSyA5MYKTGKrJ2BHj1JYapu2rJCPpWL2-T5o", // <-- INSERISCI LA TUA CHIAVE API QUI
  authDomain: "b2-study-app-project.firebaseapp.com",
  projectId: "b2-study-app-project",
  storageBucket: "b2-study-app-project.appspot.com", // CORRETTO: ho rimosso .firebasestorage
  messagingSenderId: "384988317901",
  appId: "1:384988317901:web:e7eaa1e348fbfb53088184",
};

// Inizializza l'app Firebase
const app = initializeApp(firebaseConfig);

// Crea ed esporta le istanze dei servizi che useremo
export const auth = getAuth(app);
export const db = getFirestore(app);