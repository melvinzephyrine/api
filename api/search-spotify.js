const crypto = require('crypto');
const axios = require('axios');

const BASE = 'https://spotubedl.com';
const UA = 'Mozilla/5.0 (Linux; Android 14; SM-S911B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Mobile Safari/537.36';

const te = new TextEncoder();
const rand = (n) => crypto.randomBytes(n);
const b64 = (b) => Buffer.from(b).toString('base64');
const unb64 = (s) => Buffer.from(String(s).trim(), 'base64');
const hex = (b) => Buffer.from(b).toString('hex');
const cat = (...a) => Buffer.concat(a.map((x) => (Buffer.isBuffer(x) ? x : Buffer.from(x))));
const u32 = (n) => { const b = Buffer.alloc(4); b.writeUInt32BE(n >>> 0); return b; };
const rpath = () => `/${hex(rand(6))}/${hex(rand(8))}/${hex(rand(6))}`;
const rhdr = () => 'x-' + hex(rand(8));

function info(kind, path, rid, ver, exp) {
  const p = { env: 'spdl-env:1:', req: 'spdl-req:1:', aad: 'spdl-aad:', raqd: 'spdl-req-aad:' }[kind];
  if (kind === 'env' || kind === 'req') return cat(te.encode(p), te.encode(path), Buffer.from([0]), rid);
  return cat(te.encode(p), Buffer.from([ver, 0, 0, 0, 0]), u32(exp), te.encode(path), Buffer.from([0]), rid);
}

function keyPair() { return crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' }); }

function exportPub(pub) {
  const j = pub.export({ format: 'jwk' });
  return cat(Buffer.from([4]), Buffer.from(j.x, 'base64url'), Buffer.from(j.y, 'base64url'));
}

function importPub(raw) {
  if (raw.length !== 65 || raw[0] !== 4) throw new Error('bad pubkey');
  return crypto.createPublicKey({
    key: { kty: 'EC', crv: 'P-256', x: raw.subarray(1, 33).toString('base64url'), y: raw.subarray(33).toString('base64url') },
    format: 'jwk',
  });
}

function shared(priv, peer) { return crypto.diffieHellman({ privateKey: priv, publicKey: importPub(peer) }); }
function hkdf(sec, salt, i) { return crypto.hkdfSync('sha256', sec, salt, i, 32); }

function gcmEnc(key, iv, pt, aad) {
  const c = crypto.createCipheriv('aes-256-gcm', key, iv); c.setAAD(aad);
  return cat(c.update(pt), c.final(), c.getAuthTag());
}

function gcmDec(key, iv, ct, aad) {
  const d = crypto.createDecipheriv('aes-256-gcm', key, iv);
  d.setAAD(aad); d.setAuthTag(ct.subarray(-16));
  return cat(d.update(ct.subarray(0, -16)), d.final());
}

function pack(e) {
  return cat(Buffer.from([e.v, e.f]), u32(e.exp), e.rid, e.salt, e.pub, e.iv, u32(e.ct.length), e.ct);
}

function unpack(buf) {
  if (buf.length < 119) throw new Error('envelope short');
  let o = 0;
  const v = buf[o++], f = buf[o++], exp = buf.readUInt32BE(o); o += 4;
  const rid = buf.subarray(o, (o += 16));
  const salt = buf.subarray(o, (o += 16));
  const pub = buf.subarray(o, (o += 65));
  const iv = buf.subarray(o, (o += 12));
  const len = buf.readUInt32BE(o); o += 4;
  const ct = buf.subarray(o);
  if (ct.length !== len) throw new Error('ct mismatch');
  return { v, f, exp, rid, salt, pub, iv, ct };
}

class SpotubeDL {
  constructor(base = BASE) {
    this.base = base.replace(/\/$/, '');
    this.serverKey = null;
    this.hdrs = {
      'User-Agent': UA,
      Origin: this.base,
      Referer: this.base + '/',
    };
  }

  async serverPub() {
    if (this.serverKey) return this.serverKey;
    const res = await axios.get(this.base + rpath(), {
      headers: { ...this.hdrs, Accept: 'text/plain', 'Cache-Control': 'no-store' },
      responseType: 'text'
    });
    const k = unb64(res.data);
    if (k.length !== 65) throw new Error('bad key');
    return (this.serverKey = k);
  }

  async securePost(apiPath, body = null) {
    const postPath = rpath(), postUrl = this.base + postPath;
    const payload = JSON.stringify({
      path: apiPath.startsWith('/') ? apiPath : '/' + apiPath,
      method: 'POST',
      body,
    });
    const serverPub = await this.serverPub();
    const { privateKey, publicKey } = keyPair();
    const clientPub = exportPub(publicKey);
    const sh = shared(privateKey, serverPub);
    const rid = rand(16), salt = rand(16), iv = rand(12);
    const exp = Math.floor(Date.now() / 1000) + 60;
    const key = hkdf(sh, salt, info('req', postPath, rid));
    const aad = info('raqd', postPath, rid, 1, exp);
    const ct = gcmEnc(key, iv, Buffer.from(payload), aad);
    const envelope = pack({ v: 1, f: 2, exp, rid, salt, pub: clientPub, iv, ct });

    const res = await axios.post(postUrl, envelope, {
      headers: {
        ...this.hdrs,
        [rhdr()]: b64(clientPub),
        'Content-Type': 'application/octet-stream',
        Accept: 'application/octet-stream, application/json',
      },
      responseType: 'arraybuffer'
    });

    const enc = Buffer.from(res.data);
    const env = unpack(enc);
    if (env.v !== 1) throw new Error('bad env');
    const key2 = hkdf(shared(privateKey, env.pub), env.salt, info('env', postPath, env.rid));
    const plain = gcmDec(key2, env.iv, env.ct, info('aad', postPath, env.rid, env.v, env.exp));
    return { ok: true, data: JSON.parse(plain.toString('utf-8')) };
  }

  search(q) { return this.securePost('/api/info/search', { query: q }); }
}

async function searchSpotify(query, type = 'track') {
  const client = new SpotubeDL();
  const r = await client.search(query);
  if (!r.ok) throw new Error('Gagal melakukan pencarian Spotify');
  
  const d = r.data || {};
  const key = type === 'track' ? 'tracks' : type + 's';
  let list = d[key] || (type === 'track' ? d.results : null) || [];
  if (!Array.isArray(list)) list = [];
  return list;
}

module.exports = {
  name: "Spotify Search",
  desc: "Cari lagu, album, playlist, atau artis di Spotify",
  category: "Search",
  path: "/api/search/spotify",
  method: "GET",
  parameters: {
    apikey: { type: "string", required: true },
    query: { type: "string", required: true },
    type: {
      type: "select",
      required: false,
      selection: ["track", "album", "playlist", "artist"],
      value: "track"
    }
  },
  async run(req, res, next) {
    try {
      const apikey = req.apiKeyInput || req.query.apikey || req.body?.apikey;
      const query = req.query.query || req.body?.query;
      const type = (req.query.type || req.body?.type || 'track').toLowerCase();

      if (!global.apikey || !global.apikey.includes(apikey)) {
        return res.status(403).json({ status: false, error: "Apikey invalid" });
      }

      if (!query) {
        return res.status(400).json({ status: false, error: "Parameter 'query' wajib diisi!" });
      }

      const results = await searchSpotify(query, type);

      return res.json({
        status: true,
        result: {
          query: query,
          type: type,
          total: results.length,
          data: results
        }
      });
    } catch (err) {
      const errorMsg = err.response?.data?.error?.message || err.message || "Terjadi kesalahan saat mencari lagu";
      return res.status(500).json({
        status: false,
        error: errorMsg
      });
    }
  }
};