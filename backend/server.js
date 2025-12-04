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
// PASTIKAN .env file Anda memiliki OJS_API_KEY yang valid
const OJS_API_KEY = process.env.OJS_API_KEY || "ISI_API_KEY_DISINI"; 
const OJS_BASE = "https://jmg.bmkg.go.id/jmg/index.php/jmg/api/v1";

const OJS_HEADERS = {
    Authorization: `Bearer ${OJS_API_KEY}`,
    Accept: "application/json",
};

const HTTPS_AGENT = new (require("https").Agent)({
    rejectUnauthorized: false,
});

// Peran yang akan diberikan jika verifikasi berhasil
const CONTRIBUTOR_ROLE = "Reviewer"; 
const COMPLETED_STATUS_ID = 9;


// --- FUNGSI PEMBANTU API CALLS ---

/**
 * Langkah 1: Mencari User ID dan Nama Lengkap berdasarkan Username.
 * Menggunakan endpoint /users/reviewers sesuai permintaan, dengan filter manual.
 */
async function getUserIdAndFullName(username) {
    try {
        const params = {
            searchPhrase: username,
        };
        
        // API Call: /users/reviewers
        const response = await axios.get(
            `${OJS_BASE}/users/reviewers`,
            { 
                headers: OJS_HEADERS, 
                httpsAgent: HTTPS_AGENT,
                params: params // Menggunakan params untuk query string
            }
        );
        
        // Manual filtering untuk memastikan kecocokan username
        const user = response.data.items.find(u => 
            u.userName.toLowerCase() === username.toLowerCase()
        );
        
        if (user) {
            return { id: user.id, fullName: user.fullName }; 
        }
        return null;
    } catch (error) {
        throw new Error("Gagal mengambil data reviewer dari OJS (API Call: /users/reviewers). Cek koneksi & izin API Key.");
    }
}

/**
 * Langkah 2: Mengambil detail Submission utama, termasuk Assignment List.
 */
async function getSubmissionDetail(submissionId) {
    try {
        // API Call: /submissions/{submissionId}
        const articleResponse = await axios.get(
            `${OJS_BASE}/submissions/${submissionId}`,
            { headers: OJS_HEADERS, httpsAgent: HTTPS_AGENT }
        );
        const submissionData = articleResponse.data;

        // Ambil Judul, Tanggal Kontribusi, dan URL Publikasi
        const articleDetail = {
            title: submissionData?.publications?.[0]?.title?.en_US ?? "Judul tidak ditemukan",
            reviewDate: submissionData?.lastModified?.split(" ")[0] ?? "", 
            urlPublished: submissionData?.publications?.[0]?.urlPublished || ""
        };
        
        const reviewAssignments = submissionData?.reviewAssignments || [];

        // Mengembalikan detail artikel dan daftar penugasan review
        return { articleDetail, reviewAssignments }; 
    } catch (error) {
        if (error.response && error.response.status === 404) {
             throw new Error(`Submission ID ${submissionId} tidak ditemukan di OJS.`);
        }
        throw new Error("Gagal mengambil detail submission (API Call: /submissions/{id}).");
    }
}


// =================================================================
// 2. ENDPOINT: VERIFIKASI UTAMA (/api/verify/submission)
// =================================================================
app.post("/api/verify/submission", async (req, res) => {
    const { submissionId, username } = req.body; 

    if (!submissionId || !username) {
        return res.status(400).json({ error: "Username dan Submission ID wajib diisi." }); 
    }

    try {
        // A. Panggil API 1: Dapatkan Nama Global (Verifikasi user ada)
        const userGlobalData = await getUserIdAndFullName(username);
        if (!userGlobalData) {
            return res.status(403).json({ error: `Username '${username}' tidak ditemukan dalam daftar Reviewer OJS.` });
        }
        
        let contributorName = userGlobalData.fullName;
        let contributorRole = null;
        
        // B. Panggil API 2: Ambil Detail Artikel dan Assignment List
        const { articleDetail, reviewAssignments } = await getSubmissionDetail(submissionId);
        
        // C. LOGIKA BERSYARAT: Verifikasi peran Reviewer berdasarkan eksistensi penugasan
        
        if (!reviewAssignments || reviewAssignments.length === 0) {
             return res.status(403).json({ 
                error: `Submission ID ${submissionId} tidak memiliki Review Assignment. Verifikasi peran ${CONTRIBUTOR_ROLE} gagal.` 
            });
        }

        // Cek apakah ada penugasan yang sudah Selesai (statusId: 9)
        const hasCompletedReview = reviewAssignments.some(assignment => assignment.statusId === COMPLETED_STATUS_ID);

        if (hasCompletedReview) {
            contributorRole = `${CONTRIBUTOR_ROLE} (Selesai)`;
        } else {
            // Jika ada penugasan tapi belum ada yang selesai
            contributorRole = `${CONTRIBUTOR_ROLE} (Berjalan)`;
        }


        // --- Verifikasi Berhasil (Berdasarkan Asumsi Kontribusi) ---
        res.json({ 
            message: "Verifikasi berhasil.",
            contributorName: contributorName, 
            contributorRole: contributorRole, 
            articleDetail: articleDetail 
        });

    } catch (err) {
        console.error("ERROR VERIFICATION:", err.message);
        
        if (err.message.includes("Submission ID") || err.message.includes("API Call") || err.message.includes("Review Assignment")) {
            return res.status(500).json({ error: err.message });
        }
        
        res.status(500).json({ error: "Terjadi kesalahan sistem saat memproses data OJS." });
    }
});


// =================================================================
// 3. ENDPOINT: DOWNLOAD CERTIFICATE (/api/certificate)
// =================================================================
app.post("/api/certificate", async (req, res) => {
    const { reviewerName, contributorRole, submissionId, articleTitle, reviewDate } = req.body; 

    if (!reviewerName || !contributorRole || !submissionId || !articleTitle) {
        return res.status(400).json({ error: "Data tidak lengkap" });
    }

    try {
        const doc = new PDFDocument({ size: "A4", layout: "landscape" }); 

        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `attachment; filename=sertifikat_${submissionId}.pdf`);
        doc.pipe(res);

        // --- 3.1. APLIKASI TEMPLATE BACKGROUND ---
        const templatePath = path.join(__dirname, "template-sertifikat.png");

        if (fs.existsSync(templatePath)) {
            try {
                doc.image(templatePath, 0, 0, { 
                    width: doc.page.width,
                    height: doc.page.height,
                });
            } catch (err) {
                console.warn("Template image error:", err.message);
            }
        } else {
            doc.fillColor("red").text("ERROR: Template Sertifikat Tidak Ditemukan!", { align: "center" });
        }

        // --- 3.2. PENEMPATAN TEKS ---
        
        doc.font('Times-Roman').fillColor("#000"); 
        
        // Judul Utama (Sertifikat)
        doc.x = 0; 
        doc.y = 150; 
        doc
            .fontSize(36)
            .font('Times-Bold')
            .text("SERTIFIKAT PENGHARGAAN", { align: "center" });

        doc.moveDown(0.5); 

        // Teks Penghargaan
        doc.fontSize(16).font('Times-Roman');
        doc.text("Dengan hormat diberikan kepada:", { align: "center" });

        doc.moveDown(0.5); 

        // Nama Kontributor
        doc.y = 250; 
        doc
            .fontSize(30)
            .font('Times-BoldItalic') 
            .text(reviewerName.toUpperCase(), { align: "center" });
        
        doc.moveDown(1.5); 

        // Teks Peran Kontribusi
        doc.fontSize(16).font('Times-Roman');
        doc.text(`Atas kontribusi sebagai ${contributorRole} pada Submission ID ${submissionId} manuscript:`, { align: "center" });
        
        doc.moveDown(0.5); 

        // Judul Artikel
        const marginX = 100; 
        doc.x = 25; 
        
        doc
            .fontSize(20)
            .font('Times-Italic') 
            .text(`"${articleTitle}"`, {
                align: "center",
                width: doc.page.width - marginX 
            });

        // Informasi Tambahan (Tanggal Kontribusi)
        doc.moveDown(1.5);
        doc.x = 0;
        doc.fontSize(14).font('Times-Roman').text(`Tanggal Kontribusi: ${reviewDate}`, {  
            align: "center"  
        });

        // Informasi Penutup 
        doc.y = 500;
        doc
            .fontSize(12)
            .font('Times-Roman')
            .text("Sertifikat ini diberikan sebagai bentuk apresiasi atas dedikasi dalam menjaga kualitas publikasi ilmiah.", {
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
