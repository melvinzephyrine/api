const axios = require('axios');

function calculateSimilarity(str1, str2) {
  str1 = str1.toLowerCase().replace(/\s+/g, "");
  str2 = str2.toLowerCase().replace(/\s+/g, "");

  if (str1 === str2) return 1;

  const len1 = str1.length;
  const len2 = str2.length;
  const maxLen = Math.max(len1, len2);

  if (str2.includes(str1)) return 0.9;
  if (str1.includes(str2)) return 0.9;

  let matches = 0;
  for (let i = 0; i < Math.min(len1, len2); i++) {
    if (str1[i] === str2[i]) matches++;
  }

  const prefixMatch =
    str1.startsWith(str2.slice(0, 3)) || str2.startsWith(str1.slice(0, 3))
      ? 0.2
      : 0;

  return matches / maxLen + prefixMatch;
}

async function scrapeCountryInfo(name) {
  const [coordsResponse, countriesResponse] = await Promise.all([
    axios.get(
      "https://raw.githubusercontent.com/CoderPopCat/Country-Searcher/refs/heads/master/src/constants/country-coords.json",
      { timeout: 30000 }
    ),
    axios.get(
      "https://raw.githubusercontent.com/CoderPopCat/Country-Searcher/refs/heads/master/src/constants/countries.json",
      { timeout: 30000 }
    ),
  ]);

  const countriesCoords = coordsResponse.data;
  const countriesInfo = countriesResponse.data;

  const searchName = name.toLowerCase().trim();

  const similarityResults = countriesInfo
    .map((country) => ({
      country,
      similarity: calculateSimilarity(searchName, country.country),
    }))
    .sort((a, b) => b.similarity - a.similarity);

  const bestMatch = similarityResults[0];

  if (bestMatch.similarity < 0.4) {
    const suggestions = similarityResults.slice(0, 5).map((r) => ({
      country: r.country.country,
      similarity: r.similarity,
    }));
    const err = new Error("Country not found");
    err.status = 404;
    err.suggestions = suggestions;
    throw err;
  }

  const countryInfo = bestMatch.country;
  const countryCoord = countriesCoords.find(
    (c) => c.name.toLowerCase() === countryInfo.country.toLowerCase()
  );

  const continents = {
    as: { name: "Asia", emoji: "🌏" },
    eu: { name: "Europe", emoji: "🌍" },
    af: { name: "Africa", emoji: "🌍" },
    na: { name: "North America", emoji: "🌎" },
    sa: { name: "South America", emoji: "🌎" },
    oc: { name: "Oceania", emoji: "🌏" },
    an: { name: "Antarctica", emoji: "🌎" },
  };

  const neighbors = countryInfo.neighbors
    .map((neighborCode) => {
      const neighborCountry = countriesCoords.find(
        (c) => c.country.toLowerCase() === neighborCode.toLowerCase()
      );
      return neighborCountry
        ? {
            name: neighborCountry.name,
            flag: neighborCountry.icon,
            coordinates: {
              latitude: neighborCountry.latitude,
              longitude: neighborCountry.longitude,
            },
          }
        : null;
    })
    .filter(Boolean);

  return {
    searchMetadata: {
      originalQuery: name,
      matchedCountry: countryInfo.country,
      similarity: bestMatch.similarity,
    },
    data: {
      name: countryInfo.country,
      capital: countryInfo.capital,
      flag: countryInfo.flag,
      phoneCode: countryInfo.phone_code,
      googleMapsLink: `https://www.google.com/maps/place/${encodeURIComponent(countryInfo.country)}/@${countryCoord?.latitude || 0},${countryCoord?.longitude || 0},6z`,
      continent: {
        code: countryInfo.continent,
        name: continents[countryInfo.continent]?.name || "Unknown",
        emoji: continents[countryInfo.continent]?.emoji || "🌐",
      },
      coordinates: {
        latitude: countryCoord?.latitude || null,
        longitude: countryCoord?.longitude || null,
      },
      area: {
        squareKilometers: countryInfo.area.km2,
        squareMiles: countryInfo.area.mi2,
      },
      landlocked: countryInfo.is_landlocked,
      languages: {
        native: countryInfo.native_language,
        codes: countryInfo.language_codes,
      },
      famousFor: countryInfo.famous_for,
      constitutionalForm: countryInfo.constitutional_form,
      neighbors: neighbors,
      currency: countryInfo.currency,
      drivingSide: countryInfo.drive_direction,
      alcoholProhibition: countryInfo.alcohol_prohibition,
      internetTLD: countryInfo.tld,
      isoCode: {
        numeric: countryInfo.iso.numeric,
        alpha2: countryInfo.iso.alpha_2,
        alpha3: countryInfo.iso.alpha_3,
      },
    },
  };
}

module.exports = {
  name: "Country Info",
  desc: "Mendapatkan informasi lengkap negara seperti ibukota, bendera, bahasa, koordinat, dan mata uang",
  category: "Tools",
  path: "/api/tools/countryInfo",
  method: "GET",
  parameters: {
    apikey: { type: "string", required: true },
    name: { type: "string", required: true, example: "Indonesia" }
  },
  async run(req, res, next) {
    try {
      const apikey = req.apiKeyInput || req.query.apikey || req.body?.apikey;
      const name = req.query.name || req.body?.name;

      if (!global.apikey || !global.apikey.includes(apikey)) {
        return res.status(403).json({ status: false, error: "Apikey invalid" });
      }

      if (!name || typeof name !== "string" || name.trim().length === 0) {
        return res.status(400).json({ status: false, error: "Parameter 'name' wajib diisi!" });
      }

      const result = await scrapeCountryInfo(name.trim());

      return res.json({
        status: true,
        searchMetadata: result.searchMetadata,
        result: result.data
      });
    } catch (err) {
      const statusCode = err.status || 500;
      return res.status(statusCode).json({
        status: false,
        error: err.message || "Terjadi kesalahan pada server",
        ...(err.suggestions && { suggestions: err.suggestions })
      });
    }
  }
};
