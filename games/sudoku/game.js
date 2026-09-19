const SIZE = 9;
const BOX_SIZE = 3;
const DIFFICULTY = {
  easy: 38,
  medium: 48,
  hard: 56
};

const boardElement = document.getElementById('board');
const difficultyElement = document.getElementById('difficulty');
const timerElement = document.getElementById('timer');
const mistakesElement = document.getElementById('mistakes');
const statusElement = document.getElementById('status');
const numberPadElement = document.getElementById('numberPad');
const numberCountElement = document.getElementById('numberCount');

let solution = [];
let puzzle = [];
let board = [];
let cells = [];
let mistakes = 0;
let seconds = 0;
let timerId;
let gameOver = false;
let selectedCell = null;
let selectedNumber = null;

function shuffled(values) {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

function makeSolution() {
  const numbers = shuffled([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  const pattern = (row, column) => (row * BOX_SIZE + Math.floor(row / BOX_SIZE) + column) % SIZE;
  const groups = [0, 1, 2];
  const rows = shuffled(groups).flatMap(group => shuffled(groups).map(row => group * BOX_SIZE + row));
  const columns = shuffled(groups).flatMap(group => shuffled(groups).map(column => group * BOX_SIZE + column));

  return rows.map(row => columns.map(column => numbers[pattern(row, column)]));
}

function makePuzzle(fullSolution) {
  const result = fullSolution.map(row => [...row]);
  const cellsToRemove = DIFFICULTY[difficultyElement.value];
  shuffled(Array.from({ length: SIZE * SIZE }, (_, index) => index))
    .slice(0, cellsToRemove)
    .forEach(index => {
      result[Math.floor(index / SIZE)][index % SIZE] = 0;
    });
  return result;
}

function setStatus(message, type = '') {
  statusElement.textContent = message;
  statusElement.className = `status ${type}`;
}

function formatTime(value) {
  const minutes = Math.floor(value / 60).toString().padStart(2, '0');
  const secondsValue = (value % 60).toString().padStart(2, '0');
  return `${minutes}:${secondsValue}`;
}

function startTimer() {
  clearInterval(timerId);
  timerId = setInterval(() => {
    if (!gameOver) {
      seconds += 1;
      timerElement.textContent = formatTime(seconds);
    }
  }, 1000);
}

function createBoard() {
  boardElement.innerHTML = '';
  cells = [];

  puzzle.forEach((row, rowIndex) => {
    row.forEach((value, columnIndex) => {
      const cell = document.createElement('button');
      cell.className = 'cell';
      cell.type = 'button';
      cell.textContent = value || '';
      cell.dataset.row = rowIndex;
      cell.dataset.column = columnIndex;
      cell.setAttribute('aria-label', `Row ${rowIndex + 1}, column ${columnIndex + 1}`);
      cell.addEventListener('click', () => selectCell(cell));

      if (value !== 0) {
        cell.classList.add('given');
      }

      boardElement.appendChild(cell);
      cells.push(cell);
    });
  });
  createNumberPad();
  highlightNumber();
}

function createNumberPad() {
  numberPadElement.innerHTML = '';
  for (let number = 1; number <= SIZE; number += 1) {
    const button = document.createElement('button');
    button.className = 'number-btn';
    button.type = 'button';
    button.dataset.number = number;
    button.innerHTML = `<span class="number-value">${number}</span><small class="number-remaining"></small>`;
    button.setAttribute('aria-label', `Enter ${number}`);
    button.addEventListener('click', () => enterNumber(number));
    numberPadElement.appendChild(button);
  }
}

function selectCell(cell) {
  if (gameOver) return;

  if (selectedCell === cell) {
    cell.classList.remove('selected');
    selectedCell = null;
    setStatus('Cell selection cleared.');
    return;
  }

  cells.forEach(boardCell => boardCell.classList.remove('selected'));
  selectedCell = cell;
  cell.classList.add('selected');
  const value = board[cell.dataset.row][cell.dataset.column];
  if (value) selectedNumber = value;
  highlightNumber();
  setStatus(cell.classList.contains('given') ? 'This is a starting number.' : 'Choose a number below to fill this square.');
}

function clearCellSelection() {
  if (!selectedCell) return;
  selectedCell.classList.remove('selected');
  selectedCell = null;
}

function enterNumber(number) {
  if (selectedNumber === number) {
    selectedNumber = null;
    highlightNumber();
    return;
  }

  selectedNumber = number;
  if (selectedCell && !selectedCell.classList.contains('given')) {
    const row = Number(selectedCell.dataset.row);
    const column = Number(selectedCell.dataset.column);
    board[row][column] = number;
    selectedCell.textContent = number;
    selectedCell.classList.remove('wrong', 'hint');
  }
  highlightNumber();
  markConflicts();
  checkWin();
}

function eraseSelected() {
  if (!selectedCell || selectedCell.classList.contains('given') || gameOver) return;
  const row = Number(selectedCell.dataset.row);
  const column = Number(selectedCell.dataset.column);
  board[row][column] = 0;
  selectedCell.textContent = '';
  selectedCell.classList.remove('wrong', 'hint');
  markConflicts();
  highlightNumber();
}

function highlightNumber() {
  cells.forEach(cell => {
    cell.classList.toggle('number-selected', Boolean(selectedNumber) && Number(cell.textContent) === selectedNumber);
  });
  document.querySelectorAll('.number-btn').forEach(button => {
    const number = Number(button.dataset.number);
    const count = board.flat().filter(value => value === number).length;
    const remaining = 9 - count;
    button.classList.toggle('active', number === selectedNumber);
    button.classList.toggle('complete', remaining === 0);
    button.querySelector('.number-remaining').textContent = remaining;
    button.setAttribute('aria-label', `Enter ${number}. ${remaining} remaining`);
  });
  if (selectedNumber) {
    const count = board.flat().filter(value => value === selectedNumber).length;
    numberCountElement.textContent = `Number ${selectedNumber}: ${count} of 9 on the board`;
  } else {
    numberCountElement.textContent = 'Select a number to see how many are on the board.';
  }
}

function getCell(row, column) {
  return cells[row * SIZE + column];
}

function markConflicts() {
  cells.forEach(cell => cell.classList.remove('conflict'));
  const markGroup = positions => {
    const seen = new Map();
    positions.forEach(([row, column]) => {
      const value = board[row][column];
      if (!value) return;
      if (!seen.has(value)) seen.set(value, []);
      seen.get(value).push([row, column]);
    });
    seen.forEach(positionsForValue => {
      if (positionsForValue.length > 1) {
        positionsForValue.forEach(([row, column]) => getCell(row, column).classList.add('conflict'));
      }
    });
  };

  for (let index = 0; index < SIZE; index += 1) {
    markGroup(Array.from({ length: SIZE }, (_, position) => [index, position]));
    markGroup(Array.from({ length: SIZE }, (_, position) => [position, index]));
  }
  for (let boxRow = 0; boxRow < SIZE; boxRow += BOX_SIZE) {
    for (let boxColumn = 0; boxColumn < SIZE; boxColumn += BOX_SIZE) {
      markGroup(Array.from({ length: SIZE }, (_, index) => [
        boxRow + Math.floor(index / BOX_SIZE),
        boxColumn + index % BOX_SIZE
      ]));
    }
  }
}

function checkWin() {
  if (board.some(row => row.some(value => value === 0))) return;
  if (board.some((row, rowIndex) => row.some((value, columnIndex) => value !== solution[rowIndex][columnIndex]))) return;

  gameOver = true;
  clearInterval(timerId);
  setStatus(`Solved in ${formatTime(seconds)}. Excellent work!`, 'success');
  cells.forEach(cell => cell.disabled = true);
}

function checkBoard() {
  if (gameOver) return;
  markConflicts();
  let incorrect = 0;
  cells.forEach((cell, index) => {
    const row = Math.floor(index / SIZE);
    const column = index % SIZE;
    if (!cell.classList.contains('given') && board[row][column] && board[row][column] !== solution[row][column]) {
      cell.classList.add('wrong');
      incorrect += 1;
    }
  });

  if (incorrect) {
    mistakes += 1;
    mistakesElement.textContent = mistakes;
    setStatus(`${incorrect} number${incorrect === 1 ? '' : 's'} need${incorrect === 1 ? 's' : ''} correction.`, 'error');
    if (mistakes >= 3) {
      setStatus('Three mistakes reached. Start a new game to try again.', 'error');
      gameOver = true;
      clearInterval(timerId);
      cells.forEach(cell => cell.disabled = true);
    }
  } else if (board.some(row => row.some(value => value === 0))) {
    setStatus('Everything filled so far is correct. Keep going!', 'success');
  } else {
    checkWin();
  }
}

function useHint() {
  if (gameOver) return;
  const emptyCells = cells.filter(cell => !cell.classList.contains('given') && !cell.textContent);
  if (!emptyCells.length) {
    setStatus('There are no empty squares for a hint.');
    return;
  }
  const cell = emptyCells[Math.floor(Math.random() * emptyCells.length)];
  const row = Number(cell.dataset.row);
  const column = Number(cell.dataset.column);
  cell.textContent = solution[row][column];
  cell.classList.add('hint');
  cell.classList.add('given');
  board[row][column] = solution[row][column];
  selectedNumber = solution[row][column];
  markConflicts();
  highlightNumber();
  setStatus('A correct number has been revealed.', 'success');
  checkWin();
}

function newGame() {
  gameOver = false;
  mistakes = 0;
  seconds = 0;
  selectedCell = null;
  selectedNumber = null;
  mistakesElement.textContent = mistakes;
  timerElement.textContent = formatTime(seconds);
  solution = makeSolution();
  puzzle = makePuzzle(solution);
  board = puzzle.map(row => [...row]);
  createBoard();
  setStatus('Choose a number for each empty square.');
  startTimer();
}

document.getElementById('newGame').addEventListener('click', newGame);
document.getElementById('check').addEventListener('click', checkBoard);
document.getElementById('hint').addEventListener('click', useHint);
document.getElementById('erase').addEventListener('click', eraseSelected);
difficultyElement.addEventListener('change', newGame);
document.addEventListener('click', event => {
  if (boardElement.contains(event.target) || numberPadElement.contains(event.target)) return;
  clearCellSelection();
});

newGame();
