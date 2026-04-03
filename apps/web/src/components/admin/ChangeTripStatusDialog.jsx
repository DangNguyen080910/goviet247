// Path: goviet247/apps/web/src/components/admin/ChangeTripStatusDialog.jsx
import React, { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  TextField,
  Stack,
  Chip,
  Alert,
} from "@mui/material";

function statusLabel(s) {
  if (s === "ACCEPTED") return "CHƯA LIÊN HỆ KHÁCH";
  if (s === "CONTACTED") return "CHƯA ĐÓN KHÁCH";
  if (s === "IN_PROGRESS") return "ĐANG TRÊN HÀNH TRÌNH";
  if (s === "COMPLETED") return "ĐÃ HOÀN THÀNH";
  return s || "";
}

export default function ChangeTripStatusDialog({
  open,
  onClose,
  trip,
  fromStatus,
  toStatus,
  loading,
  error,
  onConfirm,
}) {
  const [note, setNote] = useState("");

  useEffect(() => {
    if (open) setNote("");
  }, [open]);

  const canSubmit = useMemo(() => {
    return Boolean(note.trim().length > 0) && !loading;
  }, [note, loading]);

  const title = `Xác nhận chuyển trạng thái`;

  return (
    <Dialog open={open} onClose={loading ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 800 }}>{title}</DialogTitle>

      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {error ? <Alert severity="error">{error}</Alert> : null}

          <Stack spacing={0.5}>
            <Typography variant="body2" color="text.secondary">
              Mã chuyến
            </Typography>
            <Typography sx={{ fontWeight: 700 }}>
              {trip?.id || ""}
            </Typography>
          </Stack>

          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
            <Chip label={statusLabel(fromStatus)} size="small" />
            <Typography variant="body2" color="text.secondary">
              →
            </Typography>
            <Chip label={statusLabel(toStatus)} size="small" />
          </Stack>

          <TextField
            label="Ghi chú xác nhận (bắt buộc)"
            placeholder="Ví dụ: Tài xế đã nhắn tin và chụp hình xác nhận"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            multiline
            minRows={3}
            fullWidth
            required
            error={note.trim().length === 0}
            helperText={note.trim().length === 0 ? "Vui lòng nhập ghi chú" : " "}
          />
        </Stack>
      </DialogContent>

      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose} disabled={loading} variant="outlined">
          Huỷ
        </Button>
        <Button
          onClick={() => onConfirm(note.trim())}
          disabled={!canSubmit}
          variant="contained"
        >
          Xác nhận
        </Button>
      </DialogActions>
    </Dialog>
  );
}
