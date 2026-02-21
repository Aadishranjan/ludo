const { Server } = require('socket.io');
const { createAdapter } = require('@socket.io/redis-adapter');
const Redis = require('ioredis');
const { env } = require('../config/env');
const { validateInitData } = require('../services/telegramAuth');
const { registerSocketHandlers } = require('./events');

async function buildSocketServer(httpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: env.corsOrigin,
      credentials: true
    },
    transports: ['websocket', 'polling']
  });

  if (env.redisUrl) {
    const pub = new Redis(env.redisUrl);
    const sub = pub.duplicate();
    io.adapter(createAdapter(pub, sub));
  }

  io.use((socket, next) => {
    try {
      const initData = socket.handshake.auth?.initData;
      const user = validateInitData(initData);
      socket.data.user = user;
      return next();
    } catch (error) {
      return next(error);
    }
  });

  io.on('connection', (socket) => {
    registerSocketHandlers(io, socket);
  });

  return io;
}

module.exports = { buildSocketServer };
