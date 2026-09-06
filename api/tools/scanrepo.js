function normalizeUrl(input) {
  if (!input) return null;
  let u = String(input).trim();
  if (!/^https?:\/\//i.test(u)) u = "https://" + u.replace(/^\/+/, "");
  return u;
}

function repoSlug(meta, fallbackUrl) {
  if (meta && meta.owner && meta.repo) return `${meta.owner}/${meta.repo}`;
  try {
    const p = new URL(fallbackUrl).pathname.split("/").filter(Boolean);
    return p.slice(0, 2).join("/");
  } catch {
    return fallbackUrl;
  }
}

async function scanRepository(target) {
  const res = await fetch("https://www.scanrepo.dev/api/scan", {
    method: "POST",
    headers: { "content-type": "application/json", accept: "text/plain" },
    body: JSON.stringify({ url: target }),
    signal: AbortSignal.timeout(120000)
  });

  const status = res.status;
  const ct = res.headers.get("content-type") || "";

  if (!res.ok && ct.includes("application/json")) {
    let err = {};
    try { err = await res.json(); } catch {}
    throw new Error(err.error || "Gagal melakukan scan repositori");
  }

  const decoder = new TextDecoder();
  let buf = "", result = null, streamErr = null;

  try {
    for await (const chunk of res.body) {
      buf += decoder.decode(chunk, { stream: true });
      let nl;
      while ((nl = buf.indexOf("\n")) !== -1) {
        const line = buf.slice(0, nl).trim();
        buf = buf.slice(nl + 1);
        if (!line) continue;
        let o;
        try { o = JSON.parse(line); } catch { continue; }
        if (o.type === "result") {
          result = o.data;
        } else if (o.type === "error") {
          streamErr = o.error || o.message || "Terjadi kesalahan saat memindai";
        }
      }
    }
    const last = buf.trim();
    if (last) {
      try {
        const o = JSON.parse(last);
        if (o.type === "result") result = o.data;
        else if (o.type === "error") streamErr = o.error || o.message;
      } catch {}
    }
  } catch (e) {
    streamErr = "Gagal membaca stream: " + e.message;
  }

  if (!result) {
    throw new Error(streamErr || "Tidak ada hasil yang dikembalikan oleh server");
  }

  const m = result.meta || {};
  return {
    url: target,
    repo: repoSlug(m, target),
    provider: m.provider ?? null,
    language: m.language ?? null,
    stars: m.stars ?? null,
    forks: m.forks ?? null,
    riskScore: result.riskScore ?? null,
    riskLevel: result.riskLevel ?? null,
    cached: result.cached ?? null,
    filesScanned: result.filesScanned ?? null,
    totalRepoFiles: result.totalRepoFiles ?? null,
    coverage: result.coverage ?? null,
    commitSha: result.commitSha ?? null,
    scannedAt: result.scannedAt ?? null,
    scannerVersion: result.scannerVersion ?? null,
    badges: Array.isArray(result.badges) ? result.badges.map((b) => b.label).filter(Boolean) : [],
    categories: Array.isArray(result.categories)
      ? result.categories.map((c) => ({ id: c.id, name: c.name, score: c.score, findings: Array.isArray(c.findings) ? c.findings.length : 0 }))
      : [],
    findings: Array.isArray(result.findings)
      ? result.findings.map((f) => ({ title: f.title, ruleId: f.ruleId, points: f.points, file: f.file ?? f.path ?? null, line: f.line ?? null }))
      : [],
    resultPage: m.provider && m.owner && m.repo ? `https://www.scanrepo.dev/scan/${m.provider}/${m.owner}/${m.repo}` : null
  };
}

module.exports = {
  name: "GitHub Scan Repo",
  desc: "Pindai keandalan dan tingkat risiko keamanan pada repositori GitHub",
  category: "Tools",
  path: "/api/tools/scanrepo",
  method: "GET",
  parameters: {
    apikey: { type: "string", required: true },
    url: { type: "string", required: true, example: "https://github.com/user/repo" }
  },
  run: async (req, res) => {
    const { url } = req.query;

    if (!url) {
      return res.status(400).json({
        status: false,
        error: "Parameter 'url' wajib diisi!"
      });
    }

    const target = normalizeUrl(url);

    try {
      const scanData = await scanRepository(target);

      return res.json({
        status: 200,
        result: scanData
      });
    } catch (err) {
      return res.status(500).json({
        status: false,
        error: err.message || "Terjadi kesalahan saat memindai repositori"
      });
    }
  }
};
