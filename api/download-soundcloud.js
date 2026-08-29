async function scdl(url) {
  const base = 'https://convertico.com/';
  const headers = {
    'accept': '*/*',
    'origin': base,
    'referer': base + 'soundcloud-downloader/',
    'user-agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Mobile Safari/537.36 EdgA/147.0.0.0'
  };

  const formInfo = new FormData();
  formInfo.append('action', 'fetch');
  formInfo.append('url', url);

  const info = await fetch(base + 'soundcloud-downloader/soundcloud-downloader.php', {
    method: 'POST',
    headers,
    body: formInfo
  }).then(r => r.json());

  if (!info || info.status !== 'success') {
    throw new Error('Gagal mengambil informasi trek SoundCloud');
  }

  const formDownload = new FormData();
  formDownload.append('action', 'download');
  formDownload.append('url', url);
  formDownload.append('quality', '192');
  formDownload.append('is_playlist', '0');

  const dl = await fetch(base + 'soundcloud-downloader/soundcloud-downloader.php', {
    method: 'POST',
    headers,
    body: formDownload
  }).then(r => r.json());

  if (!dl || !dl.file_url) {
    throw new Error('Gagal mendapatkan link unduhan audio SoundCloud');
  }

  const downloadUrl = base + 'soundcloud-downloader/' + dl.file_url.split('/').map(encodeURIComponent).join('/');

  return {
    status: info.status,
    title: info.title,
    author: info.author,
    duration: `${Math.floor(info.duration / 60)}:${String(info.duration % 60).padStart(2, '0')}`,
    views: info.view_count ? info.view_count.toLocaleString() : '0',
    likes: info.like_count ? info.like_count.toLocaleString() : '0',
    upload: info.upload_date,
    thumbnail: info.thumbnail,
    source: info.url,
    filename: dl.filename,
    size: `${(dl.size / 1024 / 1024).toFixed(2)} MB`,
    format: dl.format,
    download_url: downloadUrl
  };
}

module.exports = [
  {
    name: "SoundCloud Downloader",
    desc: "Unduh trek audio dari SoundCloud menjadi file MP3",
    category: "Downloader",
    method: "GET",
    parameters: {
      apikey: { type: "string", required: true },
      url: { type: "string", required: true }
    },
    path: "/api/download/soundcloud",
    async run(req, res) {
      const apikey = req.apiKeyInput || req.query.apikey || req.body?.apikey;
      const url = req.query.url || req.body?.url;

      if (!global.apikey.includes(apikey)) {
        return res.json({ status: false, error: "Apikey invalid" });
      }

      if (!url) {
        return res.json({ status: false, error: "Parameter url SoundCloud wajib diisi" });
      }

      try {
        const result = await scdl(url);

        return res.json({
          status: true,
          result
        });
      } catch (err) {
        return res.status(500).json({
          status: false,
          error: err.message || "Gagal mengunduh audio dari SoundCloud"
        });
      }
    }
  }
];
