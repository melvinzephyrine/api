const { shz: bycf } = require('bycf');

module.exports = [
  {
    name: "Cloudflare Turnstile Min",
    desc: "Solve and bypass Cloudflare Turnstile captcha challenges automatically to obtain clearance tokens.",
    category: "Bypass",
    path: "/api/bypass/turnstile-min",
    method: "GET",
    parameters: {
      apikey: { type: "string", required: true },
      url: { type: "string", required: true },
      sitekey: { type: "string", required: true }
    },
    async run(req, res) {
      const apikey = req.apiKeyInput || req.query?.apikey || req.body?.apikey || req.headers['x-apikey'];
      const targetUrl = req.query?.url || req.body?.url;
      const sitekey = req.query?.sitekey || req.body?.sitekey;

      if (!global.apikey || !global.apikey.includes(apikey)) {
        return res.status(403).json({ status: false, error: "Apikey invalid" });
      }

      if (!targetUrl || typeof targetUrl !== 'string' || !targetUrl.trim()) {
        return res.status(400).json({ status: false, error: "Parameter 'url' target wajib diisi!" });
      }

      if (!sitekey || typeof sitekey !== 'string' || !sitekey.trim()) {
        return res.status(400).json({ status: false, error: "Parameter 'sitekey' Turnstile wajib diisi!" });
      }

      let cleanUrl = decodeURIComponent(targetUrl).trim();
      if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
        cleanUrl = 'https://' + cleanUrl.replace(/^https?:\/*/, '');
      }

      try {
        const token = await bycf.turnstileMin(cleanUrl, sitekey.trim());

        if (!token) {
          throw new Error("Gagal memperoleh token Turnstile dari engine");
        }

        return res.json({
          status: true,
          result: {
            target_url: cleanUrl,
            sitekey: sitekey.trim(),
            token: token
          }
        });
      } catch (err) {
        return res.status(500).json({
          status: false,
          error: err.message || "Gagal memproses bypass Turnstile"
        });
      }
    }
  }
];
