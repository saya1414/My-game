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
  twistsDeck: []
};

const playerCountSelect = document.getElementById("playerCount");
const nameFields = document.getElementById("nameFields");
const setupPanel = document.getElementById("setupPanel");
const gamePanel = document.getElementById("gamePanel");

const startGameBtn = document.getElementById("startGameBtn");
const drawObjectsBtn = document.getElementById("drawObjectsBtn");
const drawScenarioBtn = document.getElementById("drawScenarioBtn");
const drawTwistBtn = document.getElementById("drawTwistBtn");
const resetBtn = document.getElementById("resetBtn");
const objectDrawCountSelect = document.getElementById("objectDrawCount");
const deckModeSelect = document.getElementById("deckMode");
const loadCustomBtn = document.getElementById("loadCustomBtn");

const objectsFileInput = document.getElementById("objectsFileInput");
const scenariosFileInput = document.getElementById("scenariosFileInput");
const twistsFileInput = document.getElementById("twistsFileInput");
const customDeckStatusEl = document.getElementById("customDeckStatus");

const currentPlayerEl = document.getElementById("currentPlayer");
const roundNumberEl = document.getElementById("roundNumber");

const objectCardEl = document.getElementById("objectCard");
const scenarioCardEl = document.getElementById("scenarioCard");
const twistCardEl = document.getElementById("twistCard");

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderObjectEntries(objects) {
  objectCardEl.innerHTML = objects
    .map((item) => `<span class="object-entry">${escapeHtml(item)}</span>`)
    .join("");
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
    objectCardEl.textContent = "Press “Draw Objects”";
    scenarioCardEl.textContent = "Press “Draw Scenario”";
    twistCardEl.textContent = "Press “Draw Twist”";
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
  const current = state.players[state.currentPlayerIndex];
  currentPlayerEl.textContent = current?.name || "-";
  roundNumberEl.textContent = String(state.round);
}

function drawObjects() {
  const sources = getDeckSourcesForMode(state.activeMode);
  const objectDrawCount = Number(objectDrawCountSelect.value);
  const drawnObjects = [];

  for (let index = 0; index < objectDrawCount; index += 1) {
    drawnObjects.push(drawFromDeck("objectsDeck", sources.objects));
  }

  renderObjectEntries(drawnObjects);
}

function drawScenario() {
  const sources = getDeckSourcesForMode(state.activeMode);
  scenarioCardEl.textContent = drawFromDeck("scenariosDeck", sources.scenarios);
}

function drawTwist() {
  const sources = getDeckSourcesForMode(state.activeMode);
  twistCardEl.textContent = drawFromDeck("twistsDeck", sources.twists);
}

function startGame() {
  const names = getPlayerNames();
  state.players = names.map((name) => ({ name }));
  state.currentPlayerIndex = 0;
  state.round = 1;

  resetShuffledDecks();

  setupPanel.classList.add("hidden");
  gamePanel.classList.remove("hidden");

  objectCardEl.textContent = "Press “Draw Objects”";
  scenarioCardEl.textContent = "Press “Draw Scenario”";
  twistCardEl.textContent = "Press “Draw Twist”";

  renderStatus();
}

function nextPlayer() {
  if (state.players.length === 0) {
    return;
  }

  state.currentPlayerIndex += 1;

  if (state.currentPlayerIndex >= state.players.length) {
    state.currentPlayerIndex = 0;
    state.round += 1;
  }

  renderStatus();
}

function resetGame() {
  state.players = [];
  state.currentPlayerIndex = 0;
  state.round = 1;
  state.objectsDeck = [];
  state.scenariosDeck = [];
  state.twistsDeck = [];

  gamePanel.classList.add("hidden");
  setupPanel.classList.remove("hidden");
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
loadCustomBtn.addEventListener("click", () => {
  loadCustomDecks().catch(() => {
    setStatusMessage("Could not read one or more files. Please try again.");
  });
});
deckModeSelect.addEventListener("change", (event) => {
  applyDeckMode(event.target.value);
});

renderNameFields();
applyDeckMode("default");
