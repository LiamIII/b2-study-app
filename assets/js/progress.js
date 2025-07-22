/**
 * progress.js - VERSIONE CORRETTA E FUNZIONANTE
 *
 * - Corregge l'errore "doc is not defined" importando le funzioni necessarie da Firestore.
 * - Aggiunge una nuova sezione per visualizzare l'andamento delle performance nel tempo.
 * - Recupera i dati storici da una nuova collezione su Firestore.
 * - Usa Chart.js per creare un grafico a linee interattivo.
 * - Permette all'utente di filtrare il grafico per categoria.
 */

import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { auth } from './firebase-init.js';
import * as common from './common.js';

let patternGlossary = {};
let performanceHistory = []; // Variabile globale per i dati storici

document.addEventListener('DOMContentLoaded', () => {
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            await initializeProgressPage();
        } else {
            window.location.href = 'login.html';
        }
    });
});

async function initializeProgressPage() {
    const allQuestionsJSON = localStorage.getItem('allQuestions');
    if (!allQuestionsJSON) {
        document.querySelector('main').innerHTML = '<div class="alert alert-warning">Dati non trovati. Torna alla dashboard per caricarli.</div>';
        return;
    }
    const allQuestions = JSON.parse(allQuestionsJSON);
    
    try {
        const response = await fetch('data/glossary/patterns.json');
        if (response.ok) patternGlossary = await response.json();
    } catch (error) { console.error("Errore caricamento glossario:", error); }

    const [profile, history, srsData, errorDeck, perfHistory] = await Promise.all([
        common.getUserProfile(),
        common.getStudyHistory(),
        common.getSrsData(),
        common.getErrorDeck(),
        common.getPerformanceHistory() // CHIAMA LA FUNZIONE CENTRALIZZATA
    ]);

    performanceHistory = perfHistory.sort((a, b) => new Date(a.date) - new Date(b.date));
    
    const patterns = common.analyzeErrorPatterns(allQuestions, errorDeck);
    
    updateStatCards(profile, srsData, allQuestions);
    renderActivityChart(history);
    
    populatePerformanceFilter();
    renderPerformanceChart('overall');
    setupPerformanceFilterListener();

    renderErrorPatterns(patterns);
    setupModalEventListeners();
    initializeTooltips();
}


/**
 * Popola il menu a tendina con le categorie disponibili.
 */
function populatePerformanceFilter() {
    const filterSelect = document.getElementById('performance-filter');
    if (!filterSelect || performanceHistory.length === 0) return;

    const firstSnapshot = performanceHistory[0];
    if (firstSnapshot && firstSnapshot.categoryErrorRates) {
        const categories = Object.keys(firstSnapshot.categoryErrorRates).sort();
        categories.forEach(categoryName => {
            const option = document.createElement('option');
            option.value = categoryName;
            option.textContent = `Categoria: ${categoryName}`;
            filterSelect.appendChild(option);
        });
    }
}
/**
 * Renderizza il grafico delle performance nel tempo.
 */
function renderPerformanceChart(filterKey = 'overall') {
    const container = document.getElementById('performance-chart-container');
    if (!container) return;
    
    // Rimuovi canvas precedente e ricrealo per evitare problemi con Chart.js
    container.innerHTML = '<canvas id="performance-chart"></canvas>';
    const ctx = document.getElementById('performance-chart').getContext('2d');

    if (performanceHistory.length < 2) {
        container.innerHTML = `<div class="text-center text-muted p-5">Completa sessioni di studio in almeno due giorni diversi per vedere i tuoi progressi.</div>`;
        return;
    }
    
    const labels = performanceHistory.map(snap => new Date(snap.date).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' }));
    let dataPoints;
    let chartLabel;

    if (filterKey === 'overall') {
        dataPoints = performanceHistory.map(snap => snap.overallErrorRate);
        chartLabel = 'Tasso di Errore Complessivo (%)';
    } else {
        dataPoints = performanceHistory.map(snap => snap.categoryErrorRates[filterKey] !== undefined ? snap.categoryErrorRates[filterKey] : null);
        chartLabel = `Tasso di Errore: ${filterKey} (%)`;
    }

    if (window.performanceChartInstance) {
        window.performanceChartInstance.destroy();
    }

    window.performanceChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [{
                label: chartLabel, data: dataPoints,
                borderColor: 'rgba(0, 123, 255, 1)', backgroundColor: 'rgba(0, 123, 255, 0.1)',
                fill: true, tension: 0.2, spanGaps: true
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            scales: { y: { beginAtZero: true, max: 100, title: { display: true, text: 'Tasso di Errore (%)' } } },
            plugins: { tooltip: { callbacks: { label: context => `${context.dataset.label}: ${context.raw.toFixed(1)}%` } } }
        }
    });
}

function setupPerformanceFilterListener() {
    const filterSelect = document.getElementById('performance-filter');
    if (filterSelect) {
        filterSelect.addEventListener('change', (event) => {
            renderPerformanceChart(event.target.value);
        });
    }
}

// --- Funzioni Esistenti (Complete) ---

function initializeTooltips() {
    [...document.querySelectorAll('[data-bs-toggle="tooltip"]')].forEach(el => new bootstrap.Tooltip(el));
}

function updateStatCards(profile, srsData, allQuestions) {
    document.getElementById('streak-count').textContent = profile.streak || 0;
    const intervals = [1, 3, 7, 15, 30, 60];
    const maxSrsLevel = intervals.length - 1;
    let srsLowCount = 0, srsMidCount = 0, srsHighCount = 0;

    Object.values(srsData).forEach(item => {
        if (item.level <= 1) srsLowCount++;
        else if (item.level < maxSrsLevel) srsMidCount++;
        else srsHighCount++;
    });

    document.getElementById('srs-level-low').textContent = srsLowCount;
    document.getElementById('srs-level-mid').textContent = srsMidCount;
    document.getElementById('srs-level-high').textContent = srsHighCount;
    document.getElementById('mastered-count').textContent = srsHighCount;

    const totalCorrect = allQuestions.filter(q => q.isCorrect).length;
    const proficiency = allQuestions.length > 0 ? (totalCorrect / allQuestions.length) * 100 : 0;
    document.getElementById('proficiency-percentage').textContent = `${proficiency.toFixed(1)}%`;
}

function renderActivityChart(history) {
    const ctx = document.getElementById('activity-chart')?.getContext('2d');
    if (!ctx) return;
    
    const labels = [], data = [];
    for (let i = 13; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        labels.push(date.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' }));
        data.push(history[dateStr] ? history[dateStr].studied : 0);
    }

    if (window.activityChartInstance) window.activityChartInstance.destroy();

    window.activityChartInstance = new Chart(ctx, {
        type: 'bar',
        data: { labels, datasets: [{ label: 'Domande Studiate', data, backgroundColor: 'rgba(0, 123, 255, 0.5)', borderColor: 'rgba(0, 123, 255, 1)', borderWidth: 1, borderRadius: 4 }] },
        options: { scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }, plugins: { legend: { display: false }, tooltip: { callbacks: { title: () => '', label: c => `  Studiate: ${c.raw}` } } } }
    });
}

function renderErrorPatterns(patterns) {
    const container = document.getElementById('error-patterns-container');
    if (!container) return;
    const errorDeckCache = JSON.parse(localStorage.getItem('errorDeck_cache')) || [];
    if (patterns.length === 0) {
        container.innerHTML = errorDeckCache.length > 0
            ? `<p class="text-muted">Hai ${errorDeckCache.length} errori, ma non abbiamo trovato confusioni sistematiche. Continua così!</p>`
            : '<p class="text-muted">Nessun errore registrato, nessun pattern da analizzare. Ottimo lavoro!</p>';
        return;
    }

    const validPatterns = patterns.filter(p => p.tags && Array.isArray(p.tags) && p.tags.length >= 2);
    const htmlContent = validPatterns.slice(0, 5).map(pattern => {
        const patternKey = [...pattern.tags].sort().join('|');
        const dictionary = common.tagDictionary || tagDictionary || {};
        const tag1 = (pattern.tags[0] && dictionary[pattern.tags[0]]) || (pattern.tags[0] ? pattern.tags[0].replace(/-/g, ' ') : 'Tag Sconosciuto');
        const tag2 = (pattern.tags[1] && dictionary[pattern.tags[1]]) || (pattern.tags[1] ? pattern.tags[1].replace(/-/g, ' ') : 'Tag Sconosciuto');
        const quizUrl = `quiz.html?mode=custom&ids=${encodeURIComponent(JSON.stringify(pattern.questionIds))}`;
        return `
            <div class="list-group-item d-flex justify-content-between align-items-center">
                <div>
                    <h6 class="mb-1">
                        <i class="bi bi-info-circle-fill text-primary me-2" role="button" data-bs-toggle="modal" 
                           data-bs-target="#pattern-details-modal" data-pattern-key="${patternKey}"></i>
                        <strong>${tag1}</strong> e <strong>${tag2}</strong>
                    </h6>
                    <small class="text-muted">${pattern.count} errori correlati</small>
                </div>
                <a href="${quizUrl}" class="btn btn-primary btn-sm">
                    Allena <span class="badge bg-light text-dark">${pattern.questionIds.length}</span>
                </a>
            </div>`;
    }).join('');

    container.innerHTML = `<p>Abbiamo notato alcune possibili confusioni. Clicca su un pattern per un quiz mirato o sull'icona <i class="bi bi-info-circle"></i> per dettagli:</p><div class="list-group">${htmlContent}</div>`;
}

function setupModalEventListeners() {
    const modalElement = document.getElementById('pattern-details-modal');
    if (!modalElement) return;
    modalElement.addEventListener('show.bs.modal', (event) => {
        const triggerElement = event.relatedTarget;
        const patternKey = triggerElement.getAttribute('data-pattern-key');
        const patternData = patternGlossary[patternKey];
        const modalTitle = modalElement.querySelector('.modal-title');
        const modalBody = modalElement.querySelector('.modal-body');
        if (!patternData) {
            modalTitle.textContent = 'Errore';
            modalBody.innerHTML = `<p class="text-danger">Dettagli non trovati per: <strong>${patternKey}</strong>.</p>`;
            return;
        }
        modalTitle.textContent = patternData.title;
        let referencesHTML = '';
        if (patternData.references && Object.keys(patternData.references).length > 0) {
            referencesHTML = '<hr><h6 class="mt-3">Approfondisci su:</h6><ul class="list-unstyled small">';
            if (patternData.references.egu) referencesHTML += `<li><strong>English Grammar in Use:</strong> Units ${patternData.references.egu}</li>`;
            if (patternData.references.ess) referencesHTML += `<li><strong>Essential Grammar in Use:</strong> Units ${patternData.references.ess}</li>`;
            if (patternData.references.evu) referencesHTML += `<li><strong>English Vocabulary in Use:</strong> Units ${patternData.references.evu}</li>`;
            referencesHTML += '</ul>';
        }
        modalBody.innerHTML = `<p class="lead fs-6">${patternData.explanation}</p><h6>Consigli Pratici:</h6><ul class="list-group list-group-flush mb-3">${patternData.tips.map(tip => `<li class="list-group-item">${tip}</li>`).join('')}</ul>${referencesHTML}`;
    });
}