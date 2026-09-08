const axios = require('axios');

async function getQuotedWindowsBuffer(text) {
  const url = `https://api.ikyyxd.my.id/canvas/iqw?text=${encodeURIComponent(text)}`;
  const response = await axios.get(url, {
    responseType: 'arraybuffer',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    },
    timeout: 25000
  });
  return Buffer.from(response.data);
}

module.exports = [
  {
    name: "Quoted Windows",
    desc: "Generate Fake Windows Media Player meme quoted frame using custom text.",
    category: "Maker",
    path: "/api/maker/quoted-windows",
    method: "GET",
    parameters: {
      apikey: { type: "string", required: true },
      text: { type: "string", required: true }
    },
    async run(req, res) {
      const apikey = req.apiKeyInput || req.query?.apikey || req.body?.apikey || req.headers['x-apikey'];
      const text = req.query?.text || req.body?.text;

      if (!global.apikey || !global.apikey.includes(apikey)) {
        return res.status(403).json({ status: false, error: "Apikey invalid" });
      }

      if (!text || typeof text !== 'string' || !text.trim()) {
        return res.status(400).json({ status: false, error: "Parameter 'text' wajib diisi!" });
      }

      try {
        const imageBuffer = await getQuotedWindowsBuffer(text.trim());
        res.setHeader("Content-Type", "image/png");
        return res.send(imageBuffer);
      } catch (err) {
        return res.status(500).json({
          status: false,
          error: err.message || "Gagal membuat gambar Quoted Windows"
        });
      }
    }
  }
];
