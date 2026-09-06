const axios = require('axios');
const cheerio = require('cheerio');
const FormData = require('form-data');
const { shz: bycf } = require('bycf');

async function downloadAppleMusic(url) {
  if (!/^https?:\/\/music\.apple\.com\/.+/.test(url)) {
    throw new Error("Masukkan URL Apple Music yang valid");
  }

  const client = axios.create({
    baseURL: "https://aplmate.com",
    headers: {
      accept: "*/*",
      "accept-language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7",
      "cache-control": "no-cache",
      pragma: "no-cache",
      origin: "https://aplmate.com",
      referer: "https://aplmate.com/",
      "sec-ch-ua": '"Chromium";v="148", "Google Chrome";v="148", "Not:A-Brand";v="99"',
      "sec-ch-ua-mobile": "?1",
      "sec-ch-ua-platform": '"Android"',
      "sec-fetch-dest": "empty",
      "sec-fetch-mode": "cors",
      "sec-fetch-site": "same-origin",
      "user-agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Mobile Safari/537.36",
      "x-requested-with": "XMLHttpRequest"
    }
  });

  const cfToken = await bycf.turnstileMin("https://aplmate.com/", "0x4AAAAAACd16sFwAoNHGZqs");
  if (!cfToken) {
    throw new Error("Gagal mendapatkan token Turnstile dari bycf");
  }

  const home = await client.get("/");
  const cookies = home.headers["set-cookie"];
  if (cookies?.length) {
    client.defaults.headers.common["cookie"] = cookies.map(v => v.split(";")[0]).join("; ");
  }

  const form = new FormData();
  form.append("url", url);
  form.append("cf-turnstile-response", cfToken);

  const { data: action } = await client.post("/action", form, {
    headers: { ...form.getHeaders() }
  });

  if (action.error) {
    throw new Error(action.message);
  }

  const $ = cheerio.load(action.html);
  const tracks = [];
  $("form[name='submitapurl']").each((_, el) => {
    const $form = $(el);
    tracks.push({
      data: $form.find("input[name='data']").val(),
      base: $form.find("input[name='base']").val(),
      token: $form.find("input[name='token']").val()
    });
  });

  const resultTracks = [];
  let album = null;

  for (const item of tracks) {
    const trackForm = new FormData();
    trackForm.append("data", item.data);
    trackForm.append("base", item.base);
    trackForm.append("token", item.token);

    const { data } = await client.post("/action/track", trackForm, {
      headers: { ...trackForm.getHeaders() }
    });

    if (data.error) {
      throw new Error(data.message);
    }

    const $track = cheerio.load(data.data);
    const parsed = JSON.parse(Buffer.from(item.data, "base64").toString("utf8"));

    if (!album) {
      album = {
        title: parsed.album || null,
        artist: parsed.artist || null,
        cover: parsed.cover || null
      };
    }

    const download = $track('a.abutton[href*="aplmate.com/mp3"]').first().attr("href") || null;

    resultTracks.push({
      id: parsed.id || null,
      title: parsed.name || null,
      artist: parsed.artist || null,
      duration: parsed.duration || null,
      thumbnail: parsed.cover || null,
      download
    });
  }

  return {
    url,
    album,
    total: resultTracks.length,
    tracks: resultTracks
  };
}

module.exports = [
  {
    name: "Apple Music Downloader",
    desc: "Unduh lagu dan album dari Apple Music ke format MP3",
    category: "Downloader",
    method: "GET",
    parameters: {
      apikey: { type: "string", required: true },
      url: { type: "string", required: true }
    },
    path: "/api/download/applemusic",
    async run(req, res) {
      const apikey = req.apiKeyInput || req.query.apikey || req.body?.apikey;
      const url = req.query.url || req.body?.url;

      if (!global.apikey.includes(apikey)) {
        return res.json({ status: false, error: "Apikey invalid" });
      }

      if (!url) {
        return res.json({ status: false, error: "Parameter url Apple Music wajib diisi" });
      }

      try {
        const result = await downloadAppleMusic(url);

        return res.json({
          status: true,
          result
        });
      } catch (err) {
        return res.status(500).json({
          status: false,
          error: err.message || "Gagal mengunduh lagu dari Apple Music"
        });
      }
    }
  }
];
