// Path: goviet247/apps/web/src/components/admin/DriverActionDialog.jsx
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Typography,
} from "@mui/material";
import { useEffect, useState } from "react";

export default function DriverActionDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  requireReason = false,
  confirmText = "Xác nhận",
  // ✅ NEW: hiện lỗi đỏ kiểu "Không có quyền admin"
  errorText = "",
}) {
  const [reason, setReason] = useState("");
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (open) {
      setReason("");
      setTouched(false);
    }
  }, [open]);

  const reasonTrim = reason.trim();
  const hasReasonError = requireReason && touched && !reasonTrim;

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ fontWeight: 900 }}>{title}</DialogTitle>

      <DialogContent>
        {description && (
          <Typography variant="body2" sx={{ mb: 2 }}>
            {description}
          </Typography>
        )}

        <TextField
          label="Lý do"
          placeholder="Nhập lý do..."
          fullWidth
          multiline
          minRows={3}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          onBlur={() => setTouched(true)}
          error={hasReasonError}
          helperText={hasReasonError ? "Vui lòng nhập lý do (bắt buộc)." : " "}
        />

        {!!errorText && (
          <Typography sx={{ color: "error.main", fontWeight: 800, mt: 0.5 }}>
            {errorText}
          </Typography>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Huỷ</Button>
        <Button
          variant="contained"
          onClick={() => {
            setTouched(true);
            if (requireReason && !reasonTrim) return;
            onConfirm(reasonTrim);
          }}
          sx={{ fontWeight: 900 }}
        >
          {confirmText}
        </Button>
      </DialogActions>
    </Dialog>
  );
}