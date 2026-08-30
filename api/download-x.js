const axios = require('axios');

const headers = {
  'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
  'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
  'accept-language': 'id-ID,id;q=0.9,en-US;q=0.6',
  'sec-ch-ua': '"Chromium";v="140", "Not?A_Brand";v="8"',
  'sec-ch-ua-mobile': '?0',
  'sec-ch-ua-platform': '"Linux"',
  'sec-fetch-site': 'none',
  'sec-fetch-mode': 'navigate',
  'sec-fetch-user': '?1',
  'sec-fetch-dest': 'document',
  'upgrade-insecure-requests': '1'
};

async function fetchHtml(url) {
  try {
    const res = await axios.get(url, { headers: headers, timeout: 20000 });
    return res.data;
  } catch (e) {
    return null;
  }
}

function parseMeta(html) {
  const meta = {};
  for (const m of html.matchAll(/<meta\s+(?:property|name)="([^"]+)"\s+content="([^"]*)"/g)) meta[m[1]] = m[2];
  for (const m of html.matchAll(/<meta\s+content="([^"]*)"\s+(?:property|name)="([^"]+)"/g)) meta[m[2]] = m[1];
  return meta;
}

function parseAuthor(html) {
  const store = {};

  for (const m of html.matchAll(/"client:(VXNlcj[^"]+):core":\$R\[\d+\]=\{[^}]*name:"([^"]+)",screen_name:"([^"]+)"\}/g)) {
    const k = 'client:' + m[1];
    store[k] = store[k] || {};
    store[k].name = m[2];
    store[k].screen_name = m[3];
  }

  for (const m of html.matchAll(/"client:(VXNlcj[^"]+):avatar":\$R\[\d+\]=\{[^}]*image_url:"(https?:\/\/[^"]+)"\}/g)) {
    const k = 'client:' + m[1];
    store[k] = store[k] || {};
    store[k].avatar_url = m[2].replace(/_normal\./, '_400x400.');
  }

  for (const m of html.matchAll(/"client:(VXNlcj[^"]+):relationship_counts":\$R\[\d+\]=\{[^}]*followers:(\d+),following:(\d+)\}/g)) {
    const k = 'client:' + m[1];
    store[k] = store[k] || {};
    store[k].followers = parseInt(m[2]);
    store[k].following = parseInt(m[3]);
  }

  for (const m of html.matchAll(/"client:(VXNlcj[^"]+):tweet_counts":\$R\[\d+\]=\{[^}]*tweets:(\d+)\}/g)) {
    const k = 'client:' + m[1];
    store[k] = store[k] || {};
    store[k].tweet_count = parseInt(m[2]);
  }

  for (const m of html.matchAll(/"client:(VXNlcj[^"]+):verification":\$R\[\d+\]=\{[^}]*is_blue_verified:(!0|!1|true|false)[^}]*verified_type:([^,}]+)/g)) {
    const k = 'client:' + m[1];
    store[k] = store[k] || {};
    store[k].is_blue_verified = m[2] === '!0' || m[2] === 'true';
    const vt = m[3].trim();
    store[k].verified_type = vt === 'null' ? null : vt.replace(/"/g, '');
  }

  for (const m of html.matchAll(/"client:(VXNlcj[^"]+):privacy":\$R\[\d+\]=\{[^}]*protected:(!0|!1|true|false)/g)) {
    const k = 'client:' + m[1];
    store[k] = store[k] || {};
    store[k].is_protected = m[2] === '!0' || m[2] === 'true';
  }

  for (const m of html.matchAll(/"client:(VXNlcj[^"]+):profile_bio":\$R\[\d+\]=\{[^}]*description:"([^"]*)"\}/g)) {
    const k = 'client:' + m[1];
    store[k] = store[k] || {};
    store[k].bio = m[2].replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\');
  }

  for (const m of html.matchAll(/__id:"(VXNlcj[^"]+)",__typename:"User",rest_id:"(\d+)"/g)) {
    const k = 'client:' + m[1];
    store[k] = store[k] || {};
    store[k].user_id = m[2];
  }

  const users = Object.values(store).filter(v => v.name && v.screen_name);
  if (!users.length) return null;

  const u = users[0];
  return {
    user_id: u.user_id || null,
    name: u.name,
    screen_name: u.screen_name,
    bio: u.bio || null,
    avatar_url: u.avatar_url || null,
    is_blue_verified: u.is_blue_verified || false,
    verified_type: u.verified_type || null,
    is_protected: u.is_protected || false,
    followers: u.followers || 0,
    following: u.following || 0,
    tweet_count: u.tweet_count || 0
  };
}

function parseVideoVariants(html, tweetRelayId) {
  const variants = [];

  const variantRe = new RegExp(
    `"client:${tweetRelayId}:media_entities2:\\d+:video_info:variants:\\d+":\\$R\\[\\d+\\]=\\{[^}]*bitrate:(\\d+|null),content_type:"([^"]+)",url:"([^"]+)"\\}`,
    'g'
  );

  for (const m of html.matchAll(variantRe)) {
    variants.push({
      bitrate: m[1] === 'null' ? null : parseInt(m[1]),
      content_type: m[2],
      url: m[3]
    });
  }

  if (!variants.length) {
    const genericRe = /"ApiMediaEntityVideoVariant",bitrate:(\d+|null),content_type:"([^"]+)",url:"(https?:\/\/video\.twimg\.com[^"]+)"/g;
    for (const m of html.matchAll(genericRe)) {
      variants.push({
        bitrate: m[1] === 'null' ? null : parseInt(m[1]),
        content_type: m[2],
        url: m[3]
      });
    }
  }

  const seen = new Set();
  const deduped = [];
  for (const v of variants) {
    if (!seen.has(v.url)) {
      seen.add(v.url);
      deduped.push(v);
    }
  }

  return deduped.sort((a, b) => {
    if (a.bitrate === null) return 1;
    if (b.bitrate === null) return -1;
    return b.bitrate - a.bitrate;
  });
}

function parseMedia(html, meta, tweetRelayId) {
  const mediaItems = [];

  const hasVideo = html.includes('video.twimg.com/amplify_video') ||
    html.includes('video.twimg.com/ext_tw_video') ||
    html.includes('video.twimg.com/tweet_video');

  if (hasVideo) {
    const thumbMatch =
      html.match(/itemProp="thumbnailUrl"\s+content="([^"]+)"/) ||
      html.match(/content="([^"]+)"\s+itemProp="thumbnailUrl"/) ||
      html.match(/amplify_video_thumb\/[^/]+\/img\/([A-Za-z0-9_.-]+\.jpg)/);

    const thumbUrl = thumbMatch
      ? (thumbMatch[0].includes('http') ? thumbMatch[1] : `https://pbs.twimg.com/amplify_video_thumb/${thumbMatch[0].match(/amplify_video_thumb\/(\d+)/)?.[1]}/img/${thumbMatch[1]}`)
      : null;

    const durationMatch = html.match(/itemProp="duration"\s+content="([^"]+)"/) ||
      html.match(/content="([^"]+)"\s+itemProp="duration"/);

    const widthMatch = html.match(/itemProp="width"\s+content="(\d+)"/) ||
      html.match(/content="(\d+)"\s+itemProp="width"/);

    const heightMatch = html.match(/itemProp="height"\s+content="(\d+)"/) ||
      html.match(/content="(\d+)"\s+itemProp="height"/);

    const variants = parseVideoVariants(html, tweetRelayId);

    const mp4Variants = variants.filter(v => v.content_type === 'video/mp4');
    const m3u8Variants = variants.filter(v => v.content_type !== 'video/mp4');

    const isGif = html.includes('tweet_video') && !html.includes('amplify_video');

    mediaItems.push({
      type: isGif ? 'gif' : 'video',
      thumbnail_url: thumbUrl,
      duration_iso: durationMatch ? durationMatch[1] : null,
      width: widthMatch ? parseInt(widthMatch[1]) : null,
      height: heightMatch ? parseInt(heightMatch[1]) : null,
      variants: mp4Variants,
      playlist: m3u8Variants.length ? m3u8Variants[0].url : null,
      best_url: mp4Variants.length ? mp4Variants[0].url : (m3u8Variants.length ? m3u8Variants[0].url : null)
    });
  }

  if (!hasVideo || !mediaItems.length) {
    const photoUrls = new Set();

    if (meta['og:image']) {
      const url = meta['og:image'].replace(/:[a-z]+$/, '');
      photoUrls.add({
        type: 'photo',
        url,
        width: parseInt(meta['og:image:width'] || '0') || null,
        height: parseInt(meta['og:image:height'] || '0') || null
      });
    }

    for (const m of html.matchAll(/pbs\.twimg\.com\/media\/([A-Za-z0-9_-]+\.\w+)/g)) {
      const url = `https://pbs.twimg.com/media/${m[1]}`;
      if (![...photoUrls].some(p => p.url === url)) {
        photoUrls.add({ type: 'photo', url, width: null, height: null });
      }
    }

    for (const p of photoUrls) mediaItems.push(p);
  }

  return mediaItems;
}

function getTweetRelayId(tweetId) {
  return Buffer.from(`Tweet:${tweetId}`).toString('base64');
}

async function xdl(tweetUrl) {
  const cleanUrl = tweetUrl.split('?')[0];
  const html = await fetchHtml(cleanUrl);

  if (!html) {
    throw new Error("Gagal mengambil halaman Twitter / Tweet tidak ditemukan");
  }

  const meta = parseMeta(html);

  const urlMatch = cleanUrl.match(/status\/(\d+)/);
  const tweetId = urlMatch?.[1];
  const tweetRelayId = tweetId ? getTweetRelayId(tweetId) : null;

  const author = parseAuthor(html);

  const viewsMatch = html.match(/"ViewCountInfo"[^}]*count:"(\d+)"/);
  const views = viewsMatch ? parseInt(viewsMatch[1]) : null;

  const tweetTextRe = html.match(/full_text:"((?:[^"\\]|\\.)*)"/g);
  let tweetText = meta['og:description'] || null;
  if (tweetTextRe) {
    const candidates = tweetTextRe
      .map(s => s.slice('full_text:"'.length, -1).replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\'))
      .filter(t => t.length > 0 && !t.includes('\\u'));
    if (candidates.length) tweetText = candidates[0];
  }

  const createdAt = meta['article:published_time'] || null;
  const createdAtMs = (() => {
    const m = html.match(/"VHdlZXQ6[^"]*":details[^}]*created_at_ms:(\d+)/);
    if (m) return parseInt(m[1]);
    return createdAt ? new Date(createdAt).getTime() : null;
  })();

  const media = parseMedia(html, meta, tweetRelayId);

  const mediaType = (() => {
    if (!media.length) return 'text';
    const types = [...new Set(media.map(m => m.type))];
    if (types.includes('video')) return 'video';
    if (types.includes('gif')) return 'gif';
    return 'photo';
  })();

  return {
    tweet: {
      tweet_id: tweetId,
      url: `https://x.com/${meta['twitter:creator']?.replace('@', '') || 'i'}/status/${tweetId}`,
      text: tweetText,
      created_at: createdAt,
      timestamp_ms: createdAtMs,
      views,
      media_type: mediaType,
      media
    },
    author
  };
}

module.exports = {
  name: "X (Twitter) Downloader",
  desc: "Mengunduh media (foto/video/gif), teks tweet, serta metadata penulis dari postingan Twitter / X",
  category: "Downloader",
  path: "/api/download/twitter",
  method: "GET",
  parameters: {
    apikey: { type: "string", required: true },
    url: { type: "string", required: true }
  },
  async run(req, res, next) {
    try {
      const apikey = req.apiKeyInput || req.query.apikey || req.body?.apikey;
      const targetUrl = req.query.url || req.body?.url;

      if (!global.apikey.includes(apikey)) {
        return res.status(403).json({ status: false, error: "Apikey invalid" });
      }

      if (!targetUrl) {
        return res.status(400).json({
          status: false,
          error: "Parameter 'url' wajib diisi!"
        });
      }

      const downloadResult = await xdl(targetUrl);

      return res.json({
        status: true,
        creator: "Melvin Rest Api",
        result: downloadResult
      });

    } catch (err) {
      next(err);
    }
  }
};
