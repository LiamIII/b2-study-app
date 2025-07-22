/**
 * quiz.js - VERSIONE FINALE CON GESTIONE ASINCRONA DELL'AUTH
 *
 * Risolve il "race condition" attendendo la conferma dell'utente loggato
 * prima di tentare di caricare i dati del quiz (es. il Mazzo degli Errori).
 */

import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { auth } from './firebase-init.js';
import * as common from './common.js';

// Stato globale specifico per la pagina del quiz
let currentQuizQuestions = [];
let currentQuestionIndex = 0;
let userExamAnswers = {};
let timerInterval = null;
let secondsElapsed = 0;

// L'evento DOMContentLoaded ora delega il controllo dell'autenticazione a Firebase
document.addEventListener('DOMContentLoaded', () => {
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            // L'utente è confermato, ora possiamo procedere in sicurezza
            console.log("Quiz page: Utente confermato", user.email);
            await initializeQuiz();
        } else {
            // Se per qualche motivo l'utente non è (o non è più) loggato, torna al login.
            console.log("Quiz page: Nessun utente, reindirizzamento al login.");
            window.location.href = 'login.html';
        }
    });
});

/**
 * Funzione principale che prepara il set di domande corretto in base all'URL
 * e avvia la sessione di quiz.
 */
async function initializeQuiz() {
    // Usiamo la cache di localStorage, che è veloce e già disponibile
    const allQuestionsJSON = localStorage.getItem('allQuestions');
    if (!allQuestionsJSON) {
        handleFatalError("Dati delle domande non trovati in cache. Per favore, torna alla dashboard per caricarli.");
        return;
    }
    const allQuestions = JSON.parse(allQuestionsJSON);

    const urlParams = new URLSearchParams(window.location.search);
    const mode = urlParams.get('mode');
    const categoryName = urlParams.get('category');
    let questionsToAsk = [];
    let quizTitle = "Quiz";

    if (mode === 'exam') {
        quizTitle = "Simulazione Esame";
        const examQuestionIdsJSON = localStorage.getItem('examSession_questionIds');
        if (!examQuestionIdsJSON) { handleFatalError("Nessuna sessione d'esame trovata. Avviala dalla dashboard."); return; }
        const examQuestionIds = JSON.parse(examQuestionIdsJSON);
        questionsToAsk = allQuestions.filter(q => examQuestionIds.includes(q.id));
        localStorage.removeItem('examSession_questionIds');
    } else if (mode === 'srs') {
        quizTitle = "Ripasso Intelligente (SRS)";
        const srsData = await common.getSrsData();
        const today = new Date().toISOString().split('T')[0];
        const dueQuestionIds = Object.keys(srsData).filter(id => srsData[id].nextReview <= today).map(id => Number(id));
        questionsToAsk = allQuestions.filter(q => dueQuestionIds.includes(q.id));
        if (questionsToAsk.length === 0) { handleFatalError("Nessuna domanda in scadenza per il ripasso oggi. Ottimo lavoro!"); return; }
    } else if (mode === 'errors') {
        quizTitle = "Allenamento sugli Errori";
        const errorDeckIds = await common.getErrorDeck(); // Ora auth.currentUser è garantito che esista
        questionsToAsk = allQuestions.filter(q => errorDeckIds.includes(q.id));
        if (questionsToAsk.length === 0) { handleFatalError("Il tuo 'Mazzo degli Errori' è vuoto. Complimenti!"); return; }
    } else if (categoryName) {
        const submode = urlParams.get('submode');
        quizTitle = `Quiz: ${categoryName}`;
        const questionsForCategory = allQuestions.filter(q => q.categoria === categoryName);
        if (submode === 'all') {
            questionsToAsk = questionsForCategory;
        } else {
            questionsToAsk = questionsForCategory.filter(q => !q.isCorrect);
            if (questionsToAsk.length === 0) {
                alert("Nessun errore in questa categoria! Per un ripasso completo, ti verranno mostrate tutte le domande.");
                questionsToAsk = questionsForCategory;
            }
        }
    } else {
        handleFatalError("Nessuna modalità o categoria specificata.");
        return;
    }

    startQuiz(questionsToAsk, quizTitle);
    setupQuizEventListeners();
}

function handleFatalError(message) {
    const container = document.querySelector('.card-body');
    document.getElementById('quiz-category-title').style.display = 'none';
    if (container) container.innerHTML = `<div class="alert alert-info">${message}</div>`;
}

function startQuiz(questions, title) {
    const mode = new URLSearchParams(window.location.search).get('mode');
    document.getElementById('quiz-category-title').textContent = title;
    currentQuizQuestions = questions.sort(() => Math.random() - 0.5);
    currentQuestionIndex = 0;
    if (mode === 'exam') startTimer();
    if (currentQuizQuestions.length > 0) renderQuestion();
    else handleFatalError("Nessuna domanda da mostrare per questa modalità.");
}

function startTimer() {
    const timerDisplay = document.getElementById('timer-display');
    if (!timerDisplay) return; // Sicurezza extra se l'elemento non esiste
    timerDisplay.classList.remove('d-none');
    secondsElapsed = 0;
    timerInterval = setInterval(() => {
        secondsElapsed++;
        const minutes = Math.floor(secondsElapsed / 60);
        const seconds = secondsElapsed % 60;
        timerDisplay.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }, 1000);
}

function stopTimer() {
    clearInterval(timerInterval);
    return secondsElapsed;
}

function setupQuizEventListeners() {
    document.getElementById('options-container').addEventListener('click', (e) => {
        if (e.target.tagName === 'BUTTON') handleAnswer(e.target);
    });
    document.getElementById('next-question-btn').addEventListener('click', async () => {
        const mode = new URLSearchParams(window.location.search).get('mode');
        currentQuestionIndex++;
        if (currentQuestionIndex < currentQuizQuestions.length) {
            renderQuestion();
        } else {
            if (mode === 'exam') {
                const totalTime = stopTimer();
                const examResults = { questions: currentQuizQuestions, userAnswers: userExamAnswers, timeTaken: totalTime };
                localStorage.setItem('examReportData', JSON.stringify(examResults));
                window.location.href = 'report.html';
            } else {
                await common.recordStudySession(currentQuizQuestions.length);
                alert('Sessione completata! Stai per tornare alla dashboard.');
                window.location.href = 'index.html';
            }
        }
    });
    const backBtn = document.getElementById('back-to-dashboard-btn');
    backBtn.addEventListener('click', function(event) {
        const mode = new URLSearchParams(window.location.search).get('mode');
        if (mode === 'exam') {
            if (!confirm("Sei sicuro di voler abbandonare la simulazione? I progressi andranno persi.")) {
                event.preventDefault();
            }
        }
    });
}

function renderQuestion() {
    const mode = new URLSearchParams(window.location.search).get('mode');
    const question = currentQuizQuestions[currentQuestionIndex];
    document.getElementById('feedback-container').innerHTML = '';
    document.getElementById('explanation-container').classList.add('d-none');
    document.getElementById('next-question-btn').classList.add('d-none');
    document.getElementById('question-text').textContent = `(${currentQuestionIndex + 1}/${currentQuizQuestions.length}) ${question.domanda}`;
    const optionsContainer = document.getElementById('options-container');
    optionsContainer.innerHTML = '';
    [...question.opzioni].sort(() => Math.random() - 0.5).forEach(option => {
        const button = document.createElement('button');
        button.className = 'btn btn-outline-primary';
        if (mode === 'exam' && userExamAnswers[question.id] === option) button.classList.add('active');
        button.textContent = option;
        button.dataset.option = option;
        optionsContainer.appendChild(button);
    });
}

async function handleAnswer(selectedButton) {
    const mode = new URLSearchParams(window.location.search).get('mode');
    const question = currentQuizQuestions[currentQuestionIndex];
    const selectedOption = selectedButton.dataset.option;
    
    if (mode === 'exam') {
        if (selectedButton.classList.contains('active')) return;
        userExamAnswers[question.id] = selectedOption;
        document.querySelectorAll('#options-container .btn').forEach(btn => btn.classList.remove('active'));
        selectedButton.classList.add('active');
        document.getElementById('next-question-btn').classList.remove('d-none');
    } else {
        if (selectedButton.disabled) return;
        const isCorrect = selectedOption === question.soluzione;
        await common.updateLearningState(question.id, isCorrect);
        const allOptionButtons = document.querySelectorAll('#options-container .btn');
        allOptionButtons.forEach(btn => btn.disabled = true);
        if (isCorrect) {
            selectedButton.classList.replace('btn-outline-primary', 'btn-success');
            document.getElementById('feedback-container').innerHTML = `<div class="alert alert-success">Corretto!</div>`;
        } else {
            selectedButton.classList.replace('btn-outline-primary', 'btn-danger');
            document.getElementById('feedback-container').innerHTML = `<div class="alert alert-danger">Sbagliato. La risposta corretta era: <strong>${question.soluzione}</strong></div>`;
            allOptionButtons.forEach(btn => { if (btn.dataset.option === question.soluzione) btn.classList.replace('btn-outline-primary', 'btn-success'); });
        }
        document.getElementById('explanation-text').textContent = question.spiegazione;
        document.getElementById('ripasso-text').textContent = `Riferimento: ${question.ripasso}`;
        document.getElementById('explanation-container').classList.remove('d-none');
        document.getElementById('next-question-btn').classList.remove('d-none');
    }
}