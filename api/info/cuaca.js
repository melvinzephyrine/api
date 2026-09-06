const axios = require('axios');

class WilayahService {
  constructor() {
    this.baseUrl =
      "https://raw.githubusercontent.com/kodewilayah/permendagri-72-2019/main/dist/base.csv";
    this.bmkgUrl = "https://api.bmkg.go.id/publik/prakiraan-cuaca";
  }

  determineBMKGUrl(code) {
    const dots = (code.match(/\./g) || []).length;
    const admLevel = dots + 1;
    return `${this.bmkgUrl}?adm${admLevel}=${code}`;
  }

  parseWilayahCode(code) {
    const parts = code.split(".");
    const levels = {
      adm1: parts[0],
      adm2: parts.length >= 2 ? parts.slice(0, 2).join(".") : null,
      adm3: parts.length >= 3 ? parts.slice(0, 3).join(".") : null,
      adm4: parts.length >= 4 ? parts.slice(0, 4).join(".") : null,
    };

    const highestLevel = Object.entries(levels)
      .reverse()
      .find(([_key, value]) => value !== null);

    return {
      ...levels,
      currentLevel: highestLevel ? highestLevel[0] : "adm1",
      bmkgUrl: this.determineBMKGUrl(code),
    };
  }

  calculateSimilarity(searchQuery, targetText) {
    const query = searchQuery.toLowerCase();
    const target = targetText.toLowerCase();

    const queryWords = query.split(" ").filter((w) => w.length > 0);
    const targetWords = target.split(" ").filter((w) => w.length > 0);

    let wordMatchScore = 0;
    let exactMatchBonus = 0;

    for (const queryWord of queryWords) {
      let bestWordScore = 0;

      for (const targetWord of targetWords) {
        if (queryWord === targetWord) {
          bestWordScore = 1;
          exactMatchBonus += 0.2;
          break;
        }

        if (targetWord.includes(queryWord) || queryWord.includes(targetWord)) {
          const matchLength = Math.min(queryWord.length, targetWord.length);
          const maxLength = Math.max(queryWord.length, targetWord.length);
          const partialScore = matchLength / maxLength;
          bestWordScore = Math.max(bestWordScore, partialScore);
        }
      }

      wordMatchScore += bestWordScore;
    }

    const normalizedWordScore = wordMatchScore / queryWords.length;
    return normalizedWordScore + exactMatchBonus;
  }

  async searchWilayah(query) {
    const response = await axios.get(this.baseUrl, { timeout: 20000 });
    const data = response.data;
    const rows = data.split("\n");

    const results = [];

    for (const row of rows) {
      if (!row.trim()) continue;

      const [kode, nama] = row.split(",");
      if (!nama) continue;

      const similarity = this.calculateSimilarity(query, nama);
      const threshold = query.length <= 4 ? 0.4 : 0.3;

      if (similarity > threshold) {
        const wilayahInfo = this.parseWilayahCode(kode);
        results.push({
          kode,
          nama,
          score: similarity,
          ...wilayahInfo,
        });
      }
    }

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, 10);
  }

  async getWeatherData(wilayahCode) {
    const url = this.determineBMKGUrl(wilayahCode);
    const response = await axios.get(url, { timeout: 30000 });
    return response.data.data;
  }

  async scrape(query) {
    const wilayahResults = await this.searchWilayah(query);

    if (wilayahResults.length > 0) {
      const topResult = wilayahResults[0];
      const weatherData = await this.getWeatherData(topResult.kode);

      return {
        wilayah: topResult,
        weather: weatherData,
      };
    }
    return null;
  }
}

const wilayahService = new WilayahService();

module.exports = {
  name: "Info Weather ( Cuaca )",
  desc: "Retrieve real-time weather forecasts and administrative region details from BMKG based on Indonesian location query.",
  category: "Information",
  path: "/api/info/cuaca",
  method: "GET",
  parameters: {
    apikey: { type: "string", required: true },
    q: { type: "string", required: true }
  },
  async run(req, res, next) {
    try {
      const apikey = req.apiKeyInput || req.query.apikey || req.body?.apikey;
      const q = req.query.q || req.body?.q;

      if (!global.apikey || !global.apikey.includes(apikey)) {
        return res.status(403).json({ status: false, error: "Apikey invalid" });
      }

      if (!q || typeof q !== "string" || q.trim().length === 0) {
        return res.status(400).json({ status: false, error: "Parameter 'q' wajib diisi!" });
      }

      const result = await wilayahService.scrape(q.trim());

      if (!result) {
        return res.status(404).json({
          status: false,
          error: `Lokasi '${q}' tidak ditemukan dalam database wilayah BMKG`
        });
      }

      return res.json({
        status: true,
        result: result
      });
    } catch (err) {
      return res.status(500).json({
        status: false,
        error: err.message || "Terjadi kesalahan saat mengambil data cuaca BMKG"
      });
    }
  }
};
