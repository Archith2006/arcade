const ROWS = 6;
const COLUMNS = 7;
const HUMAN = 'red';
const AI = 'yellow';
const EMPTY = null;
const SEARCH_DEPTH = { easy: 0, medium: 3, hard: 5 };

const boardElement = document.getElementById('board');
const modeElement = document.getElementById('mode');
const difficultyElement = document.getElementById('difficulty');
const turnStatusElement = document.getElementById('turnStatus');
const statusElement = document.getElementById('status');
const newGameButton = document.getElementById('newGame');

let board;
let currentPlayer;
let gameOver;
let aiThinking;
let winningCells = [];

function createBoard() { return Array.from({ length: ROWS }, () => Array(COLUMNS).fill(EMPTY)); }
function copyBoard(source) { return source.map(row => [...row]); }
function isAiTurn() { return modeElement.value === 'ai' && currentPlayer === AI; }
function setStatus(message, type = '') { statusElement.textContent = message; statusElement.className = `status ${type}`; }
function availableColumns(state = board) { return Array.from({ length: COLUMNS }, (_, column) => column).filter(column => state[0][column] === EMPTY); }

function dropDisc(state, column, player) {
  for (let row = ROWS - 1; row >= 0; row -= 1) {
    if (state[row][column] === EMPTY) { state[row][column] = player; return row; }
  }
  return -1;
}

function getWinningCells(state, player) {
  const directions = [[0, 1], [1, 0], [1, 1], [1, -1]];
  for (let row = 0; row < ROWS; row += 1) {
    for (let column = 0; column < COLUMNS; column += 1) {
      if (state[row][column] !== player) continue;
      for (const [rowStep, columnStep] of directions) {
        const cells = [];
        for (let count = 0; count < 4; count += 1) {
          const nextRow = row + rowStep * count;
          const nextColumn = column + columnStep * count;
          if (nextRow < 0 || nextRow >= ROWS || nextColumn < 0 || nextColumn >= COLUMNS || state[nextRow][nextColumn] !== player) break;
          cells.push([nextRow, nextColumn]);
        }
        if (cells.length === 4) return cells;
      }
    }
  }
  return [];
}

function render() {
  boardElement.innerHTML = '';
  for (let row = 0; row < ROWS; row += 1) {
    for (let column = 0; column < COLUMNS; column += 1) {
      const cell = document.createElement('button');
      cell.type = 'button';
      cell.className = `connect-cell ${board[row][column] || ''}`;
      cell.setAttribute('role', 'gridcell');
      cell.setAttribute('aria-label', `Row ${row + 1}, column ${column + 1}${board[row][column] ? `, ${board[row][column]} disc` : ', empty'}`);
      cell.disabled = gameOver || aiThinking || isAiTurn();
      cell.addEventListener('click', () => handleColumn(column));
      if (winningCells.some(([winningRow, winningColumn]) => winningRow === row && winningColumn === column)) cell.classList.add('winning');
      boardElement.appendChild(cell);
    }
  }
  turnStatusElement.textContent = gameOver ? 'Game over' : aiThinking ? 'AI is thinking...' : isAiTurn() ? 'AI turn' : modeElement.value === 'ai' ? 'Your turn' : `${currentPlayer === HUMAN ? 'Red' : 'Yellow'}'s turn`;
}

function finishTurn(row, column, player) {
  const winning = getWinningCells(board, player);
  if (winning.length) {
    winningCells = winning;
    gameOver = true;
    ArcadeSound.play('win');
    setStatus(`${player === HUMAN ? 'Red' : 'Yellow'} wins!`, 'success');
    render();
    return true;
  }
  if (!availableColumns().length) {
    gameOver = true;
    ArcadeSound.play('success');
    setStatus('Draw game. The board is full.', 'success');
    render();
    return true;
  }
  currentPlayer = player === HUMAN ? AI : HUMAN;
  render();
  if (isAiTurn()) {
    setStatus('AI is choosing a column.');
    setTimeout(aiTakeTurn, 350);
  } else setStatus(modeElement.value === 'ai' ? 'Choose a column to drop your disc.' : 'Choose a column.');
  return false;
}

function handleColumn(column) {
  if (gameOver || aiThinking || isAiTurn()) return;
  if (dropDisc(board, column, currentPlayer) === -1) {
    ArcadeSound.play('error');
    setStatus('That column is full.', 'error');
    return;
  }
  ArcadeSound.play('drop');
  finishTurn(0, column, currentPlayer);
}

function scoreWindow(window, player) {
  const opponent = player === AI ? HUMAN : AI;
  const playerCount = window.filter(cell => cell === player).length;
  const opponentCount = window.filter(cell => cell === opponent).length;
  const emptyCount = window.filter(cell => cell === EMPTY).length;
  if (playerCount === 4) return 100000;
  if (opponentCount === 4) return -100000;
  if (playerCount === 3 && emptyCount === 1) return 50;
  if (playerCount === 2 && emptyCount === 2) return 10;
  if (opponentCount === 3 && emptyCount === 1) return -70;
  return 0;
}

function evaluate(state) {
  let score = state.map(row => row[Math.floor(COLUMNS / 2)]).filter(cell => cell === AI).length * 6;
  const windows = [];
  for (let row = 0; row < ROWS; row += 1) for (let column = 0; column < COLUMNS; column += 1) {
    if (column <= COLUMNS - 4) windows.push([state[row][column], state[row][column + 1], state[row][column + 2], state[row][column + 3]]);
    if (row <= ROWS - 4) windows.push([state[row][column], state[row + 1][column], state[row + 2][column], state[row + 3][column]]);
    if (row <= ROWS - 4 && column <= COLUMNS - 4) windows.push([state[row][column], state[row + 1][column + 1], state[row + 2][column + 2], state[row + 3][column + 3]]);
    if (row <= ROWS - 4 && column >= 3) windows.push([state[row][column], state[row + 1][column - 1], state[row + 2][column - 2], state[row + 3][column - 3]]);
  }
  windows.forEach(window => { score += scoreWindow(window, AI); });
  return score;
}

function minimax(state, depth, maximizing, alpha, beta) {
  const aiWin = getWinningCells(state, AI).length > 0;
  const humanWin = getWinningCells(state, HUMAN).length > 0;
  const columns = availableColumns(state);
  if (aiWin) return 100000 + depth;
  if (humanWin) return -100000 - depth;
  if (!depth || !columns.length) return evaluate(state);
  if (maximizing) {
    let best = -Infinity;
    for (const column of columns) {
      const next = copyBoard(state);
      dropDisc(next, column, AI);
      best = Math.max(best, minimax(next, depth - 1, false, alpha, beta));
      alpha = Math.max(alpha, best);
      if (alpha >= beta) break;
    }
    return best;
  }
  let best = Infinity;
  for (const column of columns) {
    const next = copyBoard(state);
    dropDisc(next, column, HUMAN);
    best = Math.min(best, minimax(next, depth - 1, true, alpha, beta));
    beta = Math.min(beta, best);
    if (alpha >= beta) break;
  }
  return best;
}

function chooseAiColumn() {
  const columns = availableColumns();
  if (difficultyElement.value === 'easy') return columns[Math.floor(Math.random() * columns.length)];
  const depth = SEARCH_DEPTH[difficultyElement.value];
  let bestScore = -Infinity;
  let choices = [];
  columns.forEach(column => {
    const next = copyBoard(board);
    dropDisc(next, column, AI);
    const score = minimax(next, depth - 1, false, -Infinity, Infinity);
    if (score > bestScore) { bestScore = score; choices = [column]; }
    else if (score === bestScore) choices.push(column);
  });
  return choices[Math.floor(Math.random() * choices.length)];
}

function aiTakeTurn() {
  if (!isAiTurn() || gameOver) return;
  aiThinking = true;
  render();
  const column = chooseAiColumn();
  dropDisc(board, column, AI);
  ArcadeSound.play('drop');
  aiThinking = false;
  finishTurn(0, column, AI);
}

function resetGame() {
  board = createBoard();
  currentPlayer = HUMAN;
  gameOver = false;
  aiThinking = false;
  winningCells = [];
  setStatus(modeElement.value === 'ai' ? 'Choose a column to drop your disc.' : 'Red moves first.');
  render();
}

modeElement.addEventListener('change', resetGame);
difficultyElement.addEventListener('change', resetGame);
newGameButton.addEventListener('click', resetGame);
resetGame();