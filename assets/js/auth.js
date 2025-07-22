/**
 * auth.js - Versione Corretta
 */
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { auth } from './firebase-init.js';

const loginForm = document.getElementById('login-form');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const loginBtn = document.getElementById('login-btn');
const registerBtn = document.getElementById('register-btn');
const errorMessage = document.getElementById('error-message');

onAuthStateChanged(auth, (user) => {
    if (user) {
        window.location.href = 'index.html';
    }
});

loginForm.addEventListener('submit', async (e) => {
    e.preventDefault(); // Previene il ricaricamento della pagina
    const email = emailInput.value;
    const password = passwordInput.value;
    if (!email || !password) {
        showError("Per favore, inserisci email e password.");
        return;
    }
    try {
        await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
        showError("Email o password non validi.");
        console.error("Errore di login:", error);
    }
});

registerBtn.addEventListener('click', async () => {
    const email = emailInput.value;
    const password = passwordInput.value;
    if (!email || password.length < 6) {
        showError("Email valida e password di almeno 6 caratteri.");
        return;
    }
    try {
        await createUserWithEmailAndPassword(auth, email, password);
    } catch (error) {
        showError("Errore registrazione. L'email potrebbe essere già in uso.");
        console.error("Errore di registrazione:", error);
    }
});

function showError(message) {
    errorMessage.textContent = message;
    errorMessage.classList.remove('d-none');
}