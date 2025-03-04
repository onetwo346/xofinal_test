const cells = document.querySelectorAll("[data-cell]");
const statusDisplay = document.getElementById("status");
const restartBtn = document.getElementById("restartBtn");
const clearBtn = document.getElementById("clearBtn");
const pauseBtn = document.getElementById("pauseBtn");
const quitBtn = document.getElementById("quitBtn");
const colorXInput = document.getElementById("colorX");
const colorOInput = document.getElementById("colorO");
const applyColorsBtn = document.getElementById("applyColors");
const startBtn = document.getElementById("startBtn");
const descriptionPage = document.getElementById("descriptionPage");
const gamePage = document.getElementById("gamePage");
const modeToggle = document.getElementById("modeToggle");
const modeOptions = document.getElementById("modeOptions");
const difficultyOptions = document.getElementById("difficultyOptions");
const multiplayerSection = document.getElementById("multiplayerSection");
const generatePinBtn = document.getElementById("generatePinBtn");
const generatedCodeDisplay = document.getElementById("generatedCode");
const pinInput = document.getElementById("pinInput");
const joinBtn = document.getElementById("joinBtn");
const multiplayerStatus = document.getElementById("multiplayerStatus");
const chatSidebar = document.getElementById("chatSidebar");
const toggleChatBtn = document.getElementById("toggleChatBtn");
const chatContent = document.getElementById("chatContent");
const chatMessages = document.getElementById("chatMessages");
const chatInput = document.getElementById("chatInput");
const sendChatBtn = document.getElementById("sendChat");
const clickSound = document.getElementById("clickSound");
const winSound = document.getElementById("winSound");

// CHANGED: Replace isXNext with gameStarted to track first move
let gameStarted = false; // New flag for flexible start
let currentTurn = null;  // Tracks X or O after first move
let gameActive = true;
let isPaused = false;
let colorX = colorXInput.value;
let colorO = colorOInput.value;
let isAIMode = false;
let isOnlineMode = false;
let aiDifficulty = "beginner";
let playerSymbol = null;
let peer = null;
let conn = null;
let board = Array(9).fill(null);
let moveQueue = [];
let lastSyncTime = 0;

const winningCombinations = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6]
];

// Start Game
startBtn.addEventListener("click", () => {
  descriptionPage.style.display = "none";
  gamePage.style.display = "block";
  toggleMultiplayerControls();
  clickSound.play();
});

// Radial Mode Selector
modeToggle.addEventListener("click", () => {
  modeOptions.classList.toggle("active");
  if (!isAIMode) difficultyOptions.classList.remove("active");
  clickSound.play();
});

modeOptions.querySelectorAll(".radial-option").forEach(option => {
  option.addEventListener("click", (e) => {
    const mode = e.target.dataset.mode;
    isAIMode = mode === "ai";
    isOnlineMode = mode === "online";
    toggleMultiplayerControls();
    if (isAIMode) difficultyOptions.classList.add("active");
    else difficultyOptions.classList.remove("active");
    modeOptions.classList.remove("active");
    restartGame();
    clickSound.play();
  });
});

difficultyOptions.querySelectorAll(".radial-option").forEach(option => {
  option.addEventListener("click", (e) => {
    aiDifficulty = e.target.dataset.difficulty;
    difficultyOptions.classList.remove("active");
    if (isAIMode) restartGame();
    clickSound.play();
  });
});

// Toggle Multiplayer Controls
function toggleMultiplayerControls() {
  multiplayerSection.style.display = isOnlineMode ? "block" : "none";
  chatSidebar.style.display = isOnlineMode ? "block" : "none";
  chatContent.classList.remove("active");
  toggleChatBtn.textContent = "Open Comm";
  generatedCodeDisplay.textContent = "";
  multiplayerStatus.textContent = "";
  playerSymbol = null;
  if (peer) peer.destroy();
  conn = null;
  clearGrid();
}

// Generate Game Code
generatePinBtn.addEventListener("click", () => {
  if (peer) peer.destroy();
  peer = new Peer(generatePinCode(), {
    debug: 2,
    config: { iceServers: [{ urls: "stun:stun.l.google.com:19302" }, { urls: "turn:relay1.expressturn.com:3478", username: "user", credential: "pass" }] }
  });
  peer.on('open', (id) => {
    generatedCodeDisplay.textContent = `Your Code: ${id}`;
    multiplayerStatus.textContent = "Share this code or enter another to connect!";
    playerSymbol = null;
    gameActive = true;
  });
  peer.on('connection', (connection) => {
    conn = connection;
    playerSymbol = "X"; // Host is X, but won't force start
    // REMOVED: isXNext = true; Let first tap decide
    statusDisplay.textContent = "Awaiting First Move... (You: X)";
    setupConnection();
    multiplayerStatus.textContent = "Grid Linked! Engage!";
    chatContent.classList.add("active");
    toggleChatBtn.textContent = "Close Comm";
    syncBoard();
  });
  peer.on('error', (err) => {
    multiplayerStatus.textContent = `Error: ${err.type}. Retry generating code.`;
    console.error("PeerJS Error:", err);
  });
  clickSound.play();
});

function generatePinCode() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let pin = "";
  for (let i = 0; i < 6; i++) {
    pin += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return pin;
}

// Join Game
joinBtn.addEventListener("click", () => {
  const opponentCode = pinInput.value.trim().toUpperCase();
  if (!opponentCode) {
    statusDisplay.textContent = "Input a Code!";
    return;
  }
  if (!peer) {
    multiplayerStatus.textContent = "Generate your code first!";
    return;
  }
  conn = peer.connect(opponentCode, { reliable: true });
  playerSymbol = "O"; // Joiner is O, but won't force start
  // REMOVED: isXNext = true; Let first tap decide
  statusDisplay.textContent = "Awaiting First Move... (You: O)";
  gameActive = true;
  setupConnection();
  multiplayerStatus.textContent = "Linking...";
  clickSound.play();
});

// Setup PeerJS Connection
function setupConnection() {
  conn.on('open', () => {
    multiplayerStatus.textContent = "Grid Linked! Engage!";
    chatContent.classList.add("active");
    toggleChatBtn.textContent = "Close Comm";
    syncBoard();
    processMoveQueue();
  });
  conn.on('data', (data) => {
    if (!gameActive) return;
    if (data.type === "move") {
      board = data.board;
      updateBoard();
      gameStarted = true; // Mark game as started
      currentTurn = (data.board.filter(cell => cell).length % 2 === 0) ? "X" : "O"; // Infer next turn
      statusDisplay.textContent = `${currentTurn} Activates...`;
      clickSound.play();
      checkGameEnd();
    } else if (data.type === "chat") {
      displayChatMessage(data.message);
    } else if (data.type === "sync" || data.type === "clear") {
      board = data.board;
      updateBoard();
      gameStarted = false; // Reset for next first move
      currentTurn = null;
      statusDisplay.textContent = "Awaiting First Move...";
    } else if (data.type === "gameOver") {
      showWin(data.message);
      gameActive = false;
      winSound.play();
    }
  });
  conn.on('close', () => {
    statusDisplay.textContent = "Challenger Lost. Reset to Retry.";
    gameActive = false;
    multiplayerStatus.textContent = "Disconnected. Generate or join again.";
    chatContent.classList.remove("active");
    toggleChatBtn.textContent = "Open Comm";
  });
  conn.on('error', (err) => {
    console.error("Connection Error:", err);
    multiplayerStatus.textContent = "Link Issue. Try again.";
  });
}

// Draw Symbol
function drawSymbol(event) {
  if (!gameActive || isPaused) return;
  const cell = event.target;
  const index = [...cells].indexOf(cell);
  if (board[index]) return;

  if (isOnlineMode) {
    if (!playerSymbol) return; // No move until role is set
    // CHANGED: First tap sets the game in motion
    if (!gameStarted) {
      board[index] = playerSymbol;
      gameStarted = true;
      currentTurn = playerSymbol === "X" ? "O" : "X"; // Next turn is opponent
      updateBoard();
      clickSound.play();
      if (conn && conn.open) {
        conn.send({ type: "move", board });
        processMoveQueue();
      } else {
        moveQueue.push({ type: "move", board: [...board] });
        multiplayerStatus.textContent = "Buffering Move...";
      }
      statusDisplay.textContent = `${currentTurn} Activates...`;
    } else if (playerSymbol === currentTurn) { // Enforce turn after start
      board[index] = playerSymbol;
      currentTurn = playerSymbol === "X" ? "O" : "X";
      updateBoard();
      clickSound.play();
      if (conn && conn.open) {
        conn.send({ type: "move", board });
        processMoveQueue();
      } else {
        moveQueue.push({ type: "move", board: [...board] });
        multiplayerStatus.textContent = "Buffering Move...";
      }
      statusDisplay.textContent = `${currentTurn} Activates...`;
    } else {
      return; // Not your turn
    }
    checkGameEnd();
  } else {
    // Local and AI modes
    if (!gameStarted) {
      board[index] = "X"; // First tap is X in local/AI
      gameStarted = true;
      currentTurn = "O";
    } else {
      board[index] = currentTurn;
      currentTurn = currentTurn === "X" ? "O" : "X";
    }
    updateBoard();
    clickSound.play();

    if (checkWin(board[index])) {
      showWin(`${board[index]} Dominates!`);
      gameActive = false;
      winSound.play();
      return;
    }
    if (board.every(cell => cell)) {
      showWin("Gridlock!");
      gameActive = false;
      setTimeout(clearGrid, 2000);
      return;
    }

    statusDisplay.textContent = `${currentTurn} Activates...`;
    if (isAIMode && currentTurn === "O") setTimeout(makeAIMove, 500);
  }
}

// Process Queued Moves
function processMoveQueue() {
  while (moveQueue.length > 0 && conn && conn.open) {
    const move = moveQueue.shift();
    conn.send(move);
    multiplayerStatus.textContent = "Grid Linked! Engage!";
  }
}

// AI Move
function makeAIMove() {
  if (!gameActive || isPaused) return;
  const emptyCells = [...cells].filter((_, i) => !board[i]);
  if (emptyCells.length > 0) {
    let chosenCell;
    if (aiDifficulty === "beginner") {
      chosenCell = emptyCells[Math.floor(Math.random() * emptyCells.length)];
    } else if (aiDifficulty === "amateur") {
      chosenCell = getBestMove(emptyCells, "O");
    } else if (aiDifficulty === "pro") {
      chosenCell = getBestMove(emptyCells, "O", true);
    }
    chosenCell.click();
  }
}

// Get Best Move
function getBestMove(emptyCells, player, isPro = false) {
  if (isPro) {
    let bestMove, bestScore = -Infinity;
    emptyCells.forEach(cell => {
      const index = [...cells].indexOf(cell);
      board[index] = player;
      const score = minimax(board, 0, false);
      board[index] = null;
      if (score > bestScore) {
        bestScore = score;
        bestMove = cell;
      }
    });
    return bestMove;
  } else {
    for (let combination of winningCombinations) {
      const [a, b, c] = combination;
      if (board[a] === "O" && board[b] === "O" && !board[c] && emptyCells.includes(cells[c])) return cells[c];
      if (board[a] === "X" && board[b] === "X" && !board[c] && emptyCells.includes(cells[c])) return cells[c];
    }
    return emptyCells[Math.floor(Math.random() * emptyCells.length)];
  }
}

// Minimax Algorithm
function minimax(board, depth, isMaximizing) {
  if (checkWin("O")) return 10 - depth;
  if (checkWin("X")) return depth - 10;
  if (board.every(cell => cell)) return 0;

  if (isMaximizing) {
    let bestScore = -Infinity;
    board.forEach((cell, i) => {
      if (!cell) {
        board[i] = "O";
        const score = minimax(board, depth + 1, false);
        board[i] = null;
        bestScore = Math.max(score, bestScore);
      }
    });
    return bestScore;
  } else {
    let bestScore = Infinity;
    board.forEach((cell, i) => {
      if (!cell) {
        board[i] = "X";
        const score = minimax(board, depth + 1, true);
        board[i] = null;
        bestScore = Math.min(score, bestScore);
      }
    });
    return bestScore;
  }
}

// Check Win
function checkWin(symbol) {
  return winningCombinations.some(combination =>
    combination.every(index => board[index] === symbol)
  );
}

// Check Game End
function checkGameEnd() {
  const lastSymbol = isOnlineMode ? playerSymbol : (currentTurn === "X" ? "O" : "X"); // Last mover
  if (checkWin(lastSymbol)) {
    if (isOnlineMode && conn && conn.open) conn.send({ type: "gameOver", message: `${lastSymbol} Dominates!` });
    showWin(`${lastSymbol} Dominates!`);
    gameActive = false;
    winSound.play();
    setTimeout(clearGrid, 2000); // CHANGED: Auto-clear after win
  } else if (board.every(cell => cell)) {
    if (isOnlineMode && conn && conn.open) conn.send({ type: "gameOver", message: "Gridlock!" });
    showWin("Gridlock!");
    gameActive = false;
    setTimeout(clearGrid, 2000); // Already had this for draw, kept consistent
  }
}

// Show Win/Draw Overlay
function showWin(message) {
  const overlay = document.createElement("div");
  overlay.classList.add("win-overlay");
  const text = document.createElement("div");
  text.classList.add("win-text");
  text.textContent = message;
  overlay.appendChild(text);
  document.body.appendChild(overlay);
  overlay.classList.add("active");
  setTimeout(() => overlay.remove(), 2000);
}

// Clear Grid
function clearGrid() {
  // CHANGED: Don’t force isXNext = true, keep it flexible
  gameStarted = false;
  currentTurn = null;
  gameActive = true;
  isPaused = false;
  pauseBtn.textContent = "Pause";
  statusDisplay.textContent = "Awaiting First Move...";
  board = Array(9).fill(null);
  updateBoard();
  if (isOnlineMode && conn && conn.open) {
    conn.send({ type: "clear", board });
  }
  clickSound.play();
}

clearBtn.addEventListener("click", clearGrid);

// Restart Game
function restartGame() {
  // CHANGED: Don’t force isXNext = true, keep it flexible
  gameStarted = false;
  currentTurn = null;
  gameActive = true;
  isPaused = false;
  pauseBtn.textContent = "Pause";
  statusDisplay.textContent = "Awaiting First Move...";
  board = Array(9).fill(null);
  updateBoard();
  moveQueue = [];
  if (isOnlineMode && peer) {
    chatMessages.innerHTML = "";
    chatContent.classList.remove("active");
    toggleChatBtn.textContent = "Open Comm";
    multiplayerStatus.textContent = "Resetting...";
    generatedCodeDisplay.textContent = `Your Code: ${peer.id}`;
    pinInput.value = "";
    multiplayerStatus.textContent = "Share this code or enter another to connect!";
    if (conn && conn.open) conn.send({ type: "sync", board });
  } else {
    multiplayerStatus.textContent = "";
    generatedCodeDisplay.textContent = "";
  }
  clickSound.play();
}

// Sync Board
function syncBoard() {
  if (conn && conn.open && Date.now() - lastSyncTime > 500) {
    conn.send({ type: "sync", board });
    lastSyncTime = Date.now();
  }
}

// Update Board
function updateBoard() {
  cells.forEach((cell, index) => {
    cell.textContent = board[index] || "";
    cell.classList.remove("X", "O");
    if (board[index]) {
      cell.classList.add(board[index]);
      cell.style.color = board[index] === "X" ? colorX : colorO;
    }
  });
}

// Pause Game
pauseBtn.addEventListener("click", () => {
  if (!gameActive) return;
  isPaused = !isPaused;
  pauseBtn.textContent = isPaused ? "Resume" : "Pause";
  statusDisplay.textContent = isPaused ? "System Paused" : (gameStarted ? `${currentTurn} Activates...` : "Awaiting First Move...");
  clickSound.play();
});

// Quit Game
quitBtn.addEventListener("click", () => {
  if (confirm("Exit the Grid?")) {
    if (peer) peer.destroy();
    window.close();
  }
});

// Apply Colors
applyColorsBtn.addEventListener("click", () => {
  colorX = colorXInput.value;
  colorO = colorOInput.value;
  updateBoard();
  clickSound.play();
});

// Toggle Chat
toggleChatBtn.addEventListener("click", () => {
  chatContent.classList.toggle("active");
  toggleChatBtn.textContent = chatContent.classList.contains("active") ? "Close Comm" : "Open Comm";
  clickSound.play();
});

// Chat
sendChatBtn.addEventListener("click", sendChatMessage);
chatInput.addEventListener("keypress", (e) => {
  if (e.key === "Enter") sendChatMessage();
});

function sendChatMessage() {
  const message = chatInput.value.trim();
  if (message && isOnlineMode && conn && conn.open) {
    const fullMessage = `${playerSymbol}: ${message}`;
    conn.send({ type: "chat", message: fullMessage });
    displayChatMessage(fullMessage);
    chatInput.value = "";
    clickSound.play();
  }
}

function displayChatMessage(message) {
  const msgDiv = document.createElement("div");
  msgDiv.textContent = message;
  chatMessages.appendChild(msgDiv);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Cell Events
cells.forEach(cell => {
  cell.addEventListener("click", drawSymbol);
  cell.addEventListener("touchstart", (e) => {
    e.preventDefault();
    drawSymbol(e);
  }, { passive: false });
});

restartBtn.addEventListener("click", restartGame);
