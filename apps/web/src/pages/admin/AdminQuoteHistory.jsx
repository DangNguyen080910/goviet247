import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import {
  Alert, Box, Button, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle,
  FormControlLabel, MenuItem, Paper, Stack, Switch, Table, TableBody, TableCell, TableHead,
  TableRow, TablePagination, TextField, Typography,
} from "@mui/material";
import { getAdminToken, getAdminUser } from "../../utils/adminAuth";
import { formatCarType } from "../../utils/formatCarType";
import AdminTableScroll from "../../components/admin/AdminTableScroll";
import TripDetailModal from "../../components/admin/TripDetailModal";

const day = (date) => date.toLocaleDateString("en-CA", { timeZone: "Asia/Ho_Chi_Minh" });
const formatTime = (value) => value ? new Date(value).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", hour12: false }) : "—";
const money = (value) => Number(value || 0).toLocaleString("vi-VN");
const sources = { WEB: "Web", ANDROID: "Android", IOS: "iOS", UNKNOWN: "Chưa xác định" };
const fuels = { ANY: "Không yêu cầu", ELECTRIC: "Xe điện", GASOLINE: "Xe xăng" };
async function request(path, options = {}) {
  const res = await fetch(`/api/admin/quote-history${path}`, {
    ...options, headers: { "Content-Type": "application/json", Authorization: `Bearer ${getAdminToken()}` },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.success) throw new Error(data.message || "Không tải được dữ liệu.");
  return data;
}

export default function AdminQuoteHistory() {
  const isAdmin = String(getAdminUser()?.role || "").toUpperCase() === "ADMIN";
  const [draft, setDraft] = useState(() => ({ from: day(new Date(Date.now() - 6 * 86400000)), to: day(new Date()), q: "", carType: "", source: "" }));
  const [filters, setFilters] = useState(draft);
  const [page, setPage] = useState(0);
  const [refresh, setRefresh] = useState(0);
  const [data, setData] = useState(null);
  const [enabled, setEnabled] = useState(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [settingError, setSettingError] = useState("");
  const [detail, setDetail] = useState(null);
  const [tripId, setTripId] = useState("");

  useEffect(() => {
    if (!isAdmin) return;
    let active = true;
    request("/settings").then(result => { if (active) { setEnabled(result.enabled); setSettingError(""); } })
      .catch(error => { if (active) setSettingError(error.message); });
    return () => { active = false; };
  }, [isAdmin, refresh]);

  useEffect(() => {
    if (!isAdmin) return;
    let active = true;
    setLoading(true); setError("");
    const params = new URLSearchParams({ page: String(page + 1) });
    Object.entries(filters).forEach(([key, value]) => { if (value) params.set(key, value); });
    request(`?${params}`).then(result => { if (active) setData(result); })
      .catch(error => { if (active) { setError(error.message); setData(null); } })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [isAdmin, filters, page, refresh]);

  async function toggle(next) {
    if (saving) return;
    setSaving(true); setSettingError("");
    try {
      const result = await request("/settings", { method: "PATCH", body: JSON.stringify({ enabled: next }) });
      setEnabled(result.enabled);
    } catch (error) { setSettingError(error.message); }
    finally { setSaving(false); }
  }
  if (!isAdmin) return <Navigate to="/admin" replace />;
  const stats = data?.stats || {};
  const update = (key) => (event) => setDraft(prev => ({ ...prev, [key]: event.target.value }));

  return <Box>
    <Typography variant="h5" sx={{ fontWeight: 800, mb: 1 }}>Lịch sử tính giá</Typography>
    <Typography color="text.secondary" sx={{ mb: 2 }}>Các lần khách tính giá thành công, kể cả khi chưa đặt chuyến. Giờ Việt Nam.</Typography>
    <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" gap={2} flexWrap="wrap">
        <FormControlLabel label={`Ghi lịch sử tính giá: ${enabled === null ? "Đang tải" : enabled ? "Bật" : "Tắt"}`}
          control={<Switch checked={enabled === true} disabled={enabled === null || saving} onChange={(_, value) => toggle(value)} />} />
        <Button variant="outlined" disabled={loading || saving} onClick={() => setRefresh(value => value + 1)}>Làm mới</Button>
      </Stack>
      <Typography variant="body2" color="text.secondary">Tắt chỉ ngừng ghi mới, khách vẫn tính giá bình thường. Lịch sử cũ tiếp tục xem được và tự dọn sau 90 ngày.</Typography>
      {settingError && <Alert severity="error" sx={{ mt: 1 }}>{settingError}</Alert>}
    </Paper>
    <Paper component="form" variant="outlined" sx={{ p: 2, mb: 2 }} onSubmit={event => { event.preventDefault(); setPage(0); setFilters({ ...draft }); }}>
      <Stack direction="row" gap={2} flexWrap="wrap">
        <TextField type="date" size="small" label="Từ ngày" value={draft.from} onChange={update("from")} InputLabelProps={{ shrink: true }} />
        <TextField type="date" size="small" label="Đến ngày" value={draft.to} onChange={update("to")} InputLabelProps={{ shrink: true }} />
        <TextField size="small" label="Tên, SĐT, điểm đón, mã chuyến" value={draft.q} onChange={update("q")} sx={{ minWidth: 260 }} />
        <TextField select size="small" label="Loại xe" value={draft.carType} onChange={update("carType")} sx={{ minWidth: 130 }}>
          <MenuItem value="">Tất cả</MenuItem>{["CAR_5", "CAR_7", "CAR_16"].map(value => <MenuItem key={value} value={value}>{formatCarType(value)}</MenuItem>)}
        </TextField>
        <TextField select size="small" label="Nguồn" value={draft.source} onChange={update("source")} sx={{ minWidth: 140 }}>
          <MenuItem value="">Tất cả</MenuItem>{Object.entries(sources).map(([key, label]) => <MenuItem key={key} value={key}>{label}</MenuItem>)}
        </TextField>
        <Button type="submit" variant="contained">Lọc</Button>
      </Stack>
    </Paper>
    {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
    <Stack direction="row" gap={2} flexWrap="wrap" sx={{ mb: 2 }}>
      {[["Lượt tính giá trong bộ lọc", stats.total], ["Lượt hôm nay trong bộ lọc", stats.todayQuotes], ["Khách/thiết bị nhận diện", stats.uniqueCustomers], ["Tài khoản đã đăng nhập", stats.loggedInCustomers], ["Lượt đã đặt chuyến", stats.bookedQuotes]].map(([label, value]) =>
        <Paper variant="outlined" key={label} sx={{ p: 2, flex: "1 1 170px" }}><Typography variant="body2">{label}</Typography><Typography variant="h5" sx={{ fontWeight: 700 }}>{value == null ? "—" : money(value)}</Typography></Paper>)}
    </Stack>
    <Alert severity="info" sx={{ mb: 2 }}>Một khách có thể tính giá nhiều lần. Số khách/thiết bị là ước tính theo tài khoản hoặc trình duyệt/thiết bị; không cộng thêm {stats.unidentifiedQuotes || 0} lượt chưa nhận diện. Tên/SĐT trong form do khách nhập; “Đã đăng nhập” không xác thực nội dung form. “Đã đặt” chỉ ghi nhận chuyến liên kết trực tiếp với lần tính giá này.</Alert>
    {loading ? <CircularProgress /> : <Paper variant="outlined">
      <AdminTableScroll label="Lịch sử tính giá">
        <Table size="small" sx={{ minWidth: 1900 }}>
          <TableHead><TableRow>{["Thời điểm tính giá", "Khách hàng", "Số điện thoại", "Nguồn", "Điểm đón", "Các điểm đến", "Giờ đón", "Giờ về", "Loại xe", "Loại chuyến", "Nhiên liệu", "Km", "Giá đã báo (đ)", "Đặt chuyến", "Chi tiết"].map(label => <TableCell key={label} sx={{ fontWeight: 700, whiteSpace: "nowrap" }}>{label}</TableCell>)}</TableRow></TableHead>
          <TableBody>
            {!data?.items?.length && <TableRow><TableCell colSpan={15} align="center">Chưa có lịch sử phù hợp.</TableCell></TableRow>}
            {data?.items?.map(row => <TableRow key={row.id} hover>
              <TableCell sx={{ whiteSpace: "nowrap" }}>{formatTime(row.createdAt)}</TableCell>
              <TableCell>{row.customerName || "Khách chưa xác định"}<br /><Chip size="small" label={row.identityVerified ? "Đã đăng nhập" : "Khách vãng lai"} /></TableCell>
              <TableCell sx={{ whiteSpace: "nowrap" }}>{row.customerPhone || "—"}</TableCell>
              <TableCell>{sources[row.source]}</TableCell>
              <TableCell sx={{ minWidth: 240 }}>{row.pickupAddress || "Chưa được cung cấp"}</TableCell>
              <TableCell sx={{ minWidth: 260 }}>{Array.isArray(row.stops) && row.stops.length ? row.stops.map((stop, index) => <div key={index}>{index + 1}. {stop}</div>) : "Chưa được cung cấp"}</TableCell>
              <TableCell sx={{ whiteSpace: "nowrap" }}>{formatTime(row.pickupTime)}</TableCell><TableCell sx={{ whiteSpace: "nowrap" }}>{formatTime(row.returnTime)}</TableCell>
              <TableCell>{formatCarType(row.carType)}</TableCell><TableCell>{row.direction === "ROUND_TRIP" ? "Khứ hồi" : "Một chiều"}</TableCell><TableCell>{fuels[row.fuelPreference]}</TableCell>
              <TableCell align="right">{Number(row.distanceKm).toLocaleString("vi-VN", { maximumFractionDigits: 1 })}</TableCell>
              <TableCell align="right" sx={{ whiteSpace: "nowrap", fontWeight: 700 }}>{money(row.finalPrice)}</TableCell>
              <TableCell>{row.tripId ? <Button onClick={() => setTripId(row.tripId)}>#{row.tripId.slice(-8).toUpperCase()}</Button> : "Chưa ghi nhận"}</TableCell>
              <TableCell><Button onClick={() => setDetail(row)}>Xem</Button></TableCell>
            </TableRow>)}
          </TableBody>
        </Table>
      </AdminTableScroll>
      <TablePagination component="div" count={stats.total || 0} page={page} rowsPerPage={25} rowsPerPageOptions={[25]} onPageChange={(_, value) => setPage(value)} labelDisplayedRows={({ from, to, count }) => `${from}–${to} / ${count}`} />
    </Paper>}
    <Dialog open={!!detail} onClose={() => setDetail(null)} fullWidth maxWidth="sm">
      <DialogTitle>Chi tiết lần tính giá</DialogTitle>
      <DialogContent dividers>{detail && <Stack spacing={1}>
        <Typography>Tính giá lúc: {formatTime(detail.createdAt)}</Typography>
        <Typography>Khách: {detail.customerName || "Chưa xác định"} · {detail.customerPhone || "Chưa có SĐT"}</Typography>
        <Typography>Tài khoản: {detail.userId || "Khách vãng lai"}</Typography>
        <Typography>Nguồn: {sources[detail.source]}</Typography>
        <Typography>Điểm đón: {detail.pickupAddress || "Chưa được cung cấp"}</Typography>
        {Array.isArray(detail.stops) && detail.stops.map((stop, index) => <Typography key={index}>Điểm đến {index + 1}: {stop}</Typography>)}
        <Typography>Giờ đón: {formatTime(detail.pickupTime)} · Giờ về: {formatTime(detail.returnTime)}</Typography>
        <Typography>{formatCarType(detail.carType)} · {detail.direction === "ROUND_TRIP" ? "Khứ hồi" : "Một chiều"} · {fuels[detail.fuelPreference]}</Typography>
        <Typography>{detail.distanceKm} km · Thời gian lái dự kiến: {detail.driveMinutes ?? "—"} phút</Typography>
        <Typography sx={{ fontWeight: 700 }}>Giá đã báo: {money(detail.finalPrice)} đ</Typography>
        <Typography>Đặt chuyến: {detail.tripId || "Chưa ghi nhận"} · {formatTime(detail.bookedAt)}</Typography>
      </Stack>}</DialogContent>
      <DialogActions><Button onClick={() => setDetail(null)}>Đóng</Button></DialogActions>
    </Dialog>
    <TripDetailModal open={!!tripId} tripId={tripId} onClose={() => setTripId("")} />
  </Box>;
}
