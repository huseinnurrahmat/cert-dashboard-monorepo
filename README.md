# Certificate Generator Backend (OJS Reviewer Certificate)

Backend Node.js untuk menghasilkan sertifikat reviewer jurnal berbasis OJS.

## ✨ Fitur
- Ambil metadata artikel dari OJS 3.3 via REST API
- Generate sertifikat PDF otomatis
- Endpoint:
  - `POST /api/getArticleInfo`
  - `GET /api/downloadCertificate`

## 📦 Instalasi

```bash
npm install
cp .env.example .env
