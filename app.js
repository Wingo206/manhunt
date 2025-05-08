// app.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js";
import {
  getDatabase,
  ref,
  onValue,
  set,
  push,
  update
} from "https://www.gstatic.com/firebasejs/10.11.0/firebase-database.js";
import { firebaseConfig } from './firebaseConfig.js';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const playersRef = ref(db, 'players');

let currentPlayerId = null;

// DOM Elements
const playerListDiv = document.getElementById("playerList");
const addPlayerBtn = document.getElementById("addPlayerBtn");
const newPlayerNameInput = document.getElementById("newPlayerName");
const playSoundBtn = document.getElementById("playSoundBtn");

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

// Update player list display
function updatePlayerList(snapshot) {
  playerListDiv.innerHTML = "";

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
      alert("You're identified as: " + player.name);
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

    container.appendChild(nameSpan);
    container.appendChild(identifyBtn);
    container.appendChild(caughtBtn);

    playerListDiv.appendChild(container);

    // If this is the current player and playSound is true, play a sound
    if (id === currentPlayerId && player.status === "Active" && player.playSound) {
      playBeep();
      update(ref(db, 'players/' + id), { playSound: false });
    }
  });
}

// Listen for player data
onValue(playersRef, snapshot => {
  updatePlayerList(snapshot);
});

// Refresh player list every 15 seconds
setInterval(() => {
  onValue(playersRef, snapshot => {
    updatePlayerList(snapshot);
  }, { onlyOnce: true });
}, 15000);

// Play sound button (seekers use this)
playSoundBtn.addEventListener("click", () => {
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

// Play sound on this client
function playBeep() {
  const audio = new Audio("https://actions.google.com/sounds/v1/alarms/beep_short.ogg");
  audio.play().catch(() => {
    console.log("Sound blocked by browser until interaction.");
  });
}
