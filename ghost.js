
/* ===== GHOST MODE ===== */

// Elements
const difficulty = document.getElementById("difficulty");
const playerPassage = document.getElementById("player-passage");
const ghostPassage = document.getElementById("ghost-passage");

const playerInput = document.getElementById("player-input");
const pasteWarning = document.createElement("p");

pasteWarning.id = "paste-warning";
pasteWarning.className = "paste-warning";
pasteWarning.textContent =
    "Pasting doesn't qualify you for a win. Type the full passage manually to complete the race.";

pasteWarning.hidden = true;

playerInput.insertAdjacentElement("afterend", pasteWarning);

const playerWpm = document.getElementById("player-wpm");
const playerAccuracy = document.getElementById("player-accuracy");
const ghostWpm = document.getElementById("ghost-wpm");
const ghostAccuracy = document.getElementById("ghost-accuracy");

const playerProgress = document.getElementById("player-progress");
const ghostProgress = document.getElementById("ghost-progress");

const startBtn = document.getElementById("start-ghost-btn");
const resetBtn = document.getElementById("reset-ghost-btn");
const message = document.getElementById("ghost-message");
const themeBtn = document.getElementById("theme-btn");
const raceTimer = document.getElementById("race-timer");
const raceTimerContainer = document.getElementById("race-timer-container");
const raceResults = document.getElementById("race-results");
const winnerHeading = document.getElementById("winner-heading");

const playerFinalWpm = document.getElementById("player-final-wpm");
const playerFinalAccuracy = document.getElementById("player-final-accuracy");
const playerFinalScore = document.getElementById("player-final-score");

const ghostFinalWpm = document.getElementById("ghost-final-wpm");
const ghostFinalAccuracy = document.getElementById("ghost-final-accuracy");
const ghostFinalScore = document.getElementById("ghost-final-score");

const completionStatus = document.getElementById("completion-status");
const timeDifference = document.getElementById("time-difference");

// Typing passages
const passages = [
    "Practice makes progress. Keep typing and improve your speed every day.",
    "Technology makes our lives easier and connects people around the world.",
    "Success comes from patience, practice and the determination to keep learning.",
    "A journey of a thousand miles begins with a single step."
];

let previousInputValue = "";
let pendingInput = null;
let pendingPaste = null;

let passage = "";
let startTime = 0;

let playerAttempts = 0;
let playerWpmAttempts = 0;
let playerMistakes = 0;
let playerManualCharacters = [];

let ghostAttempts = 0;
let ghostMistakes = 0;

let running = false;
let timeLeft = 30;
let timerInterval = null;

let playerFinished = false;
let ghostFinished = false;
let raceEnded = false;

let playerFinishTime = null;
let ghostFinishTime = null;
let targetWpm = 0;

let simulationId = 0;

// Difficulty settings


const levels = {
    beginner: { wpm: 25, accuracy: 98 },
    intermediate: { wpm: 45, accuracy: 94 },
    advanced: { wpm: 70, accuracy: 88 }
};

function getDifficultySettings() {
    if (difficulty.value === "personal-best") {
        const bestWPM = Number(
            localStorage.getItem("keyrush-best-wpm")
        );

        const bestAccuracy = Number(
            localStorage.getItem("keyrush-best-accuracy")
        );

        if (!bestWPM) return null;

        return {
            wpm: Math.min(bestWPM * 0.85, 60),
            accuracy: bestAccuracy || 98
        };
    }

    return levels[difficulty.value];
}

function updateDifficultySelection() {
    const settings = getDifficultySettings();

    if (!settings) {
        message.textContent =
            "No Personal Best record found. Complete a typing test first!";
        message.classList.remove("hidden");
        startBtn.disabled = true;
    } else {
        message.classList.add("hidden");

        if (!running) {
            startBtn.disabled = false;
        }
    }
}

difficulty.addEventListener("change", updateDifficultySelection);

// Display passage as characters
function renderPassage(element, text) {
    element.innerHTML = "";

    for (const character of text) {
        const span = document.createElement("span");
        span.className = "char";
        span.textContent = character;
        element.appendChild(span);
    }
}

/*
 * Prepare the next passage as soon as Ghost Mode opens.
 * The player can inspect the text before starting the timed race.
 */
function preparePassage() {
    passage = passages[Math.floor(Math.random() * passages.length)];
    playerInput.maxLength = passage.length;

    renderPassage(playerPassage, passage);
    renderPassage(ghostPassage, passage);

    const firstPlayerCharacter = playerPassage.querySelector(".char");
    const firstGhostCharacter = ghostPassage.querySelector(".char");

    if (firstPlayerCharacter) {
        firstPlayerCharacter.classList.add("current");
    }

    if (firstGhostCharacter) {
        firstGhostCharacter.classList.add("current");
    }
}

// Calculate WPM
function calculateWPM(attempts, elapsed) {
    const minutes = elapsed / 60000;

    if (minutes <= 0) return 0;

    return Math.round((attempts / 5) / minutes);
}

// Calculate accuracy
function calculateAccuracy(attempts, mistakes) {
    if (attempts === 0) {
        return 0;
    }

    return ((attempts - mistakes) / attempts) * 100;
}

// Update player display
function updatePlayer() {
    const typed = playerInput.value;
    const characters = playerPassage.querySelectorAll(".char");

    characters.forEach((span, index) => {
    span.classList.remove("correct", "wrong", "current");

    if (index < typed.length) {
        if (typed[index] === passage[index]) {
            span.classList.add("correct");
        } else {
            span.classList.add("wrong");
        }
    }
});

// Show cursor at the next character
if (typed.length < passage.length) {
    characters[typed.length].classList.add("current");
}
    const elapsed = Date.now() - startTime;

    playerWpm.textContent = calculateWPM(playerWpmAttempts, elapsed);
    playerAccuracy.textContent =
        calculateAccuracy(playerAttempts, playerMistakes) + "%";

    playerProgress.textContent =
        Math.round((typed.length / passage.length) * 100) + "%";

    const entirePassageTypedManually =
    playerManualCharacters.length === passage.length &&
    playerManualCharacters.every(Boolean);

if (
    typed === passage &&
    entirePassageTypedManually
) {
    playerFinished = true;
    playerFinishTime = Date.now() - startTime;

    playerInput.disabled = true;

    message.textContent = ghostFinished
    ? "Both you and the ghost completed the passage!"
    : "You completed the passage! Ghost is still typing.";

    message.classList.remove("hidden");

    if (ghostFinished) {
        endRace();
    }
}
}




// ===== PLAYER ACCURACY TRACKING =====

// Fallback: identify the changed portion if beforeinput
// information is unavailable.
function getTextChange(oldValue, newValue) {
    let start = 0;

    while (
        start < oldValue.length &&
        start < newValue.length &&
        oldValue[start] === newValue[start]
    ) {
        start++;
    }

    let oldEnd = oldValue.length;
    let newEnd = newValue.length;

    while (
        oldEnd > start &&
        newEnd > start &&
        oldValue[oldEnd - 1] === newValue[newEnd - 1]
    ) {
        oldEnd--;
        newEnd--;
    }

    return {
        index: start,
        removedLength: oldEnd - start,
        text: newValue.slice(start, newEnd)
    };
}

// Record the selection and input type before an edit.
playerInput.addEventListener("beforeinput", (event) => {
    pendingInput = {
        start: playerInput.selectionStart,
        end: playerInput.selectionEnd,
        inputType: event.inputType,
        data: event.data
    };

    // Keep paste information only for a paste operation.
    if (event.inputType !== "insertFromPaste") {
        pendingPaste = null;
    }
});

// Capture pasted text and the selection it replaces.
playerInput.addEventListener("paste", (event) => {
    pendingPaste = {
        text: event.clipboardData.getData("text"),
        start: playerInput.selectionStart,
        end: playerInput.selectionEnd
    };
});

// Process the actual change after the browser updates the textarea.
playerInput.addEventListener("input", () => {
    const oldValue = previousInputValue;
    const newValue = playerInput.value;

    if (!running) {
        previousInputValue = newValue;
        pendingInput = null;
        pendingPaste = null;
        return;
    }

    const edit = pendingInput;

    let change;

    // Use the original selection for insertion and replacement.
    if (
        edit &&
        typeof edit.inputType === "string" &&
        edit.inputType.startsWith("insert")
    ) {
        const removedLength = edit.end - edit.start;

        const insertedLength = Math.max(
            0,
            newValue.length -
            (oldValue.length - removedLength)
        );

        change = {
            index: edit.start,
            removedLength: removedLength,
            text: newValue.slice(
                edit.start,
                edit.start + insertedLength
            )
        };
    } else {
        // Handle deletion and browser fallback.
        change = getTextChange(oldValue, newValue);
    }

    const insertedText = change.text;
    const insertionIndex = change.index;

    const isPaste =
        (edit && edit.inputType === "insertFromPaste") ||
        pendingPaste !== null;

    if (isPaste) {
        pasteWarning.hidden = false;
    }

    // Only actual manual typing counts towards completion and WPM.
    const isManualInsertion =
        !isPaste &&
        (
            !edit ||
            edit.inputType === "insertText" ||
            edit.inputType === "insertCompositionText"
        );

    // Update the manual-origin tracking for the current input.
    playerManualCharacters.splice(
        change.index,
        change.removedLength,
        ...Array(insertedText.length).fill(isManualInsertion)
    );

    // Count inserted characters for accuracy and WPM.
    for (let i = 0; i < insertedText.length; i++) {
        playerAttempts++;

        if (isManualInsertion) {
            playerWpmAttempts++;
        }

        if (
            insertedText[i] !== passage[insertionIndex + i]
        ) {
            playerMistakes++;
        }
    }

    previousInputValue = newValue;
    pendingInput = null;
    pendingPaste = null;

    updatePlayer();
});


// Wait for a specified time
function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Ghost typing simulation
async function startGhost(id) {
    const settings = getDifficultySettings();

    if (!settings) return;

    const characters = ghostPassage.querySelectorAll(".char");

    for (let i = 0; i < passage.length; i++) {

       if (id !== simulationId || !running) return;

        // Calculate typing delay from target WPM
        const baseDelay = 60000 / (settings.wpm * 5);
        const delay = baseDelay * (0.85 + Math.random() * 0.3);

        await wait(delay);

        if (id !== simulationId || !running) return;

        ghostAttempts++;

        // Simulate an occasional typing mistake
        const makesMistake = Math.random() * 100 > settings.accuracy;

        if (makesMistake) {
    ghostMistakes++;

    characters[i].classList.add("wrong");
    characters[i].textContent = "✕";

    await wait(250);

    if (id !== simulationId || !running) return;

    ghostAttempts++; // Count the corrected character as another attempt
}
        // Correct character appears
        characters[i].textContent = passage[i];
        characters[i].classList.remove("wrong");
        characters[i].classList.add("correct");
        // Move ghost cursor forward
        characters.forEach(char => char.classList.remove("current"));

        if (i + 1 < passage.length) {
    characters[i + 1].classList.add("current");
        }

        const elapsed = Date.now() - startTime;

        ghostWpm.textContent = calculateWPM(ghostAttempts, elapsed);
        ghostAccuracy.textContent =
            calculateAccuracy(ghostAttempts, ghostMistakes) + "%";

        ghostProgress.textContent =
            Math.round(((i + 1) / passage.length) * 100) + "%";
    }

    if (id === simulationId && running) {
    ghostFinished = true;
    ghostFinishTime = Date.now() - startTime;

    message.classList.remove("hidden");

    message.textContent = playerFinished
    ? "Both you and the ghost completed the passage!"
    : "Ghost completed the passage! You can continue typing.";  

    if (playerFinished) {
        endRace();
    }
}
}

// Start Ghost Mode
startBtn.addEventListener("click", () => {
    const settings = getDifficultySettings();

    if (!settings) {
        updateDifficultySelection();
        return;
    }

    // Keep the passage that was preloaded when this page opened.
    resetGame({ preservePassage: true });

    if (!passage) {
        preparePassage();
    }

    playerInput.maxLength = passage.length;
    targetWpm = settings.wpm;

    running = true;
    startTime = Date.now();

    playerInput.disabled = false;
    difficulty.disabled = true;
    playerInput.focus();

    startBtn.disabled = true;
    message.classList.add("hidden");

    startRaceTimer();

    const currentId = simulationId;
    startGhost(currentId);
});

function startRaceTimer() {
    raceTimerContainer.hidden = false;
    timeLeft = 30;
    raceTimer.textContent = timeLeft;

    timerInterval = setInterval(() => {
        timeLeft--;
        raceTimer.textContent = timeLeft;

        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            timerInterval = null;
            endRace();
        }
    }, 1000);
}
function calculateFinalScore(
    wpmAttempts,
    accuracyAttempts,
    mistakes,
    elapsed
) {
    const wpm = calculateWPM(wpmAttempts, elapsed);
    const accuracy = calculateAccuracy(accuracyAttempts, mistakes);

    const normalizedWpm = Math.min(
    (wpm / targetWpm) * 100,
    100
);

    const score = (0.70 * normalizedWpm) + (0.30 * accuracy);

    return { wpm, accuracy, score };
}

function endRace() {
    if (raceEnded) return;

    raceEnded = true;
    running = false;

    clearInterval(timerInterval);
    timerInterval = null;

    // Stop any remaining ghost typing
    simulationId++;

    playerInput.disabled = true;
    difficulty.disabled = false;
    startBtn.disabled = false;

    const elapsed = Date.now() - startTime;

    const playerTime = playerFinishTime ?? elapsed;
    const ghostTime = ghostFinishTime ?? elapsed;

    const playerResult = calculateFinalScore(
    playerWpmAttempts,
    playerAttempts,
    playerMistakes,
    playerTime
);


    const ghostResult = calculateFinalScore(
    ghostAttempts,
    ghostAttempts,
    ghostMistakes,
    ghostTime
);

    playerFinalWpm.textContent = playerResult.wpm;
    playerFinalAccuracy.textContent = playerResult.accuracy.toFixed(1) + "%";
    playerFinalScore.textContent = playerResult.score.toFixed(2);

    ghostFinalWpm.textContent = ghostResult.wpm;
    ghostFinalAccuracy.textContent = ghostResult.accuracy.toFixed(1) + "%";
    ghostFinalScore.textContent = ghostResult.score.toFixed(2);

    if (playerFinished && !ghostFinished) {
        winnerHeading.textContent = "YOU WIN!";
    } else if (ghostFinished && !playerFinished) {
        winnerHeading.textContent = "GHOST WINS!";
    } else if (playerResult.score > ghostResult.score) {
        winnerHeading.textContent = "YOU WIN!";
    } else if (ghostResult.score > playerResult.score) {
        winnerHeading.textContent = "GHOST WINS!";
    } else {
        winnerHeading.textContent = "IT'S A DRAW!";
    }

    if (playerFinished && ghostFinished) {
    completionStatus.textContent =
        "Completion time difference: " +
        (Math.abs(playerFinishTime - ghostFinishTime) / 1000).toFixed(2) +
        " seconds";
} else {
    completionStatus.textContent = "";
}

timeDifference.textContent = "";
    raceResults.classList.remove("hidden");

    message.textContent = `RACE COMPLETE — ${winnerHeading.textContent} See the final scores below.`;
    message.classList.remove("hidden");

    requestAnimationFrame(() => {
        const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        raceResults.scrollIntoView({
            behavior: reducedMotion ? "auto" : "smooth",
            block: "nearest"
        });
    });

    recordCompletedRaceAnalytics({
        wpm: playerResult.wpm,
        accuracy: Number(playerResult.accuracy.toFixed(1)),
        score: Number(playerResult.score.toFixed(2)),
        difficulty: difficulty.value,
        outcome: winnerHeading.textContent
    });
}
// Reset game
function resetGame({ preservePassage = false } = {}) {
    simulationId++;

    clearInterval(timerInterval);
    timerInterval = null;

    running = false;
    raceEnded = false;

    playerFinished = false;
    ghostFinished = false;

    playerFinishTime = null;
    ghostFinishTime = null;

    timeLeft = 30;
    raceTimer.textContent = "30";
    raceTimerContainer.hidden = true;

    playerAttempts = 0;
    playerMistakes = 0;
    playerWpmAttempts = 0;
    playerManualCharacters = [];
    pasteWarning.hidden = true;
    previousInputValue = "";
    pendingInput = null;
    pendingPaste = null;

    ghostAttempts = 0;
    ghostMistakes = 0;

    playerInput.value = "";
    playerInput.disabled = true;

    playerWpm.textContent = "0";
    playerAccuracy.textContent = "0%";


    ghostWpm.textContent = "0";
    ghostAccuracy.textContent = "0%";

    playerProgress.textContent = "0%";
    ghostProgress.textContent = "0%";

    if (preservePassage && passage) {
        playerPassage.querySelectorAll(".char").forEach(character => {
            character.className = "char";
        });
        ghostPassage.querySelectorAll(".char").forEach(character => {
            character.className = "char";
        });

        const firstPlayerCharacter = playerPassage.querySelector(".char");
        const firstGhostCharacter = ghostPassage.querySelector(".char");

        if (firstPlayerCharacter) {
            firstPlayerCharacter.classList.add("current");
        }

        if (firstGhostCharacter) {
            firstGhostCharacter.classList.add("current");
        }
    } else {
        passage = "";
        playerPassage.innerHTML = "";
        ghostPassage.innerHTML = "";
        preparePassage();
    }

    difficulty.disabled = false;
    startBtn.disabled = false;

    message.textContent = "";
    message.classList.add("hidden");

    raceResults.classList.add("hidden");

    updateDifficultySelection();
}

// Reset button
resetBtn.addEventListener("click", resetGame);

// Theme toggle
themeBtn.addEventListener("click", () => {
    document.body.classList.toggle("light-mode");

    themeBtn.textContent =
        document.body.classList.contains("light-mode")
            ? "☾ Dark mode"
            : "☼ Light mode";

    const api = getGhostAnalyticsApi();
    if (api) {
        drawGhostHistoryChart(
            api.loadGhostAnalytics(typeof localStorage !== "undefined" ? localStorage : null).history
        );
    }
});
updateDifficultySelection();
preparePassage();

// ===== GHOST PERFORMANCE ANALYTICS =====

function getGhostAnalyticsApi() {
    return typeof window !== "undefined" && window.GhostAnalytics
        ? window.GhostAnalytics
        : null;
}

function getCssToken(name, fallback) {
    if (typeof getComputedStyle !== "function") return fallback;
    const val = getComputedStyle(document.body).getPropertyValue(name).trim();
    return val || fallback;
}

function drawGhostHistoryChart(history) {
    const canvas = document.getElementById("ghost-wpm-chart");
    const emptyState = document.getElementById("ghost-chart-empty");
    if (!canvas) return;

    if (!history || history.length === 0) {
        canvas.hidden = true;
        if (emptyState) emptyState.hidden = false;
        return;
    }

    canvas.hidden = false;
    if (emptyState) emptyState.hidden = true;

    if (typeof canvas.getContext !== "function") return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width || 820;
    const height = canvas.height || 220;
    const pad = { top: 22, right: 24, bottom: 32, left: 44 };
    const plotW = width - pad.left - pad.right;
    const plotH = height - pad.top - pad.bottom;

    const gridColor = getCssToken("--border", "#30363d");
    const mutedColor = getCssToken("--muted", "#8b949e");
    const accentColor = getCssToken("--accent", "#c3e826");
    const textColor = getCssToken("--text", "#e6edf3");
    const winColor = getCssToken("--correct", "#3fb950");

    ctx.clearRect(0, 0, width, height);

    const maxWpm = Math.max(40, ...history.map((r) => r.wpm));
    const yCeiling = Math.ceil(maxWpm / 20) * 20;

    ctx.font = "600 11px ui-monospace, SFMono-Regular, Consolas, monospace";
    ctx.textBaseline = "middle";

    const steps = 4;
    for (let i = 0; i <= steps; i++) {
        const value = Math.round((yCeiling / steps) * i);
        const y = pad.top + plotH - (plotH * i) / steps;

        ctx.strokeStyle = gridColor;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(pad.left, y);
        ctx.lineTo(pad.left + plotW, y);
        ctx.stroke();

        ctx.fillStyle = mutedColor;
        ctx.textAlign = "right";
        ctx.fillText(String(value), pad.left - 8, y);
    }

    const points = history.map((item, idx) => {
        const x = history.length === 1
            ? pad.left + plotW / 2
            : pad.left + (plotW * idx) / (history.length - 1);
        const y = pad.top + plotH - (item.wpm / yCeiling) * plotH;
        return { x, y, item, label: `#${idx + 1}` };
    });

    if (points.length > 1) {
        ctx.strokeStyle = accentColor;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        points.forEach((pt, idx) => {
            if (idx === 0) ctx.moveTo(pt.x, pt.y);
            else ctx.lineTo(pt.x, pt.y);
        });
        ctx.stroke();
    }

    points.forEach((pt) => {
        ctx.fillStyle = pt.item.outcome === "YOU WIN!" ? winColor : accentColor;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 4.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = textColor;
        ctx.textAlign = "center";
        ctx.fillText(`${pt.item.wpm}`, pt.x, Math.max(pad.top - 10, pt.y - 12));

        ctx.fillStyle = mutedColor;
        ctx.fillText(pt.label, pt.x, pad.top + plotH + 16);
    });
}

function renderGhostAnalytics({ showNewBest = false } = {}) {
    const api = getGhostAnalyticsApi();
    if (!api) return;

    const summary = api.loadGhostAnalytics(typeof localStorage !== "undefined" ? localStorage : null);
    const bestWpmEl = document.getElementById("ghost-stat-best-wpm");
    const avgWpmEl = document.getElementById("ghost-stat-avg-wpm");
    const bestAccEl = document.getElementById("ghost-stat-best-accuracy");
    const totalRacesEl = document.getElementById("ghost-stat-total-races");
    const pbBadgeEl = document.getElementById("ghost-new-pb-badge");

    if (bestWpmEl) bestWpmEl.textContent = String(summary.bestWpm);
    if (avgWpmEl) avgWpmEl.textContent = String(summary.averageWpm);
    if (bestAccEl) bestAccEl.textContent = `${summary.bestAccuracy}%`;
    if (totalRacesEl) totalRacesEl.textContent = String(summary.totalRaces);
    if (pbBadgeEl) pbBadgeEl.classList.toggle("hidden", !showNewBest);

    drawGhostHistoryChart(summary.history);
}

function recordCompletedRaceAnalytics(raceEntry) {
    const api = getGhostAnalyticsApi();
    if (!api) return;

    const storage = typeof localStorage !== "undefined" ? localStorage : null;
    const updated = api.recordGhostRace(storage, raceEntry);
    renderGhostAnalytics({ showNewBest: Boolean(updated && updated.isNewBestWpm) });
}

const clearAnalyticsBtn = document.getElementById("clear-ghost-analytics-btn");
if (clearAnalyticsBtn) {
    clearAnalyticsBtn.addEventListener("click", () => {
        const api = getGhostAnalyticsApi();
        if (!api) return;
        api.clearGhostAnalytics(typeof localStorage !== "undefined" ? localStorage : null);
        renderGhostAnalytics({ showNewBest: false });
    });
}

renderGhostAnalytics();

// ===== RULES POPUP =====

const rulesBtn = document.getElementById("rules-btn");
const rulesModal = document.getElementById("rules-modal");
const closeRulesBtn = document.getElementById("close-rules-btn");

rulesBtn.addEventListener("click", () => {
    rulesModal.hidden = false;
    closeRulesBtn.focus();
});

closeRulesBtn.addEventListener("click", () => {
    rulesModal.hidden = true;
    rulesBtn.focus();
});

// Close when clicking outside the popup
rulesModal.addEventListener("click", (event) => {
    if (event.target === rulesModal) {
        rulesModal.hidden = true;
        rulesBtn.focus();
    }
});

// Close using Escape
document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !rulesModal.hidden) {
        rulesModal.hidden = true;
        rulesBtn.focus();
    }
});