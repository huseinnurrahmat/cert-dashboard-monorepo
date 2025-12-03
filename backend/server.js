require('dotenv').config();
const express = require('express');
const axios = require('axios');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const cors = require('cors');


const app = express();
app.use(express.json());
app.use(cors());


const PORT = process.env.PORT || 3000;
const OJS_BASE = process.env.OJS_BASE_URL;
const OJS_API_TOKEN = process.env.OJS_API_TOKEN || '';
const OJS_USE_AUTH_HEADER = process.env.OJS_USE_AUTH_HEADER === 'true';
const LOGO_PATH = process.env.LOGO_PATH || path.join(__dirname, 'assets', 'bmkg-logo.png');


async function fetchArticleFromOJS(articleCode) {
if (!OJS_BASE) throw new Error('OJS_BASE_URL not set');
const url = `${OJS_BASE.replace(/\/$/, '')}/api/v1/submissions/${encodeURIComponent(articleCode)}`;
const config = {};
if (OJS_API_TOKEN) {
if (OJS_USE_AUTH_HEADER) config.headers = { Authorization: `Bearer ${OJS_API_TOKEN}` };
else config.params = { apiToken: OJS_API_TOKEN };
}
const res = await axios.get(url, config);
return res.data;
}


app.post('/api/getArticleInfo', async (req, res) => {
try {
const { code } = req.body;
if (!code) return res.status(400).json({ error: 'Article code diperlukan' });
if (!OJS_BASE) return res.status(500).json({ error: 'OJS_BASE_URL belum diset' });
const data = await fetchArticleFromOJS(code);
const title = data.title || (data.publication && data.publication.title) || '';
const reviewDate = data.datePublished || data.publication?.datePublished || data.updated || '';
return res.json({ title, reviewDate, raw: data });
} catch (err) {
console.error(err?.response?.data || err.message || err);
const msg = err.response ? `OJS error ${err.response.status}: ${err.response.statusText}` : err.message;
res.status(500).json({ error: msg });
}
});


app.get('/api/downloadCertificate', async (req, res) => {
try {
const name = req.query.name || 'Reviewer';
const title = req.query.title || 'Judul artikel';
const date = req.query.date || new Date().toLocaleDateString('id-ID');


const doc = new PDFDocument({ size: 'A4', margin: 50 });
res.setHeader('Content-Disposition', `attachment; filename="certificate-${name.replace(/\s+/g,'_')}.pdf"`);
res.setHeader('Content-Type', 'application/pdf');


doc.pipe(res);
doc.rect(30, 30, doc.page.width - 60, doc.page.height - 60).stroke();
if (fs.existsSync(LOGO_PATH)) {
const logoW = 120;
const x = (doc.page.width - logoW) / 2;
doc.image(LOGO_PATH, x, 60, { width: logoW });
}
app.listen(PORT, () => console.log(`Backend berjalan di port ${PORT}`));