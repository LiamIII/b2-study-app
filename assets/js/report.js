/**
 * report.js
 * 
 * Gestisce la logica per la pagina del report della simulazione d'esame (report.html).
 * - Legge i dati della sessione d'esame dal localStorage.
 * - Calcola le statistiche riassuntive (punteggio, risposte corrette, tempo).
 * - Renderizza un'analisi dettagliata domanda per domanda usando un accordion di Bootstrap.
 */

document.addEventListener('DOMContentLoaded', () => {
    console.log("Report script caricato.");

    const reportDataJSON = localStorage.getItem('examReportData');
    
    // Pulisce i dati dal localStorage per evitare di visualizzare un vecchio report
    localStorage.removeItem('examReportData');

    if (!reportDataJSON) {
        document.querySelector('main').innerHTML = `
            <div class="alert alert-warning text-center">
                Nessun dato del report trovato. 
                <a href="index.html" class="alert-link">Avvia una nuova simulazione dalla dashboard</a>.
            </div>`;
        return;
    }

    const reportData = JSON.parse(reportDataJSON);
    const { questions, userAnswers, timeTaken } = reportData;

    if (!questions || !userAnswers) {
        document.querySelector('main').innerHTML = `<div class="alert alert-danger">Dati del report corrotti.</div>`;
        return;
    }

    renderSummary(questions, userAnswers, timeTaken);
    renderDetailedAnalysis(questions, userAnswers);
    
    // Poiché l'accordion è creato dinamicamente, dobbiamo assicurarci che
    // il JS di Bootstrap sia caricato per renderlo funzionante.
    // Lo aggiungiamo dinamicamente alla fine per sicurezza.
    if (!document.querySelector('script[src*="bootstrap"]')) {
        const bootstrapScript = document.createElement('script');
        bootstrapScript.src = 'https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js';
        document.body.appendChild(bootstrapScript);
    }
});


/**
 * Renderizza la sezione di riepilogo con le statistiche chiave.
 * @param {Array} questions - L'array delle domande dell'esame.
 * @param {Object} userAnswers - L'oggetto con le risposte dell'utente.
 * @param {number} timeTaken - Il tempo totale in secondi.
 */
function renderSummary(questions, userAnswers, timeTaken) {
    const summaryContainer = document.getElementById('summary-section');
    if (!summaryContainer) return;

    let correctCount = 0;
    questions.forEach(q => {
        if (userAnswers[q.id] === q.soluzione) {
            correctCount++;
        }
    });

    const score = questions.length > 0 ? (correctCount / questions.length) * 100 : 0;
    
    // Visualizza statistiche
    const scoreDisplay = `
        <div class="col-md-4 mb-3">
            <h4>Punteggio</h4>
            <p class="display-6 ${score >= 60 ? 'text-success' : 'text-danger'}">${score.toFixed(1)}%</p>
        </div>`;
        
    const correctCountDisplay = `
        <div class="col-md-4 mb-3">
            <h4>Risposte Corrette</h4>
            <p class="display-6">${correctCount} / ${questions.length}</p>
        </div>`;
        
    let timeTakenDisplay = '';
    if (timeTaken !== undefined) {
        const minutes = Math.floor(timeTaken / 60);
        const seconds = timeTaken % 60;
        timeTakenDisplay = `
            <div class="col-md-4 mb-3">
                <h4>Tempo Impiegato</h4>
                <p class="display-6">${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}</p>
            </div>`;
    }

    summaryContainer.innerHTML = scoreDisplay + correctCountDisplay + timeTakenDisplay;
}


/**
 * Renderizza l'analisi dettagliata domanda per domanda in un accordion.
 * @param {Array} questions - L'array delle domande dell'esame.
 * @param {Object} userAnswers - L'oggetto con le risposte dell'utente.
 */
function renderDetailedAnalysis(questions, userAnswers) {
    const detailsContainer = document.getElementById('details-section');
    if (!detailsContainer) return;

    let accordionHTML = '';

    questions.forEach((q, index) => {
        const userAnswer = userAnswers[q.id];
        const isCorrect = userAnswer === q.soluzione;
        const glossaryLink = q.pattern ? `<a href="glossary.html#${q.pattern.split('|').sort().join('|')}" target="_blank" class="btn btn-sm btn-outline-secondary mt-2">Approfondisci l'argomento</a>` : '';

        const accordionItem = `
            <div class="accordion-item">
                <h2 class="accordion-header" id="heading${index}">
                    <button class="accordion-button collapsed ${isCorrect ? '' : 'bg-danger-subtle text-dark fw-bold'}" type="button" data-bs-toggle="collapse" data-bs-target="#collapse${index}" aria-expanded="false" aria-controls="collapse${index}">
                        Domanda ${index + 1}: ${q.domanda.substring(0, 60)}... - <strong>${isCorrect ? 'Corretta' : 'Sbagliata'}</strong>
                    </button>
                </h2>
                <div id="collapse${index}" class="accordion-collapse collapse" aria-labelledby="heading${index}">
                    <div class="accordion-body">
                        <p><strong>La tua risposta:</strong> <span class="${isCorrect ? 'text-success' : 'text-danger'}">${userAnswer || '<em>Non risposto</em>'}</span></p>
                        ${!isCorrect ? `<p><strong>Risposta corretta:</strong> <span class="text-success">${q.soluzione}</span></p>` : ''}
                        <hr>
                        <p><strong>Spiegazione:</strong> <em>${q.spiegazione}</em></p>
                        <small class="text-muted">Riferimento di studio: ${q.ripasso}</small>
                        <div class="mt-2">${glossaryLink}</div>
                    </div>
                </div>
            </div>
        `;
        accordionHTML += accordionItem;
    });

    detailsContainer.innerHTML = accordionHTML;
}