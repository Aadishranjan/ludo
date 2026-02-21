const dotenv = require('dotenv');

dotenv.config({ path: process.env.ENV_FILE || '../.env' });

const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || 8080),
  mongoUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/ludo',
  redisUrl: process.env.REDIS_URL || '',
  corsOrigin: process.env.CORS_ORIGIN || '*',
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN || '',
  internalApiToken: process.env.INTERNAL_API_TOKEN || '',
  roomSizeMin: Number(process.env.ROOM_SIZE_MIN || 2),
  roomSizeMax: Number(process.env.ROOM_SIZE_MAX || 4),
  roomIdleTimeoutMs: Number(process.env.ROOM_IDLE_TIMEOUT_MS || 1800000)
};

module.exports = { env };
