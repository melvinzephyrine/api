const axios = require('axios');
const FormData = require('form-data');

const IkyyProxy = 'https://api.ikyyxd.my.id/v2l/proxy-free/ikyy-xsample';

const CONFIG = {
  baseUrl: 'https://api-v2.imgupscaler.ai',
  referer: 'https://magiceraser.org/',
  origin: 'https://magiceraser.org',
  userAgent: 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Mobile Safari/537.36'
};

let PROXY_LIST = [];
let currentProxyIndex = 0;
let lastProxyFetch = 0;

async function getProxies() {
  const now = Date.now();
  if (PROXY_LIST.length > 0 && now - lastProxyFetch < 10 * 60 * 1000) {
    return PROXY_LIST;
  }

  try {
    const res = await axios.get(IkyyProxy, { timeout: 10000 });
    if (Array.isArray(res.data) && res.data.length > 0) {
      PROXY_LIST = res.data.map(p => {
        const parts = p.split(':');
        if (parts.length !== 4) return null;
        const [host, port, username, password] = parts;
        return { protocol: 'http', host, port: parseInt(port), auth: { username, password } };
      }).filter(Boolean);
      lastProxyFetch = now;
    }
  } catch {}

  return PROXY_LIST;
}

function rotateProxy() {
  if (PROXY_LIST.length > 0) {
    currentProxyIndex = (currentProxyIndex + 1) % PROXY_LIST.length;
  }
}

function generateRandomSerial() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

function getCleanHeaders(formHeaders = {}) {
  return {
    'User-Agent': CONFIG.userAgent,
    'Origin': CONFIG.origin,
    'Referer': CONFIG.referer,
    'Product-Code': 'magiceraser',
    'Product-Serial': generateRandomSerial(),
    'Router-Key': 'photo_editor_me_v6',
    'Sec-Ch-Ua': '"Chromium";v="139", "Not;A=Brand";v="99"',
    'Sec-Ch-Ua-Mobile': '?1',
    'Sec-Ch-Ua-Platform': '"Android"',
    ...formHeaders
  };
}

function getAxiosInstance() {
  const config = {
    baseURL: CONFIG.baseUrl,
    timeout: 45000,
    validateStatus: () => true
  };

  if (PROXY_LIST.length > 0) {
    config.proxy = PROXY_LIST[currentProxyIndex];
  }

  return axios.create(config);
}

async function createWatermarkJob(apiClient, imageUrl) {
  const form = new FormData();
  form.append('model_name', 'magiceraser_v6');
  form.append('prompt', '移除所有水印和移除右下角四角星水印');
  form.append('original_image_url', imageUrl);
  form.append('aspect_ratio', 'default');
  form.append('output_format', 'jpg');
  form.append('mode', 'editor');
  form.append('megapixels', '1');

  const res = await apiClient.post('/api/runtime/jobs/create-job', form, {
    headers: getCleanHeaders(form.getHeaders())
  });

  if (res.status !== 200 || !res.data?.code) {
    throw new Error(`Server Error (HTTP ${res.status})`);
  }

  if (res.data.code !== 100000) {
    const msg = res.data.message?.en || '';
    if (msg.toLowerCase().includes('insufficient') || msg.toLowerCase().includes('limit')) {
      throw new Error('INSUFFICIENT_CREDITS');
    }
    throw new Error(msg || `API Error (Code: ${res.data.code})`);
  }

  return res.data.result.job_id;
}

async function pollJobStatus(apiClient, jobId, maxAttempts = 30, interval = 2000) {
  for (let i = 1; i <= maxAttempts; i++) {
    const res = await apiClient.get(`/api/runtime/jobs/get-job/${jobId}`, {
      headers: getCleanHeaders()
    });

    const status = res.data?.result?.status;

    if (status === 1 && res.data.result.output_url) {
      return res.data.result.output_url;
    }

    if (status === -1) throw new Error('AI Processing Failed');

    if (i < maxAttempts) await new Promise(r => setTimeout(r, interval));
  }
  throw new Error('Timeout: Proses remove watermark terlalu lama.');
}

async function processWatermarkRemoval(imageUrl) {
  await getProxies();

  let lastError = null;
  const maxTotalAttempts = Math.max(PROXY_LIST.length * 2, 4);

  for (let attempt = 0; attempt < maxTotalAttempts; attempt++) {
    try {
      const apiClient = getAxiosInstance();
      const jobId = await createWatermarkJob(apiClient, imageUrl);
      const resultUrl = await pollJobStatus(apiClient, jobId);
      return { job_id: jobId, result_url: resultUrl };
    } catch (err) {
      lastError = err;
      rotateProxy();
    }
  }

  throw new Error(lastError?.message || 'Gagal memproses penghapusan watermark');
}

module.exports = [
  {
    name: "Remove Watermark",
    desc: "Erase and remove watermarks or unwanted stamps from an image URL using AI.",
    category: "Tools",
    path: "/api/tools/removewm",
    method: "GET",
    parameters: {
      apikey: { type: "string", required: true },
      url: { type: "string", required: true }
    },
    async run(req, res) {
      const apikey = req.apiKeyInput || req.query?.apikey || req.body?.apikey || req.headers['x-apikey'];
      const targetImageUrl = req.query?.url || req.body?.url;

      if (!global.apikey || !global.apikey.includes(apikey)) {
        return res.status(403).json({ status: false, error: "Apikey invalid" });
      }

      if (!targetImageUrl || typeof targetImageUrl !== "string" || !targetImageUrl.trim()) {
        return res.status(400).json({ status: false, error: "Parameter 'url' wajib diisi!" });
      }

      try {
        const data = await processWatermarkRemoval(targetImageUrl.trim());
        return res.json({
          status: true,
          result: {
            job_id: data.job_id,
            input_url: targetImageUrl.trim(),
            result_url: data.result_url
          }
        });
      } catch (err) {
        return res.status(500).json({
          status: false,
          error: err.message || "Gagal menghapus watermark dari gambar"
        });
      }
    }
  }
];
