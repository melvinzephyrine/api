const https = require('https');

function generateIqc(payload) {
  const body = {
    sender: payload.sender || "other",
    message: payload.message,
    timestamp: payload.timestamp || payload.time || "21:02",
    time: payload.time || payload.timestamp || "21:02",
    status: {
      carrierName: payload.carrier || "INDOSAT",
      carrier: payload.carrier || "INDOSAT",
      batteryPercentage: Number(payload.battery) || 88,
      battery: Number(payload.battery) || 88,
      signalStrength: Number(payload.signalStrength) || 4,
      wifi: payload.wifi !== "false" && payload.wifi !== false,
      wifiStatus: payload.wifi !== "false" && payload.wifi !== false,
      darkMode: payload.darkMode !== "false" && payload.darkMode !== false,
      isDark: payload.isDark !== "false" && payload.isDark !== false,
    },
    readStatus: payload.readStatus !== "false" && payload.readStatus !== false,
    emojiStyle: payload.emojiStyle || "apple",
    caption: payload.caption || "",
    battery: Number(payload.battery) || 88,
    carrier: payload.carrier || "INDOSAT",
    signalStrength: Number(payload.signalStrength) || 4,
    wifi: payload.wifi !== "false" && payload.wifi !== false,
    darkMode: payload.darkMode !== "false" && payload.darkMode !== false,
    isDark: payload.isDark !== "false" && payload.isDark !== false,
  };

  const data = JSON.stringify(body);

  return new Promise((resolve, reject) => {
    const options = {
      hostname: "iqc.ranggacode.my.id",
      path: "/api/generate",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(data),
        "Accept": "*/*",
        "Origin": "https://iqc.ranggacode.my.id",
        "Referer": "https://iqc.ranggacode.my.id/",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36 Edg/151.0.0.0",
      },
    };

    const req = https.request(options, (res) => {
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => {
        const buffer = Buffer.concat(chunks);
        const contentType = res.headers["content-type"] || "image/png";
        resolve({ buffer, contentType });
      });
    });

    req.on("error", reject);
    req.write(data);
    req.end();
  });
}

module.exports = [
  {
    name: "iPhone Quoted Chat V2",
    desc: "Generate custom fake chat quoted iOS",
    category: "Maker",
    method: "GET",
    parameters: {
      apikey: { type: "string", required: true },
      message: { type: "string", required: true, example: "Hello, Welcome to Melvin Rest Api" },
      sender: { type: "select", required: false, selection: ["self", "other"], value: "other" },
      carrier: { type: "string", required: false, example: "INDOSAT" },
      time: { type: "string", required: false, example: "21:02" },
      battery: { type: "number", required: false, example: "88" }
    },
    path: "/api/maker/iqcv2",
    async run(req, res) {
      const apikey = req.apiKeyInput || req.query.apikey || req.body?.apikey;
      const message = req.query.message || req.body?.message;
      const sender = req.query.sender || req.body?.sender || "other";
      const carrier = req.query.carrier || req.body?.carrier || "INDOSAT";
      const time = req.query.time || req.body?.time || "21:02";
      const battery = req.query.battery || req.body?.battery || 88;

      if (!global.apikey.includes(apikey)) {
        return res.json({ status: false, error: "Apikey invalid" });
      }

      if (!message) {
        return res.json({ status: false, error: "Parameter message wajib diisi" });
      }

      try {
        const { buffer, contentType } = await generateIqc({
          message,
          sender,
          carrier,
          time,
          timestamp: time,
          battery
        });

        res.setHeader("Content-Type", contentType);
        return res.send(buffer);
      } catch (err) {
        return res.status(500).json({
          status: false,
          error: err.message || "Gagal membuat gambar iPhone Quoted Chat V2"
        });
      }
    }
  }
];
