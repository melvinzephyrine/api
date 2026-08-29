const crypto = require('crypto');

const seedHex = "C5D58EF67A7584E4A29F6C35BBC4EB12";
const keyBytes = Buffer.from(seedHex, "hex");

async function scrapeYtMp4(youtubeUrl) {
  const cdnRes = await fetch("https://media.savetube.vip/api/random-cdn");
  const { cdn } = await cdnRes.json();

  const infoRes = await fetch(`https://${cdn}/v2/info`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Origin": "https://yt-mp4.net",
      "Referer": "https://yt-mp4.net/"
    },
    body: JSON.stringify({ url: youtubeUrl })
  });

  const infoJson = await infoRes.json();
  if (!infoJson.status || !infoJson.data) {
    throw new Error(infoJson.message || "Failed to fetch video information");
  }

  const rawBuffer = Buffer.from(infoJson.data, "base64");
  const iv = rawBuffer.subarray(0, 16);
  const cipherText = rawBuffer.subarray(16);

  const decipher = crypto.createDecipheriv("aes-128-cbc", keyBytes, iv);
  let decrypted = decipher.update(cipherText, null, "utf8");
  decrypted += decipher.final("utf8");

  const videoData = JSON.parse(decrypted);

  async function getDownloadUrl(downloadType, quality, directUrl) {
    if (directUrl && downloadType === "video") {
      return directUrl + `&title=${encodeURIComponent(videoData.titleSlug)}-ytmp4.savetube.vip`;
    }

    const res = await fetch(`https://${cdn}/download`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Origin": "https://yt-mp4.net",
        "Referer": "https://yt-mp4.net/"
      },
      body: JSON.stringify({
        downloadType: downloadType === "audio" || String(quality) === "128" ? "audio" : "video",
        quality: String(quality),
        key: videoData.key
      })
    });

    const json = await res.json();
    return json.data?.downloadUrl || null;
  }

  const seenVideoQualities = new Set();
  const videoDownloads = [];

  for (const v of videoData.video_formats || []) {
    const qKey = v.quality || v.height;
    if (seenVideoQualities.has(qKey)) continue;
    seenVideoQualities.add(qKey);
    const downloadUrl = await getDownloadUrl("video", qKey, v.url);
    videoDownloads.push({
      quality: `${qKey}p`,
      resolution: `${v.width || qKey}x${v.height || qKey}`,
      label: v.label,
      url: downloadUrl
    });
  }

  videoDownloads.sort((a, b) => parseInt(b.quality) - parseInt(a.quality));

  const audioDownloads = [];
  for (const a of videoData.audio_formats || []) {
    const downloadUrl = await getDownloadUrl("audio", a.quality, a.url);
    audioDownloads.push({
      quality: `${a.quality}kbps`,
      label: a.label,
      url: downloadUrl
    });
  }

  return {
    id: videoData.id,
    title: videoData.title,
    duration: videoData.durationLabel,
    thumbnail: videoData.thumbnail,
    videos: videoDownloads,
    audios: audioDownloads
  };
}

module.exports = [
  {
    name: "YouTube Downloader V2",
    desc: "Unduh video dan audio YouTube berbagai kualitas resolusi secara cepat",
    category: "Downloader",
    method: "GET",
    parameters: {
      apikey: { type: "string", required: true },
      url: { type: "string", required: true }
    },
    path: "/api/download/youtubev2",
    async run(req, res) {
      const apikey = req.apiKeyInput || req.query.apikey || req.body?.apikey;
      const url = req.query.url || req.body?.url;

      if (!global.apikey.includes(apikey)) {
        return res.json({ status: false, error: "Apikey invalid" });
      }

      if (!url) {
        return res.json({ status: false, error: "Parameter url YouTube wajib diisi" });
      }

      try {
        const result = await scrapeYtMp4(url);

        return res.json({
          status: true,
          result
        });
      } catch (err) {
        return res.status(500).json({
          status: false,
          error: err.message || "Gagal mengunduh media dari YouTube V2"
        });
      }
    }
  }
];
