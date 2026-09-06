const axios = require('axios');
const FormData = require('form-data');
const crypto = require('crypto');
const fs = require('fs');
const fsp = require('fs/promises');
const { createClient } = require('@supabase/supabase-js');

async function uploadToZFile(filePath, filename = 'image.jpg', mimeType = 'image/jpeg') {
  const fileBuffer = fs.readFileSync(filePath);

  const initRes = await axios.post(
    'https://zfile.web.id/api/v1/upload/init',
    {
      filename: filename,
      size: fileBuffer.length,
      mimeType: mimeType,
      expiry: 'never'
    },
    {
      headers: { 'Content-Type': 'application/json' },
      timeout: 15000
    }
  );

  const initData = initRes.data;

  if (initData.deduped && initData.url) {
    return initData.url;
  }

  const { supabaseUrl, anonKey, bucket, path: storagePath, token } = initData.upload;
  const supabase = createClient(supabaseUrl, anonKey);

  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .uploadToSignedUrl(storagePath, token, fileBuffer, {
      contentType: mimeType
    });

  if (uploadError) {
    throw new Error(`Upload Supabase gagal: ${uploadError.message}`);
  }

  const finalRes = await axios.post(
    'https://zfile.web.id/api/v1/upload/finalize',
    { ticket: initData.ticket },
    {
      headers: { 'Content-Type': 'application/json' },
      timeout: 15000
    }
  );

  if (!finalRes.data?.url) {
    throw new Error('Gagal mendapatkan tautan publik dari Zfile');
  }

  return finalRes.data.url;
}

async function unblurFromUrl(imageUrl) {
  const img = await axios.get(imageUrl, { responseType: 'arraybuffer', timeout: 30000 });
  const buffer = Buffer.from(img.data);
  const serial = crypto.randomBytes(16).toString('hex');
  const fname = `Image_${crypto.randomBytes(6).toString('hex')}.jpg`;

  const form = new FormData();
  form.append('original_image_file', buffer, { filename: fname, contentType: 'image/jpeg' });
  form.append('scale_factor', 2);
  form.append('upscale_type', 'image-upscale');

  const headers = { ...form.getHeaders(), 'product-serial': serial };

  const res = await axios.post('https://api.unblurimage.ai/api/imgupscaler/v2/ai-image-unblur/create-job', form, {
    headers,
    timeout: 30000
  });

  const jobId = res.data?.result?.job_id;
  if (!jobId) throw new Error('Job ID tidak ditemukan dari server unblur!');

  let output = null;
  let done = false;
  const timeout = Date.now() + 180000;

  while (!done && Date.now() < timeout) {
    await new Promise(r => setTimeout(r, 3000));
    const poll = await axios.get(`https://api.unblurimage.ai/api/imgupscaler/v2/ai-image-unblur/get-job/${jobId}`, {
      headers,
      timeout: 15000
    });

    if (poll.data?.code === 100000 && poll.data?.result?.output_url?.[0]) {
      output = poll.data.result.output_url[0];
      done = true;
    }
  }

  if (!output) throw new Error('Proses unblur memakan waktu terlalu lama (Timeout)');

  return output;
}

module.exports = [
  {
    name: "Unblur Image",
    desc: "Memperjelas dan memperbaiki resolusi foto/gambar yang buram menggunakan AI",
    category: "Tools",
    method: "POST",
    parameters: {
      apikey: { 
        type: "string", 
        required: true
      },
      image: { 
        type: "file", 
        required: true 
      }
    },
    path: "/api/tools/unblur",
    async run(req, res) {
      const apikey = req.apiKeyInput || req.query?.apikey || req.body?.apikey || req.headers['x-apikey'];
      const uploadedFile = req.files && req.files.length > 0 ? req.files[0] : null;

      if (!global.apikey || !global.apikey.includes(apikey)) {
        return res.status(403).json({ status: false, error: "Apikey invalid" });
      }

      if (!uploadedFile || !uploadedFile.path) {
        return res.status(400).json({ status: false, error: "Wajib mengunggah file gambar (form-data: image)" });
      }

      const tempPath = uploadedFile.path;

      try {
        const fileExt = uploadedFile.originalname?.split('.').pop() || 'jpg';
        const zfileUrl = await uploadToZFile(
          tempPath,
          `unblur-${Date.now()}.${fileExt}`,
          uploadedFile.mimetype || 'image/jpeg'
        );

        const resultUrl = await unblurFromUrl(zfileUrl);

        if (tempPath && fs.existsSync(tempPath)) {
          try { await fsp.unlink(tempPath); } catch (e) {}
        }

        return res.json({
          status: true,
          result: {
            scale: "2x",
            original_url: zfileUrl,
            result_url: resultUrl
          }
        });

      } catch (err) {
        if (tempPath && fs.existsSync(tempPath)) {
          try { await fsp.unlink(tempPath); } catch (e) {}
        }
        return res.status(500).json({
          status: false,
          error: err.response?.data?.error || err.message || "Gagal memperjelas gambar"
        });
      }
    }
  }
];
