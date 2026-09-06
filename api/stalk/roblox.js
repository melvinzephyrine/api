const axios = require('axios');

class RobloxAPI {
  constructor() {
    this.client = axios.create({
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
  }

  async request(url, method = "GET", data = null) {
    try {
      const config = { method, url };
      if (data) config.data = data;
      const response = await this.client(config);
      return response.data;
    } catch (error) {
      return null;
    }
  }

  async getUserIdFromUsername(username) {
    const data = await this.request("https://users.roblox.com/v1/usernames/users", "POST", {
      usernames: [username],
      excludeBannedUsers: false,
    });
    return data?.data?.[0]?.id || null;
  }

  async getUserInfo(userId) {
    return await this.request(`https://users.roblox.com/v1/users/${userId}`);
  }

  async getUserStatus(userId) {
    return await this.request(`https://users.roblox.com/v1/users/${userId}/status`);
  }

  async getUserPresence(userIds) {
    const ids = Array.isArray(userIds) ? userIds : [userIds];
    return await this.request("https://presence.roblox.com/v1/presence/users", "POST", { userIds: ids });
  }

  async getUserFriendsCount(userId) {
    return await this.request(`https://friends.roblox.com/v1/users/${userId}/friends/count`);
  }

  async getUserFollowersCount(userId) {
    return await this.request(`https://friends.roblox.com/v1/users/${userId}/followers/count`);
  }

  async getUserFollowingCount(userId) {
    return await this.request(`https://friends.roblox.com/v1/users/${userId}/followings/count`);
  }

  async getUserAvatarHeadshot(userIds, size = "420x420", format = "Png", circular = false) {
    const ids = Array.isArray(userIds) ? userIds.join(",") : userIds;
    return await this.request(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${ids}&size=${size}&format=${format}&isCircular=${circular}`);
  }

  async getUserAvatarFullBody(userIds, size = "720x720", format = "Png", circular = false) {
    const ids = Array.isArray(userIds) ? userIds.join(",") : userIds;
    return await this.request(`https://thumbnails.roblox.com/v1/users/avatar?userIds=${ids}&size=${size}&format=${format}&isCircular=${circular}`);
  }

  async getUserAvatarBust(userIds, size = "420x420", format = "Png", circular = false) {
    const ids = Array.isArray(userIds) ? userIds.join(",") : userIds;
    return await this.request(`https://thumbnails.roblox.com/v1/users/avatar-bust?userIds=${ids}&size=${size}&format=${format}&isCircular=${circular}`);
  }

  async getUserAvatar(userId) {
    return await this.request(`https://avatar.roblox.com/v1/users/${userId}/avatar`);
  }

  async getUserCurrentlyWearing(userId) {
    return await this.request(`https://avatar.roblox.com/v1/users/${userId}/currently-wearing`);
  }

  async getUserOutfits(userId, page = 1, itemsPerPage = 10) {
    return await this.request(`https://avatar.roblox.com/v1/users/${userId}/outfits?page=${page}&itemsPerPage=${itemsPerPage}`);
  }

  async getUserGroups(userId) {
    return await this.request(`https://groups.roblox.com/v1/users/${userId}/groups/roles`);
  }

  async getUserPrimaryGroup(userId) {
    return await this.request(`https://groups.roblox.com/v1/users/${userId}/groups/primary/role`);
  }

  async getUserFavoriteGames(userId, limit = 5) {
    return await this.request(`https://games.roblox.com/v2/users/${userId}/favorite/games?limit=${limit}`);
  }

  async getUserRecentGames(userId, limit = 5) {
    return await this.request(`https://games.roblox.com/v2/users/${userId}/games?limit=${limit}`);
  }

  async getUserBadges(userId, limit = 5) {
    return await this.request(`https://badges.roblox.com/v1/users/${userId}/badges?limit=${limit}`);
  }

  async getUserCollectibles(userId, assetType = "", limit = 5) {
    return await this.request(`https://inventory.roblox.com/v1/users/${userId}/assets/collectibles?assetType=${assetType}&limit=${limit}`);
  }

  async getUserRobloxBadges(userId) {
    return await this.request(`https://accountinformation.roblox.com/v1/users/${userId}/roblox-badges`);
  }

  async getUserBundles(userId, limit = 5) {
    return await this.request(`https://catalog.roblox.com/v1/users/${userId}/bundles?limit=${limit}`);
  }

  async getCompleteUserInfo(username) {
    const userId = await this.getUserIdFromUsername(username);
    if (!userId) return null;

    const [
      basic,
      status,
      presence,
      friends,
      followers,
      following,
      groups,
      primaryGroup,
      favoriteGames,
      recentGames,
      headshot,
      fullBody,
      bust,
      avatar,
      wearing,
      outfits,
      badges,
      collectibles,
      robloxBadges,
      bundles,
    ] = await Promise.all([
      this.getUserInfo(userId),
      this.getUserStatus(userId),
      this.getUserPresence([userId]),
      this.getUserFriendsCount(userId),
      this.getUserFollowersCount(userId),
      this.getUserFollowingCount(userId),
      this.getUserGroups(userId),
      this.getUserPrimaryGroup(userId),
      this.getUserFavoriteGames(userId, 5),
      this.getUserRecentGames(userId, 5),
      this.getUserAvatarHeadshot(userId),
      this.getUserAvatarFullBody(userId),
      this.getUserAvatarBust(userId),
      this.getUserAvatar(userId),
      this.getUserCurrentlyWearing(userId),
      this.getUserOutfits(userId, 1, 10),
      this.getUserBadges(userId, 5),
      this.getUserCollectibles(userId, "", 5),
      this.getUserRobloxBadges(userId),
      this.getUserBundles(userId, 5),
    ]);

    return {
      userId,
      basic,
      status,
      presence,
      social: { friends, followers, following },
      groups: { list: groups, primary: primaryGroup },
      games: { favorites: favoriteGames, recent: recentGames },
      avatar: { headshot, fullBody, bust, details: avatar, wearing, outfits },
      achievements: { badges, collectibles, robloxBadges },
      catalog: { bundles },
    };
  }
}

const roblox = new RobloxAPI();

module.exports = {
  name: "Roblox Stalker",
  desc: "Mendapatkan data profil, avatar, grup, dan aktivitas pengguna Roblox",
  category: "Stalker",
  path: "/api/stalk/roblox",
  method: "GET",
  parameters: {
    apikey: { type: "string", required: true },
    user: { type: "string", required: true }
  },
  async run(req, res, next) {
    try {
      const apikey = req.apiKeyInput || req.query.apikey || req.body?.apikey;
      const user = req.query.user || req.body?.user;

      if (!global.apikey || !global.apikey.includes(apikey)) {
        return res.status(403).json({ status: false, error: "Apikey invalid" });
      }

      if (!user || typeof user !== 'string' || user.trim().length === 0) {
        return res.status(400).json({ status: false, error: "Parameter 'user' wajib diisi!" });
      }

      const result = await roblox.getCompleteUserInfo(user.trim());

      if (!result) {
        return res.status(404).json({
          status: false,
          error: `User Roblox '${user}' tidak ditemukan`
        });
      }

      return res.json({
        status: true,
        result: result
      });
    } catch (err) {
      return res.status(500).json({
        status: false,
        error: err.message || "Terjadi kesalahan saat mengambil data Roblox"
      });
    }
  }
};
