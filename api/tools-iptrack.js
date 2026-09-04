const axios = require('axios');

async function trackIp(ip = '') {
  const response = await axios.get(`https://ipwho.is/${encodeURIComponent(ip)}`, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    },
    timeout: 15000
  });

  const data = response.data;

  if (!data.success) {
    throw new Error(data.message || "Alamat IP tidak valid atau tidak ditemukan.");
  }

  return {
    ip: data.ip,
    type: data.type,
    continent: data.continent,
    continent_code: data.continent_code,
    country: data.country,
    country_code: data.country_code,
    region: data.region,
    region_code: data.region_code,
    city: data.city,
    latitude: data.latitude,
    longitude: data.longitude,
    is_eu: data.is_eu,
    postal: data.postal,
    calling_code: data.calling_code,
    capital: data.capital,
    borders: data.borders,
    flag: data.flag,
    connection: data.connection,
    timezone: data.timezone
  };
}

module.exports = [
  {
    name: "IP Tracker",
    desc: "Lookup geolocation, network provider, coordinates, and timezone details from any IP address.",
    category: "Tools",
    path: "/api/tools/iptrack",
    method: "GET",
    parameters: {
      apikey: { 
        type: "string", 
        required: true
      },
      ip: { 
        type: "string", 
        required: false
      }
    },
    async run(req, res) {
      const apikey = req.apiKeyInput || req.query.apikey || req.body?.apikey || req.headers['x-apikey'];
      const ip = req.query.ip || req.body?.ip || "";

      if (!global.apikey || !global.apikey.includes(apikey)) {
        return res.status(403).json({ status: false, error: "Apikey invalid" });
      }

      try {
        const result = await trackIp(ip.trim());
        return res.json({
          status: true,
          result: result
        });
      } catch (err) {
        return res.status(400).json({
          status: false,
          error: err.message || "Gagal melacak informasi IP"
        });
      }
    }
  }
];