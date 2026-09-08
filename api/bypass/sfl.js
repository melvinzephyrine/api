const crypto = require('crypto');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const FP_RAW = "webgl:ANGLE (Intel, Intel(R) UHD Graphics Direct3D11 vs_5_0 ps_5_0, D3D11)||audio:12.345678901234||canvas:abcdef123||fonts:20/25||system:8CPU,8GB,Win32,0,1,0||env:Asia/Jakarta,1920,1080,24,en-US||network:4g,10,50";

const sleep = ms => new Promise(r => setTimeout(r, ms));

class CookieJar {
  constructor() { this.jar = new Map(); }
  ingest(headers) {
    const cookies = typeof headers.getSetCookie === 'function' ? headers.getSetCookie() : [headers.get('set-cookie')].filter(Boolean);
    for (const s of cookies) {
      const [pair] = s.split(';');
      const i = pair.indexOf('=');
      if (i > 0) this.jar.set(pair.slice(0, i).trim(), pair.slice(i + 1).trim());
    }
  }
  header() { return [...this.jar.entries()].map(([k, v]) => `${k}=${v}`).join('; '); }
  get(k) { return this.jar.get(k); }
}

async function go(url, opts = {}, jar) {
  let cur = url, method = opts.method || 'GET', body = opts.body;
  const headers = { 'User-Agent': UA, 'Accept': 'text/html,application/xhtml+xml,*/*;q=0.8', 'Accept-Language': 'en-US,en;q=0.9', ...opts.headers };

  for (let i = 0; i < 10; i++) {
    if (jar) { const c = jar.header(); if (c) headers['Cookie'] = c; }
    const res = await fetch(cur, { method, headers, body, redirect: 'manual', signal: AbortSignal.timeout(15000) });
    if (jar) jar.ingest(res.headers);
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get('location');
      if (!loc) return res;
      cur = new URL(loc, cur).href;
      method = 'GET'; body = undefined;
      delete headers['Content-Type']; delete headers['Content-Length'];
      headers['Referer'] = cur;
      continue;
    }
    Object.defineProperty(res, 'url', { value: cur });
    return res;
  }
}

function makeToken(xsrf) {
  const fp = crypto.createHash('sha256').update(FP_RAW).digest('hex');
  const suffix = '#' + Buffer.from(fp).toString('base64');
  return decodeURIComponent(xsrf).slice(0, 128 - suffix.length) + suffix;
}

async function bypassSfl(url, html, jar) {
  const form = html.match(/<form[^>]+action=["']([^"']+)["']/i)?.[1];
  const rayId = html.match(/name=["']ray_id["']\s+value=["']([^"']+)["']/i)?.[1];
  const alias = html.match(/name=["']alias["']\s+value=["']([^"']+)["']/i)?.[1];
  if (!form || !rayId || !alias) return null;

  const origin = new URL(form, url).origin;
  const redirectUrl = `${origin}/redirect.php?ray_id=${encodeURIComponent(rayId)}&alias=${encodeURIComponent(alias)}`;

  const r2 = await go(redirectUrl, { headers: { Referer: url } }, jar);
  const pageUrl = r2.url;

  const xsrf1 = jar.get('XSRF-TOKEN');
  if (!xsrf1) throw new Error('Missing XSRF-TOKEN');

  const apiHeaders = {
    'Origin': origin, 'Referer': pageUrl,
    'Content-Type': 'application/json',
    'Accept': 'application/json, */*',
    'X-Requested-With': 'XMLHttpRequest'
  };

  const s1 = await (await go(`${origin}/api/session`, { method: 'POST', headers: apiHeaders, body: JSON.stringify({ _token: makeToken(xsrf1) }) }, jar)).json().catch(() => ({}));
  let ref = pageUrl;

  if ((s1.step || 1) === 1) {
    await sleep(300);
    const vd = await (await go(`${origin}/api/verify`, { method: 'POST', headers: apiHeaders, body: JSON.stringify({ _a: 0, captcha: null, passcode: null }) }, jar)).json().catch(() => ({}));
    let target = vd.target || '/redirect.php';
    if (target.startsWith('/')) target = origin + target;
    const r3 = await go(target, { headers: { Referer: pageUrl } }, jar);
    ref = r3.url;
    apiHeaders['Referer'] = ref;
    await go(`${origin}/api/session`, { method: 'POST', headers: apiHeaders, body: JSON.stringify({ _token: makeToken(jar.get('XSRF-TOKEN') || xsrf1) }) }, jar);
  }

  await sleep(500);
  const key = 500;
  apiHeaders['Referer'] = ref;
  const gd = await (await go(`${origin}/api/go`, { method: 'POST', headers: apiHeaders, body: JSON.stringify({ key, size: `${(1920+key)*2}.${(1080+key)*2}` }) }, jar)).json();

  let readyUrl = gd.url;
  if (!readyUrl) throw new Error('No URL from /api/go');
  if (!/^https?:\/\//i.test(readyUrl)) readyUrl = new URL(readyUrl, origin).href;

  const rh = await (await go(readyUrl, { headers: { Referer: ref } }, jar)).text();
  const dest = rh.match(/window\.location\.href\s*=\s*["']([^"']+)["']/i)?.[1];
  return dest ? dest.replace(/\\\//g, '/').replace(/\\u0026/g, '&') : readyUrl;
}

async function resolveUrl(rawUrl) {
  let cur = /^https?:\/\//i.test(rawUrl) ? rawUrl : 'https://' + rawUrl;
  const visited = new Set();
  const hops = [];

  for (let i = 0; i < 15; i++) {
    if (visited.has(cur)) break;
    visited.add(cur);
    hops.push(cur);

    const jar = new CookieJar();
    let res;
    try {
      res = await go(cur, { redirect: 'manual' }, jar);
    } catch (e) {
      throw new Error(e.message);
    }

    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get('location');
      if (loc) {
        cur = new URL(loc, cur).href;
        continue;
      }
    }

    const html = await res.text();

    if (html.includes('name="ray_id"') || html.includes("name='ray_id'") || html.includes('redirect.php')) {
      try {
        const dest = await bypassSfl(cur, html, jar);
        if (dest && dest !== cur) {
          cur = dest;
          continue;
        }
      } catch {}
    }

    const meta = html.match(/<meta[^>]+http-equiv=["']refresh["'][^>]+content=["'][^"']*url=([^"']+)["']/i);
    if (meta) {
      cur = new URL(meta[1].trim(), cur).href;
      continue;
    }

    break;
  }

  return { destination: cur, hops };
}

module.exports = [
  {
    name: "Sfl Bypass",
    desc: "Bypass shortlink and safelink redirects to extract destination URLs automatically.",
    category: "Bypass",
    path: "/api/bypass/sfl",
    method: "GET",
    parameters: {
      apikey: { type: "string", required: true },
      url: { type: "string", required: true }
    },
    async run(req, res) {
      const apikey = req.apiKeyInput || req.query?.apikey || req.body?.apikey || req.headers['x-apikey'];
      const targetUrl = req.query?.url || req.body?.url;

      if (!global.apikey || !global.apikey.includes(apikey)) {
        return res.status(403).json({ status: false, error: "Apikey invalid" });
      }

      if (!targetUrl || typeof targetUrl !== 'string' || !targetUrl.trim()) {
        return res.status(400).json({ status: false, error: "Parameter 'url' wajib diisi!" });
      }

      try {
        const data = await resolveUrl(targetUrl.trim());

        return res.json({
          status: true,
          result: {
            destination: data.destination,
            hops: data.hops
          }
        });
      } catch (err) {
        return res.status(500).json({
          status: false,
          error: err.message || "Gagal memproses bypass URL"
        });
      }
    }
  }
];
