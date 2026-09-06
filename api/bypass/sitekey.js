const axios = require('axios');
const cheerio = require('cheerio');

async function extractSitekey(url) {
  try {
    const { data: html } = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      timeout: 10000
    });

    const $ = cheerio.load(html);
    const sitekeys = new Set();

    $('script').each((_, el) => {
      const content = $(el).html() || '';
      const matches = content.match(/0x[A-Za-z0-9_-]{20,}/g);
      if (matches) matches.forEach(k => sitekeys.add(k));
    });

    $('div.cf-turnstile, [data-sitekey]').each((_, el) => {
      const key = $(el).attr('data-sitekey');
      if (key && key.startsWith('0x')) sitekeys.add(key);
    });

    if (sitekeys.size > 0) {
      return { method: 'HTML/DOM', keys: [...sitekeys] };
    }

    const jsFiles = [...$('script').map((_, el) => $(el).attr('src')).get()]
      .filter(src => src && src.includes('.js'));
    const linkJs = [...$('link[rel="preload"][as="script"], link[rel="modulepreload"]').map((_, el) => $(el).attr('href')).get()]
      .filter(href => href && href.includes('.js'));
    
    const allJsFiles = [...new Set([...jsFiles, ...linkJs])].slice(0, 15);

    for (const jsPath of allJsFiles) {
      try {
        const fullJsUrl = jsPath.startsWith('http') ? jsPath : new URL(jsPath, url).href;
        const { data: jsContent } = await axios.get(fullJsUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          },
          timeout: 5000
        });

        const matches = jsContent.match(/0x[A-Za-z0-9_-]{20,}/g);
        if (matches) {
          matches.forEach(k => sitekeys.add(k));
        }
      } catch (err) {
        continue;
      }
    }

    if (sitekeys.size > 0) {
      return { method: 'External JS Scan', keys: [...sitekeys] };
    }

    return { method: 'None', keys: [] };
  } catch (error) {
    throw new Error(error.message || 'Gagal mengekstrak sitekey');
  }
}

module.exports = [
  {
    name: "Get Sitekey",
    desc: "Extract Cloudflare Turnstile sitekey from target website URL",
    category: "Bypass",
    method: "GET",
    parameters: {
      apikey: { type: "string", required: true },
      url: { type: "string", required: true }
    },
    path: "/api/bypass/getsitekey",
    async run(req, res) {
      const apikey = req.apiKeyInput || req.query.apikey || req.body?.apikey;
      const targetUrl = req.query.url || req.body?.url;

      if (!global.apikey.includes(apikey)) {
        return res.json({ status: false, error: "Apikey invalid" });
      }

      if (!targetUrl) {
        return res.json({
          status: false,
          error: "Parameter 'url' wajib diisi!"
        });
      }

      try {
        const result = await extractSitekey(targetUrl);

        if (result.keys.length === 0) {
          return res.json({
            status: false,
            message: "Sitekey Turnstile tidak ditemukan pada URL tersebut",
            method: result.method
          });
        }

        return res.json({
          status: true,
          method: result.method,
          result: {
            total: result.keys.length,
            sitekeys: result.keys
          }
        });

      } catch (err) {
        return res.status(500).json({
          status: false,
          error: err.message || "Terjadi kesalahan saat mengambil sitekey"
        });
      }
    }
  }
];
