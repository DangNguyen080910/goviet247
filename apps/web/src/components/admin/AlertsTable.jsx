// Path: goviet247/apps/web/src/components/admin/AlertsTable.jsx
import { useEffect, useMemo, useState } from "react";
import { getAdminToken } from "../../utils/adminAuth";
import { Alert, Button, Chip, MenuItem, Stack, TextField, Typography } from "@mui/material";

function formatNgayGio(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", hour12: false });
}

function normalizeText(value) {
  return String(value || "").toLowerCase().trim();
}

export default function AlertsTable({ onSelectTrip, searchText = "" }) {
  const [dangTai, setDangTai] = useState(true);
  const [loi, setLoi] = useState("");
  const [alerts, setAlerts] = useState([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [readFilter, setReadFilter] = useState("unread");
  const [savingId, setSavingId] = useState("");
  const [actionError, setActionError] = useState("");

  useEffect(() => {
    const refresh = () => setRefreshKey((value) => value + 1);
    window.addEventListener("admin:blocked_trip_accept_attempt", refresh);
    window.addEventListener("admin:alerts_read", refresh);
    return () => {
      window.removeEventListener("admin:blocked_trip_accept_attempt", refresh);
      window.removeEventListener("admin:alerts_read", refresh);
    };
  }, []);

  useEffect(() => {
    let conSong = true;

    async function taiDuLieu() {
      try {
        setDangTai(true);
        setLoi("");

        const token = getAdminToken();

        if (!token) {
          throw new Error("Thiếu token admin");
        }

        const res = await fetch(`/api/admin/alerts?read=${readFilter}`, {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.message || `HTTP ${res.status}`);

        // API có thể trả { alerts: [] } hoặc { logs: [] } hoặc { data: [] }
        const list =
          (Array.isArray(data?.alerts) && data.alerts) ||
          (Array.isArray(data?.logs) && data.logs) ||
          (Array.isArray(data?.data) && data.data) ||
          [];

        if (conSong) setAlerts(list);
      } catch (e) {
        if (conSong) setLoi(e?.message || "Tải danh sách cảnh báo thất bại");
      } finally {
        if (conSong) setDangTai(false);
      }
    }

    taiDuLieu();

    return () => {
      conSong = false;
    };
  }, [refreshKey, readFilter]);

  async function markRead(event, alertId) {
    event.stopPropagation();
    if (!alertId || savingId) return;
    setSavingId(alertId); setActionError("");
    try {
      const res = await fetch(`/api/admin/alerts/${encodeURIComponent(alertId)}/read`, {
        method: "PATCH", headers: { Authorization: `Bearer ${getAdminToken()}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success || !data.alert?.readAt) throw new Error(data.message || "Chưa đánh dấu được cảnh báo.");
      setAlerts(prev => prev.map(row => row.id === alertId ? data.alert : row));
      window.dispatchEvent(new Event("admin:alerts_read"));
    } catch (error) { setActionError(error.message || "Chưa đánh dấu được cảnh báo."); }
    finally { setSavingId(""); }
  }

  const rows = useMemo(() => {
    const baseRows = (Array.isArray(alerts) ? alerts : []).filter(row => readFilter === "all" || (readFilter === "read" ? !!row.readAt : !row.readAt));
    const q = normalizeText(searchText);

    if (!q) return baseRows;

    return baseRows.filter((a) => {
      const tripId =
        a?.tripId || a?.trip_id || a?.trip?.id || a?.trip?.tripId || "";
      const level = a?.level || a?.alertLevel || "";
      const channel = a?.channel || a?.type || a?.alertType || "";
      const message = a?.message || "";

      return (
        normalizeText(tripId).includes(q) ||
        normalizeText(level).includes(q) ||
        normalizeText(channel).includes(q) ||
        normalizeText(message).includes(q)
      );
    });
  }, [alerts, searchText, readFilter]);

  if (dangTai) return <div>Đang tải lịch sử cảnh báo…</div>;
  if (loi) return <div style={{ color: "crimson" }}>Lỗi: {loi}</div>;
  return (
    <>
    <Stack direction="row" gap={2} alignItems="center" flexWrap="wrap" sx={{ mb: 2 }}>
      <TextField select size="small" label="Trạng thái" value={readFilter} onChange={event => setReadFilter(event.target.value)} sx={{ minWidth: 180 }}>
        <MenuItem value="unread">Chưa xem</MenuItem><MenuItem value="read">Đã xem</MenuItem><MenuItem value="all">Tất cả</MenuItem>
      </TextField>
      <Typography variant="body2" color="text.secondary">Trạng thái dùng chung cho đội quản trị. Sidebar chỉ đếm cảnh báo chưa xem trong 24 giờ.</Typography>
      <Button onClick={() => setRefreshKey(value => value + 1)}>Làm mới</Button>
    </Stack>
    {actionError && <Alert severity="error" sx={{ mb: 2 }}>{actionError}</Alert>}
    <div style={{ overflowX: "auto" }}>
      <table
        style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}
      >
        <thead>
          <tr style={{ textAlign: "left" }}>
            <th style={th}>Mã chuyến</th>
            <th style={th}>Cấp độ</th>
            <th style={th}>Kênh</th>
            <th style={th}>Thời gian gửi</th>
            <th style={th}>Nội dung</th>
            <th style={th}>Trạng thái / Hành động</th>
          </tr>
        </thead>

        <tbody>
          {!rows.length && <tr><td colSpan={6} style={td}>{searchText.trim() ? "Không tìm thấy cảnh báo phù hợp." : readFilter === "unread" ? "Không còn cảnh báo chưa xem." : "Chưa có cảnh báo nào."}</td></tr>}
          {rows.map((a, idx) => {
            const tripId =
              a?.tripId || a?.trip_id || a?.trip?.id || a?.trip?.tripId;

            return (
              <tr
                key={a?.id || idx}
                onClick={() => tripId && onSelectTrip?.(tripId)}
                style={{
                  cursor: tripId ? "pointer" : "default",
                  borderTop: "1px solid #e0e0e0",
                }}
                title={tripId ? "Bấm để xem chi tiết chuyến" : ""}
              >
                <td style={tdMono}>{tripId || "-"}</td>
                <td style={td}>{a?.level || a?.alertLevel || "-"}</td>
                <td style={td}>{a?.alertType === "BLOCKED_TRIP_ACCEPT_ATTEMPT" ? "Tài xế bị khoá bấm nhận chuyến" : a?.channel || a?.type || a?.alertType || "-"}</td>
                <td style={td}>{formatNgayGio(a?.sentAt || a?.createdAt)}</td>
                <td style={td} title={a?.message || ""}>
                  {a?.message || "-"}
                </td>
                <td style={{ ...td, minWidth: 180 }}>
                  {a.readAt ? <>
                    <Chip size="small" color="success" label="Đã xem" />
                    <div style={{ fontSize: 12, marginTop: 6 }}>{formatNgayGio(a.readAt)}{a.readBy ? ` · ${a.readBy}` : ""}</div>
                  </> : <Button size="small" variant="outlined" disabled={!a.id || !!savingId}
                    onClick={event => markRead(event, a.id)} sx={{ whiteSpace: "nowrap" }}>
                    {savingId === a.id ? "Đang lưu…" : "Đánh dấu đã xem"}
                  </Button>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
    </>
  );
}

const th = {
  padding: "10px 8px",
  borderBottom: "1px solid #d0d0d0",
  whiteSpace: "nowrap",
};

const td = {
  padding: "10px 8px",
  verticalAlign: "top",
  maxWidth: 520,
};

const tdMono = {
  ...td,
  fontFamily:
    "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
  whiteSpace: "nowrap",
};
