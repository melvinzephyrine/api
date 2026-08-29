const axios = require('axios');

async function getBratImageBuffer(text) {
    const response = await axios.get(`https://brat.siputzx.my.id/image?text=${encodeURIComponent(text)}`, {
        responseType: 'arraybuffer',
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
    });
    return Buffer.from(response.data);
}

module.exports = [
  {
    name: "Brat Generator",
    desc: "Generate Brat style text image",
    category: "Maker",
    method: "GET",
    parameters: {
      apikey: { type: "string", required: true },
      text: { type: "string", required: true }
    },
    path: "/api/maker/brat",
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
        const buffer = await getBratImageBuffer(text);
        res.setHeader("Content-Type", "image/png");
        return res.send(buffer);
      } catch (err) {
        return res.status(500).json({
          status: false,
          error: err.message || "Gagal membuat gambar Brat"
        });
      }
    }
  }
];
