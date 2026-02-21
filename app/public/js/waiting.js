const socket = io(`${window.location.origin}/ludo`);
const roomCode = window.location.pathname.split('/')[2];

const roomLine = document.getElementById('roomLine');
const waitLine = document.getElementById('waitLine');
const countLine = document.getElementById('countLine');
const playerList = document.getElementById('playerList');
const startBtn = document.getElementById('startBtn');

if (window.Telegram?.WebApp) {
  window.Telegram.WebApp.ready();
  window.Telegram.WebApp.expand();
}

roomLine.textContent = `Room: ${String(roomCode || '').toUpperCase()}`;

socket.on('connect', () => {
  const q = new URLSearchParams(window.location.search);
  socket.emit('waiting:join', { room: roomCode, name: q.get('name') || '', userId: q.get('userId') || '' }, (res) => {
    if (!res?.ok) {
      waitLine.textContent = res?.error || 'Could not join lobby';
      return;
    }

    countLine.textContent = `Players in lobby: ${res.count || 0}`;
    waitLine.textContent = res.started ? 'Game started. Redirecting...' : 'Waiting for host to start...';
    startBtn.disabled = !res.isHost;
    renderPlayers(res.players || []);
  });
});

socket.on('waiting:update', (data) => {
  countLine.textContent = `Players in lobby: ${data.count || 0}`;
  waitLine.textContent = data.started ? 'Game started. Redirecting...' : 'Waiting for host to start...';
  renderPlayers(data.players || []);
});

socket.on('waiting:redirect', (data) => {
  const to = data?.to || `/ludo/${roomCode}/game`;
  const query = window.location.search || '';
  window.location.replace(`${to}${query}`);
});

startBtn.addEventListener('click', () => {
  socket.emit('waiting:start', { room: roomCode }, (res) => {
    if (!res?.ok) waitLine.textContent = res?.error || 'Could not start game';
  });
});

function renderPlayers(players) {
  if (!Array.isArray(players) || players.length === 0) {
    playerList.innerHTML = '<li>Waiting...</li>';
    return;
  }
  playerList.innerHTML = players.map((p) => `<li>${escapeHtml(String(p || 'Player'))}</li>`).join('');
}

function escapeHtml(str) {
  return str.replace(/[&<>'\"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
}
