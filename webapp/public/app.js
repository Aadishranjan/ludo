import { LudoScene } from './phaserScene.js';

const tg = window.Telegram.WebApp;
tg.ready();
tg.expand();

const params = new URLSearchParams(window.location.search);
const roomId = params.get('room');

const roomInfo = document.getElementById('roomInfo');
const turnInfo = document.getElementById('turnInfo');
const statusInfo = document.getElementById('statusInfo');
const winnerInfo = document.getElementById('winnerInfo');
const startBtn = document.getElementById('startBtn');
const rollBtn = document.getElementById('rollBtn');

const game = new Phaser.Game({
  type: Phaser.AUTO,
  width: 800,
  height: 760,
  backgroundColor: '#0f1923',
  parent: 'game',
  scene: [LudoScene]
});

let socket;
let roomState;
let lastMovable = [];

function connect() {
  socket = io(window.location.origin, {
    transports: ['websocket'],
    auth: {
      initData: tg.initData
    }
  });

  socket.on('connect', () => {
    if (!roomId) {
      statusInfo.textContent = 'Status: missing room id';
      return;
    }

    socket.emit('room:join', { roomId }, (res) => {
      if (!res?.ok) {
        statusInfo.textContent = `Status: ${res.error}`;
      }
    });
  });

  socket.on('room:state', (state) => {
    roomState = state;
    updateHud(state);
    const scene = game.scene.keys.LudoScene;
    if (scene) scene.renderState(state);
    if (state.status === 'finished') {
      const winner = state.players.find((p) => p.userId === state.winnerUserId);
      winnerInfo.textContent = `Winner: ${winner?.firstName || winner?.username || state.winnerUserId}`;
    }
  });

  socket.on('game:dice', ({ movableTokenIds }) => {
    lastMovable = movableTokenIds || [];
    maybeAutoMove();
  });

  socket.on('connect_error', (err) => {
    statusInfo.textContent = `Status: ${err.message}`;
  });
}

function updateHud(state) {
  roomInfo.textContent = `Room: ${state.roomId}`;
  statusInfo.textContent = `Status: ${state.status}`;

  const turnPlayer = state.players.find((p) => p.userId === state.currentTurnUserId);
  turnInfo.textContent = `Turn: ${turnPlayer?.firstName || turnPlayer?.username || '-'}`;

  const me = String(tg.initDataUnsafe?.user?.id || '');
  const isHost = state.hostUserId === me;
  const isMyTurn = state.currentTurnUserId === me;

  startBtn.disabled = !(isHost && state.status === 'waiting' && state.players.length >= 2);
  rollBtn.disabled = !(state.status === 'active' && isMyTurn && state.turnPhase === 'roll');
}

function maybeAutoMove() {
  if (!roomState) return;
  const me = String(tg.initDataUnsafe?.user?.id || '');
  if (roomState.currentTurnUserId !== me) return;
  if (roomState.turnPhase !== 'move') return;

  if (lastMovable.length === 1) {
    socket.emit('token:move', { roomId, tokenId: lastMovable[0] });
    return;
  }

  if (lastMovable.length > 1) {
    tg.showPopup(
      {
        title: 'Choose Token',
        message: `Movable tokens: ${lastMovable.join(', ')}`,
        buttons: lastMovable.map((id) => ({ id, type: 'default', text: id }))
      },
      (id) => {
        if (id) socket.emit('token:move', { roomId, tokenId: id });
      }
    );
  }
}

startBtn.addEventListener('click', () => {
  socket.emit('game:start', { roomId });
});

rollBtn.addEventListener('click', () => {
  socket.emit('dice:roll', { roomId });
});

connect();
