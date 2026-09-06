const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');

async function googleTTS(text) {
  const url = `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=id&q=${encodeURIComponent(text)}`;
  const { data } = await axios.get(url, {
    responseType: "arraybuffer",
    headers: { "User-Agent": "Mozilla/5.0" },
    timeout: 20000
  });
  return Buffer.from(data);
}

async function uploadToZFile(audioBuffer, filename = "gtts.mp3") {
  const initRes = await axios.post(
    'https://zfile.web.id/api/v1/upload/init',
    {
      filename: filename,
      size: audioBuffer.length,
      mimeType: 'audio/mpeg',
      expiry: 'never'
    },
    {
      headers: { 'Content-Type': 'application/json' },
      timeout: 15000
    }
  );

  const initData = initRes.data;

  if (initData.deduped && initData.url) {
    return initData.url;
  }

  const { supabaseUrl, anonKey, bucket, path: storagePath, token } = initData.upload;
  const supabase = createClient(supabaseUrl, anonKey);

  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .uploadToSignedUrl(storagePath, token, audioBuffer, {
      contentType: 'audio/mpeg'
    });

  if (uploadError) {
    throw new Error(`Upload Supabase gagal: ${uploadError.message}`);
  }

  const finalRes = await axios.post(
    'https://zfile.web.id/api/v1/upload/finalize',
    { ticket: initData.ticket },
    {
      headers: { 'Content-Type': 'application/json' },
      timeout: 15000
    }
  );

  if (!finalRes.data?.url) {
    throw new Error('Gagal mendapatkan tautan publik dari Zfile');
  }

  return finalRes.data.url;
}

module.exports = {
  name: "Google Text To Speech",
  desc: "Ubah teks menjadi suara/audio MP3 Bahasa Indonesia via Google Translate",
  category: "Tools",
  path: "/api/tools/gtts",
  method: "GET",
  parameters: {
    apikey: { type: "string", required: true },
    text: { type: "string", required: true }
  },
  async run(req, res, next) {
    const apikey = req.apiKeyInput || req.query.apikey || req.body?.apikey;
    const text = req.query.text || req.body?.text;

    if (!global.apikey || !global.apikey.includes(apikey)) {
      return res.status(403).json({ status: false, error: "Apikey invalid" });
    }

    if (!text) {
      return res.status(400).json({
        status: false,
        error: "Parameter 'text' wajib diisi!"
      });
    }

    try {
      const audioBuffer = await googleTTS(text);
      
      let audioUrl = null;
      try {
        audioUrl = await uploadToZFile(audioBuffer, `gtts-${Date.now()}.mp3`);
      } catch (e) {
        audioUrl = null;
      }

      if (audioUrl) {
        return res.json({
          status: true,
          result: {
            text: text,
            url: audioUrl
          }
        });
      }

      res.setHeader("Content-Type", "audio/mpeg");
      return res.send(audioBuffer);
    } catch (err) {
      return res.status(500).json({
        status: false,
        error: err.message || "Gagal memproses audio TTS"
      });
    }
  }
};