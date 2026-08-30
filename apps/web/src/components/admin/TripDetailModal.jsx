// Path: goviet247/apps/web/src/components/admin/TripDetailModal.jsx
import { useEffect, useMemo, useState } from "react";
import { getAdminToken } from "../../utils/adminAuth";
import {
  manualAdjustTrip,
  normalizeDisplayAddress,
  updateAssignedTripSchedule,
} from "../../api/adminTrips";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5050";

function formatNgayGio(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("vi-VN");
}

function toDateTimeLocalValue(value) {
  if (!value) return "";

  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";

  const pad = (n) => String(n).padStart(2, "0");

  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(
    d.getDate(),
  )}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromDateTimeLocalValue(value) {
  if (!value) return "";

  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";

  return d.toISOString();
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

function formatFuelPreference(value) {
  const map = {
    ANY: "Không yêu cầu",
    ELECTRIC: "Xe điện",
    GASOLINE: "Xe xăng",
  };

  return map[value] || value || "Không yêu cầu";
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
    detail?.driverName ||
    detail?.driver?.driverProfile?.fullName ||
    detail?.driver?.displayName ||
    detail?.driverPhone ||
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
  const totalEstimated = Number(detail?.estimatedDurationMinutes || 0);
  const totalDrive = Number(detail?.totalDriveMinutes || 0);

  if (
    !Number.isFinite(totalEstimated) ||
    !Number.isFinite(totalDrive) ||
    totalEstimated < 0 ||
    totalDrive < 0
  ) {
    return 0;
  }

  return Math.max(0, totalEstimated - totalDrive);
}

export default function TripDetailModal({ open, tripId, onClose, onAdjusted }) {
  const [dangTai, setDangTai] = useState(true);
  const [loi, setLoi] = useState("");
  const [detail, setDetail] = useState(null);

  const [isEditing, setIsEditing] = useState(false);
  const [savingAdjust, setSavingAdjust] = useState(false);
  const [adjustError, setAdjustError] = useState("");
  const [adjustForm, setAdjustForm] = useState({
    pickupAddress: "",
    dropoffAddress: "",
    note: "",
    carType: "CAR_5",
    direction: "ONE_WAY",
    pickupTime: "",
    returnTime: "",
    distanceKm: "",
    fareEstimate: "",
    totalPrice: "",
    estimatedDurationMinutes: "",
    outboundDriveMinutes: "",
    returnDriveMinutes: "",
    totalDriveMinutes: "",
    verifiedNote: "",
    stops: [],
  });
  const [isEditingSchedule, setIsEditingSchedule] = useState(false);
  const [scheduleForm, setScheduleForm] = useState({ pickupTime: "", returnTime: "" });
  const [savingSchedule, setSavingSchedule] = useState(false);

  const token = useMemo(() => getAdminToken(), []);

  async function taiChiTietChuyen() {
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

      const trip = data?.trip || data?.data?.trip || data?.tripDetail || data;
      setDetail(trip);
    } catch (e) {
      setLoi(e?.message || "Tải chi tiết chuyến thất bại");
    } finally {
      setDangTai(false);
    }
  }

  useEffect(() => {
    if (!open || !tripId) return;

    setIsEditing(false);
    setIsEditingSchedule(false);
    setAdjustError("");
    taiChiTietChuyen();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, tripId, token]);

  if (!open || !tripId) return null;

  const stops = getStops(detail);
  const driverPhone = getDriverPhone(detail);
  const driverProfile = detail?.driver?.driverProfile || null;

  const driverDriveMinutes = Number(detail?.totalDriveMinutes || 0);
  const waitMinutes = getWaitMinutes(detail);
  const totalEstimatedMinutes = Number(detail?.estimatedDurationMinutes || 0);

  const canManualAdjust =
    detail?.status === "PENDING" &&
    !detail?.driverId &&
    !detail?.driver &&
    !detail?.acceptedAt &&
    !detail?.cancelledAt;
  const canEditSchedule = ["ACCEPTED", "CONTACTED"].includes(detail?.status);

  function openScheduleForm() {
    setAdjustError("");
    setScheduleForm({
      pickupTime: detail?.pickupTime || "",
      returnTime: detail?.returnTime || "",
    });
    setIsEditingSchedule(true);
  }

  async function submitSchedule() {
    try {
      setSavingSchedule(true);
      setAdjustError("");
      await updateAssignedTripSchedule(tripId, {
        pickupTime: scheduleForm.pickupTime,
        returnTime: scheduleForm.returnTime || null,
      });
      setIsEditingSchedule(false);
      await taiChiTietChuyen();
      onAdjusted?.();
    } catch (e) {
      setAdjustError(e?.message || "Cập nhật giờ đón, giờ về thất bại");
    } finally {
      setSavingSchedule(false);
    }
  }

  function openAdjustForm() {
    setAdjustError("");
    const currentDirection =
      detail?.direction || (detail?.returnTime ? "ROUND_TRIP" : "ONE_WAY");
    setAdjustForm({
      pickupAddress: detail?.pickupAddress || "",
      dropoffAddress: detail?.dropoffAddress || stops?.[stops.length - 1] || "",
      note: detail?.note || "",
      carType: detail?.carType || "CAR_5",
      direction: currentDirection,
      pickupTime: detail?.pickupTime || "",
      returnTime:
        currentDirection === "ROUND_TRIP" ? detail?.returnTime || "" : "",
      stops:
        Array.isArray(detail?.stops) && detail.stops.length > 0
          ? detail.stops
              .slice()
              .sort((a, b) => Number(a?.seq || 0) - Number(b?.seq || 0))
              .map((s, index) => ({
                id: s?.id || "",
                seq: Number(s?.seq || index + 1),
                address: s?.address || "",
              }))
          : [
              {
                id: "",
                seq: 1,
                address: detail?.dropoffAddress || "",
              },
            ],
      distanceKm: detail?.distanceKm ?? "",
      fareEstimate: detail?.fareEstimate ?? detail?.totalPrice ?? "",
      totalPrice: detail?.totalPrice ?? "",
      estimatedDurationMinutes: detail?.estimatedDurationMinutes ?? "",
      outboundDriveMinutes:
        detail?.outboundDriveMinutes ?? detail?.totalDriveMinutes ?? "",
      returnDriveMinutes: detail?.returnDriveMinutes ?? 0,
      totalDriveMinutes: detail?.totalDriveMinutes ?? "",
      verifiedNote:
        detail?.verifiedNote ||
        "Admin đã xác nhận lại địa chỉ chi tiết và giá cuối với khách.",
    });
    setIsEditing(true);
  }

  function updateAdjustField(field, value) {
    setAdjustForm((prev) => {
      if (field === "direction" && value === "ONE_WAY") {
        return {
          ...prev,
          direction: value,
          returnTime: "",
          returnDriveMinutes: "0",
        };
      }

      return {
        ...prev,
        [field]: value,
      };
    });
  }

  function updateStopAddress(index, value) {
    setAdjustForm((prev) => {
      const nextStops = Array.isArray(prev.stops) ? [...prev.stops] : [];
      nextStops[index] = {
        ...(nextStops[index] || {}),
        seq: index + 1,
        address: value,
      };

      return {
        ...prev,
        stops: nextStops,
        dropoffAddress: nextStops[nextStops.length - 1]?.address || "",
      };
    });
  }

  function addStopInput() {
    setAdjustForm((prev) => {
      const nextStops = Array.isArray(prev.stops) ? [...prev.stops] : [];
      nextStops.push({
        id: "",
        seq: nextStops.length + 1,
        address: "",
      });

      return {
        ...prev,
        stops: nextStops,
      };
    });
  }

  function removeStopInput(index) {
    setAdjustForm((prev) => {
      const nextStops = Array.isArray(prev.stops) ? [...prev.stops] : [];
      nextStops.splice(index, 1);

      const normalizedStops = nextStops.map((stop, idx) => ({
        ...stop,
        seq: idx + 1,
      }));

      return {
        ...prev,
        stops: normalizedStops,
        dropoffAddress:
          normalizedStops[normalizedStops.length - 1]?.address || "",
      };
    });
  }

  async function submitManualAdjust() {
    try {
      setSavingAdjust(true);
      setAdjustError("");

      const cleanStops = Array.isArray(adjustForm.stops)
        ? adjustForm.stops
            .map((stop, index) => ({
              id: stop?.id || "",
              seq: index + 1,
              address: String(stop?.address || "").trim(),
            }))
            .filter((stop) => stop.address)
        : [];

      const payload = {
        pickupAddress: adjustForm.pickupAddress,
        dropoffAddress:
          cleanStops[cleanStops.length - 1]?.address ||
          adjustForm.dropoffAddress,
        stops: cleanStops,
        note: String(adjustForm.note || "").trim(),
        carType: adjustForm.carType,
        direction: adjustForm.direction,
        pickupTime: adjustForm.pickupTime,
        returnTime:
          adjustForm.direction === "ROUND_TRIP" ? adjustForm.returnTime : null,
        distanceKm: Number(adjustForm.distanceKm),
        fareEstimate: Number(adjustForm.fareEstimate),
        totalPrice: Number(adjustForm.totalPrice),
        estimatedDurationMinutes: Number(adjustForm.estimatedDurationMinutes),
        outboundDriveMinutes: Number(adjustForm.outboundDriveMinutes),
        returnDriveMinutes: Number(adjustForm.returnDriveMinutes || 0),
        totalDriveMinutes: Number(adjustForm.totalDriveMinutes),
        verifiedNote: adjustForm.verifiedNote,
      };

      await manualAdjustTrip(tripId, payload);

      setIsEditing(false);
      await taiChiTietChuyen();
      onAdjusted?.();
    } catch (e) {
      setAdjustError(e?.message || "Cập nhật thông tin chuyến thất bại");
    } finally {
      setSavingAdjust(false);
    }
  }

  return (
    <div style={overlay} onClick={onClose}>
      <div style={modal} onClick={(e) => e.stopPropagation()}>
        <div style={header}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>Chi tiết chuyến</div>
            <div style={{ fontSize: 12, opacity: 0.8 }}>{tripId}</div>
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {canManualAdjust && (
              <button style={btnPrimary} onClick={openAdjustForm}>
                Cập nhật thông tin chuyến
              </button>
            )}
            {canEditSchedule && !isEditingSchedule && (
              <button style={btnPrimary} onClick={openScheduleForm}>
                Cập nhật giờ đón, giờ về
              </button>
            )}

            <button style={btn} onClick={onClose}>
              Đóng
            </button>
          </div>
        </div>

        {dangTai && <div>Đang tải…</div>}
        {loi && <div style={{ color: "crimson" }}>Lỗi: {loi}</div>}
        {adjustError && <div style={{ color: "crimson", marginBottom: 10 }}>{adjustError}</div>}

        {isEditingSchedule && (
          <div style={{ ...card, marginBottom: 14 }}>
            <div style={{ fontWeight: 700, marginBottom: 12 }}>Cập nhật lịch chuyến</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
              <label>
                Giờ đón
                <input
                  type="datetime-local"
                  style={{ ...inputStyle, marginTop: 6 }}
                  value={toDateTimeLocalValue(scheduleForm.pickupTime)}
                  onChange={(e) => setScheduleForm((prev) => ({
                    ...prev,
                    pickupTime: fromDateTimeLocalValue(e.target.value),
                  }))}
                />
              </label>
              {detail?.direction === "ROUND_TRIP" && (
                <label>
                  Giờ về
                  <input
                    type="datetime-local"
                    style={{ ...inputStyle, marginTop: 6 }}
                    value={toDateTimeLocalValue(scheduleForm.returnTime)}
                    onChange={(e) => setScheduleForm((prev) => ({
                      ...prev,
                      returnTime: fromDateTimeLocalValue(e.target.value),
                    }))}
                  />
                </label>
              )}
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <button style={btnPrimary} onClick={submitSchedule} disabled={savingSchedule}>
                {savingSchedule ? "Đang lưu…" : "Lưu giờ mới"}
              </button>
              <button style={btn} onClick={() => setIsEditingSchedule(false)} disabled={savingSchedule}>
                Huỷ
              </button>
            </div>
          </div>
        )}

        {!dangTai && !loi && (
          <>
            {isEditing && (
              <Section title="Cập nhật thông tin chuyến">
                <div style={{ display: "grid", gap: 10 }}>
                  {adjustError && (
                    <div style={{ color: "#ff7676" }}>{adjustError}</div>
                  )}

                  <FormSelect
                    label="Loại xe"
                    value={adjustForm.carType}
                    onChange={(v) => updateAdjustField("carType", v)}
                    options={[
                      { label: "Xe 5 chỗ", value: "CAR_5" },
                      { label: "Xe 7 chỗ", value: "CAR_7" },
                      { label: "Xe 16 chỗ", value: "CAR_16" },
                    ]}
                  />

                  <FormSelect
                    label="Loại chuyến"
                    value={adjustForm.direction}
                    onChange={(v) => updateAdjustField("direction", v)}
                    options={[
                      { label: "Một chiều", value: "ONE_WAY" },
                      { label: "Khứ hồi", value: "ROUND_TRIP" },
                    ]}
                  />

                  <FormInput
                    label="Giờ đón"
                    type="datetime-local"
                    value={toDateTimeLocalValue(adjustForm.pickupTime)}
                    onChange={(v) =>
                      updateAdjustField("pickupTime", fromDateTimeLocalValue(v))
                    }
                  />

                  {adjustForm.direction === "ROUND_TRIP" && (
                    <FormInput
                      label="Giờ về"
                      type="datetime-local"
                      value={toDateTimeLocalValue(adjustForm.returnTime)}
                      onChange={(v) =>
                        updateAdjustField(
                          "returnTime",
                          fromDateTimeLocalValue(v),
                        )
                      }
                    />
                  )}

                  <FormInput
                    label="Điểm đón"
                    value={adjustForm.pickupAddress}
                    onChange={(v) => updateAdjustField("pickupAddress", v)}
                  />

                  <div style={{ display: "grid", gap: 8 }}>
                    <div
                      style={{ fontSize: 13, opacity: 0.82, fontWeight: 700 }}
                    >
                      Các điểm đến
                    </div>

                    {(Array.isArray(adjustForm.stops)
                      ? adjustForm.stops
                      : []
                    ).map((stop, index) => (
                      <div
                        key={`${stop?.id || "new"}-${index}`}
                        style={{
                          display: "grid",
                          gridTemplateColumns: "1fr auto",
                          gap: 8,
                          alignItems: "end",
                        }}
                      >
                        <FormInput
                          label={`Điểm đến ${index + 1}`}
                          value={stop?.address || ""}
                          onChange={(v) => updateStopAddress(index, v)}
                        />

                        {(adjustForm.stops || []).length > 1 && (
                          <button
                            type="button"
                            style={btnDanger}
                            onClick={() => removeStopInput(index)}
                          >
                            Xoá
                          </button>
                        )}
                      </div>
                    ))}

                    <div>
                      <button type="button" style={btn} onClick={addStopInput}>
                        + Thêm điểm đến
                      </button>
                    </div>
                  </div>

                  <FormInput
                    label="Ghi chú của khách hàng"
                    value={adjustForm.note}
                    onChange={(v) => updateAdjustField("note", v)}
                    multiline
                  />

                  <FormInput
                    label="Số km"
                    type="number"
                    value={adjustForm.distanceKm}
                    onChange={(v) => updateAdjustField("distanceKm", v)}
                  />

                  <FormInput
                    label="Giá ước tính"
                    type="number"
                    value={adjustForm.fareEstimate}
                    onChange={(v) => updateAdjustField("fareEstimate", v)}
                  />

                  <FormInput
                    label="Giá cuối"
                    type="number"
                    value={adjustForm.totalPrice}
                    onChange={(v) => updateAdjustField("totalPrice", v)}
                  />

                  <FormInput
                    label="Tổng thời gian dự kiến (phút)"
                    type="number"
                    value={adjustForm.estimatedDurationMinutes}
                    onChange={(v) =>
                      updateAdjustField("estimatedDurationMinutes", v)
                    }
                  />

                  <FormInput
                    label="Thời gian lái chiều đi (phút)"
                    type="number"
                    value={adjustForm.outboundDriveMinutes}
                    onChange={(v) =>
                      updateAdjustField("outboundDriveMinutes", v)
                    }
                  />

                  <FormInput
                    label="Thời gian chiều về (phút)"
                    type="number"
                    value={adjustForm.returnDriveMinutes}
                    onChange={(v) => updateAdjustField("returnDriveMinutes", v)}
                  />

                  <FormInput
                    label="Tổng thời gian lái xe (phút)"
                    type="number"
                    value={adjustForm.totalDriveMinutes}
                    onChange={(v) => updateAdjustField("totalDriveMinutes", v)}
                  />

                  <FormInput
                    label="Ghi chú xác nhận nội bộ"
                    value={adjustForm.verifiedNote}
                    onChange={(v) => updateAdjustField("verifiedNote", v)}
                    multiline
                  />

                  <div
                    style={{
                      display: "flex",
                      gap: 8,
                      justifyContent: "flex-end",
                    }}
                  >
                    <button
                      style={btn}
                      disabled={savingAdjust}
                      onClick={() => {
                        setIsEditing(false);
                        setAdjustError("");
                      }}
                    >
                      Huỷ chỉnh
                    </button>

                    <button
                      style={btnPrimary}
                      disabled={savingAdjust}
                      onClick={submitManualAdjust}
                    >
                      {savingAdjust ? "Đang lưu..." : "Lưu cập nhật"}
                    </button>
                  </div>
                </div>
              </Section>
            )}
            <Section title="Thông tin chuyến">
              <KV k="Trạng thái" v={formatTripStatus(detail?.status)} />
              <KV k="Thời gian tạo" v={formatNgayGio(detail?.createdAt)} />
              <KV k="Giờ đón" v={formatNgayGio(detail?.pickupTime)} highlight />
              <KV
                k="Giờ về (Khứ hồi)"
                v={detail?.returnTime ? formatNgayGio(detail.returnTime) : "-"}
                highlight
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
                k="Loại nhiên liệu"
                v={formatFuelPreference(detail?.fuelPreference)}
              />
              <KV
                k="Loại chuyến"
                v={detail?.direction === "ROUND_TRIP" ? "Khứ hồi" : "Một chiều"}
              />
              <KV
                k="Điểm đón"
                v={normalizeDisplayAddress(detail?.pickupAddress)}
                highlight
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

            <Section title="Các điểm đến" highlight>
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

            <Section title="Ghi chú" highlight>
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

function Section({ title, children, highlight = false }) {
  return (
    <div style={{ marginTop: 14 }}>
      <div style={sectionTitle}>{title}</div>
      <div style={highlight ? { ...card, ...highlightCard } : card}>{children}</div>
    </div>
  );
}

function FormInput({
  label,
  value,
  onChange,
  type = "text",
  multiline = false,
}) {
  return (
    <label style={{ display: "grid", gap: 6 }}>
      <span style={{ fontSize: 13, opacity: 0.82, fontWeight: 700 }}>
        {label}
      </span>

      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          style={inputStyle}
        />
      ) : (
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={inputStyle}
        />
      )}
    </label>
  );
}

function FormSelect({ label, value, onChange, options = [] }) {
  return (
    <label style={{ display: "grid", gap: 6 }}>
      <span style={{ fontSize: 13, opacity: 0.82, fontWeight: 700 }}>
        {label}
      </span>

      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={inputStyle}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function KV({ k, v, highlight = false }) {
  return (
    <div style={highlight ? { ...row, ...highlightRow } : row}>
      <div style={{ opacity: 0.82, width: 130, fontWeight: highlight ? 800 : 400 }}>{k}</div>
      <div style={{ flex: 1, fontWeight: highlight ? 700 : 400 }}>{v || "-"}</div>
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

const btnPrimary = {
  padding: "8px 12px",
  borderRadius: 10,
  border: "1px solid rgba(255,122,24,0.75)",
  background: "rgba(255,122,24,0.18)",
  color: "#fff",
  cursor: "pointer",
  fontWeight: 800,
};

const btnDanger = {
  padding: "8px 12px",
  borderRadius: 10,
  border: "1px solid rgba(255,90,90,0.75)",
  background: "rgba(255,90,90,0.12)",
  color: "#fff",
  cursor: "pointer",
  fontWeight: 800,
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

const highlightCard = {
  border: "1px solid #f3c969",
  background: "rgba(255, 224, 130, 0.14)",
  boxShadow: "inset 3px 0 0 #f2b632",
};

const row = {
  display: "flex",
  gap: 12,
  padding: "8px 0",
  borderBottom: "1px dashed rgba(255,255,255,0.12)",
};

const highlightRow = {
  margin: "4px 0",
  padding: "10px 12px",
  border: "1px solid #f3c969",
  borderRadius: 10,
  background: "rgba(255, 224, 130, 0.14)",
  boxShadow: "inset 3px 0 0 #f2b632",
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

const inputStyle = {
  width: "100%",
  boxSizing: "border-box",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.18)",
  background: "rgba(255,255,255,0.06)",
  color: "#fff",
  padding: "10px 12px",
  outline: "none",
};
