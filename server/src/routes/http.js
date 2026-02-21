const express = require('express');
const { env } = require('../config/env');
const { createRoom, joinRoom, getRoom } = require('../services/roomStore');
const { validateInitData } = require('../services/telegramAuth');

const router = express.Router();

router.get('/health', (_req, res) => {
  res.json({ ok: true, ts: Date.now() });
});

router.post('/internal/rooms', async (req, res) => {
  try {
    const token = req.headers['x-internal-token'];
    if (!token || token !== env.internalApiToken) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { hostUser, maxPlayers } = req.body;
    const room = await createRoom({ hostUser, maxPlayers });
    return res.status(201).json(room);
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

router.post('/api/rooms/create', async (req, res) => {
  try {
    const { initData, maxPlayers } = req.body;
    const user = validateInitData(initData);
    const room = await createRoom({ hostUser: user, maxPlayers: maxPlayers || 4 });
    return res.status(201).json(room);
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

router.post('/api/rooms/:roomId/join', async (req, res) => {
  try {
    const { initData } = req.body;
    const user = validateInitData(initData);
    const room = await joinRoom({ roomId: req.params.roomId, user });
    return res.json(room);
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

router.get('/api/rooms/:roomId', async (req, res) => {
  const room = await getRoom(req.params.roomId);
  if (!room) return res.status(404).json({ error: 'Room not found' });
  return res.json(room);
});

module.exports = router;
