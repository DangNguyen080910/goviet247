// Path: goviet247/apps/web/src/components/admin/PendingTripsTable.jsx
import { useEffect, useMemo, useState } from "react";
import { Button } from "@mui/material";
import CancelTripDialog from "./CancelTripDialog";
import { getAdminToken } from "../../utils/adminAuth";

// Bật debug nếu cần (mặc định tắt)
const DEBUG_PENDING_TIME = false;

// Parse date an toàn (hỗ trợ cả Date object lẫn string)
function parseDate(input) {
  if (!input) return null;
  if (input instanceof Date) return input;

  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

// Format thời gian cho dễ đọc (giờ VN)
function formatNgayGio(input) {
  const d = parseDate(input);
  if (!d) return input ? String(input) : "-";
  return d.toLocaleString("vi-VN");
}

function formatGia(v) {
  if (v == null) return "-";
  const num = Number(v);
  if (!Number.isFinite(num)) return String(v);
  return num.toLocaleString("vi-VN");
}

// Tính phút chờ từ createdAt (fallback khi BE chưa trả pendingMinutes)
function tinhPhutChoFallback(createdAt) {
  const d = parseDate(createdAt);
  if (!d) return 0;

  const diffMs = Date.now() - d.getTime();
  const minutes = Math.floor(diffMs / 60000);

  // Clamp để tránh âm (nếu data bị "tương lai")
  return Math.max(0, minutes);
}

// Ưu tiên pendingMinutes từ BE, fallback mới tự tính
function layPhutCho(trip) {
  const pm = Number(trip?.pendingMinutes);
  if (Number.isFinite(pm) && pm >= 0) return pm;
  return tinhPhutChoFallback(trip?.createdAt);
}

// Ưu tiên alertCount từ BE mới, fallback về pendingAlertCount nếu cần
function laySoLanCanhBao(trip) {
  const count = Number(trip?.alertCount ?? trip?.pendingAlertCount ?? 0);
  if (Number.isFinite(count) && count >= 0) return count;
  return 0;
}

// Ưu tiên lastAlertAt từ BE mới, fallback về pendingAlertAt nếu cần
function layLanCuoiCanhBao(trip) {
  return trip?.lastAlertAt || trip?.pendingAlertAt || null;
}

function pickPhone(user) {
  return user?.phones?.[0]?.e164 || "";
}

function renderStopsCell(trip) {
  const stops = Array.isArray(trip?.stops) ? trip.stops : [];
  if (stops.length > 0) {
    return (
      <div style={{ display: "grid", gap: 4 }}>
        {stops
          .slice()
          .sort((a, b) => Number(a?.order ?? 0) - Number(b?.order ?? 0))
          .map((s, idx) => (
            <div key={s?.id || idx} style={{ lineHeight: 1.35 }}>
              • {s?.address || "-"}
            </div>
          ))}
      </div>
    );
  }

  // fallback legacy
  return trip?.dropoffAddress || "-";
}

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .trim();
}

function getPendingTripRiderName(trip) {
  return (
    trip?.riderName ||
    trip?.rider?.riderProfile?.fullName ||
    trip?.rider?.displayName ||
    pickPhone(trip?.rider) ||
    "-"
  );
}

/**
 * mode (tương thích 2 kiểu):
 * - "PENDING" / "active"      => /api/admin/pending-trips
 * - "CANCELLED" / "cancelled" => /api/admin/pending-trips/cancelled
 */
export default function PendingTripsTable({
  onSelectTrip,
  mode = "PENDING",
  showCustomer = false,
  searchText = "",
}) {
  const [dangTai, setDangTai] = useState(true);
  const [loi, setLoi] = useState("");
  const [trips, setTrips] = useState([]);
  const [hoveredTripId, setHoveredTripId] = useState("");

  const [openCancel, setOpenCancel] = useState(false);
  const [selectedTrip, setSelectedTrip] = useState(null);

  // ✅ normalize mode để support cả "active/cancelled" và "PENDING/CANCELLED"
  const normalizedMode = String(mode || "").toUpperCase();
  const isCancelledTab =
    normalizedMode === "CANCELLED" ||
    normalizedMode === "CANCELLED_TRIPS" ||
    normalizedMode === "CANCEL" ||
    String(mode) === "cancelled";
  const isActiveTab = !isCancelledTab;

  const showCustomerCol = isCancelledTab || showCustomer;

  async function taiDuLieu() {
    try {
      setDangTai(true);
      setLoi("");

      const token = getAdminToken();
      if (!token) {
        setLoi("Thiếu token admin");
        return;
      }

      const url = isCancelledTab
        ? "/api/admin/pending-trips/cancelled"
        : "/api/admin/pending-trips";

      const res = await fetch(url, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        cache: "no-store",
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || `HTTP ${res.status}`);

      // active: { success, trips: [...] }
      // cancelled: { success, items: [...] } hoặc { success, trips: [...] }
      const list = Array.isArray(data?.trips)
        ? data.trips
        : Array.isArray(data?.items)
          ? data.items
          : [];

      setTrips(list);

      if (DEBUG_PENDING_TIME && list?.length && isActiveTab) {
        const first = list[0];
        const d = parseDate(first?.createdAt);
        console.log("[PendingTripsTable][debug]", {
          createdAt_raw: first?.createdAt,
          createdAt_local: d ? d.toString() : null,
          createdAt_iso: d ? d.toISOString() : null,
          now_local: new Date().toString(),
          now_iso: new Date().toISOString(),
          pendingMinutes_from_api: first?.pendingMinutes,
          alertCount_from_api: first?.alertCount,
          lastAlertAt_from_api: first?.lastAlertAt,
          diffMs: d ? Date.now() - d.getTime() : null,
        });
      }
    } catch (e) {
      setLoi(e?.message || "Tải danh sách chuyến thất bại");
    } finally {
      setDangTai(false);
    }
  }

  useEffect(() => {
    let conSong = true;
    (async () => {
      if (!conSong) return;
      await taiDuLieu();
    })();
    return () => {
      conSong = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCancelledTab]);

  const rows = useMemo(() => {
    const baseRows = Array.isArray(trips) ? trips : [];
    const q = normalizeText(searchText);

    if (!q) return baseRows;

    return baseRows.filter((t) => {
      const tripId = normalizeText(t?.tripId || t?.id);
      const riderName = normalizeText(getPendingTripRiderName(t));
      const riderPhone = normalizeText(t?.riderPhone || pickPhone(t?.rider));

      return (
        tripId.includes(q) || riderName.includes(q) || riderPhone.includes(q)
      );
    });
  }, [trips, searchText]);

  if (dangTai) return <div>Đang tải danh sách chuyến…</div>;
  if (loi) return <div style={{ color: "crimson" }}>Lỗi: {loi}</div>;
  if (!rows.length)
    return (
      <div>
        {searchText.trim()
          ? "Không tìm thấy chuyến phù hợp."
          : isActiveTab
            ? "Hiện không có chuyến nào đang chờ ⏳"
            : "Hiện không có chuyến nào đã huỷ."}
      </div>
    );

  return (
    <>
      <div style={{ overflowX: "auto" }}>
        <table
          style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}
        >
          <thead>
            <tr style={{ textAlign: "left" }}>
              <th style={th}>Mã chuyến</th>

              {/* ✅ show cho tab đã huỷ hoặc khi page cần */}
              {showCustomerCol && <th style={th}>Khách hàng</th>}

              <th style={th}>Điểm đón</th>
              <th style={th}>Điểm đến</th>

              {isCancelledTab ? (
                <>
                  <th style={th}>Giờ đón</th>
                  <th style={th}>Giá</th>
                  <th style={th}>Lý do huỷ</th>
                  <th style={th}>Thời gian huỷ</th>
                  <th style={th}></th>
                </>
              ) : (
                <>
                  <th style={th}>Thời gian tạo</th>
                  <th style={th}>Chờ (phút)</th>
                  <th style={th}>Cảnh báo</th>
                  <th style={th}>Trạng thái</th>
                  <th style={th}></th>
                </>
              )}
            </tr>
          </thead>

          <tbody>
            {rows.map((t) => {
              const tripId = t?.tripId || t?.id;

              const riderName = getPendingTripRiderName(t);
              const riderPhone = t?.riderPhone || pickPhone(t?.rider) || "-";

              // active tab fields
              const phutCho = layPhutCho(t);
              const choLau = phutCho >= 30;
              const alertCount = laySoLanCanhBao(t);
              const lastAlertAt = layLanCuoiCanhBao(t);
              const isHovered = hoveredTripId === tripId;

              return (
                <tr
                  key={tripId}
                  onClick={() => onSelectTrip?.(tripId)}
                  onMouseEnter={() => setHoveredTripId(tripId)}
                  onMouseLeave={() => setHoveredTripId("")}
                  style={{
                    cursor: "pointer",
                    borderTop: "1px solid #d9dee7",
                    background: isHovered ? "rgba(25, 118, 210, 0.08)" : "#fff",
                    transition: "background 0.16s ease",
                  }}
                  title="Bấm để xem chi tiết chuyến"
                >
                  <td style={tdMono}>{tripId || "-"}</td>

                  {showCustomerCol && (
                    <td style={td}>
                      <div style={{ fontWeight: 700 }}>{riderName}</div>
                      <div style={{ fontSize: 12, color: "#666" }}>
                        {riderPhone}
                      </div>
                    </td>
                  )}

                  <td style={td}>{t.pickupAddress || "-"}</td>
                  <td style={td}>{renderStopsCell(t)}</td>

                  {isCancelledTab ? (
                    <>
                      <td style={td}>{formatNgayGio(t.pickupTime)}</td>
                      <td style={tdMono}>{formatGia(t.totalPrice)}</td>
                      <td style={td}>{t.cancelReason || "-"}</td>
                      <td style={td}>{formatNgayGio(t.cancelledAt)}</td>

                      <td style={td}>
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectTrip?.(tripId);
                          }}
                        >
                          Chi tiết
                        </Button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td style={td}>{formatNgayGio(t.createdAt)}</td>

                      <td style={{ ...tdMono, color: choLau ? "crimson" : "" }}>
                        {Number.isFinite(phutCho) ? phutCho : "-"}
                      </td>

                      <td style={td}>
                        {alertCount > 0 ? (
                          <div style={{ display: "grid", gap: 4 }}>
                            <AlertCountBadge count={alertCount} />
                            <div style={{ fontSize: 12, color: "#666" }}>
                              Lần cuối: {formatNgayGio(lastAlertAt)}
                            </div>
                          </div>
                        ) : (
                          <div style={{ display: "grid", gap: 4 }}>
                            <AlertCountBadge count={0} />
                            <div style={{ fontSize: 12, color: "#999" }}>
                              Chưa có cảnh báo
                            </div>
                          </div>
                        )}
                      </td>

                      <td style={td}>{t.status || "-"}</td>

                      <td style={td}>
                        <Button
                          size="small"
                          variant="outlined"
                          color="error"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedTrip(t);
                            setOpenCancel(true);
                          }}
                        >
                          Huỷ
                        </Button>
                      </td>
                    </>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ✅ chỉ active tab mới có cancel dialog */}
      <CancelTripDialog
        open={openCancel}
        trip={selectedTrip}
        onClose={() => {
          setOpenCancel(false);
          setSelectedTrip(null);
        }}
        onCancelled={async () => {
          setOpenCancel(false);
          setSelectedTrip(null);
          await taiDuLieu();
        }}
      />
    </>
  );
}

function AlertCountBadge({ count }) {
  const hasAlert = count > 0;

  return (
    <span
      style={{
        display: "inline-block",
        width: "fit-content",
        padding: "2px 10px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 700,
        border: `1px solid ${hasAlert ? "#00a86b" : "#bbb"}`,
        background: hasAlert ? "rgba(0, 200, 120, 0.12)" : "#f5f5f5",
        color: hasAlert ? "#008f5d" : "#777",
      }}
    >
      {hasAlert ? `${count} lần` : "0 lần"}
    </span>
  );
}

const th = {
  padding: "10px 8px",
  borderBottom: "1px solid #333",
  whiteSpace: "nowrap",
};

const td = {
  padding: "10px 8px",
  verticalAlign: "top",
  maxWidth: 420,
};

const tdMono = {
  ...td,
  fontFamily:
    "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
  whiteSpace: "nowrap",
};
