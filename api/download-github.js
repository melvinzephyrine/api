const axios = require('axios');

class GitHubUrlParser {
  constructor(options = {}) {
    this.headers = {
      "User-Agent": options.userAgent || "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      ...(options.token && { Authorization: `token ${options.token}` }),
    };
  }

  parseUrl(url) {
    const patterns = {
      repo: /https?:\/\/github\.com\/([^/]+)\/([^/]+)(?:\/)?$/,
      file: /https?:\/\/github\.com\/([^/]+)\/([^/]+)\/blob\/([^/]+)\/(.+)/,
      raw: /https?:\/\/raw\.githubusercontent\.com\/([^/]+)\/([^/]+)\/([^/]+)\/(.+)/,
      gist: /https?:\/\/gist\.github\.com\/([^/]+)\/([a-f0-9]+)/,
    };

    for (const [type, regex] of Object.entries(patterns)) {
      const match = url.match(regex);
      if (match) {
        return { type, match };
      }
    }

    throw new Error(
      "URL tidak valid. Format yang didukung: repo, file, raw, atau gist URL GitHub"
    );
  }

  async getRepoData(user, repo) {
    const apiUrl = `https://api.github.com/repos/${user}/${repo}`;
    const response = await axios.get(apiUrl, {
      headers: this.headers,
      timeout: 30000,
    });

    const {
      default_branch,
      description,
      stargazers_count,
      forks_count,
      topics,
    } = response.data;

    return {
      type: "repository",
      owner: user,
      repo: repo,
      description,
      default_branch,
      stars: stargazers_count,
      forks: forks_count,
      topics,
      download_url: `https://github.com/${user}/${repo}/archive/refs/heads/${default_branch}.zip`,
      clone_url: `https://github.com/${user}/${repo}.git`,
      api_url: apiUrl,
    };
  }

  async getFileData(user, repo, branch, path) {
    const apiUrl = `https://api.github.com/repos/${user}/${repo}/contents/${path}?ref=${branch}`;
    const response = await axios.get(apiUrl, {
      headers: this.headers,
      timeout: 30000,
    });

    return {
      type: "file",
      owner: user,
      repo: repo,
      branch,
      path,
      name: response.data.name,
      size: response.data.size,
      raw_url: response.data.download_url,
      content: Buffer.from(response.data.content, "base64").toString("utf-8"),
      sha: response.data.sha,
      api_url: apiUrl,
    };
  }

  async getGistData(user, gistId) {
    const apiUrl = `https://api.github.com/gists/${gistId}`;
    const response = await axios.get(apiUrl, {
      headers: this.headers,
      timeout: 30000,
    });

    const files = Object.entries(response.data.files).map(
      ([filename, file]) => ({
        name: filename,
        language: file.language,
        raw_url: file.raw_url,
        size: file.size,
        content: file.content,
      })
    );

    return {
      type: "gist",
      owner: user,
      gist_id: gistId,
      description: response.data.description,
      files,
      created_at: response.data.created_at,
      updated_at: response.data.updated_at,
      comments: response.data.comments,
      api_url: apiUrl,
    };
  }

  async getData(url) {
    const { type, match } = this.parseUrl(url);

    switch (type) {
      case "repo":
        return await this.getRepoData(match[1], match[2]);
      case "file":
      case "raw":
        return await this.getFileData(match[1], match[2], match[3], match[4]);
      case "gist":
        return await this.getGistData(match[1], match[2]);
      default:
        throw new Error("Format URL tidak didukung");
    }
  }
}

const github = new GitHubUrlParser();

module.exports = {
  name: "GitHub Downloader",
  desc: "Fetch and download repository information, raw/source file contents, and Gist snippets directly by providing a GitHub URL.",
  category: "Downloader",
  path: "/api/d/github",
  method: "GET",
  parameters: {
    apikey: { type: "string", required: true },
    url: { type: "string", required: true" }
  },
  async run(req, res, next) {
    try {
      const apikey = req.apiKeyInput || req.query.apikey || req.body?.apikey;
      const url = req.query.url || req.body?.url;

      if (!global.apikey || !global.apikey.includes(apikey)) {
        return res.status(403).json({ status: false, error: "Apikey invalid" });
      }

      if (!url || typeof url !== "string" || url.trim().length === 0) {
        return res.status(400).json({ status: false, error: "Parameter 'url' wajib diisi!" });
      }

      const result = await github.getData(url.trim());

      return res.json({
        status: true,
        result: result
      });
    } catch (err) {
      const errorMsg = err.response?.data?.message || err.message || "Gagal mengambil data dari GitHub";
      const statusCode = (err.response && err.response.status === 404) || errorMsg.includes("not found") ? 404 : 500;

      return res.status(statusCode).json({
        status: false,
        error: errorMsg
      });
    }
  }
};
