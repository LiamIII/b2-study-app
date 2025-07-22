/**
 * progress.js
 * Logica per la pagina dei progressi (progress.html).
 */
document.addEventListener('DOMContentLoaded', () => {
    console.log("Pagina Progressi caricata.");

    // Recupera tutti i dati necessari
    const profile = getUserProfile();
    const history = getStudyHistory();
    const srsData = getSrsData();
    const allQuestions = JSON.parse(localStorage.getItem('allQuestions'));

    if (!allQuestions) {
        document.querySelector('main').innerHTML = '<div class="alert alert-warning">Nessun dato trovato. Inizia a studiare per vedere i tuoi progressi!</div>';
        return;
    }

    // Popola i riquadri delle statistiche
    updateStatCards(profile, srsData, allQuestions);

    // Crea i grafici
    renderActivityChart(history);
});

function updateStatCards(profile, srsData, allQuestions) {
    // 1. Streak
    document.getElementById('streak-count').textContent = profile.streak;

    // 2. Domande Masterizzate (livello SRS massimo)
    const maxSrsLevel = 5; // Basato sui nostri intervalli: [1, 3, 7, 15, 30, 60]
    const masteredCount = Object.values(srsData).filter(item => item.level === maxSrsLevel).length;
    document.getElementById('mastered-count').textContent = masteredCount;

    // 3. Proficiency Generale
    const totalCorrect = allQuestions.filter(q => q.isCorrect).length;
    const proficiency = allQuestions.length > 0 ? (totalCorrect / allQuestions.length) * 100 : 0;
    document.getElementById('proficiency-percentage').textContent = `${proficiency.toFixed(1)}%`;
}

function renderActivityChart(history) {
    const ctx = document.getElementById('activity-chart').getContext('2d');
    
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

    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Domande Studiate',
                data: data,
                backgroundColor: 'rgba(0, 123, 255, 0.5)',
                borderColor: 'rgba(0, 123, 255, 1)',
                borderWidth: 1
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
                }
            }
        }
    });
}