const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const dotenv = require('dotenv');

dotenv.config({ path: process.env.ENV_FILE || '../.env' });

const BOT_TOKEN = process.env.BOT_TOKEN;
const BOT_USERNAME = process.env.BOT_USERNAME;
const WEBAPP_URL = process.env.WEBAPP_URL;
const API_BASE_URL = process.env.API_BASE_URL;
const INTERNAL_API_TOKEN = process.env.INTERNAL_API_TOKEN;

if (!BOT_TOKEN || !BOT_USERNAME || !WEBAPP_URL || !API_BASE_URL || !INTERNAL_API_TOKEN) {
  throw new Error('Missing required bot envs');
}

const bot = new TelegramBot(BOT_TOKEN, { polling: true });

async function createRoomFromBot(msg) {
  const hostUser = {
    telegramId: String(msg.from.id),
    username: msg.from.username || '',
    firstName: msg.from.first_name || ''
  };

  const { data } = await axios.post(
    `${API_BASE_URL}/internal/rooms`,
    {
      hostUser,
      maxPlayers: 4
    },
    {
      headers: {
        'x-internal-token': INTERNAL_API_TOKEN
      },
      timeout: 8000
    }
  );

  return data;
}

function gameLinks(roomId) {
  const webAppUrl = `${WEBAPP_URL}/app?room=${roomId}`;
  const deepLink = `https://t.me/${BOT_USERNAME}/ludo?startapp=room_${roomId}`;
  return { webAppUrl, deepLink };
}

bot.onText(/^\/start(?:\s+room_(\w+))?/, async (msg, match) => {
  const roomId = match?.[1];
  const targetRoom = roomId ? `\nRoom: ${roomId}` : '';

  await bot.sendMessage(
    msg.chat.id,
    `Real-Time Ludo inside Telegram.${targetRoom}\nTap Play to open WebApp.`,
    {
      reply_markup: {
        inline_keyboard: [[{ text: 'Play Ludo', web_app: { url: `${WEBAPP_URL}/app${roomId ? `?room=${roomId}` : ''}` } }]]
      }
    }
  );
});

bot.onText(/^\/newroom$/, async (msg) => {
  try {
    const room = await createRoomFromBot(msg);
    const { webAppUrl, deepLink } = gameLinks(room.roomId);

    await bot.sendMessage(
      msg.chat.id,
      `Room created: ${room.roomId}\nInvite link: ${deepLink}`,
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: 'Open Room', web_app: { url: webAppUrl } }],
            [{ text: 'Invite Friends', url: `https://t.me/share/url?url=${encodeURIComponent(deepLink)}&text=${encodeURIComponent('Join my Ludo room!')}` }]
          ]
        }
      }
    );
  } catch (error) {
    await bot.sendMessage(msg.chat.id, `Could not create room: ${error.response?.data?.error || error.message}`);
  }
});

bot.onText(/^\/help$/, async (msg) => {
  await bot.sendMessage(
    msg.chat.id,
    ['/newroom - create 4-player room', '/start room_<ROOM_ID> - open an invite room'].join('\n')
  );
});

console.log('Telegram bot started');
