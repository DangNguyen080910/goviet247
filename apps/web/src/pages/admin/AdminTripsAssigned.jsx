// Path: goviet247/apps/web/src/pages/admin/AdminTripsAssigned.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Box,
  Paper,
  Tabs,
  Tab,
  Typography,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Chip,
  Button,
  Stack,
  Divider,
  CircularProgress,
  Alert,
  Snackbar,
  TextField,
} from "@mui/material";

import {
  fetchAssignedTrips,
  changeAssignedTripStatus,
  normalizeDisplayAddress,
} from "../../api/adminTrips";
import ChangeTripStatusDialog from "../../components/admin/ChangeTripStatusDialog";
import CancelTripDialog from "../../components/admin/CancelTripDialog";
import TripDetailModal from "../../components/admin/TripDetailModal";

const TABS = [
  { label: "Chưa liên hệ khách", value: "ACCEPTED" },
  { label: "Chưa đón khách", value: "CONTACTED" },
  { label: "Đang trên hành trình", value: "IN_PROGRESS" },
  { label: "Đã hoàn thành", value: "COMPLETED" },
  { label: "Đã huỷ", value: "CANCELLED" },
];

function statusChip(status) {
  if (status === "ACCEPTED") {
    return <Chip label="ACCEPTED" size="small" />;
  }

  if (status === "CONTACTED") {
    return <Chip label="CONTACTED" size="small" color="info" />;
  }

  if (status === "IN_PROGRESS") {
    return <Chip label="IN_PROGRESS" size="small" />;
  }

  if (status === "CANCELLED") {
    return <Chip label="CANCELLED" size="small" color="error" />;
  }

  return <Chip label="COMPLETED" size="small" />;
}

function pickPhone(user) {
  const p = user?.phones?.[0]?.e164;
  return p || "";
}

function getStopsFromTrip(trip) {
  const stops = Array.isArray(trip?.stops) ? trip.stops : [];

  const list = stops
    .slice()
    .sort(
      (a, b) =>
        Number(a?.seq ?? a?.order ?? 0) - Number(b?.seq ?? b?.order ?? 0),
    )
    .map((s) => normalizeDisplayAddress(s?.address))
    .filter((x) => typeof x === "string" && x.trim().length > 0);

  if (list.length === 0 && trip?.dropoffAddress) {
    return [normalizeDisplayAddress(trip.dropoffAddress)];
  }

  return list;
}

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .trim();
}

function getAssignedTripRiderName(trip) {
  return (
    trip?.riderName ||
    trip?.rider?.riderProfile?.fullName ||
    trip?.rider?.displayName ||
    pickPhone(trip?.rider) ||
    "Khách"
  );
}

function getAssignedTripDriverName(trip) {
  return (
    trip?.driver?.driverProfile?.fullName ||
    trip?.driver?.displayName ||
    pickPhone(trip?.driver) ||
    "Tài xế"
  );
}

export default function AdminTripsAssigned() {
  const [tab, setTab] = useState("ACCEPTED");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [trips, setTrips] = useState([]);
  const [searchText, setSearchText] = useState("");

  // Dialog change-status
  const [dlgOpen, setDlgOpen] = useState(false);
  const [dlgTrip, setDlgTrip] = useState(null);
  const [dlgFrom, setDlgFrom] = useState("");
  const [dlgTo, setDlgTo] = useState("");
  const [dlgLoading, setDlgLoading] = useState(false);
  const [dlgError, setDlgError] = useState("");

  // Dialog cancel
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelTrip, setCancelTrip] = useState(null);

  // Modal chi tiết
  const [selectedTripId, setSelectedTripId] = useState("");

  // Toast
  const [toastOpen, setToastOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState("");

  const reloadRef = useRef(null);

  const emptyText =
    tab === "ACCEPTED"
      ? "Không có chuyến nào ở trạng thái CHƯA LIÊN HỆ KHÁCH."
      : tab === "CONTACTED"
        ? "Không có chuyến nào ở trạng thái CHƯA ĐÓN KHÁCH."
        : tab === "IN_PROGRESS"
          ? "Không có chuyến nào ở trạng thái ĐANG TRÊN HÀNH TRÌNH."
          : tab === "COMPLETED"
            ? "Không có chuyến nào ở trạng thái ĐÃ HOÀN THÀNH."
            : "Không có chuyến nào ở trạng thái ĐÃ HUỶ.";

  async function reload() {
    setError("");
    setLoading(true);
    try {
      const items = await fetchAssignedTrips(tab);
      setTrips(items);
    } catch (e) {
      setTrips([]);
      setError(e?.message || "Lỗi khi tải dữ liệu");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    reloadRef.current = reload;
  }, [tab]);

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  useEffect(() => {
    const handleRealtime = () => {
      reloadRef.current?.();
    };

    window.addEventListener("admin:trip_accepted", handleRealtime);
    window.addEventListener("admin:trip_status_changed", handleRealtime);
    window.addEventListener("admin:trip_cancelled", handleRealtime);

    return () => {
      window.removeEventListener("admin:trip_accepted", handleRealtime);
      window.removeEventListener("admin:trip_status_changed", handleRealtime);
      window.removeEventListener("admin:trip_cancelled", handleRealtime);
    };
  }, []);

  const openConfirm = (trip, toStatus) => {
    setDlgTrip(trip);
    setDlgFrom(trip?.status || "");
    setDlgTo(toStatus);
    setDlgError("");
    setDlgOpen(true);
  };

  const closeConfirm = () => {
    if (dlgLoading) return;
    setDlgOpen(false);
    setDlgTrip(null);
    setDlgFrom("");
    setDlgTo("");
    setDlgError("");
  };

  const handleConfirm = async (note) => {
    try {
      setDlgError("");
      setDlgLoading(true);

      await changeAssignedTripStatus(dlgTrip.id, dlgTo, note);

      setDlgOpen(false);
      setToastMsg("Đã chuyển trạng thái thành công");
      setToastOpen(true);

      await reload();
    } catch (e) {
      setDlgError(e?.message || "Lỗi server");
    } finally {
      setDlgLoading(false);
    }
  };

  const openCancel = (trip) => {
    setCancelTrip(trip);
    setCancelOpen(true);
  };

  const closeCancel = () => {
    setCancelOpen(false);
    setCancelTrip(null);
  };

  const onCancelled = async () => {
    setToastMsg("Đã huỷ chuyến");
    setToastOpen(true);
    await reload();
  };

  const rows = useMemo(() => {
    const baseRows = Array.isArray(trips) ? trips : [];
    const q = normalizeText(searchText);

    if (!q) return baseRows;

    return baseRows.filter((t) => {
      const riderName = normalizeText(getAssignedTripRiderName(t));
      const riderPhone = normalizeText(pickPhone(t?.rider) || t?.riderPhone);
      const driverName = normalizeText(getAssignedTripDriverName(t));
      const driverPhone = normalizeText(pickPhone(t?.driver));
      const tripId = normalizeText(t?.id);

      return (
        tripId.includes(q) ||
        riderName.includes(q) ||
        riderPhone.includes(q) ||
        driverName.includes(q) ||
        driverPhone.includes(q)
      );
    });
  }, [trips, searchText]);

  return (
    <Box sx={{ p: 2 }}>
      <Stack spacing={1} sx={{ mb: 2 }}>
        <Typography variant="h5" sx={{ fontWeight: 700 }}>
          Chuyến Tài Xế Đã Nhận
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Quản lý các chuyến theo trạng thái: ACCEPTED → CONTACTED → IN_PROGRESS
          → COMPLETED (và CANCELLED)
        </Typography>
      </Stack>

      <Paper sx={{ borderRadius: 2, overflow: "hidden" }}>
        <Box sx={{ px: 2, pt: 1 }}>
          <Tabs
            value={tab}
            onChange={(_, v) => setTab(v)}
            variant="scrollable"
            scrollButtons="auto"
          >
            {TABS.map((t) => (
              <Tab key={t.value} value={t.value} label={t.label} />
            ))}
          </Tabs>
        </Box>

        <Divider />

        <Box sx={{ p: 2 }}>
          <TextField
            fullWidth
            size="small"
            label="Tìm kiếm"
            placeholder="Nhập mã chuyến, khách, tài xế, số điện thoại..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            sx={{ mb: 2, maxWidth: 560 }}
          />

          {error ? (
            <Alert severity="error" sx={{ borderRadius: 2, mb: 2 }}>
              {error}
            </Alert>
          ) : null}

          {loading ? (
            <Paper
              variant="outlined"
              sx={{
                p: 3,
                borderRadius: 2,
                display: "flex",
                alignItems: "center",
                gap: 2,
              }}
            >
              <CircularProgress size={22} />
              <Typography>Đang tải dữ liệu...</Typography>
            </Paper>
          ) : rows.length === 0 ? (
            <Paper
              variant="outlined"
              sx={{
                p: 3,
                borderRadius: 2,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 2,
              }}
            >
              <Box>
                <Typography sx={{ fontWeight: 700 }}>
                  Danh sách trống 😴
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {searchText.trim()
                    ? "Không tìm thấy chuyến phù hợp."
                    : emptyText}
                </Typography>
              </Box>
            </Paper>
          ) : (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700 }}>Mã chuyến</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Khách hàng</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Tài xế</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>
                    Điểm đón → Điểm đến
                  </TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Cập nhật</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Trạng thái</TableCell>
                  <TableCell sx={{ fontWeight: 700, width: 320 }}>
                    Hành động
                  </TableCell>
                </TableRow>
              </TableHead>

              <TableBody>
                {rows.map((t) => {
                  const riderName = getAssignedTripRiderName(t);
                  const riderPhone = pickPhone(t?.rider) || t?.riderPhone || "";
                  const driverName = getAssignedTripDriverName(t);
                  const driverPhone = pickPhone(t?.driver) || "";
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
                          fontWeight: 700,
                        }}
                      >
                        {t.id || "-"}
                      </TableCell>

                      <TableCell>
                        <Typography sx={{ fontWeight: 600 }}>
                          {riderName}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {riderPhone || "-"}
                        </Typography>
                      </TableCell>

                      <TableCell>
                        <Typography sx={{ fontWeight: 600 }}>
                          {driverName}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {driverPhone || "-"}
                        </Typography>
                      </TableCell>

                      <TableCell>
                        <Typography sx={{ fontWeight: 600 }}>
                          {normalizeDisplayAddress(t.pickupAddress) || "-"}
                        </Typography>

                        {stops.length ? (
                          <Box sx={{ mt: 0.5 }}>
                            {stops.map((addr, idx) => (
                              <Typography
                                key={`${t.id}-stop-${idx}`}
                                variant="body2"
                                color="text.secondary"
                                sx={{ lineHeight: 1.5 }}
                              >
                                • {addr}
                              </Typography>
                            ))}
                          </Box>
                        ) : (
                          <Typography variant="body2" color="text.secondary">
                            -
                          </Typography>
                        )}
                      </TableCell>

                      <TableCell>
                        <Typography variant="body2">
                          {t.updatedAt
                            ? new Date(t.updatedAt).toLocaleString("vi-VN")
                            : ""}
                        </Typography>
                      </TableCell>

                      <TableCell>{statusChip(t.status)}</TableCell>

                      <TableCell>
                        {tab === "CANCELLED" || t.status === "CANCELLED" ? (
                          <Box>
                            <Typography
                              variant="body2"
                              sx={{ fontWeight: 600 }}
                            >
                              Lý do:
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              {t.cancelReason || "(Không có)"}
                            </Typography>
                          </Box>
                        ) : (
                          <Stack
                            direction="row"
                            spacing={1}
                            alignItems="center"
                            flexWrap="wrap"
                          >
                            {t.status === "ACCEPTED" && (
                              <Button
                                variant="contained"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openConfirm(t, "CONTACTED");
                                }}
                              >
                                Chuyển qua “Chưa đón khách”
                              </Button>
                            )}

                            {t.status === "CONTACTED" && (
                              <Button
                                variant="contained"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openConfirm(t, "IN_PROGRESS");
                                }}
                              >
                                Chuyển sang “Đang trên hành trình”
                              </Button>
                            )}

                            {t.status === "IN_PROGRESS" && (
                              <Button
                                variant="contained"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openConfirm(t, "COMPLETED");
                                }}
                              >
                                Chuyển sang “Đã hoàn thành”
                              </Button>
                            )}

                            {t.status === "COMPLETED" && (
                              <Typography
                                variant="body2"
                                color="text.secondary"
                              >
                                Không có hành động
                              </Typography>
                            )}

                            <Button
                              variant="outlined"
                              color="error"
                              onClick={(e) => {
                                e.stopPropagation();
                                openCancel(t);
                              }}
                            >
                              HUỶ
                            </Button>
                          </Stack>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </Box>
      </Paper>

      <TripDetailModal
        open={!!selectedTripId}
        tripId={selectedTripId}
        onClose={() => setSelectedTripId("")}
      />

      <ChangeTripStatusDialog
        open={dlgOpen}
        onClose={closeConfirm}
        trip={dlgTrip}
        fromStatus={dlgFrom}
        toStatus={dlgTo}
        loading={dlgLoading}
        error={dlgError}
        onConfirm={handleConfirm}
      />

      <CancelTripDialog
        open={cancelOpen}
        trip={cancelTrip}
        onClose={closeCancel}
        onCancelled={onCancelled}
        onSuccess={onCancelled}
      />

      <Snackbar
        open={toastOpen}
        autoHideDuration={2500}
        onClose={() => setToastOpen(false)}
        message={toastMsg}
      />
    </Box>
  );
}
