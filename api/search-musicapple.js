const axios = require('axios');
const cheerio = require('cheerio');

const client = axios.create({
  baseURL: "https://music.apple.com",
  headers: {
    authority: "music.apple.com",
    accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "accept-language": "en-US,en;q=0.9,id;q=0.8",
    "cache-control": "no-cache",
    pragma: "no-cache",
    referer: "https://music.apple.com/",
    "sec-ch-ua": '"Chromium";v="148", "Google Chrome";v="148", "Not:A-Brand";v="99"',
    "sec-ch-ua-mobile": "?1",
    "sec-ch-ua-platform": '"Android"',
    "sec-fetch-dest": "document",
    "sec-fetch-mode": "navigate",
    "sec-fetch-site": "same-origin",
    "upgrade-insecure-requests": "1",
    "user-agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Mobile Safari/537.36"
  }
});

async function searchAppleMusic(query, limit = 5) {
  if (!query) throw new Error("Parameter query tidak boleh kosong.");

  const { data } = await client.get(`/us/search?term=${encodeURIComponent(query)}`);
  const $ = cheerio.load(data);
  const results = [];

  $('div[aria-label="Songs"] .track-lockup')
    .slice(0, limit)
    .each((_, el) => {
      const item = $(el);
      const title = item.find(".track-lockup__title a").text().trim() || null;
      const link = item.find(".track-lockup__title a").attr("href") || null;
      const artists = item.find(".track-lockup__subtitle a")
        .map((_, artist) => $(artist).text().trim())
        .get();
      const explicit = item.find('[data-testid="explicit-badge"]').length > 0;
      const rawCover = item.find('picture source[type="image/webp"]').attr("srcset")?.split(" ")[0] || null;
      const cover = rawCover ? rawCover.replace(/\/\d+x\d+/, "/600x600") : null;

      results.push({
        title,
        artist: artists.join(", "),
        explicit,
        cover,
        url: link
      });
    });

  return results;
}

module.exports = [
  {
    name: "Apple Music Search",
    desc: "Cari lagu dan informasi musik dari Apple Music berdasarkan kata kunci",
    category: "Search",
    method: "GET",
    parameters: {
      apikey: { 
        type: "string", 
        required: true, 
      },
      query: { 
        type: "string", 
        required: true, 
      },
      limit: { 
        type: "string", 
        required: false, 
        example: "5" 
      }
    },
    path: "/api/search/applemusic",
    async run(req, res) {
      const apikey = req.apiKeyInput || req.query.apikey || req.body?.apikey;
      const query = req.query.query || req.body?.query;
      const limit = parseInt(req.query.limit || req.body?.limit || 5);

      if (!global.apikey.includes(apikey)) {
        return res.json({ status: false, error: "Apikey invalid" });
      }

      if (!query) {
        return res.json({ status: false, error: "Query pencarian wajib diisi" });
      }

      try {
        const results = await searchAppleMusic(query, limit);

        return res.json({
          status: true,
          total: results.length,
          result: results
        });

      } catch (err) {
        return res.status(500).json({
          status: false,
          error: err.message || "Gagal melakukan pencarian di Apple Music"
        });
      }
    }
  }
];
