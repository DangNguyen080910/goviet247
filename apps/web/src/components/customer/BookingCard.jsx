// Path: goviet247/apps/web/src/components/customer/BookingCard.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Box,
  Card,
  CardContent,
  Typography,
  Stack,
  TextField,
  ToggleButtonGroup,
  ToggleButton,
  Button,
  Divider,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Container,
  IconButton,
  Chip,
  Tooltip,
  Snackbar,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
  Autocomplete,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";

import { CUSTOMER_SCROLL_ID, HEADER_H } from "./CustomerLayout";
import { useNavigate } from "react-router-dom";
import { quotePrice } from "../../api/pricing";
import { createTrip } from "../../api/trips";
import { getPublicTripConfig } from "../../api/publicConfig";
import { requestOtp, verifyOtp, getMe } from "../../api/auth";
import { useCustomerAuth } from "../../context/CustomerAuthContext";
import { searchPlaces, getPlaceDetail } from "../../api/maps";

const DEFAULT_PUBLIC_CONFIG = {
  tripConfig: {
    maxStops: 10,
    minDistanceKm: 5,
    maxDistanceKm: 2000,
    quoteExpireSeconds: 120,
  },
  systemConfig: {
    supportPhone: "0900000000",
    supportEmail: "support@goviet247.com",
    timezone: "Asia/Ho_Chi_Minh",
  },
  carTypes: [
    { value: "CAR_5", label: "Xe 5 chỗ" },
    { value: "CAR_7", label: "Xe 7 chỗ" },
    { value: "CAR_16", label: "Xe 16 chỗ" },
  ],
};

function formatVND(n) {
  const val = Number(n || 0);
  return val.toLocaleString("vi-VN") + " đ";
}

function toMsFromDatetimeLocal(v) {
  if (!v) return NaN;
  return new Date(v).getTime();
}

function toIsoFromDatetimeLocal(v) {
  if (!v) return "";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString();
}

// Cắt bớt mã chuyến cho dễ nhìn
function shortTripId(id = "", n = 10) {
  if (!id) return "";
  return id.length <= n ? id : `${id.slice(0, n)}…`;
}

function formatCountdownLabel(ms) {
  const safeMs = Math.max(0, Number(ms || 0));
  const totalSeconds = Math.floor(safeMs / 1000);

  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function formatOtpCountdown(ms) {
  const safeMs = Math.max(0, Number(ms || 0));
  const totalSeconds = Math.floor(safeMs / 1000);

  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export default function BookingCard() {
  const navigate = useNavigate();
  const { user, login } = useCustomerAuth();

  const [pickupAddress, setPickupAddress] = useState("");
  const [pickupPlace, setPickupPlace] = useState(null);
  const [pickupOptions, setPickupOptions] = useState([]);
  const [pickupLoading, setPickupLoading] = useState(false);

  const [stops, setStops] = useState([""]);
  const [stopPlaces, setStopPlaces] = useState([null]);
  const [stopOptions, setStopOptions] = useState([[]]);
  const [stopLoadingMap, setStopLoadingMap] = useState({});
  const [pickupTime, setPickupTime] = useState("");
  const [returnTime, setReturnTime] = useState("");
  const [direction, setDirection] = useState("ONE_WAY");
  const [carType, setCarType] = useState("CAR_5");

  const [riderName, setRiderName] = useState("");
  const [riderPhone, setRiderPhone] = useState("");
  const [note, setNote] = useState("");

  // ✅ Tạm thời để test (chưa có map)
  const [distanceKm, setDistanceKm] = useState("10");
  const [driveMinutes, setDriveMinutes] = useState("30");

  const [quote, setQuote] = useState(null);
  const [isEstimating, setIsEstimating] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const [publicConfig, setPublicConfig] = useState(DEFAULT_PUBLIC_CONFIG);
  const [isLoadingConfig, setIsLoadingConfig] = useState(true);

  const [toast, setToast] = useState({
    open: false,
    severity: "success",
    message: "",
  });

  // ✅ Popup đặt chuyến thành công
  const [successDialog, setSuccessDialog] = useState({
    open: false,
    tripId: "",
  });

  const [otpDialogOpen, setOtpDialogOpen] = useState(false);
  const [otpSessionId, setOtpSessionId] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [otpExpiresAt, setOtpExpiresAt] = useState(null);
  const [otpNowTs, setOtpNowTs] = useState(Date.now());
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpErrorMsg, setOtpErrorMsg] = useState("");
  const [pendingTripPayload, setPendingTripPayload] = useState(null);
  const [shouldRedirectAfterSuccess, setShouldRedirectAfterSuccess] =
    useState(false);

  // ✅ Ref để focus + scroll tới input stop mới thêm
  const stopInputRefs = useRef([]);

  // ✅ Ref cho tên / sđt để focus khi bấm "Đặt chuyến"
  const riderNameRef = useRef(null);
  const riderPhoneRef = useRef(null);

  // ✅ Ref cho block giá cuối + nút đặt chuyến
  const quoteSummaryRef = useRef(null);
  const createTripButtonRef = useRef(null);

  const [submitTouched, setSubmitTouched] = useState(false);

  const tripConfig =
    publicConfig?.tripConfig || DEFAULT_PUBLIC_CONFIG.tripConfig;

  const carTypeOptions =
    publicConfig?.carTypes?.length > 0
      ? publicConfig.carTypes
      : DEFAULT_PUBLIC_CONFIG.carTypes;

  const quoteExpireSeconds = Number(tripConfig?.quoteExpireSeconds || 120);
  const minDistanceKm = Number(tripConfig?.minDistanceKm || 0);
  const maxDistanceKm = Number(tripConfig?.maxDistanceKm || 2000);
  const maxStops = Number(tripConfig?.maxStops || 10);

  // ✅ Lấy scroll container thật
  const getScrollEl = () => {
    return document.getElementById(CUSTOMER_SCROLL_ID);
  };

  // ✅ Load config public cho customer page
  useEffect(() => {
    let active = true;

    async function loadConfig() {
      try {
        setIsLoadingConfig(true);
        const data = await getPublicTripConfig();

        if (!active) return;

        setPublicConfig({
          tripConfig: data?.tripConfig || DEFAULT_PUBLIC_CONFIG.tripConfig,
          systemConfig:
            data?.systemConfig || DEFAULT_PUBLIC_CONFIG.systemConfig,
          carTypes:
            data?.carTypes?.length > 0
              ? data.carTypes
              : DEFAULT_PUBLIC_CONFIG.carTypes,
        });
      } catch (e) {
        if (!active) return;

        setPublicConfig(DEFAULT_PUBLIC_CONFIG);
        setToast({
          open: true,
          severity: "warning",
          message:
            e?.message ||
            "Không tải được cấu hình mới nhất. Hệ thống đang dùng cấu hình mặc định.",
        });
      } finally {
        if (active) {
          setIsLoadingConfig(false);
        }
      }
    }

    loadConfig();

    return () => {
      active = false;
    };
  }, []);

  // ✅ Nếu carType hiện tại không còn hợp lệ thì tự về option đầu tiên
  useEffect(() => {
    if (!carTypeOptions.length) return;

    const exists = carTypeOptions.some((item) => item.value === carType);
    if (!exists) {
      setCarType(carTypeOptions[0].value);
    }
  }, [carType, carTypeOptions]);

  const handleAddStop = () => {
    if (stops.length >= maxStops) {
      setToast({
        open: true,
        severity: "warning",
        message: `Tối đa ${maxStops} điểm đến`,
      });
      return;
    }

    setStops((prev) => {
      const next = [...prev, ""];
      const newIndex = next.length - 1;

      setStopPlaces((prevPlaces) => [...prevPlaces, null]);
      setStopOptions((prevOptions) => [...prevOptions, []]);

      setTimeout(() => {
        const el = stopInputRefs.current[newIndex];
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
          el.focus();
        }
      }, 0);

      return next;
    });
  };

  const handleRemoveStop = (idx) =>
    setStops((prev) => {
      const next = prev.filter((_, i) => i !== idx);

      setStopPlaces((prevPlaces) => {
        const nextPlaces = prevPlaces.filter((_, i) => i !== idx);
        return nextPlaces.length ? nextPlaces : [null];
      });

      setStopOptions((prevOptions) => {
        const nextOptions = prevOptions.filter((_, i) => i !== idx);
        return nextOptions.length ? nextOptions : [[]];
      });

      setStopLoadingMap((prevMap) => {
        const nextMap = { ...prevMap };
        delete nextMap[idx];

        const reindexed = {};
        Object.keys(nextMap).forEach((key) => {
          const oldIndex = Number(key);
          if (oldIndex < idx) reindexed[oldIndex] = nextMap[oldIndex];
          if (oldIndex > idx) reindexed[oldIndex - 1] = nextMap[oldIndex];
        });

        return reindexed;
      });

      setTimeout(() => {
        const targetIdx = Math.min(idx, next.length - 1);
        const el = stopInputRefs.current[targetIdx];
        if (el) el.focus();
      }, 0);

      return next.length ? next : [""];
    });

  const handleChangeStop = (idx, val) => {
    setStops((prev) => prev.map((s, i) => (i === idx ? val : s)));
    setStopPlaces((prev) => prev.map((p, i) => (i === idx ? null : p)));
  };

  const hasAtLeastOneStop = useMemo(() => stops.some((x) => x.trim()), [stops]);

  const filledStopCount = useMemo(
    () => stops.filter((s) => s.trim()).length,
    [stops],
  );

  useEffect(() => {
    if (direction === "ONE_WAY") setReturnTime("");
  }, [direction]);

  useEffect(() => {
    const keyword = pickupAddress.trim();

    if (!keyword || keyword.length < 3) {
      setPickupOptions([]);
      setPickupLoading(false);
      return;
    }

    let active = true;

    const t = setTimeout(async () => {
      try {
        setPickupLoading(true);
        const items = await searchPlaces(keyword);

        if (!active) return;
        setPickupOptions(items);
      } catch {
        if (!active) return;
        setPickupOptions([]);
      } finally {
        if (active) {
          setPickupLoading(false);
        }
      }
    }, 350);

    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [pickupAddress]);

  useEffect(() => {
    const timers = [];
    let active = true;

    stops.forEach((value, idx) => {
      const keyword = String(value || "").trim();

      if (!keyword || keyword.length < 3) {
        setStopOptions((prev) =>
          prev.map((items, i) => (i === idx ? [] : items)),
        );
        setStopLoadingMap((prev) => ({ ...prev, [idx]: false }));
        return;
      }

      const t = setTimeout(async () => {
        try {
          setStopLoadingMap((prev) => ({ ...prev, [idx]: true }));
          const items = await searchPlaces(keyword);

          if (!active) return;

          setStopOptions((prev) =>
            prev.map((oldItems, i) => (i === idx ? items : oldItems)),
          );
        } catch {
          if (!active) return;

          setStopOptions((prev) =>
            prev.map((oldItems, i) => (i === idx ? [] : oldItems)),
          );
        } finally {
          if (active) {
            setStopLoadingMap((prev) => ({ ...prev, [idx]: false }));
          }
        }
      }, 350);

      timers.push(t);
    });

    return () => {
      active = false;
      timers.forEach(clearTimeout);
    };
  }, [stops]);

  const pickupMs = useMemo(
    () => toMsFromDatetimeLocal(pickupTime),
    [pickupTime],
  );
  const returnMs = useMemo(
    () => toMsFromDatetimeLocal(returnTime),
    [returnTime],
  );

  const isReturnTimeValid = useMemo(() => {
    if (direction !== "ROUND_TRIP") return true;
    if (!pickupTime || !returnTime) return false;
    return returnMs > pickupMs;
  }, [direction, pickupTime, returnTime, pickupMs, returnMs]);

  // Khi thay input => reset quote
  useEffect(() => {
    setQuote(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    pickupAddress,
    stops,
    pickupTime,
    returnTime,
    direction,
    carType,
    distanceKm,
    driveMinutes,
  ]);

  const quoteRemainingMs = useMemo(() => {
    if (!quote?.expiresAt) return 0;
    return Math.max(0, new Date(quote.expiresAt).getTime() - Date.now());
  }, [quote]);

  const isQuoteExpired = useMemo(() => {
    return !!quote?.expiresAt && quoteRemainingMs <= 0;
  }, [quote, quoteRemainingMs]);

  const quoteCountdownLabel = useMemo(() => {
    return formatCountdownLabel(quoteRemainingMs);
  }, [quoteRemainingMs]);

  const otpRemainingMs = useMemo(() => {
    if (!otpDialogOpen || !otpSessionId || !otpExpiresAt) return 0;

    const expiresMs = new Date(otpExpiresAt).getTime();
    if (Number.isNaN(expiresMs)) return 0;

    return Math.max(0, expiresMs - otpNowTs);
  }, [otpDialogOpen, otpSessionId, otpExpiresAt, otpNowTs]);

  const otpCountdownLabel = useMemo(() => {
    return formatOtpCountdown(otpRemainingMs);
  }, [otpRemainingMs]);

  const isOtpExpired = !!otpSessionId && otpRemainingMs <= 0;

  useEffect(() => {
    if (!quote?.expiresAt) return;
    const t = setInterval(() => {
      setQuote((q) => (q ? { ...q } : q));
    }, 1000);
    return () => clearInterval(t);
  }, [quote?.expiresAt]);

  useEffect(() => {
    if (!otpDialogOpen || !otpSessionId || !otpExpiresAt) return;

    const t = setInterval(() => {
      setOtpNowTs(Date.now());
    }, 1000);

    return () => clearInterval(t);
  }, [otpDialogOpen, otpSessionId, otpExpiresAt]);

  const numericDistanceKm = Number(distanceKm);
  const isDistanceValid = useMemo(() => {
    if (!Number.isFinite(numericDistanceKm)) return false;
    return (
      numericDistanceKm >= minDistanceKm && numericDistanceKm <= maxDistanceKm
    );
  }, [numericDistanceKm, minDistanceKm, maxDistanceKm]);

  const canEstimate =
    !isLoadingConfig &&
    pickupAddress.trim() &&
    hasAtLeastOneStop &&
    pickupTime &&
    direction &&
    carType &&
    (direction === "ONE_WAY" ? true : isReturnTimeValid) &&
    isDistanceValid &&
    Number(driveMinutes) >= 0;

  const isNameValid = riderName.trim().length >= 2;
  const isPhoneValid = riderPhone.trim().length >= 9;

  const showNameError = submitTouched && !isNameValid;
  const showPhoneError = submitTouched && !isPhoneValid;

  const canCreateTrip =
    !!quote && !isQuoteExpired && isNameValid && isPhoneValid && !isCreating;

  const missingCreateTripHint = useMemo(() => {
    if (!quote || isQuoteExpired) return "";
    if (isNameValid && isPhoneValid) return "";
    if (!isNameValid && !isPhoneValid)
      return "Vui lòng nhập Tên và Số điện thoại để đặt chuyến.";
    if (!isNameValid) return "Vui lòng nhập Tên khách hàng để đặt chuyến.";
    return "Vui lòng nhập Số điện thoại để đặt chuyến.";
  }, [quote, isQuoteExpired, isNameValid, isPhoneValid]);

  const focusField = (ref) => {
    const el = ref?.current;
    if (!el) return;
    try {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    } catch {
      // ignore
    }
    setTimeout(() => {
      try {
        el.focus();
      } catch {
        // ignore
      }
    }, 0);
  };

  const resetFormAfterSuccess = () => {
    setPickupAddress("");
    setPickupPlace(null);
    setPickupOptions([]);
    setStops([""]);
    setStopPlaces([null]);
    setStopOptions([[]]);
    setStopLoadingMap({});
    setPickupTime("");
    setReturnTime("");
    setDirection("ONE_WAY");
    setCarType(carTypeOptions[0]?.value || "CAR_5");

    // Reset về rỗng để effect auto fill nạp lại từ session nếu user đã login
    setRiderName("");
    setRiderPhone("");
    setNote("");

    setDistanceKm("10");
    setDriveMinutes("30");

    setQuote(null);
    setSubmitTouched(false);

    const scroller = getScrollEl();
    if (scroller) scroller.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSelectPickupPlace = async (_, option) => {
    if (!option?.placeId) {
      setPickupPlace(null);
      return;
    }

    try {
      setPickupLoading(true);

      const detail = await getPlaceDetail(option.placeId);

      setPickupPlace(detail);
      setPickupAddress(detail?.fullAddress || option?.fullAddress || "");
      setPickupOptions([]);
    } catch (e) {
      setToast({
        open: true,
        severity: "error",
        message: e?.message || "Không lấy được chi tiết điểm đón.",
      });
    } finally {
      setPickupLoading(false);
    }
  };

  const handleSelectStopPlace = async (idx, option) => {
    if (!option?.placeId) {
      setStopPlaces((prev) => prev.map((p, i) => (i === idx ? null : p)));
      return;
    }

    try {
      setStopLoadingMap((prev) => ({ ...prev, [idx]: true }));

      const detail = await getPlaceDetail(option.placeId);

      setStopPlaces((prev) => prev.map((p, i) => (i === idx ? detail : p)));
      setStops((prev) =>
        prev.map((value, i) =>
          i === idx ? detail?.fullAddress || option?.fullAddress || "" : value,
        ),
      );
      setStopOptions((prev) =>
        prev.map((items, i) => (i === idx ? [] : items)),
      );
    } catch (e) {
      setToast({
        open: true,
        severity: "error",
        message: e?.message || "Không lấy được chi tiết điểm đến.",
      });
    } finally {
      setStopLoadingMap((prev) => ({ ...prev, [idx]: false }));
    }
  };

  const handleEstimate = async () => {
    if (!isDistanceValid) {
      setToast({
        open: true,
        severity: "warning",
        message: `Quãng đường phải từ ${minDistanceKm} km đến ${maxDistanceKm} km.`,
      });
      return;
    }

    setIsEstimating(true);
    try {
      const payload = {
        carType,
        direction,
        pickupTime: toIsoFromDatetimeLocal(pickupTime),
        returnTime:
          direction === "ROUND_TRIP"
            ? toIsoFromDatetimeLocal(returnTime)
            : null,
        distanceKm: Number(distanceKm),
        driveMinutes: Number(driveMinutes),
      };

      const data = await quotePrice(payload);

      const now = Date.now();
      const nextQuote = {
        quoteId: "qt_" + now,
        totalPrice: data.finalPrice,
        expiresAt: new Date(now + quoteExpireSeconds * 1000).toISOString(),
        raw: data,
      };

      setQuote(nextQuote);

      setToast({
        open: true,
        severity: "success",
        message: "Tính giá thành công.",
      });

      setTimeout(() => {
        try {
          quoteSummaryRef.current?.scrollIntoView({
            behavior: "smooth",
            block: "center",
          });
        } catch {
          // ignore
        }

        setTimeout(() => {
          try {
            createTripButtonRef.current?.focus();
          } catch {
            // ignore
          }
        }, 350);
      }, 50);
    } catch (e) {
      setToast({
        open: true,
        severity: "error",
        message: e?.message || "Tính giá thất bại.",
      });
    } finally {
      setIsEstimating(false);
    }
  };

  const buildTripPayload = () => {
    const cleanedStops = stops
      .map((s) => String(s || "").trim())
      .filter(Boolean);

    if (cleanedStops.length === 0) {
      throw new Error("Vui lòng nhập ít nhất 1 điểm đến.");
    }

    if (cleanedStops.length > maxStops) {
      throw new Error(`Số điểm đến vượt quá giới hạn ${maxStops} điểm.`);
    }

    if (!isDistanceValid) {
      throw new Error(
        `Quãng đường phải từ ${minDistanceKm} km đến ${maxDistanceKm} km.`,
      );
    }

    const dropoffAddress = cleanedStops[cleanedStops.length - 1] || "";
    const finalNote = note?.trim() || null;

    return {
      pickupAddress,
      dropoffAddress,
      stops: cleanedStops,
      pickupTime: toIsoFromDatetimeLocal(pickupTime),
      returnTime:
        direction === "ROUND_TRIP" ? toIsoFromDatetimeLocal(returnTime) : null,
      direction,
      carType,
      distanceKm: Number(distanceKm),
      fareEstimate: quote.totalPrice,
      riderName,
      riderPhone,
      note: finalNote,
    };
  };

  const resetOtpDialogState = () => {
    setOtpDialogOpen(false);
    setOtpSessionId("");
    setOtpCode("");
    setOtpExpiresAt(null);
    setOtpNowTs(Date.now());
    setOtpLoading(false);
    setOtpErrorMsg("");
    setPendingTripPayload(null);
  };

  const handleOpenGuestOtpDialog = async (payload) => {
    try {
      setOtpLoading(true);
      setOtpErrorMsg("");
      setPendingTripPayload(payload);

      const res = await requestOtp(riderPhone.trim());

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

      setOtpSessionId(res.session_id || "");
      setOtpExpiresAt(nextExpiresAt);
      setOtpNowTs(Date.now());
      setOtpCode("");
      setOtpDialogOpen(true);
    } catch (e) {
      setToast({
        open: true,
        severity: "error",
        message: e?.message || "Không gửi được OTP.",
      });
    } finally {
      setOtpLoading(false);
    }
  };

  const handleVerifyGuestOtpAndCreateTrip = async () => {
    try {
      setOtpLoading(true);
      setOtpErrorMsg("");

      if (!otpSessionId) {
        setOtpErrorMsg("Thiếu session OTP. Vui lòng gửi lại mã.");
        return;
      }

      if (isOtpExpired) {
        setOtpErrorMsg("Mã OTP đã hết hạn. Vui lòng gửi lại mã mới.");
        return;
      }

      if (!otpCode.trim()) {
        setOtpErrorMsg("Vui lòng nhập mã OTP.");
        return;
      }

      if (!pendingTripPayload) {
        setOtpErrorMsg("Thiếu dữ liệu chuyến đi. Vui lòng thao tác lại.");
        return;
      }

      const verifyRes = await verifyOtp(otpSessionId, otpCode.trim());
      const token = verifyRes?.access_token;

      if (!token) {
        throw new Error("Không nhận được token đăng nhập.");
      }

      const me = await getMe(token);
      login(token, me);

      const res = await createTrip(pendingTripPayload);

      const tripId =
        res?.trip?.id ||
        res?.tripId ||
        res?.data?.trip?.id ||
        res?.data?.tripId ||
        "";

      setShouldRedirectAfterSuccess(true);
      setSuccessDialog({ open: true, tripId });

      setToast({
        open: true,
        severity: "success",
        message: res?.message || "Đã tạo chuyến thành công.",
      });

      resetOtpDialogState();
    } catch (e) {
      setOtpErrorMsg(e?.message || "Xác minh OTP thất bại.");
    } finally {
      setOtpLoading(false);
    }
  };

  const handleCreateTrip = async () => {
    if (isCreating || otpLoading) return;

    setSubmitTouched(true);

    if (!quote || isQuoteExpired) {
      setToast({
        open: true,
        severity: "warning",
        message: "Giá đã hết hạn hoặc chưa tính giá. Vui lòng tính lại.",
      });
      return;
    }

    if (!isNameValid) {
      focusField(riderNameRef);
      return;
    }

    if (!isPhoneValid) {
      focusField(riderPhoneRef);
      return;
    }

    let payload = null;

    try {
      payload = buildTripPayload();
    } catch (e) {
      setToast({
        open: true,
        severity: "warning",
        message: e?.message || "Dữ liệu chuyến đi chưa hợp lệ.",
      });
      return;
    }

    if (!user) {
      await handleOpenGuestOtpDialog(payload);
      return;
    }

    setIsCreating(true);
    try {
      const res = await createTrip(payload);

      const tripId =
        res?.trip?.id ||
        res?.tripId ||
        res?.data?.trip?.id ||
        res?.data?.tripId ||
        "";

      setShouldRedirectAfterSuccess(true);
      setSuccessDialog({ open: true, tripId });

      setToast({
        open: true,
        severity: "success",
        message: res?.message || "Đã tạo chuyến thành công.",
      });
    } catch (e) {
      setToast({
        open: true,
        severity: "error",
        message: e?.message || "Tạo chuyến thất bại.",
      });
    } finally {
      setIsCreating(false);
    }
  };

  // ✅ Back to top: nghe scroll của scroll container, không nghe window
  const [showBackToTop, setShowBackToTop] = useState(false);

  useEffect(() => {
    const scroller = getScrollEl();
    if (!scroller) return;

    const onScroll = () => {
      setShowBackToTop(scroller.scrollTop > 300);
    };

    scroller.addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    return () => scroller.removeEventListener("scroll", onScroll);
  }, []);

  const handleBackToTop = () => {
    const scroller = getScrollEl();
    if (!scroller) return;
    scroller.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleCloseSuccessDialog = () => {
    const mustRedirect = shouldRedirectAfterSuccess;

    setSuccessDialog({ open: false, tripId: "" });
    setShouldRedirectAfterSuccess(false);
    resetFormAfterSuccess();

    if (mustRedirect) {
      navigate("/ho-so", { replace: true });
    }
  };

  return (
    <Container maxWidth={false} sx={{ px: 0 }}>
      <Box sx={{ maxWidth: 900, mx: "auto", px: { xs: 2, sm: 3 }, py: 3 }}>
        <Card
          elevation={0}
          sx={{
            borderRadius: 3,
            bgcolor: "white",
            border: "1px solid rgba(0,0,0,0.08)",
            boxShadow: "0 16px 50px rgba(0,0,0,0.10)",
          }}
        >
          <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
            <Stack spacing={2}>
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 1,
                }}
              >
                <Typography sx={{ fontWeight: 900, fontSize: 18 }}>
                  Đặt xe
                </Typography>

                {isLoadingConfig && (
                  <Stack direction="row" spacing={1} alignItems="center">
                    <CircularProgress size={16} />
                    <Typography variant="body2" sx={{ opacity: 0.7 }}>
                      Đang tải cấu hình...
                    </Typography>
                  </Stack>
                )}
              </Box>

              {/* 1) Lộ trình */}
              <Stack spacing={1.2}>
                <Typography
                  sx={{ fontWeight: 800, fontSize: 13, opacity: 0.85 }}
                >
                  Lộ trình
                </Typography>

                <Autocomplete
                  freeSolo
                  options={pickupOptions}
                  loading={pickupLoading}
                  value={pickupPlace}
                  inputValue={pickupAddress}
                  onInputChange={(_, value, reason) => {
                    if (reason === "input") {
                      setPickupAddress(value);
                      setPickupPlace(null);
                    }
                    if (reason === "clear") {
                      setPickupAddress("");
                      setPickupPlace(null);
                      setPickupOptions([]);
                    }
                  }}
                  onChange={handleSelectPickupPlace}
                  getOptionLabel={(option) => {
                    if (typeof option === "string") return option;
                    return option?.fullAddress || "";
                  }}
                  filterOptions={(x) => x}
                  noOptionsText={
                    pickupAddress.trim().length < 3
                      ? "Nhập ít nhất 3 ký tự để tìm địa chỉ"
                      : "Không có gợi ý phù hợp"
                  }
                  loadingText="Đang tìm địa chỉ..."
                  isOptionEqualToValue={(option, value) =>
                    option.placeId === value.placeId
                  }
                  renderOption={(props, option) => (
                    <Box component="li" {...props}>
                      <Stack spacing={0.25}>
                        <Typography sx={{ fontWeight: 800, fontSize: 14 }}>
                          {option.name ||
                            option.shortAddress ||
                            option.fullAddress}
                        </Typography>
                        {!!option.maskedAddress && (
                          <Typography variant="body2" sx={{ opacity: 0.75 }}>
                            {option.maskedAddress}
                          </Typography>
                        )}
                      </Stack>
                    </Box>
                  )}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Điểm đón"
                      fullWidth
                      size="small"
                      placeholder="Ví dụ: 12 Nguyễn Huệ, Bến Nghé, Quận 1, TP.HCM"
                    />
                  )}
                />

                <Stack
                  direction="row"
                  alignItems="center"
                  justifyContent="space-between"
                >
                  <Typography sx={{ fontWeight: 800, fontSize: 13 }}>
                    Điểm đến
                  </Typography>

                  <Button
                    onClick={handleAddStop}
                    startIcon={<AddIcon />}
                    size="small"
                    disabled={stops.length >= maxStops}
                    sx={{
                      textTransform: "none",
                      fontWeight: 900,
                      borderRadius: 2,
                    }}
                  >
                    Thêm điểm đến
                  </Button>
                </Stack>

                {filledStopCount > 2 && (
                  <Typography variant="body2" sx={{ opacity: 0.75 }}>
                    Tổng số điểm đến: <b>{filledStopCount}</b>
                  </Typography>
                )}

                <Box>
                  <Stack spacing={1}>
                    {stops.map((s, idx) => (
                      <Stack
                        key={idx}
                        direction="row"
                        spacing={1}
                        alignItems="flex-start"
                      >
                        <Autocomplete
                          freeSolo
                          options={stopOptions[idx] || []}
                          loading={!!stopLoadingMap[idx]}
                          value={stopPlaces[idx] || null}
                          inputValue={s}
                          onInputChange={(_, value, reason) => {
                            if (reason === "input") {
                              handleChangeStop(idx, value);
                            }
                            if (reason === "clear") {
                              handleChangeStop(idx, "");
                              setStopOptions((prev) =>
                                prev.map((items, i) =>
                                  i === idx ? [] : items,
                                ),
                              );
                            }
                          }}
                          onChange={(_, option) =>
                            handleSelectStopPlace(idx, option)
                          }
                          getOptionLabel={(option) => {
                            if (typeof option === "string") return option;
                            return option?.fullAddress || "";
                          }}
                          filterOptions={(x) => x}
                          noOptionsText={
                            String(s || "").trim().length < 3
                              ? "Nhập ít nhất 3 ký tự để tìm địa chỉ"
                              : "Không có gợi ý phù hợp"
                          }
                          loadingText="Đang tìm địa chỉ..."
                          isOptionEqualToValue={(option, value) =>
                            option.placeId === value.placeId
                          }
                          fullWidth
                          renderOption={(props, option) => (
                            <Box component="li" {...props}>
                              <Stack spacing={0.25}>
                                <Typography
                                  sx={{ fontWeight: 800, fontSize: 14 }}
                                >
                                  {option.name ||
                                    option.shortAddress ||
                                    option.fullAddress}
                                </Typography>
                                {!!option.maskedAddress && (
                                  <Typography
                                    variant="body2"
                                    sx={{ opacity: 0.75 }}
                                  >
                                    {option.maskedAddress}
                                  </Typography>
                                )}
                              </Stack>
                            </Box>
                          )}
                          renderInput={(params) => (
                            <TextField
                              {...params}
                              label={`Điểm đến ${idx + 1}`}
                              fullWidth
                              size="small"
                              inputRef={(el) =>
                                (stopInputRefs.current[idx] = el)
                              }
                              placeholder={
                                idx === 0
                                  ? "Ví dụ: Khách sạn Dalat Palace, 02 Trần Phú, Phường 3, Đà Lạt"
                                  : "Ví dụ: Thung Lũng Tình Yêu, 05-07 Mai Anh Đào, Phường 8, Đà Lạt"
                              }
                            />
                          )}
                        />

                        <IconButton
                          onClick={() => handleRemoveStop(idx)}
                          disabled={stops.length === 1}
                          size="small"
                          aria-label="Xóa điểm"
                          sx={{ mt: 0.5 }}
                        >
                          <DeleteOutlineIcon fontSize="small" />
                        </IconButton>
                      </Stack>
                    ))}
                  </Stack>
                </Box>

                <Typography variant="body2" sx={{ opacity: 0.7 }}>
                  Nhập địa chỉ càng chi tiết càng tốt để tài xế đón/trả đúng vị
                  trí.
                </Typography>

                {direction === "ROUND_TRIP" && (
                  <Chip
                    label="Khứ hồi: hệ thống sẽ quay về điểm đón ban đầu"
                    size="small"
                    sx={{ fontWeight: 800, alignSelf: "flex-start" }}
                  />
                )}
              </Stack>

              <Divider />

              {/* 2) Thời gian + Loại chuyến */}
              <Stack spacing={1.2}>
                <Typography
                  sx={{ fontWeight: 800, fontSize: 13, opacity: 0.85 }}
                >
                  Thời gian & Loại chuyến
                </Typography>

                <ToggleButtonGroup
                  value={direction}
                  exclusive
                  onChange={(_, v) => v && setDirection(v)}
                  size="small"
                  sx={{
                    bgcolor: "rgba(0,0,0,0.04)",
                    borderRadius: 2,
                    "& .MuiToggleButton-root": {
                      textTransform: "none",
                      border: 0,
                      px: 1.6,
                      fontWeight: 900,
                    },
                  }}
                >
                  <ToggleButton value="ONE_WAY">Một chiều</ToggleButton>
                  <ToggleButton value="ROUND_TRIP">Khứ hồi</ToggleButton>
                </ToggleButtonGroup>

                <TextField
                  label="Thời gian đón khách"
                  type="datetime-local"
                  value={pickupTime}
                  onChange={(e) => setPickupTime(e.target.value)}
                  fullWidth
                  size="small"
                  InputLabelProps={{ shrink: true }}
                />

                {direction === "ROUND_TRIP" && (
                  <TextField
                    label="Thời gian quay về"
                    type="datetime-local"
                    value={returnTime}
                    onChange={(e) => setReturnTime(e.target.value)}
                    fullWidth
                    size="small"
                    InputLabelProps={{ shrink: true }}
                    helperText="Giờ tài xế đón bạn để quay về điểm đón ban đầu"
                    error={!!returnTime && !isReturnTimeValid}
                  />
                )}

                {direction === "ROUND_TRIP" && pickupTime && !returnTime && (
                  <Typography
                    variant="body2"
                    sx={{ color: "error.main", fontWeight: 800 }}
                  >
                    Vui lòng chọn thời gian quay về để tính giá khứ hồi
                  </Typography>
                )}

                {direction === "ROUND_TRIP" &&
                  pickupTime &&
                  returnTime &&
                  !isReturnTimeValid && (
                    <Typography
                      variant="body2"
                      sx={{ color: "error.main", fontWeight: 800 }}
                    >
                      Thời gian quay về phải lớn hơn thời gian đón khách
                    </Typography>
                  )}
              </Stack>

              <Divider />

              {/* 3) Loại xe */}
              <Stack spacing={1.2}>
                <Typography
                  sx={{ fontWeight: 800, fontSize: 13, opacity: 0.85 }}
                >
                  Loại xe
                </Typography>
                <FormControl fullWidth size="small">
                  <InputLabel>Chọn loại xe</InputLabel>
                  <Select
                    label="Chọn loại xe"
                    value={carType}
                    onChange={(e) => setCarType(e.target.value)}
                  >
                    {carTypeOptions.map((item) => (
                      <MenuItem key={item.value} value={item.value}>
                        {item.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Stack>

              <Divider />

              {/* 3.5) Test inputs (tạm thời) */}
              <Stack spacing={1.2}>
                <Typography
                  sx={{ fontWeight: 800, fontSize: 13, opacity: 0.85 }}
                >
                  Thông tin quãng đường (tạm thời để test)
                </Typography>

                <Stack direction={{ xs: "column", sm: "row" }} spacing={1.2}>
                  <TextField
                    label="Quãng đường (km)"
                    value={distanceKm}
                    onChange={(e) =>
                      setDistanceKm(e.target.value.replace(/[^\d.]/g, ""))
                    }
                    fullWidth
                    size="small"
                    inputProps={{ inputMode: "decimal" }}
                    error={!!distanceKm && !isDistanceValid}
                  />
                  <TextField
                    label="Thời gian chạy (phút)"
                    value={driveMinutes}
                    onChange={(e) =>
                      setDriveMinutes(e.target.value.replace(/[^\d]/g, ""))
                    }
                    fullWidth
                    size="small"
                    inputProps={{ inputMode: "numeric" }}
                  />
                </Stack>

                <Typography
                  variant="body2"
                  sx={{
                    opacity: isDistanceValid ? 0.7 : 1,
                    color: isDistanceValid ? "text.secondary" : "error.main",
                    fontWeight: isDistanceValid ? 400 : 800,
                  }}
                >
                  Quãng đường hợp lệ từ {minDistanceKm} km đến {maxDistanceKm}{" "}
                  km.
                </Typography>

                <Typography variant="body2" sx={{ opacity: 0.7 }}>
                  Khi gắn bản đồ xong, 2 ô này sẽ bị ẩn và lấy tự động.
                </Typography>
              </Stack>

              <Divider />

              {/* 4) Thông tin khách */}
              <Stack spacing={1.2}>
                <Typography
                  sx={{ fontWeight: 800, fontSize: 13, opacity: 0.85 }}
                >
                  Thông tin khách
                </Typography>

                <TextField
                  label="Tên khách hàng"
                  value={riderName}
                  onChange={(e) => setRiderName(e.target.value)}
                  fullWidth
                  size="small"
                  placeholder="Ví dụ: Nguyễn Văn A"
                  inputRef={riderNameRef}
                  error={showNameError}
                  helperText={
                    showNameError
                      ? "Vui lòng nhập tên (tối thiểu 2 ký tự)."
                      : ""
                  }
                />

                <TextField
                  label="Số điện thoại"
                  value={riderPhone}
                  onChange={(e) =>
                    setRiderPhone(e.target.value.replace(/[^\d]/g, ""))
                  }
                  fullWidth
                  size="small"
                  placeholder="Ví dụ: 0901234567"
                  inputProps={{ inputMode: "numeric" }}
                  inputRef={riderPhoneRef}
                  error={showPhoneError}
                  helperText={
                    showPhoneError
                      ? "Vui lòng nhập số điện thoại hợp lệ (tối thiểu 9 số)."
                      : ""
                  }
                />

                <TextField
                  label="Ghi chú (tuỳ chọn)"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  fullWidth
                  size="small"
                  multiline
                  minRows={3}
                  placeholder="Ví dụ: Fortuner đời 2023+, có thú cưng, có em bé, say xe..."
                />
              </Stack>

              <Divider />

              {/* Actions */}
              <Stack
                direction={{ xs: "column", sm: "row" }}
                spacing={1.2}
                justifyContent="space-between"
              >
                <Button
                  variant="contained"
                  disabled={!canEstimate || isEstimating}
                  onClick={handleEstimate}
                  sx={{
                    textTransform: "none",
                    borderRadius: 2.5,
                    fontWeight: 900,
                    px: 3,
                    py: 1.1,
                  }}
                >
                  {isEstimating ? "Đang tính giá..." : "Tính giá"}
                </Button>

                {quote && isQuoteExpired && (
                  <Typography
                    variant="body2"
                    sx={{ color: "error.main", fontWeight: 800 }}
                  >
                    Giá đã hết hạn, vui lòng tính lại
                  </Typography>
                )}
              </Stack>
            </Stack>
          </CardContent>
        </Card>

        {/* Sticky CTA: chỉ hiện sau khi có quote hợp lệ */}
        {quote && !isQuoteExpired && (
          <Box
            ref={quoteSummaryRef}
            sx={{
              mt: 2,
              p: 2,
              borderRadius: 3,
              bgcolor: "white",
              border: "1px solid rgba(0,0,0,0.08)",
              boxShadow: "0 8px 24px rgba(0,0,0,0.08)",
              scrollMarginTop: { xs: 90, sm: 110 },
            }}
          >
            <Stack spacing={1}>
              <Typography sx={{ fontWeight: 900 }}>Giá cuối</Typography>

              <Typography sx={{ fontWeight: 900, fontSize: 20 }}>
                {formatVND(quote.totalPrice)}
              </Typography>

              <Typography
                variant="body2"
                sx={{ opacity: 0.75, fontWeight: 600 }}
              >
                Đây là giá trọn gói, đã bao gồm phí cầu đường, cao tốc và chi
                phí ăn nghỉ của tài xế trong toàn hành trình. Không phát sinh
                thêm.
              </Typography>

              <Button
                variant="contained"
                disabled={!canCreateTrip || otpLoading}
                onClick={handleCreateTrip}
                ref={createTripButtonRef}
                sx={{
                  mt: 1,
                  textTransform: "none",
                  borderRadius: 2.5,
                  fontWeight: 900,
                  py: 1.2,
                }}
              >
                {isCreating
                  ? "Đang tạo..."
                  : otpLoading
                    ? "Đang gửi OTP..."
                    : "Đặt chuyến"}
              </Button>

              {!!missingCreateTripHint && (
                <Typography
                  variant="caption"
                  sx={{ opacity: 0.75, fontWeight: 800 }}
                >
                  {missingCreateTripHint}
                </Typography>
              )}

              <Typography
                variant="caption"
                sx={{ opacity: 0.65, fontWeight: 700 }}
              >
                Giữ giá {quoteCountdownLabel}
              </Typography>
            </Stack>
          </Box>
        )}
      </Box>

      {/* Back to top button */}
      {showBackToTop && (
        <Tooltip title="Lên đầu trang" placement="left">
          <IconButton
            onClick={handleBackToTop}
            sx={{
              position: "fixed",
              right: 18,
              bottom: quote && !isQuoteExpired ? 120 : 70,
              zIndex: 1600,
              bgcolor: "rgba(255,255,255,0.92)",
              border: "1px solid rgba(0,0,0,0.10)",
              boxShadow: "0 10px 24px rgba(0,0,0,0.18)",
              "&:hover": { bgcolor: "white" },
            }}
            aria-label="Lên đầu trang"
          >
            <KeyboardArrowUpIcon />
          </IconButton>
        </Tooltip>
      )}

      {/* ✅ Dialog: đặt chuyến thành công */}
      <Dialog
        open={successDialog.open}
        onClose={handleCloseSuccessDialog}
        aria-labelledby="success-trip-title"
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle id="success-trip-title" sx={{ fontWeight: 900 }}>
          Đặt chuyến thành công ✅
        </DialogTitle>
        <DialogContent>
          <Stack spacing={1.2} sx={{ pt: 0.5 }}>
            <Typography sx={{ fontWeight: 800 }}>
              GoViet247 đã ghi nhận chuyến của bạn.
            </Typography>
            <Typography sx={{ opacity: 0.85 }}>
              Nhân viên sẽ xác nhận và Tài xế sẽ liên hệ bạn trong ít phút tới.
              Vui lòng để ý điện thoại.
            </Typography>

            {!!successDialog.tripId && (
              <Box
                sx={{
                  mt: 0.5,
                  p: 1,
                  borderRadius: 2,
                  bgcolor: "rgba(0,0,0,0.04)",
                  border: "1px solid rgba(0,0,0,0.08)",
                }}
              >
                <Typography
                  variant="body2"
                  sx={{ opacity: 0.75, fontWeight: 800 }}
                >
                  Mã chuyến:
                </Typography>
                <Typography sx={{ fontWeight: 900 }}>
                  {shortTripId(successDialog.tripId)}
                </Typography>
              </Box>
            )}

            <Typography sx={{ opacity: 0.85 }}>
              Cảm ơn bạn đã sử dụng dịch vụ GoViet247.
            </Typography>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 2.5, pb: 2 }}>
          <Button
            onClick={handleCloseSuccessDialog}
            variant="contained"
            sx={{ textTransform: "none", fontWeight: 900, borderRadius: 2 }}
          >
            OK
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={otpDialogOpen}
        onClose={() => {
          if (otpLoading) return;
          resetOtpDialogState();
        }}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle sx={{ fontWeight: 900 }}>
          Xác thực số điện thoại
        </DialogTitle>

        <DialogContent>
          <Stack spacing={1.5} sx={{ pt: 0.5 }}>
            <Typography sx={{ opacity: 0.85 }}>
              Vui lòng nhập mã OTP để hoàn tất đặt chuyến.
            </Typography>

            <TextField
              label="Số điện thoại"
              value={riderPhone}
              fullWidth
              disabled
              size="small"
            />

            {!!otpErrorMsg && (
              <Alert severity="error" variant="filled">
                {otpErrorMsg}
              </Alert>
            )}

            {!isOtpExpired ? (
              <Alert severity="success">
                OTP đã được gửi. Nhập mã trong {otpCountdownLabel}.
              </Alert>
            ) : (
              <Alert severity="warning">
                OTP đã hết hạn. Vui lòng gửi lại mã.
              </Alert>
            )}

            <TextField
              label="Nhập mã OTP"
              value={otpCode}
              onChange={(e) => setOtpCode(e.target.value.replace(/[^\d]/g, ""))}
              fullWidth
              size="small"
              placeholder="6 chữ số"
              inputProps={{ inputMode: "numeric" }}
              disabled={otpLoading || isOtpExpired}
            />
          </Stack>
        </DialogContent>

        <DialogActions sx={{ px: 2.5, pb: 2 }}>
          <Button
            onClick={() => {
              resetOtpDialogState();
            }}
            disabled={otpLoading}
            sx={{ textTransform: "none", fontWeight: 800 }}
          >
            Huỷ
          </Button>

          {isOtpExpired && (
            <Button
              variant="outlined"
              onClick={() => handleOpenGuestOtpDialog(pendingTripPayload)}
              disabled={otpLoading}
              sx={{ textTransform: "none", fontWeight: 800 }}
            >
              {otpLoading ? "Đang gửi..." : "Gửi lại mã"}
            </Button>
          )}

          <Button
            variant="contained"
            onClick={handleVerifyGuestOtpAndCreateTrip}
            disabled={otpLoading || isOtpExpired}
            sx={{ textTransform: "none", fontWeight: 900 }}
          >
            {otpLoading ? "Đang xác nhận..." : "Xác nhận OTP"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Toast */}
      <Snackbar
        open={toast.open}
        autoHideDuration={3500}
        onClose={() => setToast((t) => ({ ...t, open: false }))}
        anchorOrigin={{ vertical: "top", horizontal: "center" }}
        style={{
          top: HEADER_H + 10,
          zIndex: 20000,
        }}
      >
        <Alert
          onClose={() => setToast((t) => ({ ...t, open: false }))}
          severity={toast.severity}
          variant="filled"
          sx={{ fontWeight: 800 }}
        >
          {toast.message}
        </Alert>
      </Snackbar>
    </Container>
  );
}
