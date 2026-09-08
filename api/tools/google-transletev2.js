const axios = require('axios');

const BASE_URL = 'https://translate.google.co.id';
const DEFAULT_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
};

const GOOGLE_LANGUAGES = [
  { code: 'auto', nameEn: 'Detect language', nameId: 'Deteksi bahasa (Otomatis)' },
  { code: 'en', nameEn: 'English', nameId: 'Inggris' },
  { code: 'id', nameEn: 'Indonesian', nameId: 'Indonesia' },
  { code: 'es', nameEn: 'Spanish', nameId: 'Spanyol' },
  { code: 'fr', nameEn: 'French', nameId: 'Prancis' },
  { code: 'ar', nameEn: 'Arabic', nameId: 'Arab' },
  { code: 'ja', nameEn: 'Japanese', nameId: 'Jepang' },
  { code: 'ko', nameEn: 'Korean', nameId: 'Korea' },
  { code: 'zh-CN', nameEn: 'Chinese (Simplified)', nameId: 'Tionghoa (Sederhana)' },
  { code: 'zh-TW', nameEn: 'Chinese (Traditional)', nameId: 'Tionghoa (Tradisional)' },
  { code: 'de', nameEn: 'German', nameId: 'Jerman' },
  { code: 'it', nameEn: 'Italian', nameId: 'Italia' },
  { code: 'nl', nameEn: 'Dutch', nameId: 'Belanda' },
  { code: 'pt', nameEn: 'Portuguese (Brazil)', nameId: 'Portugis (Brasil)' },
  { code: 'pt-PT', nameEn: 'Portuguese (Portugal)', nameId: 'Portugis (Portugal)' },
  { code: 'ru', nameEn: 'Russian', nameId: 'Rusia' },
  { code: 'hi', nameEn: 'Hindi', nameId: 'Hindi' },
  { code: 'tr', nameEn: 'Turkish', nameId: 'Turkiye' },
  { code: 'vi', nameEn: 'Vietnamese', nameId: 'Vietnam' },
  { code: 'th', nameEn: 'Thai', nameId: 'Thai' },
  { code: 'tl', nameEn: 'Filipino (Tagalog)', nameId: 'Filipina (Tagalog)' },
  { code: 'ms', nameEn: 'Malay', nameId: 'Melayu' },
  { code: 'ms-Arab', nameEn: 'Malay (Jawi)', nameId: 'Melayu (Jawi)' },
  { code: 'jw', nameEn: 'Javanese', nameId: 'Jawa' },
  { code: 'su', nameEn: 'Sundanese', nameId: 'Sunda' },
  { code: 'ban', nameEn: 'Balinese', nameId: 'Bali' },
  { code: 'min', nameEn: 'Minang', nameId: 'Minangkabau' },
  { code: 'ace', nameEn: 'Acehnese', nameId: 'Aceh' },
  { code: 'mad', nameEn: 'Madurese', nameId: 'Madura' },
  { code: 'mak', nameEn: 'Makassar', nameId: 'Makassar' },
  { code: 'bug', nameEn: 'Buginese', nameId: 'Bugis' },
  { code: 'bbc', nameEn: 'Batak Toba', nameId: 'Batak Toba' },
  { code: 'btx', nameEn: 'Batak Karo', nameId: 'Batak Karo' },
  { code: 'bts', nameEn: 'Batak Simalungun', nameId: 'Batak Simalungun' },
  { code: 'bew', nameEn: 'Betawi', nameId: 'Betawi' },
  { code: 'la', nameEn: 'Latin', nameId: 'Latin' }
];

const LANGUAGE_ALIASES = {
  indo: 'id', indonesia: 'id', indonesian: 'id',
  inggris: 'en', english: 'en', eng: 'en',
  jawa: 'jw', javanese: 'jw', jav: 'jw', jv: 'jw',
  sunda: 'su', sundanese: 'su', sun: 'su',
  jepang: 'ja', japanese: 'ja', jap: 'ja', jp: 'ja',
  korea: 'ko', korean: 'ko', kor: 'ko', kr: 'ko',
  china: 'zh-CN', chinese: 'zh-CN', mandarin: 'zh-CN', tionghoa: 'zh-CN', 'zh-cn': 'zh-CN', 'zh-tw': 'zh-TW', taiwan: 'zh-TW',
  kanton: 'yue', cantonese: 'yue',
  arab: 'ar', arabic: 'ar',
  rusia: 'ru', russian: 'ru',
  jerman: 'de', german: 'de',
  prancis: 'fr', french: 'fr',
  spanyol: 'es', spanish: 'es',
  belanda: 'nl', dutch: 'nl',
  italia: 'it', italian: 'it',
  portugis: 'pt', portuguese: 'pt',
  turki: 'tr', turkish: 'tr',
  filipina: 'tl', filipino: 'tl', tagalog: 'tl',
  thailand: 'th', thai: 'th',
  vietnam: 'vi', vietnamese: 'vi',
  melayu: 'ms', malay: 'ms', malaysia: 'ms',
  hindi: 'hi', india: 'hi', latin: 'la',
  bali: 'ban', balinese: 'ban',
  minang: 'min', minangkabau: 'min', padang: 'min',
  madura: 'mad', madurese: 'mad',
  aceh: 'ace', acehnese: 'ace',
  batak: 'bbc', 'batak toba': 'bbc', 'batak karo': 'btx', 'batak simalungun': 'bts',
  makassar: 'mak', bugis: 'bug', buginese: 'bug', betawi: 'bew'
};

function resolveLanguage(input) {
  if (!input || typeof input !== 'string') return 'en';
  const clean = input.trim().toLowerCase();
  if (clean === 'auto') return 'auto';
  if (LANGUAGE_ALIASES[clean]) return LANGUAGE_ALIASES[clean];

  const exactCode = GOOGLE_LANGUAGES.find((l) => l.code.toLowerCase() === clean);
  if (exactCode) return exactCode.code;

  const exactName = GOOGLE_LANGUAGES.find(
    (l) => l.nameEn.toLowerCase() === clean || l.nameId.toLowerCase() === clean
  );
  if (exactName) return exactName.code;

  if (/^[a-zA-Z]{2,3}(-[a-zA-Z]+)?$/.test(input.trim())) {
    return input.trim();
  }
  return 'en';
}

function getLanguageInfo(codeOrName) {
  const code = resolveLanguage(codeOrName);
  const found = GOOGLE_LANGUAGES.find((l) => l.code === code);
  if (found) return found;
  return { code, nameEn: code, nameId: code };
}

function getTTSUrl(text, lang = 'id', speed = 1) {
  const cleanCode = resolveLanguage(lang);
  const safeText = encodeURIComponent(String(text).slice(0, 200));
  return `https://translate.google.com/translate_tts?ie=UTF-8&q=${safeText}&tl=${cleanCode}&client=tw-ob&ttsspeed=${speed}`;
}

async function translateText(text, options = {}) {
  const trimmedText = String(text).trim();
  const fromLang = options.from ? resolveLanguage(options.from) : 'auto';
  const toLang = options.to ? resolveLanguage(options.to) : 'id';

  const endpoints = [
    `https://translate.google.com/translate_a/single?client=dict-chrome-ex&sl=${encodeURIComponent(fromLang)}&tl=${encodeURIComponent(toLang)}&dt=t&dt=bd&dt=rm&dt=at&dt=qc&q=${encodeURIComponent(trimmedText)}`,
    `https://translate.google.co.id/translate_a/single?client=dict-chrome-ex&sl=${encodeURIComponent(fromLang)}&tl=${encodeURIComponent(toLang)}&dt=t&dt=bd&dt=rm&dt=at&dt=qc&q=${encodeURIComponent(trimmedText)}`,
    `https://clients5.google.com/translate_a/t?client=dict-chrome-ex&sl=${encodeURIComponent(fromLang)}&tl=${encodeURIComponent(toLang)}&q=${encodeURIComponent(trimmedText)}`,
  ];

  let lastError = null;
  let rawData = null;

  for (const ep of endpoints) {
    try {
      const res = await axios.get(ep, { headers: DEFAULT_HEADERS, timeout: 15000 });
      if (res.data) {
        rawData = res.data;
        break;
      }
    } catch (err) {
      lastError = err;
    }
  }

  if (!rawData) {
    throw new Error(`Gagal menerjemahkan teks: ${lastError?.message || 'Koneksi gagal'}`);
  }

  if (Array.isArray(rawData) && typeof rawData[0] === 'string') {
    const translatedText = rawData.join('');
    return {
      original_text: trimmedText,
      translated_text: translatedText,
      source: getLanguageInfo(fromLang),
      target: getLanguageInfo(toLang),
      audio: {
        source_tts_url: getTTSUrl(trimmedText, fromLang),
        target_tts_url: getTTSUrl(translatedText, toLang)
      }
    };
  }

  const sentences = rawData[0] || [];
  let translatedText = '';
  let sourcePronunciation = null;
  let targetPronunciation = null;

  for (const s of sentences) {
    if (!Array.isArray(s)) continue;
    if (s[0]) translatedText += s[0];
    if (s[3]) sourcePronunciation = s[3];
    if (s[2] && !s[0]) targetPronunciation = s[2];
  }

  const detectedCode = rawData[2] || (fromLang !== 'auto' ? fromLang : 'en');
  const detectedLangInfo = getLanguageInfo(detectedCode);
  const confidence = typeof rawData[6] === 'number' ? rawData[6] : null;

  const dictionary = [];
  if (Array.isArray(rawData[1])) {
    rawData[1].forEach((item) => {
      if (!Array.isArray(item)) return;
      const partOfSpeech = item[0] || '';
      const words = item[1] || [];
      const entries = [];
      if (Array.isArray(item[2])) {
        item[2].forEach((entry) => {
          if (!Array.isArray(entry)) return;
          entries.push({
            word: entry[0] || '',
            reverse_translations: entry[1] || [],
            frequency: entry[3] || 0
          });
        });
      }
      dictionary.push({
        part_of_speech: partOfSpeech,
        terms: words,
        entries
      });
    });
  }

  const alternatives = [];
  if (Array.isArray(rawData[5])) {
    rawData[5].forEach((item) => {
      if (Array.isArray(item) && Array.isArray(item[2])) {
        item[2].forEach((alt) => {
          if (Array.isArray(alt) && alt[0] && alt[0] !== translatedText && !alternatives.includes(alt[0])) {
            alternatives.push(alt[0]);
          }
        });
      }
    });
  }

  let spellCheck = null;
  if (rawData[7] && Array.isArray(rawData[7]) && rawData[7][1]) {
    spellCheck = {
      suggested_text: rawData[7][1],
      html: rawData[7][0] || null
    };
  }

  return {
    original_text: trimmedText,
    translated_text: translatedText.trim(),
    source: fromLang === 'auto' ? detectedLangInfo : getLanguageInfo(fromLang),
    target: getLanguageInfo(toLang),
    detected_source: fromLang === 'auto' ? { ...detectedLangInfo, confidence } : null,
    pronunciation: {
      source: sourcePronunciation,
      target: targetPronunciation
    },
    dictionary,
    alternatives: alternatives.slice(0, 5),
    spell_check: spellCheck,
    audio: {
      source_tts_url: getTTSUrl(trimmedText, detectedCode),
      target_tts_url: getTTSUrl(translatedText, toLang)
    }
  };
}

module.exports = [
  {
    name: "Google Translator Suite",
    desc: "Comprehensive multi-language text translator with phonetic pronunciation, auto-detection, and dictionary definitions.",
    category: "Tools",
    path: "/api/tools/google-translate",
    method: "GET",
    parameters: {
      apikey: { type: "string", required: true },
      text: { type: "string", required: true },
      from: { type: "string", required: false },
      to: { type: "string", required: false }
    },
    async run(req, res) {
      const apikey = req.apiKeyInput || req.query?.apikey || req.body?.apikey || req.headers['x-apikey'];
      const text = req.query?.text || req.body?.text;
      const from = req.query?.from || req.body?.from || 'auto';
      const to = req.query?.to || req.body?.to || 'id';

      if (!global.apikey || !global.apikey.includes(apikey)) {
        return res.status(403).json({ status: false, error: "Apikey invalid" });
      }

      if (!text || typeof text !== 'string' || !text.trim()) {
        return res.status(400).json({ status: false, error: "Parameter 'text' wajib diisi!" });
      }

      try {
        const result = await translateText(text.trim(), { from, to });
        return res.json({
          status: true,
          result
        });
      } catch (err) {
        return res.status(500).json({
          status: false,
          error: err.message || "Gagal menerjemahkan teks"
        });
      }
    }
  }
];
