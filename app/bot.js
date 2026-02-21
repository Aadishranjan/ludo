const axios = require('axios');
const { Telegraf, Markup } = require('telegraf');
require('dotenv').config();

const BOT_TOKEN = process.env.BOT_TOKEN;
const BOT_USERNAME = process.env.BOT_USERNAME;
const APP_BASE_URL = (process.env.APP_BASE_URL || 'http://localhost:3000').replace(/\/+$/, '');
const INTERNAL_API_TOKEN = process.env.INTERNAL_API_TOKEN;
const RETRY_MS = Number(process.env.BOT_RETRY_MS || 10000);

if (!BOT_TOKEN) throw new Error('Missing BOT_TOKEN');
if (!BOT_USERNAME) throw new Error('Missing BOT_USERNAME');
if (!INTERNAL_API_TOKEN) throw new Error('Missing INTERNAL_API_TOKEN');

const bot = new Telegraf(BOT_TOKEN);
const userRooms = new Map();

function normalizeName(ctx) {
  return String(ctx.from?.first_name || ctx.from?.username || `Player${ctx.from?.id || ''}`).slice(0, 24);
}

function roomWebAppLink(roomCode, tgUser) {
  const q = new URLSearchParams({
    name: normalizeName({ from: tgUser }),
    userId: String(tgUser.id || '')
  });
  return `${APP_BASE_URL}/ludo/${roomCode}?${q.toString()}`;
}

function openGameButton(ctx, label, url) {
  const chatType = String(ctx.chat?.type || 'private');
  // Telegram rejects web_app buttons in many non-private contexts.
  if (chatType === 'private') {
    return Markup.button.webApp(label, url);
  }
  return Markup.button.url(label, url);
}

function isPrivateChat(ctx) {
  return String(ctx.chat?.type || '') === 'private';
}

function privateStartLink(payload = 'home') {
  return `https://t.me/${BOT_USERNAME}?start=${encodeURIComponent(payload)}`;
}

async function promptPrivate(ctx, payload, message) {
  await ctx.reply(
    message || 'Open bot in private chat to continue.',
    Markup.inlineKeyboard([[Markup.button.url('Open Private Chat', privateStartLink(payload))]])
  );
}

async function createRoomForUser(ctx) {
  const { data } = await axios.post(
    `${APP_BASE_URL}/api/telegram/room`,
    {
      userId: String(ctx.from.id),
      name: normalizeName(ctx)
    },
    {
      headers: { 'x-internal-token': INTERNAL_API_TOKEN },
      timeout: 8000
    }
  );
  if (!data?.ok) throw new Error(data?.error || 'room creation failed');
  return data;
}

async function joinRoomForUser(ctx, roomCode) {
  const { data } = await axios.post(
    `${APP_BASE_URL}/api/telegram/join`,
    {
      roomCode,
      userId: String(ctx.from.id),
      name: normalizeName(ctx)
    },
    {
      headers: { 'x-internal-token': INTERNAL_API_TOKEN },
      timeout: 8000
    }
  );
  if (!data?.ok) throw new Error(data?.error || 'join failed');
  return data;
}

function setUserRoom(ctx, roomCode) {
  userRooms.set(String(ctx.from.id), roomCode.toLowerCase());
}

function getUserRoom(ctx) {
  return userRooms.get(String(ctx.from.id)) || '';
}

bot.start(async (ctx) => {
  const text = ctx.message?.text || '';
  const deepLinkMatch = text.match(/room_([A-Za-z0-9]{6})/);

  if (!isPrivateChat(ctx)) {
    const payload = deepLinkMatch ? `room_${deepLinkMatch[1].toUpperCase()}` : 'home';
    await promptPrivate(ctx, payload, 'Continue in private chat.');
    return;
  }

  if (deepLinkMatch) {
    const roomCode = deepLinkMatch[1].toLowerCase();
    try {
      await joinRoomForUser(ctx, roomCode);
      setUserRoom(ctx, roomCode);
      const url = roomWebAppLink(roomCode, ctx.from);
      await ctx.reply(
        `Joined room ${roomCode.toUpperCase()}`,
        Markup.inlineKeyboard([[openGameButton(ctx, 'Open Ludo', url)]])
      );
    } catch (error) {
      await ctx.reply(`Could not join room: ${error.response?.data?.error || error.message}`);
    }
    return;
  }

  await ctx.reply(
    'Commands:\n/room - create room\n/join ROOMCODE - join room\n/play - open your joined room',
    Markup.inlineKeyboard([[openGameButton(ctx, 'Open Home', `${APP_BASE_URL}/`)]])
  );
});

bot.command('room', async (ctx) => {
  try {
    const room = await createRoomForUser(ctx);
    const roomCode = room.roomCode.toLowerCase();
    setUserRoom(ctx, roomCode);
    const url = roomWebAppLink(roomCode, ctx.from);
    const invite = `https://t.me/${BOT_USERNAME}?start=room_${roomCode.toUpperCase()}`;

    if (!isPrivateChat(ctx)) {
      await promptPrivate(
        ctx,
        `room_${roomCode.toUpperCase()}`,
        `Room ${roomCode.toUpperCase()} created. Continue in private chat.`
      );
      return;
    }

    await ctx.reply(
      `Room created: ${roomCode.toUpperCase()}\nInvite: ${invite}`,
      Markup.inlineKeyboard([
        [openGameButton(ctx, 'Open Room', url)],
        [
          Markup.button.url(
            'Share Invite',
            `https://t.me/share/url?url=${encodeURIComponent(invite)}&text=${encodeURIComponent('Join my Ludo room')}`
          )
        ]
      ])
    );
  } catch (error) {
    await ctx.reply(`Could not create room: ${error.response?.data?.error || error.message}`);
  }
});

bot.command('join', async (ctx) => {
  const text = String(ctx.message?.text || '').trim();
  const parts = text.split(/\s+/);
  const roomCode = (parts[1] || '').toLowerCase();
  if (!/^[a-z0-9]{6}$/.test(roomCode)) {
    await ctx.reply('Usage: /join ROOMCODE');
    return;
  }

  try {
    await joinRoomForUser(ctx, roomCode);
    setUserRoom(ctx, roomCode);
    const url = roomWebAppLink(roomCode, ctx.from);
    if (!isPrivateChat(ctx)) {
      await promptPrivate(
        ctx,
        `room_${roomCode.toUpperCase()}`,
        `Joined room ${roomCode.toUpperCase()}. Continue in private chat.`
      );
      return;
    }
    await ctx.reply(
      `Joined room ${roomCode.toUpperCase()}`,
      Markup.inlineKeyboard([[openGameButton(ctx, 'Play', url)]])
    );
  } catch (error) {
    await ctx.reply(`Could not join room: ${error.response?.data?.error || error.message}`);
  }
});

bot.command('play', async (ctx) => {
  const roomCode = getUserRoom(ctx);
  if (!roomCode) {
    await ctx.reply('No room selected. Use /room or /join ROOMCODE first.');
    return;
  }

  if (!isPrivateChat(ctx)) {
    await promptPrivate(
      ctx,
      `room_${roomCode.toUpperCase()}`,
      `Continue room ${roomCode.toUpperCase()} in private chat.`
    );
    return;
  }

  const url = roomWebAppLink(roomCode, ctx.from);
  await ctx.reply(
    `Open game for room ${roomCode.toUpperCase()}`,
    Markup.inlineKeyboard([[openGameButton(ctx, 'Play Ludo', url)]])
  );
});

bot.catch((err) => {
  console.error('Bot update error:', err.message);
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

console.log('Telegram bot is running');
