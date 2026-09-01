const axios = require('axios');

const AIHUBMIX_API_KEY = "sk-QYApwJVHq63A66pwE8F83dE32fAf4cEf9d603fB74bDe45C1";

const list_model = [
  "coding-glm-5.3-flash-free",
  "coding-glm-5.3-free"
];

async function askGLM(prompt, model = "coding-glm-5.3-flash-free") {
  const selectedModel = list_model.includes(model) ? model : "coding-glm-5.3-flash-free";

  const { data } = await axios.post(
    "https://aihubmix.com/v1/chat/completions",
    {
      model: selectedModel,
      messages: [{ role: "user", content: prompt }],
      max_tokens: 65536,
      temperature: 1.0
    },
    {
      headers: {
        "Authorization": `Bearer ${AIHUBMIX_API_KEY}`,
        "Content-Type": "application/json"
      },
      timeout: 60000
    }
  );

  if (data && data.choices && data.choices.length > 0) {
    return data.choices[0].message.content;
  }
  throw new Error("Gagal mendapatkan respon dari GLM AI.");
}

module.exports = {
  name: "GLM AI",
  desc: "Asisten AI pemrograman berbasis model Coding GLM 5.3 Free & Flash",
  category: "AI",
  path: "/api/ai/glm",
  method: "GET",
  parameters: {
    apikey: { type: "string", required: true },
    text: { type: "string", required: true },
    model: {
      type: "select",
      required: false,
      selection: list_model,
      value: "coding-glm-5.3-flash-free"
    }
  },
  async run(req, res, next) {
    try {
      const apikey = req.apiKeyInput || req.query.apikey || req.body?.apikey;
      const text = req.query.text || req.body?.text;
      const model = req.query.model || req.body?.model || "coding-glm-5.3-flash-free";

      if (!global.apikey || !global.apikey.includes(apikey)) {
        return res.status(403).json({ status: false, error: "Apikey invalid" });
      }

      if (!text) {
        return res.status(400).json({ status: false, error: "Parameter 'text' wajib diisi!" });
      }

      const responseText = await askGLM(text, model);

      return res.json({
        status: true,
        result: {
          model: model,
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
