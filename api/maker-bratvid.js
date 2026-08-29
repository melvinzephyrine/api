const axios = require('axios');

async function getBratGifBuffer(text) {
    const response = await axios.get(`https://brat.siputzx.my.id/gif?text=${encodeURIComponent(text)}`, {
        responseType: 'arraybuffer',
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
    });
    return Buffer.from(response.data);
}

module.exports = [
  {
    name: "Brat Video Generator",
    desc: "Generate animated Brat text GIF",
    category: "Maker",
    method: "GET",
    parameters: {
      apikey: { type: "string", required: true },
      text: { type: "string", required: true }
    },
    path: "/api/maker/bratvid",
    async run(req, res) {
      const apikey = req.apiKeyInput || req.query.apikey || req.body?.apikey;
      const text = req.query.text || req.body?.text;

      if (!global.apikey.includes(apikey)) {
        return res.json({ status: false, error: "Apikey invalid" });
      }

      if (!text) {
        return res.json({ status: false, error: "Parameter 'text' wajib diisi!" });
      }

      try {
        const buffer = await getBratGifBuffer(text);
        res.setHeader("Content-Type", "image/gif");
        return res.send(buffer);
      } catch (err) {
        return res.status(500).json({
          status: false,
          error: err.message || "Gagal membuat animasi Brat"
        });
      }
    }
  }
];
