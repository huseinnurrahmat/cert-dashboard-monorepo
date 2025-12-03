const express = require("express");
const axios = require("axios");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const PDFDocument = require("pdfkit");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;
const OJS_API_KEY = process.env.OJS_API_KEY || "ISI_API_KEY_DISINI";
const OJS_BASE = "https://jmg.bmkg.go.id/jmg/index.php/jmg/api/v1";

// Tambahkan logging ini di bagian atas server.js
const fullPath = path.join(__dirname, "logo-bmkg.png");
console.log(`Mencoba membaca logo dari: ${fullPath}`);
if (!fs.existsSync(fullPath)) {
    console.error("FATAL: Logo file TIDAK DITEMUKAN. Cek lokasi.");
}

// ------------------------
// GET ARTICLE DETAIL
// ------------------------
app.get("/api/ojs/article/:submissionId", async (req, res) => {
  const { submissionId } = req.params;

  try {
    const response = await axios.get(
      `${OJS_BASE}/submissions/${submissionId}`,
      {
        headers: {
          Authorization: `Bearer ${OJS_API_KEY}`,
          Accept: "application/json",
        },
        httpsAgent: new (require("https").Agent)({
          rejectUnauthorized: false,
        }),
      }
    );

    const data = response.data;
    const title = data?.publications?.[0]?.title?.en_US ?? "Judul tidak ditemukan";
    const date = data?.lastModified?.split(" ")[0] ?? "";

    res.json({ title, reviewDate: date, urlPublished: data?.publications?.[0]?.urlPublished || "" });
  } catch (err) {
    console.error("ERROR ARTICLE:", err.response?.data || err.message);
    res.status(500).json({ error: "Gagal mengambil data artikel OJS" });
  }
});

// ------------------------
// DOWNLOAD CERTIFICATE
// ------------------------
app.post("/api/certificate", async (req, res) => {
  const { reviewerName, submissionId, articleTitle, reviewDate } = req.body;

  if (!reviewerName || !submissionId || !articleTitle) {
    return res.status(400).json({ error: "Data tidak lengkap" });
  }

  try {
    const doc = new PDFDocument({ size: "A4", layout: "landscape" });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=sertifikat_${submissionId}.pdf`
    );

    doc.pipe(res);

    // Logo BMKG
    // GUNAKAN path.join(__dirname, 'nama_file') untuk path absolut
    const logoPath = path.join(__dirname, "logo-bmkg.png"); // <-- PERUBAHAN KRITIS DI SINI
    if (fs.existsSync(logoPath)) {
      try {
        doc.image(logoPath, 50, 30, { width: 120 });
      } catch (err) {
        console.warn("Logo BMKG error:", err.message);
      }
    } else {
	console.error(`Logo file not found at: ${logoPath}`);
    }

    // Title
    doc
      .fontSize(30)
      .fillColor("#000")
      .text("SERTIFIKAT REVIEWER", { align: "center", underline: true });

    doc.moveDown(2);

    // Reviewer name
    doc
      .fontSize(20)
      .text(`Diberikan kepada: ${reviewerName}`, { align: "center" });

    doc.moveDown(1);

    // Article title
    doc
      .fontSize(16)
      .text(`Untuk artikel: "${articleTitle}"`, {
        align: "center",
        italics: true,
      });

    // Review date
    doc.moveDown(1);
    doc.fontSize(14).text(`Tanggal review: ${reviewDate}`, { align: "center" });

    // Footer
    doc.moveDown(4);
    doc
      .fontSize(12)
      .text("BMKG - Badan Meteorologi, Klimatologi, dan Geofisika", {
        align: "center",
      });

    doc.end();
  } catch (err) {
    console.error("CERTIFICATE ERROR:", err.message);
    if (!res.headersSent) {
      res.status(500).json({ error: "Gagal membuat sertifikat" });
    }
  }
});

app.listen(PORT, () => {
  console.log(`Backend berjalan di port ${PORT}`);
});

