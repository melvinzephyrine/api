const axios = require('axios');
const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

async function uploadToZfile(buffer, filename = 'image.png') {
  const ext = path.extname(filename).replace('.', '').toLowerCase() || 'png';
  const mimeType = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : `image/${ext}`;

  const initRes = await axios.post(
    'https://zfile.web.id/api/v1/upload/init',
    {
      filename: filename,
      size: buffer.length,
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
    .uploadToSignedUrl(storagePath, token, buffer, {
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
    throw new Error('Gagal mendapatkan link akhir dari Zfile');
  }

  return finalRes.data.url;
}

function formatMemeText(text) {
  if (!text || text.trim() === '') return '_';
  return text
    .trim()
    .replace(/_/g, '__')
    .replace(/-/g, '--')
    .replace(/ /g, '_')
    .replace(/\?/g, '~q')
    .replace(/%/g, '~p')
    .replace(/#/g, '~h')
    .replace(/\//g, '~s');
}

module.exports = [
  {
    name: "Meme Maker (Smeme)",
    desc: "Generate customizable meme images with top and bottom text overlay from an uploaded picture.",
    category: "Maker",
    method: "POST",
    parameters: {
      apikey: { 
        type: "string", 
        required: true
      },
      file: { 
        type: "file", 
        required: true 
      },
      top: { 
        type: "string", 
        required: false, 
        example: "Teks Atas" 
      },
      bottom: { 
        type: "string", 
        required: false, 
        example: "Teks Bawah" 
      }
    },
    path: "/api/maker/smeme",
    async run(req, res) {
      const apikey = req.apiKeyInput || req.query?.apikey || req.body?.apikey || req.headers['x-apikey'];
      const top = req.query?.top || req.body?.top || "";
      const bottom = req.query?.bottom || req.body?.bottom || "";

      const uploadedFile = req.file || (req.files && req.files.length > 0 ? req.files[0] : (req.files?.file || null));

      if (!global.apikey || !global.apikey.includes(apikey)) {
        return res.json({ status: false, error: "Apikey invalid" });
      }

      let fileBuffer = null;
      let tempPath = null;
      let fileName = `image_${Date.now()}.png`;

      if (uploadedFile) {
        fileName = uploadedFile.originalname || uploadedFile.name || fileName;
        if (uploadedFile.path) {
          tempPath = uploadedFile.path;
          fileBuffer = await fsp.readFile(tempPath);
        } else if (uploadedFile.buffer) {
          fileBuffer = uploadedFile.buffer;
        } else if (uploadedFile.data) {
          fileBuffer = uploadedFile.data;
        }
      }

      if (!fileBuffer) {
        return res.status(400).json({ status: false, error: "Parameter 'file' gambar wajib diupload!" });
      }

      if (!top && !bottom) {
        return res.status(400).json({ status: false, error: "Minimal salah satu teks (top atau bottom) harus diisi" });
      }

      try {
        const imageUrl = await uploadToZfile(fileBuffer, fileName);

        const topEncoded = formatMemeText(top);
        const bottomEncoded = formatMemeText(bottom);

        const memeUrl = `https://api.memegen.link/images/custom/${encodeURIComponent(topEncoded)}/${encodeURIComponent(bottomEncoded)}.png?background=${encodeURIComponent(imageUrl)}`;

        if (tempPath && fs.existsSync(tempPath)) {
          try { await fsp.unlink(tempPath); } catch {}
        }

        return res.json({
          status: true,
          result: {
            top_text: top || null,
            bottom_text: bottom || null,
            background_url: imageUrl,
            meme_url: memeUrl
          }
        });
      } catch (err) {
        if (tempPath && fs.existsSync(tempPath)) {
          try { await fsp.unlink(tempPath); } catch {}
        }
        return res.status(500).json({
          status: false,
          error: err.response?.data?.error || err.message || "Terjadi kesalahan saat memproses gambar meme"
        });
      }
    }
  }
];