// Path: goviet247/apps/web/src/pages/customer/CustomerAuth.jsx
import { useEffect, useMemo, useState } from "react";
import {
  Container,
  Paper,
  Stack,
  Typography,
  TextField,
  Button,
  Alert,
  CircularProgress,
} from "@mui/material";
import { useNavigate } from "react-router-dom";

import { requestOtp, verifyOtp, getMe } from "../../api/auth";
import { useCustomerAuth } from "../../context/CustomerAuthContext";

function formatOtpCountdown(ms) {
  const safeMs = Math.max(0, Number(ms || 0));
  const totalSeconds = Math.floor(safeMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export default function CustomerAuth({ mode = "login" }) {
  const navigate = useNavigate();
  const { login, user, loading: authLoading } = useCustomerAuth();

  const [phone, setPhone] = useState("");
  const [sessionId, setSessionId] = useState(null);
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [otpExpiresAt, setOtpExpiresAt] = useState(null);
  const [nowTs, setNowTs] = useState(Date.now());

  const title = useMemo(() => {
    return mode === "register" ? "Đăng ký tài khoản" : "Đăng nhập";
  }, [mode]);

  const otpRemainingMs = useMemo(() => {
    if (!sessionId || !otpExpiresAt) return 0;

    const expiresMs = new Date(otpExpiresAt).getTime();
    if (Number.isNaN(expiresMs)) return 0;

    return Math.max(0, expiresMs - nowTs);
  }, [sessionId, otpExpiresAt, nowTs]);

  const otpCountdownLabel = useMemo(() => {
    return formatOtpCountdown(otpRemainingMs);
  }, [otpRemainingMs]);

  const isOtpExpired = !!sessionId && otpRemainingMs <= 0;

  // Nếu đã có session rồi thì đá về trang hồ sơ
  useEffect(() => {
    if (!authLoading && user) {
      navigate("/ho-so", { replace: true });
    }
  }, [authLoading, user, navigate]);

  useEffect(() => {
    if (!sessionId || !otpExpiresAt) return;

    const timer = setInterval(() => {
      setNowTs(Date.now());
    }, 1000);

    return () => clearInterval(timer);
  }, [sessionId, otpExpiresAt]);

  async function handleSendOtp() {
    try {
      setLoading(true);
      setErrorMsg("");

      const cleanPhone = phone.trim();

      if (!cleanPhone) {
        setErrorMsg("Vui lòng nhập số điện thoại.");
        return;
      }

      const res = await requestOtp(cleanPhone);
      setSessionId(res.session_id);

      const fallbackExpiresAt = new Date(Date.now() + 180 * 1000).toISOString();

      const nextExpiresAt =
        res?.expiresAt ||
        res?.expires_at ||
        (res?.expiresIn
          ? new Date(Date.now() + Number(res.expiresIn) * 1000).toISOString()
          : null) ||
        (res?.ttlSeconds
          ? new Date(Date.now() + Number(res.ttlSeconds) * 1000).toISOString()
          : null) ||
        fallbackExpiresAt;

      setOtpExpiresAt(nextExpiresAt);
      setNowTs(Date.now());

      alert("OTP đã gửi. Kiểm tra console server nếu đang mock SMS.");
    } catch (e) {
      setErrorMsg(e.message || "Không gửi được OTP.");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify() {
    try {
      setLoading(true);
      setErrorMsg("");

      if (isOtpExpired) {
        setErrorMsg("Mã OTP đã hết hạn. Vui lòng gửi lại mã mới.");
        return;
      }

      if (!sessionId) {
        setErrorMsg("Thiếu session OTP. Vui lòng gửi OTP lại.");
        return;
      }

      const res = await verifyOtp(sessionId, otp.trim());
      const token = res.access_token;

      if (!token) {
        throw new Error("Không nhận được token đăng nhập.");
      }

      const me = await getMe(token);

      // Lưu session qua context thay vì localStorage thủ công ở page
      login(token, me);

      navigate("/ho-so", { replace: true });
    } catch (e) {
      setErrorMsg(e.message || "Xác minh OTP thất bại.");
    } finally {
      setLoading(false);
    }
  }

  if (authLoading) {
    return (
      <Container maxWidth="sm" sx={{ pt: 10 }}>
        <Paper sx={{ p: 4, borderRadius: 3 }}>
          <Stack spacing={2} alignItems="center">
            <CircularProgress size={28} />
            <Typography sx={{ fontWeight: 700 }}>
              Đang kiểm tra phiên đăng nhập...
            </Typography>
          </Stack>
        </Paper>
      </Container>
    );
  }

  return (
    <Container maxWidth="sm" sx={{ pt: 10 }}>
      <Paper sx={{ p: 4, borderRadius: 3 }}>
        <Stack spacing={3}>
          <Typography variant="h5" fontWeight={800}>
            {title}
          </Typography>

          <Typography variant="body2" sx={{ opacity: 0.75 }}>
            Nhập số điện thoại để nhận mã OTP.
          </Typography>

          {!!errorMsg && (
            <Alert severity="error" variant="filled">
              {errorMsg}
            </Alert>
          )}

          <TextField
            label="Số điện thoại"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            fullWidth
            disabled={loading || !!sessionId}
            placeholder="Ví dụ: 0901234567"
          />

          {!sessionId && (
            <Button
              variant="contained"
              onClick={handleSendOtp}
              disabled={loading}
              sx={{ textTransform: "none", fontWeight: 800 }}
            >
              {loading ? "Đang gửi..." : "Gửi OTP"}
            </Button>
          )}

          {sessionId && (
            <>
              {!isOtpExpired ? (
                <Alert severity="success">
                  OTP đã được gửi. Vui lòng nhập mã trong {otpCountdownLabel}.
                </Alert>
              ) : (
                <Alert severity="warning">
                  OTP đã hết hạn. Vui lòng gửi lại mã OTP.
                </Alert>
              )}

              <TextField
                label="Nhập mã OTP"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                fullWidth
                placeholder="6 chữ số"
                disabled={loading || isOtpExpired}
              />

              <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
                <Button
                  variant="contained"
                  onClick={handleVerify}
                  disabled={loading || isOtpExpired}
                  sx={{ textTransform: "none", fontWeight: 800 }}
                >
                  {loading ? "Đang xác nhận..." : "Xác nhận"}
                </Button>

                <Button
                  variant="outlined"
                  onClick={() => {
                    setSessionId(null);
                    setOtp("");
                    setErrorMsg("");
                    setOtpExpiresAt(null);
                    setNowTs(Date.now());
                  }}
                  disabled={loading}
                  sx={{ textTransform: "none", fontWeight: 800 }}
                >
                  Đổi số khác
                </Button>

                {isOtpExpired && (
                  <Button
                    variant="outlined"
                    onClick={handleSendOtp}
                    disabled={loading}
                    sx={{ textTransform: "none", fontWeight: 800 }}
                  >
                    {loading ? "Đang gửi..." : "Gửi lại mã"}
                  </Button>
                )}
              </Stack>
            </>
          )}
        </Stack>
      </Paper>
    </Container>
  );
}
