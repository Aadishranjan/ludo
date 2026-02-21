const axios = require('axios');
const { Telegraf, Markup } = require('telegraf');
const dotenv = require('dotenv');

dotenv.config();

const BOT_TOKEN = process.env.BOT_TOKEN;
const BOT_USERNAME = process.env.BOT_USERNAME;
const APP_BASE_URL = (process.env.APP_BASE_URL || `http://localhost:${process.env.PORT || 8080}`).replace(/\/+$/, '');
const SERVER_INTERNAL_URL = (process.env.SERVER_INTERNAL_URL || `http://localhost:${process.env.PORT || 8080}`).replace(/\/+$/, '');
const INTERNAL_API_TOKEN = process.env.INTERNAL_API_TOKEN || '';

if (!BOT_TOKEN) throw new Error('Missing BOT_TOKEN');
if (!BOT_USERNAME) throw new Error('Missing BOT_USERNAME');
if (!INTERNAL_API_TOKEN) throw new Error('Missing INTERNAL_API_TOKEN');

const bot = new Telegraf(BOT_TOKEN);
const RETRY_MS = Number(process.env.BOT_RETRY_MS || 10000);

function roomLink(roomId) {
  return `${APP_BASE_URL}/room=${String(roomId).toUpperCase()}`;
}

async function createRoomFromServer(ctx) {
  const { data } = await axios.post(
    `${SERVER_INTERNAL_URL}/api/bot/play`,
    {
      userId: String(ctx.from.id),
      name: ctx.from.first_name || ctx.from.username || `Player${ctx.from.id}`
    },
    {
      headers: { 'x-internal-token': INTERNAL_API_TOKEN },
      timeout: 8000
    }
  );
  if (!data?.ok) throw new Error(data?.error || 'room create failed');
  return data.room;
}

bot.start(async (ctx) => {
  const text = ctx.message?.text || '';
  const match = text.match(/room_([A-Za-z0-9_-]+)/);
  const roomId = match ? match[1].toUpperCase() : '';

  if (roomId) {
    const url = roomLink(roomId);
    await ctx.reply(
      `Join room ${roomId}`,
      Markup.inlineKeyboard([[Markup.button.url('Play Ludo', url)]])
    );
    return;
  }

  await ctx.reply('Use /play to create a new room and get a join link.');
});

bot.command('play', async (ctx) => {
  try {
    const room = await createRoomFromServer(ctx);
    const link = roomLink(room.roomId);
    const invite = `https://t.me/${BOT_USERNAME}?start=room_${room.roomId}`;

    await ctx.reply(
      `Room created: ${room.roomId}\nShare this bot link: ${invite}`,
      Markup.inlineKeyboard([
        [Markup.button.url('Open Game', link)],
        [Markup.button.url('Share Invite', `https://t.me/share/url?url=${encodeURIComponent(invite)}&text=${encodeURIComponent('Join my Ludo room')}`)]
      ])
    );
  } catch (err) {
    await ctx.reply(`Could not create room: ${err.response?.data?.error || err.message}`);
  }
});

bot.catch((err) => {
  console.error('Bot update handler error:', err.message);
});

let launching = false;
async function launchWithRetry() {
  if (launching) return;
  launching = true;
  try {
    await bot.launch();
    console.log('Telegram bot connected');
  } catch (err) {
    console.error(`Telegram connection failed (${err.code || 'ERR'}): ${err.message}`);
    console.error(`Retrying in ${RETRY_MS / 1000}s...`);
    setTimeout(() => {
      launching = false;
      launchWithRetry();
    }, RETRY_MS);
    return;
  }
  launching = false;
}

launchWithRetry();
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

console.log('Telegram bot running');
