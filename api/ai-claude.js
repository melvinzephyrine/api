const axios = require('axios');

const GOROUTER_API_KEY = "sk-BLcmIhrecBDjH9VtxgwAQG8Wvrww3kLnz451WLWZITEaiXkb";

async function askClaude(prompt) {
  const { data } = await axios.post(
    "https://gorouter.app/v1/chat/completions",
    {
      model: "claude-opus-5-thinking",
      messages: [{ role: "user", content: prompt }]
    },
    {
      headers: {
        "Authorization": `Bearer ${GOROUTER_API_KEY}`,
        "Content-Type": "application/json"
      },
      timeout: 60000
    }
  );

  if (data && data.choices && data.choices.length > 0) {
    return data.choices[0].message.content;
  }
  throw new Error("Gagal mendapatkan respon dari Claude AI.");
}

module.exports = {
  name: "Claude AI",
  desc: "Asisten AI cerdas berbasis model Claude Opus 5 Thinking",
  category: "AI",
  path: "/api/ai/claude",
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

      const responseText = await askClaude(text);

      return res.json({
        status: true,
        result: {
          model: "claude-opus-5-thinking",
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