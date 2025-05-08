import { initializeApp } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js";
import {
    getDatabase,
    ref,
    onValue,
    set,
    push,
    update,
    remove
} from "https://www.gstatic.com/firebasejs/10.11.0/firebase-database.js";
import { firebaseConfig } from './firebaseConfig.js';

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const playersRef = ref(db, 'players');
const timerRef = ref(db, 'roundTimer');
const chatRef = ref(db, 'chat');

let currentPlayerId = null;
let currentPlayerName = null;
let currentPlayerPassword = null;
let currentPlayerStatus = null;
let soundCooldownEnd = 0;
let timerInterval = null;

let audioContext = null;
let beepBuffer = null;

let soundEffect = new Audio();
soundEffect.autoplay = true;
const audioUrl = "beep_short.mp3";

// DOM Elements
const playerListDiv = document.getElementById("playerList");
const addPlayerBtn = document.getElementById("addPlayerBtn");
const newPlayerNameInput = document.getElementById("newPlayerName");
const newPlayerPwdInput = document.getElementById("newPlayerPassword");
const playSoundBtn = document.getElementById("playSoundBtn");
const resetCaughtBtn = document.getElementById("resetCaughtBtn");
const currentPlayerDiv = document.getElementById("currentPlayer");
const timerDisplay = document.getElementById("timerDisplay");
const resetTimerBtn = document.getElementById("resetTimerBtn");
const cooldownDisplay = document.getElementById("cooldownDisplay");
const chatBox = document.getElementById("chatBox");
const chatInput = document.getElementById("chatInput");
const sendChatBtn = document.getElementById("sendChatBtn");
const clearChatBtn = document.getElementById("clearChatBtn");
const enableSoundBtn = document.getElementById("enableSoundBtn");

const adminPassword = "hunteradmin";

// Enable sound for iOS Safari
enableSoundBtn.addEventListener("click", async () => {
    try {
        soundEffect.src = "data:audio/mpeg;base64,SUQzBAAAAAABEVRYWFgAAAAtAAADY29tbWVudABCaWdTb3VuZEJhbmsuY29tIC8gTGFTb25vdGhlcXVlLm9yZwBURU5DAAAAHQAAA1N3aXRjaCBQbHVzIMKpIE5DSCBTb2Z0d2FyZQBUSVQyAAAABgAAAzIyMzUAVFNTRQAAAA8AAANMYXZmNTcuODMuMTAwAAAAAAAAAAAAAAD/80DEAAAAA0gAAAAATEFNRTMuMTAwVVVVVVVVVVVVVUxBTUUzLjEwMFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVf/zQsRbAAADSAAAAABVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVf/zQMSkAAADSAAAAABVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV";

        //audioContext = new (window.AudioContext || window.webkitAudioContext)();
        //const res = await fetch(audioUrl);
        //const arrayBuffer = await res.arrayBuffer();
        //beepBuffer = await audioContext.decodeAudioData(arrayBuffer);

        alert("Sound enabled!");
        enableSoundBtn.style.display = "none";
    } catch (e) {
        alert("Failed to enable sound: " + e.message);
    }
});

function playBeep() {
    //if (audioContext && beepBuffer) {
    //  const source = audioContext.createBufferSource();
    //  source.buffer = beepBuffer;
    //  source.connect(audioContext.destination);
    //  source.start(0);
    // }
    soundEffect.src = audioUrl;
}

// Add new player
addPlayerBtn.addEventListener("click", () => {
    const name = newPlayerNameInput.value.trim();
    const password = newPlayerPwdInput.value.trim();
    if (!name || !password) return;

    const newPlayerRef = push(playersRef);
    set(newPlayerRef, {
        name,
        password,
        status: "Active",
        playSound: false
    });

    newPlayerNameInput.value = "";
    newPlayerPwdInput.value = "";
});

// Reset all players
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

    let total = 0, active = 0;

    snapshot.forEach(child => {
        const id = child.key;
        const player = child.val();

        total++;
        if (player.status === "Active") active++;

        const container = document.createElement("div");
        container.className = "playerEntry";

        if (player.status === "Caught") {
            container.style.textDecoration = "line-through";
        }

        const nameSpan = document.createElement("span");
        nameSpan.className = "playerName";
        nameSpan.textContent = `${player.name} - ${player.status}`;

        const identifyBtn = document.createElement("button");
        identifyBtn.textContent = "This is Me";
        identifyBtn.onclick = () => {
            const entered = prompt("Enter your player password:");
            if (entered === player.password) {
                currentPlayerId = id;
                currentPlayerName = player.name;
                currentPlayerPassword = player.password;
                currentPlayerStatus = player.status;
                renderPlayerStatus(active, total);
                renderSoundButton();
                alert(`You're identified as: ${player.name}`);
            } else {
                alert("Incorrect password.");
            }
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

        const buttonGroup = document.createElement("div");
        buttonGroup.className = "playerButtons";
        buttonGroup.style.display = "none";
        buttonGroup.append(identifyBtn, caughtBtn, removeBtn);

        container.append(nameSpan, buttonGroup);
        playerListDiv.appendChild(container);

        if (
            id === currentPlayerId &&
            player.status === "Active" &&
            player.playSound
        ) {
            update(ref(db, 'players/' + id), { playSound: false });
            playBeep();
        }

        if (id === currentPlayerId) {
            currentPlayerStatus = player.status;
            renderSoundButton();
        }
    });

    renderPlayerStatus(active, total);
}

function renderPlayerStatus(active, total) {
    currentPlayerDiv.textContent = `You are: ${currentPlayerName || "None"} | ${active} remaining / ${total} total`;
}

function renderSoundButton() {
    if (!currentPlayerId || currentPlayerStatus !== "Caught") {
        playSoundBtn.style.display = "none";
        cooldownDisplay.textContent = "";
    } else {
        playSoundBtn.style.display = "inline-block";
        updateCooldownDisplay();
    }
}

onValue(playersRef, snapshot => {
    updatePlayerList(snapshot);
});

setInterval(() => {
    onValue(playersRef, snapshot => {
        updatePlayerList(snapshot);
    }, { onlyOnce: true });
}, 15000);

// Sound trigger
playSoundBtn.addEventListener("click", () => {
    const now = Date.now();
    if (now < soundCooldownEnd) {
        const secondsLeft = Math.ceil((soundCooldownEnd - now) / 1000);
        return alert(`Please wait ${secondsLeft} more seconds before using this.`);
    }

    soundCooldownEnd = now + 180000;
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
    const interval = setInterval(() => {
        const now = Date.now();
        if (!playSoundBtn || playSoundBtn.style.display === "none") {
            cooldownDisplay.textContent = "";
            clearInterval(interval);
        } else if (now >= soundCooldownEnd) {
            cooldownDisplay.textContent = "Ready to use!";
            clearInterval(interval);
        } else {
            const remaining = Math.ceil((soundCooldownEnd - now) / 1000);
            const mins = Math.floor(remaining / 60);
            const secs = remaining % 60;
            cooldownDisplay.textContent = `Sound cooldown: ${mins}:${secs.toString().padStart(2, "0")}`;
        }
    }, 1000);
}

// Timer logic
function startTimerSync() {
    onValue(timerRef, snapshot => {
        const endTime = snapshot.val();
        if (endTime) startCountdown(endTime);
        else resetTimer(60);
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

function resetTimer(minutes) {
    const newEndTime = Date.now() + minutes * 60000;
    set(timerRef, newEndTime);
}

resetTimerBtn.addEventListener("click", () => {
    const pwd = prompt("Enter admin password to reset timer:");
    if (pwd !== adminPassword) return alert("Incorrect password.");
    const min = parseInt(prompt("Enter timer duration in minutes:"), 10);
    if (!isNaN(min) && min > 0) resetTimer(min);
    else alert("Invalid time entered.");
});

startTimerSync();

// Chat
sendChatBtn.addEventListener("click", () => {
    const text = chatInput.value.trim();
    if (!text) return;
    const message = {
        name: currentPlayerName || "Anon",
        text,
        timestamp: Date.now()
    };
    push(chatRef, message);
    chatInput.value = "";
});

clearChatBtn.addEventListener("click", () => {
    const pwd = prompt("Enter admin password to clear chat:");
    if (pwd !== adminPassword) return alert("Incorrect password.");
    set(chatRef, null);
});

function loadChat() {
    onValue(chatRef, snapshot => {
        chatBox.innerHTML = "";
        snapshot.forEach(child => {
            const msg = child.val();
            const time = new Date(msg.timestamp).toLocaleTimeString();
            const div = document.createElement("div");
            div.textContent = `[${time}] ${msg.name}: ${msg.text}`;
            chatBox.appendChild(div);
        });
        chatBox.scrollTop = chatBox.scrollHeight;
    });
}

loadChat();
