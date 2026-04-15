// Path: goviet247/apps/web/src/components/admin/TripDetailModal.jsx
import { useEffect, useMemo, useState } from "react";
import { getAdminToken } from "../../utils/adminAuth";
import { normalizeDisplayAddress } from "../../api/adminTrips";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5050";

function formatNgayGio(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("vi-VN");
}

function formatGia(v) {
  if (v == null || v === "") return "-";
  const num = Number(v);
  if (!Number.isFinite(num)) return String(v);
  return `${num.toLocaleString("vi-VN")} VNĐ`;
}

function formatTripStatus(status) {
  const map = {
    PENDING: "CHỜ DUYỆT",
    ACCEPTED: "CHƯA LIÊN HỆ KHÁCH",
    CONTACTED: "CHƯA ĐÓN KHÁCH",
    IN_PROGRESS: "ĐANG TRÊN HÀNH TRÌNH",
    COMPLETED: "ĐÃ HOÀN THÀNH",
    CANCELLED: "ĐÃ HUỶ",
  };

  return map[status] || status || "-";
}

function formatDistanceKm(value) {
  if (value == null || value === "") return "-";

  const num = Number(value);
  if (!Number.isFinite(num) || num < 0) return String(value);

  return `${num.toLocaleString("vi-VN", {
    minimumFractionDigits: num % 1 === 0 ? 0 : 1,
    maximumFractionDigits: 1,
  })} km`;
}

function formatDurationMinutes(value) {
  if (value == null || value === "") return "-";

  const totalMinutes = Number(value);
  if (!Number.isFinite(totalMinutes) || totalMinutes < 0) {
    return String(value);
  }

  if (totalMinutes < 60) {
    return `${Math.round(totalMinutes)} phút`;
  }

  const hours = Math.floor(totalMinutes / 60);
  const minutes = Math.round(totalMinutes % 60);

  if (minutes === 0) {
    return `${hours} giờ`;
  }

  return `${hours} giờ ${minutes} phút`;
}

function formatVehicleType(value) {
  const map = {
    CAR_5: "Xe 5 chỗ",
    CAR_7: "Xe 7 chỗ",
    CAR_16: "Xe 16 chỗ",
  };

  return map[value] || value || "-";
}

function getStops(detail) {
  const stops = Array.isArray(detail?.stops) ? detail.stops : [];
  const list = stops
    .map((s) => normalizeDisplayAddress(s?.address))
    .filter((x) => typeof x === "string" && x.trim().length > 0);

  if (list.length === 0 && detail?.dropoffAddress) {
    return [normalizeDisplayAddress(detail.dropoffAddress)];
  }

  return list;
}

function getDriverPhone(detail) {
  return detail?.driver?.phones?.[0]?.e164 || "";
}

function getDriverDisplayName(detail) {
  return (
    detail?.driver?.driverProfile?.fullName ||
    detail?.driver?.displayName ||
    detail?.driver?.phones?.[0]?.e164 ||
    "-"
  );
}

function getRiderDisplayName(detail) {
  return (
    detail?.riderName ||
    detail?.rider?.riderProfile?.fullName ||
    detail?.rider?.displayName ||
    detail?.riderPhone ||
    detail?.rider?.phones?.[0]?.e164 ||
    "-"
  );
}

function getWaitMinutes(detail) {
  const pickupMs = new Date(detail?.pickupTime || "").getTime();
  const returnMs = new Date(detail?.returnTime || "").getTime();
  const outbound = Number(detail?.outboundDriveMinutes || 0);

  if (
    !detail?.returnTime ||
    !Number.isFinite(pickupMs) ||
    !Number.isFinite(returnMs) ||
    !Number.isFinite(outbound)
  ) {
    return 0;
  }

  const totalGapMinutes = Math.max(
    0,
    Math.round((returnMs - pickupMs) / 60000),
  );
  return Math.max(0, totalGapMinutes - outbound);
}

export default function TripDetailModal({ open, tripId, onClose }) {
  const [dangTai, setDangTai] = useState(true);
  const [loi, setLoi] = useState("");
  const [detail, setDetail] = useState(null);

  const token = useMemo(() => getAdminToken(), []);

  useEffect(() => {
    if (!open || !tripId) return;

    let conSong = true;

    async function taiDuLieu() {
      try {
        setDangTai(true);
        setLoi("");
        setDetail(null);

        if (!token) throw new Error("Thiếu token admin");

        const res = await fetch(`${API_BASE}/api/admin/trips/${tripId}`, {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          cache: "no-store",
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.message || `HTTP ${res.status}`);

        // Mềm dẻo với nhiều kiểu response từ BE
        const trip = data?.trip || data?.data?.trip || data?.tripDetail || data;
        if (conSong) setDetail(trip);
      } catch (e) {
        if (conSong) setLoi(e?.message || "Tải chi tiết chuyến thất bại");
      } finally {
        if (conSong) setDangTai(false);
      }
    }

    taiDuLieu();
    return () => {
      conSong = false;
    };
  }, [open, tripId, token]);

  if (!open || !tripId) return null;

  const stops = getStops(detail);
  const driverPhone = getDriverPhone(detail);
  const driverProfile = detail?.driver?.driverProfile || null;

  const driverDriveMinutes =
    detail?.direction === "ROUND_TRIP"
      ? Number(detail?.outboundDriveMinutes || 0)
      : Number(detail?.estimatedDurationMinutes || 0);

  const waitMinutes =
    detail?.direction === "ROUND_TRIP" ? getWaitMinutes(detail) : 0;

  const totalEstimatedMinutes = Number(detail?.estimatedDurationMinutes || 0);

  return (
    <div style={overlay} onClick={onClose}>
      <div style={modal} onClick={(e) => e.stopPropagation()}>
        <div style={header}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>Chi tiết chuyến</div>
            <div style={{ fontSize: 12, opacity: 0.8 }}>{tripId}</div>
          </div>

          <button style={btn} onClick={onClose}>
            Đóng
          </button>
        </div>

        {dangTai && <div>Đang tải…</div>}
        {loi && <div style={{ color: "crimson" }}>Lỗi: {loi}</div>}

        {!dangTai && !loi && (
          <>
            <Section title="Thông tin chuyến">
              <KV k="Trạng thái" v={formatTripStatus(detail?.status)} />
              <KV k="Thời gian tạo" v={formatNgayGio(detail?.createdAt)} />
              <KV k="Giờ đón" v={formatNgayGio(detail?.pickupTime)} />
              <KV
                k="Giờ về (Khứ hồi)"
                v={detail?.returnTime ? formatNgayGio(detail.returnTime) : "-"}
              />
              <KV k="Tên khách" v={getRiderDisplayName(detail)} />
              <KV
                k="Số điện thoại"
                v={
                  detail?.riderPhone || detail?.rider?.phones?.[0]?.e164 || "-"
                }
              />
              <KV k="Loại xe" v={formatVehicleType(detail?.carType)} />
              <KV
                k="Điểm đón"
                v={normalizeDisplayAddress(detail?.pickupAddress)}
              />
              <KV
                k="Quãng đường dự kiến"
                v={formatDistanceKm(detail?.distanceKm)}
              />
              <KV
                k="Thời gian tài xế lái"
                v={formatDurationMinutes(driverDriveMinutes)}
              />
              <KV
                k="Giờ chờ"
                v={
                  detail?.direction === "ROUND_TRIP"
                    ? formatDurationMinutes(waitMinutes)
                    : "-"
                }
              />
              <KV
                k="Tổng thời gian chuyến dự kiến"
                v={formatDurationMinutes(totalEstimatedMinutes)}
              />
            </Section>

            <Section title="Các điểm đến">
              {stops?.length ? (
                <div style={{ display: "grid", gap: 8 }}>
                  {stops.map((addr, idx) => (
                    <div key={`stop-${idx}`} style={stopRow}>
                      <div style={{ width: 110, opacity: 0.75 }}>
                        Điểm đến {idx + 1}
                      </div>
                      <div style={{ flex: 1 }}>{addr}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ opacity: 0.8 }}>-</div>
              )}
            </Section>

            <Section title="Ghi chú">
              <div style={{ opacity: 0.9 }}>{detail?.note || "-"}</div>
            </Section>

            <Section title="Giá">
              <div style={{ opacity: 0.95, fontWeight: 700 }}>
                {formatGia(detail?.totalPrice)}
              </div>
            </Section>

            <Section title="Tài xế đã nhận">
              {detail?.driver ? (
                <>
                  <KV k="Tên tài xế" v={getDriverDisplayName(detail)} />
                  <KV k="Số điện thoại" v={driverPhone || "-"} />
                  <KV k="Trạng thái hồ sơ" v={driverProfile?.status || "-"} />
                  <KV
                    k="Loại xe"
                    v={formatVehicleType(driverProfile?.vehicleType)}
                  />
                  <KV k="Hãng xe" v={driverProfile?.vehicleBrand || "-"} />
                  <KV k="Dòng xe" v={driverProfile?.vehicleModel || "-"} />
                  <KV
                    k="Đời xe"
                    v={
                      driverProfile?.vehicleYear != null
                        ? String(driverProfile.vehicleYear)
                        : "-"
                    }
                  />
                  <KV k="Biển số" v={driverProfile?.plateNumber || "-"} />
                </>
              ) : (
                <div style={{ opacity: 0.8 }}>Chưa có tài xế nhận chuyến.</div>
              )}
            </Section>

            <Section title="Cảnh báo">
              <AlertsBlock detail={detail} />
            </Section>
          </>
        )}
      </div>
    </div>
  );
}

function AlertsBlock({ detail }) {
  const logs =
    detail?.alertLogs ||
    detail?.alerts ||
    detail?.alertLog ||
    detail?.adminAlertLogs ||
    [];

  const hasL1 = detail?.hasL1;
  const hasL2 = detail?.hasL2;

  if (Array.isArray(logs) && logs.length) {
    return (
      <div style={{ display: "grid", gap: 8 }}>
        {logs.map((a, idx) => (
          <div key={a?.id || idx} style={alertCard}>
            <div style={{ fontWeight: 700 }}>
              Cấp độ: {a?.level || a?.alertLevel || "-"}
            </div>
            <div style={{ fontSize: 13, opacity: 0.9 }}>
              Thời gian gửi:{" "}
              {a?.sentAt ? new Date(a.sentAt).toLocaleString("vi-VN") : "-"}
            </div>
            <div style={{ fontSize: 13, opacity: 0.9 }}>
              Kênh: {a?.channel || a?.type || "-"}
            </div>
            {a?.message && (
              <div style={{ fontSize: 13, opacity: 0.9 }}>
                Nội dung: {a.message}
              </div>
            )}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: 8, opacity: 0.9 }}>
        API chưa trả log cảnh báo chi tiết.
      </div>
      <div style={{ display: "flex", gap: 10 }}>
        <span style={pill(!!hasL1)}>L1: {hasL1 ? "đã gửi" : "chưa gửi"}</span>
        <span style={pill(!!hasL2)}>L2: {hasL2 ? "đã gửi" : "chưa gửi"}</span>
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ marginTop: 14 }}>
      <div style={sectionTitle}>{title}</div>
      <div style={card}>{children}</div>
    </div>
  );
}

function KV({ k, v }) {
  return (
    <div style={row}>
      <div style={{ opacity: 0.75, width: 130 }}>{k}</div>
      <div style={{ flex: 1 }}>{v || "-"}</div>
    </div>
  );
}

const overlay = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.55)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 16,
  zIndex: 9999,
};

const modal = {
  width: "min(920px, 100%)",
  maxHeight: "85vh",
  overflow: "auto",
  borderRadius: 18,
  border: "1px solid #333",
  background: "#111",
  color: "#eee",
  padding: 16,
};

const header = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  marginBottom: 12,
};

const btn = {
  padding: "8px 12px",
  borderRadius: 10,
  border: "1px solid #333",
  background: "rgba(255,255,255,0.06)",
  color: "#eee",
  cursor: "pointer",
};

const sectionTitle = {
  fontSize: 13,
  fontWeight: 800,
  opacity: 0.9,
  marginBottom: 8,
};

const card = {
  border: "1px solid #333",
  borderRadius: 16,
  padding: 12,
  background: "rgba(255,255,255,0.03)",
};

const row = {
  display: "flex",
  gap: 12,
  padding: "8px 0",
  borderBottom: "1px dashed rgba(255,255,255,0.12)",
};

const stopRow = {
  display: "flex",
  gap: 12,
  padding: "8px 0",
  borderBottom: "1px dashed rgba(255,255,255,0.12)",
};

const alertCard = {
  border: "1px solid #333",
  borderRadius: 12,
  padding: 10,
  background: "rgba(255,255,255,0.04)",
};

function pill(ok) {
  return {
    display: "inline-block",
    padding: "4px 10px",
    borderRadius: 999,
    border: "1px solid #333",
    background: ok ? "rgba(0,200,120,0.15)" : "rgba(255,255,255,0.06)",
    color: ok ? "#00c878" : "#ccc",
    fontSize: 12,
  };
}
