const axios = require('axios');
const crypto = require('crypto');

const API_URL = 'https://keyyss-react.web.id/api/react';
const FRONTEND_ORIGIN = 'https://keyyss-react.web.id';

function generateFingerprint() {
  return `MLVIN_${crypto.randomBytes(4).toString('hex')}`;
}

function generateTurnstileToken() {
  const p1 = crypto.randomBytes(2).toString('hex').toUpperCase();
  const p2 = crypto.randomBytes(4).toString('hex').toUpperCase();
  const p3 = crypto.randomBytes(2).toString('hex').toUpperCase();
  return `${p1}.${p2}.${p3}`;
}

async function sendReaction(waUrl, emojis) {
  const deviceFingerprint = generateFingerprint();
  const dummyTurnstile = generateTurnstileToken();

  const headers = {
    'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Mobile Safari/537.36',
    'Content-Type': 'application/json',
    'Accept': 'application/json, text/plain, */*',
    'Origin': FRONTEND_ORIGIN,
    'Referer': `${FRONTEND_ORIGIN}/`,
    'X-Device-Fingerprint': deviceFingerprint
  };

  const payload = {
    url: waUrl,
    deviceFingerprint: deviceFingerprint,
    emojis: emojis,
    turnstileToken: dummyTurnstile
  };

  const { data } = await axios.post(API_URL, payload, {
    headers: headers,
    timeout: 30000
  });

  return data;
}

module.exports = [
  {
    name: "React Channel WhatsApp",
    desc: "Mengirimkan reaksi emoji ke postingan/pesan di Saluran WhatsApp (WhatsApp Channel)",
    category: "Premium",
    method: "POST",
    path: "/api/prem/reactch",
    parameters: {
      apikey: {
        type: "string",
        required: true
      },
      url: {
        type: "string",
        required: true
      },
      emoji: {
        type: "string",
        required: false,
        example: "🗿,👍"
      }
    },
    async run(req, res, next) {
      try {
        const apikey = req.apiKeyInput || req.query.apikey || req.body?.apikey;
        const targetUrl = req.query.url || req.body?.url;
        const rawEmoji = req.query.emoji || req.body?.emoji || "🗿";

        if (!global.apikey.includes(apikey)) {
          return res.status(403).json({ status: false, error: "Apikey invalid" });
        }

        if (!targetUrl) {
          return res.status(400).json({
            status: false,
            error: "Parameter 'url' wajib diisi!"
          });
        }

        const formattedEmojis = rawEmoji
          .split(',')
          .map(e => e.trim())
          .filter(Boolean)
          .join(',');

        const responseData = await sendReaction(targetUrl, formattedEmojis);

        return res.json({
          status: true,
          result: responseData
        });

      } catch (err) {
        next(err);
      }
    }
  }
];
