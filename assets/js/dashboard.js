/**
 * dashboard.js - VERSIONE CON DASHBOARD INTELLIGENTE
 * 
 * - Aggiunge una barra di priorità visiva a ogni categoria nella lista.
 * - Il tooltip sulla barra spiega come viene calcolata la priorità.
 * - Mantiene tutte le funzionalità precedenti, inclusa l'autenticazione.
 */

// Importa tutto ciò che serve dai moduli
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { auth } from './firebase-init.js';
import * as common from './common.js';

// Variabili a livello di modulo per i dati
let fullCategoryStats = [];
let allQuestionsGlobally = [];

// Stringa e funzione per le descrizioni delle categorie
const categoriesDescriptionsString = `
Modals & Related Structures ::: Include i verbi modali (can, must, should, may, might) e le strutture simili (have to, be able to) usati per esprimere abilità, obbligo, permesso, probabilità o deduzione.
Question Formation ::: Si concentra sulla corretta struttura grammaticale delle domande, incluso l'uso delle question words (what, where, how), l'inversione soggetto-verbo e le question tags.
Reported Speech ::: Riguarda le regole per riportare ciò che qualcun altro ha detto (discorso indiretto). Ciò implica cambiamenti nei tempi verbali, pronomi e avverbi di tempo e luogo.
Conjunctions & Connectors ::: Include le parole e le espressioni usate per collegare frasi o parti di una frase. Testano la capacità di esprimere causa (as, because), contrasto (although, despite), tempo (while, during) e modo (as if).
Verb Patterns (Gerundi, Infiniti, etc.) ::: Questa categoria riguarda le regole su quale forma verbale (infinito con o senza to, o la forma in -ing) debba seguire un determinato verbo, aggettivo o preposizione. Include anche costruzioni come "vedere qualcuno fare qualcosa" (see somebody do/doing).
used to vs be/get used to ::: Una categoria specifica per distinguere tra used to + verbo (un'abitudine passata non più vera) e be/get used to + -ing (essere/diventare abituati a qualcosa).
Agreement & Disagreement (So/Neither) ::: Riguarda le brevi risposte usate per essere d'accordo con un'affermazione positiva (So am I) o negativa (Neither do I), e le risposte brevi alle domande (Yes, I did).
Causative Structures (have/get/make/let) ::: Si concentra sull'uso dei verbi "causativi" per indicare che qualcuno fa fare qualcosa a qualcun altro. La struttura grammaticale varia a seconda del verbo usato.
Passive Voice ::: Si concentra sull'uso della forma passiva, dove il soggetto della frase subisce l'azione anziché compierla. Le domande testano la capacità di formare il passivo in vari tempi verbali (presente, passato, futuro) e con i verbi modali.
Conditionals & Wishes ::: Copre tutti i periodi ipotetici (1°, 2°, 3° e misto) che esprimono condizioni reali, possibili o irreali e le loro conseguenze. Include anche le espressioni di desiderio o rimpianto come I wish (vorrei/avrei voluto) e If only (se solo).
Tenses (inclusi for/since, time clauses) ::: Riguarda l'uso corretto dei tempi verbali (es. Present Perfect, Past Simple, Past Perfect) per esprimere il momento in cui un'azione si svolge. Include l'uso corretto di indicatori temporali come for, since, recently e la costruzione di frasi temporali con when, as soon as, after, ecc.
Prepositions ::: Testa l'uso corretto delle preposizioni (es. in, on, at, for, with) per indicare tempo, luogo, direzione o per completare espressioni fisse (es. verbo/aggettivo + preposizione).
Nouns, Pronouns & Determiners ::: Questa categoria si occupa di nomi (numerabili e non), pronomi (personali, possessivi, riflessivi) e determinanti (articoli, dimostrativi, quantificatori come much, many, enough).
Adjectives & Adverbs ::: Riguarda l'uso e la posizione di aggettivi e avverbi. Include l'ordine corretto degli aggettivi, le forme comparative e superlative, e l'uso di avverbi di grado come enough, too, so, rather.
Vocabulary ::: Questa categoria testa la conoscenza di singole parole, sinonimi, contrari e il loro uso corretto nel contesto. Include la scelta tra parole simili (es. rob vs steal), la formazione di parole (prefissi e suffissi), e frasi idiomatiche.
Phrasal Verbs ::: I verbi frasali sono verbi composti da un verbo più un avverbio o una preposizione, che insieme assumono un nuovo significato. Questa categoria verifica la conoscenza del significato di questi verbi.
`;
const categoryDescriptions = common.parseDescriptions(categoriesDescriptionsString);


document.addEventListener('DOMContentLoaded', () => {
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            console.log("Utente loggato:", user.email);
            document.getElementById('user-email').textContent = user.email;
            await initializeApp();
        } else {
            window.location.href = 'login.html';
        }
    });
});

// in dashboard.js

async function initializeApp() {
    // 1. Carica i dati grezzi delle domande e delle performance iniziali
    const [questionsData, performanceCSV] = await common.loadData();
    if (!questionsData || !performanceCSV) {
        document.getElementById('category-list').innerHTML = '<div class="alert alert-danger">Errore critico: impossibile caricare i file di dati.</div>';
        return;
    }
    
    // 2. Processa i dati statici per averli pronti
    allQuestionsGlobally = common.processAndGetAllQuestions(questionsData, performanceCSV);
    fullCategoryStats = common.calculateCategoryStats(allQuestionsGlobally);
    
    // 3. Calcola il punteggio di priorità massimo per le barre di progresso
    const maxPriority = Math.max(...fullCategoryStats.map(cat => cat.priorityScore), 0);

    // 4. Recupera i progressi dell'utente da Firestore
    const userProgress = await common.getUserProgress();

    // 5. BOOTSTRAP: Se è il primo avvio, inizializza l'Error Deck dell'utente
    //    usando i dati del file performance.csv.
    if (!userProgress.initialSetupDone) {
        console.log("Prima esecuzione per questo utente. Inizializzo l'Error Deck...");
        
        const initialErrorDeck = allQuestionsGlobally
            .filter(q => !q.isCorrect) // Filtra per le domande sbagliate
            .map(q => q.id);           // Prendi solo gli ID
            
        await common.saveUserProgress({
            errorDeck: initialErrorDeck,
            initialSetupDone: true // Imposta un flag per non ripetere questa operazione
        });
        
        console.log(`Mazzo degli errori inizializzato con ${initialErrorDeck.length} domande.`);
        // Ricarichiamo i progressi per assicurarci di avere il deck appena creato
        Object.assign(userProgress, { errorDeck: initialErrorDeck });
    }

    // 6. ANALISI PATTERN: Esegui l'analisi degli errori in background
    //    usando i dati delle domande e l'error deck dell'utente.
    const errorDeck = userProgress.errorDeck || [];
    common.analyzeErrorPatterns(allQuestionsGlobally, errorDeck);

    // 7. Salvataggio in localStorage per usarlo come cache veloce nelle altre pagine
    localStorage.setItem('allQuestions', JSON.stringify(allQuestionsGlobally));
    localStorage.setItem('categoryStats', JSON.stringify(fullCategoryStats));
    
    // 8. Renderizza tutti i componenti della dashboard
    renderDashboardList('priorityScore', maxPriority); 
    renderStrategicMap(fullCategoryStats);
    setupDashboardEventListeners(maxPriority);
    await updateUiCounters(); // 'await' è cruciale qui
    enableActionButtons();

    console.log("Dati caricati. UI abilitata e analisi completata.");
}
function enableActionButtons() {
    document.getElementById('start-exam-btn').disabled = false;
    const srsBtn = document.getElementById('srs-quiz-btn');
    const errorsBtn = document.getElementById('error-deck-btn');
    srsBtn.removeAttribute('disabled');
    srsBtn.classList.remove('disabled');
    errorsBtn.removeAttribute('disabled');
    errorsBtn.classList.remove('disabled');
}

function renderDashboardList(sortBy = 'priorityScore', maxPriority = 1) {
    const container = document.getElementById('category-list');
    const sortedStats = [...fullCategoryStats].sort((a, b) => b[sortBy] - a[sortBy]);
    container.innerHTML = '';
    
    sortedStats.forEach(category => {
        const encodedName = encodeURIComponent(category.name);
        const description = categoryDescriptions.get(category.name) || "Nessuna descrizione.";
        const safeDescription = description.replace(/"/g, '"');
        const helperIcon = `<span class="ms-2" tabindex="0" data-bs-toggle="popover" data-bs-trigger="hover focus" data-bs-title="${category.name}" data-bs-content="${safeDescription}"><i class="bi bi-question-circle-fill text-info"></i></span>`;
        
        const barWidth = maxPriority > 0 ? (category.priorityScore / maxPriority) * 100 : 0;
        const priorityScoreRounded = Math.round(category.priorityScore);
        const priorityBarColor = getPriorityColor(category.priorityScore, maxPriority);
        
        const priorityBar = `
            <div class="progress mt-2" style="height: 8px;" 
                 title="Punteggio Priorità: ${priorityScoreRounded}. Calcolato da: ${category.errorRate.toFixed(1)}% (errore) × ${category.frequency} (frequenza).">
                <div class="progress-bar ${priorityBarColor}" role="progressbar" style="width: ${barWidth}%"></div>
            </div>
        `;

        const element = document.createElement('a');
        element.href = `quiz.html?category=${encodedName}`;
        element.className = 'list-group-item list-group-item-action d-flex justify-content-between align-items-center p-3';
        
        element.innerHTML = `
            <div class="flex-grow-1 me-3">
                <h5 class="mb-1 d-inline-flex align-items-center">${category.name}${helperIcon}</h5>
                <small class="d-block text-muted">${category.incorrect} errori su ${category.total} domande</small>
                ${priorityBar}
            </div>
            <div class="text-end">
                <span class="badge ${common.getPerformanceBadge(category.errorRate)} rounded-pill fs-6">${category.errorRate.toFixed(1)}% errore</span>
            </div>
        `;
        container.appendChild(element);
    });
    initializePopovers();
}

function getPriorityColor(score, maxScore) {
    const percentage = maxScore > 0 ? score / maxScore : 0;
    if (percentage > 0.66) return 'bg-danger';
    if (percentage > 0.33) return 'bg-warning';
    return 'bg-success';
}

function initializePopovers() {
    [...document.querySelectorAll('[data-bs-toggle="popover"]')].forEach(el => {
        const instance = bootstrap.Popover.getInstance(el);
        if (instance) instance.dispose();
        new bootstrap.Popover(el);
    });
}

/**
 * Renderizza la mappa strategica a bolle con i "Quadranti di Studio".
 * @param {Array} categoryStats - L'array con le statistiche delle categorie.
 */
function renderStrategicMap(categoryStats) {
    const ctx = document.getElementById('strategic-map-canvas').getContext('2d');
    if (window.chartInstance) window.chartInstance.destroy();

    const successThreshold = 65;
    const frequencies = categoryStats.map(cat => cat.frequency);
    const frequencyThreshold = frequencies.reduce((a, b) => a + b, 0) / frequencies.length;
    
    const dataForChart = categoryStats.map(cat => ({
        x: cat.successRate,
        y: cat.frequency,
        r: Math.max(cat.priorityScore / (frequencyThreshold * 2.5), 5), // Assicura raggio minimo
        label: cat.name,
        errorRate: cat.errorRate
    }));

    window.chartInstance = new Chart(ctx, {
        type: 'bubble',
        data: {
            datasets: [{
                data: dataForChart,
                backgroundColor: c => getPerformanceColor(c.raw.errorRate, 0.7),
                borderColor: c => getPerformanceColor(c.raw.errorRate, 1),
                borderWidth: 1.5
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: c => `${c.raw.label}: ${c.raw.errorRate.toFixed(1)}% errore`
                    }
                },
                annotation: {
                    annotations: {
                        boxLowSuccessLowFreq: {
                            type: 'box',
                            xMin: 0, xMax: successThreshold,
                            yMin: 0, yMax: frequencyThreshold,
                            backgroundColor: 'rgba(255, 193, 7, 0.05)',
                            borderColor: 'rgba(255, 193, 7, 0.1)'
                        },
                        boxLowSuccessHighFreq: {
                            type: 'box',
                            xMin: 0, xMax: successThreshold,
                            yMin: frequencyThreshold,
                            backgroundColor: 'rgba(220, 53, 69, 0.05)',
                            borderColor: 'rgba(220, 53, 69, 0.1)'
                        },
                        boxHighSuccessLowFreq: {
                            type: 'box',
                            xMin: successThreshold, xMax: 100,
                            yMin: 0, yMax: frequencyThreshold,
                            backgroundColor: 'rgba(108, 117, 125, 0.05)',
                            borderColor: 'rgba(108, 117, 125, 0.1)'
                        },
                        boxHighSuccessHighFreq: {
                            type: 'box',
                            xMin: successThreshold, xMax: 100,
                            yMin: frequencyThreshold,
                            backgroundColor: 'rgba(25, 135, 84, 0.05)',
                            borderColor: 'rgba(25, 135, 84, 0.1)'
                        },
                        lineSuccessThreshold: {
                            type: 'line',
                            xMin: successThreshold, xMax: successThreshold,
                            borderColor: 'rgba(0,0,0,0.2)',
                            borderWidth: 1,
                            borderDash: [6, 6]
                        },
                        lineFrequencyThreshold: {
                            type: 'line',
                            yMin: frequencyThreshold, yMax: frequencyThreshold,
                            borderColor: 'rgba(0,0,0,0.2)',
                            borderWidth: 1,
                            borderDash: [6, 6]
                        }
                    }
                }
            },
            scales: {
                x: { title: { display: true, text: 'Bravura (% Successo)' }, min: 0, max: 100 },
                y: { title: { display: true, text: 'Frequenza (Numero di Domande)' } }
            },
            onClick: (e, el) => { if (el.length > 0) showDetailsModal(dataForChart[el[0].index].label, categoryStats); }
        }
    });
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

function setupDashboardEventListeners(maxPriority) {
    const viewListBtn = document.getElementById('view-list-btn');
    const viewMapBtn = document.getElementById('view-map-btn');
    const sortDropdownMenu = document.querySelector('#sort-dropdown + .dropdown-menu');
    const startExamBtn = document.getElementById('start-exam-btn');
    const srsBtn = document.getElementById('srs-quiz-btn');
    const errorsBtn = document.getElementById('error-deck-btn');
    const logoutBtn = document.getElementById('logout-btn');
    
    viewListBtn.addEventListener('click', () => { /* ... */ });
    viewMapBtn.addEventListener('click', () => { /* ... */ });
    
    sortDropdownMenu.addEventListener('click', (event) => {
        event.preventDefault();
        const target = event.target;
        if (target.classList.contains('dropdown-item')) {
            const sortBy = target.dataset.sort;
            document.getElementById('sort-dropdown').textContent = `Ordina per: ${target.textContent.split('(')[0].trim()}`;
            sortDropdownMenu.querySelectorAll('.dropdown-item').forEach(item => item.classList.remove('active'));
            target.classList.add('active');
            renderDashboardList(sortBy, maxPriority);
        }
    });

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