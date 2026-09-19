const SIZE = 4;
const boardElement = document.getElementById('board');
const scoreElement = document.getElementById('score');
const bestElement = document.getElementById('best');
const statusElement = document.getElementById('status');

let board = [];
let score = 0;
let best = Number(localStorage.getItem('2048Best') || 0);
let won = false;
let gameOver = false;
let pointerStart = null;

bestElement.textContent = best;

function emptyCells() {
  const empty = [];
  board.forEach((row, rowIndex) => row.forEach((value, columnIndex) => {
    if (value === 0) empty.push({ row: rowIndex, column: columnIndex });
  }));
  return empty;
}

function addRandomTile() {
  const empty = emptyCells();
  if (!empty.length) return;
  const position = empty[Math.floor(Math.random() * empty.length)];
  board[position.row][position.column] = Math.random() < 0.9 ? 2 : 4;
}

function render() {
  boardElement.innerHTML = '';
  board.flat().forEach(value => {
    const tile = document.createElement('div');
    tile.className = `tile${value ? ` value-${value}` : ''}`;
    tile.textContent = value || '';
    tile.setAttribute('role', 'gridcell');
    tile.setAttribute('aria-label', value ? `Tile ${value}` : 'Empty tile');
    boardElement.appendChild(tile);
  });
  scoreElement.textContent = score;
  bestElement.textContent = best;
}

function slideLine(line) {
  const values = line.filter(Boolean);
  const result = [];
  let gained = 0;
  for (let index = 0; index < values.length; index += 1) {
    if (values[index] === values[index + 1]) {
      const merged = values[index] * 2;
      result.push(merged);
      gained += merged;
      index += 1;
      if (merged === 2048) won = true;
    } else {
      result.push(values[index]);
    }
  }
  while (result.length < SIZE) result.push(0);
  return { line: result, gained };
}

function move(direction) {
  if (gameOver) return;
  const before = JSON.stringify(board);
  let gained = 0;

  if (direction === 'left' || direction === 'right') {
    board = board.map(row => {
      const line = direction === 'right' ? [...row].reverse() : [...row];
      const result = slideLine(line);
      gained += result.gained;
      return direction === 'right' ? result.line.reverse() : result.line;
    });
  } else {
    const columns = [];
    for (let column = 0; column < SIZE; column += 1) {
      const line = board.map(row => row[column]);
      columns.push(direction === 'down' ? line.reverse() : line);
    }
    const movedColumns = columns.map(line => {
      const result = slideLine(line);
      gained += result.gained;
      return direction === 'down' ? result.line.reverse() : result.line;
    });
    board = Array.from({ length: SIZE }, (_, row) => movedColumns.map(column => column[row]));
  }

  if (JSON.stringify(board) === before) return;
  ArcadeSound.play(gained ? 'merge' : 'move');
  score += gained;
  if (score > best) {
    best = score;
    localStorage.setItem('2048Best', String(best));
  }
  addRandomTile();
  render();

  if (won) {
    ArcadeSound.play('success');
    statusElement.textContent = 'You reached 2048! Keep playing or start a new game.';
    statusElement.className = 'status success';
    won = false;
  } else if (!canMove()) {
    gameOver = true;
    ArcadeSound.play('error');
    statusElement.textContent = `Game over. Score: ${score}. Start a new game to try again.`;
    statusElement.className = 'status error';
  }
}

function canMove() {
  if (emptyCells().length) return true;
  for (let row = 0; row < SIZE; row += 1) {
    for (let column = 0; column < SIZE; column += 1) {
      const value = board[row][column];
      if (column < SIZE - 1 && value === board[row][column + 1]) return true;
      if (row < SIZE - 1 && value === board[row + 1][column]) return true;
    }
  }
  return false;
}

function newGame() {
  board = Array.from({ length: SIZE }, () => Array(SIZE).fill(0));
  score = 0;
  won = false;
  gameOver = false;
  addRandomTile();
  addRandomTile();
  statusElement.textContent = 'Join the tiles to reach 2048.';
  statusElement.className = 'status';
  render();
  boardElement.focus();
}

function directionFromKey(key) {
  return { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down' }[key];
}

boardElement.addEventListener('keydown', event => {
  const direction = directionFromKey(event.key);
  if (!direction) return;
  event.preventDefault();
  move(direction);
});

boardElement.addEventListener('pointerdown', event => {
  pointerStart = { x: event.clientX, y: event.clientY };
  boardElement.setPointerCapture?.(event.pointerId);
});

boardElement.addEventListener('pointerup', event => {
  if (!pointerStart) return;
  const deltaX = event.clientX - pointerStart.x;
  const deltaY = event.clientY - pointerStart.y;
  pointerStart = null;
  if (Math.max(Math.abs(deltaX), Math.abs(deltaY)) < 24) return;
  move(Math.abs(deltaX) > Math.abs(deltaY) ? deltaX > 0 ? 'right' : 'left' : deltaY > 0 ? 'down' : 'up');
});

boardElement.addEventListener('pointercancel', () => {
  pointerStart = null;
});

document.addEventListener('keydown', event => {
  const direction = directionFromKey(event.key);
  if (!direction || document.activeElement === boardElement) return;
  event.preventDefault();
  move(direction);
});

document.getElementById('newGame').addEventListener('click', newGame);
document.querySelectorAll('.direction-btn').forEach(button => {
  button.addEventListener('click', () => {
    move(button.dataset.direction);
    boardElement.focus();
  });
});
newGame();
