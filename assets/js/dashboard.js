/**
 * dashboard.js - VERSIONE COMPLETA, INTEGRALE E FUNZIONANTE
 *
 * Questo file gestisce tutta la logica della pagina principale (index.html).
 *
 * Funzionalità Incluse:
 * 1.  Autenticazione utente e reindirizzamento.
 * 2.  Flusso di Setup Iniziale:
 *     - Mostra una schermata per scegliere tra test interattivo e upload CSV.
 *     - Gestisce la logica di upload e processamento del file CSV.
 * 3.  Piano di Studio Giornaliero Guidato (proattivo).
 * 4.  Dashboard di Esplorazione Libera (reattiva) con lista e mappa.
 * 5.  Funzionalità "Deep Dive" per analisi granulare dei tag nel modal.
 */

import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { auth } from './firebase-init.js';
import {
    loadData,
    calculateCategoryStats,
    getUserProgress,
    saveUserProgress,
    getSrsData,
    getErrorDeck,
    parseDescriptions,
    categoriesDescriptionsString,
    getPerformanceBadge,
    tagDictionary
} from './common.js';

// --- STATO GLOBALE DEL MODULO ---
let fullCategoryStats = [];
let allQuestionsGlobally = [];
const categoryDescriptions = parseDescriptions(categoriesDescriptionsString);

// --- INIZIALIZZAZIONE ---
document.addEventListener('DOMContentLoaded', () => {
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            document.getElementById('user-email').textContent = user.email;
            await initializeDashboard();
        } else {
            window.location.href = 'login.html';
        }
    });
});

/**
 * Funzione principale che orchestra la visualizzazione della pagina.
 * Decide se mostrare il setup iniziale o la dashboard completa.
 */
async function initializeDashboard() {
    const mainDashboard = document.getElementById('main-dashboard');
    const placementTestView = document.getElementById('placement-test-view');
    const progressLink = document.querySelector('a[href="progress.html"]');

    // Sicurezza: controlla che gli elementi esistano
    if (!mainDashboard || !placementTestView || !progressLink) {
        console.error("Errore di struttura HTML: mancano elementi fondamentali come #main-dashboard, #placement-test-view o il link a progress.html.");
        return;
    }

    try {
        const [questionsData] = await loadData();
        const userProgress = await getUserProgress();

        if (!userProgress.placementTest || !userProgress.placementTest.isComplete) {
            // FASE 1: L'utente deve completare il setup
            mainDashboard.classList.add('d-none');
            placementTestView.classList.remove('d-none');
            
            // Nascondiamo solo il link ai progressi
            progressLink.classList.add('d-none');
            
            // La funzione di rendering ora non deve più preoccuparsi di nascondere l'header
            renderPlacementTestPrompt(placementTestView, userProgress.placementTest?.completedIds?.length || 0, questionsData.length);
            setupUploadListeners(questionsData);
        } else {
            // FASE 2: L'utente ha completato il setup, mostra la dashboard
            mainDashboard.classList.remove('d-none');
            placementTestView.classList.add('d-none');
            
            // Assicuriamoci che il link "I Miei Progressi" sia di nuovo visibile
            progressLink.classList.remove('d-none');
            
            const errorDeck = userProgress.errorDeck || [];
            allQuestionsGlobally = questionsData.map(question => ({
                ...question,
                isCorrect: !errorDeck.includes(question.id)
            }));

            fullCategoryStats = calculateCategoryStats(allQuestionsGlobally);
            const maxPriority = Math.max(...fullCategoryStats.map(cat => cat.priorityScore), 0);
            
            localStorage.setItem('allQuestions', JSON.stringify(allQuestionsGlobally));
            localStorage.setItem('categoryStats', JSON.stringify(fullCategoryStats));
            localStorage.setItem('errorDeck_cache', JSON.stringify(errorDeck));
            
            await generateAndRenderDailyPlan();
            renderDashboardList('priorityScore', maxPriority);
            renderStrategicMap(fullCategoryStats);
            setupDashboardEventListeners(maxPriority);
            await updateUiCounters();
            enableActionButtons();
        }
    } catch (error) {
        console.error("Errore durante l'inizializzazione della dashboard:", error);
        document.querySelector('main.container').innerHTML = '<div class="alert alert-danger">Si è verificato un errore critico. Riprova più tardi.</div>';
    }
}

/**
 * Renderizza la UI per la scelta tra test interattivo e upload CSV.
 * Questa versione non nasconde più l'header, lasciando il compito a initializeDashboard.
 */
function renderPlacementTestPrompt(container, completed, total) {
    const progressPercent = total > 0 ? (completed / total) * 100 : 0;
    const questionsRemaining = total - completed;

    container.innerHTML = `
        <div class="card text-center shadow-lg">
            <div class="card-body p-4 p-md-5">
                <h2 class="card-title">Benvenuta! Iniziamo.</h2>
                <p class="lead text-muted">Scegli come impostare la tua performance iniziale.</p>
                
                <div class="mt-4">
                    <p class="fw-bold">Opzione 1: Fai il test nell'app</p>
                    <p>Rispondi alle domande una per una. Puoi fermarti e riprendere quando vuoi.</p>
                    <div class="progress my-3" style="height: 25px;" title="${completed} su ${total} domande completate">
                        <div class="progress-bar progress-bar-striped progress-bar-animated" role="progressbar" 
                             style="width: ${progressPercent}%" aria-valuenow="${completed}" aria-valuemin="0" aria-valuemax="${total}">
                            ${Math.round(progressPercent)}%
                        </div>
                    </div>
                    <a href="quiz.html?mode=placement" class="btn btn-primary btn-lg">
                        <i class="bi bi-play-circle-fill"></i> ${completed > 0 ? 'Continua il Test' : 'Inizia il Test'} (${questionsRemaining} rimaste)
                    </a>
                </div>

                <div class="d-flex align-items-center my-4">
                    <hr class="flex-grow-1"><span class="mx-3 text-muted">OPPURE</span><hr class="flex-grow-1">
                </div>

                <div class="mt-2">
                    <p class="fw-bold">Opzione 2: Carica un file CSV</p>
                    <p>Se hai già risposto alle domande, carica un file CSV con i tuoi risultati.</p>
                    <div class="input-group">
                        <input type="file" class="form-control" id="csv-upload-input" accept=".csv">
                        <button class="btn btn-outline-secondary" type="button" id="csv-upload-btn">
                            <i class="bi bi-upload"></i> Carica e Elabora
                        </button>
                    </div>
                    <div class="form-text">Il file deve avere due colonne: 'id' e 'isCorrect' (true/false).</div>
                    <div id="upload-feedback" class="mt-2"></div>
                </div>
            </div>
        </div>`;
}

/**
 * Imposta gli event listener per la sezione di upload del file CSV.
 */
function setupUploadListeners(questionsData) {
    const uploadBtn = document.getElementById('csv-upload-btn');
    const fileInput = document.getElementById('csv-upload-input');
    const feedbackEl = document.getElementById('upload-feedback');

    uploadBtn.addEventListener('click', () => {
        const file = fileInput.files[0];
        if (!file) {
            feedbackEl.innerHTML = `<div class="alert alert-warning p-2">Per favore, seleziona un file.</div>`;
            return;
        }
        uploadBtn.disabled = true;
        uploadBtn.innerHTML = `<span class="spinner-border spinner-border-sm"></span> Elaborazione...`;
        handleCsvUpload(file, questionsData, feedbackEl);
    });
}

/**
 * Gestisce la lettura, validazione e processamento del file CSV.
 */
async function handleCsvUpload(file, questionsData, feedbackEl) {
    const reader = new FileReader();
    reader.onload = async (event) => {
        try {
            const csvText = event.target.result;
            const rows = csvText.trim().split(/\r?\n/);
            const header = rows.shift().trim().toLowerCase().replace(/"/g, '');
            if (header !== 'id,iscorrect') throw new Error("Header non valido. Deve essere 'id,isCorrect'.");
            if (rows.length !== questionsData.length) throw new Error(`Il file deve contenere ${questionsData.length} righe di dati, trovate ${rows.length}.`);

            const parsedData = rows.map((row, index) => {
                const [id, isCorrectStr] = row.split(',');
                if (!id || !isCorrectStr) throw new Error(`Riga ${index + 2} malformata.`);
                const parsedId = parseInt(id.trim(), 10);
                if (isNaN(parsedId)) throw new Error(`ID non valido alla riga ${index + 2}.`);
                return { id: parsedId, isCorrect: isCorrectStr.trim().toLowerCase() === 'true' };
            });

            const { srsData, errorDeck } = processCsvData(parsedData);
            
            await saveUserProgress({
                srsData,
                errorDeck,
                placementTest: { isComplete: true, completedIds: parsedData.map(r => r.id) }
            });

            feedbackEl.innerHTML = `<div class="alert alert-success">Caricamento completato! La dashboard sarà pronta a breve.</div>`;
            setTimeout(() => window.location.reload(), 2000);
        } catch (error) {
            console.error("Errore nell'elaborazione del CSV:", error);
            feedbackEl.innerHTML = `<div class="alert alert-danger">${error.message}</div>`;
            document.getElementById('csv-upload-btn').disabled = false;
            document.getElementById('csv-upload-btn').innerHTML = `<i class="bi bi-upload"></i> Carica e Elabora`;
        }
    };
    reader.onerror = () => {
        feedbackEl.innerHTML = `<div class="alert alert-danger">Impossibile leggere il file.</div>`;
        document.getElementById('csv-upload-btn').disabled = false;
        document.getElementById('csv-upload-btn').innerHTML = `<i class="bi bi-upload"></i> Carica e Elabora`;
    };
    reader.readAsText(file);
}

/**
 * Processa i dati parsati dal CSV per creare lo stato iniziale di SRS e ErrorDeck.
 */
function processCsvData(parsedData) {
    const srsData = {};
    const errorDeck = [];
    const intervals = [1, 2, 4, 8, 15, 30];

    parsedData.forEach(({ id, isCorrect }) => {
        let level = isCorrect ? 1 : 0;
        if (!isCorrect) errorDeck.push(id);
        const daysToAdd = intervals[level];
        const nextReviewDate = new Date();
        nextReviewDate.setDate(nextReviewDate.getDate() + daysToAdd);
        srsData[id] = {
            level,
            nextReview: nextReviewDate.toISOString().split('T')[0],
            consecutiveCorrect: isCorrect ? 1 : 0,
            lastAnswerCorrect: isCorrect
        };
    });
    return { srsData, errorDeck };
}


// --- SEZIONE PIANO DI STUDIO GIORNALIERO ---
async function generateAndRenderDailyPlan() {
    const planContainer = document.getElementById('daily-plan-content');
    if (!planContainer) return;

    const todayStr = new Date().toISOString().split('T')[0];
    const srsDueCount = Object.values(await getSrsData()).filter(item => item.nextReview <= todayStr).length;
    const errorDeckSize = (await getErrorDeck())?.length || 0;
    
    const topPriorityCategory = [...fullCategoryStats]
        .filter(cat => cat.successRate < 90 && cat.incorrect > 0)
        .sort((a, b) => b.priorityScore - a.priorityScore)[0];

    let tasks = [];
    if (srsDueCount > 0) {
        tasks.push({ title: 'Ripasso Intelligente (SRS)', description: `Completa le tue ${srsDueCount} domande in scadenza.`, link: 'quiz.html?mode=srs' });
    }
    if (topPriorityCategory) {
        tasks.push({ title: 'Attacco alle Debolezze', description: `Allenati sulla tua area più critica: <strong>${topPriorityCategory.name}</strong>.`, link: `quiz.html?category=${encodeURIComponent(topPriorityCategory.name)}&submode=errors` });
    }
    if (errorDeckSize >= 5) {
        tasks.push({ title: 'Consolidamento Errori', description: `Ripassa 5 domande casuali dal tuo Mazzo degli Errori.`, link: 'quiz.html?mode=errors&limit=5' });
    }
    if (tasks.length === 0) {
        tasks.push({ title: 'Ripasso Generale', description: 'Ottimo lavoro! Non ci sono priorità urgenti. Fai una sessione di ripasso generale a tua scelta.', link: '#dashboard-view' });
    }

    const tasksHTML = tasks.map(task => `
        <li class="list-group-item d-flex justify-content-between align-items-center">
            <div>
                <strong>${task.title}</strong>
                <small class="d-block text-muted">${task.description}</small>
            </div>
            <a href="${task.link}" class="btn btn-sm btn-outline-primary">Inizia</a>
        </li>`).join('');

    planContainer.innerHTML = `<ul class="list-group list-group-flush">${tasksHTML}</ul>`;
}


// --- SEZIONE DASHBOARD PRINCIPALE E DEEP DIVE ---

function enableActionButtons() {
    document.getElementById('start-exam-btn').disabled = false;
    document.getElementById('srs-quiz-btn').classList.remove('disabled');
    document.getElementById('error-deck-btn').classList.remove('disabled');
}

async function updateUiCounters() {
    const srsData = await getSrsData();
    const errorDeck = await getErrorDeck();
    if (!srsData || !errorDeck) return;
    const today = new Date().toISOString().split('T')[0];
    const srsDueCount = Object.values(srsData).filter(item => item.nextReview <= today).length;
    document.getElementById('srs-count').textContent = srsDueCount;
    document.getElementById('error-deck-count').textContent = errorDeck.length;
}

function renderDashboardList(sortBy = 'priorityScore', maxPriority = 1) {
    const container = document.getElementById('category-list');
    if (!container) return;

    // Ordina le statistiche in base al criterio scelto
    const sortedStats = [...fullCategoryStats].sort((a, b) => b[sortBy] - a[sortBy]);
    container.innerHTML = ''; // Pulisce il contenitore
    
    sortedStats.forEach(category => {
        // Prepara i dati per il template
        const description = categoryDescriptions.get(category.name) || "Nessuna descrizione disponibile.";
        const safeDescription = description.replace(/"/g, '"'); // Rende la descrizione sicura per l'attributo HTML
        
        // --- Logica per la Barra di Priorità ---
        const barWidth = maxPriority > 0 ? (category.priorityScore / maxPriority) * 100 : 0;
        const priorityScoreRounded = Math.round(category.priorityScore);
        // Usa la funzione helper per ottenere la classe di colore base (bg-danger, bg-warning, bg-success)
        // Il CSS poi trasformerà questa classe in un gradiente.
        const priorityBarColor = getPriorityColorForBar(category.errorRate);

        // --- Template HTML per l'elemento della lista ---
        const element = document.createElement('div');
        // Aggiungiamo la classe `list-group-item-action` per l'effetto hover e il cursore a puntatore.
        element.className = 'list-group-item list-group-item-action'; 
        // Aggiungiamo il data-attribute per identificare la categoria al click.
        element.dataset.categoryName = category.name; 
        
        element.innerHTML = `
            <div class="d-flex w-100 justify-content-between align-items-center">
                <!-- Sezione Sinistra: Titolo e Dettagli -->
                <div class="flex-grow-1 me-3">
                    <h5 class="mb-1 d-flex align-items-center">
                        ${category.name}
                        <span class="ms-2" tabindex="0" data-bs-toggle="popover" data-bs-trigger="hover focus" 
                              data-bs-title="${category.name}" data-bs-content="${safeDescription}">
                            <i class="bi bi-question-circle-fill text-muted" style="font-size: 0.8em;"></i>
                        </span>
                    </h5>
                    <small class="text-muted">${category.incorrect} errori su ${category.total} domande</small>
                    
                    <div class="progress mt-2" 
                         title="Punteggio Priorità: ${priorityScoreRounded}. Calcolato da: ${category.errorRate.toFixed(1)}% (errore) × ${category.frequency} (frequenza).">
                        <div class="progress-bar ${priorityBarColor}" role="progressbar" style="width: ${barWidth}%" 
                             aria-valuenow="${barWidth}" aria-valuemin="0" aria-valuemax="100">
                        </div>
                    </div>
                </div>
                
                <!-- Sezione Destra: Badge con la percentuale di errore -->
                <div class="text-end">
                    <span class="badge rounded-pill fs-6 ${getPerformanceBadge(category.errorRate)}">
                        ${category.errorRate.toFixed(1)}% errore
                    </span>
                </div>
            </div>
        `;
        
        container.appendChild(element);
    });

    // Re-inizializza i popover di Bootstrap dopo aver creato i nuovi elementi.
    initializePopovers();
}

function renderStrategicMap(categoryStats) {
    const ctx = document.getElementById('strategic-map-canvas')?.getContext('2d');
    if (!ctx) return;
    if (window.chartInstance) window.chartInstance.destroy();

    // Definisci soglie e valori per il grafico
    const successThreshold = 65; // Soglia per definire "alta" o "bassa" bravura
    const frequencies = categoryStats.map(cat => cat.frequency);
    const frequencyThreshold = frequencies.length > 0 ? frequencies.reduce((a, b) => a + b, 0) / frequencies.length : 10; // Soglia media di frequenza

    // Trova il numero massimo di domande per normalizzare la dimensione del raggio
    const maxQuestionsInCategory = Math.max(...categoryStats.map(cat => cat.total), 0);
    const MIN_RADIUS = 5;
    const MAX_RADIUS = 25;

    // Prepara i dati per il grafico
    const dataForChart = categoryStats.map(cat => {
        // Calcola il raggio in base al numero totale di domande
        let radius = MIN_RADIUS;
        if (maxQuestionsInCategory > 0) {
            const normalizedSize = cat.total / maxQuestionsInCategory;
            radius = MIN_RADIUS + (normalizedSize * (MAX_RADIUS - MIN_RADIUS));
        }

        return {
            x: cat.successRate,      // Asse X: Bravura
            y: cat.frequency,        // Asse Y: Frequenza
            r: radius,               // Raggio: Numero totale di domande
            label: cat.name,         // Etichetta per il tooltip
            errorRate: cat.errorRate, // Dati extra per il tooltip
            totalQuestions: cat.total // Dati extra per il tooltip
        };
    });

    // Crea il grafico
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
                        label: function(context) {
                            const raw = context.raw;
                            return [
                                `${raw.label}`,
                                `Bravura: ${raw.x.toFixed(1)}%`,
                                `Frequenza: ${raw.y}`,
                                `Tasso Errore: ${raw.errorRate.toFixed(1)}%`,
                                `N. Domande: ${raw.totalQuestions}`
                            ];
                        }
                    }
                },
                annotation: {
                    annotations: {
                        boxLowSuccessLowFreq: { type: 'box', xMin: 0, xMax: successThreshold, yMin: 0, yMax: frequencyThreshold, backgroundColor: 'rgba(255, 193, 7, 0.05)', borderColor: 'rgba(255, 193, 7, 0.1)' },
                        boxLowSuccessHighFreq: { type: 'box', xMin: 0, xMax: successThreshold, yMin: frequencyThreshold, backgroundColor: 'rgba(220, 53, 69, 0.05)', borderColor: 'rgba(220, 53, 69, 0.1)' },
                        boxHighSuccessLowFreq: { type: 'box', xMin: successThreshold, xMax: 100, yMin: 0, yMax: frequencyThreshold, backgroundColor: 'rgba(108, 117, 125, 0.05)', borderColor: 'rgba(108, 117, 125, 0.1)' },
                        boxHighSuccessHighFreq: { type: 'box', xMin: successThreshold, xMax: 100, yMin: frequencyThreshold, backgroundColor: 'rgba(25, 135, 84, 0.05)', borderColor: 'rgba(25, 135, 84, 0.1)' },
                        lineSuccessThreshold: { type: 'line', xMin: successThreshold, xMax: successThreshold, borderColor: 'rgba(0,0,0,0.2)', borderWidth: 1, borderDash: [6, 6] },
                        lineFrequencyThreshold: { type: 'line', yMin: frequencyThreshold, yMax: frequencyThreshold, borderColor: 'rgba(0,0,0,0.2)', borderWidth: 1, borderDash: [6, 6] }
                    }
                }
            },
            scales: {
                x: {
                    title: { display: true, text: 'Bravura (% Successo)' },
                    min: 0,
                    max: 100
                },
                y: {
                    title: { display: true, text: 'Frequenza (Numero di Domande)' }
                }
            },
            onClick: (e, elements) => {
                if (elements.length > 0) {
                    const clickedIndex = elements[0].index;
                    const categoryLabel = dataForChart[clickedIndex].label;
                    showDetailsModal(categoryLabel);
                }
            }
        }
    });
}

function setupDashboardEventListeners(maxPriority) {
    document.getElementById('logout-btn').addEventListener('click', () => {
        signOut(auth).then(() => { localStorage.clear(); window.location.href = 'login.html'; }).catch(error => console.error("Errore di logout:", error));
    });

    document.getElementById('category-list').addEventListener('click', (event) => {
        const categoryLink = event.target.closest('[data-category-name]');
        if (categoryLink) {
            event.preventDefault();
            showDetailsModal(categoryLink.dataset.categoryName);
        }
    });
    
    const viewListBtn = document.getElementById('view-list-btn');
    const viewMapBtn = document.getElementById('view-map-btn');
    const sortDropdownMenu = document.querySelector('#sort-dropdown + .dropdown-menu');
    const startExamBtn = document.getElementById('start-exam-btn');

    sortDropdownMenu.addEventListener('click', (event) => {
        event.preventDefault();
        const target = event.target.closest('.dropdown-item');
        if (target) {
            const sortBy = target.dataset.sort;
            document.getElementById('sort-dropdown').textContent = `Ordina per: ${target.textContent.split('(')[0].trim()}`;
            sortDropdownMenu.querySelectorAll('.dropdown-item').forEach(item => item.classList.remove('active'));
            target.classList.add('active');
            renderDashboardList(sortBy, maxPriority);
        }
    });

    startExamBtn.addEventListener('click', (e) => {
        showLoadingSpinner(e.currentTarget);
        prepareAndStartExam();
    });

    const dashboardView = document.getElementById('dashboard-view');
    const mapView = document.getElementById('map-view');
    viewListBtn.addEventListener('click', () => {
        dashboardView.classList.remove('d-none'); mapView.classList.add('d-none');
        viewListBtn.classList.replace('btn-outline-primary', 'btn-primary'); viewListBtn.classList.add('active');
        viewMapBtn.classList.replace('btn-primary', 'btn-outline-primary'); viewMapBtn.classList.remove('active');
    });
    viewMapBtn.addEventListener('click', () => {
        mapView.classList.remove('d-none'); dashboardView.classList.add('d-none');
        viewMapBtn.classList.replace('btn-outline-primary', 'btn-primary'); viewMapBtn.classList.add('active');
        viewListBtn.classList.replace('btn-primary', 'btn-outline-primary'); viewListBtn.classList.remove('active');
    });
}

// in assets/js/dashboard.js

/**
 * Mostra il modal "Cruscotto Interattivo" con analisi dettagliata,
 * mini-grafici e stile migliorato.
 */
function showDetailsModal(categoryName) {
    const modalElement = document.getElementById('details-modal');
    const modalTitle = modalElement.querySelector('.modal-title');
    const modalBody = modalElement.querySelector('.modal-body');
    const modalFooter = modalElement.querySelector('.modal-footer');
    
    const categoryData = fullCategoryStats.find(cat => cat.name === categoryName);
    if (!categoryData) return;

    modalTitle.textContent = `Analisi Dettagliata: ${categoryData.name}`;

    const wrongQuestions = categoryData.questions.filter(q => !q.isCorrect);

    // --- Sezione Sinistra: Riepilogo Performance con Mini-Grafico ---
    const topMistakes = wrongQuestions.slice(0, 3);
    const mistakesHTML = topMistakes.length > 0
        ? topMistakes.map(q => `<div class="mb-2"><p class="mb-1 text-muted small"><em>"${q.domanda}"</em></p><p class="mb-0 small"><span class="badge bg-success-subtle text-success-emphasis rounded-pill me-2">Soluzione</span><strong>${q.soluzione}</strong></p></div>`).join('<hr class="my-2">')
        : `<div class="text-center p-3"><i class="bi bi-check-circle-fill text-success fs-1"></i><h5 class="mt-2">Nessun errore!</h5></div>`;

    const summaryHTML = `
        <div class="col-md-5 border-end pe-md-4">
            <h5 class="fw-light mb-4">Riepilogo Performance</h5>
            
            <div class="d-flex align-items-center">
                <div style="width: 80px; height: 80px; position: relative;">
                    <canvas id="error-rate-chart"></canvas>
                    <div class="position-absolute top-50 start-50 translate-middle fw-bold" style="font-size: 1.2rem;">
                        ${categoryData.errorRate.toFixed(0)}%
                    </div>
                </div>
                <div class="ms-3">
                    <h6 class="mb-0">Tasso di errore</h6>
                    <p class="text-muted small mb-0">${categoryData.incorrect} sbagliate su ${categoryData.total}</p>
                </div>
            </div>

            <hr class="my-4">
            <h6 class="fw-light">Esempi di errori recenti:</h6>
            <div class="mt-2 small">${mistakesHTML}</div>
        </div>`;

    // --- Sezione Destra: Punti Deboli Specifici ---
    const problematicTags = analyzeTagsInWrongQuestions(wrongQuestions);
    let deepDiveHTML = '';
    if (problematicTags.length > 0) {
        const tagListHTML = problematicTags.map(tagInfo => `
            <div class="d-flex justify-content-between align-items-center py-2 border-bottom">
                <div>
                    <span class="fw-bold">${tagInfo.tagName}</span>
                    <small class="d-block text-muted">${tagInfo.count} errori su questo concetto</small>
                </div>
                <button class="btn btn-sm btn-danger rounded-pill train-tag-btn" data-tag="${tagInfo.tagKey}" data-category="${categoryName}">
                    <i class="bi bi-bullseye"></i> Allena
                </button>
            </div>`).join('');
        deepDiveHTML = `
            <h5 class="fw-light mb-3">Punti Deboli Specifici</h5>
            <p class="small text-muted">Questi sono i concetti precisi che hai sbagliato più spesso. Clicca "Allena" per un ripasso mirato.</p>
            <div class="list-group list-group-flush">${tagListHTML}</div>`;
    } else {
        deepDiveHTML = `<div class="d-flex align-items-center justify-content-center h-100"><p class="text-muted text-center mt-5">Nessun pattern di errore specifico trovato.</p></div>`;
    }

    const deepDiveContainerHTML = `<div class="col-md-7 ps-md-4">${deepDiveHTML}</div>`;
    
    // Unisci e renderizza
    modalBody.innerHTML = `<div class="row">${summaryHTML}${deepDiveContainerHTML}</div>`;
    
    // --- Footer del Modal ---
    const encodedCategoryName = encodeURIComponent(categoryName);
    modalFooter.innerHTML = `
        <button type="button" class="btn btn-light" data-bs-dismiss="modal">Chiudi</button>
        <a href="quiz.html?category=${encodedCategoryName}&submode=errors" class="btn btn-danger"><i class="bi bi-lightning-charge-fill"></i> Allena tutti gli Errori (${wrongQuestions.length})</a>
        <a href="quiz.html?category=${encodedCategoryName}&submode=all" class="btn btn-primary"><i class="bi bi-arrow-clockwise"></i> Ripassa Tutta la Categoria</a>`;
    
    // Mostra il modal e poi disegna il grafico
    const modalInstance = bootstrap.Modal.getOrCreateInstance(modalElement);
    modalInstance.show();
    
    // Renderizza il mini-grafico DOPO che il modal è visibile
    const chartCtx = document.getElementById('error-rate-chart')?.getContext('2d');
    if (chartCtx) {
        new Chart(chartCtx, {
            type: 'doughnut',
            data: {
                labels: ['Errori', 'Corrette'],
                datasets: [{
                    data: [categoryData.incorrect, categoryData.correct],
                    backgroundColor: ['#e63946', '#e9ecef'], // Usa i colori del tema
                    borderWidth: 0,
                    cutout: '75%' // Crea l'effetto "anello sottile"
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: { display: false },
                    tooltip: { enabled: false }
                }
            }
        });
    }

    // Attiva i listener per i pulsanti "Allena"
    setupTrainTagButtonListeners(modalElement);
}

function analyzeTagsInWrongQuestions(wrongQuestions) {
    if (wrongQuestions.length === 0) return [];
    const tagCounts = new Map();
    wrongQuestions.forEach(q => q.tags?.forEach(tag => tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1)));
    return Array.from(tagCounts.entries())
        .map(([tagKey, count]) => ({ tagKey, tagName: tagDictionary[tagKey] || tagKey.replace(/-/g, ' '), count }))
        .sort((a, b) => b.count - a.count).slice(0, 5);
}

function setupTrainTagButtonListeners(modalElement) {
    if (modalElement.eventListener) modalElement.removeEventListener('click', modalElement.eventListener);
    modalElement.eventListener = function(event) {
        const button = event.target.closest('.train-tag-btn');
        if (!button) return;
        const tagToTrain = button.dataset.tag;
        const categoryName = button.dataset.category;
        const categoryData = fullCategoryStats.find(cat => cat.name === categoryName);
        if (!categoryData) return;
        const questionIdsToTrain = categoryData.questions.filter(q => !q.isCorrect && q.tags?.includes(tagToTrain)).map(q => q.id);
        if (questionIdsToTrain.length > 0) {
            const idsParam = encodeURIComponent(JSON.stringify(questionIdsToTrain));
            window.location.href = `quiz.html?mode=custom&ids=${idsParam}`;
        }
    };
    modalElement.addEventListener('click', modalElement.eventListener);
}

// --- FUNZIONI UTILITY ---
function getPriorityColorForBar(errorRate) {
    if (errorRate > 50) return 'bg-danger';
    if (errorRate > 25) return 'bg-warning';
    return 'bg-success';
}
function getPriorityColor(score, maxScore) { const p = maxScore > 0 ? score / maxScore : 0; if (p > 0.66) return 'bg-danger'; if (p > 0.33) return 'bg-warning'; return 'bg-success'; }
function getPerformanceColor(errorRate, opacity) { if (errorRate > 50) return `rgba(220, 53, 69, ${opacity})`; if (errorRate > 25) return `rgba(255, 193, 7, ${opacity})`; return `rgba(25, 135, 84, ${opacity})`; }
function initializePopovers() {
    // Prima distruggi le istanze esistenti per evitare problemi
    [...document.querySelectorAll('[data-bs-toggle="popover"]')].forEach(el => {
        const instance = bootstrap.Popover.getInstance(el);
        if (instance) {
            instance.dispose();
        }
    });
    // Poi crea le nuove istanze
    [...document.querySelectorAll('[data-bs-toggle="popover"]')].forEach(el => new bootstrap.Popover(el));
}function showLoadingSpinner(buttonElement) { buttonElement.disabled = true; buttonElement.innerHTML = `<span class="spinner-border spinner-border-sm"></span> Caricamento...`; }
function prepareAndStartExam() { if (allQuestionsGlobally.length === 0) return; const count = 40; const shuffled = [...allQuestionsGlobally].sort(() => 0.5 - Math.random()); const ids = shuffled.slice(0, count).map(q => q.id); localStorage.setItem('examSession_questionIds', JSON.stringify(ids)); window.location.href = 'quiz.html?mode=exam'; }