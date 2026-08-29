const axios = require('axios');

async function imageToPrompt(imageUrl, modelChoice = "flux") {
  const img = await axios.get(imageUrl, {
    responseType: "arraybuffer",
    timeout: 30000
  });
  const mime = img.headers["content-type"] || "image/png";
  const base64 = Buffer.from(img.data).toString("base64");
  const dataUrl = `data:${mime};base64,${base64}`;

  const { data } = await axios.post(
    "https://api.imagepromptguru.net/image-to-prompt",
    {
      image: dataUrl,
      language: "en",
      model: modelChoice
    },
    {
      headers: {
        "Content-Type": "application/json",
        "Origin": "https://imagepromptguru.net",
        "Referer": "https://imagepromptguru.net/",
        "User-Agent": "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/139 Mobile Safari/537.36",
        "Accept": "application/json, text/plain, */*"
      },
      timeout: 45000
    }
  );

  if (data && data.prompt) {
    return data.prompt;
  }
  throw new Error(data?.message || "Gagal mengekstrak prompt dari gambar.");
}

const modelOptions = ["flux", "general", "stable_diffusion"];

module.exports = {
  name: "Image To Prompt",
  desc: "Mengubah gambar/foto menjadi teks prompt AI untuk pembuat gambar",
  category: "Tools",
  path: "/api/tools/img2txt",
  method: "GET",
  parameters: {
    apikey: { type: "string", required: true},
    url: { type: "string", required: true },
    model: {
      type: "select",
      required: false,
      selection: modelOptions,
      value: "flux"
    }
  },
  async run(req, res, next) {
    try {
      const apikey = req.apiKeyInput || req.query.apikey || req.body?.apikey;
      const imageUrl = req.query.url || req.body?.url;
      const modelChoice = req.query.model || req.body?.model || "flux";

      if (!global.apikey.includes(apikey)) {
        return res.status(403).json({ status: false, error: "Apikey invalid" });
      }

      if (!imageUrl) {
        return res.status(400).json({
          status: false,
          error: "Parameter 'url' wajib diisi!"
        });
      }

      const promptResult = await imageToPrompt(imageUrl, modelChoice);

      return res.json({
        status: true,
        result: {
          model: modelChoice,
          prompt: promptResult
        }
      });

    } catch (err) {
      next(err);
    }
  }
};