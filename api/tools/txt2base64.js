module.exports = {
  name: "Text to Base64",
  desc: "Mengonversi teks biasa menjadi format encoding Base64",
  category: "Tools",
  path: "/api/tools/txt2base64",
  method: "GET",
  parameters: {
    apikey: { type: "string", required: true },
    text: { type: "string", required: true }
  },
  async run(req, res, next) {
    try {
      const apikey = req.apiKeyInput || req.query.apikey || req.body?.apikey;
      const text = req.query.text || req.body?.text;

      if (!global.apikey || !global.apikey.includes(apikey)) {
        return res.status(403).json({ status: false, error: "Apikey invalid" });
      }

      if (!text || typeof text !== "string" || text.trim().length === 0) {
        return res.status(400).json({ status: false, error: "Parameter 'text' wajib diisi!" });
      }

      const base64 = Buffer.from(text.trim()).toString("base64");

      return res.json({
        status: true,
        result: {
          original: text.trim(),
          base64: base64
        }
      });
    } catch (err) {
      return res.status(500).json({
        status: false,
        error: err.message || "Terjadi kesalahan saat mengonversi teks"
      });
    }
  }
};