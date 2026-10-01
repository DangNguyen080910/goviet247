// Path: goviet247/apps/web/src/components/admin/CancelTripDialog.jsx
import { useMemo, useState } from "react";
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, TextField, Typography, FormControl, FormLabel, RadioGroup, FormControlLabel, Radio
} from "@mui/material";
import { getAdminToken } from "../../utils/adminAuth";

export default function CancelTripDialog({ open, trip, tripId, onClose, onSuccess, onCancelled }) {
  const [reason, setReason] = useState("");
  const [origin, setOrigin] = useState("");
  const [resolution, setResolution] = useState("");
  const [err, setErr] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const id = useMemo(() => trip?.id || trip?.tripId || tripId || "", [trip, tripId]);
  const status = String(trip?.status || "").toUpperCase();
  const needsDriverSettlement = ["ACCEPTED", "CONTACTED"].includes(status);
  const canCancel = Boolean(id) && (!status || ["PENDING", "ACCEPTED", "CONTACTED"].includes(status));
  const handleClose = () => {
    setReason("");
    setOrigin("");
    setResolution("");
    setErr("");
    onClose?.();
  };

  const handleSubmit = async () => {
    try {
      setErr("");
      const r = reason.trim();
      if (!r) {
        setErr("Vui lòng nhập lý do huỷ");
        return;
      }
      if (needsDriverSettlement && !origin) {
        setErr("Vui lòng chọn bên huỷ chuyến để Sổ Sách ghi đúng.");
        return;
      }

      if (needsDriverSettlement && !resolution) {
        setErr("Vui lòng chọn cách xử lý huỷ chuyến.");
        return;
      }

      const token = getAdminToken();
      if (!token) {
        setErr("Thiếu token admin");
        return;
      }

      setSubmitting(true);

      const res = await fetch(`/api/admin/trips/${id}/cancel`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          cancel_reason: r,
          ...(needsDriverSettlement ? { cancel_origin: origin } : {}),
          ...(needsDriverSettlement && resolution === "PENALTY_AND_CANCEL"
            ? { cancel_resolution: resolution }
            : {}),
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || `HTTP ${res.status}`);

      // ✅ compat: có project đang dùng onCancelled, có chỗ dùng onSuccess
      await onCancelled?.(data);
      await onSuccess?.(data);

      handleClose();
    } catch (e) {
      setErr(e?.message || "Huỷ chuyến thất bại");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>Huỷ chuyến</DialogTitle>
      <DialogContent>
        <Typography variant="body2" sx={{ mb: 1, color: "text.secondary" }}>
          Mã chuyến: <b>{id ? String(id).slice(0, 8) + "..." : "-"}</b>
        </Typography>
        {needsDriverSettlement ? (
          <FormControl sx={{ mt: 1 }}>
            <FormLabel>Cách xử lý huỷ chuyến</FormLabel>
            <RadioGroup
              value={`${origin}:${resolution}`}
              onChange={(event) => {
                const [nextOrigin, nextResolution] = event.target.value.split(":");
                setOrigin(nextOrigin);
                setResolution(nextResolution);
              }}
            >
              <FormControlLabel
                value="CUSTOMER:REFUND_AND_CANCEL"
                control={<Radio />}
                label="Khách huỷ — tự hoàn khoản giữ vào ví tài xế"
              />
              <FormControlLabel
                value="CUSTOMER:PENALTY_AND_CANCEL"
                control={<Radio />}
                label="Khách huỷ — ghi phạt và huỷ chuyến"
              />
              <FormControlLabel
                value="DRIVER:PENALTY_AND_REVIEW"
                control={<Radio />}
                label="Tài xế huỷ — ghi phạt và đưa chuyến về Chờ duyệt tìm tài xế khác"
              />
              <FormControlLabel
                value="DRIVER:PENALTY_AND_CANCEL"
                control={<Radio />}
                label="Tài xế huỷ — ghi phạt và huỷ chuyến"
              />
            </RadioGroup>
          </FormControl>
        ) : null}
        {status === "PENDING" ? (
          <Typography variant="body2" sx={{ mt: 1, color: "text.secondary" }}>
            Chuyến đang chờ duyệt, chưa có tài xế nhận. Chỉ cần nhập lý do để huỷ chuyến.
          </Typography>
        ) : null}
        {trip?.status === "IN_PROGRESS" && (
          <Typography variant="body2" color="error" sx={{ mt: 1 }}>
            Chuyến đã bắt đầu: cần đối soát phần dịch vụ đã thực hiện, hệ thống chưa tự huỷ hoặc hoàn toàn bộ khoản giữ.
          </Typography>
        )}

        <TextField
          label="Lý do huỷ (bắt buộc)"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          fullWidth
          multiline
          minRows={3}
          sx={{ mt: 1 }}
        />

        {err ? (
          <Typography sx={{ mt: 1, color: "crimson", fontSize: 13 }}>
            {err}
          </Typography>
        ) : null}
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose} disabled={submitting}>ĐÓNG</Button>
        <Button
          variant="contained"
          color="error"
          onClick={handleSubmit}
          disabled={submitting || !canCancel}
        >
          {resolution === "PENALTY_AND_REVIEW"
            ? "GỠ TÀI XẾ, TÌM NGƯỜI KHÁC"
            : "XÁC NHẬN HUỶ CHUYẾN"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
