const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const BASE_URL = 'https://translate.googleapis.com';
const WEB_URL = 'https://translate.google.co.id';

async function translate(text, options = {}) {
  try {
    if (!text || typeof text !== 'string') {
      throw new Error('Parameter text wajib diisi!');
    }
    const from = options.from || 'auto';
    const to = options.to || 'id';
    
    const params = new URLSearchParams({
      client: 'dict-chrome-ex',
      sl: from,
      tl: to,
      dt: 't',
      q: text
    });
    
    const url = `${BASE_URL}/translate_a/single?${params.toString()}&dt=bd&dt=rm&dt=qca&dt=ss&dt=md`;
    const res = await fetch(url, { headers: { 'user-agent': USER_AGENT } });
    
    if (!res.ok) {
      throw new Error(`Translation failed HTTP ${res.status}`);
    }
    
    const data = await res.json();
    let translatedText = '';
    let pronunciation = null;

    if (Array.isArray(data[0])) {
      for (const item of data[0]) {
        if (typeof item[0] === 'string') {
          translatedText += item[0];
        }
        if (item[2] && typeof item[2] === 'string') {
          pronunciation = item[2];
        }
        if (item[3] && typeof item[3] === 'string') {
          pronunciation = item[3];
        }
      }
    }

    const detectedSource = data[2] || from;
    const dictionary = [];
    
    if (Array.isArray(data[1])) {
      for (const group of data[1]) {
        const pos = group[0] || null;
        const terms = group[1] || [];
        const entries = (group[2] || []).map(entry => ({
          word: entry[0] || null,
          reverseTranslation: entry[1] || [],
          score: entry[3] || null
        }));
        dictionary.push({ partOfSpeech: pos, terms, entries });
      }
    }

    const audioUrl = `${WEB_URL}/translate_tts?ie=UTF-8&q=${encodeURIComponent(translatedText || text)}&tl=${encodeURIComponent(to)}&total=1&idx=0&textlen=${(translatedText || text).length}&client=dict-chrome-ex&prev=input`;

    return {
      status: true,
      result: {
        originalText: text,
        translatedText,
        from: detectedSource,
        to,
        pronunciation,
        dictionary,
        audioUrl
      }
    };
  } catch (error) {
    return {
      status: false,
      message: error.message
    };
  }
}

module.exports = {
  name: "Google Translator",
  desc: "Menerjemahkan teks dari satu bahasa ke bahasa lain menggunakan Google Translate",
  category: "Tools",
  path: "/api/tools/translator",
  method: "GET",
  parameters: {
    apikey: { type: "string", required: true },
    text: { type: "string", required: true, example: "Hello World" },
    to: { type: "string", required: false, example: "id" },
    from: { type: "string", required: false, example: "auto" }
  },
  async run(req, res, next) {
    try {
      const text = req.query.text || req.body?.text;
      const to = req.query.to || req.body?.to || 'id';
      const from = req.query.from || req.body?.from || 'auto';

      if (!text) {
        return res.status(400).json({
          status: false,
          error: "Parameter 'text' wajib diisi!"
        });
      }

      const result = await translate(text, { from, to });

      if (!result.status) {
        return res.status(500).json({
          status: false,
          error: result.message
        });
      }

      return res.json({
        status: true,
        result: result.result
      });
    } catch (err) {
      next(err);
    }
  }
};
