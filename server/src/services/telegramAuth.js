const crypto = require('crypto');
const { env } = require('../config/env');

function parseInitData(initData) {
  const params = new URLSearchParams(initData);
  const data = {};
  for (const [k, v] of params.entries()) data[k] = v;
  return data;
}

function validateInitData(initData) {
  if (!initData) throw new Error('Missing Telegram initData');
  if (!env.telegramBotToken) throw new Error('Server missing TELEGRAM_BOT_TOKEN');

  const parsed = parseInitData(initData);
  const receivedHash = parsed.hash;
  if (!receivedHash) throw new Error('Missing initData hash');

  const entries = Object.entries(parsed)
    .filter(([k]) => k !== 'hash')
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');

  const secret = crypto.createHmac('sha256', 'WebAppData').update(env.telegramBotToken).digest();
  const expectedHash = crypto.createHmac('sha256', secret).update(entries).digest('hex');
  if (expectedHash !== receivedHash) throw new Error('Invalid Telegram initData signature');

  const authDate = Number(parsed.auth_date || 0);
  if (!authDate || Date.now() / 1000 - authDate > 3600 * 12) {
    throw new Error('Expired Telegram session');
  }

  const user = parsed.user ? JSON.parse(parsed.user) : null;
  if (!user?.id) throw new Error('Missing Telegram user in initData');

  return {
    telegramId: String(user.id),
    username: user.username || '',
    firstName: user.first_name || '',
    photoUrl: user.photo_url || ''
  };
}

module.exports = { validateInitData };
