const axios = require('axios');

module.exports = {
  name: "Sub4Unlock Generator",
  desc: "Buat link Sub4Unlock (Bisa pilih sosial media mana saja yang wajib di-sub/follow)",
  category: "Tools",
  path: "/api/tools/sub4unlock",
  method: "GET",
  parameters: {
    apikey: {
      type: "string",
      required: true,
    },
    destinationUrl: {
      type: "string",
      required: true,
      example: "https://example.com/"
    },
    youtubeSub1: {
      type: "string",
      required: false,
      example: "https://youtube.com/@user"
    },
    youtubeSub2: {
      type: "string",
      required: false,
      example: ""
    },
    tgJoin: {
      type: "string",
      required: false,
      example: "https://t.me/user"
    },
    tgJoin2: {
      type: "string",
      required: false,
      example: ""
    },
    igFollow: {
      type: "string",
      required: false,
      example: "https://instagram.com/username"
    },
    igLike: {
      type: "string",
      required: false,
      example: ""
    },
    fbFollow: {
      type: "string",
      required: false,
      example: ""
    },
    twFollow: {
      type: "string",
      required: false,
      example: ""
    },
    discordJoin: {
      type: "string",
      required: false,
      example: ""
    }
  },
  run: async (req, res) => {
    const {
      destinationUrl,
      youtubeSub1,
      youtubeSub2,
      youtubeLikeSub,
      youtubeSubBell,
      youtubeLikeComment,
      igLike,
      igFollow,
      fbFollow,
      twFollow,
      tgJoin,
      discordJoin,
      tgJoin2,
      apikey
    } = req.query;

    if (!apikey || !global.apikey.includes(apikey)) {
      return res.status(403).json({
        status: false,
        error: "Apikey tidak valid atau tidak ditemukan!"
      });
    }

    if (!destinationUrl) {
      return res.status(400).json({
        status: false,
        error: "Parameter 'destinationUrl' wajib diisi!"
      });
    }

    try {
      const formData = new URLSearchParams();
      formData.append('link-1', youtubeSub1 || '');
      formData.append('link-2', youtubeSub2 || '');
      formData.append('link-3', youtubeLikeSub || '');
      formData.append('link-4', youtubeSubBell || '');
      formData.append('link-5', youtubeLikeComment || '');
      formData.append('link-6', igLike || '');
      formData.append('link-7', igFollow || '');
      formData.append('link-8', fbFollow || '');
      formData.append('link-9', twFollow || '');
      formData.append('link-10', tgJoin || '');
      formData.append('link-11', discordJoin || '');
      formData.append('link-12', tgJoin2 || '');
      formData.append('file-link', destinationUrl);
      formData.append('cf_auto_token', '');
      formData.append('cf_visible_token', '');

      const response = await axios.post('https://sub4unlock.io/gendo_ajax.php', formData.toString(), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          'X-Requested-With': 'XMLHttpRequest',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36',
          'Origin': 'https://sub4unlock.io',
          'Referer': 'https://sub4unlock.io/'
        }
      });

      const generatedLink = response.data;

      if (!generatedLink) {
        return res.status(500).json({
          status: false,
          error: "Gagal memproses link dari server Sub4Unlock."
        });
      }

      res.json({
        status: true,
        result: {
          url: generatedLink.trim()
        }
      });

    } catch (error) {
      res.status(500).json({
        status: false,
        error: error.message || "Terjadi kesalahan sistem"
      });
    }
  }
};
