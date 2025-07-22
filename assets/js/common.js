/**
 * common.js - VERSIONE FINALE E CORRETTA
 * Esporta tutte le funzioni e costanti necessarie per gli altri moduli.
 */

import { auth, db } from './firebase-init.js';
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// =============================================================
// DATI E FUNZIONI DI BASE
// =============================================================

// AGGIUNTO 'export'
export const categoriesDescriptionsString = `
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

// in assets/js/common.js

export const tagDictionary = {
    'tenses': 'Tempi Verbali',
    'conditionals': 'Periodi Ipotetici',
    'conditionals-wishes': 'Periodi Ipotetici e Desideri',
    'conditional-type-1': 'Condizionale di Tipo 1',
    'conditional-type-2': 'Condizionale di Tipo 2',
    'conditional-type-3': 'Condizionale di Tipo 3',
    'mixed-conditional': 'Condizionale Misto',
    'wishes': 'Desideri (Wishes)',
    'if-only': 'If Only',
    'infinitive': 'Infinito',
    'bare-infinitive': 'Infinito senza "to"',
    'perfect-infinitive': 'Infinito Perfetto',
    'passive-infinitive': 'Infinito Passivo',
    'gerund': 'Gerundio',
    'passive-gerund': 'Gerundio Passivo',
    'verb-patterns': 'Verb Patterns',
    'passive-voice': 'Forma Passiva',
    'modal-passive': 'Forma Passiva con Modali',
    'future-passive': 'Forma Passiva al Futuro',
    'present-perfect-passive': 'Present Perfect Passivo',
    'present-continuous-passive': 'Present Continuous Passivo',
    'past-perfect-passive': 'Past Perfect Passivo',
    'past-continuous-passive': 'Past Continuous Passivo',
    'present-simple-passive': 'Present Simple Passivo',
    'reported-speech': 'Discorso Indiretto',
    'reported-question': 'Domande Indirette',
    'tense-backshift': 'Backshift dei Tempi',
    'modal-shift': 'Shift dei Modali',
    'modal-perfect': 'Modali Perfetti (es. would have)',
    'past-perfect': 'Past Perfect',
    'past-simple': 'Past Simple',
    'present-perfect': 'Present Perfect',
    'present-perfect-continuous': 'Present Perfect Continuous',
    'future-simple': 'Future Simple (will)',
    'be-going-to': 'Be going to',
    'modals': 'Verbi Modali',
    'modal-can': 'Modale "Can"',
    'modal-could': 'Modale "Could"',
    'modal-must': 'Modale "Must"',
    'modal-mustnt': 'Modale "Mustn\'t"',
    'modal-should': 'Modale "Should"',
    'modal-might': 'Modale "Might"',
    'modal-may': 'Modale "May"',
    'modal-of-deduction': 'Modali di Deduzione',
    'causative-structures': 'Strutture Causative',
    'causative-have-something-done': 'Causativo "Have something done"',
    'causative-get-something-done': 'Causativo "Get something done"',
    'causative-make': 'Causativo "Make"',
    'causative-let': 'Causativo "Let"',
    'causative-get': 'Causativo "Get"',
    'used-to': 'Used to (Abitudine Passata)',
    'be-used-to': 'Be Used to (Essere Abituati)',
    'used-to-vs-be-get-used-to': 'Used to vs Be/Get used to',
    'time-clauses': 'Proposizioni Temporali',
    'time-marker': 'Marcatore Temporale',
    'time-marker-since': 'Marcatore "Since"',
    'time-marker-for': 'Marcatore "For"',
    'time-marker-ago': 'Marcatore "Ago"',
    'time-marker-yesterday': 'Marcatore "Yesterday"',
    'time-marker-lately': 'Marcatore "Lately"',
    'time-marker-recently': 'Marcatore "Recently"',
    'time-marker-before': 'Marcatore "Before"',
    'prepositions': 'Preposizioni',
    'preposition-in': 'Preposizione "in"',
    'preposition-on': 'Preposizione "on"',
    'preposition-at': 'Preposizione "at"',
    'phrasal-verbs': 'Verbi Frasali',
    'phrasal-verb-look-after': 'Phrasal Verb "look after"',
    'phrasal-verb-look-for': 'Phrasal Verb "look for"',
    'phrasal-verb-look-into': 'Phrasal Verb "look into"',
    'vocabulary': 'Vocabolario',
    'confusing-words': 'Parole che generano confusione',
    'word-choice-rob': 'Scelta lessicale: rob',
    'word-choice-steal': 'Scelta lessicale: steal',
    'adjectives': 'Aggettivi',
    'adverbs': 'Avverbi',
    'adjective-order': 'Ordine degli Aggettivi',
    'comparatives': 'Comparativi',
    'superlatives': 'Superlativi',
    'nouns-pronouns-determiners': 'Nomi, Pronomi e Determinanti',
    'uncountable-nouns': 'Nomi non numerabili',
    'countable-nouns': 'Nomi numerabili',
    'articles': 'Articoli',
    'definite-article-the': 'Articolo Determinativo "the"',
    'zero-article': 'Articolo Zero',
    'quantifiers': 'Quantificatori',
    'conjunctions': 'Congiunzioni',
    'question-formation': 'Formulazione delle Domande',
    'question-tags': 'Question Tags'
};

// AGGIUNTO 'export'
export function parseDescriptions(text) {
    const descriptionMap = new Map();
    const lines = text.trim().split('\n');
    lines.forEach(line => {
        const parts = line.split(' ::: ');
        if (parts.length === 2) {
            descriptionMap.set(parts[0].trim(), parts[1].trim());
        }
    });
    return descriptionMap;
}

// AGGIUNTO 'export'
export async function loadData() {
    try {
        const [questionsResponse, performanceResponse] = await Promise.all([
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

// AGGIUNTO 'export'
export function processAndGetAllQuestions(questionsData, performanceCSV) {
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

// AGGIUNTO 'export'
export function calculateCategoryStats(allQuestions) {
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

// AGGIUNTO 'export'
export function getPerformanceBadge(errorRate) {
    if (errorRate > 50) return 'bg-danger';
    if (errorRate > 25) return 'bg-warning text-dark';
    return 'bg-success';
}

// ====================================================================
// FUNZIONI PER GESTIRE I DATI UTENTE SU FIRESTORE (già esportate)
// ====================================================================

export async function getUserProgress() {
    const user = auth.currentUser;
    if (!user) {
        console.log("Nessun utente loggato per recuperare i progressi.");
        return {};
    }
    const userProgressRef = doc(db, "userProgress", user.uid);
    const docSnap = await getDoc(userProgressRef);
    if (docSnap.exists()) {
        return docSnap.data();
    } else {
        return {
            srsData: {},
            errorDeck: [],
            studyHistory: {},
            userProfile: { lastStudyDay: null, streak: 0 }
        };
    }
}

export async function saveUserProgress(dataToSave) {
    const user = auth.currentUser;
    if (!user) {
        console.error("Nessun utente loggato per salvare i progressi.");
        return;
    }
    const userProgressRef = doc(db, "userProgress", user.uid);
    await setDoc(userProgressRef, dataToSave, { merge: true });
    console.log("Progressi salvati su Firestore:", dataToSave);
}

export async function getSrsData() {
    const progress = await getUserProgress();
    return progress.srsData || {};
}

export async function getErrorDeck() {
    const progress = await getUserProgress();
    return progress.errorDeck || [];
}

export async function getStudyHistory() {
    const progress = await getUserProgress();
    return progress.studyHistory || {};
}

export async function getUserProfile() {
    const progress = await getUserProgress();
    return progress.userProfile || { lastStudyDay: null, streak: 0 };
}

export async function updateLearningState(questionId, isCorrect) {
    const srsData = await getSrsData();
    const errorDeck = await getErrorDeck();
    if (!isCorrect) {
        if (!errorDeck.includes(questionId)) {
            errorDeck.push(questionId);
        }
    } else {
        // Se la risposta è corretta, rimuovi la domanda dal mazzo degli errori
        // quando raggiunge un livello SRS sufficientemente alto (livello 2 o superiore)
        const currentSrs = srsData[questionId] || { level: 0 };
        if (currentSrs.level >= 1) {
            const errorIndex = errorDeck.indexOf(questionId);
            if (errorIndex > -1) {
                errorDeck.splice(errorIndex, 1);
            }
        }
    }
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
    await saveUserProgress({ srsData: srsData, errorDeck: errorDeck });
}

export async function recordStudySession(questionsStudied) {
    if (questionsStudied === 0) return;
    const todayStr = new Date().toISOString().split('T')[0];
    const history = await getStudyHistory();
    const profile = await getUserProfile();
    if (!history[todayStr]) {
        history[todayStr] = { studied: 0 };
    }
    history[todayStr].studied += questionsStudied;
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
    }
    await saveUserProgress({ studyHistory: history, userProfile: profile });
}


// =============================================================
// FUNZIONI PER ANALISI INTELLIGENTE DEGLI ERRORI
// =============================================================

/**
 * Analizza tutte le domande sbagliate per trovare pattern di errore ricorrenti basati sui tag.
 * @param {Array} allQuestions - L'array di tutte le domande, ora con i tag.
 * @param {Array<number>} errorDeckIds - L'array degli ID delle domande sbagliate.
 * @returns {Array} Un array di oggetti che rappresentano i pattern di errore.
 */
// RI-AGGIUNGIAMO QUESTA FUNZIONE FONDAMENTALE
export function analyzeErrorPatterns(allQuestions, errorDeckIds) {
    const wrongQuestions = allQuestions.filter(q => errorDeckIds.includes(q.id));
    if (wrongQuestions.length < 5) return [];
    const tagPairData = {};
    wrongQuestions.forEach(q => {
        if (!q.tags || q.tags.length < 2) return;
        const tags = [...new Set(q.tags)].sort();
        for (let i = 0; i < tags.length; i++) {
            for (let j = i + 1; j < tags.length; j++) {
                const key = `${tags[i]}|${tags[j]}`;
                if (!tagPairData[key]) tagPairData[key] = { count: 0, questionIds: [] };
                tagPairData[key].count++;
                tagPairData[key].questionIds.push(q.id);
            }
        }
    });
    return Object.keys(tagPairData)
        .map(key => ({ tags: key.split('|'), count: tagPairData[key].count, questionIds: [...new Set(tagPairData[key].questionIds)] }))
        .filter(p => p.count >= 2).sort((a, b) => b.count - a.count);
}