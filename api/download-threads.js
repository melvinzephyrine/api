const axios = require('axios');

const BASE_URL = 'https://www.threads.com/';
const UA = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';

const threads = {
  _fetch: async function (url, retries = 3) {
    let err;
    for (let i = 0; i < retries; i++) {
      try {
        const res = await axios({
          url,
          method: 'GET',
          headers: { 'User-Agent': UA },
          maxRedirects: 5,
          timeout: 25000,
          validateStatus: (s) => s < 400
        });
        return res.data;
      } catch (e) {
        err = e.response ? `HTTP ${e.response.status}` : e.message;
        if (i < retries - 1) await new Promise((x) => setTimeout(x, 1500));
      }
    }
    throw new Error(err);
  },

  _buildUrl: function (target) {
    const str = String(target || '').trim();
    if (str.startsWith('http')) return str;
    const shareMatch = str.match(/(?:threads\.(?:com|net)\/)?share\/([A-Za-z0-9_-]+)/);
    if (shareMatch) return `${BASE_URL}share/${shareMatch[1]}/`;
    const postMatch = str.match(/@([A-Za-z0-9_.]+)\/post\/([A-Za-z0-9_-]+)/);
    if (postMatch) return `${BASE_URL}@${postMatch[1]}/post/${postMatch[2]}/`;
    return `${BASE_URL}share/${str}/`;
  },

  _extractData: function (html) {
    const regex = /<script type="application\/json"[^>]*data-sjs>(.*?)<\/script>/gs;
    let match, bestBlock = null;
    while ((match = regex.exec(html))) {
      const block = match[1];
      if (block.includes('RelayPrefetchedStreamCache') && block.length > 1000 && (!bestBlock || block.length > bestBlock.length)) {
        bestBlock = block;
      }
    }
    if (!bestBlock) return null;
    const parsed = JSON.parse(bestBlock);
    return parsed.require?.[0]?.[3]?.[0]?.__bbox?.require?.[0]?.[3]?.[1]?.__bbox?.result?.data?.data || null;
  },

  _getCanonical: function (html) {
    const match = html.match(/<link rel="canonical" href="([^"]+)/) || html.match(/<meta property="og:url" content="([^"]+)/);
    return match ? match[1].replace(/&#064;/g, '@').replace(/&amp;/g, '&') : null;
  },

  _parsePost: function (post) {
    const user = post.user || {};
    const appInfo = post.text_post_app_info || {};
    const caption = post.caption || {};
    const fragments = appInfo.text_fragments?.fragments || [];
    const links = [];
    const mentions = [];

    for (const frag of fragments) {
      if (frag.link_fragment) links.push(frag.link_fragment.url);
      if (frag.mention_fragment) mentions.push(frag.mention_fragment.username);
    }

    const getBestMedia = (items) => (items || []).slice().sort((a, b) => (b.width * b.height) - (a.width * a.height))[0];
    const video = getBestMedia(post.video_versions);
    const image = getBestMedia(post.image_versions2?.candidates);
    const media = [];

    if (post.media_type === 8) {
      for (const item of post.carousel_media || []) {
        const itemVideo = getBestMedia(item.video_versions);
        const itemImage = getBestMedia(item.image_versions2?.candidates);
        const mainSource = itemImage || itemVideo;
        media.push({
          type: itemVideo ? 'video' : 'photo',
          url: itemImage?.url || itemVideo?.url,
          poster: itemImage?.url,
          width: mainSource?.width,
          height: mainSource?.height,
          video: itemVideo?.url
        });
      }
    } else if (video) {
      media.push({
        type: 'video',
        url: video.url,
        poster: image?.url,
        width: video.width,
        height: video.height
      });
    } else if (image) {
      media.push({
        type: 'photo',
        url: image.url,
        width: image.width,
        height: image.height
      });
    }

    return {
      id: post.pk,
      code: post.code,
      text: caption.text || '',
      created: post.taken_at ? new Date(post.taken_at * 1000).toISOString() : null,
      author: {
        name: user.full_name || null,
        handle: user.username || null,
        verified: user.is_verified ?? null,
        avatar: user.profile_pic_url || null
      },
      metrics: {
        likes: post.like_count ?? null,
        replies: appInfo.direct_reply_count ?? null,
        reposts: appInfo.repost_count ?? null,
        quotes: appInfo.quote_count ?? null,
        reshares: appInfo.reshare_count ?? null
      },
      media,
      links: links.length ? links : (String(caption.text || '').match(/https?:\/\/[^\s]+/g) || []),
      mentions
    };
  },

  _parseRelated: function (data) {
    const relatedList = [];
    for (const edge of data.edges.slice(1)) {
      for (const item of edge.node.thread_items) {
        const parsed = this._parsePost(item.post);
        if (parsed.id && parsed.text) relatedList.push(parsed);
      }
    }
    return relatedList;
  },

  get: async function (target, options = {}) {
    try {
      const url = this._buildUrl(target);
      const isLitePage = (html) => !html.includes('adp_BarcelonaPostPageDirectQueryRelayPreloader_');
      let html = await this._fetch(url);

      for (let i = 0; i < 2 && isLitePage(html); i++) {
        await new Promise((resolve) => setTimeout(resolve, 1500));
        html = await this._fetch(url);
      }

      if (isLitePage(html)) {
        return { success: false, result: 'Post Not Found' };
      }

      const data = this._extractData(html);
      if (!data) return { success: false, result: 'Failed extract data from page' };

      const thread = data.edges[0].node.thread_items.map((item) => this._parsePost(item.post));
      const result = {
        url: this._getCanonical(html),
        post: thread[0],
        thread,
        count: thread.length
      };

      if (options.related) {
        result.related = this._parseRelated(data);
      }

      return { success: true, result };
    } catch (e) {
      return { success: false, result: e.message };
    }
  }
};

module.exports = {
  name: "Threads Downloader",
  desc: "Mengunduh media (foto/video/foto slide), teks, dan metadata postingan dari Threads.net",
  category: "Downloader",
  path: "/api/download/threads",
  method: "GET",
  parameters: {
    apikey: { type: "string", required: true},
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

      const response = await threads.get(targetUrl);

      if (!response.success) {
        return res.status(400).json({
          status: false,
          error: response.result || "Gagal mengambil data dari Threads."
        });
      }

      return res.json({
        status: true,
        creator: "Melvin Rest Api",
        result: response.result
      });

    } catch (err) {
      next(err);
    }
  }
};
