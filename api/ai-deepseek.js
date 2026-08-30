const axios = require('axios');

const AION_API_KEY = "sk-aion-f1ad0d799f876006e48e393261a291493c8debff5b969ba016a8232775e7816a";

async function askDeepSeek(prompt, systemPrompt = "") {
  const messages = [];
  if (systemPrompt) messages.push({ role: "system", content: systemPrompt });
  messages.push({ role: "user", content: prompt });

  const { data } = await axios.post(
    "https://aion.mehho.my.id/v1/chat/completions",
    {
      model: "aion/deepseek-v4-pro",
      messages: messages,
      temperature: 0.7,
      max_tokens: 2000
    },
    {
      headers: {
        "Authorization": `Bearer ${AION_API_KEY}`,
        "Content-Type": "application/json"
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
  desc: "Model AI canggih DeepSeek V4 Pro untuk penalaran kompleks dan pembuatan kode",
  category: "AI",
  path: "/api/ai/deepseek",
  method: "GET",
  parameters: {
    apikey: { type: "string", required: true },
    text: { type: "string", required: true },
    system: { type: "string", required: false }
  },
  async run(req, res, next) {
    try {
      const apikey = req.apiKeyInput || req.query.apikey || req.body?.apikey;
      const text = req.query.text || req.body?.text;
      const systemPrompt = req.query.system || req.body?.system || "";

      if (!global.apikey.includes(apikey)) {
        return res.status(403).json({ status: false, error: "Apikey invalid" });
      }

      if (!text) {
        return res.status(400).json({ status: false, error: "Parameter 'text' wajib diisi!" });
      }

      const responseText = await askDeepSeek(text, systemPrompt);

      return res.json({
        status: true,
        result: {
          model: "DeepSeek-V4-Pro",
          response: responseText
        }
      });
    } catch (err) {
      next(err);
    }
  }
};
