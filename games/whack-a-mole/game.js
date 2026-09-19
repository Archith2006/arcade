const holesElement = document.getElementById('holes');
const difficultyElement = document.getElementById('difficulty');
const startButton = document.getElementById('start');
const timeElement = document.getElementById('time');
const scoreElement = document.getElementById('score');
const missesElement = document.getElementById('misses');
const statusElement = document.getElementById('status');

const SETTINGS = {
  easy: { visibleMs: 1200, gapMs: 180, points: 1 },
  medium: { visibleMs: 800, gapMs: 120, points: 2 },
  hard: { visibleMs: 500, gapMs: 70, points: 3 }
};
const ROUND_SECONDS = 30;

let holes = [];
let activeHole = -1;
let score = 0;
let misses = 0;
let timeLeft = ROUND_SECONDS;
let gameRunning = false;
let targetTimer;
let roundTimer;

function setStatus(message, type = '') {
  statusElement.textContent = message;
  statusElement.className = `status ${type}`;
}

function createHoles() {
  holesElement.innerHTML = '';
  holes = [];
  for (let index = 0; index < 9; index += 1) {
    const hole = document.createElement('button');
    hole.className = 'hole';
    hole.type = 'button';
    hole.setAttribute('aria-label', `Hole ${index + 1}`);
    hole.addEventListener('click', () => whack(index));
    holesElement.appendChild(hole);
    holes.push(hole);
  }
}

function updateStats() {
  timeElement.textContent = timeLeft;
  scoreElement.textContent = score;
  missesElement.textContent = misses;
}

function hideTarget(countMiss = true) {
  if (activeHole !== -1) {
    holes[activeHole].classList.remove('active');
    if (countMiss && gameRunning) misses += 1;
    activeHole = -1;
    updateStats();
  }
}

function showTarget() {
  if (!gameRunning) return;
  const settings = SETTINGS[difficultyElement.value];
  hideTarget();
  activeHole = Math.floor(Math.random() * holes.length);
  holes[activeHole].classList.add('active');
  ArcadeSound.play('target');
  targetTimer = setTimeout(() => {
    hideTarget(true);
    setTimeout(showTarget, settings.gapMs);
  }, settings.visibleMs);
}

function whack(index) {
  if (!gameRunning) return;
  if (index === activeHole) {
    const settings = SETTINGS[difficultyElement.value];
    clearTimeout(targetTimer);
    holes[index].classList.remove('active');
    holes[index].classList.add('hit');
    setTimeout(() => holes[index].classList.remove('hit'), 220);
    activeHole = -1;
    score += settings.points;
    ArcadeSound.play('success');
    updateStats();
    setStatus(`Nice hit! +${settings.points} point${settings.points === 1 ? '' : 's'}.`,'success');
    setTimeout(showTarget, settings.gapMs);
  } else {
    ArcadeSound.play('error');
    misses += 1;
    updateStats();
    setStatus('Miss! Watch for the target.','error');
  }
}

function endGame() {
  gameRunning = false;
  clearTimeout(targetTimer);
  clearInterval(roundTimer);
  hideTarget(false);
  startButton.textContent = 'Play Again';
  setStatus(`Round over. You scored ${score} point${score === 1 ? '' : 's'} with ${misses} miss${misses === 1 ? '' : 'es'}.`, 'success');
}

function startGame() {
  clearTimeout(targetTimer);
  clearInterval(roundTimer);
  score = 0;
  misses = 0;
  timeLeft = ROUND_SECONDS;
  gameRunning = true;
  startButton.textContent = 'Restart Game';
  updateStats();
  setStatus('Find it and tap it before it moves!');
  showTarget();
  roundTimer = setInterval(() => {
    timeLeft -= 1;
    updateStats();
    if (timeLeft <= 0) endGame();
  }, 1000);
}

startButton.addEventListener('click', startGame);
difficultyElement.addEventListener('change', () => {
  if (gameRunning) startGame();
});

createHoles();
updateStats();
