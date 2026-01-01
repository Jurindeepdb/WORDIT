// Frontend that talks to the backend API (Login & Create Account split)
let user = null;           // holds user object after login/create
let currentRow = 0;
let currentCol = 0;
const MAX_ROWS = 5;
const MAX_COLS = 5;
let grid = [];
let errorTimeout = null;

// DOM refs
const errorDiv = document.getElementById("error");
const gridDiv = document.getElementById("grid");
const keyboardDiv = document.getElementById("keyboard");
const loginDiv = document.getElementById("login");
const loginBtn = document.getElementById("loginBtn");
const createBtn = document.getElementById("createBtn");
const usernameInput = document.getElementById("username");
const playerInfoDiv = document.getElementById("player-info");
const playerNameDiv = document.getElementById("player-name");

const resultsDiv = document.getElementById("results");
const resultMsgH2 = document.getElementById("result-msg");
const resTotal = document.getElementById("res-total");
const resStreak = document.getElementById("res-streak");
const d1 = document.getElementById("d1");
const d2 = document.getElementById("d2");
const d3 = document.getElementById("d3");
const d4 = document.getElementById("d4");
const d5 = document.getElementById("d5");
const correctWordSpan = document.getElementById("correct-word");
const nextBtn = document.getElementById("nextBtn");

// IMPORTANT: the output area that should be toggled (contains correct-word + Next)
const outputDiv = document.getElementById("output");

// Track whether the name input is focused (so typing into it is allowed)
let nameFieldFocused = false;

// Hide results at initial load
if (resultsDiv) resultsDiv.style.display = "none";
if (outputDiv) outputDiv.style.display = "none";

/* ---------- Utility: robust fetch that returns parsed JSON or raw text ---------- */
async function fetchJson(url, options) {
    try {
        const res = await fetch(url, options);
        const text = await res.text();
        let data;
        try {
            data = text ? JSON.parse(text) : {};
        } catch (err) {
            data = { error: text };
        }
        return { ok: res.ok, status: res.status, data };
    } catch (err) {
        // network-level error
        return { ok: false, status: 0, data: { error: String(err) } };
    }
}

/* ---------- Error box helpers ---------- */
function showError(msg) {
    if (errorTimeout) {
        clearTimeout(errorTimeout);
        errorTimeout = null;
    }
    errorDiv.innerText = msg;
    errorDiv.classList.add("active");

    errorTimeout = setTimeout(() => {
        if (errorDiv.innerText === msg) {
            errorDiv.innerText = "";
            errorDiv.classList.remove("active");
        }
        errorTimeout = null;
    }, 3000);
}

function clearErrorImmediate() {
    if (errorTimeout) {
        clearTimeout(errorTimeout);
        errorTimeout = null;
    }
    errorDiv.innerText = "";
    errorDiv.classList.remove("active");
}

/* ---------- Histogram / results population ---------- */
function populateResultsFromUser(u) {
    if (!u) return;
    if (resultsDiv) resultsDiv.style.display = "block";

    resTotal.innerText = u.total_solved || 0;
    resStreak.innerText = u.streak || 0;

    // counts array (1..5)
    const counts = [
        u.solved_1 || 0,
        u.solved_2 || 0,
        u.solved_3 || 0,
        u.solved_4 || 0,
        u.solved_5 || 0
    ];

    // find max for scaling (avoid division by zero)
    const maxCount = Math.max(...counts, 1);

    for (let i = 0; i < 5; i++) {
        const count = counts[i];
        const numEl = document.getElementById(`d${i+1}`);
        const barEl = document.getElementById(`bar${i+1}`);

        if (numEl) numEl.innerText = String(count);
        if (!barEl) {
            // missing bar element — warn and continue
            // console.warn(`Missing bar element: bar${i+1}`);
            continue;
        }

        if (count === 0) {
            barEl.classList.add("zero");
            barEl.style.width = "0%";
        } else {
            barEl.classList.remove("zero");
            let pct = (count / maxCount) * 100;
            const minPct = 6; // ensure tiny counts are still visible
            if (pct > 0 && pct < minPct) pct = minPct;
            barEl.style.width = `${pct}%`;
        }
    }
}

/* ---------- Login / Create logic (uses fetchJson) ---------- */
loginBtn.addEventListener("click", async () => {
    const name = usernameInput.value.trim();
    if (!name) {
        showError("Please enter your name");
        return;
    }

    const r = await fetchJson("/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name })
    });

    if (!r.ok) {
        showError(r.data.error || `Login failed (${r.status})`);
        return;
    }

    user = r.data.user;
    clearErrorImmediate();
    showPlayerInfo();
    populateResultsFromUser(user);
    startGame();
});

createBtn.addEventListener("click", async () => {
    const name = usernameInput.value.trim();
    if (!name) {
        showError("Please enter your name");
        return;
    }

    const r = await fetchJson("/create_user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name })
    });

    if (!r.ok) {
        showError(r.data.error || `Create account failed (${r.status})`);
        return;
    }

    user = r.data.user;
    clearErrorImmediate();
    showPlayerInfo();
    populateResultsFromUser(user);
    startGame();
});

// allow Enter in username input to trigger Login (convenience)
usernameInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
        e.preventDefault();
        loginBtn.click();
    }
});

// clear error while typing name
usernameInput.addEventListener("input", () => {
    if (usernameInput.value.trim().length > 0) {
        clearErrorImmediate();
    }
});

// disable global error when the name input is focused
usernameInput.addEventListener("focus", () => {
    nameFieldFocused = true;
    clearErrorImmediate();
});
usernameInput.addEventListener("blur", () => {
    nameFieldFocused = false;
});

function showPlayerInfo() {
    loginDiv.style.display = "none";
    playerInfoDiv.style.display = "block";
    playerNameDiv.innerText = `Player: ${user.name}`;
}

/* ---------- Grid & keyboard ---------- */
function buildGrid() {
    gridDiv.innerHTML = "";
    grid = [];
    for (let r = 0; r < MAX_ROWS; r++) {
        const row = document.createElement("div");
        row.className = "row";
        grid[r] = [];
        for (let c = 0; c < MAX_COLS; c++) {
            const cell = document.createElement("div");
            cell.className = "cell";
            cell.setAttribute("data-r", r);
            cell.setAttribute("data-c", c);
            row.appendChild(cell);
            grid[r].push(cell);
        }
        gridDiv.appendChild(row);
    }
    currentRow = 0;
    currentCol = 0;
}

const row1 = "QWERTYUIOP".split("");
const row2 = "ASDFGHJKL".split("");
const row3 = "ZXCVBNM".split("");

function buildKeyboard() {
    keyboardDiv.innerHTML = "";

    const makeKey = (label, opts = {}) => {
        const key = document.createElement("div");
        key.className = "key";
        if (opts.wide) key.classList.add("wide");
        key.innerText = label;
        key.id = "key-" + label.toUpperCase();
        key.addEventListener("click", () => {
            if (!user) {
                showError("Please enter your name");
                return;
            }
            if (label.toLowerCase() === "enter") submitGuess();
            else if (label.toLowerCase() === "backspace") backspace();
            else handleKey(label.toUpperCase());
        });
        return key;
    };

    const r1 = document.createElement("div"); r1.className = "kb-row";
    row1.forEach(ch => r1.appendChild(makeKey(ch)));
    keyboardDiv.appendChild(r1);

    const r2 = document.createElement("div"); r2.className = "kb-row";
    r2.style.paddingLeft = "22px";
    row2.forEach(ch => r2.appendChild(makeKey(ch)));
    keyboardDiv.appendChild(r2);

    const r3 = document.createElement("div"); r3.className = "kb-row";
    r3.appendChild(makeKey("Enter", { wide: true }));
    row3.forEach(ch => r3.appendChild(makeKey(ch)));
    r3.appendChild(makeKey("Backspace", { wide: true }));
    keyboardDiv.appendChild(r3);
}

/* ---------- Keyboard & input handling ---------- */
document.addEventListener("keydown", (e) => {
    if (!user) {
        // allow typing into the name input when focused
        if (nameFieldFocused) return;
        const key = e.key;
        if (key === "Enter" || key === "Backspace" || /^[a-zA-Z]$/.test(key)) {
            e.preventDefault();
            showError("Please enter your name");
        }
        return;
    }

    if (e.key === "Enter") { submitGuess(); return; }
    if (e.key === "Backspace") { backspace(); return; }
    const letter = e.key.toUpperCase();
    if (/^[A-Z]$/.test(letter)) handleKey(letter);
});

function handleKey(letter) {
    if (!user) { showError("Please enter your name"); return; }
    if (currentRow >= MAX_ROWS) return;
    if (currentCol < MAX_COLS) {
        grid[currentRow][currentCol].innerText = letter;
        currentCol++;
    }
}

function backspace() {
    if (!user) { showError("Please enter your name"); return; }
    if (currentRow >= MAX_ROWS) return;
    if (currentCol > 0) {
        currentCol--;
        grid[currentRow][currentCol].innerText = "";
    }
}

/* ---------- Server interactions: start / check ---------- */
async function startGame() {
    if (!user) return;
    const r = await fetchJson("/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: user.id })
    });

    if (!r.ok) {
        showError(r.data.error || `Server error (${r.status})`);
        return;
    }

    // hide the end-of-round output area
    if (outputDiv) outputDiv.style.display = "none";
    correctWordSpan.innerText = "";

    buildGrid();
    buildKeyboard();
    clearErrorImmediate();
}

async function submitGuess() {
    if (!user) { showError("Please enter your name"); return; }
    if (currentCol !== MAX_COLS) {
        showError("Enter a 5-letter word");
        return;
    }
    const guess = grid[currentRow].map(cell => cell.innerText || "").join("").toLowerCase();

    const r = await fetchJson("/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: user.id, guess })
    });

    if (!r.ok) {
        showError(r.data.error || `Server error (${r.status})`);
        return;
    }

    const data = r.data;

    // apply colors
    if (Array.isArray(data.result)) {
        data.result.forEach((color, i) => {
            if (grid[currentRow] && grid[currentRow][i]) {
                grid[currentRow][i].classList.add(color);
            }
            updateKeyboard(guess[i].toUpperCase(), color);
        });
    }

    if (data.game_over) {
        showResults(data);
        if (data.stats) {
            user = data.stats;
            populateResultsFromUser(user);
        }
        return;
    }

    // move to next row
    currentRow++;
    currentCol = 0;
}

/* ---------- Keyboard color priority ---------- */
function updateKeyboard(letter, color) {
    if (!/^[A-Z]$/.test(letter)) return;
    const key = document.getElementById("key-" + letter);
    if (!key) return;
    const priority = { green: 3, yellow: 2, gray: 1 };
    const existing = key.classList.contains("green") ? "green"
                   : key.classList.contains("yellow") ? "yellow"
                   : key.classList.contains("gray") ? "gray" : null;

    if (!existing || priority[color] > priority[existing]) {
        key.classList.remove("green", "yellow", "gray");
        key.classList.add(color);
    }
}

/* ---------- Results display ---------- */
function showResults(data) {
    // reveal the output area (correct word + Next button)
    if (outputDiv) outputDiv.style.display = "block";

    resultMsgH2.innerText = data.message || (data.won ? "Congratulations!!!" : "Better luck next time <3");

    const statsSource = data.stats || user || {};

    // populate histogram and counters from statsSource
    populateResultsFromUser(statsSource);

    correctWordSpan.innerText = data.correct_word || "";

    // disable further typing until next
    currentRow = MAX_ROWS;
}
function logout() {
    window.location.href = "/logout";
}
/* ---------- Next button ---------- */
nextBtn.addEventListener("click", () => {
    if (outputDiv) outputDiv.style.display = "none";
    startGame();
});

// initial small UI build
buildGrid();
buildKeyboard();
