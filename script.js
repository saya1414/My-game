const defaultObjects = [
  "Umbrella",
  "Backpack",
  "Candle",
  "Old Key",
  "Soccer Ball",
  "Mirror",
  "Toy Robot",
  "Water Bottle",
  "Camera",
  "Notebook",
  "Banana",
  "Snow Globe"
];

const defaultScenarios = [
  "You are trying to escape a locked museum at midnight.",
  "You need to impress a very strict judge in 60 seconds.",
  "You are stuck on a tiny island with one teammate.",
  "You must survive one day in a city with no electricity.",
  "You are tasked with saving a failing school play.",
  "You are leading a mission to calm down an angry dragon.",
  "You need to win a talent show with zero preparation.",
  "You are negotiating peace between two rival villages."
];

const defaultTwists = [
  "You cannot use the letter E while explaining your idea.",
  "You must include a dance move in your pitch.",
  "You only have 15 seconds to speak.",
  "You must whisper the entire time.",
  "Your plan must involve at least one animal.",
  "You must pretend you are an 80-year-old inventor.",
  "You can only speak in questions.",
  "You have to include a fake commercial slogan."
];

const customDecks = {
  objects: [],
  scenarios: [],
  twists: []
};

const state = {
  players: [],
  currentPlayerIndex: 0,
  round: 1,
  activeMode: "default",
  objectsDeck: [],
  scenariosDeck: [],
  twistsDeck: [],
  playerObjects: {},      // { playerName: [obj1, obj2, ...] }
  objectsDrawnThisRound: false,
};

// ---------------------------------------------------------------------------
// Multiplayer module. Connects to the Cloudflare Worker (GameRoom Durable
// Object) over WebSocket. Set MP_WORKER_URL below to your deployed Worker URL,
// e.g. "https://my-game-rooms.YOUR-SUBDOMAIN.workers.dev".
// Use "" to disable multiplayer (the multiplayer panel will show a notice).
// ---------------------------------------------------------------------------
const MP_WORKER_URL = "https://my-game-rooms.october2920.workers.dev";

const mp = {
  enabled: false,
  ws: null,
  youId: null,
  hostId: null,
  roomCode: null,
  desiredName: "",
  reconnectTimer: null,
  serverState: null,

  isHost() {
    return this.enabled && this.youId && this.youId === this.hostId;
  },
  send(obj) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(obj));
    }
  },
  setStatus(msg) {
    const el = document.getElementById("mpStatus");
    if (el) el.textContent = msg;
  }
};

const playerCountSelect = document.getElementById("playerCount");
const nameFields = document.getElementById("nameFields");
const screen2El = document.getElementById("screen2");
const screen3El = document.getElementById("screen3");

function showScreen(id) {
  ["screen1", "screen2", "screen3", "screen4"].forEach(s => {
    const el = document.getElementById(s);
    if (el) el.classList.toggle("active", s === id);
  });
  const nav = document.getElementById("globalNav");
  if (nav) nav.classList.toggle("hidden", id === "screen1");
}

const startGameBtn = document.getElementById("startGameBtn");
const drawObjectsBtn = document.getElementById("drawObjectsBtn");
const drawScenarioBtn = document.getElementById("drawScenarioBtn");
const drawTwistBtn = document.getElementById("drawTwistBtn");
const showSummaryBtn = document.getElementById("showSummaryBtn");
const nextRoundBtn = document.getElementById("nextRoundBtn");
const resetBtn = document.getElementById("resetBtn");
const summaryResetBtn = document.getElementById("summaryResetBtn");
const objectDrawCountSelect = document.getElementById("objectDrawCount");
const deckModeSelect = document.getElementById("deckMode");
const loadCustomBtn = document.getElementById("loadCustomBtn");

const objectsFileInput = document.getElementById("objectsFileInput");
const scenariosFileInput = document.getElementById("scenariosFileInput");
const twistsFileInput = document.getElementById("twistsFileInput");
const customDeckStatusEl = document.getElementById("customDeckStatus");

// Update styled file upload buttons when files are chosen
[
  ["objectsFileInput", "objectsUploadBtn"],
  ["scenariosFileInput", "scenariosUploadBtn"],
  ["twistsFileInput", "twistsUploadBtn"],
].forEach(([inputId, btnId]) => {
  const input = document.getElementById(inputId);
  const btn = document.getElementById(btnId);
  if (input && btn) {
    input.addEventListener("change", () => {
      const name = input.files?.[0]?.name;
      if (name) {
        btn.textContent = `✅ ${name}`;
        btn.classList.add("has-file");
      } else {
        btn.textContent = "📂 Choose file";
        btn.classList.remove("has-file");
      }
    });
  }
});

const roundNumberEl = document.getElementById("roundNumber");

const objectCardEl = document.getElementById("objectCard");
const scenarioCardEl = document.getElementById("scenarioCard");
const twistCardEl = document.getElementById("twistCard");

function spawnSparkles(container) {
  const colors = ["#a78bfa", "#f472b6", "#fb923c", "#34d399", "#60a5fa", "#facc15"];
  const cx = container.offsetWidth / 2;
  const cy = container.offsetHeight / 2;

  for (let i = 0; i < 16; i++) {
    const s = document.createElement("span");
    s.className = "sparkle";
    const size = 5 + Math.random() * 8;
    const angle = (i / 16) * 2 * Math.PI + Math.random() * 0.4;
    const dist = 40 + Math.random() * 80;
    s.style.cssText = `
      width:${size}px; height:${size}px;
      background:${colors[i % colors.length]};
      left:${cx}px; top:${cy}px;
      --tx:${Math.cos(angle) * dist}px;
      --ty:${Math.sin(angle) * dist}px;
    `;
    container.appendChild(s);
    s.addEventListener("animationend", () => s.remove(), { once: true });
  }
}

// ── Reveal overlay ────────────────────────
const revealOverlay = document.getElementById("revealOverlay");
const revealCard    = document.getElementById("revealCard");
const revealLabel   = document.getElementById("revealLabel");
const revealContent = document.getElementById("revealContent");

let revealResolve = null;

function showReveal(type, title, htmlContent) {
  return new Promise((resolve) => {
    revealResolve = resolve;

    revealLabel.textContent = title;
    revealLabel.className = "reveal-label label-" + type;
    revealContent.innerHTML = htmlContent;

    revealCard.style.animation = "none";
    void revealCard.offsetWidth;
    revealCard.style.animation = "";

    revealOverlay.classList.remove("hidden");

    // Sparkles after card animates in
    setTimeout(() => spawnSparkles(revealCard), 300);
  });
}

function dismissReveal() {
  revealOverlay.classList.add("hidden");
  if (revealResolve) { revealResolve(); revealResolve = null; }
}

revealOverlay.addEventListener("click", dismissReveal);

function setCardText(el, text) {
  el.classList.remove("card-reveal");
  void el.offsetWidth;
  el.textContent = text;
  el.classList.add("card-reveal");
}

function setCardHTML(el, html) {
  el.classList.remove("card-reveal");
  void el.offsetWidth;
  el.innerHTML = html;
  el.classList.add("card-reveal");
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderObjectEntries(objects) {
  setCardHTML(objectCardEl, objects
    .map((item) => `<span class="object-entry">${escapeHtml(item)}</span>`)
    .join(""));
}

function getDeckSourcesForMode(mode) {
  if (mode === "custom") {
    return {
      objects: customDecks.objects,
      scenarios: customDecks.scenarios,
      twists: customDecks.twists
    };
  }

  return {
    objects: defaultObjects,
    scenarios: defaultScenarios,
    twists: defaultTwists
  };
}

function hasCompleteCustomDecks() {
  return customDecks.objects.length > 0 && customDecks.scenarios.length > 0 && customDecks.twists.length > 0;
}

function resetShuffledDecks() {
  const sources = getDeckSourcesForMode(state.activeMode);
  state.objectsDeck = shuffle(sources.objects);
  state.scenariosDeck = shuffle(sources.scenarios);
  state.twistsDeck = shuffle(sources.twists);
}

function setStatusMessage(message) {
  customDeckStatusEl.textContent = message;
}

function parseDeckText(text) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

function applyDeckMode(mode) {
  if (mode === "custom" && !hasCompleteCustomDecks()) {
    state.activeMode = "default";
    deckModeSelect.value = "default";
    setStatusMessage("Custom decks are not loaded yet. Mode: Built-in Decks");
    return;
  }

  state.activeMode = mode;
  resetShuffledDecks();

  if (mode === "custom") {
    setStatusMessage("Mode: My Decks");
  } else {
    setStatusMessage("Mode: Built-in Decks");
  }

  if (!gamePanel.classList.contains("hidden")) {
    setCardText(objectCardEl, "Press “Draw Objects”");
    setCardText(scenarioCardEl, "Press “Draw Scenario”");
    setCardText(twistCardEl, "Press “Draw Twist”");
  }
}

function shuffle(items) {
  const arr = [...items];
  for (let index = arr.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [arr[index], arr[randomIndex]] = [arr[randomIndex], arr[index]];
  }
  return arr;
}

function refillDeckIfNeeded(deckName, source) {
  if (state[deckName].length === 0) {
    state[deckName] = shuffle(source);
  }
}

function drawFromDeck(deckName, source) {
  refillDeckIfNeeded(deckName, source);
  return state[deckName].pop();
}

function renderNameFields() {
  const count = Number(playerCountSelect.value);
  nameFields.innerHTML = "";

  for (let player = 1; player <= count; player += 1) {
    const input = document.createElement("input");
    input.type = "text";
    input.placeholder = `Player ${player} name`;
    input.value = `Player ${player}`;
    input.dataset.playerName = "true";
    nameFields.appendChild(input);
  }
}

function getPlayerNames() {
  return Array.from(nameFields.querySelectorAll("input[data-player-name='true']"))
    .map((input, index) => input.value.trim() || `Player ${index + 1}`)
    .slice(0, Number(playerCountSelect.value));
}

function renderStatus() {
  roundNumberEl.textContent = String(state.round);
  const current = state.players[state.currentPlayerIndex];
  const pill = document.getElementById("currentPlayerPill");
  const nameEl = document.getElementById("currentPlayerName");
  if (current && nameEl) {
    nameEl.textContent = current.name;
    if (pill) pill.classList.remove("hidden");
  }
  // Update pass button label
  const nextIndex = (state.currentPlayerIndex + 1) % state.players.length;
  const nextEl = document.getElementById("nextPlayerName");
  if (nextEl && state.players[nextIndex]) {
    nextEl.textContent = state.players[nextIndex].name;
  }
}

function renderSummaryScreen(s) {
  document.getElementById("summaryRound").textContent = String(s.round);
  document.getElementById("summaryScenario").textContent = s.scenario || "—";
  document.getElementById("summaryTwist").textContent = s.twist || "—";

  const grid = document.getElementById("summaryObjectsGrid");
  grid.innerHTML = "";
  for (const [, entry] of Object.entries(s.playerObjects || {})) {
    const card = document.createElement("div");
    card.className = "player-obj-card";
    card.innerHTML = `<div class="player-name">${escapeHtml(entry.name)}</div>
      <div class="player-items">${(entry.items || []).map(i => escapeHtml(i)).join("<br>")}</div>`;
    grid.appendChild(card);
  }
  showScreen("screen4");
}

function drawObjects() {
  const sources = getDeckSourcesForMode(state.activeMode);
  const objectDrawCount = Number(objectDrawCountSelect.value);
  const drawnObjects = [];
  for (let index = 0; index < objectDrawCount; index += 1) {
    drawnObjects.push(drawFromDeck("objectsDeck", sources.objects));
  }
  if (mp.enabled) {
    mp.send({ type: "drawObjects", items: drawnObjects });
  } else {
    const playerName = state.players[state.currentPlayerIndex]?.name || "Player";
    state.playerObjects[playerName] = { name: playerName, items: drawnObjects };
  }
  renderObjectEntries(drawnObjects);
  const html = drawnObjects.map(o => `<div style="margin:0.3rem 0">${escapeHtml(o)}</div>`).join("");
  showReveal("object", "🎯 Your Objects", html);

  if (!mp.enabled) {
    // Show pass-device button if more players haven't drawn yet
    const passBtn = document.getElementById("passDeviceBtn");
    const allDrawn = state.players.every(p => state.playerObjects[p.name]);
    if (passBtn) passBtn.classList.toggle("hidden", allDrawn);
    drawObjectsBtn.classList.toggle("hidden", !allDrawn);
  }
}

function drawScenario() {
  if (mp.enabled && !mp.isHost()) return;
  const sources = getDeckSourcesForMode(state.activeMode);
  const item = drawFromDeck("scenariosDeck", sources.scenarios);
  if (mp.enabled) { mp.send({ type: "drawScenario", item }); }
  setCardText(scenarioCardEl, item);
  document.getElementById("scenarioCardWrap").style.display = "";
  showReveal("scenario", "📖 Scenario", escapeHtml(item));
}

function drawTwist() {
  if (mp.enabled && !mp.isHost()) return;
  const sources = getDeckSourcesForMode(state.activeMode);
  const item = drawFromDeck("twistsDeck", sources.twists);
  if (mp.enabled) { mp.send({ type: "drawTwist", item }); }
  setCardText(twistCardEl, item);
  document.getElementById("twistCardWrap").style.display = "";
  showReveal("twist", "🌀 Twist", escapeHtml(item));
}

function setupHostControls(isHost) {
  document.querySelectorAll(".host-only-el").forEach(el => {
    el.classList.toggle("hidden", !isHost);
  });
  document.querySelectorAll(".host-label").forEach(el => {
    el.classList.toggle("hidden", !isHost);
  });
}

function startGame() {
  if (mp.enabled) {
    if (!mp.isHost()) { mp.setStatus("Only the host can start the game."); return; }
    resetShuffledDecks();
    mp.send({ type: "start", deckMode: state.activeMode });
    return;
  }
  const names = getPlayerNames();
  state.players = names.map((name) => ({ name }));
  state.currentPlayerIndex = 0;
  state.round = 1;
  state.playerObjects = {};
  resetShuffledDecks();
  showScreen("screen3");
  setupHostControls(true);
  document.getElementById("scenarioCardWrap").style.display = "none";
  document.getElementById("twistCardWrap").style.display = "none";
  const passBtn2 = document.getElementById("passDeviceBtn");
  if (passBtn2) passBtn2.classList.add("hidden");
  drawObjectsBtn.classList.remove("hidden");
  setCardText(objectCardEl, "Draw your objects below");
  renderStatus();
}

function resetGame() {
  if (mp.enabled) {
    if (!mp.isHost()) return;
    mp.send({ type: "reset" });
    return;
  }
  state.players = [];
  state.currentPlayerIndex = 0;
  state.round = 1;
  state.objectsDeck = [];
  state.scenariosDeck = [];
  state.twistsDeck = [];
  state.playerObjects = {};
  showScreen("screen1");
  renderNameFields();
}
async function loadCustomDecks() {
  const objectsFile = objectsFileInput.files?.[0];
  const scenariosFile = scenariosFileInput.files?.[0];
  const twistsFile = twistsFileInput.files?.[0];

  if (!objectsFile || !scenariosFile || !twistsFile) {
    setStatusMessage("Please choose all 3 files: objects, scenarios, twists.");
    return;
  }

  const [objectsText, scenariosText, twistsText] = await Promise.all([
    objectsFile.text(),
    scenariosFile.text(),
    twistsFile.text()
  ]);

  const parsedObjects = parseDeckText(objectsText);
  const parsedScenarios = parseDeckText(scenariosText);
  const parsedTwists = parseDeckText(twistsText);

  if (parsedObjects.length === 0 || parsedScenarios.length === 0 || parsedTwists.length === 0) {
    setStatusMessage("Each file must contain at least one non-empty line.");
    return;
  }

  customDecks.objects = parsedObjects;
  customDecks.scenarios = parsedScenarios;
  customDecks.twists = parsedTwists;

  setStatusMessage(
    `Loaded My Decks: ${parsedObjects.length} objects, ${parsedScenarios.length} scenarios, ${parsedTwists.length} twists.`
  );

  if (deckModeSelect.value === "custom") {
    applyDeckMode("custom");
  }
}

playerCountSelect.addEventListener("change", renderNameFields);
startGameBtn.addEventListener("click", startGame);
drawObjectsBtn.addEventListener("click", drawObjects);
drawScenarioBtn.addEventListener("click", drawScenario);
drawTwistBtn.addEventListener("click", drawTwist);
resetBtn.addEventListener("click", resetGame);

// Pass device to next player (local mode)
const passDeviceBtn = document.getElementById("passDeviceBtn");
if (passDeviceBtn) {
  passDeviceBtn.addEventListener("click", () => {
    state.currentPlayerIndex = (state.currentPlayerIndex + 1) % state.players.length;
    passDeviceBtn.classList.add("hidden");
    drawObjectsBtn.classList.remove("hidden");
    setCardText(objectCardEl, "Draw your objects below");
    renderStatus();
  });
}

loadCustomBtn.addEventListener("click", () => {
  loadCustomDecks().catch(() => {
    setStatusMessage("Could not read one or more files. Please try again.");
  });
});
deckModeSelect.addEventListener("change", (event) => {
  applyDeckMode(event.target.value);
});

// Screen 1 → Screen 2
document.getElementById("goToLobbyBtn").addEventListener("click", () => {
  renderNameFields();
  showScreen("screen2");
});

// Screen 2 → Screen 1
document.getElementById("backToStartBtn").addEventListener("click", () => {
  showScreen("screen1");
});

// Global nav home button
document.getElementById("homeNavBtn").addEventListener("click", () => {
  if (mp.enabled) leaveRoom();
  showScreen("screen1");
});

renderNameFields();
applyDeckMode("default");

// ---------------------------------------------------------------------------
// Multiplayer wiring
// ---------------------------------------------------------------------------
const mpPanel = document.getElementById("multiplayerPanel");
const mpNameInput = document.getElementById("mpNameInput");
const mpStatusEl = document.getElementById("mpStatus");
const mpLobbyEl = document.getElementById("mpLobby");
const mpRoomCodeEl = document.getElementById("mpRoomCode");
const mpPlayerListEl = document.getElementById("mpPlayerList");
const mpStartGameBtn = document.getElementById("mpStartGameBtn");
const mpLeaveBtn = document.getElementById("mpLeaveBtn");
const mpHostNoteEl = document.getElementById("mpHostNote");
const mpBannerEl = document.getElementById("mpBanner");
const createRoomBtn = document.getElementById("createRoomBtn");
const joinRoomInput = document.getElementById("joinRoomInput");
const joinRoomBtn = document.getElementById("joinRoomBtn");
const copyRoomBtn = document.getElementById("copyRoomBtn");

// Restore last name
try {
  const stored = localStorage.getItem("mpName");
  if (stored) mpNameInput.value = stored;
} catch {}

function generateRoomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 5; i += 1) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

function buildWsUrl(roomCode, name) {
  if (!MP_WORKER_URL) return null;
  const base = MP_WORKER_URL.replace(/^http/, "ws").replace(/\/+$/, "");
  return `${base}/room/${encodeURIComponent(roomCode)}?name=${encodeURIComponent(name)}`;
}

function connectToRoom(roomCode) {
  const name = (mpNameInput.value || "Player").trim().slice(0, 40) || "Player";
  try {
    localStorage.setItem("mpName", name);
  } catch {}

  if (!MP_WORKER_URL) {
    mp.setStatus(
      "Multiplayer is not configured. Set MP_WORKER_URL in script.js to your Cloudflare Worker URL."
    );
    return;
  }

  const url = buildWsUrl(roomCode, name);
  mp.enabled = true;
  mp.roomCode = roomCode;
  mp.desiredName = name;

  mp.setStatus(`Connecting to room ${roomCode}\u2026`);

  try {
    mp.ws = new WebSocket(url);
  } catch (err) {
    mp.setStatus(`Could not open connection: ${err.message}`);
    mp.enabled = false;
    return;
  }

  mp.ws.addEventListener("open", () => {
    mp.setStatus(`Connected to room ${roomCode}.`);
    // Update URL hash so the link itself can be shared
    try {
      const newUrl = new URL(window.location.href);
      newUrl.hash = `room=${roomCode}`;
      window.history.replaceState(null, "", newUrl.toString());
    } catch {}
  });

  mp.ws.addEventListener("message", (evt) => {
    let msg;
    try {
      msg = JSON.parse(evt.data);
    } catch {
      return;
    }
    if (msg.type === "welcome") {
      mp.youId = msg.you;
    } else if (msg.type === "state") {
      mp.serverState = msg.state;
      mp.hostId = msg.state.hostId;
      applyServerState(msg.state);
    }
  });

  mp.ws.addEventListener("close", () => {
    if (!mp.enabled) return;
    mp.setStatus("Disconnected. Retrying in 3s\u2026");
    if (mp.reconnectTimer) clearTimeout(mp.reconnectTimer);
    mp.reconnectTimer = setTimeout(() => {
      if (mp.enabled && mp.roomCode) connectToRoom(mp.roomCode);
    }, 3000);
  });

  mp.ws.addEventListener("error", () => {
    mp.setStatus("Connection error.");
  });
}

function leaveRoom() {
  mp.enabled = false;
  mp.roomCode = null;
  mp.youId = null;
  mp.hostId = null;
  mp.serverState = null;
  if (mp.reconnectTimer) {
    clearTimeout(mp.reconnectTimer);
    mp.reconnectTimer = null;
  }
  if (mp.ws) {
    try {
      mp.ws.close();
    } catch {}
    mp.ws = null;
  }
  mpLobbyEl.classList.add("hidden");
  mpBannerEl.classList.add("hidden");
  showScreen("screen2");
  mp.setStatus("");
  try {
    const newUrl = new URL(window.location.href);
    newUrl.hash = "";
    window.history.replaceState(null, "", newUrl.toString());
  } catch {}
}

function applyServerState(s) {
  state.players = s.players.map((p) => ({ name: p.name, id: p.id }));
  state.round = s.round;

  // Lobby UI
  mpLobbyEl.classList.remove("hidden");
  mpRoomCodeEl.textContent = mp.roomCode || "";
  mpPlayerListEl.innerHTML = "";
  for (const p of s.players) {
    const li = document.createElement("li");
    li.textContent = p.name;
    if (p.id === s.hostId) li.classList.add("is-host");
    if (p.id === mp.youId) li.classList.add("is-you");
    mpPlayerListEl.appendChild(li);
  }

  const youAreHost = mp.isHost();
  mpStartGameBtn.classList.toggle("hidden", !youAreHost || s.started);
  mpHostNoteEl.textContent = youAreHost
    ? "You are the host. You control draws."
    : "Waiting for the host to start / draw cards.";

  if (!s.started) {
    mpBannerEl.classList.add("hidden");
    if (youAreHost) {
      showScreen("screen2");
      startGameBtn.classList.add("hidden");
    } else {
      showScreen("screen2");
    }
    return;
  }

  // Game started
  mpBannerEl.classList.remove("hidden");
  mpBannerEl.innerHTML = `
    <span>Room <strong>${escapeHtml(mp.roomCode || "")}</strong> &middot; ${s.players.length} player${s.players.length === 1 ? "" : "s"}</span>
    <span class="mp-banner-role">${youAreHost ? "Host" : "Player"}</span>
  `;
  setupHostControls(youAreHost);

  if (s.phase === "summary") {
    renderSummaryScreen(s);
    return;
  }

  // Drawing phase
  showScreen("screen3");
  renderStatus();

  // My objects on the card
  const myEntry = s.playerObjects?.[mp.youId];
  if (myEntry?.items?.length) {
    renderObjectEntries(myEntry.items);
  } else {
    setCardText(objectCardEl, "Draw your objects below");
  }

  // Scenario/Twist — visible if drawn
  if (s.scenario) {
    setCardText(scenarioCardEl, s.scenario);
    document.getElementById("scenarioCardWrap").style.display = "";
  } else {
    document.getElementById("scenarioCardWrap").style.display = youAreHost ? "" : "none";
    if (!s.scenario) setCardText(scenarioCardEl, "Draw Scenario");
  }
  if (s.twist) {
    setCardText(twistCardEl, s.twist);
    document.getElementById("twistCardWrap").style.display = "";
  } else {
    document.getElementById("twistCardWrap").style.display = youAreHost ? "" : "none";
    if (!s.twist) setCardText(twistCardEl, "Draw Twist");
  }
}

createRoomBtn.addEventListener("click", () => {
  const code = generateRoomCode();
  connectToRoom(code);
});

joinRoomBtn.addEventListener("click", () => {
  const raw = (joinRoomInput.value || "").trim().toUpperCase();
  if (!/^[A-Z0-9_-]{1,32}$/.test(raw)) {
    mp.setStatus("Enter a valid room code (letters and numbers).");
    return;
  }
  connectToRoom(raw);
});

joinRoomInput.addEventListener("keydown", (evt) => {
  if (evt.key === "Enter") joinRoomBtn.click();
});

mpStartGameBtn.addEventListener("click", () => {
  if (!mp.isHost()) return;
  resetShuffledDecks();
  mp.send({ type: "start", deckMode: state.activeMode });
});

mpLeaveBtn.addEventListener("click", () => {
  leaveRoom();
  startGameBtn.classList.remove("hidden");
});

copyRoomBtn.addEventListener("click", async () => {
  if (!mp.roomCode) return;
  const shareText = `${window.location.origin}${window.location.pathname}#room=${mp.roomCode}`;
  try {
    await navigator.clipboard.writeText(shareText);
    copyRoomBtn.textContent = "Copied!";
    setTimeout(() => { copyRoomBtn.textContent = "Copy"; }, 1500);
  } catch {
    mp.setStatus(`Share this link: ${shareText}`);
  }
});

if (showSummaryBtn) {
  showSummaryBtn.addEventListener("click", () => {
    if (mp.enabled) {
      if (!mp.isHost()) return;
      mp.send({ type: "showSummary" });
    } else {
      showSummaryLocal();
    }
  });
}

if (nextRoundBtn) {
  nextRoundBtn.addEventListener("click", () => {
    if (mp.enabled) {
      if (!mp.isHost()) return;
      mp.send({ type: "nextRound" });
    } else {
      state.round += 1;
      state.currentPlayerIndex = 0;
      state.playerObjects = {};
      resetShuffledDecks();
      showScreen("screen3");
      document.getElementById("scenarioCardWrap").style.display = "none";
      document.getElementById("twistCardWrap").style.display = "none";
      const pb = document.getElementById("passDeviceBtn");
      if (pb) pb.classList.add("hidden");
      drawObjectsBtn.classList.remove("hidden");
      setCardText(objectCardEl, "Draw your objects below");
      renderStatus();
    }
  });
}

if (summaryResetBtn) {
  summaryResetBtn.addEventListener("click", resetGame);
}

// If page loaded with #room=ABCDE, prefill the join input.
(function autoJoinFromHash() {
  const m = window.location.hash.match(/room=([A-Za-z0-9_-]{1,32})/);
  if (m) {
    joinRoomInput.value = m[1].toUpperCase();
    mp.setStatus(`Room code ${m[1].toUpperCase()} detected. Enter your name and click Join Room.`);
  }
})();

if (!MP_WORKER_URL) {
  mp.setStatus(
    "Multiplayer not configured yet. After deploying the worker (see worker/), set MP_WORKER_URL at the top of script.js."
  );
}