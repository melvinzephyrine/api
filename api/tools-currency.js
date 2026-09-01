const axios = require('axios');

class UniversalConverter {
  constructor() {
    this.exchangeRates = {};
    this.cryptoPrices = {};
    this.indodaxData = {};
  }

  async httpRequest(url, timeout = 8000) {
    const response = await axios.get(url, {
      timeout,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
    });
    return response.data;
  }

  async fetchExchangeRates() {
    const apis = [
      "https://api.exchangerate-api.com/v4/latest/USD",
      "https://open.er-api.com/v6/latest/USD",
      "https://api.fxratesapi.com/latest?base=USD",
      "https://api.exchangerate.host/latest?base=USD",
      "https://cdn.jsdelivr.net/gh/fawazahmed0/currency-api@1/latest/currencies/usd.json",
    ];

    for (const api of apis) {
      try {
        const data = await this.httpRequest(api, 5000);

        if (data.rates && Object.keys(data.rates).length > 50) {
          this.exchangeRates = data.rates;
          return true;
        }

        if (data.usd && Object.keys(data.usd).length > 50) {
          this.exchangeRates = {};
          for (const [currency, rate] of Object.entries(data.usd)) {
            this.exchangeRates[currency.toUpperCase()] = rate;
          }
          return true;
        }

        if (data.data && Object.keys(data.data).length > 50) {
          this.exchangeRates = data.data;
          return true;
        }
      } catch {
        continue;
      }
    }

    throw new Error("Gagal mengambil data kurs mata uang fiat");
  }

  async fetchCryptoPrices() {
    const endpoints = [
      async () => {
        const batchUrl = "https://api.binance.com/api/v3/ticker/price";
        const data = await this.httpRequest(batchUrl, 6000);
        if (Array.isArray(data)) {
          return data.filter((item) => item.symbol && item.symbol.endsWith("USDT"));
        }
        return [];
      },
      async () => {
        const url = "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=250&page=1";
        return await this.httpRequest(url, 8000);
      },
      async () => {
        return await this.httpRequest("https://api.coincap.io/v2/assets?limit=200", 6000);
      },
      async () => {
        return await this.httpRequest("https://api.kucoin.com/api/v1/market/allTickers", 6000);
      }
    ];

    this.cryptoPrices = {};

    for (let i = 0; i < endpoints.length; i++) {
      try {
        const data = await endpoints[i]();

        if (Array.isArray(data)) {
          if (data[0] && data[0].symbol && data[0].symbol.includes("USDT")) {
            data.forEach((item) => {
              if (item.symbol && item.price) {
                const symbol = item.symbol.replace("USDT", "").replace("BUSD", "").replace("USDC", "");
                const price = parseFloat(item.price);
                if (price > 0) this.cryptoPrices[symbol] = price;
              }
            });
          } else if (data[0] && data[0].current_price) {
            data.forEach((item) => {
              if (item.symbol && item.current_price) {
                this.cryptoPrices[item.symbol.toUpperCase()] = parseFloat(item.current_price);
              }
            });
          }
        }

        if (data && data.data) {
          if (Array.isArray(data.data)) {
            data.data.forEach((item) => {
              if (item.symbol && (item.priceUsd || item.price)) {
                const price = parseFloat(item.priceUsd || item.price);
                if (price > 0) this.cryptoPrices[item.symbol] = price;
              }
            });
          } else if (data.data.ticker) {
            data.data.ticker.forEach((item) => {
              if (item.symbol && item.last && item.symbol.includes("USDT")) {
                const symbol = item.symbol.replace("USDT", "");
                this.cryptoPrices[symbol] = parseFloat(item.last);
              }
            });
          }
        }

        if (Object.keys(this.cryptoPrices).length > 30) break;
      } catch {
        continue;
      }
    }

    if (Object.keys(this.cryptoPrices).length === 0) {
      throw new Error("Gagal mengambil data harga cryptocurrency");
    }
  }

  async fetchIndodaxData() {
    try {
      const data = await this.httpRequest("https://indodax.com/api/ticker_all", 5000);
      this.indodaxData = {};

      if (data && data.tickers) {
        for (const [pair, info] of Object.entries(data.tickers)) {
          const [crypto, fiat] = pair.split("_");
          if (fiat === "idr" && info.last) {
            this.indodaxData[crypto.toUpperCase()] = {
              price_idr: parseFloat(info.last),
              high: parseFloat(info.high),
              low: parseFloat(info.low),
              volume: parseFloat(info[`vol_${crypto}`]),
              buy: parseFloat(info.buy),
              sell: parseFloat(info.sell),
              server_time: info.server_time,
            };
          }
        }
      }
    } catch {
      this.indodaxData = {};
    }
  }

  async getAllData() {
    await Promise.all([
      this.fetchExchangeRates(),
      this.fetchCryptoPrices(),
      this.fetchIndodaxData(),
    ]);
  }

  isCrypto(currency) {
    currency = currency.toUpperCase();
    return (
      this.cryptoPrices.hasOwnProperty(currency) ||
      this.indodaxData.hasOwnProperty(currency)
    );
  }

  isFiat(currency) {
    currency = currency.toUpperCase();
    return currency === "USD" || this.exchangeRates.hasOwnProperty(currency);
  }

  getCryptoPrice(currency) {
    currency = currency.toUpperCase();
    if (this.cryptoPrices[currency]) {
      return this.cryptoPrices[currency];
    }
    if (this.indodaxData[currency] && this.exchangeRates.IDR) {
      return this.indodaxData[currency].price_idr / this.exchangeRates.IDR;
    }
    return null;
  }

  async convert(amount, fromCurrency, toCurrency) {
    await this.getAllData();

    fromCurrency = fromCurrency.toUpperCase();
    toCurrency = toCurrency.toUpperCase();

    const amountNum = parseFloat(amount);
    if (!amountNum || isNaN(amountNum) || amountNum <= 0) {
      throw new Error("Jumlah (amount) tidak valid");
    }

    if (!this.isFiat(fromCurrency) && !this.isCrypto(fromCurrency)) {
      throw new Error(`Mata uang '${fromCurrency}' tidak didukung`);
    }

    if (!this.isFiat(toCurrency) && !this.isCrypto(toCurrency)) {
      throw new Error(`Mata uang '${toCurrency}' tidak didukung`);
    }

    let convertedAmount = 0;

    if (this.isFiat(fromCurrency) && this.isFiat(toCurrency)) {
      const fromRate = fromCurrency === "USD" ? 1 : this.exchangeRates[fromCurrency];
      const toRate = toCurrency === "USD" ? 1 : this.exchangeRates[toCurrency];
      convertedAmount = (amountNum / fromRate) * toRate;
    } else if (this.isFiat(fromCurrency) && this.isCrypto(toCurrency)) {
      const fromRate = fromCurrency === "USD" ? 1 : this.exchangeRates[fromCurrency];
      const cryptoPrice = this.getCryptoPrice(toCurrency);
      if (!cryptoPrice) throw new Error(`Harga crypto ${toCurrency} tidak ditemukan`);
      const usdAmount = amountNum / fromRate;
      convertedAmount = usdAmount / cryptoPrice;
    } else if (this.isCrypto(fromCurrency) && this.isFiat(toCurrency)) {
      const cryptoPrice = this.getCryptoPrice(fromCurrency);
      if (!cryptoPrice) throw new Error(`Harga crypto ${fromCurrency} tidak ditemukan`);
      const toRate = toCurrency === "USD" ? 1 : this.exchangeRates[toCurrency];
      const usdAmount = amountNum * cryptoPrice;
      convertedAmount = usdAmount * toRate;
    } else if (this.isCrypto(fromCurrency) && this.isCrypto(toCurrency)) {
      const fromPrice = this.getCryptoPrice(fromCurrency);
      const toPrice = this.getCryptoPrice(toCurrency);
      if (!fromPrice || !toPrice) throw new Error(`Harga crypto tidak lengkap`);
      convertedAmount = (amountNum * fromPrice) / toPrice;
    }

    return {
      amount: amountNum,
      from: fromCurrency,
      to: toCurrency,
      result: convertedAmount,
      rate: convertedAmount / amountNum,
    };
  }
}

const converter = new UniversalConverter();

module.exports = {
  name: "Currency Converter",
  desc: "Konversi nilai mata uang realtime antara Fiat (USD, IDR, EUR, dll) dan Cryptocurrency (BTC, ETH, USDT, dll)",
  category: "Tools",
  path: "/api/tools/currency-convert",
  method: "GET",
  parameters: {
    apikey: { type: "string", required: true },
    amount: { type: "number", required: true, example: "100" },
    from: { type: "string", required: true, example: "USD" },
    to: { type: "string", required: true, example: "IDR" }
  },
  async run(req, res, next) {
    try {
      const apikey = req.apiKeyInput || req.query.apikey || req.body?.apikey;
      const amount = req.query.amount || req.body?.amount;
      const from = req.query.from || req.body?.from;
      const to = req.query.to || req.body?.to;

      if (!global.apikey || !global.apikey.includes(apikey)) {
        return res.status(403).json({ status: false, error: "Apikey invalid" });
      }

      if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
        return res.status(400).json({ status: false, error: "Parameter 'amount' wajib berupa angka positif!" });
      }

      if (!from || typeof from !== "string" || from.trim().length === 0) {
        return res.status(400).json({ status: false, error: "Parameter 'from' wajib diisi!" });
      }

      if (!to || typeof to !== "string" || to.trim().length === 0) {
        return res.status(400).json({ status: false, error: "Parameter 'to' wajib diisi!" });
      }

      const result = await converter.convert(Number(amount), from.trim(), to.trim());

      return res.json({
        status: true,
        result: result
      });
    } catch (err) {
      return res.status(500).json({
        status: false,
        error: err.message || "Terjadi kesalahan saat memproses konversi mata uang"
      });
    }
  }
};
