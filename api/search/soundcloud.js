const cheerio = require('cheerio');

async function scSearch(q) {
  const url = 'https://m.soundcloud.com/search?q=' + encodeURIComponent(q);
  const res = await fetch(url, {
    headers: { 'user-agent': 'Mozilla/5.0' }
  });
  
  const html = await res.text();
  const $ = cheerio.load(html);
  
  const jsonStr = $('#__NEXT_DATA__').text();
  if (!jsonStr) throw new Error("Gagal mengambil data pencarian SoundCloud");
  
  const json = JSON.parse(jsonStr);
  const tracks = json.props?.pageProps?.initialStoreState?.entities?.tracks || {};
  
  const result = Object.values(tracks)
    .filter(v => v && v.data && v.data.title)
    .map(v => {
      const d = v.data;
      return {
        id: d.id || '-',
        title: d.title || '-',
        url: d.permalink_url || '-',
        user_id: d.user_id || '-',
        artwork: d.artwork_url || null,
        duration: d.duration || '-',
        plays: d.playback_count || '-',
        likes: d.likes_count || '-',
        comments: d.comment_count || '-',
        reposts: d.reposts_count || '-',
        created_at: d.created_at || '-'
      };
    });

  return result;
}

module.exports = [
  {
    name: "SoundCloud Search",
    desc: "Cari lagu dan trek audio dari SoundCloud berdasarkan kata kunci",
    category: "Search",
    method: "GET",
    parameters: {
      apikey: { type: "string", required: true },
      query: { type: "string", required: true }
    },
    path: "/api/search/soundcloud",
    async run(req, res) {
      const apikey = req.apiKeyInput || req.query.apikey || req.body?.apikey;
      const query = req.query.query || req.body?.query;

      if (!global.apikey.includes(apikey)) {
        return res.json({ status: false, error: "Apikey invalid" });
      }

      if (!query) {
        return res.json({ status: false, error: "Query pencarian wajib diisi" });
      }

      try {
        const results = await scSearch(query);

        return res.json({
          status: true,
          total: results.length,
          result: results
        });
      } catch (err) {
        return res.status(500).json({
          status: false,
          error: err.message || "Gagal melakukan pencarian di SoundCloud"
        });
      }
    }
  }
];
