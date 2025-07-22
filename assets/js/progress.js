import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { auth } from './firebase-init.js';
import * as common from './common.js'; // Importa TUTTO come 'common'

let patternGlossary = {};

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
    const allQuestions = JSON.parse(localStorage.getItem('allQuestions'));
    if (!allQuestions) { /* ... */ return; }
    
    try {
        const response = await fetch('data/glossary/patterns.json');
        if (response.ok) patternGlossary = await response.json();
    } catch (error) { console.error("Errore caricamento glossario:", error); }

    const [profile, history, srsData, errorDeck] = await Promise.all([
        common.getUserProfile(), common.getStudyHistory(), common.getSrsData(), common.getErrorDeck()
    ]);
    
    // Il calcolo e il rendering dei pattern ora avvengono qui
    const patterns = common.analyzeErrorPatterns(allQuestions, errorDeck);
    
    updateStatCards(profile, srsData, allQuestions);
    renderActivityChart(history);
    renderErrorPatterns(patterns);
    setupModalEventListeners();
    initializeTooltips();
}

// in progress.js

/**
 * Renderizza i pattern di errore in modo interattivo.
 * (Versione con la logica HTML corretta)
 */
function renderErrorPatterns(patterns) {
    const container = document.getElementById('error-patterns-container');
    if (!container) return;

    const errorDeckCache = JSON.parse(localStorage.getItem('errorDeck_cache')) || [];

    if (patterns.length === 0) {
        if (errorDeckCache.length > 0) {
            container.innerHTML = `<p class="text-muted">Hai ${errorDeckCache.length} errori registrati, ma non abbiamo trovato confusioni sistematiche. Continua a studiare per raccogliere più dati!</p>`;
        } else {
            container.innerHTML = '<p class="text-muted">Nessun errore registrato, nessun pattern da analizzare. Ottimo lavoro!</p>';
        }
        return;
    }

    let htmlContent = ''; // Usiamo un nome di variabile diverso per chiarezza
    
    patterns.slice(0, 5).forEach(pattern => {
        const patternKey = [...pattern.tags].sort().join('|');
        const tag1 = common.tagDictionary[pattern.tags[0]] || pattern.tags[0].replace(/-/g, ' ');
        const tag2 = common.tagDictionary[pattern.tags[1]] || pattern.tags[1].replace(/-/g, ' ');
        const quizUrl = `quiz.html?mode=custom&ids=${encodeURIComponent(JSON.stringify(pattern.questionIds))}`;

        // *** QUESTA È LA LOGICA HTML CHE MANCAVA ***
        htmlContent += `
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
            </div>
        `;
    });

    container.innerHTML = `
        <p>Abbiamo notato alcune possibili confusioni. Clicca su un pattern per un quiz mirato o sull'icona <i class="bi bi-info-circle"></i> per dettagli:</p>
        <div class="list-group">
            ${htmlContent}
        </div>
    `;
}

/**
 * Inizializza tutti i tooltip di Bootstrap.
 */
function initializeTooltips() {
    [...document.querySelectorAll('[data-bs-toggle="tooltip"]')].forEach(el => new bootstrap.Tooltip(el));
}

/**
 * Popola le card con le statistiche chiave.
 */
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

/**
 * Renderizza il grafico a barre dell'attività di studio.
 */
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



/**
 * Imposta l'event listener per il modal dei dettagli del pattern.
 */
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
            modalBody.innerHTML = `<p class="text-danger">Dettagli non trovati nel glossario per: <strong>${patternKey}</strong>. Assicurati che la chiave nel JSON sia ordinata alfabeticamente.</p>`;
            return;
        }

        modalTitle.textContent = patternData.title;
        let referencesHTML = '<hr><h6 class="mt-3">Approfondisci su:</h6><ul class="list-unstyled small">';
        let hasReferences = false;
        if (patternData.references?.egu) { referencesHTML += `<li><strong>English Grammar in Use:</strong> Units ${patternData.references.egu}</li>`; hasReferences = true; }
        if (patternData.references?.ess) { referencesHTML += `<li><strong>Essential Grammar in Use:</strong> Units ${patternData.references.ess}</li>`; hasReferences = true; }
        if (patternData.references?.evu) { referencesHTML += `<li><strong>English Vocabulary in Use:</strong> Units ${patternData.references.evu}</li>`; hasReferences = true; }
        referencesHTML += '</ul>';

        modalBody.innerHTML = `
            <p class="lead fs-6">${patternData.explanation}</p>
            <h6>Consigli Pratici:</h6>
            <ul class="list-group list-group-flush mb-3">${patternData.tips.map(tip => `<li class="list-group-item">${tip}</li>`).join('')}</ul>
            ${hasReferences ? referencesHTML : ''}
        `;
    });
}