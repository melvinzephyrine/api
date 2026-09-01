const axios = require('axios');
const crypto = require('crypto');

const sessions = new Map();

setInterval(() => {
  const now = Date.now();
  for (const [id, session] of sessions.entries()) {
    if (now - session.lastUpdated > 1800000) {
      sessions.delete(id);
    }
  }
}, 300000);

const list_model = [
  "gemini-3.7-flash-high",
  "gemini-3.7-flash-medium",
  "gemini-3.7-flash-low",
  "gemini-3.6-flash-high",
  "gemini-3.6-flash-medium",
  "gemini-3.6-flash-low",
  "gemini-3.5-flash-high",
  "gemini-3.5-flash-medium",
  "gemini-3.5-flash-low",
  "gemini-3.1-pro-high"
];

module.exports = {
  name: "Gemini V2",
  desc: "Engage in persistent, multi-turn conversations using Google Gemini models with customizable reasoning tiers and stateful session memory.",
  category: "AI",
  path: "/api/ai/geminiv2",
  method: "GET",
  parameters: {
    apikey: { type: "string", required: true },
    text: { type: "string", required: true, example: "Halo, kenalin saya Melvin, nama kamu siapa?" },
    model: {
      type: "select",
      required: false,
      selection: list_model,
      value: "gemini-3.7-flash-high"
    },
    session_id: { type: "string", required: false, example: "" }
  },
  async run(req, res, next) {
    try {
      const apikey = req.apiKeyInput || req.query.apikey || req.body?.apikey;
      const text = req.query.text || req.body?.text || req.query.prompt || req.body?.prompt;
      let model = req.query.model || req.body?.model || "gemini-3.7-flash-high";
      let sessionId = req.query.session_id || req.body?.session_id;

      if (!global.apikey || !global.apikey.includes(apikey)) {
        return res.status(403).json({ status: false, error: "Apikey invalid" });
      }

      if (!text || typeof text !== "string" || text.trim().length === 0) {
        return res.status(400).json({ status: false, error: "Parameter 'text' wajib diisi!" });
      }

      if (!sessionId || !sessions.has(sessionId)) {
        sessionId = sessionId || `session_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
        sessions.set(sessionId, { messages: [], lastUpdated: Date.now() });
      }

      const session = sessions.get(sessionId);
      session.lastUpdated = Date.now();

      session.messages.push({
        role: "user",
        content: text.trim()
      });

      if (session.messages.length > 20) {
        session.messages = session.messages.slice(-20);
      }

      const targetModel = model.startsWith("antigravity/") ? model : `antigravity/${model.trim()}`;

      const response = await axios.post(
        "https://ai.takahasii.my.id/v1/chat/completions",
        {
          model: targetModel,
          messages: session.messages
        },
        {
          headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer sr-live-5dae00f501ec4128"
          },
          timeout: 45000
        }
      );

      const aiReply = response.data?.choices?.[0]?.message?.content || "";

      if (aiReply) {
        session.messages.push({
          role: "assistant",
          content: aiReply
        });
      }

      return res.json({
        status: true,
        session_id: sessionId,
        result: response.data
      });
    } catch (err) {
      const errorMsg = err.response?.data?.error?.message || err.response?.data?.message || err.message || "Terjadi kesalahan saat memproses Gemini AI";
      return res.status(500).json({
        status: false,
        error: errorMsg
      });
    }
  }
};
