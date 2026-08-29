const axios = require('axios');
const crypto = require('crypto');
const FormData = require('form-data');

const listvoice_indo = {
  'Gadis': '173',
  'Ardi': '174',
  'Siti': '404',
  'Dimas': '405',
  'Tuti': '488',
  'Jajang': '489'
};

const listvoice_english = {
  'Abbi': '540',
  'Bella': '541',
  'Hollie': '542',
  'Maisie': '543',
  'Mia': '544',
  'Olivia': '545',
  'Alfie': '546',
  'Elliot': '547',
  'Ethan': '548',
  'Noah': '549'
};

const listvoice_turkish = {
  'Meryem': '218',
  'Ibrahim': '219'
};

const listvoice_japanese = {
  'Aoi': '779',
  'Daichi': '780',
  'Mayu': '781',
  'Naoki': '782',
  'Shiori': '783',
  'Nanami': '178',
  'Keita': '179'
};

const listvoice_korean = {
  'BongJin': '785',
  'GookMin': '786',
  'Hyunsu': '787',
  'JiMin': '788',
  'SeoHyeon': '789',
  'SoonBok': '790',
  'YuJin': '791',
  'SunHi': '180',
  'InJoon': '181'
};

const listvoice_multilingual = {
  'Algenib': '817',
  'Despina': '824',
  'Enceladus': '825',
  'Ava': '663',
  'Marcello': '695',
  'William': '713',
  'Ash': '706',
  'Sage': '709'
};

const voiceMap = {
  ...listvoice_indo,
  ...listvoice_english,
  ...listvoice_turkish,
  ...listvoice_japanese,
  ...listvoice_korean,
  ...listvoice_multilingual
};

Object.values(voiceMap).forEach(id => {
  voiceMap[id] = id;
});

const list_model = Object.keys(voiceMap);

function randomRevenuecatId() {
  return 'rc_anon_' + crypto.randomBytes(8).toString('hex');
}

async function uploadToZFile(audioBuffer, filename = "voiser-tts.mp3") {
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

async function voiserTTS(text, model) {
  const base_url = 'https://app-tts.voiser.ai';

  if (!list_model.includes(model)) {
    throw new Error(`Model '${model}' tidak valid. Pilih dari daftar yang tersedia.`);
  }

  const voiceId = voiceMap[model];
  const revenuecatId = randomRevenuecatId();

  const registerRes = await axios.post(`${base_url}/members`, {
    mac: null,
    platform: "android",
    revenuecatId: revenuecatId,
    fcmToken: ""
  }, {
    headers: {
      'User-Agent': 'Neo/1.0',
      'Content-Type': 'application/json'
    },
    timeout: 15000
  });

  const memberCode = registerRes.data?.memberCode;
  if (!memberCode) throw new Error('Gagal mendaftar sesi di Voiser AI.');

  const generateRes = await axios.post(`${base_url}/tts`, {
    memberCode: memberCode,
    text: text,
    voiceId: voiceId,
    pitch: "0",
    speed: "1.0",
    mood: "neutral",
    instruction: "",
    hasEmotionTag: false,
    lang: "tr"
  }, {
    headers: {
      'User-Agent': 'Dart/3.0 (dart:io)',
      'Content-Type': 'application/json'
    },
    timeout: 20000
  });

  if (generateRes.data?.status !== "1" || !generateRes.data?.file) {
    throw new Error('Gagal mendapatkan audio dari Voiser AI.');
  }

  const originAudioUrl = generateRes.data.file;

  const audioStream = await axios.get(originAudioUrl, {
    responseType: 'arraybuffer',
    timeout: 20000
  });

  const audioBuffer = Buffer.from(audioStream.data);

  return {
    audioBuffer,
    id: generateRes.data.id
  };
}

module.exports = {
  name: "Text To Speech",
  desc: "Mengubah teks menjadi suara AI multi-bahasa menggunakan Voiser AI",
  category: "Tools",
  path: "/api/tools/voiser",
  method: "GET",
  parameters: {
    apikey: { type: "string", required: true },
    text: { type: "string", required: true },
    model: {
      type: "select",
      required: false,
      selection: list_model,
      value: "Gadis"
    }
  },
  async run(req, res, next) {
    try {
      const apikey = req.apiKeyInput || req.query.apikey || req.body?.apikey;
      const text = req.query.text || req.body?.text;
      const model = req.query.model || req.body?.model || "Gadis";

      if (!global.apikey.includes(apikey)) {
        return res.status(403).json({ status: false, error: "Apikey invalid" });
      }

      if (!text) {
        return res.status(400).json({
          status: false,
          error: "Parameter 'text' wajib diisi!"
        });
      }

      const { audioBuffer, id } = await voiserTTS(text, model);

      let zfileUrl = null;
      try {
        zfileUrl = await uploadToZFile(audioBuffer, `voiser-${model}-${Date.now()}.mp3`);
      } catch (e) {
        zfileUrl = null;
      }

      if (zfileUrl) {
        return res.json({
          status: true,
          creator: "Melvin Rest Api",
          result: {
            id: id,
            text: text,
            model: model,
            url: zfileUrl
          }
        });
      }

      res.setHeader("Content-Type", "audio/mpeg");
      return res.send(audioBuffer);

    } catch (err) {
      next(err);
    }
  }
};
