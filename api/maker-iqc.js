const axios = require('axios');

async function getIphoneQuotedBuffer(messageText) {
  const url = `https://brat.siputzx.my.id/iphone-quoted?messageText=${encodeURIComponent(messageText)}`;
  const response = await axios.get(url, {
    responseType: 'arraybuffer',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
  });
  return Buffer.from(response.data);
}

module.exports = [
  {
    name: "iPhone Quoted Chat",
    desc: "Generate fake chat quoted iOS style",
    category: "Maker",
    method: "GET",
    parameters: {
      apikey: { type: "string", required: true },
      messageText: { type: "string", required: true }
    },
    path: "/api/maker/iqc",
    async run(req, res) {
      const apikey = req.apiKeyInput || req.query.apikey || req.body?.apikey;
      const messageText = req.query.messageText || req.body?.messageText;

      if (!global.apikey.includes(apikey)) {
        return res.json({ status: false, error: "Apikey invalid" });
      }

      if (!messageText) {
        return res.json({
          status: false,
          error: "Parameter 'messageText' wajib diisi!"
        });
      }

      try {
        const imageBuffer = await getIphoneQuotedBuffer(messageText);
        res.setHeader("Content-Type", "image/png");
        return res.send(imageBuffer);
      } catch (err) {
        return res.status(500).json({
          status: false,
          error: err.message || "Gagal membuat screenshot iPhone quoted"
        });
      }
    }
  }
];
