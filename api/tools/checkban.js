const axios = require('axios');

async function checkWhatsAppNumber(phone) {
  const cleanPhone = phone.replace(/[^0-9]/g, '');
  const url = `https://apis.joomods.web.id/whatsapp-check?apikey=9D871118411CF508762ED900BBF3929E&phone=${encodeURIComponent(cleanPhone)}`;

  const response = await axios.get(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'application/json'
    },
    timeout: 25000
  });

  return response.data;
}

module.exports = [
  {
    name: "WhatsApp Ban Checker",
    desc: "Check account safety status, detect ban restrictions, and inspect verification authentication methods for a WhatsApp number.",
    category: "Tools",
    path: "/api/tools/checkban",
    method: "GET",
    parameters: {
      apikey: { type: "string", required: true },
      phone: { type: "string", required: true }
    },
    async run(req, res) {
      const apikey = req.apiKeyInput || req.query?.apikey || req.body?.apikey || req.headers['x-apikey'];
      const phone = req.query?.phone || req.body?.phone;

      if (!global.apikey || !global.apikey.includes(apikey)) {
        return res.status(403).json({ status: false, error: "Apikey invalid" });
      }

      if (!phone || typeof phone !== 'string' || !phone.trim()) {
        return res.status(400).json({ status: false, error: "Parameter 'phone' is required!" });
      }

      try {
        const raw = await checkWhatsAppNumber(phone.trim());

        if (!raw || !raw.result) {
          return res.status(502).json({
            status: false,
            error: "Failed to retrieve WhatsApp verification details from upstream"
          });
        }

        const data = raw.result;
        const detail = data.detail || {};

        return res.json({
          status: true,
          result: {
            phone_number: data.number || phone.trim().replace(/[^0-9]/g, ''),
            status: data.status || "Unknown",
            is_banned: Boolean(data.banned),
            verification_email: detail.email || null,
            recommended_methods: detail.recommended_method || [],
            available_methods: detail.fallback_methods || [],
            otp_eligibility: {
              email_otp: Boolean(detail.email_otp_eligible),
              sms_otp: Boolean(detail.send_sms_eligible),
              silent_auth: Boolean(detail.silent_auth_eligible)
            }
          }
        });
      } catch (err) {
        return res.status(500).json({
          status: false,
          error: err.response?.data?.message || err.message || "Failed to process WhatsApp number check"
        });
      }
    }
  }
];
