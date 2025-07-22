/**
 * quiz.js - VERSIONE CON MIGLIORAMENTI UX/UI
 * 
 * - Gestisce la sottomodalità (submode) per i quiz di categoria.
 * - Aggiunge una conferma prima di abbandonare una simulazione d'esame.
 * - Mantiene tutte le funzionalità precedenti.
 */

let currentQuizQuestions = [];
let currentQuestionIndex = 0;
let userExamAnswers = {};
let timerInterval = null;
let secondsElapsed = 0;

document.addEventListener('DOMContentLoaded', () => {
    console.log("Quiz script caricato.");

    const allQuestionsJSON = localStorage.getItem('allQuestions');
    if (!allQuestionsJSON) {
        handleFatalError("Dati del quiz non trovati. Per favore, torna alla dashboard.");
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
        if (!examQuestionIdsJSON) { handleFatalError("Nessuna sessione d'esame trovata."); return; }
        const examQuestionIds = JSON.parse(examQuestionIdsJSON);
        questionsToAsk = allQuestions.filter(q => examQuestionIds.includes(q.id));
        localStorage.removeItem('examSession_questionIds');
    } else if (mode === 'srs') {
        quizTitle = "Ripasso Intelligente (SRS)";
        const srsData = getSrsData();
        const today = new Date().toISOString().split('T')[0];
        const dueQuestionIds = Object.keys(srsData).filter(id => srsData[id].nextReview <= today).map(id => Number(id));
        questionsToAsk = allQuestions.filter(q => dueQuestionIds.includes(q.id));
        if (questionsToAsk.length === 0) { handleFatalError("Nessuna domanda in scadenza per oggi."); return; }
    } else if (mode === 'errors') {
        quizTitle = "Allenamento sugli Errori";
        const errorDeckIds = getErrorDeck();
        questionsToAsk = allQuestions.filter(q => errorDeckIds.includes(q.id));
        if (questionsToAsk.length === 0) { handleFatalError("Il tuo 'Mazzo degli Errori' è vuoto."); return; }
    } else if (categoryName) {
        const submode = urlParams.get('submode');
        quizTitle = `Quiz: ${categoryName}`;
        const questionsForCategory = allQuestions.filter(q => q.categoria === categoryName);
        
        if (submode === 'all') {
            questionsToAsk = questionsForCategory;
        } else {
            questionsToAsk = questionsForCategory.filter(q => !q.isCorrect);
            if (questionsToAsk.length === 0) {
                alert("Nessun errore in questa categoria! Ripassa tutte le domande.");
                questionsToAsk = questionsForCategory;
            }
        }
    } else {
        handleFatalError("Nessuna modalità o categoria specificata.");
        return;
    }

    startQuiz(questionsToAsk, quizTitle);
    setupQuizEventListeners();
});

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
    else handleFatalError("Nessuna domanda trovata per questa modalità.");
}

function startTimer() {
    const timerDisplay = document.getElementById('timer-display');
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
    document.getElementById('options-container').addEventListener('click', (e) => { if (e.target.tagName === 'BUTTON') handleAnswer(e.target); });
    document.getElementById('next-question-btn').addEventListener('click', () => {
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
                recordStudySession(currentQuizQuestions.length);
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

function handleAnswer(selectedButton) {
    const mode = new URLSearchParams(window.location.search).get('mode');
    const question = currentQuizQuestions[currentQuestionIndex];
    const selectedOption = selectedButton.dataset.option;
    
    if (mode === 'exam') {
        if (selectedButton.classList.contains('active')) return; // Non fare nulla se si riclicca lo stesso bottone

        userExamAnswers[question.id] = selectedOption;
        
        document.querySelectorAll('#options-container .btn').forEach(btn => btn.classList.remove('active'));
        selectedButton.classList.add('active');
        
        document.getElementById('next-question-btn').classList.remove('d-none');

    } else {
        if (selectedButton.disabled) return; // Sicurezza extra per modalità studio

        const isCorrect = selectedOption === question.soluzione;
        updateLearningState(question.id, isCorrect);

        const allOptionButtons = document.querySelectorAll('#options-container .btn');
        allOptionButtons.forEach(btn => btn.disabled = true);

        if (isCorrect) {
            selectedButton.classList.replace('btn-outline-primary', 'btn-success');
            document.getElementById('feedback-container').innerHTML = `<div class="alert alert-success">Corretto!</div>`;
        } else {
            selectedButton.classList.replace('btn-outline-primary', 'btn-danger');
            document.getElementById('feedback-container').innerHTML = `<div class="alert alert-danger">Sbagliato. La risposta corretta era: <strong>${question.soluzione}</strong></div>`;
            allOptionButtons.forEach(btn => {
                if (btn.dataset.option === question.soluzione) {
                    btn.classList.replace('btn-outline-primary', 'btn-success');
                }
            });
        }

        document.getElementById('explanation-text').textContent = question.spiegazione;
        document.getElementById('ripasso-text').textContent = `Riferimento: ${question.ripasso}`;
        document.getElementById('explanation-container').classList.remove('d-none');
        document.getElementById('next-question-btn').classList.remove('d-none');
    }
}