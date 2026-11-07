import { useState } from "react";
import { Alert, Button } from "@mui/material";
import { getAdminToken } from "../../utils/adminAuth";
export default function AccountingPdfButton({ period, reportType, documentType, dateRange }) {
  const [busy,setBusy]=useState(false),[error,setError]=useState("");
  async function download() {
    setBusy(true);setError("");
    try {
      const query=new URLSearchParams({year:period.year,quarter:period.quarter,reportType,...(period.month?{month:period.month}:{}),...(documentType?{documentType}:{}),...(dateRange || {})});
      const res=await fetch(`${import.meta.env.VITE_API_BASE || "http://localhost:5050"}/api/admin/accounting-report/pdf?${query}`,{headers:{Authorization:`Bearer ${getAdminToken()}`}});
      if(!res.ok) throw new Error("Không xuất được PDF. Vui lòng thử lại.");
      const url=URL.createObjectURL(await res.blob()),link=document.createElement("a");link.href=url;link.download=`${reportType}_${period.month?`T${period.month}`:`Q${period.quarter}`}_${period.year}.pdf`;document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
    }catch(err){setError(err.message);}finally{setBusy(false);}
  }
  return <><Button variant="outlined" disabled={busy} onClick={download}>{busy?"Đang xuất PDF...":reportType === "documents"?"Xuất bảng kê PDF":"Xuất PDF"}</Button>{error&&<Alert severity="error">{error}</Alert>}</>;
}
