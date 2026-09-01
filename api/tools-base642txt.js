module.exports = {
  name: "Base64 to Text",
  desc: "Mendekode string berformat Base64 kembali menjadi teks biasa",
  category: "Tools",
  path: "/api/tools/base642txt",
  method: "GET",
  parameters: {
    apikey: { type: "string", required: true },
    base64: { type: "string", required: true }
  },
  async run(req, res, next) {
    try {
      const apikey = req.apiKeyInput || req.query.apikey || req.body?.apikey;
      const base64 = req.query.base64 || req.body?.base64;

      if (!global.apikey || !global.apikey.includes(apikey)) {
        return res.status(403).json({ status: false, error: "Apikey invalid" });
      }

      if (!base64 || typeof base64 !== "string" || base64.trim().length === 0) {
        return res.status(400).json({ status: false, error: "Parameter 'base64' wajib diisi!" });
      }

      const decodedText = Buffer.from(base64.trim(), "base64").toString("utf-8");

      return res.json({
        status: true,
        result: {
          base64: base64.trim(),
          text: decodedText
        }
      });
    } catch (err) {
      return res.status(500).json({
        status: false,
        error: err.message || "Terjadi kesalahan saat mendekode base64"
      });
    }
  }
};