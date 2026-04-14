// Path: goviet247/apps/web/src/pages/admin/AdminTrips.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Box,
  Typography,
  CircularProgress,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Button,
  Stack,
  Snackbar,
  Alert,
  Tabs,
  Tab,
  TextField,
} from "@mui/material";

import TripDetailModal from "../../components/admin/TripDetailModal";
import CancelTripDialog from "../../components/admin/CancelTripDialog";

import {
  fetchUnverifiedTrips,
  verifyTrip,
  normalizeDisplayAddress,
} from "../../api/adminTrips";
import { getAdminToken } from "../../utils/adminAuth";

function formatNgayGio(input) {
  if (!input) return "-";
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return String(input);
  return d.toLocaleString("vi-VN");
}

function formatGia(v) {
  if (v == null) return "-";
  const num = Number(v);
  if (!Number.isFinite(num)) return String(v);
  return num.toLocaleString("vi-VN");
}

/**
 * Lấy stops đúng thứ tự order
 */
function getStopsFromTrip(t) {
  const stops = Array.isArray(t?.stops) ? t.stops : [];

  const sorted = stops
    .slice()
    .sort(
      (a, b) =>
        Number(a?.order ?? a?.seq ?? 0) - Number(b?.order ?? b?.seq ?? 0),
    );

  const list = sorted
    .map((s) => normalizeDisplayAddress(s?.address))
    .filter((x) => typeof x === "string" && x.trim().length > 0);

  if (list.length === 0 && t?.dropoffAddress) {
    return [normalizeDisplayAddress(t.dropoffAddress)];
  }

  return list;
}

// GET /api/admin/trips/unverified-cancelled
async function fetchUnverifiedCancelledTrips() {
  const token = getAdminToken();
  if (!token) throw new Error("Thiếu token admin");

  const res = await fetch("/api/admin/trips/unverified-cancelled", {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message || `HTTP ${res.status}`);

  return Array.isArray(data?.items) ? data.items : [];
}

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .trim();
}

export default function AdminTrips() {
  const [tab, setTab] = useState(0);

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);

  const [selectedTripId, setSelectedTripId] = useState("");
  const [cancelTripId, setCancelTripId] = useState("");
  const [searchText, setSearchText] = useState("");

  const [toast, setToast] = useState({
    open: false,
    severity: "success",
    message: "",
  });

  const loadRef = useRef(null);

  async function load() {
    setLoading(true);

    try {
      if (tab === 0) {
        const data = await fetchUnverifiedTrips();
        setItems(Array.isArray(data) ? data : []);
      } else {
        const data = await fetchUnverifiedCancelledTrips();
        setItems(Array.isArray(data) ? data : []);
      }
    } catch (e) {
      setToast({
        open: true,
        severity: "error",
        message: e.message || "Không tải được danh sách chuyến.",
      });
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadRef.current = load;
  }, [tab]);

  useEffect(() => {
    load();
  }, [tab]);

  // realtime admin:new_trip
  useEffect(() => {
    const onNewTrip = () => {
      if (tab === 0) loadRef.current?.();
    };

    window.addEventListener("admin:new_trip", onNewTrip);
    return () => window.removeEventListener("admin:new_trip", onNewTrip);
  }, [tab]);

  const onVerify = async (tripId) => {
    try {
      await verifyTrip(tripId, "Đã duyệt lộ trình/giá");

      setToast({
        open: true,
        severity: "success",
        message: "Đã duyệt chuyến.",
      });

      await load();
    } catch (e) {
      setToast({
        open: true,
        severity: "error",
        message: e.message || "Duyệt chuyến thất bại.",
      });
    }
  };

  const rows = useMemo(() => {
    const q = normalizeText(searchText);
    const baseRows = Array.isArray(items) ? items : [];

    if (!q) return baseRows;

    return baseRows.filter((t) => {
      const riderName = normalizeText(t?.riderName);
      const riderPhone = normalizeText(t?.riderPhone);
      const tripId = normalizeText(t?.id);

      return (
        tripId.includes(q) || riderName.includes(q) || riderPhone.includes(q)
      );
    });
  }, [items, searchText]);

  return (
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 800, mb: 1 }}>
        Chuyến (Chờ Duyệt)
      </Typography>

      <Typography variant="body2" sx={{ color: "text.secondary", mb: 2 }}>
        {tab === 0
          ? "Các chuyến PENDING chưa duyệt. Duyệt xong thì chuyến sẽ sang “Chuyến Chưa Có Tài Xế”."
          : "Danh sách chuyến chờ duyệt đã huỷ."}
      </Typography>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab label="Chờ duyệt" />
        <Tab label="Đã huỷ" />
      </Tabs>

      <TextField
        fullWidth
        size="small"
        label="Tìm kiếm"
        placeholder="Nhập mã chuyến, tên khách, số điện thoại..."
        value={searchText}
        onChange={(e) => setSearchText(e.target.value)}
        sx={{ mb: 2, maxWidth: 520 }}
      />

      {loading ? (
        <Stack direction="row" alignItems="center" gap={2} sx={{ py: 3 }}>
          <CircularProgress size={22} />
          <Typography>Đang tải...</Typography>
        </Stack>
      ) : (
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 700 }}>Mã chuyến</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Khách hàng</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Điểm đón</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Điểm đến</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Giờ đón</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Giờ về (Khứ hồi)</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Giá</TableCell>

              {tab === 1 && (
                <>
                  <TableCell sx={{ fontWeight: 700 }}>Lý do huỷ</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Thời gian huỷ</TableCell>
                </>
              )}

              <TableCell align="right" sx={{ fontWeight: 700 }}>
                Hành động
              </TableCell>
            </TableRow>
          </TableHead>

          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={tab === 0 ? 8 : 10}
                  sx={{ py: 4, color: "text.secondary" }}
                >
                  {searchText.trim()
                    ? "Không tìm thấy chuyến phù hợp."
                    : tab === 0
                      ? "Hiện chưa có chuyến nào chờ duyệt."
                      : "Hiện chưa có chuyến nào đã huỷ."}
                </TableCell>
              </TableRow>
            ) : (
              rows.map((t) => {
                const stops = getStopsFromTrip(t);

                return (
                  <TableRow
                    key={t.id}
                    hover
                    onClick={() => setSelectedTripId(t.id)}
                    sx={{ cursor: "pointer" }}
                  >
                    <TableCell
                      sx={{
                        fontFamily:
                          "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {t.id || "-"}
                    </TableCell>

                    <TableCell>
                      <div style={{ fontWeight: 600 }}>
                        {t.riderName || "-"}
                      </div>
                      <div style={{ fontSize: 12, color: "#666" }}>
                        {t.riderPhone || "-"}
                      </div>
                    </TableCell>

                    <TableCell>
                      {normalizeDisplayAddress(t.pickupAddress) || "-"}
                    </TableCell>

                    <TableCell>
                      {stops.length <= 1 ? (
                        <div>{stops[0] || "-"}</div>
                      ) : (
                        <ul style={{ margin: 0, paddingLeft: 18 }}>
                          {stops.map((addr, idx) => (
                            <li key={`${t.id}-stop-${idx}`}>{addr}</li>
                          ))}
                        </ul>
                      )}
                    </TableCell>

                    <TableCell>
                      {t.pickupTime ? formatNgayGio(t.pickupTime) : "-"}
                    </TableCell>

                    <TableCell>
                      {t.returnTime ? formatNgayGio(t.returnTime) : "-"}
                    </TableCell>

                    <TableCell>{formatGia(t.totalPrice)}</TableCell>

                    {tab === 1 && (
                      <>
                        <TableCell>{t.cancelReason || "-"}</TableCell>
                        <TableCell>{formatNgayGio(t.cancelledAt)}</TableCell>
                      </>
                    )}

                    <TableCell align="right">
                      {tab === 0 ? (
                        <Stack
                          direction="row"
                          justifyContent="flex-end"
                          gap={1}
                        >
                          <Button
                            size="small"
                            variant="outlined"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedTripId(t.id);
                            }}
                          >
                            Chi tiết
                          </Button>

                          <Button
                            size="small"
                            variant="contained"
                            onClick={(e) => {
                              e.stopPropagation();
                              onVerify(t.id);
                            }}
                          >
                            Duyệt
                          </Button>

                          <Button
                            size="small"
                            color="error"
                            variant="outlined"
                            onClick={(e) => {
                              e.stopPropagation();
                              setCancelTripId(t.id);
                            }}
                          >
                            Huỷ
                          </Button>
                        </Stack>
                      ) : (
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedTripId(t.id);
                          }}
                        >
                          Chi tiết
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      )}

      <TripDetailModal
        open={!!selectedTripId}
        tripId={selectedTripId}
        onClose={() => setSelectedTripId("")}
      />

      <CancelTripDialog
        open={!!cancelTripId}
        tripId={cancelTripId}
        onClose={() => setCancelTripId("")}
        onSuccess={() => {
          setCancelTripId("");
          load();
        }}
      />

      <Snackbar
        open={toast.open}
        autoHideDuration={2200}
        onClose={() => setToast({ ...toast, open: false })}
      >
        <Alert
          severity={toast.severity}
          onClose={() => setToast({ ...toast, open: false })}
          sx={{ width: "100%" }}
        >
          {toast.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
