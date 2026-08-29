const axios = require('axios');

async function analyzePinterestProfile(username) {
    const cleanUsername = username.replace('@', '').trim();
    const targetUrl = `https://pinout.in/api/profile-analyze?username=${encodeURIComponent(cleanUsername)}`;

    const headers = {
        'accept': '*/*',
        'accept-language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
        'cache-control': 'no-cache',
        'pragma': 'no-cache',
        'referer': `https://pinout.in/pinterest-profile-analyzer/${cleanUsername}`,
        'sec-ch-ua': '"Chromium";v="139", "Not;A=Brand";v="99"',
        'sec-ch-ua-mobile': '?1',
        'sec-ch-ua-platform': '"Android"',
        'sec-fetch-dest': 'empty',
        'sec-fetch-mode': 'cors',
        'sec-fetch-site': 'same-origin',
        'user-agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Mobile Safari/537.36'
    };

    try {
        const response = await axios.get(targetUrl, { headers });
        return response.data;
    } catch (error) {
        if (error.response) {
            return error.response.data;
        }
        throw new Error(`Gagal mengambil data: ${error.message}`);
    }
}

module.exports = {
    name: "Pinterest Stalker",
    desc: "Dapatkan analisis lengkap informasi profil pengguna Pinterest",
    category: "Stalker",
    path: "/api/stalk/pinterest",
    method: "GET",
    parameters: {
        apikey: { type: "string", required: true },
        username: { type: "string", required: true }
    },
    run: async (req, res) => {
        const { username } = req.query;

        if (!username) {
            return res.status(400).json({
                status: false,
                error: "Parameter 'username' wajib diisi!"
            });
        }

        try {
            const resultData = await analyzePinterestProfile(username);

            return res.json({
                status: 200,
                creator: "Melvin Rest Api",
                result: resultData
            });
        } catch (err) {
            return res.status(500).json({
                status: false,
                error: err.message || "Terjadi kesalahan pada server"
            });
        }
    }
};
