const axios = require('axios');

const AION_API_KEY = "sk-aion-f1ad0d799f876006e48e393261a291493c8debff5b969ba016a8232775e7816a";

const modelMap = {
  'Claude-Fable-5': 'aion/claude-fable-5',
  'Claude-Opus-5': 'aion/claude-opus-5',
  'Claude-Sonnet-5': 'aion/claude-sonnet-5'
};

const list_model = Object.keys(modelMap);

async function askClaude(prompt, modelChoice, systemPrompt = "") {
  const selectedModel = modelMap[modelChoice] || 'aion/claude-fable-5';

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
  throw new Error("Gagal mendapatkan respon dari Claude AI.");
}

module.exports = {
  name: "Claude AI",
  desc: "Asisten AI cerdas berbasis Claude dengan pilihan model",
  category: "AI",
  path: "/api/ai/claude",
  method: "GET",
  parameters: {
    apikey: { type: "string", required: true },
    text: { type: "string", required: true },
    model: {
      type: "select",
      required: false,
      selection: list_model,
      value: "Claude-Fable-5"
    },
    system: { type: "string", required: false }
  },
  async run(req, res, next) {
    try {
      const apikey = req.apiKeyInput || req.query.apikey || req.body?.apikey;
      const text = req.query.text || req.body?.text;
      const modelChoice = req.query.model || req.body?.model || "Claude-Fable-5";
      const systemPrompt = req.query.system || req.body?.system || "";

      if (!global.apikey.includes(apikey)) {
        return res.status(403).json({ status: false, error: "Apikey invalid" });
      }

      if (!text) {
        return res.status(400).json({ status: false, error: "Parameter 'text' wajib diisi!" });
      }

      const responseText = await askClaude(text, modelChoice, systemPrompt);

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
