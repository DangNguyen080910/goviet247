// Path: goviet247/apps/web/src/components/admin/AlertsTable.jsx
import { useEffect, useMemo, useState } from "react";
import { getAdminToken } from "../../utils/adminAuth";

function formatNgayGio(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("vi-VN");
}

function normalizeText(value) {
  return String(value || "").toLowerCase().trim();
}

export default function AlertsTable({ onSelectTrip, searchText = "" }) {
  const [dangTai, setDangTai] = useState(true);
  const [loi, setLoi] = useState("");
  const [alerts, setAlerts] = useState([]);

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

        const res = await fetch("/api/admin/alerts", {
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
  }, []);

  const rows = useMemo(() => {
    const baseRows = Array.isArray(alerts) ? alerts : [];
    const q = normalizeText(searchText);

    if (!q) return baseRows;

    return baseRows.filter((a) => {
      const tripId =
        a?.tripId || a?.trip_id || a?.trip?.id || a?.trip?.tripId || "";
      const level = a?.level || a?.alertLevel || "";
      const channel = a?.channel || a?.type || "";
      const message = a?.message || "";

      return (
        normalizeText(tripId).includes(q) ||
        normalizeText(level).includes(q) ||
        normalizeText(channel).includes(q) ||
        normalizeText(message).includes(q)
      );
    });
  }, [alerts, searchText]);

  if (dangTai) return <div>Đang tải lịch sử cảnh báo…</div>;
  if (loi) return <div style={{ color: "crimson" }}>Lỗi: {loi}</div>;
  if (!rows.length)
    return (
      <div>
        {searchText.trim()
          ? "Không tìm thấy cảnh báo phù hợp."
          : "Chưa có cảnh báo nào."}
      </div>
    );

  return (
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
          </tr>
        </thead>

        <tbody>
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
                <td style={td}>{a?.channel || a?.type || "-"}</td>
                <td style={td}>{formatNgayGio(a?.sentAt || a?.createdAt)}</td>
                <td style={td} title={a?.message || ""}>
                  {a?.message ? String(a.message).slice(0, 80) : "-"}
                  {a?.message && String(a.message).length > 80 ? "…" : ""}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
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