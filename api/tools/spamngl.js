const axios = require('axios');
const crypto = require('crypto');

function extractUsername(input) {
  if (!input) return null;
  const raw = input.trim();
  if (!raw.includes('/')) return raw;
  try {
    const parsed = new URL(raw.startsWith('http') ? raw : `https://${raw}`);
    const parts = parsed.pathname.split('/').filter(Boolean);
    return parts.pop() || null;
  } catch {
    const parts = raw.split('/').filter(Boolean);
    return parts.pop() || null;
  }
}

async function sendNgl(username, question) {
  const deviceId = crypto.randomUUID();
  const postData = new URLSearchParams({
    username,
    question,
    deviceId,
    gameSlug: "",
    referrer: ""
  });

  const { data } = await axios.post(
    "https://ngl.link/api/submit",
    postData.toString(),
    {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        "Accept": "*/*",
        "X-Requested-With": "XMLHttpRequest",
        "User-Agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36",
        "Referer": `https://ngl.link/${username}`,
        "Origin": "https://ngl.link"
      },
      timeout: 15000
    }
  );

  return data;
}

module.exports = {
  name: "Spam NGL",
  desc: "Kirim pesan anonim atau spam ke target NGL link",
  category: "Tools",
  path: "/api/tools/spamngl",
  method: "GET",
  parameters: {
    apikey: { type: "string", required: true },
    link: { type: "string", required: true },
    text: { type: "string", required: true },
    amount: { type: "number", required: false, example: "5" }
  },
  async run(req, res, next) {
    try {
      const apikey = req.apiKeyInput || req.query.apikey || req.body?.apikey;
      const link = req.query.link || req.body?.link;
      const text = req.query.text || req.body?.text;
      const rawAmount = req.query.amount || req.body?.amount || 1;

      if (!global.apikey || !global.apikey.includes(apikey)) {
        return res.status(403).json({ status: false, error: "Apikey invalid" });
      }

      if (!link) {
        return res.status(400).json({ status: false, error: "Parameter 'link' wajib diisi!" });
      }

      if (!text) {
        return res.status(400).json({ status: false, error: "Parameter 'text' wajib diisi!" });
      }

      const username = extractUsername(link);
      if (!username) {
        return res.status(400).json({ status: false, error: "Gagal mengekstrak username dari link NGL!" });
      }

      let count = parseInt(rawAmount, 10);
      if (isNaN(count) || count < 1) count = 1;
      if (count > 20) count = 20;

      let successCount = 0;
      let failCount = 0;

      for (let i = 0; i < count; i++) {
        try {
          await sendNgl(username, text);
          successCount++;
        } catch {
          failCount++;
        }
      }

      return res.json({
        status: successCount > 0,
        result: {
          target: username,
          message: text,
          total_requested: count,
          success: successCount,
          failed: failCount
        }
      });
    } catch (err) {
      return res.status(500).json({
        status: false,
        error: err.response?.data?.message || err.message || "Gagal mengirim pesan NGL"
      });
    }
  }
};
