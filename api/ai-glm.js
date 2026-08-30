const axios = require('axios');

const AION_API_KEY = "sk-aion-f1ad0d799f876006e48e393261a291493c8debff5b969ba016a8232775e7816a";

const modelMap = {
  'GLM-5.3': 'aion/glm-5.3',
  'GLM-5.3-Flash': 'aion/glm-5.3-flash'
};

const list_model = Object.keys(modelMap);

async function askGLM(prompt, modelChoice, systemPrompt = "") {
  const selectedModel = modelMap[modelChoice] || 'aion/glm-5.3';

  const messages = [];
  if (systemPrompt) messages.push({ role: "system", content: systemPrompt });
  messages.push({ role: "user", content: prompt });

  const { data } = await axios.post(
    "https://aion.mehho.my.id/v1/chat/completions",
    {
      model: selectedModel,
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
  throw new Error("Gagal mendapatkan respon dari GLM AI.");
}

module.exports = {
  name: "GLM AI",
  desc: "Asisten AI serbaguna berbasis GLM dengan pilihan model standar 5.3 dan 5.3 Flash yang super cepat",
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
      value: "GLM-5.3"
    },
    system: { type: "string", required: false }
  },
  async run(req, res, next) {
    try {
      const apikey = req.apiKeyInput || req.query.apikey || req.body?.apikey;
      const text = req.query.text || req.body?.text;
      const modelChoice = req.query.model || req.body?.model || "GLM-5.3";
      const systemPrompt = req.query.system || req.body?.system || "";

      if (!global.apikey.includes(apikey)) {
        return res.status(403).json({ status: false, error: "Apikey invalid" });
      }

      if (!text) {
        return res.status(400).json({ status: false, error: "Parameter 'text' wajib diisi!" });
      }

      const responseText = await askGLM(text, modelChoice, systemPrompt);

      return res.json({
        status: true,
        result: {
          model: modelChoice,
          response: responseText
        }
      });
    } catch (err) {
      next(err);
    }
  }
};
