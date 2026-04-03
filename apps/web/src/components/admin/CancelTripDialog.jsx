// Path: goviet247/apps/web/src/components/admin/CancelTripDialog.jsx
import { useMemo, useState } from "react";
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, TextField, Typography
} from "@mui/material";
import { getAdminToken } from "../../utils/adminAuth";

export default function CancelTripDialog({ open, trip, tripId, onClose, onSuccess, onCancelled }) {
  const [reason, setReason] = useState("");
  const [err, setErr] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const id = useMemo(() => trip?.id || trip?.tripId || tripId || "", [trip, tripId]);

  const handleSubmit = async () => {
    try {
      setErr("");
      const r = reason.trim();
      if (!r) {
        setErr("Vui lòng nhập lý do huỷ");
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
        body: JSON.stringify({ cancel_reason: r }), // ✅ đúng key BE
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || `HTTP ${res.status}`);

      // ✅ compat: có project đang dùng onCancelled, có chỗ dùng onSuccess
      await onCancelled?.(data);
      await onSuccess?.(data);

      setReason("");
      onClose?.();
    } catch (e) {
      setErr(e?.message || "Huỷ chuyến thất bại");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Huỷ chuyến</DialogTitle>
      <DialogContent>
        <Typography variant="body2" sx={{ mb: 1, color: "text.secondary" }}>
          Mã chuyến: <b>{id ? String(id).slice(0, 8) + "..." : "-"}</b>
        </Typography>

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
        <Button onClick={onClose} disabled={submitting}>ĐÓNG</Button>
        <Button
          variant="contained"
          color="error"
          onClick={handleSubmit}
          disabled={submitting}
        >
          XÁC NHẬN HUỶ
        </Button>
      </DialogActions>
    </Dialog>
  );
}