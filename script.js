// DOM Elements
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

// Game State
let isXNext = true;
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
let gameEndTimeout = null;

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
  playSound(clickSound);
});

// Play sound with error handling
function playSound(sound) {
  if (sound && sound.play) {
    sound.play().catch(err => console.log("Sound play error:", err));
  }
}

// Radial Mode Selector
modeToggle.addEventListener("click", () => {
  modeOptions.classList.toggle("active");
  if (!isAIMode) difficultyOptions.classList.remove("active");
  playSound(clickSound);
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
    playSound(clickSound);
  });
});

difficultyOptions.querySelectorAll(".radial-option").forEach(option => {
  option.addEventListener("click", (e) => {
    aiDifficulty = e.target.dataset.difficulty;
    difficultyOptions.classList.remove("active");
    if (isAIMode) restartGame();
    playSound(clickSound);
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
  
  // Check if PeerJS is available
  if (typeof Peer !== 'function') {
    multiplayerStatus.textContent = "Error: PeerJS library not loaded. Check your internet connection.";
    return;
  }
  
  try {
    peer = new Peer(generatePinCode(), {
      debug: 2,
      config: { 
        iceServers: [
          { urls: "stun:stun.l.google.com:19302" }, 
          { urls: "turn:relay1.expressturn.com:3478", username: "user", credential: "pass" }
        ] 
      }
    });
    
    peer.on('open', (id) => {
      generatedCodeDisplay.textContent = `Your Code: ${id}`;
      multiplayerStatus.textContent = "Share this code or enter another to connect!";
      playerSymbol = null;
      gameActive = true;
      statusDisplay.textContent = "Awaiting First Move...";
    });
    
    peer.on('connection', (connection) => {
      conn = connection;
      multiplayerStatus.textContent = "User Connected! Getting ready...";
      setupConnection();
    });
    
    peer.on('error', (err) => {
      multiplayerStatus.textContent = `Connection Error: ${err.type}. Please try again.`;
      console.error("PeerJS Error:", err);
    });
    
    playSound(clickSound);
  } catch (error) {
    multiplayerStatus.textContent = "Error initializing connection. Check your internet connection.";
    console.error("PeerJS initialization error:", error);
  }
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
    multiplayerStatus.textContent = "Please enter a code to join.";
    return;
  }
  
  if (!peer) {
    multiplayerStatus.textContent = "Generate your code first!";
    return;
  }
  
  try {
    conn = peer.connect(opponentCode, { reliable: true });
    multiplayerStatus.textContent = "Connecting...";
    setupConnection();
    playSound(clickSound);
  } catch (error) {
    multiplayerStatus.textContent = "Failed to connect. Check the code and try again.";
    console.error("Connection error:", error);
  }
});

// Setup PeerJS Connection
function setupConnection() {
  if (!conn) return;
  
  conn.on('open', () => {
    multiplayerStatus.textContent = "Grid Linked! Engage!";
    chatContent.classList.add("active");
    toggleChatBtn.textContent = "Close Comm";
    
    // Determine player symbols based on connection type
    if (conn.metadata && conn.metadata.host) {
      playerSymbol = "X"; // Joining player is X by default
    } else {
      playerSymbol = "O"; // Host is O by default
    }
    
    // However, first click will determine actual symbols
    statusDisplay.textContent = `Awaiting First Move... (You: ${playerSymbol || '?'})`;
    gameActive = true;
    
    syncBoard();
    processMoveQueue();
  });
  
  conn.on('data', (data) => {
    handleConnectionData(data);
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

// Handle incoming connection data
function handleConnectionData(data) {
  if (!gameActive && data.type !== "clear" && data.type !== "gameOver") return;
  
  switch (data.type) {
    case "move":
      handleMoveData(data);
      break;
    case "chat":
      displayChatMessage(data.message);
      break;
    case "sync":
    case "clear":
      board = data.board;
      updateBoard();
      statusDisplay.textContent = "Awaiting First Move...";
      if (data.type === "clear") {
        gameActive = true;
        isPaused = false;
        pauseBtn.textContent = "Pause";
      }
      break;
    case "gameOver":
      showWin(data.message);
      gameActive = false;
      playSound(winSound);
      scheduleAutoReset();
      break;
  }
}

// Handle move data from opponent
function handleMoveData(data) {
  board = data.board;
  updateBoard();
  
  // Determine who made the move
  const moveSymbol = determineLastMoveSymbol();
  isXNext = moveSymbol === "X" ? false : true;
  
  // Update player symbol if this is the first move and we don't have it set
  if (!playerSymbol && moveSymbol) {
    playerSymbol = moveSymbol === "X" ? "O" : "X";
    statusDisplay.textContent = `${isXNext ? "X" : "O"} Activates... (You: ${playerSymbol})`;
  } else {
    statusDisplay.textContent = `${isXNext ? "X" : "O"} Activates...`;
  }
  
  playSound(clickSound);
  checkGameEnd();
}

// Determine the symbol of the last player who moved
function determineLastMoveSymbol() {
  const xCount = board.filter(cell => cell === "X").length;
  const oCount = board.filter(cell => cell === "O").length;
  
  if (xCount > oCount) {
    return "X";
  } else if (oCount > xCount) {
    return "O";
  } else if (xCount === oCount) {
    // First move hasn't happened or it's a tie
    return board.find(cell => cell) || null;
  }
  return null;
}

// Process Queued Moves
function processMoveQueue() {
  while (moveQueue.length > 0 && conn && conn.open) {
    const move = moveQueue.shift();
    conn.send(move);
    multiplayerStatus.textContent = "Grid Linked! Engage!";
  }
}

// Draw Symbol
function drawSymbol(event) {
  if (!gameActive || isPaused) return;
  
  const cell = event.target;
  const index = [...cells].indexOf(cell);
  
  // Don't allow moves on already filled cells
  if (board[index]) return;

  if (isOnlineMode) {
    handleOnlineMove(index);
  } else {
    handleLocalMove(index);
  }
}

// Handle move in online mode
function handleOnlineMove(index) {
  const isFirstMove = board.every(cell => !cell);
  
  // For first move, establish player symbols
  if (isFirstMove) {
    // First player to move becomes X
    playerSymbol = "X";
    board[index] = playerSymbol;
    isXNext = false; // Next turn is O
    
    // Update status and inform the other player
    statusDisplay.textContent = `${isXNext ? "X" : "O"} Activates... (You: ${playerSymbol})`;
    multiplayerStatus.textContent = "You're X! You moved first.";
  } else {
    // After first move, enforce taking turns
    if (!playerSymbol) {
      statusDisplay.textContent = "Wait for opponent to make first move";
      return;
    }
    
    // Check if it's this player's turn
    const expectedSymbol = isXNext ? "X" : "O";
    if (playerSymbol !== expectedSymbol) {
      statusDisplay.textContent = "Not your turn";
      return;
    }
    
    // Make the move
    board[index] = playerSymbol;
    isXNext = !isXNext;
    statusDisplay.textContent = `${isXNext ? "X" : "O"} Activates...`;
  }
  
  // Update board and send move to opponent
  updateBoard();
  playSound(clickSound);
  
  if (conn && conn.open) {
    conn.send({ type: "move", board });
    processMoveQueue();
  } else {
    moveQueue.push({ type: "move", board: [...board] });
    multiplayerStatus.textContent = "Buffering Move...";
  }
  
  // Check if game has ended
  checkGameEnd();
}

// Handle move in local/AI mode
function handleLocalMove(index) {
  const currentSymbol = isXNext ? "X" : "O";
  board[index] = currentSymbol;
  updateBoard();
  playSound(clickSound);
  
  // Check for win or draw
  if (checkWin(currentSymbol)) {
    showWin(`${currentSymbol} Dominates!`);
    gameActive = false;
    playSound(winSound);
    scheduleAutoReset();
    return;
  }
  
  if (board.every(cell => cell)) {
    showWin("Gridlock!");
    gameActive = false;
    scheduleAutoReset();
    return;
  }
  
  // Next player's turn
  isXNext = !isXNext;
  statusDisplay.textContent = `${isXNext ? "X" : "O"} Activates...`;
  
  // AI move if applicable
  if (isAIMode && !isXNext) {
    setTimeout(makeAIMove, 500);
  }
}

// Schedule automatic board reset
function scheduleAutoReset() {
  // Clear any existing timeout
  if (gameEndTimeout) {
    clearTimeout(gameEndTimeout);
  }
  
  // Set new timeout
  gameEndTimeout = setTimeout(() => {
    clearGrid();
    // For online mode, make sure to send the clear command
    if (isOnlineMode && conn && conn.open) {
      conn.send({ type: "clear", board: Array(9).fill(null) });
    }
  }, 2000);
}

// AI Move
function makeAIMove() {
  if (!gameActive || isPaused) return;
  
  const emptyCells = [...cells].filter((_, i) => !board[i]);
  if (emptyCells.length > 0) {
    let chosenCell;
    
    switch (aiDifficulty) {
      case "pro":
        chosenCell = getBestMove(emptyCells, "O", true);
        break;
      case "amateur":
        chosenCell = getBestMove(emptyCells, "O", false);
        break;
      case "beginner":
      default:
        chosenCell = emptyCells[Math.floor(Math.random() * emptyCells.length)];
        break;
    }
    
    // Simulate click on the chosen cell
    chosenCell.click();
  }
}

// Get Best Move for AI
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
    // Look for winning or blocking moves
    for (let combination of winningCombinations) {
      const [a, b, c] = combination;
      
      // Check if AI can win
      if (board[a] === "O" && board[b] === "O" && !board[c] && emptyCells.includes(cells[c])) 
        return cells[c];
      if (board[a] === "O" && !board[b] && board[c] === "O" && emptyCells.includes(cells[b])) 
        return cells[b];
      if (!board[a] && board[b] === "O" && board[c] === "O" && emptyCells.includes(cells[a])) 
        return cells[a];
      
      // Check if AI needs to block
      if (board[a] === "X" && board[b] === "X" && !board[c] && emptyCells.includes(cells[c])) 
        return cells[c];
      if (board[a] === "X" && !board[b] && board[c] === "X" && emptyCells.includes(cells[b])) 
        return cells[b];
      if (!board[a] && board[b] === "X" && board[c] === "X" && emptyCells.includes(cells[a])) 
        return cells[a];
    }
    
    // Try to take center if available
    if (board[4] === null && emptyCells.includes(cells[4])) {
      return cells[4];
    }
    
    // Random move if no strategic move found
    return emptyCells[Math.floor(Math.random() * emptyCells.length)];
  }
}

// Minimax Algorithm for Pro AI
function minimax(board, depth, isMaximizing) {
  // Terminal states
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
  // Find the last player who moved
  const xCount = board.filter(cell => cell === "X").length;
  const oCount = board.filter(cell => cell === "O").length;
  const lastPlayer = xCount > oCount ? "X" : "O";
  
  if (checkWin(lastPlayer)) {
    if (isOnlineMode && conn && conn.open) {
      conn.send({ type: "gameOver", message: `${lastPlayer} Dominates!` });
    }
    showWin(`${lastPlayer} Dominates!`);
    gameActive = false;
    playSound(winSound);
    scheduleAutoReset();
  } else if (board.every(cell => cell)) {
    if (isOnlineMode && conn && conn.open) {
      conn.send({ type: "gameOver", message: "Gridlock!" });
    }
    showWin("Gridlock!");
    gameActive = false;
    scheduleAutoReset();
  }
}

// Show Win/Draw Overlay
function showWin(message) {
  // Remove any existing overlay first
  const existingOverlay = document.querySelector(".win-overlay");
  if (existingOverlay) {
    existingOverlay.remove();
  }
  
  const overlay = document.createElement("div");
  overlay.classList.add("win-overlay");
  const text = document.createElement("div");
  text.classList.add("win-text");
  text.textContent = message;
  overlay.appendChild(text);
  document.body.appendChild(overlay);
  
  // Small delay to ensure DOM update before adding active class
  setTimeout(() => overlay.classList.add("active"), 10);
  setTimeout(() => overlay.remove(), 2000);
}

// Clear Grid
function clearGrid() {
  // Cancel any scheduled reset
  if (gameEndTimeout) {
    clearTimeout(gameEndTimeout);
    gameEndTimeout = null;
  }
  
  gameActive = true;
  isPaused = false;
  pauseBtn.textContent = "Pause";
  board = Array(9).fill(null);
  updateBoard();
  
  if (isOnlineMode) {
    statusDisplay.textContent = "Awaiting First Move...";
    // We don't reset playerSymbol here to maintain roles after a game
  } else {
    isXNext = true; // Local/AI default
    statusDisplay.textContent = `${isXNext ? "X" : "O"} Activates...`;
  }
  
  playSound(clickSound);
}

// Clear button event
clearBtn.addEventListener("click", clearGrid);

// Restart Game
function restartGame() {
  // Cancel any scheduled reset
  if (gameEndTimeout) {
    clearTimeout(gameEndTimeout);
    gameEndTimeout = null;
  }
  
  gameActive = true;
  isPaused = false;
  pauseBtn.textContent = "Pause";
  board = Array(9).fill(null);
  updateBoard();
  moveQueue = [];
  
  if (isOnlineMode && peer) {
    chatMessages.innerHTML = "";
    chatContent.classList.remove("active");
    toggleChatBtn.textContent = "Open Comm";
    multiplayerStatus.textContent = "Resetting...";
    
    if (peer.id) {
      generatedCodeDisplay.textContent = `Your Code: ${peer.id}`;
    }
    
    pinInput.value = "";
    playerSymbol = null; // Reset symbol for new game
    
    multiplayerStatus.textContent = "Share this code or enter another to connect!";
    
    if (conn && conn.open) {
      conn.send({ type: "sync", board });
    }
    
    statusDisplay.textContent = "Awaiting First Move...";
  } else {
    isXNext = true; // Local/AI default
    multiplayerStatus.textContent = "";
    generatedCodeDisplay.textContent = "";
    statusDisplay.textContent = `${isXNext ? "X" : "O"} Activates...`;
  }
  
  playSound(clickSound);
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
  statusDisplay.textContent = isPaused ? "System Paused" : 
    isOnlineMode ? `${isXNext ? "X" : "O"} Activates...` : 
    `${isXNext ? "X" : "O"} Activates...`;
    
  playSound(clickSound);
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
  playSound(clickSound);
});

// Toggle Chat
toggleChatBtn.addEventListener("click", () => {
  chatContent.classList.toggle("active");
  toggleChatBtn.textContent = chatContent.classList.contains("active") ? "Close Comm" : "Open Comm";
  playSound(clickSound);
});

// Chat
sendChatBtn.addEventListener("click", sendChatMessage);
chatInput.addEventListener("keypress", (e) => {
  if (e.key === "Enter") sendChatMessage();
});

function sendChatMessage() {
  const message = chatInput.value.trim();
  if (message && isOnlineMode && conn && conn.open) {
    const fullMessage = `${playerSymbol || '?'}: ${message}`;
    conn.send({ type: "chat", message: fullMessage });
    displayChatMessage(fullMessage);
    chatInput.value = "";
    playSound(clickSound);
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

// Restart button event
restartBtn.addEventListener("click", restartGame);

// Initialize game UI
statusDisplay.textContent = "X Activates...";

// Handle window before unload to clean up connections
window.addEventListener('beforeunload', () => {
  if (peer) peer.destroy();
});

// Display error message if PeerJS is not available (but don't block the game)
document.addEventListener('DOMContentLoaded', () => {
  if (typeof Peer !== 'function' && isOnlineMode) {
    multiplayerStatus.textContent = "Warning: PeerJS not detected. Online mode may not work.";
  }
});
