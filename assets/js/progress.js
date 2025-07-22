/**
 * progress.js - VERSIONE FINALE CON TOOLTIPS
 * 
 * - Gestisce il controllo dell'autenticazione all'avvio della pagina.
 * - Recupera i dati di progresso dell'utente da Firestore e i dati statici dalla cache.
 * - Popola le card delle statistiche (Streak, Domande Masterizzate, Proficiency).
 * - Renderizza il grafico dell'attività di studio.
 * - Inizializza i tooltip di Bootstrap per fornire aiuto contestuale.
 */

import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { auth } from './firebase-init.js';
import * as common from './common.js'; // Importa TUTTE le funzioni da common.js

document.addEventListener('DOMContentLoaded', () => {
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            // L'utente è confermato, ora possiamo procedere
            console.log("Pagina Progressi caricata per l'utente:", user.email);
            await initializeProgressPage();
        } else {
            // L'utente non è loggato, torna al login
            window.location.href = 'login.html';
        }
    });
});

/**
 * Funzione principale che orchestra il caricamento dei dati e il rendering della pagina.
 */
async function initializeProgressPage() {
    // Recupera tutti i dati necessari in parallelo dove possibile
    const [profile, history, srsData] = await Promise.all([
        common.getUserProfile(),
        common.getStudyHistory(),
        common.getSrsData()
    ]);
    const allQuestions = JSON.parse(localStorage.getItem('allQuestions')); // Leggiamo dalla cache

    if (!allQuestions) {
        document.querySelector('main').innerHTML = '<div class="alert alert-warning">Nessun dato di base trovato. Inizia una sessione dalla dashboard.</div>';
        return;
    }

    // Popola i riquadri delle statistiche
    updateStatCards(profile, srsData, allQuestions);

    // Crea i grafici
    renderActivityChart(history);

    // Attiva i tooltip per le icone di aiuto
    initializeTooltips();
}

/**
 * Inizializza tutti i tooltip di Bootstrap presenti nella pagina.
 */
function initializeTooltips() {
    const tooltipTriggerList = document.querySelectorAll('[data-bs-toggle="tooltip"]');
    [...tooltipTriggerList].forEach(tooltipTriggerEl => new bootstrap.Tooltip(tooltipTriggerEl));
}

/**
 * Popola le card con le statistiche chiave.
 * @param {object} profile - L'oggetto profilo utente con la streak.
 * @param {object} srsData - L'oggetto con i dati di Spaced Repetition.
 * @param {Array} allQuestions - L'array di tutte le domande.
 */
function updateStatCards(profile, srsData, allQuestions) {
    // 1. Streak
    document.getElementById('streak-count').textContent = profile.streak || 0;

    // 2. Domande Masterizzate (livello SRS massimo)
    const intervals = [1, 3, 7, 15, 30, 60];
    const maxSrsLevel = intervals.length - 1;
    const masteredCount = Object.values(srsData).filter(item => item.level === maxSrsLevel).length;
    document.getElementById('mastered-count').textContent = masteredCount;

    // 3. Proficiency Generale (basata sui dati iniziali del file .csv)
    const totalCorrect = allQuestions.filter(q => q.isCorrect).length;
    const proficiency = allQuestions.length > 0 ? (totalCorrect / allQuestions.length) * 100 : 0;
    document.getElementById('proficiency-percentage').textContent = `${proficiency.toFixed(1)}%`;
}

/**
 * Renderizza il grafico a barre dell'attività di studio degli ultimi 14 giorni.
 * @param {object} history - L'oggetto con lo storico delle sessioni di studio.
 */
function renderActivityChart(history) {
    const ctx = document.getElementById('activity-chart').getContext('2d');
    if (!ctx) return;
    
    // Prepariamo i dati per gli ultimi 14 giorni
    const labels = [];
    const data = [];
    for (let i = 13; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        
        labels.push(date.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' }));
        data.push(history[dateStr] ? history[dateStr].studied : 0);
    }

    // Distrugge un eventuale grafico precedente per evitare conflitti
    if (window.activityChartInstance) {
        window.activityChartInstance.destroy();
    }

    window.activityChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Domande Studiate',
                data: data,
                backgroundColor: 'rgba(0, 123, 255, 0.5)',
                borderColor: 'rgba(0, 123, 255, 1)',
                borderWidth: 1,
                borderRadius: 4
            }]
        },
        options: {
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1 // Mostra solo numeri interi sull'asse Y
                    }
                }
            },
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        title: () => '', // Nasconde il titolo del tooltip
                        label: (context) => `  Studiate: ${context.raw}`
                    }
                }
            }
        }
    });
}