import React, { useState } from "react";
import axios from "axios";

// Styling minimal menggunakan JSX Style
const styles = {
    container: { maxWidth: 600, margin: "50px auto", fontFamily: "Inter, Arial, sans-serif", padding: '20px', border: '1px solid #ddd', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' },
    input: { width: "100%", padding: "10px", marginBottom: "15px", border: "1px solid #ccc", borderRadius: "4px" },
    buttonPrimary: { padding: "10px 20px", marginRight: "10px", backgroundColor: '#2563eb', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', transition: 'background-color 0.3s' },
    buttonDisabled: { padding: "10px 20px", backgroundColor: '#9ca3af', color: 'white', border: 'none', borderRadius: '4px', cursor: 'not-allowed' },
    successBox: { marginTop: "20px", border: "2px solid #10b981", padding: "15px", borderRadius: '6px', backgroundColor: '#ecfdf5' },
    errorText: { color: "#dc2626", fontWeight: 'bold' }
};

export default function App() {
  const [username, setUsername] = useState(""); 
  const [submissionId, setSubmissionId] = useState("");
  const [article, setArticle] = useState(null);
  const [contributorName, setContributorName] = useState(""); 
  const [contributorRole, setContributorRole] = useState(""); 
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const verifyReviewer = async () => {
    if (!submissionId || !username) {
        setError("Harap isi Username dan Submission ID.");
        return;
    }
    setLoading(true);
    setError("");
    setArticle(null);
    setContributorName(""); 
    setContributorRole(""); 

    try {
      // PERHATIAN: GANTI URL INI SAAT DEPLOY KE APACHE!
      const res = await axios.post(
        `http://localhost:3000/api/verify/submission`, 
        {
          submissionId,
          username, 
        }
      );
      
      setArticle(res.data.articleDetail);
      setContributorName(res.data.contributorName);
      setContributorRole(res.data.contributorRole);
      setError(""); 

    } catch (err) {
      console.error(err);
      const message = err.response?.data?.error || "Verifikasi gagal. Cek kembali data atau status API Key OJS.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const downloadCertificate = async () => {
    if (!contributorName || !contributorRole || !submissionId || !article) {
        setError("Verifikasi belum berhasil atau data tidak lengkap.");
        return;
    }
    setError("");

    try {
      // PERHATIAN: GANTI URL INI SAAT DEPLOY KE APACHE!
      const res = await axios.post(
        "http://localhost:3000/api/certificate",
        {
          reviewerName: contributorName, 
          contributorRole: contributorRole, 
          submissionId,
          articleTitle: article.title,
          reviewDate: article.reviewDate,
        },
        { responseType: "blob" }
      );

      const url = window.URL.createObjectURL(
        new Blob([res.data], { type: "application/pdf" })
      );
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `sertifikat_${submissionId}_${contributorName.replace(/\s/g, '_')}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error(err);
      setError("Gagal membuat atau mengunduh sertifikat.");
    }
  };

  return (
    <div style={styles.container}>
      <h1 style={{ textAlign: "center", marginBottom: '30px', color: '#1f2937' }}>Dashboard Sertifikat Kontribusi OJS</h1>

      <label className="block mb-2 text-sm font-medium text-gray-700">Username Reviewer/Kontributor:</label> 
      <input
        type="text" 
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        placeholder="username_ojs"
        style={styles.input}
      />

      <label className="block mb-2 text-sm font-medium text-gray-700">Submission ID:</label>
      <input
        type="number"
        value={submissionId}
        onChange={(e) => setSubmissionId(e.target.value)}
        placeholder="Masukkan submission ID (Contoh: 1144)"
        style={styles.input}
      />

      <div style={{ marginBottom: '20px' }}>
          <button 
              onClick={verifyReviewer} 
              style={loading ? styles.buttonDisabled : styles.buttonPrimary} 
              disabled={loading}
          >
              {loading ? 'Memverifikasi...' : 'Verifikasi & Ambil Data'}
          </button>

          <button 
              onClick={downloadCertificate} 
              style={!article || !contributorName ? styles.buttonDisabled : styles.buttonPrimary} 
              disabled={!article || !contributorName}
          >
              Download Sertifikat
          </button>
      </div>

      {error && <p style={styles.errorText}>{error}</p>}

      {article && (
        <div style={styles.successBox}>
          <h3 className="text-lg font-semibold text-green-700">✅ Verifikasi Berhasil!</h3>
          <p className="mt-2">Nama Kontributor: <strong>{contributorName}</strong></p>
          <p>Peran Ditemukan: <strong>{contributorRole}</strong></p>
          <hr className="my-2 border-green-300"/>
          <p>Judul Artikel: *{article.title}*</p>
          <p>Tanggal Kontribusi: {article.reviewDate}</p>
          {article.urlPublished && (
            <p className="text-sm">
              URL Publikasi:{" "}
              <a href={article.urlPublished} target="_blank" rel="noreferrer" style={{ color: '#10b981', textDecoration: 'underline' }}>
                Lihat Artikel
              </a>
            </p>
          )}
        </div>
      )}
    </div>
  );
}
