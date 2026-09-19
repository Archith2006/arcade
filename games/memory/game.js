// ============================================
// MEMORY MATCH — game logic
// ============================================

const SYMBOLS = ["🍎","🍕","🚀","🐱","🎮","🌙","⚡","🎧","🍩","🐢","🌵","🎲","🦄","🍉","🧩","🔥","🎯","🐳"];

// grid size + AI "skill" (0 = forgets everything, 1 = never forgets) per difficulty
const DIFFICULTY = {
  easy:    { pairs: 6,  cols: 4, aiSkill: 0.25 },
  medium:  { pairs: 8,  cols: 4, aiSkill: 0.5  },
  hard:    { pairs: 12, cols: 6, aiSkill: 0.75 },
  extreme: { pairs: 18, cols: 6, aiSkill: 0.95 }
};

const PLAYER_COLORS = ["#00f0ff", "#ff2fd0", "#ffe135", "#39ff9d"];

// ------------ state ------------
let mode = "ai";          // "ai" | "2" | "3" | "4"
let level = "easy";
let cards = [];            // { symbol, matched, id }
let flipped = [];          // indices currently face-up, not yet resolved
let matchedPairsCount = 0;
let totalPairs = 0;
let players = [];          // { name, score, isAI }
let currentPlayer = 0;
let boardLocked = false;   // true while two cards are being checked
let aiMemory = new Map();  // index -> symbol, things the AI has "noticed"

// ------------ setup screen controls ------------
document.getElementById("modeRow").addEventListener("click", (e) => {
  const btn = e.target.closest(".opt-btn");
  if (!btn) return;
  document.querySelectorAll("#modeRow .opt-btn").forEach(b => b.classList.remove("active"));
  btn.classList.add("active");
  mode = btn.dataset.mode;
});

document.getElementById("diffRow").addEventListener("click", (e) => {
  const btn = e.target.closest(".opt-btn");
  if (!btn) return;
  document.querySelectorAll("#diffRow .opt-btn").forEach(b => b.classList.remove("active"));
  btn.classList.add("active");
  level = btn.dataset.level;
  const cfg = DIFFICULTY[level];
  document.getElementById("diffHint").textContent = `${cfg.pairs} pairs · ${cfg.pairs * 2} cards`;
});

document.getElementById("startBtn").addEventListener("click", startGame);
document.getElementById("newGameBtn").addEventListener("click", () => {
  document.getElementById("gameScreen").classList.add("hidden");
  document.getElementById("setupScreen").classList.remove("hidden");
});
document.getElementById("settingsBtn").addEventListener("click", () => {
  document.getElementById("gameScreen").classList.add("hidden");
  document.getElementById("setupScreen").classList.remove("hidden");
});

// ------------ start a new game ------------
function startGame() {
  const cfg = DIFFICULTY[level];
  totalPairs = cfg.pairs;
  matchedPairsCount = 0;
  flipped = [];
  boardLocked = false;
  aiMemory = new Map();

  // build players
  if (mode === "ai") {
    players = [
      { name: "You", score: 0, isAI: false },
      { name: "AI",  score: 0, isAI: true }
    ];
  } else {
    const n = parseInt(mode, 10);
    players = Array.from({ length: n }, (_, i) => ({
      name: `Player ${i + 1}`, score: 0, isAI: false
    }));
  }
  currentPlayer = 0;

  // build & shuffle the deck
  const chosenSymbols = SYMBOLS.slice(0, totalPairs);
  const deck = [...chosenSymbols, ...chosenSymbols];
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  cards = deck.map((symbol, id) => ({ symbol, matched: false, id }));

  // render
  document.getElementById("setupScreen").classList.add("hidden");
  document.getElementById("gameScreen").classList.remove("hidden");

  const board = document.getElementById("memoryBoard");
  board.style.gridTemplateColumns = `repeat(${cfg.cols}, 1fr)`;
  board.style.maxWidth = `${cfg.cols * 70}px`;
  board.style.margin = "0 auto";
  board.innerHTML = "";
  cards.forEach((card, i) => {
    const el = document.createElement("div");
    el.className = "memory-card";
    el.dataset.index = i;
    el.addEventListener("click", () => onCardClick(i));
    board.appendChild(el);
  });

  renderScoreboard();
  updateTurnStatus();

  if (players[currentPlayer].isAI) {
    setTimeout(aiTakeTurn, 700);
  }
}

// ------------ scoreboard ------------
function renderScoreboard() {
  const el = document.getElementById("scoreboard");
  el.innerHTML = "";
  players.forEach((p, i) => {
    const chip = document.createElement("div");
    chip.className = "score-chip" + (i === currentPlayer ? " current" : "");
    chip.style.setProperty("--chip-color", PLAYER_COLORS[i]);
    chip.textContent = `${p.name}: ${p.score}`;
    el.appendChild(chip);
  });
}

function updateTurnStatus() {
  const p = players[currentPlayer];
  document.getElementById("turnStatus").textContent =
    p.isAI ? "AI is thinking…" : `${p.name}'s turn — pick a card`;
}

// ------------ card click (human turns only) ------------
function onCardClick(index) {
  if (boardLocked) return;
  if (players[currentPlayer].isAI) return;
  if (cards[index].matched) return;
  if (flipped.includes(index)) return;

  flipCard(index);

  if (flipped.length === 2) {
    boardLocked = true;
    setTimeout(resolveTurn, 700);
  }
}

function flipCard(index) {
  flipped.push(index);
  ArcadeSound.play('flip');
  const el = document.querySelector(`.memory-card[data-index="${index}"]`);
  el.textContent = cards[index].symbol;
  el.classList.add("flipped");

  // AI "notices" this card with a chance tied to difficulty
  const cfg = DIFFICULTY[level];
  if (Math.random() < cfg.aiSkill) {
    aiMemory.set(index, cards[index].symbol);
  }
}

// ------------ resolve a completed pair attempt ------------
function resolveTurn() {
  const [a, b] = flipped;
  const isMatch = cards[a].symbol === cards[b].symbol;

  if (isMatch) {
    ArcadeSound.play('success');
    cards[a].matched = true;
    cards[b].matched = true;
    document.querySelector(`.memory-card[data-index="${a}"]`).classList.add("matched");
    document.querySelector(`.memory-card[data-index="${b}"]`).classList.add("matched");
    aiMemory.delete(a);
    aiMemory.delete(b);
    players[currentPlayer].score++;
    matchedPairsCount++;
  } else {
    ArcadeSound.play('error');
    document.querySelector(`.memory-card[data-index="${a}"]`).classList.remove("flipped");
    document.querySelector(`.memory-card[data-index="${b}"]`).classList.remove("flipped");
    document.querySelector(`.memory-card[data-index="${a}"]`).textContent = "";
    document.querySelector(`.memory-card[data-index="${b}"]`).textContent = "";
  }

  flipped = [];
  boardLocked = false;

  if (matchedPairsCount === totalPairs) {
    endGame();
    return;
  }

  // matches go again; misses pass the turn
  if (!isMatch) {
    currentPlayer = (currentPlayer + 1) % players.length;
  }
  renderScoreboard();
  updateTurnStatus();

  if (players[currentPlayer].isAI) {
    setTimeout(aiTakeTurn, 700);
  }
}

// ------------ AI turn ------------
function aiTakeTurn() {
  if (boardLocked) return;

  // does the AI remember a known pair?
  const known = [...aiMemory.entries()].filter(([i]) => !cards[i].matched);
  let pickA = null, pickB = null;

  for (const [i, sym] of known) {
    const partner = known.find(([j, s]) => j !== i && s === sym);
    if (partner) { pickA = i; pickB = partner[0]; break; }
  }

  const available = () => cards
    .map((c, i) => i)
    .filter(i => !cards[i].matched && !flipped.includes(i));

  if (pickA === null) {
    const pool = available();
    pickA = pool[Math.floor(Math.random() * pool.length)];
  }
  flipCard(pickA);

  setTimeout(() => {
    if (pickB === null) {
      const pool = available();
      pickB = pool[Math.floor(Math.random() * pool.length)];
    }
    flipCard(pickB);
    boardLocked = true;
    setTimeout(resolveTurn, 700);
  }, 600);
}

// ------------ end of game ------------
function endGame() {
  const best = Math.max(...players.map(p => p.score));
  const winners = players.filter(p => p.score === best);
  const msg = winners.length > 1
    ? `It's a tie between ${winners.map(w => w.name).join(" & ")}! 🎉`
    : `${winners[0].name} wins! 🏆`;
  document.getElementById("turnStatus").textContent = msg;
}