const axios = require('axios');
const { SocksProxyAgent } = require('socks-proxy-agent');
const FormData = require('form-data');
const { shz: bycf } = require('bycf');

const TARGET_URL = 'https://voxlabs.ornzora.workers.dev';
const TTS_ENDPOINT = `${TARGET_URL}/api/tts`;
const SITEKEY = '0x4AAAAAADxGWHctWk2yfROX';
const PROXY_API_URL = 'https://api.ikyyxd.my.id/v2l/proxy-free/ikyy-xsample';
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36";

async function uploadToZFile(audioBuffer, filename = "vox-tts.mp3") {
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

class VoxTtsBot {
  constructor() {
    this.proxyList = [];
    this.client = null;
  }

  async loadProxies() {
    try {
      const res = await axios.get(PROXY_API_URL, { timeout: 10000 });
      const rawList = Array.isArray(res.data) ? res.data : [];

      this.proxyList = rawList.map(p => {
        const parts = p.trim().split(':');
        return parts.length === 4 ? {
          host: parts[0], port: parseInt(parts[1]),
          userId: parts[2], password: parts[3]
        } : null;
      }).filter(Boolean);

      if (this.proxyList.length === 0) throw new Error('Proxy tidak tersedia');
    } catch (err) {
      throw new Error(`Gagal mengambil proxy: ${err.message}`);
    }
  }

  selectProxy(index = 0) {
    if (!this.proxyList[index]) throw new Error('Index proxy di luar jangkauan');

    const activeProxy = this.proxyList[index];
    const proxyUrl = `socks5://${activeProxy.userId}:${activeProxy.password}@${activeProxy.host}:${activeProxy.port}`;
    const agent = new SocksProxyAgent(proxyUrl);

    this.client = axios.create({
      httpAgent: agent,
      httpsAgent: agent,
      timeout: 30000,
      headers: {
        'User-Agent': UA,
        'Accept': '*/*',
        'Accept-Encoding': 'gzip, deflate, br',
        'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
        'Content-Type': 'application/json',
        'Origin': TARGET_URL,
        'Referer': `${TARGET_URL}/`
      }
    });
  }

  async generateTts(text, voice, token) {
    const payload = {
      text: text,
      lang: 0,
      reverb: true,
      turnstileToken: token,
      voice: Number(voice) || 1
    };

    try {
      const res = await this.client.post(TTS_ENDPOINT, payload, {
        responseType: 'arraybuffer'
      });

      const contentType = res.headers['content-type'] || '';
      if (contentType.includes('application/json')) {
        const errorMsg = Buffer.from(res.data).toString();
        throw new Error(`Server Error: ${errorMsg}`);
      }

      if (res.status === 200 && res.data.byteLength > 1000) {
        return Buffer.from(res.data);
      }

      throw new Error('Respon audio tidak valid atau kosong');
    } catch (err) {
      if (err.response?.status === 403) throw new Error('TURNSTILE_BLOCKED');
      if (err.response?.status === 400) throw new Error(`BAD_REQUEST: ${err.message}`);
      throw err;
    }
  }

  async processText(text, voice = 1, maxRetries = 3) {
    await this.loadProxies();

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        this.selectProxy(attempt % this.proxyList.length);
        const token = await bycf.turnstileMin(TTS_ENDPOINT, SITEKEY);
        const audioBuffer = await this.generateTts(text, voice, token);

        let audioUrl = null;
        try {
          audioUrl = await uploadToZFile(audioBuffer, `vox-${Date.now()}.mp3`);
        } catch (e) {
          audioUrl = null;
        }

        return {
          buffer: audioBuffer,
          url: audioUrl
        };
      } catch (err) {
        if (err.message.includes('TURNSTILE_BLOCKED') && attempt < maxRetries - 1) {
          continue;
        }
        if (attempt === maxRetries - 1) throw err;
      }
    }
  }
}

const voiceOptions = Array.from({ length: 20 }, (_, i) => String(i + 1));

module.exports = {
  name: "Text To Speech",
  desc: "Mengubah teks menjadi suara AI VoxLabs dengan pilihan tipe suara",
  category: "Tools",
  path: "/api/tools/tts",
  method: "GET",
  parameters: {
    apikey: { type: "string", required: true },
    text: { type: "string", required: true },
    voice: {
      type: "select",
      required: false,
      selection: voiceOptions,
      value: "1"
    }
  },
  async run(req, res, next) {
    try {
      const text = req.query.text || req.body?.text;
      const voice = req.query.voice || req.body?.voice || "1";

      if (!text) {
        return res.status(400).json({
          status: false,
          error: "Parameter 'text' wajib diisi!"
        });
      }

      const bot = new VoxTtsBot();
      const result = await bot.processText(text, voice);

      if (result.url) {
        return res.json({
          status: true,
          creator: "Melvin Rest Api",
          result: {
            text: text,
            voice: Number(voice),
            url: result.url
          }
        });
      }

      res.setHeader("Content-Type", "audio/mpeg");
      return res.send(result.buffer);
    } catch (err) {
      next(err);
    }
  }
};
