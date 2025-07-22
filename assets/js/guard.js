/**
 * guard.js
 * 
 * Questo script protegge le pagine. Controlla se l'utente è autenticato.
 * Se non lo è, lo reindirizza alla pagina di login.
 * Esporta anche l'utente corrente per poterlo usare in altri script.
 */
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { auth } from './firebase-init.js';

// onAuthStateChanged controlla lo stato del login e si attiva al caricamento della pagina
onAuthStateChanged(auth, (user) => {
    if (!user) {
        // Se non c'è un utente loggato, torna alla pagina di login
        console.log("Accesso non autorizzato. Reindirizzamento al login.");
        window.location.href = 'login.html';
    }
});