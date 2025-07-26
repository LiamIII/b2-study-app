/**
 * quiz.js - VERSIONE COMPLETA E DEFINITIVA
 *
 * Gestisce l'intera logica della pagina del quiz con il nuovo stile "Focus Mode".
 *
 * Funzionalità Incluse:
 * - Rendering dei pulsanti di opzione personalizzati (`btn-quiz-option`).
 * - Feedback visivo immediato con icone e colori per risposte giuste/sbagliate.
 * - Gestione di tutte le modalità: placement, exam, srs, errors, category, custom.
 * - Flusso di Warm-up/Cool-down.
 * - Supporto per il parametro 'limit' dal Piano di Studio Giornaliero.
 */

import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { auth } from './firebase-init.js';
import * as common from './common.js';

// --- STATO GLOBALE DEL QUIZ ---
let allQuestionsGlobally = [];
let currentQuizQuestions = [];
let warmupQuestions = [];
let mainQuizQuestions = [];
let currentQuestionIndex = 0;
let userExamAnswers = {};
let timerInterval = null;
let secondsElapsed = 0;
let isWarmupPhase = false;

// --- INIZIALIZZAZIONE ---
document.addEventListener('DOMContentLoaded', () => {
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            const urlParams = new URLSearchParams(window.location.search);
            if (urlParams.get('mode') !== 'cooldown') {
                sessionStorage.removeItem('sessionErrors');
            }
            await initializeQuiz();
        } else {
            window.location.href = 'login.html';
        }
    });
});

/**
 * Funzione di inizializzazione: prepara le domande per la modalità richiesta
 * e gestisce l'avvio del Warm-up.
 */
async function initializeQuiz() {
    try {
        const allQuestionsJSON = localStorage.getItem('allQuestions');
        allQuestionsGlobally = allQuestionsJSON ? JSON.parse(allQuestionsJSON) : (await common.loadData())[0];
    } catch (e) {
        handleFatalError("Errore critico nel caricamento delle domande. Torna alla dashboard e riprova.");
        return;
    }

    const urlParams = new URLSearchParams(window.location.search);
    const mode = urlParams.get('mode');

    mainQuizQuestions = await getQuestionsForMode(mode, urlParams);
    if (mainQuizQuestions === null) return;

    const skipWarmup = (mode === 'exam' || mode === 'placement' || mode === 'cooldown');
    if (!skipWarmup && mainQuizQuestions.length > 0) {
        warmupQuestions = await generateWarmupQuestions(mainQuizQuestions.map(q => q.id));
        if (warmupQuestions.length > 0) {
            isWarmupPhase = true;
            currentQuizQuestions = [...warmupQuestions, ...mainQuizQuestions];
        } else {
            currentQuizQuestions = mainQuizQuestions;
        }
    } else {
        currentQuizQuestions = mainQuizQuestions;
    }
    
    startQuiz();
    setupQuizEventListeners();
}

/**
 * Funzione helper per ottenere il set di domande corretto in base alla modalità.
 */
async function getQuestionsForMode(mode, urlParams) {
    const categoryName = urlParams.get('category');
    switch (mode) {
        case 'placement':
            const userProgress = await common.getUserProgress();
            return allQuestionsGlobally.filter(q => !(userProgress.placementTest?.completedIds || []).includes(q.id));
        case 'exam':
            const examIds = JSON.parse(localStorage.getItem('examSession_questionIds') || '[]');
            localStorage.removeItem('examSession_questionIds');
            if (examIds.length === 0) { handleFatalError("Nessuna sessione d'esame trovata. Avviala dalla dashboard.", true); return null; }
            return allQuestionsGlobally.filter(q => examIds.includes(q.id));
        case 'srs':
            const srsData = await common.getSrsData();
            const today = new Date().toISOString().split('T')[0];
            const dueIds = Object.keys(srsData).filter(id => srsData[id].nextReview <= today).map(Number);
            const srsQuestions = allQuestionsGlobally.filter(q => dueIds.includes(q.id));
            if (srsQuestions.length === 0) { handleFatalError("Nessuna domanda in scadenza oggi. Ottimo lavoro!", true); return null; }
            return srsQuestions;
        case 'errors':
            const errorIds = await common.getErrorDeck();
            let errorQuestions = allQuestionsGlobally.filter(q => errorIds.includes(q.id));
            const limit = parseInt(urlParams.get('limit'), 10);
            if (!isNaN(limit) && limit > 0 && errorQuestions.length > limit) {
                errorQuestions.sort(() => 0.5 - Math.random());
                errorQuestions = errorQuestions.slice(0, limit);
            }
            if (errorQuestions.length === 0) { handleFatalError("Il tuo 'Mazzo degli Errori' è vuoto. Complimenti!", true); return null; }
            return errorQuestions;
        case 'cooldown': case 'custom':
            const idsParam = urlParams.get('ids');
            if (!idsParam) { handleFatalError("Nessun ID di domanda specificato per questa modalità.", true); return null; }
            try { return allQuestionsGlobally.filter(q => JSON.parse(decodeURIComponent(idsParam)).includes(q.id)); }
            catch (e) { handleFatalError("Parametri non validi per questa modalità.", true); return null; }
        default:
            if (categoryName) {
                const questionsForCategory = allQuestionsGlobally.filter(q => q.categoria === decodeURIComponent(categoryName));
                if (urlParams.get('submode') === 'errors') {
                    const allQuestionsState = JSON.parse(localStorage.getItem('allQuestions') || '[]');
                    const errorDeck = (await common.getErrorDeck()) || [];
                    const errorQuestionsInCategory = questionsForCategory.filter(q => errorDeck.includes(q.id));
                    if (errorQuestionsInCategory.length === 0) { handleFatalError("Nessun errore registrato in questa categoria. Prova a ripassarla tutta!", true); return null; }
                    return errorQuestionsInCategory;
                }
                return questionsForCategory;
            }
    }
    handleFatalError("Modalità non riconosciuta. Torna alla dashboard e riprova.", true);
    return null;
}

/**
 * Genera domande per il warm-up.
 */
async function generateWarmupQuestions(excludeIds = []) {
    const WARMUP_SIZE = 3;
    const srsData = await common.getSrsData();
    const today = new Date().toISOString().split('T')[0];
    let dueSrsIds = Object.keys(srsData).filter(id => srsData[id].nextReview <= today && !excludeIds.includes(Number(id))).map(Number);
    dueSrsIds.sort(() => 0.5 - Math.random());
    return allQuestionsGlobally.filter(q => dueSrsIds.slice(0, WARMUP_SIZE).includes(q.id));
}

/**
 * Avvia la sessione di quiz.
 */
function startQuiz() {
    if (currentQuizQuestions.length > 0) {
        if (new URLSearchParams(window.location.search).get('mode') === 'exam') startTimer();
        renderQuestion();
    }
}

/**
 * Renderizza la domanda corrente con il nuovo stile.
 */
function renderQuestion() {
    const question = currentQuizQuestions[currentQuestionIndex];
    const mode = new URLSearchParams(window.location.search).get('mode');
    const optionsContainer = document.getElementById('options-container');

    // Gestione Titolo Dinamico (Warmup / Main)
    let title = "Quiz";
    if (isWarmupPhase) {
        title = `Warm-up (${currentQuestionIndex + 1}/${warmupQuestions.length})`;
    } else {
        const urlParams = new URLSearchParams(window.location.search);
        switch(mode) {
            case 'srs': title = 'Ripasso Intelligente'; break;
            case 'errors': title = 'Allenamento Errori'; break;
            case 'cooldown': title = 'Riepilogo Errori Sessione'; break;
            case 'custom': title = 'Allenamento Mirato'; break;
            case 'exam': title = 'Simulazione Esame'; break;
            case 'placement': title = 'Test di Posizionamento'; break;
            default: title = `Quiz: ${decodeURIComponent(urlParams.get('category') || '')}`;
        }
    }
    document.getElementById('quiz-category-title').textContent = title;

    // Progresso
    let progressText;
    if (mode === 'placement') {
        const totalInDB = allQuestionsGlobally.length;
        const alreadyCompleted = totalInDB - currentQuizQuestions.length;
        progressText = `(${alreadyCompleted + currentQuestionIndex + 1}/${totalInDB})`;
    } else {
        progressText = `(${currentQuestionIndex + 1}/${currentQuizQuestions.length})`;
    }

    // Reset UI
    document.getElementById('question-text').textContent = `${progressText} ${question.domanda}`;
    document.getElementById('feedback-container').innerHTML = '';
    document.getElementById('explanation-container').classList.add('d-none');
    document.getElementById('next-question-btn').classList.add('d-none');
    optionsContainer.innerHTML = '';

    // Creazione pulsanti con nuovo stile
    [...question.opzioni].sort(() => Math.random() - 0.5).forEach(option => {
        const button = document.createElement('button');
        button.className = 'btn btn-quiz-option';
        if (mode === 'exam' && userExamAnswers[question.id] === option) {
            button.classList.add('active');
        }
        button.textContent = option;
        button.dataset.option = option;
        optionsContainer.appendChild(button);
    });
}

/**
 * Gestisce la logica di risposta con il nuovo feedback visivo.
 */
async function handleAnswer(selectedButton) {
    const mode = new URLSearchParams(window.location.search).get('mode');
    const question = currentQuizQuestions[currentQuestionIndex];
    const selectedOption = selectedButton.dataset.option;
    const isCorrect = selectedOption === question.soluzione;

    if (mode !== 'exam') await common.updateLearningState(question.id, isCorrect);
    
    if (!isCorrect && mode !== 'exam' && mode !== 'placement') {
        let errors = JSON.parse(sessionStorage.getItem('sessionErrors') || '[]');
        if (!errors.includes(question.id)) {
            errors.push(question.id);
            sessionStorage.setItem('sessionErrors', JSON.stringify(errors));
        }
    }
    
    const allOptionButtons = document.querySelectorAll('#options-container .btn-quiz-option');
    
    if (mode === 'exam') {
        userExamAnswers[question.id] = selectedOption;
        allOptionButtons.forEach(btn => btn.classList.remove('active'));
        selectedButton.classList.add('active');
        document.getElementById('next-question-btn').classList.remove('d-none');
    } else {
        allOptionButtons.forEach(btn => {
            btn.disabled = true;
            if (btn.dataset.option === question.soluzione) {
                btn.classList.add(isCorrect ? 'correct' : 'solution');
                btn.innerHTML = `<i class="bi bi-check-circle-fill feedback-icon"></i> ${btn.innerHTML}`;
            }
        });
        if (!isCorrect) {
            selectedButton.classList.add('incorrect');
            selectedButton.innerHTML = `<i class="bi bi-x-circle-fill feedback-icon"></i> ${selectedButton.innerHTML}`;
        }
        document.getElementById('explanation-text').textContent = question.spiegazione;
        document.getElementById('ripasso-text').textContent = `Riferimento: ${question.ripasso}`;
        document.getElementById('explanation-container').classList.remove('d-none');
        document.getElementById('next-question-btn').classList.remove('d-none');
        
        if (mode === 'placement') {
            const userProgress = await common.getUserProgress();
            const completedIds = userProgress.placementTest?.completedIds || [];
            if (!completedIds.includes(question.id)) completedIds.push(question.id);
            await common.saveUserProgress({
                placementTest: { completedIds, isComplete: (completedIds.length === allQuestionsGlobally.length) }
            });
            setTimeout(() => document.getElementById('next-question-btn').click(), 1200); // Ritardo leggermente aumentato
        }
    }
}

/**
 * Gestisce l'avanzamento alla domanda successiva o la fine del quiz.
 */
async function handleNextQuestion() {
    if (isWarmupPhase && currentQuestionIndex === warmupQuestions.length - 1) isWarmupPhase = false;
    currentQuestionIndex++;
     if (currentQuestionIndex < currentQuizQuestions.length) {
        renderQuestion();
    } else {
        const mode = new URLSearchParams(window.location.search).get('mode');
        // Registra sempre la sessione di studio, tranne per il test di posizionamento iniziale.
        if (mode !== 'placement') {
            await common.recordStudySession(currentQuizQuestions.length);
        }

        if (mode === 'exam') {
            const totalTime = stopTimer();
            const examResults = { questions: mainQuizQuestions, userAnswers: userExamAnswers, timeTaken: totalTime };
            localStorage.setItem('examReportData', JSON.stringify(examResults));
            window.location.href = 'report.html';
        } else if (mode === 'placement' || mode === 'cooldown') {
            // Per placement e cooldown, torna semplicemente alla dashboard.
            // La sessione di cooldown è già stata registrata.
            alert('Sessione completata! Stai tornando alla dashboard.');
            window.location.href = 'index.html';
        } else {
            // Per tutte le altre modalità (srs, errors, custom, etc.) vai al riepilogo sessione.
            const sessionData = {
                questionsStudied: currentQuizQuestions.length,
                errorsMadeIds: JSON.parse(sessionStorage.getItem('sessionErrors') || '[]')
            };
            sessionStorage.setItem('currentSessionReport', JSON.stringify(sessionData));
            window.location.href = 'session-report.html';
        }
    }
}

// --- FUNZIONI DI SUPPORTO E UTILITY ---

function handleFatalError(message, showBackButton = false) {
    const container = document.querySelector('.card-body');
    const backButtonHTML = showBackButton ? `<a href="index.html" class="btn btn-primary mt-3">Torna alla Dashboard</a>` : '';
    if (container) container.innerHTML = `<div class="alert alert-info text-center">${message}${backButtonHTML}</div>`;
}

function setupQuizEventListeners() {
    document.getElementById('options-container').addEventListener('click', (e) => {
        const button = e.target.closest('.btn-quiz-option');
        if (button && !button.disabled) handleAnswer(button);
    });
    document.getElementById('next-question-btn').addEventListener('click', handleNextQuestion);
    document.getElementById('back-to-dashboard-btn').addEventListener('click', (event) => {
        const mode = new URLSearchParams(window.location.search).get('mode');
        if (mode === 'exam' || mode === 'placement') {
            if (!confirm("Sei sicuro di voler interrompere? I tuoi progressi sono salvati e potrai riprendere più tardi.")) event.preventDefault();
        }
    });
}

function startTimer() {
    const timerDisplay = document.getElementById('timer-display');
    if (!timerDisplay) return;
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