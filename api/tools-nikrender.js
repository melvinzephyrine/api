const fs = require('fs');
const path = require('path');

let cachedRegions = null;

function getRegionsData() {
  if (cachedRegions) return cachedRegions;
  const dataPath = path.resolve('./nik_regions.json');
  if (fs.existsSync(dataPath)) {
    try {
      cachedRegions = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
      return cachedRegions;
    } catch (_) {}
  }
  return { provinsi: [], kabupaten: [], kecamatan: [] };
}

function readNIK(nikInput) {
  const nik = String(nikInput || '').trim();
  if (!nik || !/^\d{16}$/.test(nik)) {
    return {
      status: false,
      error: 'NIK harus terdiri dari 16 digit angka.'
    };
  }

  try {
    const regions = getRegionsData();
    const idProv = nik.substring(0, 2);
    const idKab = nik.substring(0, 4);
    const idKec = nik.substring(0, 6);

    let rawDay = parseInt(nik.substring(6, 8), 10);
    const month = parseInt(nik.substring(8, 10), 10);
    const rawYear = parseInt(nik.substring(10, 12), 10);
    const uniqueId = nik.substring(12, 16);

    let gender = 'LAKI-LAKI';
    if (rawDay > 40) {
      gender = 'PEREMPUAN';
      rawDay -= 40;
    }

    const currentYY = parseInt(String(new Date().getFullYear()).slice(-2), 10);
    const fullYear = rawYear > currentYY ? 1900 + rawYear : 2000 + rawYear;

    const pad = (n) => String(n).padStart(2, '0');
    const birthDate = `${pad(rawDay)}/${pad(month)}/${fullYear}`;

    const prov = regions.provinsi?.find((p) => p.idProv === idProv)?.name || 'Tidak ditemukan';
    const kab = regions.kabupaten?.find((k) => k.idKab === idKab)?.name || 'Tidak ditemukan';
    const kec = regions.kecamatan?.find((k) => k.idKec === idKec)?.name?.toUpperCase() || 'Tidak ditemukan';

    return {
      status: true,
      result: {
        nik,
        provinsi: prov,
        kabupaten: kab,
        kecamatan: kec,
        jenisKelamin: gender,
        tanggalLahir: birthDate,
        idUnik: uniqueId
      }
    };
  } catch (err) {
    return {
      status: false,
      error: err.message || 'Gagal membaca NIK.'
    };
  }
}

module.exports = {
  name: "NIK Render",
  desc: "Membaca dan mengurai informasi Nomor Induk Kependudukan (NIK) 16 digit",
  category: "Tools",
  path: "/api/tools/readnik",
  method: "GET",
  parameters: {
    apikey: { type: "string", required: true },
    nik: { type: "string", required: true }
  },
  async run(req, res, next) {
    try {
      const apikey = req.apiKeyInput || req.query.apikey || req.body?.apikey;
      const nik = req.query.nik || req.body?.nik;

      if (!global.apikey.includes(apikey)) {
        return res.status(403).json({ status: false, error: "Apikey invalid" });
      }

      if (!nik) {
        return res.status(400).json({
          status: false,
          error: "Parameter 'nik' wajib diisi!"
        });
      }

      const parsedResult = readNIK(nik);

      if (!parsedResult.status) {
        return res.status(400).json({
          status: false,
          error: parsedResult.error
        });
      }

      return res.json({
        status: true,
        result: parsedResult.result
      });

    } catch (err) {
      next(err);
    }
  }
};
