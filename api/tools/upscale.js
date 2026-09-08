const axios = require('axios');
const FormData = require('form-data');

const HEADERS = {
  'origin': 'https://tools.cleanpng.com',
  'referer': 'https://tools.cleanpng.com/image-upscaler/',
  'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Safari/537.36'
};

async function clearPngUpload(imageUrl) {
  const imageRes = await axios.get(imageUrl, {
    responseType: 'arraybuffer',
    headers: { 'User-Agent': HEADERS['user-agent'] },
    timeout: 25000
  });

  const buffer = Buffer.from(imageRes.data);
  const form = new FormData();
  form.append('image', buffer, { filename: 'image.png', contentType: 'image/png' });
  form.append('ratio', '2');

  const uploadImg = await axios.post('https://tools.cleanpng.com/image-upscaler/upload.php', form, {
    headers: {
      ...form.getHeaders(),
      ...HEADERS
    },
    timeout: 30000
  });

  if (!uploadImg.data?.success) {
    throw new Error('Gagal mengunggah gambar ke CleanPNG');
  }

  return uploadImg.data;
}

async function clearPngImage(imageUrl, ratio = '2', format = 'png') {
  const uploadData = await clearPngUpload(imageUrl);

  const form = new FormData();
  form.append('path', uploadData.path);
  form.append('ratio', String(ratio));
  form.append('format', String(format));
  form.append('enhance_quality', '1');

  const resultImg = await axios.post('https://tools.cleanpng.com/image-upscaler/upscale.php', form, {
    headers: {
      ...form.getHeaders(),
      ...HEADERS
    },
    timeout: 60000
  });

  if (!resultImg.data?.success) {
    throw new Error('Gagal memproses upscale gambar pada CleanPNG');
  }

  return {
    dimensions: `${resultImg.data.width} x ${resultImg.data.height}`,
    result_url: `https://tools.cleanpng.com/image-upscaler/${resultImg.data.url}`
  };
}

module.exports = [
  {
    name: "Upscale Image V2",
    desc: "Upscale and enhance image resolution up to 2x or 4x ratio using CleanPNG AI.",
    category: "Tools",
    path: "/api/tools/upscale",
    method: "GET",
    parameters: {
      apikey: { type: "string", required: true },
      url: { type: "string", required: true },
      ratio: { type: "select", required: false, selection: ["2", "4"], value: "2" },
      format: { type: "select", required: false, selection: ["png", "jpg"], value: "png" }
    },
    async run(req, res) {
      const apikey = req.apiKeyInput || req.query?.apikey || req.body?.apikey || req.headers['x-apikey'];
      const targetUrl = req.query?.url || req.body?.url;
      const ratio = req.query?.ratio || req.body?.ratio || '2';
      const format = req.query?.format || req.body?.format || 'png';

      if (!global.apikey || !global.apikey.includes(apikey)) {
        return res.status(403).json({ status: false, error: "Apikey invalid" });
      }

      if (!targetUrl || typeof targetUrl !== 'string' || !targetUrl.trim()) {
        return res.status(400).json({ status: false, error: "Parameter 'url' wajib diisi!" });
      }

      let cleanUrl = decodeURIComponent(targetUrl).trim();
      if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
        cleanUrl = 'https://' + cleanUrl.replace(/^https?:\/*/, '');
      }

      try {
        const data = await clearPngImage(cleanUrl, ratio, format);

        return res.json({
          status: true,
          result: {
            ratio: `${ratio}x`,
            format: format.toLowerCase(),
            dimensions: data.dimensions,
            result_url: data.result_url
          }
        });
      } catch (err) {
        return res.status(500).json({
          status: false,
          error: err.response?.data?.message || err.message || "Gagal melakukan upscale gambar"
        });
      }
    }
  }
];