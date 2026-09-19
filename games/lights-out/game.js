const SIZE = 5;
const DIFFICULTY = {
  easy: 8,
  medium: 14,
  hard: 22
};

const boardElement = document.getElementById('board');
const difficultyElement = document.getElementById('difficulty');
const movesElement = document.getElementById('moves');
const bestElement = document.getElementById('best');
const statusElement = document.getElementById('status');

let board = [];
let startingBoard = [];
let solutionMoves = [];
let cells = [];
let moves = 0;
let best = Number(localStorage.getItem('lightsOutBest') || 0) || null;
let gameOver = false;

function index(row, column) {
  return row * SIZE + column;
}

function shuffled(values) {
  const result = [...values];
  for (let position = result.length - 1; position > 0; position -= 1) {
    const swapPosition = Math.floor(Math.random() * (position + 1));
    [result[position], result[swapPosition]] = [result[swapPosition], result[position]];
  }
  return result;
}

function toggle(row, column) {
  if (row < 0 || row >= SIZE || column < 0 || column >= SIZE) return;
  board[index(row, column)] = !board[index(row, column)];
}

function press(row, column) {
  toggle(row, column);
  toggle(row - 1, column);
  toggle(row + 1, column);
  toggle(row, column - 1);
  toggle(row, column + 1);
}

function makePuzzle() {
  board = Array(SIZE * SIZE).fill(false);
  solutionMoves = [];
  const count = DIFFICULTY[difficultyElement.value];
  shuffled(Array.from({ length: SIZE * SIZE }, (_, position) => position))
    .slice(0, count)
    .forEach(position => {
      const row = Math.floor(position / SIZE);
      const column = position % SIZE;
      press(row, column);
      solutionMoves.push(position);
    });
  startingBoard = [...board];
}

function setStatus(message, success = false) {
  statusElement.textContent = message;
  statusElement.className = `status${success ? ' success' : ''}`;
}

function render() {
  cells.forEach((cell, position) => {
    cell.classList.toggle('on', board[position]);
    cell.classList.remove('solution');
    cell.setAttribute('aria-label', `Row ${Math.floor(position / SIZE) + 1}, column ${(position % SIZE) + 1}, ${board[position] ? 'on' : 'off'}`);
  });
  movesElement.textContent = moves;
  bestElement.textContent = best || '-';
}

function createBoard() {
  boardElement.innerHTML = '';
  cells = [];
  for (let position = 0; position < SIZE * SIZE; position += 1) {
    const cell = document.createElement('button');
    cell.className = 'light';
    cell.type = 'button';
    cell.setAttribute('role', 'gridcell');
    cell.addEventListener('click', () => playMove(position));
    boardElement.appendChild(cell);
    cells.push(cell);
  }
  render();
}

function playMove(position) {
  if (gameOver) return;
  ArcadeSound.play('light');
  const row = Math.floor(position / SIZE);
  const column = position % SIZE;
  press(row, column);
  moves += 1;
  render();
  if (!board.some(Boolean)) {
    gameOver = true;
    if (!best || moves < best) {
      best = moves;
      localStorage.setItem('lightsOutBest', String(best));
    }
    render();
    setStatus(`Solved in ${moves} move${moves === 1 ? '' : 's'}!`, true);
    ArcadeSound.play('success');
  }
}

function resetPuzzle() {
  gameOver = false;
  board = [...startingBoard];
  moves = 0;
  render();
  setStatus('Puzzle reset. Turn off all the lights.');
}

function showSolution() {
  if (gameOver) return;
  solutionMoves.forEach(position => cells[position].classList.add('solution'));
  setStatus('Pink outlines show one solution path.');
}

function newGame() {
  gameOver = false;
  moves = 0;
  makePuzzle();
  createBoard();
  setStatus('Turn off all the lights to win.');
}

document.getElementById('newGame').addEventListener('click', newGame);
document.getElementById('reset').addEventListener('click', resetPuzzle);
document.getElementById('solve').addEventListener('click', showSolution);
difficultyElement.addEventListener('change', newGame);

newGame();
