import { initializeApp } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js";
import {
    getDatabase,
    ref,
    onValue,
    set,
    push,
    update,
    remove,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.11.0/firebase-database.js";
import { firebaseConfig } from './firebaseConfig.js';

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const playersRef = ref(db, 'players');
const timerRef = ref(db, 'roundTimer');

let soundCooldownEnd = 0;
let timerInterval = null;
let currentPlayerId = null;
let currentPlayerName = null;
const adminPassword = "hunteradmin";

// DOM Elements
const playerListDiv = document.getElementById("playerList");
const addPlayerBtn = document.getElementById("addPlayerBtn");
const newPlayerNameInput = document.getElementById("newPlayerName");
const playSoundBtn = document.getElementById("playSoundBtn");
const resetCaughtBtn = document.getElementById("resetCaughtBtn");
const currentPlayerDiv = document.getElementById("currentPlayer");
const timerDisplay = document.getElementById("timerDisplay");
const resetTimerBtn = document.getElementById("resetTimerBtn");

// Add new player
addPlayerBtn.addEventListener("click", () => {
    const name = newPlayerNameInput.value.trim();
    if (!name) return;

    const newPlayerRef = push(playersRef);
    set(newPlayerRef, {
        name,
        status: "Active",
        playSound: false
    });

    newPlayerNameInput.value = "";
});

// Reset all players (confirm)
resetCaughtBtn.addEventListener("click", () => {
    const pwd = prompt("Enter admin password to reset all players:");
    if (pwd !== adminPassword) return alert("Incorrect password.");
    const confirmReset = confirm("Reset all players to Active?");
    if (!confirmReset) return;

    onValue(playersRef, snapshot => {
        snapshot.forEach(child => {
            update(ref(db, 'players/' + child.key), { status: "Active" });
        });
    }, { onlyOnce: true });
});

// Display player list
function updatePlayerList(snapshot) {
    playerListDiv.innerHTML = "";

    // Count remaining players
    let total = 0, active = 0;
    snapshot.forEach(child => {
        total++;
        if (child.val().status === "Active") active++;
    });
    document.getElementById("currentPlayer").textContent = `You are: ${currentPlayerName || "None"} | ${active} remaining / ${total} total`;

    snapshot.forEach(child => {


        const id = child.key;
        const player = child.val();

        const container = document.createElement("div");
        container.className = "playerEntry";
        if (player.status === "Caught") {
            container.style.textDecoration = "line-through";
        }

        const nameSpan = document.createElement("span");
        nameSpan.textContent = player.name + " - " + player.status;

        const identifyBtn = document.createElement("button");
        identifyBtn.textContent = "This is Me";
        identifyBtn.onclick = () => {
            currentPlayerId = id;
            currentPlayerName = player.name;
            currentPlayerDiv.textContent = `You are: ${player.name}`;
        };

        const caughtBtn = document.createElement("button");
        caughtBtn.textContent = "Mark as Caught";
        caughtBtn.onclick = () => {
            if (currentPlayerId === id) {
                update(ref(db, 'players/' + id), { status: "Caught" });
            } else {
                alert("You're not this player!");
            }
        };

        const removeBtn = document.createElement("button");
        removeBtn.textContent = "Remove";
        removeBtn.onclick = () => {
            const pwd = prompt("Enter admin password to remove:");
            if (pwd === adminPassword) {
                remove(ref(db, 'players/' + id));
            } else {
                alert("Incorrect password.");
            }
        };

        container.appendChild(nameSpan);
        container.appendChild(identifyBtn);
        container.appendChild(caughtBtn);
        container.appendChild(removeBtn);

        playerListDiv.appendChild(container);

        // If this is the current player and playSound is true, play a sound
        if (id === currentPlayerId && player.status === "Active" && player.playSound) {
            playBeep();
            update(ref(db, 'players/' + id), { playSound: false });
        }
    });
}

onValue(playersRef, snapshot => {
    updatePlayerList(snapshot);
});

// Periodic refresh
setInterval(() => {
    onValue(playersRef, snapshot => {
        updatePlayerList(snapshot);
    }, { onlyOnce: true });
}, 15000);

// Play sound for active players
playSoundBtn.addEventListener("click", () => {
    const now = Date.now();
    if (now < soundCooldownEnd) {
        const secondsLeft = Math.ceil((soundCooldownEnd - now) / 1000);
        return alert(`Please wait ${secondsLeft} more seconds before using this.`);
    }

    const pwd = prompt("Enter admin password to play sound:");
    if (pwd !== adminPassword) return alert("Incorrect password.");

    soundCooldownEnd = now + 180000; // 3 minutes
    updateCooldownDisplay();

    onValue(playersRef, snapshot => {
        snapshot.forEach(child => {
            const id = child.key;
            const player = child.val();
            if (player.status === "Active") {
                update(ref(db, 'players/' + id), { playSound: true });
            }
        });
    }, { onlyOnce: true });
});



function updateCooldownDisplay() {
    const display = document.getElementById("cooldownDisplay");
    const interval = setInterval(() => {
        const now = Date.now();
        if (now >= soundCooldownEnd) {
            display.textContent = "";
            clearInterval(interval);
        } else {
            const remaining = Math.ceil((soundCooldownEnd - now) / 1000);
            const mins = Math.floor(remaining / 60);
            const secs = remaining % 60;
            display.textContent = `Sound cooldown: ${mins}:${secs.toString().padStart(2, "0")}`;
        }
    }, 1000);
}

function playBeep() {
    const audio = new Audio("https://actions.google.com/sounds/v1/alarms/beep_short.ogg");
    audio.play().catch(() => { });
}

// ------------------ Timer -------------------

function startTimerSync() {
    onValue(timerRef, snapshot => {
        const endTime = snapshot.val();
        if (endTime) startCountdown(endTime);
        else resetTimer(); // if timer never set, initialize
    });
}

function startCountdown(endTimestamp) {
    if (timerInterval) clearInterval(timerInterval);

    function updateDisplay() {
        const now = Date.now();
        const remaining = Math.max(0, endTimestamp - now);
        const mins = Math.floor(remaining / 60000);
        const secs = Math.floor((remaining % 60000) / 1000);
        timerDisplay.textContent = `Time Left: ${mins}:${secs.toString().padStart(2, "0")}`;

        if (remaining <= 0) clearInterval(timerInterval);
    }

    updateDisplay();
    timerInterval = setInterval(updateDisplay, 1000);
}

function resetTimer() {
    const newEndTime = Date.now() + 3600000; // 1 hour
    set(timerRef, newEndTime);
}

resetTimerBtn.addEventListener("click", () => {
    const pwd = prompt("Enter admin password to reset timer:");
    if (pwd === adminPassword) resetTimer();
    else alert("Incorrect password.");
});

// Sync timer on load
startTimerSync();
