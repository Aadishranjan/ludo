const socket = io({ transports: ['websocket'] });

const nameInput = document.getElementById('nameInput');
const roomInput = document.getElementById('roomInput');
const createBtn = document.getElementById('createBtn');
const joinBtn = document.getElementById('joinBtn');
const startBtn = document.getElementById('startBtn');
const rollBtn = document.getElementById('rollBtn');
const lobbyPanel = document.getElementById('lobbyPanel');
const gamePanel = document.getElementById('gamePanel');
const statusEl = document.getElementById('status');
const metaEl = document.getElementById('meta');
const turnInfoEl = document.getElementById('turnInfo');
const diceInfoEl = document.getElementById('diceInfo');
const playersEl = document.getElementById('players');
const canvas = document.getElementById('boardCanvas');
const ctx = canvas.getContext('2d');

const COLOR_HEX = {
  red: '#e53935',
  green: '#10b52a',
  yellow: '#f1cd14',
  blue: '#1e88e5'
};

const START_OFFSETS = { red: 0, green: 13, yellow: 26, blue: 39 };
const SAFE_ZONES = new Set([0, 8, 13, 21, 26, 34, 39, 47]);

const BOARD_SIZE = canvas.width;
const CELL = BOARD_SIZE / 15;

const boardImage = new Image();
let boardImageReady = false;

let me = {
  userId: localStorage.getItem('ludo_user_id') || `u_${Math.random().toString(36).slice(2, 10)}`,
  name: localStorage.getItem('ludo_name') || ''
};
let roomState = null;
let roomId = '';
const roomFromPath = (() => {
  const m = window.location.pathname.match(/^\/room=([A-Za-z0-9_-]+)$/);
  return m ? m[1].toUpperCase() : '';
})();

const pathCells = [
  [6, 13], [6, 12], [6, 11], [6, 10], [6, 9], [5, 8], [4, 8], [3, 8], [2, 8], [1, 8], [0, 8], [0, 7], [0, 6],
  [1, 6], [2, 6], [3, 6], [4, 6], [5, 6], [6, 5], [6, 4], [6, 3], [6, 2], [6, 1], [6, 0], [7, 0], [8, 0],
  [8, 1], [8, 2], [8, 3], [8, 4], [8, 5], [9, 6], [10, 6], [11, 6], [12, 6], [13, 6], [14, 6], [14, 7], [14, 8],
  [13, 8], [12, 8], [11, 8], [10, 8], [9, 8], [8, 9], [8, 10], [8, 11], [8, 12], [8, 13], [8, 14], [7, 14], [6, 14]
];

const homeCells = {
  red: [[7, 13], [7, 12], [7, 11], [7, 10], [7, 9], [7, 8]],
  green: [[1, 7], [2, 7], [3, 7], [4, 7], [5, 7], [6, 7]],
  yellow: [[7, 1], [7, 2], [7, 3], [7, 4], [7, 5], [7, 6]],
  blue: [[13, 7], [12, 7], [11, 7], [10, 7], [9, 7], [8, 7]]
};

const yardCells = {
  green: [[2, 2], [4, 2], [2, 4], [4, 4]],
  yellow: [[10, 2], [12, 2], [10, 4], [12, 4]],
  red: [[2, 10], [4, 10], [2, 12], [4, 12]],
  blue: [[10, 10], [12, 10], [10, 12], [12, 12]]
};

localStorage.setItem('ludo_user_id', me.userId);
nameInput.value = me.name;
setupBoardImage();
drawBoard();
gamePanel.classList.add('hidden');
if (roomFromPath) roomInput.value = roomFromPath;

function setupBoardImage() {
  loadBoardFromSrc('/assets/ludo-board.png');
}

function loadBoardFromSrc(src) {
  boardImageReady = false;
  boardImage.onload = () => {
    boardImageReady = true;
    drawBoard(roomState);
  };
  boardImage.onerror = () => {
    boardImageReady = false;
    drawBoard(roomState);
    setStatus('Board image missing. Add /public/assets/ludo-board.png');
  };
  boardImage.src = src;
}

function setStatus(msg) {
  statusEl.textContent = `Status: ${msg}`;
}

function syncMeFromInput() {
  me.name = nameInput.value.trim();
  localStorage.setItem('ludo_name', me.name);
}

createBtn.onclick = () => {
  syncMeFromInput();
  if (!me.name) return setStatus('Enter your name');

  socket.emit('room:create', { userId: me.userId, name: me.name }, (res) => {
    if (!res?.ok) return setStatus(res?.error || 'create failed');
    roomState = res.room;
    roomId = roomState.roomId;
    roomInput.value = roomId;
    render();
    setStatus('Room created');
  });
};

joinBtn.onclick = () => {
  manualJoin();
};

function manualJoin() {
  syncMeFromInput();
  roomId = roomInput.value.trim().toUpperCase();
  if (!me.name) return setStatus('Enter your name');
  if (!roomId) return setStatus('Enter room ID');

  socket.emit('room:join', { roomId, userId: me.userId, name: me.name }, (res) => {
    if (!res?.ok) return setStatus(res?.error || 'join failed');
    roomState = res.room;
    syncUrlRoom(roomState.roomId);
    render();
    setStatus('Joined room');
  });
}

startBtn.onclick = () => {
  if (!roomId) return;
  socket.emit('game:start', { roomId }, (res) => {
    if (!res?.ok) setStatus(res.error);
  });
};

rollBtn.onclick = () => {
  if (!roomId) return;
  socket.emit('dice:roll', { roomId }, (res) => {
    if (!res?.ok) setStatus(res.error);
  });
};

socket.on('room:state', (state) => {
  roomState = state;
  roomId = state.roomId;
  roomInput.value = state.roomId;
  syncUrlRoom(state.roomId);
  render();
});

socket.on('game:dice', ({ byUserId, diceValue, movableTokenIds }) => {
  diceInfoEl.textContent = `Dice: ${diceValue}`;
  setStatus(`Dice: ${diceValue} by ${nameOf(byUserId)}`);

  if (byUserId === me.userId && Array.isArray(movableTokenIds) && movableTokenIds.length > 0) {
    // Minimal UI mode: auto-move first valid token to keep screen clean.
    setTimeout(() => {
      socket.emit('token:move', { roomId, tokenId: movableTokenIds[0] }, (res) => {
        if (!res?.ok) setStatus(res.error);
      });
    }, 250);
  }
});

socket.on('game:move', ({ byUserId, tokenId }) => {
  setStatus(`${nameOf(byUserId)} moved ${tokenId}`);
});

function render() {
  if (!roomState) {
    drawBoard();
    return;
  }

  const turnName = nameOf(roomState.currentTurnUserId) || '-';
  turnInfoEl.textContent = `Turn: ${turnName}`;
  diceInfoEl.textContent = `Dice: ${roomState.lastDiceValue || '-'}`;
  metaEl.textContent = `Room: ${roomState.roomId}`;

  const isHost = roomState.hostUserId === me.userId;
  const isMyTurn = roomState.currentTurnUserId === me.userId;

  startBtn.disabled = !(isHost && roomState.status === 'waiting' && roomState.players.length >= 2);
  rollBtn.disabled = !(roomState.status === 'active' && isMyTurn && roomState.turnPhase === 'roll');

  const gameStarted = roomState.status !== 'waiting';
  lobbyPanel.classList.toggle('hidden', gameStarted);
  gamePanel.classList.toggle('hidden', false);

  playersEl.innerHTML = roomState.players
    .map(
      (p) =>
        `<div class="player"><span class="color-tag color-${p.color}">${p.color}</span>${p.name}</div>`
    )
    .join('');

  drawBoard(roomState);

  if (roomState.status === 'finished') {
    setStatus(`Winner: ${nameOf(roomState.winnerUserId)}`);
    rollBtn.disabled = true;
  }
}

function syncUrlRoom(nextRoomId) {
  if (!nextRoomId) return;
  const target = `/room=${String(nextRoomId).toUpperCase()}`;
  if (window.location.pathname !== target) {
    window.history.replaceState(null, '', target);
  }
}

function drawBoard(state) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (boardImageReady) {
    ctx.drawImage(boardImage, 0, 0, BOARD_SIZE, BOARD_SIZE);
  } else {
    ctx.fillStyle = '#f0f4fb';
    ctx.fillRect(0, 0, BOARD_SIZE, BOARD_SIZE);
    ctx.fillStyle = '#334155';
    ctx.font = 'bold 20px Trebuchet MS';
    ctx.textAlign = 'center';
    ctx.fillText('Missing /assets/ludo-board.png', BOARD_SIZE / 2, BOARD_SIZE / 2);
  }

  drawSafeZoneHints();

  if (!state) return;
  for (const player of state.players) {
    for (const token of player.tokens) {
      const p = tokenPixel(player.color, token.progress, token.tokenId);
      drawToken(p.x, p.y, player.color);
    }
  }
}

function drawSafeZoneHints() {
  for (const index of SAFE_ZONES) {
    const p = pathCellToPx(pathCells[index]);
    ctx.beginPath();
    ctx.fillStyle = 'rgba(38,198,218,0.22)';
    ctx.arc(p.x, p.y, 14, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawToken(x, y, color) {
  ctx.beginPath();
  ctx.fillStyle = COLOR_HEX[color];
  ctx.arc(x, y, 13, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#1f2937';
  ctx.arc(x, y, 13, 0, Math.PI * 2);
  ctx.stroke();
}

function tokenPixel(color, progress, tokenId) {
  const tokenIndex = Number(tokenId.split('-')[1]);
  if (progress < 0) return pathCellToPx(yardCells[color][tokenIndex]);

  if (progress <= 51) {
    const idx = (START_OFFSETS[color] + progress) % 52;
    return pathCellToPx(pathCells[idx]);
  }

  const homeIndex = Math.min(5, progress - 52);
  return pathCellToPx(homeCells[color][homeIndex]);
}

function pathCellToPx([col, row]) {
  return {
    x: col * CELL + CELL / 2,
    y: row * CELL + CELL / 2
  };
}

function nameOf(userId) {
  if (!roomState) return '';
  return roomState.players.find((p) => p.userId === userId)?.name || userId || '';
}

setStatus('Enter name, create room or join by room ID');

if (roomFromPath && me.name) {
  setTimeout(() => {
    manualJoin();
  }, 50);
} else if (roomFromPath && !me.name) {
  setStatus(`Enter your name to join room ${roomFromPath}`);
}
