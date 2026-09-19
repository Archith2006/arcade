const SIZE = 8;
const WHITE = 'white';
const BLACK = 'black';
const PIECES = { king: '♚', queen: '♛', rook: '♜', bishop: '♝', knight: '♞', pawn: '♟' };
const VALUES = { pawn: 100, knight: 320, bishop: 330, rook: 500, queen: 900, king: 20000 };

const boardElement = document.getElementById('board');
const modeElement = document.getElementById('mode');
const difficultyElement = document.getElementById('difficulty');
const turnStatusElement = document.getElementById('turnStatus');
const moveStatusElement = document.getElementById('moveStatus');
const statusElement = document.getElementById('status');
const whiteCapturedElement = document.getElementById('whiteCaptured');
const blackCapturedElement = document.getElementById('blackCaptured');
const promotionDialog = document.getElementById('promotionDialog');
const promotionChoices = document.getElementById('promotionChoices');

let board;
let turn;
let selected;
let legalMoves;
let captured = { white: [], black: [] };
let castling = { whiteKing: true, whiteQueen: true, blackKing: true, blackQueen: true };
let enPassant;
let lastMove;
let gameOver;
let aiThinking = false;
let pendingPromotion;
let moveHistory = [];

function piece(type, color) { return { type, color, moved: false }; }
function opposite(color) { return color === WHITE ? BLACK : WHITE; }
function inBounds(row, column) { return row >= 0 && row < SIZE && column >= 0 && column < SIZE; }
function cloneBoard(source) { return source.map(row => row.map(item => item ? { ...item } : null)); }
function capitalize(value) { return value.charAt(0).toUpperCase() + value.slice(1); }
function squareName(row, column) { return `${String.fromCharCode(97 + column)}${8 - row}`; }
function setStatus(message, type = '') { statusElement.textContent = message; statusElement.className = `status ${type}`; }

function initialBoard() {
  const result = Array.from({ length: SIZE }, () => Array(SIZE).fill(null));
  const backRank = ['rook', 'knight', 'bishop', 'queen', 'king', 'bishop', 'knight', 'rook'];
  backRank.forEach((type, column) => {
    result[0][column] = piece(type, BLACK);
    result[1][column] = piece('pawn', BLACK);
    result[6][column] = piece('pawn', WHITE);
    result[7][column] = piece(type, WHITE);
  });
  return result;
}

function addMove(moves, fromRow, fromColumn, row, column, extra = {}) {
  if (!inBounds(row, column)) return;
  const target = board[row][column];
  if (!target || target.color !== board[fromRow][fromColumn].color) {
    moves.push({ from: { row: fromRow, column: fromColumn }, to: { row, column }, captured: target || null, ...extra });
  }
}

function pseudoMoves(row, column, stateBoard = board, includeCastling = true) {
  const savedBoard = board;
  board = stateBoard;
  const current = board[row][column];
  const moves = [];
  if (!current) { board = savedBoard; return moves; }
  const addSliding = directions => directions.forEach(([rowStep, columnStep]) => {
    let nextRow = row + rowStep;
    let nextColumn = column + columnStep;
    while (inBounds(nextRow, nextColumn)) {
      const target = board[nextRow][nextColumn];
      if (!target) moves.push({ from: { row, column }, to: { row: nextRow, column: nextColumn }, captured: null });
      else {
        if (target.color !== current.color) moves.push({ from: { row, column }, to: { row: nextRow, column: nextColumn }, captured: target });
        break;
      }
      nextRow += rowStep;
      nextColumn += columnStep;
    }
  });

  if (current.type === 'pawn') {
    const direction = current.color === WHITE ? -1 : 1;
    const startRow = current.color === WHITE ? 6 : 1;
    const nextRow = row + direction;
    if (inBounds(nextRow, column) && !board[nextRow][column]) {
      moves.push({ from: { row, column }, to: { row: nextRow, column }, captured: null, promotion: nextRow === 0 || nextRow === 7 });
      const jumpRow = row + direction * 2;
      if (row === startRow && !board[jumpRow][column]) moves.push({ from: { row, column }, to: { row: jumpRow, column }, captured: null, doublePawn: true });
    }
    [-1, 1].forEach(columnStep => {
      const captureRow = row + direction;
      const captureColumn = column + columnStep;
      if (!inBounds(captureRow, captureColumn)) return;
      const target = board[captureRow][captureColumn];
      if (target && target.color !== current.color) moves.push({ from: { row, column }, to: { row: captureRow, column: captureColumn }, captured: target, promotion: captureRow === 0 || captureRow === 7 });
      if (enPassant && enPassant.row === captureRow && enPassant.column === captureColumn) {
        const pawn = board[row][captureColumn];
        if (pawn?.type === 'pawn' && pawn.color !== current.color) moves.push({ from: { row, column }, to: { row: captureRow, column: captureColumn }, captured: pawn, enPassant: true });
      }
    });
  } else if (current.type === 'knight') {
    [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]].forEach(([r, c]) => addMove(moves, row, column, row + r, column + c));
  } else if (current.type === 'bishop') addSliding([[-1, -1], [-1, 1], [1, -1], [1, 1]]);
  else if (current.type === 'rook') addSliding([[-1, 0], [1, 0], [0, -1], [0, 1]]);
  else if (current.type === 'queen') addSliding([[-1, -1], [-1, 1], [1, -1], [1, 1], [-1, 0], [1, 0], [0, -1], [0, 1]]);
  else if (current.type === 'king') {
    for (let rowStep = -1; rowStep <= 1; rowStep += 1) for (let columnStep = -1; columnStep <= 1; columnStep += 1) if (rowStep || columnStep) addMove(moves, row, column, row + rowStep, column + columnStep);
    if (includeCastling && !current.moved && !isInCheck(current.color)) {
      const rights = current.color === WHITE ? ['whiteKing', 'whiteQueen'] : ['blackKing', 'blackQueen'];
      const homeRow = current.color === WHITE ? 7 : 0;
      const kingRook = board[homeRow][7];
      const queenRook = board[homeRow][0];
      if (castling[rights[0]] && kingRook?.type === 'rook' && kingRook.color === current.color && !board[homeRow][5] && !board[homeRow][6] && !isSquareAttacked(homeRow, 5, opposite(current.color)) && !isSquareAttacked(homeRow, 6, opposite(current.color))) moves.push({ from: { row, column }, to: { row: homeRow, column: 6 }, captured: null, castle: 'king' });
      if (castling[rights[1]] && queenRook?.type === 'rook' && queenRook.color === current.color && !board[homeRow][1] && !board[homeRow][2] && !board[homeRow][3] && !isSquareAttacked(homeRow, 3, opposite(current.color)) && !isSquareAttacked(homeRow, 2, opposite(current.color))) moves.push({ from: { row, column }, to: { row: homeRow, column: 2 }, captured: null, castle: 'queen' });
    }
  }
  board = savedBoard;
  return moves;
}

function findKing(color, stateBoard = board) {
  for (let row = 0; row < SIZE; row += 1) for (let column = 0; column < SIZE; column += 1) if (stateBoard[row][column]?.type === 'king' && stateBoard[row][column].color === color) return { row, column };
  return null;
}

function isSquareAttacked(row, column, byColor, stateBoard = board) {
  for (let sourceRow = 0; sourceRow < SIZE; sourceRow += 1) for (let sourceColumn = 0; sourceColumn < SIZE; sourceColumn += 1) {
    const current = stateBoard[sourceRow][sourceColumn];
    if (!current || current.color !== byColor) continue;
    if (current.type === 'pawn') {
      const direction = byColor === WHITE ? -1 : 1;
      if (sourceRow + direction === row && Math.abs(sourceColumn - column) === 1) return true;
    } else if (pseudoMoves(sourceRow, sourceColumn, stateBoard, false).some(move => move.to.row === row && move.to.column === column)) return true;
  }
  return false;
}

function isInCheck(color, stateBoard = board) {
  const king = findKing(color, stateBoard);
  return king ? isSquareAttacked(king.row, king.column, opposite(color), stateBoard) : true;
}

function applyMove(move, stateBoard = board) {
  const next = cloneBoard(stateBoard);
  const moving = { ...next[move.from.row][move.from.column], moved: true };
  next[move.from.row][move.from.column] = null;
  next[move.to.row][move.to.column] = moving;
  if (move.enPassant) next[move.from.row][move.to.column] = null;
  if (move.castle === 'king') {
    next[move.to.row][5] = { ...next[move.to.row][7], moved: true };
    next[move.to.row][7] = null;
  }
  if (move.castle === 'queen') {
    next[move.to.row][3] = { ...next[move.to.row][0], moved: true };
    next[move.to.row][0] = null;
  }
  return next;
}

function legalMovesFor(color, stateBoard = board) {
  const result = [];
  for (let row = 0; row < SIZE; row += 1) for (let column = 0; column < SIZE; column += 1) {
    if (stateBoard[row][column]?.color !== color) continue;
    pseudoMoves(row, column, stateBoard).forEach(move => {
      const next = applyMove(move, stateBoard);
      if (!isInCheck(color, next)) result.push(move);
    });
  }
  return result;
}

function updateRights(move, moving) {
  if (moving.type === 'king') {
    castling[`${moving.color}King`] = false;
    castling[`${moving.color}Queen`] = false;
  }
  if (moving.type === 'rook') {
    if (moving.color === WHITE && move.from.row === 7 && move.from.column === 0) castling.whiteQueen = false;
    if (moving.color === WHITE && move.from.row === 7 && move.from.column === 7) castling.whiteKing = false;
    if (moving.color === BLACK && move.from.row === 0 && move.from.column === 0) castling.blackQueen = false;
    if (moving.color === BLACK && move.from.row === 0 && move.from.column === 7) castling.blackKing = false;
  }
}

function performMove(move, promotionType = 'queen') {
  ArcadeSound.play(move.captured || move.enPassant ? 'success' : 'move');
  const moving = board[move.from.row][move.from.column];
  updateRights(move, moving);
  if (move.captured) captured[moving.color].push(move.captured.type);
  board = applyMove(move, board);
  if (move.promotion) board[move.to.row][move.to.column].type = promotionType;
  if (move.doublePawn) enPassant = { row: (move.from.row + move.to.row) / 2, column: move.from.column };
  else enPassant = null;
  lastMove = move;
  const moveText = `${squareName(move.from.row, move.from.column)} to ${squareName(move.to.row, move.to.column)}${move.promotion ? `, promoted to ${promotionType}` : ''}`;
  moveHistory = [...moveHistory, moveText].slice(-3);
  moveStatusElement.textContent = `Recent moves: ${moveHistory.join(' | ')}`;
  turn = opposite(turn);
  selected = null;
  legalMoves = [];
  evaluatePosition();
  render();
  if (!gameOver && modeElement.value === 'ai' && turn === BLACK) setTimeout(aiMove, 350);
}

function selectSquare(row, column) {
  if (gameOver || aiThinking || (modeElement.value === 'ai' && turn === BLACK)) return;
  const chosen = legalMoves.find(move => move.to.row === row && move.to.column === column);
  if (selected && chosen) {
    if (chosen.promotion) openPromotion(chosen);
    else performMove(chosen);
    return;
  }
  if (board[row][column]?.color === turn) {
    selected = { row, column };
    legalMoves = legalMovesFor(turn).filter(move => move.from.row === row && move.from.column === column);
    setStatus(legalMoves.length ? 'Choose a highlighted destination.' : 'This piece has no legal moves.');
  } else {
    selected = null;
    legalMoves = [];
  }
  render();
}

function evaluatePosition() {
  const moves = legalMovesFor(turn);
  if (moves.length) {
    const check = isInCheck(turn);
    setStatus(check ? `${capitalize(turn)} is in check.` : 'Select a piece to see its legal moves.', check ? 'check' : '');
    return;
  }
  gameOver = true;
  if (isInCheck(turn)) {
    const winner = opposite(turn);
    setStatus(`Checkmate! ${capitalize(winner)} wins.`, 'checkmate');
    turnStatusElement.textContent = `${capitalize(winner)} wins`;
  } else {
    setStatus('Draw by stalemate.', 'draw');
    turnStatusElement.textContent = 'Draw';
  }
}

function render() {
  boardElement.innerHTML = '';
  const checkedKing = isInCheck(turn) ? findKing(turn) : null;
  const destinations = new Map(legalMoves.map(move => [`${move.to.row},${move.to.column}`, move]));
  for (let row = 0; row < SIZE; row += 1) for (let column = 0; column < SIZE; column += 1) {
    const square = document.createElement('button');
    square.type = 'button';
    square.className = `square ${(row + column) % 2 ? 'dark' : 'light'}`;
    if (selected?.row === row && selected?.column === column) square.classList.add('selected');
    if (lastMove && ((lastMove.from.row === row && lastMove.from.column === column) || (lastMove.to.row === row && lastMove.to.column === column))) square.classList.add('last-move');
    if (lastMove?.to.row === row && lastMove?.to.column === column) square.classList.add('destination');
    if (checkedKing?.row === row && checkedKing?.column === column) square.classList.add('check');
    const destination = destinations.get(`${row},${column}`);
    if (destination) square.classList.add(destination.captured ? 'capture' : 'legal');
    square.setAttribute('aria-label', `${squareName(row, column)}${board[row][column] ? ` ${board[row][column].color} ${board[row][column].type}` : ''}`);
    square.addEventListener('click', () => selectSquare(row, column));
    const current = board[row][column];
    if (current) {
      const pieceElement = document.createElement('span');
      pieceElement.className = `piece ${current.color}`;
      pieceElement.textContent = PIECES[current.type];
      square.appendChild(pieceElement);
    }
    boardElement.appendChild(square);
  }
  turnStatusElement.textContent = gameOver ? turnStatusElement.textContent : modeElement.value === 'ai' ? turn === WHITE ? 'Your turn' : 'AI turn' : `${capitalize(turn)}'s turn`;
  blackCapturedElement.textContent = captured.white.map(type => PIECES[type]).join(' ');
  whiteCapturedElement.textContent = captured.black.map(type => PIECES[type]).join(' ');
}

function openPromotion(move) {
  pendingPromotion = move;
  promotionChoices.innerHTML = '';
  ['queen', 'rook', 'bishop', 'knight'].forEach(type => {
    const button = document.createElement('button');
    button.className = 'promotion-choice';
    button.type = 'button';
    button.textContent = PIECES[type];
    button.setAttribute('aria-label', `Promote to ${type}`);
    button.addEventListener('click', () => {
      promotionDialog.close();
      performMove(pendingPromotion, type);
      pendingPromotion = null;
    });
    promotionChoices.appendChild(button);
  });
  promotionDialog.showModal();
}

function evaluateBoard(stateBoard) {
  return stateBoard.flat().reduce((total, current) => total + (current ? (current.color === BLACK ? VALUES[current.type] : -VALUES[current.type]) : 0), 0);
}

function aiMove() {
  if (gameOver || modeElement.value !== 'ai' || turn !== BLACK) return;
  aiThinking = true;
  const moves = legalMovesFor(BLACK);
  if (!moves.length) { aiThinking = false; evaluatePosition(); render(); return; }
  let chosen = moves[Math.floor(Math.random() * moves.length)];
  if (difficultyElement.value !== 'easy') {
    const scored = moves.map(move => ({ move, score: evaluateBoard(applyMove(move, board)) + (move.captured ? VALUES[move.captured.type] : 0) + Math.random() * (difficultyElement.value === 'medium' ? 180 : 30) }));
    chosen = scored.sort((left, right) => right.score - left.score)[0].move;
  }
  aiThinking = false;
  if (chosen.promotion) performMove(chosen, 'queen');
  else performMove(chosen);
}

function newGame() {
  board = initialBoard();
  turn = WHITE;
  selected = null;
  legalMoves = [];
  captured = { white: [], black: [] };
  castling = { whiteKing: true, whiteQueen: true, blackKing: true, blackQueen: true };
  enPassant = null;
  lastMove = null;
  moveHistory = [];
  moveStatusElement.textContent = 'Last move: -';
  gameOver = false;
  aiThinking = false;
  setStatus('Select a piece to see its legal moves.');
  render();
}

modeElement.addEventListener('change', newGame);
difficultyElement.addEventListener('change', newGame);
document.getElementById('newGame').addEventListener('click', newGame);
newGame();
