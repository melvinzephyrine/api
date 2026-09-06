const axios = require("axios");

function extractHashtags(text) {
  if (!text) return [];
  const matches = text.match(/#[\w\u0590-\u05ff]+/gi) || [];
  return [...new Set(matches)];
}

async function scrapeCapcut(inputUrl) {
  if (!inputUrl || !inputUrl.includes("capcut.com")) {
    throw new Error("URL CapCut tidak valid (contoh: https://www.capcut.com/tv2/ZSVEwBgtH/ atau link template-detail)");
  }

  const response = await axios.get(inputUrl, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      "Accept-Language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8"
    },
    timeout: 15000,
    maxRedirects: 5
  });

  const html = response.data;
  let templateData = null;
  let loaderObj = null;

  const scripts = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)];
  for (const s of scripts) {
    if (s[1].includes("loaderData")) {
      try {
        const parsed = JSON.parse(s[1]);
        loaderObj = parsed.loaderData?.["template-detail_$"] || parsed.loaderData?.["template_detail"];
        if (loaderObj?.templateDetail) {
          templateData = loaderObj.templateDetail;
          break;
        }
      } catch (_) {}
    }
  }

  if (!templateData) {
    const getRegex = (re) => html.match(re)?.[1]?.replace(/\\u002F/g, "/") ?? "";
    const getNum = (re) => parseInt(html.match(re)?.[1] || "0", 10);

    const videoUrl = getRegex(/"videoUrl":"(.*?)"/);
    if (!videoUrl) {
      throw new Error("Gagal mengekstrak video dari URL CapCut.");
    }

    const coverUrl = getRegex(/"coverUrl":"(.*?)"/);
    const title = getRegex(/"title":"(.*?)"/);
    const desc = getRegex(/"desc":"(.*?)"/);
    const templateId = getRegex(/"templateId":"(.*?)"/);
    const width = getNum(/"videoWidth":([0-9]+)/);
    const height = getNum(/"videoHeight":([0-9]+)/);
    const duration = getNum(/"templateDuration":([0-9]+)/);
    const createTime = getNum(/"createTime":([0-9]+)/);

    return {
      id: templateId,
      title: title || "CapCut Template",
      description: desc,
      hashtags: extractHashtags(desc),
      cover_url: coverUrl,
      video_url: videoUrl,
      width: width,
      height: height,
      ratio: width && height ? `${width}:${height}` : "9:16",
      duration_ms: duration,
      duration_sec: Number((duration / 1000).toFixed(2)),
      usage_count: getNum(/"usageAmount":([0-9]+)/),
      like_count: getNum(/"likeAmount":([0-9]+)/) || getNum(/"likeCount":([0-9]+)/),
      author: {
        name: getRegex(/"author":\{.*?"name":"(.*?)"/),
        avatar_url: getRegex(/"avatarUrl":"(.*?)"/)
      }
    };
  }

  const createTime = Number(templateData.createTime || 0);
  const duration = Number(templateData.templateDuration || 0);
  const desc = templateData.desc || "";

  return {
    id: String(templateData.templateId || loaderObj?.templateId || ""),
    title: templateData.title || "CapCut Template",
    description: desc,
    hashtags: extractHashtags(desc),
    cover_url: templateData.coverUrl || "",
    video_url: templateData.videoUrl || "",
    width: Number(templateData.videoWidth || 0),
    height: Number(templateData.videoHeight || 0),
    ratio: templateData.videoRatio || (templateData.videoWidth && templateData.videoHeight ? `${templateData.videoWidth}:${templateData.videoHeight}` : ""),
    duration_ms: duration,
    duration_sec: Number((duration / 1000).toFixed(2)),
    usage_count: Number(templateData.usageAmount || 0),
    like_count: Number(templateData.likeAmount || 0),
    play_count: Number(templateData.playAmount || 0),
    comment_count: Number(templateData.commentAmount || 0),
    created_at: createTime ? new Date(createTime * 1000).toISOString() : "",
    author: {
      name: templateData.author?.name || "",
      avatar_url: templateData.author?.avatarUrl || "",
      description: templateData.author?.description || "",
      profile_url: templateData.author?.profileUrl ? `https://www.capcut.com${templateData.author.profileUrl}` : ""
    }
  };
}

module.exports = [
  {
    name: "CapCut Downloader",
    desc: "Fetch and download high-quality videos and template media from CapCut links.",
    category: "Downloader",
    path: "/api/downloader/capcut",
    method: "GET",
    parameters: {
      apikey: { type: "string", required: true },
      url: { type: "string", required: true }
    },
    async run(req, res) {
      const apikey = req.apiKeyInput || req.query.apikey || req.body?.apikey || req.headers['x-apikey'];
      const url = req.query.url || req.body?.url;

      if (!global.apikey || !global.apikey.includes(apikey)) {
        return res.status(403).json({ status: false, error: "Apikey invalid" });
      }

      if (!url || typeof url !== "string" || !url.trim()) {
        return res.status(400).json({ status: false, error: "Parameter 'url' wajib diisi!" });
      }

      try {
        const result = await scrapeCapcut(url.trim());
        return res.json({
          status: true,
          result: result
        });
      } catch (err) {
        return res.status(500).json({
          status: false,
          error: err.message || "Gagal mengambil data video CapCut"
        });
      }
    }
  }
];