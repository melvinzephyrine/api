const axios = require('axios');

const BaseUrl = 'https://freefire.my.id/api/ff';

async function getFFData(uid) {
  if (!uid || isNaN(uid)) {
    throw new Error('UID tidak valid! Harus berupa angka.');
  }

  const res = await axios.get(BaseUrl, {
    params: { uid: uid },
    headers: {
      'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Mobile Safari/537.36',
      'Referer': `https://freefire.my.id/stalk/${uid}`,
      'Accept': 'application/json, text/plain, */*'
    },
    timeout: 30000
  });

  if (!res.data) {
    throw new Error('Gagal mengambil data dari server Free Fire');
  }

  return res.data;
}

module.exports = [
  {
    name: "Free Fire Stalk",
    desc: "Stalk detail akun Free Fire berdasarkan UID",
    category: "Stalker",
    method: "GET",
    parameters: {
      apikey: { type: "string", required: true },
      uid: { type: "string", required: true }
    },
    path: "/api/stalk/freefire",
    async run(req, res) {
      const apikey = req.apiKeyInput || req.query.apikey || req.body?.apikey;
      const uid = req.query.uid || req.body?.uid;

      if (!global.apikey.includes(apikey)) {
        return res.json({ status: false, error: "Apikey invalid" });
      }

      if (!uid) {
        return res.json({ status: false, error: "Parameter UID wajib diisi" });
      }

      try {
        const result = await getFFData(uid);

        return res.json({
          status: true,
          result
        });
      } catch (err) {
        return res.status(500).json({
          status: false,
          error: err.message || "Gagal melakukan stalk akun Free Fire"
        });
      }
    }
  }
];
