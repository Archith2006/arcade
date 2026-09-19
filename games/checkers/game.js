const SIZE = 8;
const RED = 'red';
const BLACK = 'black';

const boardElement = document.getElementById('board');
const turnStatusElement = document.getElementById('turnStatus');
const captureStatusElement = document.getElementById('captureStatus');
const statusElement = document.getElementById('status');
const modeElement = document.getElementById('mode');
const difficultyElement = document.getElementById('difficulty');

let board = [];
let initialBoard = [];
let currentPlayer = RED;
let selected = null;
let legalMoves = [];
let gameOver = false;
let aiThinking = false;

function makeInitialBoard() {
  const result = Array.from({ length: SIZE }, () => Array(SIZE).fill(null));
  for (let row = 0; row < 3; row += 1) {
    for (let column = 0; column < SIZE; column += 1) {
      if ((row + column) % 2 === 1) result[row][column] = { color: RED, king: false };
    }
  }
  for (let row = 5; row < SIZE; row += 1) {
    for (let column = 0; column < SIZE; column += 1) {
      if ((row + column) % 2 === 1) result[row][column] = { color: BLACK, king: false };
    }
  }
  return result;
}

function copyBoard(source) {
  return source.map(row => row.map(piece => piece ? { ...piece } : null));
}

function inBounds(row, column) {
  return row >= 0 && row < SIZE && column >= 0 && column < SIZE;
}

function directionsFor(piece) {
  if (piece.king) return [-1, 1];
  return piece.color === RED ? [1] : [-1];
}

function getMoves(row, column, captureOnly = false) {
  const piece = board[row][column];
  if (!piece) return [];
  const moves = [];
  directionsFor(piece).forEach(rowDirection => {
    [-1, 1].forEach(columnDirection => {
      const nextRow = row + rowDirection;
      const nextColumn = column + columnDirection;
      const jumpRow = row + rowDirection * 2;
      const jumpColumn = column + columnDirection * 2;
      if (!captureOnly && inBounds(nextRow, nextColumn) && !board[nextRow][nextColumn]) {
        moves.push({ row: nextRow, column: nextColumn, capture: null });
      }
      if (inBounds(jumpRow, jumpColumn) && board[nextRow]?.[nextColumn]?.color !== piece.color && board[nextRow]?.[nextColumn] && !board[jumpRow][jumpColumn]) {
        moves.push({ row: jumpRow, column: jumpColumn, capture: { row: nextRow, column: nextColumn } });
      }
    });
  });
  return moves;
}

function allCaptures(color) {
  const captures = [];
  board.forEach((row, rowIndex) => row.forEach((piece, columnIndex) => {
    if (piece?.color === color) {
      getMoves(rowIndex, columnIndex, true)
        .filter(move => move.capture)
        .forEach(move => captures.push({ from: { row: rowIndex, column: columnIndex }, ...move }));
    }
  }));
  return captures;
}

function allMoves(color) {
  const moves = [];
  board.forEach((row, rowIndex) => row.forEach((piece, columnIndex) => {
    if (piece?.color === color) {
      getMoves(rowIndex, columnIndex)
        .forEach(move => moves.push({ from: { row: rowIndex, column: columnIndex }, ...move }));
    }
  }));
  return moves;
}

function currentLegalMoves() {
  const captures = allCaptures(currentPlayer);
  return captures.length ? captures : allMoves(currentPlayer);
}

function isAiTurn() {
  return modeElement.value === 'ai' && currentPlayer === BLACK;
}

function clearSelection() {
  selected = null;
  legalMoves = [];
}

function setStatus(message, success = false) {
  statusElement.textContent = message;
  statusElement.className = `status${success ? ' success' : ''}`;
}

function render() {
  boardElement.innerHTML = '';
  const forcedCaptures = allCaptures(currentPlayer).length > 0;

  for (let row = 0; row < SIZE; row += 1) {
    for (let column = 0; column < SIZE; column += 1) {
      const square = document.createElement('button');
      square.type = 'button';
      square.className = `square ${(row + column) % 2 === 1 ? 'dark' : 'light'}`;
      square.setAttribute('role', 'gridcell');
      square.setAttribute('aria-label', `Row ${row + 1}, column ${column + 1}`);
      square.addEventListener('click', () => handleSquareClick(row, column));

      const isSelected = selected?.row === row && selected?.column === column;
      const move = legalMoves.find(item => item.row === row && item.column === column);
      if (isSelected) square.classList.add('selected');
      if (move) square.classList.add(move.capture ? 'capture' : 'legal');

      const piece = board[row][column];
      if (piece) {
        const pieceElement = document.createElement('span');
        pieceElement.className = `piece ${piece.color}${piece.king ? ' king' : ''}`;
        square.appendChild(pieceElement);
      }
      boardElement.appendChild(square);
    }
  }

  turnStatusElement.textContent = gameOver ? 'Game over' : isAiTurn() ? 'AI is thinking...' : modeElement.value === 'ai' ? 'Your turn' : `${capitalize(currentPlayer)}'s turn`;
  captureStatusElement.textContent = forcedCaptures ? 'A capture is required.' : 'Choose a piece to move.';
}

function capitalize(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function handleSquareClick(row, column) {
  if (gameOver || aiThinking || (row + column) % 2 === 0) return;

  const chosenMove = legalMoves.find(move => move.row === row && move.column === column);
  if (selected && chosenMove) {
    movePiece(selected, chosenMove);
    return;
  }

  const piece = board[row][column];
  if (piece?.color === currentPlayer) {
    const forcedCaptures = allCaptures(currentPlayer);
    const pieceMoves = getMoves(row, column, forcedCaptures.length > 0).filter(move => forcedCaptures.length ? move.capture : true);
    clearSelection();
    if (pieceMoves.length) {
      selected = { row, column };
      legalMoves = pieceMoves;
      setStatus(pieceMoves.some(move => move.capture) ? 'Choose a capture.' : 'Choose a highlighted square.');
    } else {
      setStatus('That piece cannot move right now.');
    }
    render();
    return;
  }

  clearSelection();
  render();
}

function movePiece(from, move) {
  ArcadeSound.play(move.capture ? 'success' : 'move');
  const piece = board[from.row][from.column];
  board[move.row][move.column] = piece;
  board[from.row][from.column] = null;
  if (move.capture) board[move.capture.row][move.capture.column] = null;

  if ((piece.color === RED && move.row === SIZE - 1) || (piece.color === BLACK && move.row === 0)) {
    piece.king = true;
  }

  if (move.capture) {
    const moreCaptures = getMoves(move.row, move.column, true).filter(nextMove => nextMove.capture);
    if (moreCaptures.length) {
      selected = { row: move.row, column: move.column };
      legalMoves = moreCaptures;
      setStatus(isAiTurn() ? 'AI is continuing its capture.' : 'Nice capture. Continue with the same piece.');
      render();
      if (isAiTurn()) setTimeout(aiTakeTurn, 450);
      return;
    }
  }

  currentPlayer = currentPlayer === RED ? BLACK : RED;
  clearSelection();
  checkGameOver();
  render();
  if (!gameOver) {
    setStatus(isAiTurn() ? 'AI is choosing a move.' : modeElement.value === 'ai' ? 'Your turn.' : `${capitalize(currentPlayer)}'s turn.`);
    if (isAiTurn()) setTimeout(aiTakeTurn, 450);
  }
}

function chooseAiMove(moves) {
  if (difficultyElement.value === 'easy') {
    return moves[Math.floor(Math.random() * moves.length)];
  }

  const scoredMoves = moves.map(move => {
    const piece = board[move.from.row][move.from.column];
    let score = move.capture ? 10 : 0;
    if (move.row === 0) score += 4;
    if (piece.king) score += 2;
    if (difficultyElement.value === 'hard') {
      const nextBoard = copyBoard(board);
      nextBoard[move.row][move.column] = nextBoard[move.from.row][move.from.column];
      nextBoard[move.from.row][move.from.column] = null;
      if (move.capture) nextBoard[move.capture.row][move.capture.column] = null;
      const opponentMoves = getMovesForBoard(nextBoard, RED).length;
      score += (24 - opponentMoves) * 0.4;
    }
    return { move, score: score + Math.random() * 0.5 };
  });
  return scoredMoves.sort((left, right) => right.score - left.score)[0].move;
}

function getMovesForBoard(nextBoard, color) {
  const savedBoard = board;
  board = nextBoard;
  const moves = allMoves(color);
  board = savedBoard;
  return moves;
}

function aiTakeTurn() {
  if (!isAiTurn() || gameOver) return;
  aiThinking = true;
  const moves = currentLegalMoves();
  if (!moves.length) {
    checkGameOver();
    aiThinking = false;
    render();
    return;
  }
  const chosenMove = selected ? legalMoves[Math.floor(Math.random() * legalMoves.length)] : chooseAiMove(moves);
  const from = selected || chosenMove.from;
  if (selected) clearSelection();
  movePiece(from, chosenMove);
  aiThinking = false;
}

function checkGameOver() {
  const pieces = board.flat().filter(Boolean);
  const opponent = currentPlayer === RED ? BLACK : RED;
  if (!pieces.some(piece => piece.color === opponent) || !allMoves(opponent).length) {
    gameOver = true;
    setStatus(`${capitalize(currentPlayer)} wins!`, true);
  }
}

function newGame() {
  initialBoard = makeInitialBoard();
  board = copyBoard(initialBoard);
  currentPlayer = RED;
  gameOver = false;
  aiThinking = false;
  clearSelection();
  setStatus('Red moves first.');
  render();
}

document.getElementById('newGame').addEventListener('click', newGame);
document.getElementById('reset').addEventListener('click', () => {
  board = copyBoard(initialBoard);
  currentPlayer = RED;
  gameOver = false;
  aiThinking = false;
  clearSelection();
  setStatus('Board reset. Red moves first.');
  render();
});

modeElement.addEventListener('change', newGame);
difficultyElement.addEventListener('change', newGame);

newGame();
