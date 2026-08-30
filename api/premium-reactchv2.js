const axios = require('axios');

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function sendReaction(url, reactions = ['😂'], maxRetries = 5) {
  let attempt = 0;

  while (attempt < maxRetries) {
    try {
      const response = await axios.post(
        'https://react-w4.zfile.web.id/api/react',
        {
          url: url,
          reactions: reactions
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Mobile Safari/537.36',
            'Origin': 'https://react-w4.zfile.web.id',
            'Referer': 'https://react-w4.zfile.web.id/'
          },
          timeout: 60000
        }
      );

      const data = response.data;
      if (data && data.success) {
        return data;
      } else {
        await delay(5000);
        attempt++;
      }
    } catch (error) {
      if (error.response) {
        const statusCode = error.response.status;
        const data = error.response.data;

        if (statusCode === 429 && data?.retryAfter) {
          const waitTime = data.retryAfter * 1000;
          await delay(waitTime);
          attempt++;
          continue;
        }

        await delay(5000);
        attempt++;
        continue;
      }

      await delay(5000);
      attempt++;
    }
  }

  return null;
}

module.exports = [
  {
    name: "React Channel WhatsApp V2",
    desc: "Mengirimkan reaksi emoji ke Saluran WhatsApp menggunakan server V2",
    category: "Premium",
    method: "GET",
    path: "/api/prem/reactchv2",
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
        example: "😂,👍,❤️"
      }
    },
    async run(req, res, next) {
      try {
        const apikey = req.apiKeyInput || req.query?.apikey || req.body?.apikey || req.headers?.['x-apikey'];
        const targetUrl = req.query?.url || req.body?.url;
        const rawEmoji = req.query?.emoji || req.body?.emoji || "😂";

        if (apikey && !global.apikey.includes(apikey)) {
          return res.status(403).json({ status: false, error: "Apikey invalid" });
        }

        if (!targetUrl) {
          return res.status(400).json({
            status: false,
            error: "Parameter 'url' wajib diisi!"
          });
        }

        try {
          new URL(targetUrl);
        } catch {
          return res.status(400).json({
            status: false,
            error: "Format URL WhatsApp tidak valid!"
          });
        }

        const reactions = rawEmoji
          .split(',')
          .map(e => e.trim())
          .filter(Boolean);

        const result = await sendReaction(targetUrl, reactions.length > 0 ? reactions : ['😂']);

        if (!result) {
          return res.status(500).json({
            status: false,
            error: "Gagal mengirim reaksi ke Saluran WhatsApp (Server sibuk atau rate limit)"
          });
        }

        return res.json({
          status: true,
          result: result
        });

      } catch (err) {
        next(err);
      }
    }
  }
];