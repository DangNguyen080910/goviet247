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
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { TimePicker } from "@mui/x-date-pickers/TimePicker";
import dayjs from "dayjs";
import updateLocale from "dayjs/plugin/updateLocale";
import localeData from "dayjs/plugin/localeData";
import "dayjs/locale/vi";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";

dayjs.extend(updateLocale);
dayjs.extend(localeData);

dayjs.updateLocale("vi", {
  weekStart: 1,
});

dayjs.locale("vi");

import { CUSTOMER_SCROLL_ID, HEADER_H } from "./CustomerLayout";
import { useNavigate } from "react-router-dom";
import { quotePrice } from "../../api/pricing";
import { createTrip } from "../../api/trips";
import { getPublicTripConfig } from "../../api/publicConfig";
import { requestOtp, verifyOtp, getMe } from "../../api/auth";
import { useCustomerAuth } from "../../context/CustomerAuthContext";
import { searchPlaces, getPlaceDetail, getRoute } from "../../api/maps";

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

function combineDateTime(dateObj, timeObj) {
  if (!dateObj || !timeObj) return "";

  const d = dayjs(dateObj);
  const t = dayjs(timeObj);

  const combined = d.hour(t.hour()).minute(t.minute()).second(0).millisecond(0);

  // ❗ KHÔNG dùng toISOString nữa
  return combined.format("YYYY-MM-DDTHH:mm:ss");
}

function isDateTimeInPast(dateObj, timeObj) {
  const iso = combineDateTime(dateObj, timeObj);
  if (!iso) return false;

  const valueMs = new Date(iso).getTime();
  if (!Number.isFinite(valueMs)) return false;

  return valueMs <= Date.now();
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

function formatDurationMinutes(totalMinutes) {
  const safeMinutes = Math.max(0, Math.round(Number(totalMinutes || 0)));

  if (safeMinutes < 60) {
    return `${safeMinutes} phút`;
  }

  const hours = Math.floor(safeMinutes / 60);
  const minutes = safeMinutes % 60;

  if (minutes === 0) {
    return `${hours} giờ`;
  }

  return `${hours} giờ ${String(minutes).padStart(2, "0")} phút`;
}

function buildHourOptions() {
  return Array.from({ length: 24 }, (_, hour) => String(hour).padStart(2, "0"));
}

function buildMinuteOptions(stepMinutes = 5) {
  return Array.from({ length: Math.floor(60 / stepMinutes) }, (_, idx) =>
    String(idx * stepMinutes).padStart(2, "0"),
  );
}

function updateTimePart(currentValue, part, value) {
  const base = currentValue
    ? dayjs(currentValue)
    : dayjs().second(0).millisecond(0);
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) return currentValue;

  if (part === "hour") {
    return base.hour(numericValue).second(0).millisecond(0);
  }

  return base.minute(numericValue).second(0).millisecond(0);
}

function formatWeekdayHeader(day) {
  const dayIndex =
    typeof day?.day === "function"
      ? day.day()
      : typeof day?.getDay === "function"
        ? day.getDay()
        : null;

  if (dayIndex === 1) return "T2";
  if (dayIndex === 2) return "T3";
  if (dayIndex === 3) return "T4";
  if (dayIndex === 4) return "T5";
  if (dayIndex === 5) return "T6";
  if (dayIndex === 6) return "T7";
  if (dayIndex === 0) return "CN";

  const value = String(day || "").toLowerCase();

  if (value.includes("mon")) return "T2";
  if (value.includes("tue")) return "T3";
  if (value.includes("wed")) return "T4";
  if (value.includes("thu")) return "T5";
  if (value.includes("fri")) return "T6";
  if (value.includes("sat")) return "T7";
  if (value.includes("sun")) return "CN";

  return String(day || "")
    .slice(0, 2)
    .toUpperCase();
}

export default function BookingCard() {
  const navigate = useNavigate();
  const { user, login } = useCustomerAuth();

  const ZALO_BTN_HEIGHT = 64; // chiều cao button Zalo
  const ZALO_BTN_MARGIN = 20; // khoảng cách giữa 2 button

  const [pickupAddress, setPickupAddress] = useState("");
  const [pickupPlace, setPickupPlace] = useState(null);
  const [pickupOptions, setPickupOptions] = useState([]);
  const [pickupLoading, setPickupLoading] = useState(false);
  const [gpsLocation, setGpsLocation] = useState(null);

  const [stops, setStops] = useState([""]);
  const [stopPlaces, setStopPlaces] = useState([null]);
  const [stopOptions, setStopOptions] = useState([[]]);
  const [stopLoadingMap, setStopLoadingMap] = useState({});
  const [pickupDate, setPickupDate] = useState(null);
  const [pickupTimeOnly, setPickupTimeOnly] = useState(null);

  const [returnDate, setReturnDate] = useState(null);
  const [returnTimeOnly, setReturnTimeOnly] = useState(null);
  const [direction, setDirection] = useState("ONE_WAY");
  const [carType, setCarType] = useState("CAR_5");

  const [riderName, setRiderName] = useState("");
  const [riderPhone, setRiderPhone] = useState("");
  const [note, setNote] = useState("");

  const [distanceKm, setDistanceKm] = useState("");
  const [driveMinutes, setDriveMinutes] = useState("");
  const [outboundDriveMinutes, setOutboundDriveMinutes] = useState("");
  const [returnDriveMinutes, setReturnDriveMinutes] = useState("");
  const [isRouteLoading, setIsRouteLoading] = useState(false);

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
  const latestRouteRequestRef = useRef(0);
  const pickupAutocompleteTimerRef = useRef(null);
  const stopAutocompleteTimersRef = useRef({});
  const autocompleteCacheRef = useRef(new Map());
  const lastAutocompleteKeyRef = useRef(null);

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
  const hourOptions = useMemo(() => buildHourOptions(), []);
  const minuteOptions = useMemo(() => buildMinuteOptions(5), []);

  // ✅ Lấy scroll container thật
  const getScrollEl = () => {
    return document.getElementById(CUSTOMER_SCROLL_ID);
  };

  const buildAutocompleteCacheKey = (keyword, lat, lng) => {
    const safeKeyword = String(keyword || "")
      .trim()
      .toLowerCase();
    const safeLat = Number.isFinite(Number(lat))
      ? Number(lat).toFixed(3)
      : "na";
    const safeLng = Number.isFinite(Number(lng))
      ? Number(lng).toFixed(3)
      : "na";

    return `${safeKeyword}__${safeLat}__${safeLng}`;
  };

  const getCachedAutocompleteItems = (keyword, lat, lng) => {
    const key = buildAutocompleteCacheKey(keyword, lat, lng);
    return autocompleteCacheRef.current.get(key) || null;
  };

  const setCachedAutocompleteItems = (keyword, lat, lng, items) => {
    const key = buildAutocompleteCacheKey(keyword, lat, lng);

    autocompleteCacheRef.current.set(key, Array.isArray(items) ? items : []);

    if (autocompleteCacheRef.current.size > 100) {
      const oldestKey = autocompleteCacheRef.current.keys().next().value;
      if (oldestKey) {
        autocompleteCacheRef.current.delete(oldestKey);
      }
    }
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

  useEffect(() => {
    let cancelled = false;

    if (!("geolocation" in navigator)) {
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (cancelled) return;

        setGpsLocation({
          lat: Number(position.coords.latitude),
          lng: Number(position.coords.longitude),
        });
      },
      () => {
        // User từ chối GPS hoặc thiết bị không lấy được vị trí
      },
      {
        enableHighAccuracy: true,
        timeout: 8000,
        maximumAge: 5 * 60 * 1000,
      },
    );

    return () => {
      cancelled = true;
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
    setDistanceKm("");
    setDriveMinutes("");
    setOutboundDriveMinutes("");
    setReturnDriveMinutes("");
  };

  const filledStopCount = useMemo(
    () => stops.filter((s) => s.trim()).length,
    [stops],
  );

  const hasValidPickupSelection = useMemo(() => {
    return (
      !!pickupPlace?.placeId &&
      Number.isFinite(Number(pickupPlace?.lat)) &&
      Number.isFinite(Number(pickupPlace?.lng))
    );
  }, [pickupPlace]);

  const hasValidStopSelections = useMemo(() => {
    return stops.every((value, idx) => {
      const text = String(value || "").trim();

      if (!text) return true;

      const place = stopPlaces[idx];

      return (
        !!place?.placeId &&
        Number.isFinite(Number(place?.lat)) &&
        Number.isFinite(Number(place?.lng))
      );
    });
  }, [stops, stopPlaces]);

  const hasAtLeastOneSelectedStop = useMemo(() => {
    return stops.some((value, idx) => {
      const text = String(value || "").trim();
      const place = stopPlaces[idx];

      return (
        !!text &&
        !!place?.placeId &&
        Number.isFinite(Number(place?.lat)) &&
        Number.isFinite(Number(place?.lng))
      );
    });
  }, [stops, stopPlaces]);

  const showAddressSelectionWarning = useMemo(() => {
    const hasTypedPickup = !!pickupAddress.trim();
    const hasTypedStops = stops.some((value) => String(value || "").trim());

    if (!hasTypedPickup && !hasTypedStops) return false;

    if (hasTypedPickup && !hasValidPickupSelection) return true;
    if (!hasValidStopSelections) return true;

    return false;
  }, [pickupAddress, stops, hasValidPickupSelection, hasValidStopSelections]);

  useEffect(() => {
    if (direction === "ONE_WAY") {
      setReturnDate(null);
      setReturnTimeOnly(null);
    }
  }, [direction]);

  useEffect(() => {
    const keyword = pickupAddress.trim();
    const lat = gpsLocation?.lat;
    const lng = gpsLocation?.lng;

    const currentKey = buildAutocompleteCacheKey(keyword, lat, lng);

    if (lastAutocompleteKeyRef.current === currentKey) {
      return;
    }

    lastAutocompleteKeyRef.current = currentKey;

    clearTimeout(pickupAutocompleteTimerRef.current);

    if (!keyword || keyword.length < 3) {
      setPickupOptions([]);
      setPickupLoading(false);
      return;
    }

    const cachedItems = getCachedAutocompleteItems(keyword, lat, lng);
    if (cachedItems) {
      setPickupOptions(cachedItems);
      setPickupLoading(false);
      return;
    }

    pickupAutocompleteTimerRef.current = setTimeout(async () => {
      try {
        setPickupLoading(true);

        const items = await searchPlaces(keyword, { lat, lng });

        setPickupOptions(items);
        setCachedAutocompleteItems(keyword, lat, lng, items);
      } catch {
        setPickupOptions([]);
      } finally {
        setPickupLoading(false);
      }
    }, 400);

    return () => {
      clearTimeout(pickupAutocompleteTimerRef.current);
    };
  }, [pickupAddress, gpsLocation?.lat, gpsLocation?.lng]);

  useEffect(() => {
    stops.forEach((value, idx) => {
      const keyword = String(value || "").trim();
      const lat = gpsLocation?.lat;
      const lng = gpsLocation?.lng;

      if (stopAutocompleteTimersRef.current[idx]) {
        clearTimeout(stopAutocompleteTimersRef.current[idx]);
      }

      if (!keyword || keyword.length < 3) {
        setStopOptions((prev) =>
          prev.map((items, i) => (i === idx ? [] : items)),
        );
        setStopLoadingMap((prev) => ({ ...prev, [idx]: false }));
        return;
      }

      const cachedItems = getCachedAutocompleteItems(keyword, lat, lng);
      if (cachedItems) {
        setStopOptions((prev) =>
          prev.map((oldItems, i) => (i === idx ? cachedItems : oldItems)),
        );
        setStopLoadingMap((prev) => ({ ...prev, [idx]: false }));
        return;
      }

      stopAutocompleteTimersRef.current[idx] = setTimeout(async () => {
        try {
          setStopLoadingMap((prev) => ({ ...prev, [idx]: true }));

          const items = await searchPlaces(keyword, { lat, lng });

          setStopOptions((prev) =>
            prev.map((oldItems, i) => (i === idx ? items : oldItems)),
          );
          setCachedAutocompleteItems(keyword, lat, lng, items);
        } catch {
          setStopOptions((prev) =>
            prev.map((oldItems, i) => (i === idx ? [] : oldItems)),
          );
        } finally {
          setStopLoadingMap((prev) => ({ ...prev, [idx]: false }));
        }
      }, 400);
    });

    return () => {
      Object.values(stopAutocompleteTimersRef.current).forEach((timerId) => {
        clearTimeout(timerId);
      });
    };
  }, [stops, gpsLocation?.lat, gpsLocation?.lng]);

  const pickupMs = useMemo(() => {
    const iso = combineDateTime(pickupDate, pickupTimeOnly);
    return iso ? new Date(iso).getTime() : NaN;
  }, [pickupDate, pickupTimeOnly]);

  const isPickupTimeInPast = useMemo(() => {
    if (!pickupDate || !pickupTimeOnly) return false;
    return isDateTimeInPast(pickupDate, pickupTimeOnly);
  }, [pickupDate, pickupTimeOnly]);

  const returnMs = useMemo(() => {
    const iso = combineDateTime(returnDate, returnTimeOnly);
    return iso ? new Date(iso).getTime() : NaN;
  }, [returnDate, returnTimeOnly]);

  const numericDriveMinutes = Number(driveMinutes);
  const numericOutboundDriveMinutes = Number(outboundDriveMinutes);

  const isReturnTimeValid = useMemo(() => {
    if (direction !== "ROUND_TRIP") return true;

    if (!pickupDate || !pickupTimeOnly || !returnDate || !returnTimeOnly) {
      return false;
    }

    if (!Number.isFinite(numericOutboundDriveMinutes)) {
      return false;
    }

    const earliestReturnMs = pickupMs + numericOutboundDriveMinutes * 60000;

    return returnMs >= earliestReturnMs;
  }, [
    direction,
    pickupDate,
    pickupTimeOnly,
    returnDate,
    returnTimeOnly,
    pickupMs,
    returnMs,
    numericOutboundDriveMinutes,
  ]);

  const estimatedExtraMinutes = useMemo(() => {
    if (direction !== "ROUND_TRIP") return 0;

    if (
      !pickupDate ||
      !pickupTimeOnly ||
      !returnDate ||
      !returnTimeOnly ||
      !Number.isFinite(numericOutboundDriveMinutes)
    ) {
      return 0;
    }

    const totalGapMinutes = Math.max(
      0,
      Math.round((returnMs - pickupMs) / 60000),
    );

    const extraMinutes = totalGapMinutes - numericOutboundDriveMinutes;

    return Math.max(0, extraMinutes);
  }, [
    direction,
    pickupDate,
    pickupTimeOnly,
    returnDate,
    returnTimeOnly,
    pickupMs,
    returnMs,
    numericOutboundDriveMinutes,
  ]);

  const estimatedTripMinutes = useMemo(() => {
    if (!Number.isFinite(numericDriveMinutes)) return 0;

    if (direction !== "ROUND_TRIP") {
      return numericDriveMinutes;
    }

    return numericDriveMinutes + estimatedExtraMinutes;
  }, [direction, numericDriveMinutes, estimatedExtraMinutes]);

  const estimatedTripDurationLabel = useMemo(() => {
    if (!estimatedTripMinutes) return "";
    return formatDurationMinutes(estimatedTripMinutes);
  }, [estimatedTripMinutes]);

  // Khi thay input => reset quote
  useEffect(() => {
    setQuote(null);
  }, [
    pickupAddress,
    stops,
    pickupDate,
    pickupTimeOnly,
    returnDate,
    returnTimeOnly,
    direction,
    carType,
    distanceKm,
    driveMinutes,
    outboundDriveMinutes,
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

  const quoteRaw = quote?.raw || null;
  const quoteDirection = quoteRaw?.direction || "";
  const quoteWaitMinutes = Number(quoteRaw?.waitMinutes || 0);
  const quoteFreeWaitingMinutes = Number(quoteRaw?.freeWaitingMinutes || 0);
  const quoteBillableWaitMinutes = Number(quoteRaw?.billableWaitMinutes || 0);
  const quoteWaitCost = Number(quoteRaw?.waitCost || 0);

  const shouldShowWaitingBreakdown =
    quoteDirection === "ROUND_TRIP" &&
    (quoteWaitMinutes > 0 ||
      quoteFreeWaitingMinutes > 0 ||
      quoteBillableWaitMinutes > 0 ||
      quoteWaitCost > 0);

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
    hasValidPickupSelection &&
    hasAtLeastOneSelectedStop &&
    hasValidStopSelections &&
    pickupDate &&
    pickupTimeOnly &&
    !isPickupTimeInPast &&
    direction &&
    carType &&
    (direction === "ONE_WAY"
      ? true
      : returnDate && returnTimeOnly && isReturnTimeValid) &&
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

  useEffect(() => {
    if (pickupPlace && stopPlaces.some((p) => p)) {
      refreshRouteFromPlaces(pickupPlace, stopPlaces, { silent: true });
    }
  }, [direction]);

  const refreshRouteFromPlaces = async (
    nextPickupPlace,
    nextStopPlaces,
    options = {},
  ) => {
    const { silent = false } = options;

    const requestId = Date.now() + Math.random();
    latestRouteRequestRef.current = requestId;

    const hasPickupCoords =
      nextPickupPlace &&
      Number.isFinite(Number(nextPickupPlace.lat)) &&
      Number.isFinite(Number(nextPickupPlace.lng));

    const hasAllStopsValid =
      (nextStopPlaces || []).length > 0 &&
      (nextStopPlaces || []).every(
        (item) =>
          item &&
          Number.isFinite(Number(item.lat)) &&
          Number.isFinite(Number(item.lng)),
      );

    if (!hasPickupCoords || !hasAllStopsValid) {
      if (latestRouteRequestRef.current === requestId) {
        setDistanceKm("");
        setDriveMinutes("");
        setOutboundDriveMinutes("");
        setIsRouteLoading(false);
      }
      return;
    }

    const resolvedStopPlaces = nextStopPlaces;

    if (!hasPickupCoords || resolvedStopPlaces.length === 0) {
      if (latestRouteRequestRef.current === requestId) {
        setDistanceKm("");
        setDriveMinutes("");
        setOutboundDriveMinutes("");
        setIsRouteLoading(false);
      }
      return;
    }

    try {
      setIsRouteLoading(true);

      const validStops = [];

      for (let i = 0; i < stops.length; i++) {
        const text = stops[i];
        const place = nextStopPlaces[i];

        if (
          text &&
          place &&
          Number.isFinite(Number(place.lat)) &&
          Number.isFinite(Number(place.lng))
        ) {
          validStops.push({
            lat: Number(place.lat),
            lng: Number(place.lng),
          });
        }
      }

      if (validStops.length !== stops.filter((s) => s.trim()).length) {
        if (latestRouteRequestRef.current === requestId) {
          setDistanceKm("");
          setDriveMinutes("");
          setOutboundDriveMinutes("");
          setIsRouteLoading(false);
        }
        return;
      }

      let points = [
        {
          lat: Number(nextPickupPlace.lat),
          lng: Number(nextPickupPlace.lng),
        },
        ...validStops,
      ];

      if (direction === "ROUND_TRIP") {
        points.push({
          lat: Number(nextPickupPlace.lat),
          lng: Number(nextPickupPlace.lng),
        });
      }

      const route = await getRoute(points);

      // ✅ Chỉ request mới nhất mới được quyền update UI
      if (latestRouteRequestRef.current !== requestId) {
        return;
      }

      if (Number.isFinite(Number(route?.distanceKm))) {
        setDistanceKm(String(route.distanceKm));
      } else {
        setDistanceKm("");
      }

      if (Number.isFinite(Number(route?.durationMinutes))) {
        setDriveMinutes(String(route.durationMinutes));
      } else {
        setDriveMinutes("");
      }

      const resolvedOutboundMinutes =
        route?.outboundDurationMinutes ??
        route?.outboundDuration ??
        route?.outboundMinutes ??
        null;

      const resolvedReturnMinutes =
        route?.returnDurationMinutes ??
        route?.returnDuration ??
        route?.returnMinutes ??
        null;

      if (Number.isFinite(Number(resolvedOutboundMinutes))) {
        setOutboundDriveMinutes(String(resolvedOutboundMinutes));
      } else if (
        direction === "ROUND_TRIP" &&
        Number.isFinite(Number(route?.durationMinutes))
      ) {
        setOutboundDriveMinutes(
          String(Math.round(Number(route.durationMinutes) / 2)),
        );
      } else {
        setOutboundDriveMinutes("");
      }

      if (Number.isFinite(Number(resolvedReturnMinutes))) {
        setReturnDriveMinutes(String(resolvedReturnMinutes));
      } else if (direction === "ROUND_TRIP") {
        setReturnDriveMinutes("");
      } else {
        setReturnDriveMinutes("");
      }
    } catch (e) {
      if (latestRouteRequestRef.current !== requestId) {
        return;
      }

      if (!silent) {
        setToast({
          open: true,
          severity: "warning",
          message:
            e?.message || "Không lấy được quãng đường thực tế từ bản đồ.",
        });
      }
    } finally {
      if (latestRouteRequestRef.current === requestId) {
        setIsRouteLoading(false);
      }
    }
  };

  const resetFormAfterSuccess = () => {
    setPickupAddress("");
    setPickupPlace(null);
    setPickupOptions([]);
    setStops([""]);
    setStopPlaces([null]);
    setStopOptions([[]]);
    setStopLoadingMap({});
    setPickupDate(null);
    setPickupTimeOnly(null);
    setReturnDate(null);
    setReturnTimeOnly(null);
    setDirection("ONE_WAY");
    setCarType(carTypeOptions[0]?.value || "CAR_5");

    // Reset về rỗng để effect auto fill nạp lại từ session nếu user đã login
    setRiderName("");
    setRiderPhone("");
    setNote("");

    setDistanceKm("");
    setDriveMinutes("");
    setOutboundDriveMinutes("");

    setQuote(null);
    setSubmitTouched(false);

    const scroller = getScrollEl();
    if (scroller) scroller.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSelectPickupPlace = async (_, option) => {
    if (!option?.placeId) {
      setPickupPlace(null);
      setDistanceKm("");
      setDriveMinutes("");
      setOutboundDriveMinutes("");
      setStopPlaces([null]);
      setStops([""]);
      return;
    }

    try {
      setPickupLoading(true);

      const detail = await getPlaceDetail(option.placeId);

      setPickupPlace(detail);
      setPickupAddress(option?.fullAddress || detail?.fullAddress || "");
      setPickupOptions([]);

      await refreshRouteFromPlaces(detail, stopPlaces, { silent: true });
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
      const nextStopPlaces = stopPlaces.map((p, i) => (i === idx ? null : p));

      setStopPlaces(nextStopPlaces);
      setStops((prev) => prev.map((value, i) => (i === idx ? "" : value)));
      setStopOptions((prev) =>
        prev.map((items, i) => (i === idx ? [] : items)),
      );
      setDistanceKm("");
      setDriveMinutes("");
      setOutboundDriveMinutes("");

      await refreshRouteFromPlaces(pickupPlace, nextStopPlaces, {
        silent: true,
      });
      return;
    }

    try {
      setStopLoadingMap((prev) => ({ ...prev, [idx]: true }));

      const detail = await getPlaceDetail(option.placeId);

      const nextStopPlaces = stopPlaces.map((p, i) => (i === idx ? detail : p));

      setStopPlaces(nextStopPlaces);
      setStops((prev) =>
        prev.map((value, i) =>
          i === idx ? option?.fullAddress || detail?.fullAddress || "" : value,
        ),
      );
      setStopOptions((prev) =>
        prev.map((items, i) => (i === idx ? [] : items)),
      );

      await refreshRouteFromPlaces(pickupPlace, nextStopPlaces, {
        silent: true,
      });
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
    if (!hasValidPickupSelection) {
      setToast({
        open: true,
        severity: "warning",
        message: "Vui lòng chọn điểm đón từ danh sách gợi ý.",
      });
      return;
    }

    if (isPickupTimeInPast) {
      setToast({
        open: true,
        severity: "warning",
        message: "Không được chọn thời gian đón trong quá khứ.",
      });
      return;
    }

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
        pickupTime: combineDateTime(pickupDate, pickupTimeOnly),
        returnTime:
          direction === "ROUND_TRIP"
            ? combineDateTime(returnDate, returnTimeOnly)
            : null,
        distanceKm: Number(distanceKm),
        driveMinutes: Number(driveMinutes),
        outboundDriveMinutes:
          direction === "ROUND_TRIP"
            ? Number(outboundDriveMinutes)
            : Number(driveMinutes),
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
    if (!hasValidPickupSelection) {
      throw new Error("Vui lòng chọn điểm đón từ danh sách gợi ý.");
    }

    const selectedStops = stops
      .map((text, idx) => ({
        text: String(text || "").trim(),
        place: stopPlaces[idx] || null,
      }))
      .filter((item) => item.text);

    if (selectedStops.length === 0) {
      throw new Error("Vui lòng nhập ít nhất 1 điểm đến.");
    }

    if (selectedStops.length > maxStops) {
      throw new Error(`Số điểm đến vượt quá giới hạn ${maxStops} điểm.`);
    }

    const hasInvalidStop = selectedStops.some(
      (item) =>
        !item.place?.placeId ||
        !Number.isFinite(Number(item.place?.lat)) ||
        !Number.isFinite(Number(item.place?.lng)),
    );

    if (hasInvalidStop) {
      throw new Error("Vui lòng chọn đầy đủ các điểm đến từ danh sách gợi ý.");
    }

    if (isPickupTimeInPast) {
      throw new Error("Không được chọn thời gian đón trong quá khứ.");
    }

    if (!isDistanceValid) {
      throw new Error(
        `Quãng đường phải từ ${minDistanceKm} km đến ${maxDistanceKm} km.`,
      );
    }

    const cleanedStops = selectedStops
      .map((item) => item.place?.fullAddress || item.text)
      .filter(Boolean);

    const pickupFullAddress =
      pickupPlace?.fullAddress || String(pickupAddress || "").trim();

    const dropoffAddress = cleanedStops[cleanedStops.length - 1] || "";
    const finalNote = note?.trim() || null;

    const safeTotalDriveMinutes = Number(driveMinutes);
    const safeOutboundDriveMinutes =
      direction === "ROUND_TRIP"
        ? Number(outboundDriveMinutes)
        : Number(driveMinutes);

    const safeReturnDriveMinutes =
      direction === "ROUND_TRIP" ? Number(returnDriveMinutes) : 0;

    const safeEstimatedDurationMinutes =
      direction === "ROUND_TRIP"
        ? Number(estimatedTripMinutes)
        : Number(driveMinutes);

    return {
      pickupAddress: pickupFullAddress,
      dropoffAddress,
      stops: cleanedStops,
      pickupTime: combineDateTime(pickupDate, pickupTimeOnly),
      returnTime:
        direction === "ROUND_TRIP"
          ? combineDateTime(returnDate, returnTimeOnly)
          : null,
      direction,
      carType,
      distanceKm: Number(distanceKm),

      totalDriveMinutes: safeTotalDriveMinutes,
      driveMinutes: safeTotalDriveMinutes,

      outboundDriveMinutes: safeOutboundDriveMinutes,
      returnDriveMinutes: safeReturnDriveMinutes,

      estimatedDurationMinutes: safeEstimatedDurationMinutes,

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
                      setDistanceKm("");
                      setDriveMinutes("");
                      setOutboundDriveMinutes("");
                    }

                    if (reason === "clear") {
                      setPickupAddress("");
                      setPickupPlace(null);
                      setPickupOptions([]);
                      setDistanceKm("");
                      setDriveMinutes("");
                      setOutboundDriveMinutes("");
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
                          disablePortal
                          options={stopOptions[idx] || []}
                          loading={!!stopLoadingMap[idx]}
                          value={stopPlaces[idx] || null}
                          inputValue={s}
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
                              placeholder={
                                idx === 0
                                  ? "Ví dụ: Khách sạn Dalat Palace, 02 Trần Phú, Phường 3, Đà Lạt"
                                  : "Ví dụ: Thung Lũng Tình Yêu, 05-07 Mai Anh Đào, Phường 8, Đà Lạt"
                              }
                              inputProps={{
                                ...params.inputProps,
                                autoComplete: "new-password",
                              }}
                              onChange={(e) => {
                                const value = e.target.value;
                                handleChangeStop(idx, value);

                                if (!value.trim()) {
                                  setStopOptions((prev) =>
                                    prev.map((items, i) =>
                                      i === idx ? [] : items,
                                    ),
                                  );
                                }
                              }}
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

                <Stack spacing={0.6}>
                  <Typography variant="body2" sx={{ opacity: 0.78 }}>
                    Vui lòng chọn địa chỉ từ danh sách gợi ý để hệ thống tính
                    giá chính xác.
                  </Typography>

                  <Typography variant="body2" sx={{ opacity: 0.68 }}>
                    Bạn có thể nhập thêm số nhà, tên khách sạn, nhà hàng hoặc
                    địa điểm cụ thể để dễ tìm đúng vị trí hơn.
                  </Typography>

                  {showAddressSelectionWarning && (
                    <Typography
                      variant="body2"
                      sx={{ color: "warning.main", fontWeight: 800 }}
                    >
                      Bạn đang nhập địa chỉ dạng text. Hãy bấm chọn đúng địa chỉ
                      trong danh sách gợi ý trước khi tính giá.
                    </Typography>
                  )}
                </Stack>

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

                <LocalizationProvider
                  dateAdapter={AdapterDayjs}
                  adapterLocale="vi"
                >
                  <Stack direction={{ xs: "column", sm: "row" }} spacing={1.2}>
                    <DatePicker
                      label="Ngày đón khách"
                      value={pickupDate}
                      format="DD/MM/YYYY"
                      dayOfWeekFormatter={formatWeekdayHeader}
                      onChange={(newValue) => setPickupDate(newValue)}
                      slotProps={{
                        textField: { fullWidth: true, size: "small" },
                      }}
                    />
                    <Stack direction="row" spacing={1.2} sx={{ width: "100%" }}>
                      <FormControl fullWidth size="small">
                        <InputLabel>Giờ</InputLabel>
                        <Select
                          label="Giờ"
                          value={
                            pickupTimeOnly
                              ? dayjs(pickupTimeOnly).format("HH")
                              : ""
                          }
                          onChange={(e) => {
                            setPickupTimeOnly((prev) =>
                              updateTimePart(prev, "hour", e.target.value),
                            );
                          }}
                          MenuProps={{
                            PaperProps: { sx: { maxHeight: 280 } },
                          }}
                        >
                          {hourOptions.map((hour) => (
                            <MenuItem key={hour} value={hour}>
                              {hour}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>

                      <FormControl fullWidth size="small">
                        <InputLabel>Phút</InputLabel>
                        <Select
                          label="Phút"
                          value={
                            pickupTimeOnly
                              ? dayjs(pickupTimeOnly).format("mm")
                              : ""
                          }
                          onChange={(e) => {
                            setPickupTimeOnly((prev) =>
                              updateTimePart(prev, "minute", e.target.value),
                            );
                          }}
                          MenuProps={{
                            PaperProps: { sx: { maxHeight: 280 } },
                          }}
                        >
                          {minuteOptions.map((minute) => (
                            <MenuItem key={minute} value={minute}>
                              {minute}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </Stack>
                  </Stack>
                  {pickupDate && pickupTimeOnly && isPickupTimeInPast && (
                    <Typography
                      variant="body2"
                      sx={{ color: "error.main", fontWeight: 800 }}
                    >
                      Không được chọn thời gian đón trong quá khứ.
                    </Typography>
                  )}
                </LocalizationProvider>

                {direction === "ROUND_TRIP" && (
                  <LocalizationProvider
                    dateAdapter={AdapterDayjs}
                    adapterLocale="vi"
                  >
                    <Stack
                      direction={{ xs: "column", sm: "row" }}
                      spacing={1.2}
                    >
                      <DatePicker
                        label="Ngày quay về"
                        value={returnDate}
                        format="DD/MM/YYYY"
                        dayOfWeekFormatter={formatWeekdayHeader}
                        onChange={(newValue) => setReturnDate(newValue)}
                        slotProps={{
                          textField: { fullWidth: true, size: "small" },
                        }}
                      />
                      <Stack
                        direction="row"
                        spacing={1.2}
                        sx={{ width: "100%" }}
                      >
                        <FormControl fullWidth size="small">
                          <InputLabel>Giờ về</InputLabel>
                          <Select
                            label="Giờ về"
                            value={
                              returnTimeOnly
                                ? dayjs(returnTimeOnly).format("HH")
                                : ""
                            }
                            onChange={(e) => {
                              setReturnTimeOnly((prev) =>
                                updateTimePart(prev, "hour", e.target.value),
                              );
                            }}
                            MenuProps={{
                              PaperProps: { sx: { maxHeight: 280 } },
                            }}
                          >
                            {hourOptions.map((hour) => (
                              <MenuItem key={hour} value={hour}>
                                {hour}
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>

                        <FormControl fullWidth size="small">
                          <InputLabel>Phút về</InputLabel>
                          <Select
                            label="Phút về"
                            value={
                              returnTimeOnly
                                ? dayjs(returnTimeOnly).format("mm")
                                : ""
                            }
                            onChange={(e) => {
                              setReturnTimeOnly((prev) =>
                                updateTimePart(prev, "minute", e.target.value),
                              );
                            }}
                            MenuProps={{
                              PaperProps: { sx: { maxHeight: 280 } },
                            }}
                          >
                            {minuteOptions.map((minute) => (
                              <MenuItem key={minute} value={minute}>
                                {minute}
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      </Stack>
                    </Stack>
                  </LocalizationProvider>
                )}

                {direction === "ROUND_TRIP" &&
                  pickupDate &&
                  pickupTimeOnly &&
                  (!returnDate || !returnTimeOnly) && (
                    <Typography
                      variant="body2"
                      sx={{ color: "error.main", fontWeight: 800 }}
                    >
                      Vui lòng chọn thời gian quay về để tính giá khứ hồi
                    </Typography>
                  )}

                {direction === "ROUND_TRIP" &&
                  pickupDate &&
                  pickupTimeOnly &&
                  returnDate &&
                  returnTimeOnly &&
                  !isReturnTimeValid && (
                    <Typography
                      variant="body2"
                      sx={{ color: "error.main", fontWeight: 800 }}
                    >
                      Giờ quay về phải sau thời điểm xe dự kiến đã tới điểm đến.
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

              {/* 3.5) Thông tin quãng đường (read-only) */}
              <Stack spacing={1.2}>
                <Typography
                  sx={{ fontWeight: 800, fontSize: 13, opacity: 0.85 }}
                >
                  Thông tin quãng đường
                </Typography>

                {distanceKm && driveMinutes ? (
                  <Stack spacing={0.5}>
                    <Typography sx={{ fontWeight: 700 }}>
                      Quãng đường dự kiến: {distanceKm} km
                    </Typography>

                    <Typography sx={{ fontWeight: 700 }}>
                      Thời gian chuyến đi dự kiến:{" "}
                      {estimatedTripDurationLabel ||
                        formatDurationMinutes(driveMinutes)}
                    </Typography>

                    <Typography variant="body2" sx={{ opacity: 0.65 }}>
                      Thông tin được hệ thống tính tự động từ lộ trình bản đồ và
                      loại chuyến bạn đã chọn.
                    </Typography>

                    {direction === "ROUND_TRIP" &&
                      !!returnDate &&
                      !!returnTimeOnly && (
                        <Typography variant="body2" sx={{ opacity: 0.6 }}>
                          Đối với chuyến khứ hồi, hệ thống ước tính tổng thời
                          gian theo lộ trình và giờ quay về bạn đã chọn.
                        </Typography>
                      )}
                  </Stack>
                ) : (
                  <Typography variant="body2" sx={{ opacity: 0.7 }}>
                    Chọn điểm đón và ít nhất 1 điểm đến từ gợi ý để hệ thống tự
                    tính quãng đường.
                  </Typography>
                )}

                {isRouteLoading && (
                  <Typography
                    variant="body2"
                    sx={{ opacity: 0.75, fontWeight: 700 }}
                  >
                    Đang tính lộ trình...
                  </Typography>
                )}
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
                  placeholder="Ví dụ: Yêu cầu xe Fortuner đời 2023+, xe xăng, xe điện, xe biển trắng, có thú cưng, có em bé, ..."
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

              <Box sx={{ mt: 0.5, mb: 1.5 }}>
                <Typography
                  variant="body2"
                  sx={{ opacity: 0.8, fontWeight: 700 }}
                >
                  ✅ Đây là giá trọn gói, đã bao gồm phí cầu đường, cao tốc và
                  chi phí ăn nghỉ của tài xế trong toàn hành trình. Không phát
                  sinh thêm.
                </Typography>

                <Typography
                  variant="body2"
                  sx={{ opacity: 0.85, fontWeight: 700 }}
                >
                  🚗 Thanh toán trực tiếp cho tài xế sau khi hoàn thành chuyến
                  đi
                </Typography>

                <Typography
                  variant="body2"
                  sx={{ opacity: 0.75, fontWeight: 600 }}
                >
                  💡 Đi càng xa, giá mỗi km càng rẻ
                </Typography>
              </Box>
              {shouldShowWaitingBreakdown && (
                <Box
                  sx={{
                    mt: 0.5,
                    p: 1.25,
                    borderRadius: 2,
                    bgcolor: "rgba(0,0,0,0.03)",
                    border: "1px solid rgba(0,0,0,0.06)",
                  }}
                >
                  {/* <Stack spacing={0.5}>
                    <Typography sx={{ fontWeight: 800, fontSize: 14 }}>
                      Chi tiết thời gian chờ
                    </Typography>

                    <Typography variant="body2" sx={{ opacity: 0.8 }}>
                      Thời gian chờ:{" "}
                      <b>{formatDurationMinutes(quoteWaitMinutes)}</b>
                    </Typography>

                    <Typography variant="body2" sx={{ opacity: 0.8 }}>
                      Miễn phí:{" "}
                      <b>{formatDurationMinutes(quoteFreeWaitingMinutes)}</b>
                    </Typography>

                    <Typography variant="body2" sx={{ opacity: 0.8 }}>
                      Tính phí:{" "}
                      <b>{formatDurationMinutes(quoteBillableWaitMinutes)}</b>
                    </Typography>

                    <Typography variant="body2" sx={{ opacity: 0.8 }}>
                      Phí chờ: <b>{formatVND(quoteWaitCost)}</b>
                    </Typography>
                  </Stack> */}
                </Box>
              )}

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
                    : "Đặt chuyến ngay"}
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
                ⏳ Giữ giá trong {quoteCountdownLabel}
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
              bottom:
                (quote && !isQuoteExpired ? 120 : 70) +
                ZALO_BTN_HEIGHT +
                ZALO_BTN_MARGIN,
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
