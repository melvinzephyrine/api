const axios = require('axios');

class AlightMotionAuth {
    constructor() {
        this.API_KEY = "AIzaSyDtG1AU22ErnQD60AzBAcaknySiz9_CEq0";
        this.HEADERS = {
            "Content-Type": "application/json",
            "X-Android-Package": "com.alightcreative.motion",
            "X-Android-Cert": "ECA6BF91B8715A6F810ED0BBFC65B6CD578F52A8",
            "User-Agent": "Dalvik/2.1.0 (Linux; U; Android 15; 23127PN0CC Build/BP1A.250505.005)"
        };
    }

    async sendMagicLink(email) {
        try {
            await axios.post(
                `https://www.googleapis.com/identitytoolkit/v3/relyingparty/createAuthUri?key=${this.API_KEY}`,
                { identifier: email, continueUri: "http://localhost" },
                { headers: this.HEADERS }
            );

            await axios.post(
                `https://www.googleapis.com/identitytoolkit/v3/relyingparty/getOobConfirmationCode?key=${this.API_KEY}`,
                {
                    requestType: 6,
                    email: email,
                    androidInstallApp: true,
                    canHandleCodeInApp: true,
                    continueUrl: "https://alightcreative.com?ui_sid=0366624874&ui_sd=0",
                    iosBundleId: "com.alightcreative.motion",
                    androidPackageName: "com.alightcreative.motion",
                    androidMinimumVersion: "585",
                    clientType: "CLIENT_TYPE_ANDROID"
                },
                { headers: this.HEADERS }
            );

            return { success: true, message: "Link berhasil dikirim ke email." };
        } catch (error) {
            const errData = error.response?.data ? (typeof error.response.data === 'object' ? JSON.stringify(error.response.data) : error.response.data) : error.message;
            return { success: false, error: errData };
        }
    }
}

const amAuth = new AlightMotionAuth();

module.exports = {
  name: "Alight Motion Send",
  desc: "Kirim magic link ke email untuk aktivasi premium Alight Motion",
  category: "Premium",
  path: "/api/prem/am-send",
  method: "GET",
  parameters: {
    apikey: { type: "string", required: true },
    email: { type: "string", required: true }
  },
  async run(req, res, next) {
    try {
      const apikey = req.apiKeyInput || req.query.apikey || req.body?.apikey;
      const email = req.query.email || req.body?.email;

      if (!global.apikey || !global.apikey.includes(apikey)) {
        return res.status(403).json({ status: false, error: "Apikey invalid" });
      }

      if (!email) {
        return res.status(400).json({ status: false, error: "Parameter 'email' wajib diisi!" });
      }

      const result = await amAuth.sendMagicLink(email);

      if (!result.success) {
        return res.status(500).json({
          status: false,
          error: result.error
        });
      }

      return res.json({
        status: true,
        result: {
          email: email,
          message: result.message
        }
      });
    } catch (err) {
      next(err);
    }
  }
};