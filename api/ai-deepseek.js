const axios = require('axios');

const ORCAROUTER_API_KEY = "sk-orca-kmIHoi0WUg77mzOLm4yoNAFI4qgqRhzdOFIbZmxNGcZ";

async function askDeepSeek(prompt) {
  const { data } = await axios.post(
    "https://api.orcarouter.ai/v1/chat/completions",
    {
      model: "deepseek/deepseek-v4-flash-free",
      messages: [{ role: "user", content: prompt }],
      stream: false
    },
    {
      headers: {
        "Authorization": `Bearer ${ORCAROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      },
      timeout: 60000
    }
  );

  if (data && data.choices && data.choices.length > 0) {
    return data.choices[0].message.content;
  }
  throw new Error("Gagal mendapatkan respon dari DeepSeek AI.");
}

module.exports = {
  name: "DeepSeek AI",
  desc: "Asisten AI cerdas berbasis model DeepSeek V4 Flash Free",
  category: "AI",
  path: "/api/ai/deepseek",
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

      if (!text) {
        return res.status(400).json({ status: false, error: "Parameter 'text' wajib diisi!" });
      }

      const responseText = await askDeepSeek(text);

      return res.json({
        status: true,
        result: {
          model: "deepseek-v4-flash-free",
          response: responseText
        }
      });
    } catch (err) {
      const errorMsg = err.response?.data?.error?.message || err.message || "Terjadi kesalahan pada server AI";
      return res.status(500).json({
        status: false,
        error: errorMsg
      });
    }
  }
};
