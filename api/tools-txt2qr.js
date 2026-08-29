const QRCode = require('qrcode');

async function generateQrBuffer(text) {
    return await QRCode.toBuffer(text, {
        type: 'png',
        errorCorrectionLevel: 'H',
        margin: 4,
        width: 1024,
        color: {
            dark: '#000000',
            light: '#FFFFFF'
        }
    });
}

module.exports = {
    name: "Text To QR Code",
    desc: "Ubah teks atau URL menjadi gambar QR Code",
    category: "Tools",
    path: "/api/tools/txt2qr",
    method: "GET",
    parameters: {
        apikey: { type: "string", required: true },
        text: { type: "string", required: true }
    },
    run: async (req, res) => {
        const { text } = req.query;

        if (!text) {
            return res.status(400).json({
                status: false,
                error: "Parameter 'text' wajib diisi!"
            });
        }

        try {
            const qrBuffer = await generateQrBuffer(text);

            res.setHeader("Content-Type", "image/png");
            return res.send(qrBuffer);

        } catch (err) {
            return res.status(500).json({
                status: false,
                error: err.message || "Gagal membuat QR Code dari teks"
            });
        }
    }
};
