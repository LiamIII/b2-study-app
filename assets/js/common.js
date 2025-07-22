/**
 * common.js - VERSIONE FINALE E CORRETTA
 * Corregge i percorsi dei file di dati per renderli relativi.
 */

// =============================================================
// FUNZIONI DI CARICAMENTO E PROCESSO DATI
// =============================================================

async function loadData() {
    try {
        const [questionsResponse, performanceResponse] = await Promise.all([
            // CORREZIONE: rimossi gli slash iniziali
            fetch('data/questions.json'),
            fetch('data/performance.csv')
        ]);
        if (!questionsResponse.ok || !performanceResponse.ok) {
            throw new Error("Errore nel caricamento dei file di dati.");
        }
        const questionsData = await questionsResponse.json();
        const performanceCSV = await performanceResponse.text();
        return [questionsData, performanceCSV];
    } catch (error) {
        console.error("Errore in loadData:", error);
        return [null, null];
    }
}

function processAndGetAllQuestions(questionsData, performanceCSV) {
    const performanceMap = new Map();
    const rows = performanceCSV.trim().split('\n');
    for (let i = 1; i < rows.length; i++) {
        const [id, isCorrectStr] = rows[i].split(',');
        if (id && isCorrectStr) {
            performanceMap.set(parseInt(id, 10), isCorrectStr.trim() === 'true');
        }
    }
    return questionsData.map(question => ({
        ...question,
        isCorrect: performanceMap.get(question.id) ?? false
    }));
}

function calculateCategoryStats(allQuestions) {
    const stats = {};
    allQuestions.forEach(question => {
        const category = question.categoria;
        if (!stats[category]) {
            stats[category] = { total: 0, correct: 0, incorrect: 0, questions: [] };
        }
        stats[category].total++;
        question.isCorrect ? stats[category].correct++ : stats[category].incorrect++;
        stats[category].questions.push(question);
    });

    return Object.keys(stats).map(categoryName => {
        const categoryData = stats[categoryName];
        const errorRate = categoryData.total > 0 ? (categoryData.incorrect / categoryData.total) * 100 : 0;
        return {
            name: categoryName,
            ...categoryData,
            errorRate: errorRate,
            successRate: 100 - errorRate,
            frequency: categoryData.total,
            priorityScore: errorRate * categoryData.total
        };
    });
}

function getPerformanceBadge(errorRate) {
    if (errorRate > 50) return 'bg-danger';
    if (errorRate > 25) return 'bg-warning text-dark';
    return 'bg-success';
}

// =============================================================
// FUNZIONI PER SPACED REPETITION (SRS) E MAZZO ERRORI
// =============================================================

function getSrsData() {
    const data = localStorage.getItem('srsData');
    return data ? JSON.parse(data) : {};
}

function saveSrsData(srsData) {
    localStorage.setItem('srsData', JSON.stringify(srsData));
}

function getErrorDeck() {
    const data = localStorage.getItem('errorDeck');
    return data ? JSON.parse(data).map(id => Number(id)) : [];
}

function saveErrorDeck(errorDeck) {
    localStorage.setItem('errorDeck', JSON.stringify(errorDeck));
}

function updateLearningState(questionId, isCorrect) {
    const srsData = getSrsData();
    const errorDeck = getErrorDeck();
    if (!isCorrect) {
        if (!errorDeck.includes(questionId)) {
            errorDeck.push(questionId);
        }
    }
    saveErrorDeck(errorDeck);
    const intervals = [1, 3, 7, 15, 30, 60];
    let currentSrs = srsData[questionId] || { level: 0 };
    if (isCorrect) {
        currentSrs.level = Math.min(currentSrs.level + 1, intervals.length - 1);
    } else {
        currentSrs.level = 0;
    }
    const daysToAdd = intervals[currentSrs.level];
    const nextReviewDate = new Date();
    nextReviewDate.setDate(nextReviewDate.getDate() + daysToAdd);
    currentSrs.nextReview = nextReviewDate.toISOString().split('T')[0];
    srsData[questionId] = currentSrs;
    saveSrsData(srsData);
}

// =============================================================
// FUNZIONI PER STORICO PROGRESSI E GAMIFICATION
// =============================================================

function getStudyHistory() {
    const data = localStorage.getItem('studyHistory');
    return data ? JSON.parse(data) : {};
}

function getUserProfile() {
    const data = localStorage.getItem('userProfile');
    return data ? JSON.parse(data) : { lastStudyDay: null, streak: 0 };
}

function recordStudySession(questionsStudied) {
    if (questionsStudied === 0) return;
    const todayStr = new Date().toISOString().split('T')[0];
    const history = getStudyHistory();
    if (!history[todayStr]) {
        history[todayStr] = { studied: 0 };
    }
    history[todayStr].studied += questionsStudied;
    localStorage.setItem('studyHistory', JSON.stringify(history));
    const profile = getUserProfile();
    if (profile.lastStudyDay !== todayStr) {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];
        if (profile.lastStudyDay === yesterdayStr) {
            profile.streak++;
        } else {
            profile.streak = 1;
        }
        profile.lastStudyDay = todayStr;
        localStorage.setItem('userProfile', JSON.stringify(profile));
    }
}