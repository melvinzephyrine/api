const axios = require('axios');
const FormData = require('form-data');

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
    const form = new FormData();
    form.append('file', audioBuffer, {
        filename: filename,
        contentType: 'audio/mpeg'
    });
    form.append('expiry', 'never');

    const res = await axios.post('https://zfile.web.id/api/upload', form, {
        headers: form.getHeaders(),
        timeout: 30000
    });

    if (res.data && res.data.url) {
        return res.data.url;
    }
    throw new Error(`Gagal upload ke zfile: ${JSON.stringify(res.data)}`);
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
    run: async (req, res) => {
        const { text } = req.query;

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
                    creator: "Melvin Rest Api",
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
