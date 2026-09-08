const axios = require('axios');

module.exports = [
  {
    name: "Niat Sholat",
    desc: "Mendapatkan bacaan niat sholat wajib 5 waktu lengkap dengan teks Arab, Latin, dan terjemahannya.",
    category: "Islamic",
    path: "/api/islamic/niatsholat",
    method: "GET",
    parameters: {
      apikey: { type: "string", required: true },
      sholat: { type: "select", required: true, selection: ["subuh", "dzuhur", "ashar", "maghrib", "isya"], value: "subuh" }
    },
    async run(req, res) {
      const apikey = req.apiKeyInput || req.query?.apikey || req.body?.apikey || req.headers['x-apikey'];
      const sholat = req.query?.sholat || req.body?.sholat;

      if (!global.apikey || !global.apikey.includes(apikey)) {
        return res.status(403).json({ status: false, error: "Apikey invalid" });
      }

      if (!sholat || typeof sholat !== 'string' || !sholat.trim()) {
        return res.status(400).json({ status: false, error: "Parameter 'sholat' wajib diisi (subuh, dzuhur, ashar, maghrib, isya)!" });
      }

      try {
        const targetUrl = `https://api.ikyyxd.my.id/islamic/niatsholat?sholat=${encodeURIComponent(sholat.trim().toLowerCase())}`;
        const response = await axios.get(targetUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
          },
          timeout: 15000
        });

        const data = response.data;

        if (!data || !data.result) {
          return res.status(404).json({
            status: false,
            error: `Data niat sholat '${sholat}' tidak ditemukan.`
          });
        }

        return res.json({
          status: true,
          result: {
            sholat: data.sholat || sholat.toLowerCase(),
            arab: data.result.arab || null,
            latin: data.result.latin || null,
            arti: data.result.arti || null
          }
        });
      } catch (err) {
        return res.status(500).json({
          status: false,
          error: err.response?.data?.message || err.message || "Gagal mengambil data niat sholat"
        });
      }
    }
  }
];