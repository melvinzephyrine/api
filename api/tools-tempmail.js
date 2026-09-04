const axios = require('axios');
const cheerio = require('cheerio');

const BASE_URL = 'https://tempmail-backend.hasnaintariq142.workers.dev';
const CREATE_INBOX_URL = `${BASE_URL}/api/create-inbox`;
const CHECK_INBOX_URL = `${BASE_URL}/api/inbox`;

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Mobile Safari/537.36',
  'Referer': 'https://tempmail.chat/',
  'Origin': 'https://tempmail.chat',
  'Content-Type': 'application/json'
};

function cleanHtmlWithLinks(htmlString) {
  if (!htmlString) return { text: '', links: [] };

  const $ = cheerio.load(htmlString);
  $('script, style, meta, link, img').remove();

  const links = [];
  $('a').each((_, elem) => {
    const url = $(elem).attr('href');
    const text = $(elem).text().trim();
    if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
      links.push({ text: text || 'Link', url });
    }
  });

  $('a').replaceWith(function() {
    const url = $(this).attr('href');
    const text = $(this).text().trim() || 'Link';
    return `\n🔗 ${text}\n ${url}\n`;
  });

  const text = $.text();
  return {
    text: text.replace(/\n\s*\n/g, '\n\n').trim(),
    links
  };
}

module.exports = [
  {
    name: "Temp Mail Create",
    desc: "Generate temporary disposable email inbox with access token for authentication.",
    category: "Tools",
    path: "/api/tools/tempmail",
    method: "GET",
    parameters: {
      apikey: { type: "string", required: true }
    },
    async run(req, res) {
      const apikey = req.apiKeyInput || req.query.apikey || req.body?.apikey || req.headers['x-apikey'];

      if (!global.apikey || !global.apikey.includes(apikey)) {
        return res.status(403).json({ status: false, error: "Apikey invalid" });
      }

      try {
        const { data } = await axios.post(CREATE_INBOX_URL, null, { headers: HEADERS, timeout: 15000 });

        if (!data.success) {
          throw new Error("Gagal membuat inbox temp mail.");
        }

        return res.json({
          status: true,
          result: {
            email: data.email,
            token: data.access_token
          }
        });
      } catch (err) {
        return res.status(500).json({
          status: false,
          error: err.response?.data?.message || err.message || "Gagal membuat email sementara"
        });
      }
    }
  },
  {
    name: "Temp Mail Inbox",
    desc: "Retrieve and inspect received messages and verification links from a temporary email token.",
    category: "Tools",
    path: "/api/tools/tempmail-inbox",
    method: "GET",
    parameters: {
      apikey: { type: "string", required: true },
      token: { type: "string", required: true }
    },
    async run(req, res) {
      const apikey = req.apiKeyInput || req.query.apikey || req.body?.apikey || req.headers['x-apikey'];
      const token = req.query.token || req.body?.token;

      if (!global.apikey || !global.apikey.includes(apikey)) {
        return res.status(403).json({ status: false, error: "Apikey invalid" });
      }

      if (!token || typeof token !== "string" || !token.trim()) {
        return res.status(400).json({ status: false, error: "Parameter 'token' wajib diisi!" });
      }

      try {
        const { data } = await axios.get(CHECK_INBOX_URL, {
          params: { token: token.trim() },
          headers: HEADERS,
          timeout: 20000
        });

        if (!data.success) {
          return res.status(400).json({ status: false, error: "Token tidak valid atau kadaluarsa" });
        }

        const rawMessages = data.messages || [];
        const messages = rawMessages.map(msg => {
          const { text, links } = cleanHtmlWithLinks(msg.html_body);
          return {
            id: msg.id,
            from: msg.sender_name || msg.sender,
            sender_email: msg.sender,
            subject: msg.subject,
            received_at: msg.received_at,
            content_text: text || msg.text_body || "",
            links: links
          };
        });

        return res.json({
          status: true,
          result: {
            total_messages: messages.length,
            messages: messages
          }
        });
      } catch (err) {
        return res.status(500).json({
          status: false,
          error: err.response?.data?.message || err.message || "Gagal memeriksa pesan masuk"
        });
      }
    }
  }
];
