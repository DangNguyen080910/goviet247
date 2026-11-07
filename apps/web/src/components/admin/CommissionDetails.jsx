import { useEffect, useRef, useState } from "react";
import { Alert, Button, MenuItem, Stack, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography, CircularProgress } from "@mui/material";
import AccountingPdfButton from "./AccountingPdfButton";
import AdminTableScroll from "./AdminTableScroll";
import { getAdminToken } from "../../utils/adminAuth";
const base = `${import.meta.env.VITE_API_BASE || "http://localhost:5050"}/api/admin/commission-details`;
const money = value => `${Number(value || 0).toLocaleString("vi-VN")} đ`;
export default function CommissionDetails() {
  const [mode, setMode] = useState("month");
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [quarter, setQuarter] = useState(Math.floor(new Date().getMonth() / 3) + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const version = useRef(0);
  const query = new URLSearchParams(mode === "month" ? { month, year } : { quarter, year }).toString();
  useEffect(() => {
    const id = ++version.current;
    const controller = new AbortController();
    setData(null); setError(""); setLoading(true);
    fetch(`${base}?${query}`, { headers: { Authorization: `Bearer ${getAdminToken()}` }, signal: controller.signal })
      .then(async res => { const body = await res.json(); if (!res.ok || !body.success) throw new Error(body.message || "Không tải được hoa hồng."); return body; })
      .then(body => { if (id === version.current) setData(body); })
      .catch(err => { if (err.name !== "AbortError" && id === version.current) setError(err.message); })
      .finally(() => { if (id === version.current) setLoading(false); });
    return () => controller.abort();
  }, [query]);
  async function download() {
    setDownloading(true); setError("");
    try {
      const res = await fetch(`${base}?${query}&format=csv`, { headers: { Authorization: `Bearer ${getAdminToken()}` } });
      if (!res.ok) throw new Error("Không xuất được chi tiết hoa hồng. Vui lòng thử lại.");
      const url = URL.createObjectURL(await res.blob());
      const link = document.createElement("a"); link.href = url; link.download = `chi_tiet_hoa_hong_${data.periodKey}.csv`;
      document.body.appendChild(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) { setError(err.message); } finally { setDownloading(false); }
  }
  return <Stack spacing={2}>
    <Typography variant="h5" fontWeight={800}>Chi tiết hoa hồng</Typography>
    <Stack direction="row" spacing={2} useFlexGap flexWrap="wrap">
      <TextField select label="Xem theo" value={mode} onChange={e => setMode(e.target.value)} sx={{ minWidth: 140 }}><MenuItem value="month">Tháng</MenuItem><MenuItem value="quarter">Quý</MenuItem></TextField>
      <TextField select label={mode === "month" ? "Tháng" : "Quý"} value={mode === "month" ? month : quarter} onChange={e => mode === "month" ? setMonth(Number(e.target.value)) : setQuarter(Number(e.target.value))} sx={{ minWidth: 120 }}>
        {Array.from({ length: mode === "month" ? 12 : 4 }, (_, i) => <MenuItem key={i+1} value={i+1}>{i+1}</MenuItem>)}
      </TextField>
      <TextField label="Năm" type="number" value={year} onChange={e => setYear(e.target.value)} inputProps={{ min: 2000, max: 2100 }} sx={{ width: 130 }} />
      <AccountingPdfButton period={{year,quarter,month:mode === "month" ? month : null}} reportType="commission" />
    </Stack>
    <Alert severity="info">Mỗi chuyến hoàn thành một dòng; khoản giữ ví của chuyến chưa hoàn thành hoặc đã huỷ không được tính. Ngày ghi nhận theo lần cập nhật chuyến, cùng kỳ với báo cáo DT / LN. Đây là bảng đối chiếu để lập hoá đơn, chưa phải hoá đơn điện tử.</Alert>
    <Alert severity="warning">VAT là số tham khảo theo cách tính báo cáo hiện tại. Kế toán cần xác nhận thuế suất, thông tin bên mua và bổ sung địa chỉ/MST trước khi xuất hoá đơn. CCCD/SĐT là hồ sơ tài xế hiện tại.</Alert>
    {error && <Alert severity="error">{error}</Alert>}
    {loading ? <CircularProgress /> : data && <>
      <Typography fontWeight={700}>{data.items.length} chuyến · Hoa hồng gồm VAT: {money(data.totals.gross)} · Trước VAT: {money(data.totals.net)} · VAT: {money(data.totals.vat)}</Typography>
      <AdminTableScroll><Table size="small"><TableHead><TableRow>{["Ngày ghi nhận", "Mã chuyến", "Tài xế / mã tài xế", "SĐT", "CCCD / số định danh", "Giá chuyến", "% hoa hồng", "Hoa hồng gồm VAT", "Trước VAT", "VAT", "Ghi chú"].map(t => <TableCell key={t}>{t}</TableCell>)}</TableRow></TableHead><TableBody>
        {data.items.length === 0 ? <TableRow><TableCell colSpan={11}>Chưa có hoa hồng chuyến hoàn thành trong kỳ này.</TableCell></TableRow> : data.items.map(i => <TableRow key={i.tripId}>
          <TableCell>{new Date(i.eventAt).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}</TableCell><TableCell>{i.tripId}</TableCell><TableCell>{i.driverName}<br/>{i.driverId}</TableCell><TableCell>{i.driverPhone || "Chưa cập nhật"}</TableCell><TableCell>{i.citizenId || "Chưa cập nhật"}</TableCell><TableCell>{money(i.totalPrice)}</TableCell><TableCell>{i.commissionPercent ?? "—"}</TableCell><TableCell>{money(i.commissionGross)}</TableCell><TableCell>{money(i.commissionNet)}</TableCell><TableCell>{money(i.commissionVat)}</TableCell><TableCell>{i.note}</TableCell>
        </TableRow>)}
      </TableBody></Table></AdminTableScroll>
    </>}
  </Stack>;
}
