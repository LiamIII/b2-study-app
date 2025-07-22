/**
 * dashboard.js - VERSIONE FINALE E FUNZIONANTE CON FIREBASE
 *
 * - Integra la logica di autenticazione per proteggere la pagina.
 * - Risolve i problemi di caricamento asincrono con `onAuthStateChanged`.
 * - Aggiorna le chiamate a `common.js` per usare la sintassi del modulo.
 * - Include la logica per il logout.
 */

// Importa tutto ciò che serve dai moduli
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { auth } from './firebase-init.js';
import * as common from './common.js'; // Importa TUTTE le funzioni da common.js come un oggetto 'common'

// Variabili globali per i dati, accessibili in tutto il file
let fullCategoryStats = [];
let allQuestionsGlobally = [];
const categoryDescriptions = common.parseDescriptions(common.categoriesDescriptionsString); // Usa la funzione e la stringa da common.js

// ========================================================================
// FLUSSO PRINCIPALE DELL'APPLICAZIONE
// ========================================================================
document.addEventListener('DOMContentLoaded', () => {
    // onAuthStateChanged è il nostro "guardiano". Si attiva subito e ogni volta che lo stato del login cambia.
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            // Se l'utente è loggato, avvia l'applicazione principale
            console.log("Utente loggato:", user.email);
            document.getElementById('user-email').textContent = user.email; // Mostra l'email dell'utente
            await initializeApp(); // Avvia il caricamento dei dati e il rendering della pagina
        } else {
            // Se l'utente NON è loggato, lo reindirizza alla pagina di login
            console.log("Nessun utente, reindirizzamento al login.");
            window.location.href = 'login.html';
        }
    });
});

/**
 * Funzione principale che carica i dati, li processa e renderizza l'intera dashboard.
 * Viene chiamata solo dopo che l'autenticazione è stata verificata con successo.
 */
async function initializeApp() {
    const [questionsData, performanceCSV] = await common.loadData();
    if (!questionsData || !performanceCSV) {
        document.getElementById('category-list').innerHTML = '<div class="alert alert-danger">Errore critico: impossibile caricare i file di dati.</div>';
        return;
    }
    
    // Processiamo i dati iniziali come sempre
    allQuestionsGlobally = common.processAndGetAllQuestions(questionsData, performanceCSV);
    fullCategoryStats = common.calculateCategoryStats(allQuestionsGlobally);

    // ========================================================================
    // NUOVA LOGICA DI INIZIALIZZAZIONE DATI UTENTE
    // ========================================================================
    const userProgress = await common.getUserProgress();
    // Controlliamo se 'errorDeck' esiste o se è la prima volta che l'utente usa l'app
    // Usiamo una proprietà di controllo, es. 'initialSetupDone'
    if (!userProgress.initialSetupDone) {
        console.log("Prima esecuzione per questo utente. Inizializzo l'Error Deck...");
        
        // Creiamo il primo mazzo degli errori basandoci sul file performance.csv
        const initialErrorDeck = allQuestionsGlobally
            .filter(q => !q.isCorrect) // Filtra per le domande sbagliate
            .map(q => q.id);           // Prendi solo gli ID
            
        // Salviamo questo mazzo iniziale su Firestore e marchiamo la configurazione come completata
        await common.saveUserProgress({
            errorDeck: initialErrorDeck,
            initialSetupDone: true // Flag per non ripetere questa operazione
        });
        
        console.log(`Mazzo degli errori inizializzato con ${initialErrorDeck.length} domande.`);
    }
    // ========================================================================

    // Salvataggio su localStorage per le altre pagine (cache)
    localStorage.setItem('allQuestions', JSON.stringify(allQuestionsGlobally));
    localStorage.setItem('categoryStats', JSON.stringify(fullCategoryStats));
    
    renderDashboardList('priorityScore'); 
    renderStrategicMap(fullCategoryStats);
    setupDashboardEventListeners();
    await updateUiCounters();
    enableActionButtons();
    console.log("Dati caricati. UI abilitata.");
}

// ========================================================================
// FUNZIONI DI GESTIONE DELLA UI
// ========================================================================

function enableActionButtons() {
    document.getElementById('start-exam-btn').disabled = false;
    const srsBtn = document.getElementById('srs-quiz-btn');
    const errorsBtn = document.getElementById('error-deck-btn');
    srsBtn.removeAttribute('disabled');
    srsBtn.classList.remove('disabled');
    errorsBtn.removeAttribute('disabled');
    errorsBtn.classList.remove('disabled');
}

function renderDashboardList(sortBy = 'priorityScore') {
    const container = document.getElementById('category-list');
    const sortedStats = [...fullCategoryStats].sort((a, b) => b[sortBy] - a[sortBy]);
    container.innerHTML = '';
    
    sortedStats.forEach(category => {
        const encodedName = encodeURIComponent(category.name);
        const description = categoryDescriptions.get(category.name) || "Nessuna descrizione.";
        const safeDescription = description.replace(/"/g, '"');
        const helperIcon = `<span class="ms-2" tabindex="0" data-bs-toggle="popover" data-bs-trigger="hover focus" data-bs-title="${category.name}" data-bs-content="${safeDescription}"><i class="bi bi-question-circle-fill text-info"></i></span>`;
        const element = document.createElement('a');
        element.href = `quiz.html?category=${encodedName}`;
        element.className = 'list-group-item list-group-item-action d-flex justify-content-between align-items-center';
        element.innerHTML = `<div><h5 class="mb-1 d-inline-flex align-items-center">${category.name}${helperIcon}</h5><br><small>${category.incorrect} errori su ${category.total} domande</small></div><div class="text-end"><span class="badge ${common.getPerformanceBadge(category.errorRate)} rounded-pill fs-6">${category.errorRate.toFixed(1)}% errore</span></div>`;
        container.appendChild(element);
    });
    initializePopovers();
}

function initializePopovers() {
    [...document.querySelectorAll('[data-bs-toggle="popover"]')].forEach(el => {
        const instance = bootstrap.Popover.getInstance(el);
        if (instance) instance.dispose();
        new bootstrap.Popover(el);
    });
}

function renderStrategicMap(categoryStats) {
    const ctx = document.getElementById('strategic-map-canvas').getContext('2d');
    if (window.chartInstance) window.chartInstance.destroy();
    const dataForChart = categoryStats.map(cat => ({ x: cat.successRate, y: cat.priorityScore, r: cat.frequency * 1.5 + 5, label: cat.name, errorRate: cat.errorRate }));
    window.chartInstance = new Chart(ctx, { type: 'bubble', data: { datasets: [{ data: dataForChart, backgroundColor: c => getPerformanceColor(c.raw.errorRate, 0.6), borderColor: c => getPerformanceColor(c.raw.errorRate, 1), borderWidth: 1 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => `${c.raw.label}: ${c.raw.errorRate.toFixed(1)}% errore` } } }, scales: { x: { title: { display: true, text: 'Bravura (% Successo)' }, min: 0, max: 100 }, y: { title: { display: true, text: 'Punteggio di Priorità' } } }, onClick: (e, el) => { if (el.length > 0) showDetailsModal(dataForChart[el[0].index].label, categoryStats); } } });
}

function showDetailsModal(categoryName, categoryStats) {
    const modalElement = document.getElementById('details-modal');
    const modalTitle = document.getElementById('modal-title-label');
    const modalBody = document.getElementById('modal-body');
    const modalFooter = document.getElementById('modal-footer');
    const categoryData = categoryStats.find(cat => cat.name === categoryName);
    if (!categoryData) return;

    modalTitle.textContent = `Dettagli: ${categoryName}`;
    const wrongQuestions = categoryData.questions.filter(q => !q.isCorrect);
    const topMistakes = wrongQuestions.slice(0, 3);
    let mistakesHTML = '';
    if (topMistakes.length > 0) {
        mistakesHTML = topMistakes.map(q => `<div class="mb-3"><p class="mb-1 text-muted"><em>"${q.domanda}"</em></p><p class="mb-0"><span class="badge bg-success-subtle text-success-emphasis rounded-pill me-2">Soluzione corretta</span><strong>${q.soluzione}</strong></p></div>`).join('<hr class="my-3">');
    } else {
        mistakesHTML = `<div class="text-center p-3"><i class="bi bi-check-circle-fill text-success fs-1"></i><h5 class="mt-2">Nessun errore registrato!</h5><p class="text-muted">Ottimo lavoro in questa categoria.</p></div>`;
    }
    modalBody.innerHTML = `<div class="row"><div class="col-md-5 border-end"><h4 class="fw-light">Riepilogo Performance</h4><div class="d-flex justify-content-between align-items-center mt-3"><span>Tasso di errore:</span><span class="badge ${common.getPerformanceBadge(categoryData.errorRate)} fs-6">${categoryData.errorRate.toFixed(1)}%</span></div><div class="d-flex justify-content-between align-items-center mt-2"><span>Risposte corrette:</span><span class="fw-bold">${categoryData.correct} / ${categoryData.total}</span></div><div class="d-flex justify-content-between align-items-center mt-2"><span>Risposte sbagliate:</span><span class="fw-bold">${categoryData.incorrect} / ${categoryData.total}</span></div></div><div class="col-md-7"><h4 class="fw-light">Le domande che hai sbagliato</h4><div class="mt-3">${mistakesHTML}</div></div></div>`;
    const encodedCategoryName = encodeURIComponent(categoryName);
    modalFooter.innerHTML = `<button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Chiudi</button><a href="quiz.html?category=${encodedCategoryName}&submode=errors" class="btn btn-danger"><i class="bi bi-bullseye"></i> Allena solo Errori (${wrongQuestions.length})</a><a href="quiz.html?category=${encodedCategoryName}&submode=all" class="btn btn-primary"><i class="bi bi-arrow-clockwise"></i> Ripassa Tutta la Categoria</a>`;
    
    bootstrap.Modal.getOrCreateInstance(modalElement).show();
}

function setupDashboardEventListeners() {
    const viewListBtn = document.getElementById('view-list-btn');
    const viewMapBtn = document.getElementById('view-map-btn');
    const sortDropdownMenu = document.querySelector('#sort-dropdown + .dropdown-menu');
    const startExamBtn = document.getElementById('start-exam-btn');
    const srsBtn = document.getElementById('srs-quiz-btn');
    const errorsBtn = document.getElementById('error-deck-btn');
    const logoutBtn = document.getElementById('logout-btn');
    
    viewListBtn.addEventListener('click', () => { /* ... */ });
    viewMapBtn.addEventListener('click', () => { /* ... */ });
    sortDropdownMenu.addEventListener('click', (event) => { /* ... */ });

    startExamBtn.addEventListener('click', (e) => { showLoadingSpinner(e.currentTarget); prepareAndStartExam(); });
    srsBtn.addEventListener('click', (e) => showLoadingSpinner(e.currentTarget));
    errorsBtn.addEventListener('click', (e) => showLoadingSpinner(e.currentTarget));
    
    logoutBtn.addEventListener('click', () => {
        signOut(auth).then(() => {
            localStorage.clear();
            window.location.href = 'login.html';
        }).catch(error => console.error("Errore di logout:", error));
    });

    const dashboardView = document.getElementById('dashboard-view'), mapView = document.getElementById('map-view');
    viewListBtn.addEventListener('click', () => { dashboardView.classList.remove('d-none'); mapView.classList.add('d-none'); viewListBtn.classList.replace('btn-outline-primary', 'btn-primary'); viewListBtn.classList.add('active'); viewMapBtn.classList.replace('btn-primary', 'btn-outline-primary'); viewMapBtn.classList.remove('active'); });
    viewMapBtn.addEventListener('click', () => { mapView.classList.remove('d-none'); dashboardView.classList.add('d-none'); viewMapBtn.classList.replace('btn-outline-primary', 'btn-primary'); viewMapBtn.classList.add('active'); viewListBtn.classList.replace('btn-primary', 'btn-outline-primary'); viewListBtn.classList.remove('active'); });
    
    sortDropdownMenu.addEventListener('click', (event) => {
        event.preventDefault();
        const target = event.target;
        if (target.classList.contains('dropdown-item')) {
            const sortBy = target.dataset.sort;
            document.getElementById('sort-dropdown').textContent = `Ordina per: ${target.textContent.split('(')[0].trim()}`;
            sortDropdownMenu.querySelectorAll('.dropdown-item').forEach(item => item.classList.remove('active'));
            target.classList.add('active');
            renderDashboardList(sortBy);
        }
    });
}

function showLoadingSpinner(buttonElement) {
    if (buttonElement.tagName === 'A') buttonElement.classList.add('disabled');
    else buttonElement.disabled = true;
    buttonElement.innerHTML = `<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Caricamento...`;
}

function prepareAndStartExam() {
    if (allQuestionsGlobally.length === 0) { alert("Dati non pronti."); return; }
    const EXAM_QUESTION_COUNT = 40;
    const shuffledQuestions = [...allQuestionsGlobally].sort(() => Math.random() - 0.5);
    const examQuestions = shuffledQuestions.slice(0, EXAM_QUESTION_COUNT);
    const examQuestionIds = examQuestions.map(q => q.id);
    if (examQuestionIds.length < EXAM_QUESTION_COUNT) alert(`Attenzione: disponibili solo ${examQuestionIds.length} domande.`);
    localStorage.setItem('examSession_questionIds', JSON.stringify(examQuestionIds));
    window.location.href = 'quiz.html?mode=exam';
}

async function updateUiCounters() {
    const srsData = await common.getSrsData();
    const errorDeck = await common.getErrorDeck();
    if (!srsData || !errorDeck) return;
    const today = new Date().toISOString().split('T')[0];
    const srsDueCount = Object.values(srsData).filter(item => item.nextReview <= today).length;
    document.getElementById('srs-count').textContent = srsDueCount;
    document.getElementById('error-deck-count').textContent = errorDeck.length;
}

function getPerformanceColor(errorRate, opacity) {
    if (errorRate > 50) return `rgba(220, 53, 69, ${opacity})`;
    if (errorRate > 25) return `rgba(255, 193, 7, ${opacity})`;
    return `rgba(25, 135, 84, ${opacity})`;
}