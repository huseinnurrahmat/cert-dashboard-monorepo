import React, { useState } from 'react'
import axios from 'axios'


export default function CertificateForm(){
const [name,setName] = useState('')
const [code,setCode] = useState('')
const [preview,setPreview] = useState(null)
const handleGenerate = async ()=>{
try{
const res = await axios.post('http://localhost:3000/api/getArticleInfo',{ code })
setPreview({ name, title: res.data.title, date: res.data.reviewDate })
}catch(err){
alert(err.response?.data?.error || err.message)
}
}
const handleDownload = ()=>{
const params = new URLSearchParams({ name: preview.name, title: preview.title, date: preview.date })
window.location = `http://localhost:3000/api/downloadCertificate?${params.toString()}`
}
return (
<div>
<div style={{marginBottom:10}}>
<label>Nama Reviewer</label><br/>
<input value={name} onChange={e=>setName(e.target.value)} style={{width:'100%',padding:8}} />
</div>
<div style={{marginBottom:10}}>
<label>Kode Artikel (OJS)</label><br/>
<input value={code} onChange={e=>setCode(e.target.value)} style={{width:'100%',padding:8}} />
</div>
<button onClick={handleGenerate}>Generate Preview</button>


{preview && (
<div style={{marginTop:20,border:'1px solid #ddd',padding:12}}>
<h3>Preview</h3>
<p><strong>Nama:</strong> {preview.name}</p>
<p><strong>Judul:</strong> {preview.title}</p>
<p><strong>Tanggal:</strong> {preview.date}</p>
<button onClick={handleDownload}>Download Sertifikat (PDF)</button>
</div>
)}
</div>
)
}