const axios = require('axios');

async function askMercury(prompt) {
  const { data } = await axios.post(
    "https://api.inceptionlabs.ai/v1/chat/completions",
    {
      model: "mercury-2",
      messages: [{ role: "user", content: prompt }]
    },
    {
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer sk_2aaccb6b5dca8e8a6ae5f87b76b19364"
      },
      timeout: 60000
    }
  );

  return data;
}

module.exports = [
  {
    name: "Mercury AI",
    desc: "Fast conversational AI powered by Inception Labs Mercury-2 model.",
    category: "AI",
    path: "/api/ai/mercury",
    method: "GET",
    parameters: {
      apikey: { type: "string", required: true },
      text: { type: "string", required: true }
    },
    async run(req, res) {
      const apikey = req.apiKeyInput || req.query.apikey || req.body?.apikey || req.headers['x-apikey'];
      const text = req.query.text || req.body?.text || req.query.prompt || req.body?.prompt;

      if (!global.apikey || !global.apikey.includes(apikey)) {
        return res.status(403).json({ status: false, error: "Apikey invalid" });
      }

      if (!text || typeof text !== "string" || text.trim().length === 0) {
        return res.status(400).json({ status: false, error: "Parameter 'text' wajib diisi!" });
      }

      try {
        const result = await askMercury(text.trim());
        return res.json({
          status: true,
          result: result
        });
      } catch (err) {
        const errorMsg = err.response?.data?.error?.message || err.response?.data || err.message || "Terjadi kesalahan pada server Mercury AI";
        return res.status(500).json({
          status: false,
          error: errorMsg
        });
      }
    }
  }
];