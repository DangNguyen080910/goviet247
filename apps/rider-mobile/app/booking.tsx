// Path: goviet247/apps/rider-mobile/app/booking.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { router } from "expo-router";
import DateTimePicker, {
  DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import * as Location from "expo-location";
import * as Haptics from "expo-haptics";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import AppBrandHeader from "../components/AppBrandHeader";
import { getMe, updateMe } from "../services/authApi";
import { quotePrice } from "../services/pricingApi";
import { createTrip, getRiderPublicTripConfig } from "../services/tripApi";
import { getRiderToken } from "../services/storage";
import { searchPlaces, getPlaceDetail, getRoute } from "../services/mapApi";
import {
  searchVietnamLocations,
} from "../constants/vietnamLocations";

const DEFAULT_TRIP_CONFIG = {
  maxStops: 10,
  minDistanceKm: 10,
  maxDistanceKm: 2000,
  quoteExpireSeconds: 120,
  riderBookingNotePlaceholder:
    "Ví dụ: Yêu cầu xe Fortuner đời 2023+, xe xăng, xe điện, xe biển trắng, có thú cưng, có em bé,... bạn có thể ghi thêm bất kỳ yêu cầu riêng nào",
};

const CAR_TYPE_OPTIONS = [
  { value: "CAR_5", label: "Xe 5 chỗ" },
  { value: "CAR_7", label: "Xe 7 chỗ" },
  { value: "CAR_16", label: "Xe 16 chỗ" },
];

function toMsFromDatetimeLocal(v: string) {
  if (!v) return NaN;
  return new Date(v).getTime();
}

function toDatetimeLocalInputValue(date = new Date()) {
  const pad = (n: number) => String(n).padStart(2, "0");

  const yyyy = date.getFullYear();
  const mm = pad(date.getMonth() + 1);
  const dd = pad(date.getDate());
  const hh = pad(date.getHours());
  const mi = pad(date.getMinutes());

  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}

function mergeDatePartIntoDatetimeLocal(currentValue: string, nextDate: Date) {
  const baseDate = currentValue ? new Date(currentValue) : new Date();
  const safeBaseDate = Number.isNaN(baseDate.getTime()) ? new Date() : baseDate;

  safeBaseDate.setFullYear(
    nextDate.getFullYear(),
    nextDate.getMonth(),
    nextDate.getDate(),
  );

  return toDatetimeLocalInputValue(safeBaseDate);
}

function mergeTimePartIntoDatetimeLocal(currentValue: string, nextTime: Date) {
  const baseDate = currentValue ? new Date(currentValue) : new Date();
  const safeBaseDate = Number.isNaN(baseDate.getTime()) ? new Date() : baseDate;

  safeBaseDate.setHours(nextTime.getHours(), nextTime.getMinutes(), 0, 0);

  return toDatetimeLocalInputValue(safeBaseDate);
}

function formatDateOnlyDisplay(v: string) {
  if (!v) return "Chọn ngày";

  const date = new Date(v);
  if (Number.isNaN(date.getTime())) return "Chọn ngày";

  const pad = (n: number) => String(n).padStart(2, "0");

  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
}

function formatTimeOnlyDisplay(v: string) {
  if (!v) return "Chọn giờ";

  const date = new Date(v);
  if (Number.isNaN(date.getTime())) return "Chọn giờ";

  const pad = (n: number) => String(n).padStart(2, "0");

  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatDurationMinutes(totalMinutes: number | string) {
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

function toIsoFromDatetimeLocal(v: string) {
  if (!v) return "";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString();
}

function formatVND(n: number) {
  return Number(n || 0).toLocaleString("vi-VN") + " đ";
}

function formatCountdownLabel(ms: number) {
  const safeMs = Math.max(0, Number(ms || 0));
  const totalSeconds = Math.floor(safeMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function shortTripId(id = "", n = 10) {
  if (!id) return "";
  return id.length <= n ? id : `${id.slice(0, n)}…`;
}

type MeUser = {
  id: string;
  displayName: string | null;
  riderName?: string | null;
  driverName?: string | null;
  phone: string | null;
  role: string;
  primaryRole?: string | null;
  hasDriverProfile?: boolean;
  hasRiderProfile?: boolean;
  createdAt?: string;
} | null;

function formatPhoneFromAccount(phone: string | null | undefined) {
  const raw = String(phone || "").trim();

  if (!raw) return "";

  if (raw.startsWith("+84") && raw.length >= 12) {
    return `0${raw.slice(3)}`;
  }

  return raw;
}

function getRiderDisplayName(user: MeUser) {
  return (
    String(user?.riderName || "").trim() ||
    String(user?.displayName || "").trim() ||
    ""
  );
}

type QuoteState = {
  quoteId: string;
  totalPrice: number;
  expiresAt: string;
  raw: any;
} | null;

type PlaceSuggestion = {
  placeId: string;
  name?: string;
  shortAddress?: string;
  fullAddress?: string;
  maskedAddress?: string;
  lat?: number;
  lng?: number;
  source?: string;
  isVietnamLocation?: boolean;
  place_id?: string;
  description?: string;
  formatted_address?: string;
  structured_formatting?: {
    main_text?: string;
    secondary_text?: string;
  };
};

type PlaceDetail = {
  placeId: string;
  name?: string;
  shortAddress?: string;
  fullAddress?: string;
  maskedAddress?: string;
  lat?: number;
  lng?: number;
  source?: string;
  isVietnamLocation?: boolean;
};

function buildAutocompleteCacheKey(
  keyword: string,
  lat?: number | null,
  lng?: number | null,
) {
  const safeKeyword = String(keyword || "")
    .trim()
    .toLowerCase();

  const safeLat = Number.isFinite(Number(lat)) ? Number(lat).toFixed(3) : "na";

  const safeLng = Number.isFinite(Number(lng)) ? Number(lng).toFixed(3) : "na";

  return `${safeKeyword}__${safeLat}__${safeLng}`;
}

function normalizeComparableAddress(value: string | null | undefined) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function hasPlaceCoords(place: any) {
  return (
    Number.isFinite(Number(place?.lat)) && Number.isFinite(Number(place?.lng))
  );
}

function normalizeAutocompleteOption(item: any): PlaceSuggestion | null {
  if (!item) return null;

  return {
    ...item,
    placeId: item.placeId || item.place_id,
    name:
      item.name ||
      item.shortAddress ||
      item.structured_formatting?.main_text ||
      item.description ||
      "",
    fullAddress:
      item.fullAddress ||
      item.description ||
      item.formatted_address ||
      item.maskedAddress ||
      "",
    shortAddress:
      item.shortAddress ||
      item.structured_formatting?.main_text ||
      item.name ||
      "",
    maskedAddress:
      item.maskedAddress ||
      item.structured_formatting?.secondary_text ||
      item.description ||
      "",
  };
}

function normalizeSelectedPlace(option: any, detail: any): PlaceDetail {
  const raw =
    detail?.data?.place ||
    detail?.data ||
    detail?.place ||
    detail?.result ||
    detail ||
    option ||
    {};

  const location =
    raw?.geometry?.location || raw?.location || raw?.coordinates || {};

  const latValue =
    raw.lat ??
    raw.latitude ??
    raw.locationLat ??
    raw.location_lat ??
    location.lat;

  const lngValue =
    raw.lng ??
    raw.lon ??
    raw.longitude ??
    raw.locationLng ??
    raw.location_lng ??
    location.lng ??
    location.lon;

  return {
    ...raw,
    placeId:
      raw.placeId ||
      raw.place_id ||
      raw.id ||
      option?.placeId ||
      option?.place_id,
    name:
      raw.name ||
      option?.name ||
      option?.shortAddress ||
      option?.structured_formatting?.main_text ||
      "",
    fullAddress:
      raw.fullAddress ||
      raw.formattedAddress ||
      raw.formatted_address ||
      raw.address ||
      raw.description ||
      option?.fullAddress ||
      option?.description ||
      "",
    shortAddress:
      raw.shortAddress ||
      option?.shortAddress ||
      raw.name ||
      option?.name ||
      "",
    maskedAddress:
      raw.maskedAddress ||
      option?.maskedAddress ||
      raw.formatted_address ||
      option?.description ||
      "",
    lat: Number(latValue),
    lng: Number(lngValue),
  };
}

function mergeVietnamLocationOptions(
  keyword: string,
  googleItems: PlaceSuggestion[] = [],
): PlaceSuggestion[] {
  const vietnamItems = searchVietnamLocations(keyword).slice(0, 8);

  const normalizedGoogleItems = Array.isArray(googleItems)
    ? googleItems.map(normalizeAutocompleteOption).filter(Boolean)
    : [];

  const seenPlaceIds = new Set<string>();

  return [...vietnamItems, ...(normalizedGoogleItems as PlaceSuggestion[])]
    .filter((item): item is PlaceSuggestion => {
      if (!item?.placeId) return false;
      if (seenPlaceIds.has(item.placeId)) return false;

      seenPlaceIds.add(item.placeId);
      return true;
    })
    .slice(0, 15);
}

export default function RiderBookingScreen() {
  const insets = useSafeAreaInsets();
  const [tripConfig, setTripConfig] = useState(DEFAULT_TRIP_CONFIG);
  const maxStops = Number(tripConfig.maxStops || 10);
  const minDistanceKm = Number(tripConfig.minDistanceKm || 10);
  const maxDistanceKm = Number(tripConfig.maxDistanceKm || 2000);
  const quoteExpireSeconds = Number(tripConfig.quoteExpireSeconds || 120);

  useEffect(() => {
    let active = true;

    getRiderPublicTripConfig()
      .then((config) => {
        if (!active) return;
        setTripConfig({
          ...DEFAULT_TRIP_CONFIG,
          ...config,
          riderBookingNotePlaceholder:
            String(config?.riderBookingNotePlaceholder || "").trim() ||
            DEFAULT_TRIP_CONFIG.riderBookingNotePlaceholder,
        });
      })
      .catch((error) => {
        console.warn("[Booking] load trip config error:", error);
      });

    return () => {
      active = false;
    };
  }, []);

  const [pickupAddress, setPickupAddress] = useState("");
  const [pickupPlace, setPickupPlace] = useState<PlaceDetail | null>(null);
  const [pickupOptions, setPickupOptions] = useState<PlaceSuggestion[]>([]);
  const [pickupLoading, setPickupLoading] = useState(false);
  const [showPickupOptions, setShowPickupOptions] = useState(false);
  const [gpsLocation, setGpsLocation] = useState<{
    lat: number;
    lng: number;
  } | null>(null);

  const [stops, setStops] = useState([""]);
  const [stopPlaces, setStopPlaces] = useState<Array<PlaceDetail | null>>([
    null,
  ]);
  const [stopOptions, setStopOptions] = useState<Array<PlaceSuggestion[]>>([
    [],
  ]);
  const [stopLoadingMap, setStopLoadingMap] = useState<Record<number, boolean>>(
    {},
  );
  const [showStopOptionsMap, setShowStopOptionsMap] = useState<
    Record<number, boolean>
  >({});
  const [activeStopIndex, setActiveStopIndex] = useState<number | null>(0);
  const [pickupTime, setPickupTime] = useState(toDatetimeLocalInputValue());
  const [returnTime, setReturnTime] = useState("");
  const [direction, setDirection] = useState<"ONE_WAY" | "ROUND_TRIP">(
    "ONE_WAY",
  );
  const [carType, setCarType] = useState("CAR_5");

  const [riderName, setRiderName] = useState("");
  const [riderPhone, setRiderPhone] = useState("");
  const [note, setNote] = useState("");
  const [accountUser, setAccountUser] = useState<MeUser>(null);
  const [profileLoading, setProfileLoading] = useState(true);

  const [distanceKm, setDistanceKm] = useState("");
  const [driveMinutes, setDriveMinutes] = useState("");
  const [outboundDriveMinutes, setOutboundDriveMinutes] = useState("");
  const [returnDriveMinutes, setReturnDriveMinutes] = useState("");
  const [isRouteLoading, setIsRouteLoading] = useState(false);

  const [submitTouched, setSubmitTouched] = useState(false);
  const [isEstimating, setIsEstimating] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [quote, setQuote] = useState<QuoteState>(null);
  const [quoteNowTs, setQuoteNowTs] = useState(Date.now());
  const [pickerTarget, setPickerTarget] = useState<"pickup" | "return" | null>(
    null,
  );
  const [pickerMode, setPickerMode] = useState<"date" | "time">("date");
  const [pickerValue, setPickerValue] = useState(new Date());

  const todayStartDate = useMemo(() => {
    const nextDate = new Date();
    nextDate.setHours(0, 0, 0, 0);
    return nextDate;
  }, []);

  const scrollViewRef = useRef<ScrollView | null>(null);
  const pickupSearchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const stopSearchTimersRef = useRef<
    Record<number, ReturnType<typeof setTimeout>>
  >({});
  const autocompleteCacheRef = useRef<Map<string, PlaceSuggestion[]>>(
    new Map(),
  );
  const suppressPickupSearchRef = useRef(false);
  const suppressStopSearchMapRef = useRef<Record<number, boolean>>({});
  const latestRouteRequestRef = useRef(0);
  const [shouldScrollToQuote, setShouldScrollToQuote] = useState(false);
  const [quoteCardY, setQuoteCardY] = useState(0);

  async function triggerLightHaptic() {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (error) {
      console.warn("triggerLightHaptic error:", error);
    }
  }

  async function triggerSuccessHaptic() {
    try {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.warn("triggerSuccessHaptic error:", error);
    }
  }

  async function triggerWarningHaptic() {
    try {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    } catch (error) {
      console.warn("triggerWarningHaptic error:", error);
    }
  }

  function resetRouteState(options?: { keepLoading?: boolean }) {
    setDistanceKm("");
    setDriveMinutes("");
    setOutboundDriveMinutes("");
    setReturnDriveMinutes("");

    if (!options?.keepLoading) {
      setIsRouteLoading(false);
    }
  }

  const filledStopCount = useMemo(() => {
    return stops.filter((item) => item.trim()).length;
  }, [stops]);

  const hasAtLeastOneStop = useMemo(() => {
    return filledStopCount > 0;
  }, [filledStopCount]);

  const pickupMs = useMemo(() => {
    return toMsFromDatetimeLocal(pickupTime);
  }, [pickupTime]);

  const isPickupTimeValid = useMemo(() => {
    if (!pickupTime) return false;
    if (!Number.isFinite(pickupMs)) return false;

    return pickupMs > Date.now();
  }, [pickupTime, pickupMs]);

  const returnMs = useMemo(() => {
    return toMsFromDatetimeLocal(returnTime);
  }, [returnTime]);

  const numericDriveMinutes = Number(driveMinutes);
  const numericOutboundDriveMinutes = Number(outboundDriveMinutes);

  const isReturnTimeValid = useMemo(() => {
    if (direction !== "ROUND_TRIP") return true;

    if (!pickupTime || !returnTime) {
      return false;
    }

    if (!Number.isFinite(numericOutboundDriveMinutes)) {
      return false;
    }

    const earliestReturnMs = pickupMs + numericOutboundDriveMinutes * 60000;

    return returnMs >= earliestReturnMs;
  }, [
    direction,
    pickupTime,
    returnTime,
    pickupMs,
    returnMs,
    numericOutboundDriveMinutes,
  ]);

  const estimatedExtraMinutes = useMemo(() => {
    if (direction !== "ROUND_TRIP") return 0;

    if (
      !pickupTime ||
      !returnTime ||
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
    pickupTime,
    returnTime,
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

  const isNameValid = riderName.trim().length >= 2;
  const isPhoneValid = /^0(3|5|7|8|9)[0-9]{8}$/.test(riderPhone.trim());

  const showNameError = submitTouched && !isNameValid;
  const showPhoneError = submitTouched && !isPhoneValid;

  const hasValidPickupSelection = useMemo(() => {
    return (
      !!pickupPlace?.placeId &&
      Number.isFinite(Number(pickupPlace?.lat)) &&
      Number.isFinite(Number(pickupPlace?.lng))
    );
  }, [pickupPlace]);

  const hasValidStopSelections = useMemo(() => {
    return stops.every((value, index) => {
      const text = String(value || "").trim();

      if (!text) return true;

      const place = stopPlaces[index];

      return (
        !!place?.placeId &&
        Number.isFinite(Number(place?.lat)) &&
        Number.isFinite(Number(place?.lng))
      );
    });
  }, [stops, stopPlaces]);

  const hasAtLeastOneSelectedStop = useMemo(() => {
    return stops.some((value, index) => {
      const text = String(value || "").trim();
      const place = stopPlaces[index];

      return (
        !!text &&
        !!place?.placeId &&
        Number.isFinite(Number(place?.lat)) &&
        Number.isFinite(Number(place?.lng))
      );
    });
  }, [stops, stopPlaces]);

  const numericDistanceKm = Number(distanceKm);
  const isDistanceValid = useMemo(() => {
    if (!Number.isFinite(numericDistanceKm)) return false;
    return (
      numericDistanceKm >= minDistanceKm && numericDistanceKm <= maxDistanceKm
    );
  }, [numericDistanceKm, minDistanceKm, maxDistanceKm]);

  const canEstimate =
    !isRouteLoading &&
    hasValidPickupSelection &&
    hasAtLeastOneSelectedStop &&
    hasValidStopSelections &&
    pickupTime &&
    isPickupTimeValid &&
    direction &&
    carType &&
    isNameValid &&
    isPhoneValid &&
    (direction === "ONE_WAY" ? true : isReturnTimeValid) &&
    isDistanceValid &&
    Number.isFinite(Number(driveMinutes)) &&
    Number(driveMinutes) >= 0;

  const quoteRemainingMs = useMemo(() => {
    if (!quote?.expiresAt) return 0;
    return Math.max(0, new Date(quote.expiresAt).getTime() - quoteNowTs);
  }, [quote?.expiresAt, quoteNowTs]);

  const isQuoteExpired = useMemo(() => {
    return !!quote?.expiresAt && quoteRemainingMs <= 0;
  }, [quote?.expiresAt, quoteRemainingMs]);

  const quoteCountdownLabel = useMemo(() => {
    return formatCountdownLabel(quoteRemainingMs);
  }, [quoteRemainingMs]);

  const canCreateTrip =
    !!quote &&
    !isQuoteExpired &&
    isNameValid &&
    isPhoneValid &&
    !isCreating &&
    !isEstimating;

  useEffect(() => {
    let alive = true;

    async function loadBookingProfile() {
      try {
        setProfileLoading(true);

        const token = await getRiderToken();

        if (!token) {
          if (!alive) return;
          setAccountUser(null);
          setProfileLoading(false);
          return;
        }

        const meData = await getMe(token);
        const nextUser = meData?.user || null;

        if (!alive) return;

        setAccountUser(nextUser);

        const nextDisplayName = getRiderDisplayName(nextUser);
        const nextPhone = formatPhoneFromAccount(nextUser?.phone);

        setRiderName((prev) =>
          String(prev || "").trim() ? prev : nextDisplayName,
        );
        setRiderPhone((prev) => (String(prev || "").trim() ? prev : nextPhone));
      } catch (error) {
        console.error("load booking profile error:", error);

        if (!alive) return;
        setAccountUser(null);
      } finally {
        if (alive) {
          setProfileLoading(false);
        }
      }
    }

    void loadBookingProfile();

    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;

    async function loadGpsLocation() {
      try {
        const permission = await Location.requestForegroundPermissionsAsync();

        if (!alive || permission.status !== "granted") {
          return;
        }

        const currentPosition = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });

        if (!alive) return;

        const latitude = Number(currentPosition?.coords?.latitude);
        const longitude = Number(currentPosition?.coords?.longitude);

        if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
          setGpsLocation({
            lat: latitude,
            lng: longitude,
          });
        }
      } catch (error) {
        console.warn("load rider gps location error:", error);
      }
    }

    void loadGpsLocation();

    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (pickerTarget) return;

    let hasWarnedExpire = false;

    const timer = setInterval(() => {
      const now = Date.now();

      setQuoteNowTs(now);

      if (!quote?.expiresAt) {
        return;
      }

      const remainingMs = Math.max(
        0,
        new Date(quote.expiresAt).getTime() - now,
      );

      if (!hasWarnedExpire && remainingMs <= 0) {
        hasWarnedExpire = true;
        void triggerWarningHaptic();
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [quote?.expiresAt, pickerTarget]);

  useEffect(() => {
    const keyword = String(pickupAddress || "").trim();
    const lat = gpsLocation?.lat;
    const lng = gpsLocation?.lng;

    if (pickupSearchTimerRef.current) {
      clearTimeout(pickupSearchTimerRef.current);
    }

    if (suppressPickupSearchRef.current) {
      suppressPickupSearchRef.current = false;
      setPickupOptions([]);
      setPickupLoading(false);
      setShowPickupOptions(false);
      return;
    }

    if (!keyword || keyword.length < 3) {
      setPickupOptions([]);
      setPickupLoading(false);
      setShowPickupOptions(false);
      return;
    }

    const cacheKey = buildAutocompleteCacheKey(keyword, lat, lng);
    const cachedItems = autocompleteCacheRef.current.get(cacheKey);

    if (cachedItems) {
      setPickupOptions(cachedItems);
      setPickupLoading(false);
      setShowPickupOptions(true);
      return;
    }

    pickupSearchTimerRef.current = setTimeout(async () => {
      try {
        setPickupLoading(true);

        const items = await searchPlaces(keyword, { lat, lng });
        const nextItems = mergeVietnamLocationOptions(
          keyword,
          Array.isArray(items) ? (items as PlaceSuggestion[]) : [],
        );

        autocompleteCacheRef.current.set(cacheKey, nextItems);
        setPickupOptions(nextItems);
        setShowPickupOptions(true);
      } catch (error: any) {
        console.warn("pickup autocomplete error:", error);
        setPickupOptions([]);
      } finally {
        setPickupLoading(false);
      }
    }, 350);

    return () => {
      if (pickupSearchTimerRef.current) {
        clearTimeout(pickupSearchTimerRef.current);
      }
    };
  }, [pickupAddress, gpsLocation?.lat, gpsLocation?.lng]);

  useEffect(() => {
    const lat = gpsLocation?.lat;
    const lng = gpsLocation?.lng;

    stops.forEach((value, index) => {
      const keyword = String(value || "").trim();

      if (stopSearchTimersRef.current[index]) {
        clearTimeout(stopSearchTimersRef.current[index]);
      }

      if (activeStopIndex !== index) {
        setStopLoadingMap((prev) => ({ ...prev, [index]: false }));
        return;
      }

      if (suppressStopSearchMapRef.current[index]) {
        suppressStopSearchMapRef.current[index] = false;
        setStopOptions((prev) =>
          prev.map((items, i) => (i === index ? [] : items)),
        );
        setStopLoadingMap((prev) => ({ ...prev, [index]: false }));
        setShowStopOptionsMap((prev) => ({ ...prev, [index]: false }));
        return;
      }

      if (!keyword || keyword.length < 3) {
        setStopOptions((prev) =>
          prev.map((items, i) => (i === index ? [] : items)),
        );
        setStopLoadingMap((prev) => ({ ...prev, [index]: false }));
        setShowStopOptionsMap((prev) => ({ ...prev, [index]: false }));
        return;
      }

      if (stopPlaces[index]?.placeId) {
        setStopOptions((prev) =>
          prev.map((items, i) => (i === index ? [] : items)),
        );
        setStopLoadingMap((prev) => ({ ...prev, [index]: false }));
        setShowStopOptionsMap((prev) => ({ ...prev, [index]: false }));
        return;
      }

      const cacheKey = buildAutocompleteCacheKey(keyword, lat, lng);
      const cachedItems = autocompleteCacheRef.current.get(cacheKey);

      if (cachedItems) {
        setStopOptions((prev) =>
          prev.map((items, i) => (i === index ? cachedItems : items)),
        );
        setStopLoadingMap((prev) => ({ ...prev, [index]: false }));
        setShowStopOptionsMap((prev) => ({ ...prev, [index]: true }));
        return;
      }

      stopSearchTimersRef.current[index] = setTimeout(async () => {
        try {
          setStopLoadingMap((prev) => ({ ...prev, [index]: true }));

          const items = await searchPlaces(keyword, { lat, lng });
          const nextItems = mergeVietnamLocationOptions(
            keyword,
            Array.isArray(items) ? (items as PlaceSuggestion[]) : [],
          );

          autocompleteCacheRef.current.set(cacheKey, nextItems);

          setStopOptions((prev) =>
            prev.map((oldItems, i) => (i === index ? nextItems : oldItems)),
          );
          setShowStopOptionsMap((prev) => ({ ...prev, [index]: true }));
        } catch (error: any) {
          console.warn(`stop autocomplete error [${index}]:`, error);
          setStopOptions((prev) =>
            prev.map((oldItems, i) => (i === index ? [] : oldItems)),
          );
        } finally {
          setStopLoadingMap((prev) => ({ ...prev, [index]: false }));
        }
      }, 350);
    });

    return () => {
      Object.values(stopSearchTimersRef.current).forEach((timer) => {
        clearTimeout(timer);
      });
    };
  }, [stops, stopPlaces, activeStopIndex, gpsLocation?.lat, gpsLocation?.lng]);

  useEffect(() => {
    setQuote(null);
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

  useEffect(() => {
    if (!quote || isQuoteExpired || !shouldScrollToQuote) return;
    if (!quoteCardY) return;

    const timer = setTimeout(() => {
      scrollViewRef.current?.scrollTo({
        y: Math.max(quoteCardY - 16, 0),
        animated: true,
      });
      setShouldScrollToQuote(false);
    }, 250);

    return () => clearTimeout(timer);
  }, [quote?.quoteId, isQuoteExpired, shouldScrollToQuote, quoteCardY]);

  async function refreshRouteFromPlaces(
    nextPickupPlace: PlaceDetail | null,
    nextStopPlaces: Array<PlaceDetail | null>,
    nextStops: string[],
    nextDirection: "ONE_WAY" | "ROUND_TRIP",
    options?: { silent?: boolean },
  ) {
    const silent = !!options?.silent;
    const requestId = Date.now() + Math.random();

    latestRouteRequestRef.current = requestId;

    const hasPickupCoords =
      !!nextPickupPlace?.placeId &&
      Number.isFinite(Number(nextPickupPlace?.lat)) &&
      Number.isFinite(Number(nextPickupPlace?.lng));

    if (!hasPickupCoords) {
      if (latestRouteRequestRef.current === requestId) {
        setDistanceKm("");
        setDriveMinutes("");
        setOutboundDriveMinutes("");
        setReturnDriveMinutes("");
        setIsRouteLoading(false);
      }
      return;
    }

    const validStops = nextStops
      .map((text, index) => {
        const trimmedText = String(text || "").trim();
        const place = nextStopPlaces[index];

        if (!trimmedText) return null;

        if (
          !place?.placeId ||
          !Number.isFinite(Number(place?.lat)) ||
          !Number.isFinite(Number(place?.lng))
        ) {
          return "__INVALID__";
        }

        return {
          lat: Number(place.lat),
          lng: Number(place.lng),
        };
      })
      .filter(Boolean);

    if (
      validStops.length === 0 ||
      validStops.some((item) => item === "__INVALID__")
    ) {
      if (latestRouteRequestRef.current === requestId) {
        setDistanceKm("");
        setDriveMinutes("");
        setOutboundDriveMinutes("");
        setReturnDriveMinutes("");
        setIsRouteLoading(false);
      }
      return;
    }

    try {
      setIsRouteLoading(true);

      const points = [
        {
          lat: Number(nextPickupPlace.lat),
          lng: Number(nextPickupPlace.lng),
        },
        ...(validStops as Array<{ lat: number; lng: number }>),
      ];

      if (nextDirection === "ROUND_TRIP") {
        points.push({
          lat: Number(nextPickupPlace.lat),
          lng: Number(nextPickupPlace.lng),
        });
      }

      const route = await getRoute(points);

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
        nextDirection === "ROUND_TRIP" &&
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
      } else if (nextDirection === "ROUND_TRIP") {
        setReturnDriveMinutes("");
      } else {
        setReturnDriveMinutes("");
      }
    } catch (error: any) {
      if (latestRouteRequestRef.current !== requestId) {
        return;
      }

      setDistanceKm("");
      setDriveMinutes("");
      setOutboundDriveMinutes("");
      setReturnDriveMinutes("");

      if (!silent) {
        Alert.alert(
          "Không lấy được quãng đường",
          error?.message || "Không lấy được quãng đường thực tế từ bản đồ.",
        );
      }
    } finally {
      if (latestRouteRequestRef.current === requestId) {
        setIsRouteLoading(false);
      }
    }
  }

  async function handleSelectPickupOption(option: PlaceSuggestion) {
    try {
      setPickupLoading(true);

      const rawDetail = hasPlaceCoords(option)
        ? option
        : await getPlaceDetail(String(option?.placeId || "").trim());

      const detail = normalizeSelectedPlace(option, rawDetail);

      suppressPickupSearchRef.current = true;

      setPickupPlace(detail);
      setPickupAddress(
        String(option?.fullAddress || detail?.fullAddress || "").trim(),
      );
      setPickupOptions([]);
      setShowPickupOptions(false);

      await refreshRouteFromPlaces(detail, stopPlaces, stops, direction, {
        silent: true,
      });
    } catch (error: any) {
      Alert.alert(
        "Không lấy được chi tiết địa chỉ",
        error?.message || "Vui lòng thử lại.",
      );
    } finally {
      setPickupLoading(false);
    }
  }

  function handleAddStop() {
    if (stops.length >= maxStops) {
      Alert.alert("Giới hạn", `Tối đa ${maxStops} điểm đến.`);
      return;
    }

    const newIndex = stops.length;

    setStops((prev) => [...prev, ""]);
    setStopPlaces((prev) => [...prev, null]);
    setStopOptions((prev) => [...prev, []]);
    setStopLoadingMap((prev) => ({ ...prev, [newIndex]: false }));
    setShowStopOptionsMap({});
    suppressStopSearchMapRef.current = {};
    setActiveStopIndex(newIndex);
  }

  function handleRemoveStop(index: number) {
    const nextStops = stops.filter((_, i) => i !== index);
    const normalizedStops = nextStops.length ? nextStops : [""];

    const nextStopPlaces = stopPlaces.filter((_, i) => i !== index);
    const normalizedStopPlaces = nextStopPlaces.length
      ? nextStopPlaces
      : [null];

    setStops(normalizedStops);
    setStopPlaces(normalizedStopPlaces);

    setStopOptions((prev) => {
      const next = prev.filter((_, i) => i !== index);
      return next.length ? next : [[]];
    });

    setStopLoadingMap((prev) => {
      const next = { ...prev };
      delete next[index];
      return next;
    });

    setShowStopOptionsMap((prev) => {
      const next = { ...prev };
      delete next[index];
      return next;
    });

    void refreshRouteFromPlaces(
      pickupPlace,
      normalizedStopPlaces,
      normalizedStops,
      direction,
      { silent: true },
    );
  }

  function handleChangeStop(index: number, value: string) {
    const nextStops = stops.map((item, i) => (i === index ? value : item));
    const nextStopPlaces = stopPlaces.map((item, i) =>
      i === index ? null : item,
    );

    setActiveStopIndex(index);
    setStops(nextStops);
    setStopPlaces(nextStopPlaces);
    setShowStopOptionsMap((prev) => ({ ...prev, [index]: true }));

    resetRouteState();
  }

  async function handleSelectStopOption(
    index: number,
    option: PlaceSuggestion,
  ) {
    try {
      setStopLoadingMap((prev) => ({ ...prev, [index]: true }));

      const rawDetail = hasPlaceCoords(option)
        ? option
        : await getPlaceDetail(String(option?.placeId || "").trim());

      const detail = normalizeSelectedPlace(option, rawDetail);

      suppressStopSearchMapRef.current[index] = true;

      const nextStopPlaces = stopPlaces.map((item, i) =>
        i === index ? detail : item,
      );
      const nextStops = stops.map((item, i) =>
        i === index
          ? String(option?.fullAddress || detail?.fullAddress || "").trim()
          : item,
      );

      setStopPlaces(nextStopPlaces);
      setStops(nextStops);
      setStopOptions((prev) =>
        prev.map((items, i) => (i === index ? [] : items)),
      );
      setShowStopOptionsMap((prev) => ({ ...prev, [index]: false }));
      setActiveStopIndex(null);

      await refreshRouteFromPlaces(
        pickupPlace,
        nextStopPlaces,
        nextStops,
        direction,
        { silent: true },
      );
    } catch (error: any) {
      Alert.alert(
        "Không lấy được chi tiết điểm đến",
        error?.message || "Vui lòng thử lại.",
      );
    } finally {
      setStopLoadingMap((prev) => ({ ...prev, [index]: false }));
    }
  }

  function handleChangeDirection(next: "ONE_WAY" | "ROUND_TRIP") {
    setDirection(next);

    if (next === "ONE_WAY") {
      setReturnTime("");
    }

    void refreshRouteFromPlaces(pickupPlace, stopPlaces, stops, next, {
      silent: true,
    });
  }

  function openDateTimePicker(
    target: "pickup" | "return",
    mode: "date" | "time",
  ) {
    const rawValue = target === "pickup" ? pickupTime : returnTime;
    const baseDate = rawValue ? new Date(rawValue) : new Date();
    const safeDate = Number.isNaN(baseDate.getTime()) ? new Date() : baseDate;

    setPickerTarget(target);
    setPickerMode(mode);
    setPickerValue(safeDate);
  }

  function closeDateTimePicker() {
    setPickerTarget(null);
  }

  function handleDateTimeChange(
    event: DateTimePickerEvent,
    selectedValue?: Date,
  ) {
    if (event.type === "dismissed") {
      setPickerTarget(null);
      return;
    }

    if (!selectedValue || !pickerTarget) {
      return;
    }

    setPickerValue(selectedValue);

    let nextValue = "";

    if (pickerMode === "date") {
      const currentRawValue =
        pickerTarget === "pickup" ? pickupTime : returnTime;
      nextValue = mergeDatePartIntoDatetimeLocal(
        currentRawValue,
        selectedValue,
      );
    } else {
      const currentRawValue =
        pickerTarget === "pickup" ? pickupTime : returnTime;
      nextValue = mergeTimePartIntoDatetimeLocal(
        currentRawValue,
        selectedValue,
      );
    }

    if (pickerTarget === "pickup") {
      setPickupTime(nextValue);
    } else {
      setReturnTime(nextValue);
    }

    if (Platform.OS === "android") {
      setPickerTarget(null);
    }
  }

  function buildTripPayload() {
    const cleanedStops = stops
      .map((item, index) => {
        const detail = stopPlaces[index];
        return String(detail?.fullAddress || item || "").trim();
      })
      .filter(Boolean);

    if (!pickupPlace?.placeId) {
      throw new Error("Vui lòng chọn điểm đón từ danh sách gợi ý.");
    }

    if (cleanedStops.length === 0) {
      throw new Error("Vui lòng nhập ít nhất 1 điểm đến.");
    }

    if (cleanedStops.length > maxStops) {
      throw new Error(`Số điểm đến vượt quá giới hạn ${maxStops} điểm.`);
    }

    const hasInvalidStop = cleanedStops.some((_, index) => {
      const text = String(stops[index] || "").trim();
      if (!text) return false;

      const place = stopPlaces[index];

      return (
        !place?.placeId ||
        !Number.isFinite(Number(place?.lat)) ||
        !Number.isFinite(Number(place?.lng))
      );
    });

    if (hasInvalidStop) {
      throw new Error("Vui lòng chọn đầy đủ các điểm đến từ danh sách gợi ý.");
    }

    if (!isDistanceValid) {
      throw new Error(
        `Quãng đường phải từ ${minDistanceKm} km đến ${maxDistanceKm} km.`,
      );
    }

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
      pickupTime: toIsoFromDatetimeLocal(pickupTime),
      returnTime:
        direction === "ROUND_TRIP" ? toIsoFromDatetimeLocal(returnTime) : null,
      direction,
      carType,
      distanceKm: Number(distanceKm),

      totalDriveMinutes: safeTotalDriveMinutes,
      driveMinutes: safeTotalDriveMinutes,

      outboundDriveMinutes: safeOutboundDriveMinutes,
      returnDriveMinutes: safeReturnDriveMinutes,

      estimatedDurationMinutes: safeEstimatedDurationMinutes,

      fareEstimate: quote?.totalPrice || 0,
      riderName: riderName.trim(),
      riderPhone: riderPhone.trim(),
      note: finalNote,
    };
  }

  function resetFormAfterSuccess() {
    scrollViewRef.current?.scrollTo({
      y: 0,
      animated: false,
    });

    setShouldScrollToQuote(false);
    setQuoteCardY(0);

    setPickupAddress("");
    setPickupPlace(null);
    setPickupOptions([]);
    setPickupLoading(false);
    setShowPickupOptions(false);

    setStops([""]);
    setStopPlaces([null]);
    setStopOptions([[]]);
    setStopLoadingMap({});
    setShowStopOptionsMap({});
    setActiveStopIndex(0);

    setPickupTime(toDatetimeLocalInputValue());
    setReturnTime("");
    setDirection("ONE_WAY");
    setCarType("CAR_5");
    setNote("");

    resetRouteState();

    setSubmitTouched(false);
    setQuote(null);
    setQuoteNowTs(Date.now());
  }

  async function handleEstimate() {
    setSubmitTouched(false);

    if (!hasValidPickupSelection) {
      Alert.alert(
        "Thiếu dữ liệu",
        "Vui lòng chọn điểm đón từ danh sách gợi ý.",
      );
      return;
    }

    if (!hasAtLeastOneSelectedStop || !hasValidStopSelections) {
      Alert.alert(
        "Thiếu dữ liệu",
        "Vui lòng chọn ít nhất 1 điểm đến hợp lệ từ danh sách gợi ý.",
      );
      return;
    }

    if (!pickupTime) {
      Alert.alert("Thiếu dữ liệu", "Vui lòng chọn ngày giờ đón khách.");
      return;
    }

    if (!isPickupTimeValid) {
      Alert.alert(
        "Thời gian chưa hợp lệ",
        "Giờ đón khách phải sau thời điểm hiện tại.",
      );
      return;
    }

    if (direction === "ROUND_TRIP" && !returnTime) {
      Alert.alert("Thiếu dữ liệu", "Vui lòng chọn ngày giờ quay về.");
      return;
    }

    if (!isReturnTimeValid) {
      Alert.alert(
        "Thời gian chưa hợp lệ",
        "Giờ quay về phải sau thời điểm xe dự kiến đã tới điểm đến.",
      );
      return;
    }

    if (!isDistanceValid) {
      Alert.alert(
        "Quãng đường chưa hợp lệ",
        `Quãng đường phải từ ${minDistanceKm} km đến ${maxDistanceKm} km.`,
      );
      return;
    }

    if (!Number.isFinite(Number(driveMinutes))) {
      Alert.alert(
        "Thiếu dữ liệu",
        "Hệ thống chưa lấy được thời gian chuyến đi từ bản đồ.",
      );
      return;
    }

    if (
      direction === "ROUND_TRIP" &&
      !Number.isFinite(Number(outboundDriveMinutes))
    ) {
      Alert.alert(
        "Thiếu dữ liệu",
        "Hệ thống chưa lấy được thời gian lượt đi cho chuyến khứ hồi.",
      );
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
        outboundDriveMinutes:
          direction === "ROUND_TRIP"
            ? Number(outboundDriveMinutes)
            : Number(driveMinutes),
      };

      const data = await quotePrice(payload);

      const now = Date.now();
      const nextQuote = {
        quoteId: `qt_${now}`,
        totalPrice: Number(data?.finalPrice || 0),
        expiresAt: new Date(now + quoteExpireSeconds * 1000).toISOString(),
        raw: data,
      };

      setQuote(nextQuote);
      setQuoteNowTs(now);
      setShouldScrollToQuote(true);
      await triggerLightHaptic();
    } catch (error: any) {
      Alert.alert("Tính giá thất bại", error?.message || "Vui lòng thử lại.");
    } finally {
      setIsEstimating(false);
    }
  }

  async function handleCreateTrip() {
    if (isCreating) return;

    setSubmitTouched(true);

    if (!quote || isQuoteExpired) {
      Alert.alert("Chưa thể đặt chuyến", "Vui lòng tính giá lại trước.");
      return;
    }

    if (!isNameValid) {
      Alert.alert("Thiếu dữ liệu", "Vui lòng nhập tên người đi.");
      return;
    }

    if (!isPhoneValid) {
      Alert.alert(
        "Thiếu dữ liệu",
        "Vui lòng nhập số điện thoại liên hệ hợp lệ.",
      );
      return;
    }

    let payload;

    try {
      payload = buildTripPayload();
    } catch (error: any) {
      Alert.alert(
        "Dữ liệu chưa hợp lệ",
        error?.message || "Vui lòng kiểm tra lại thông tin chuyến đi.",
      );
      return;
    }

    setIsCreating(true);

    try {
      const token = await getRiderToken();
      const normalizedName = String(riderName || "").trim();
      const currentAccountName = getRiderDisplayName(accountUser);

      if (
        token &&
        normalizedName.length >= 2 &&
        normalizedName !== currentAccountName
      ) {
        try {
          const updateRes = await updateMe(token, {
            displayName: normalizedName,
          });

          const nextUser = updateRes?.user || null;
          setAccountUser(nextUser);
          setRiderName(getRiderDisplayName(nextUser) || normalizedName);
          setRiderPhone((prev) => {
            const nextPhone = formatPhoneFromAccount(nextUser?.phone);
            return String(prev || "").trim() || nextPhone;
          });
        } catch (profileError) {
          console.warn(
            "update rider displayName before createTrip error:",
            profileError,
          );
        }
      }

      const res = await createTrip(payload);
      await triggerSuccessHaptic();

      const tripId =
        res?.trip?.id ||
        res?.tripId ||
        res?.data?.trip?.id ||
        res?.data?.tripId ||
        "";

      const goToTripHistory = () => {
        resetFormAfterSuccess();

        if (tripId) {
          router.replace({
            pathname: "/trip-history",
            params: {
              focusTripId: tripId,
              justCreated: "1",
            },
          });
          return;
        }

        router.replace("/trip-history");
      };

      if (Platform.OS === "web") {
        Alert.alert(
          "Đặt chuyến thành công ✅",
          tripId
            ? `Mã chuyến: ${shortTripId(tripId)}`
            : "GoViet247 đã ghi nhận chuyến của bạn.",
        );

        setTimeout(() => {
          goToTripHistory();
        }, 50);

        return;
      }

      Alert.alert(
        "Đặt chuyến thành công ✅",
        tripId
          ? `Mã chuyến: ${shortTripId(tripId)}`
          : "GoViet247 đã ghi nhận chuyến của bạn.",
        [
          {
            text: "OK",
            onPress: goToTripHistory,
          },
        ],
      );
    } catch (error: any) {
      Alert.alert("Tạo chuyến thất bại", error?.message || "Vui lòng thử lại.");
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 24}
    >
      <SafeAreaView edges={[]} style={styles.safeArea}>
        <ScrollView
          ref={scrollViewRef}
          style={styles.flex}
          contentContainerStyle={[
            styles.contentContainer,
            {
              paddingTop: Math.max(insets.top, 10),
              paddingBottom: Math.max(insets.bottom + 220, 260),
            },
          ]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          <AppBrandHeader
            title="Đặt xe"
            subtitle="Nhập thông tin chuyến đi để tính giá và tạo chuyến."
          />

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>1. Lộ trình</Text>

            <Text style={styles.label}>Điểm đón</Text>
            <View style={{ position: "relative" }}>
              <TextInput
                value={pickupAddress}
                onChangeText={(value) => {
                  suppressPickupSearchRef.current = false;
                  setPickupAddress(value);
                  setPickupPlace(null);
                  setShowPickupOptions(true);
                }}
                placeholder="Ví dụ: 12 Nguyễn Huệ, Phường Sài Gòn"
                placeholderTextColor="#9CA3AF"
                style={[styles.input, { paddingRight: 40 }]}
              />

              {pickupAddress ? (
                <Pressable
                  style={{
                    position: "absolute",
                    right: 10,
                    top: 16,
                  }}
                  onPress={() => {
                    setPickupAddress("");
                    setPickupPlace(null);
                    setPickupOptions([]);
                    setShowPickupOptions(false);
                    resetRouteState();
                  }}
                >
                  <Text style={{ fontSize: 16, color: "#9CA3AF" }}>✕</Text>
                </Pressable>
              ) : null}
            </View>

            {pickupLoading ? (
              <Text style={styles.helperText}>Đang tìm địa chỉ...</Text>
            ) : null}

            {showPickupOptions && pickupOptions.length > 0 ? (
              <View style={styles.autocompleteList}>
                {pickupOptions.map((option) => {
                  const optionKey = String(option?.placeId || "").trim();

                  return (
                    <Pressable
                      key={optionKey}
                      style={styles.autocompleteItem}
                      onPress={() => {
                        void handleSelectPickupOption(option);
                      }}
                    >
                      <Text style={styles.autocompleteTitle}>
                        {option?.name ||
                          option?.shortAddress ||
                          option?.fullAddress ||
                          "Địa chỉ gợi ý"}
                      </Text>

                      {!!option?.maskedAddress ? (
                        <Text style={styles.autocompleteSubtitle}>
                          {option.maskedAddress}
                        </Text>
                      ) : null}
                    </Pressable>
                  );
                })}
              </View>
            ) : null}

            {!!pickupAddress.trim() && !pickupPlace?.placeId ? (
              <Text style={styles.errorText}>
                Vui lòng chọn điểm đón từ danh sách gợi ý.
              </Text>
            ) : null}

            <View style={styles.rowBetween}>
              <Text style={styles.labelNoMargin}>Điểm đến</Text>

              <Pressable style={styles.smallButton} onPress={handleAddStop}>
                <Text style={styles.smallButtonText}>+ Thêm điểm</Text>
              </Pressable>
            </View>

            {filledStopCount > 2 ? (
              <Text style={styles.helperText}>
                Tổng số điểm đến:{" "}
                <Text style={styles.helperTextBold}>{filledStopCount}</Text>
              </Text>
            ) : null}

            {stops.map((stop, index) => (
              <View key={index} style={styles.stopBlock}>
                <View style={styles.stopRow}>
                  <View
                    style={[styles.stopInputWrap, { position: "relative" }]}
                  >
                    <TextInput
                      value={stop}
                      onFocus={() => {
                        setActiveStopIndex(index);
                      }}
                      onChangeText={(value) => {
                        suppressStopSearchMapRef.current[index] = false;
                        handleChangeStop(index, value);
                      }}
                      placeholder={`Điểm đến ${index + 1}`}
                      placeholderTextColor="#9CA3AF"
                      style={[styles.input, { paddingRight: 40 }]}
                    />

                    {stop ? (
                      <Pressable
                        style={{
                          position: "absolute",
                          right: 10,
                          top: 16,
                        }}
                        onPress={() => {
                          setActiveStopIndex(index);
                          suppressStopSearchMapRef.current[index] = false;

                          const nextStops = stops.map((item, i) =>
                            i === index ? "" : item,
                          );
                          const nextStopPlaces = stopPlaces.map((item, i) =>
                            i === index ? null : item,
                          );

                          setStops(nextStops);
                          setStopPlaces(nextStopPlaces);

                          setStopOptions((prev) =>
                            prev.map((items, i) => (i === index ? [] : items)),
                          );

                          setShowStopOptionsMap((prev) => ({
                            ...prev,
                            [index]: false,
                          }));

                          resetRouteState({ keepLoading: true });

                          void refreshRouteFromPlaces(
                            pickupPlace,
                            nextStopPlaces,
                            nextStops,
                            direction,
                            { silent: true },
                          );
                        }}
                      >
                        <Text style={{ fontSize: 16, color: "#9CA3AF" }}>
                          ✕
                        </Text>
                      </Pressable>
                    ) : null}
                  </View>

                  <Pressable
                    style={[
                      styles.removeButton,
                      stops.length === 1 ? styles.removeButtonDisabled : null,
                    ]}
                    onPress={() => handleRemoveStop(index)}
                    disabled={stops.length === 1}
                  >
                    <Text style={styles.removeButtonText}>Xoá</Text>
                  </Pressable>
                </View>

                {activeStopIndex === index && stopLoadingMap[index] ? (
                  <Text style={styles.helperText}>Đang tìm địa chỉ...</Text>
                ) : null}

                {activeStopIndex === index &&
                showStopOptionsMap[index] &&
                (stopOptions[index] || []).length > 0 ? (
                  <View style={styles.autocompleteList}>
                    {(stopOptions[index] || []).map((option) => {
                      const optionKey = String(option?.placeId || "").trim();

                      return (
                        <Pressable
                          key={optionKey}
                          style={styles.autocompleteItem}
                          onPress={() => {
                            void handleSelectStopOption(index, option);
                          }}
                        >
                          <Text style={styles.autocompleteTitle}>
                            {option?.name ||
                              option?.shortAddress ||
                              option?.fullAddress ||
                              "Địa chỉ gợi ý"}
                          </Text>

                          {!!option?.maskedAddress ? (
                            <Text style={styles.autocompleteSubtitle}>
                              {option.maskedAddress}
                            </Text>
                          ) : null}
                        </Pressable>
                      );
                    })}
                  </View>
                ) : null}

                {!!stop.trim() && !stopPlaces[index]?.placeId ? (
                  <Text style={styles.errorText}>
                    Vui lòng chọn điểm đến từ danh sách gợi ý.
                  </Text>
                ) : null}
              </View>
            ))}

            <Text style={styles.helperText}>
              Vui lòng chọn địa chỉ từ danh sách gợi ý để hệ thống tính giá
              chính xác.
            </Text>
            <Text style={styles.helperText}>
              Bạn có thể nhập thêm số nhà, tên khách sạn, nhà hàng hoặc địa điểm
              cụ thể để dễ tìm đúng vị trí hơn.
            </Text>

            <View style={styles.divider} />

            <Text style={styles.sectionTitle}>2. Thời gian & Loại chuyến</Text>

            <View style={styles.segmentWrap}>
              <Pressable
                style={[
                  styles.segmentButton,
                  direction === "ONE_WAY" ? styles.segmentButtonActive : null,
                ]}
                onPress={() => handleChangeDirection("ONE_WAY")}
              >
                <Text
                  style={[
                    styles.segmentText,
                    direction === "ONE_WAY" ? styles.segmentTextActive : null,
                  ]}
                >
                  Một chiều
                </Text>
              </Pressable>

              <Pressable
                style={[
                  styles.segmentButton,
                  direction === "ROUND_TRIP"
                    ? styles.segmentButtonActive
                    : null,
                ]}
                onPress={() => handleChangeDirection("ROUND_TRIP")}
              >
                <Text
                  style={[
                    styles.segmentText,
                    direction === "ROUND_TRIP"
                      ? styles.segmentTextActive
                      : null,
                  ]}
                >
                  Khứ hồi
                </Text>
              </Pressable>
            </View>

            <Text style={styles.label}>Ngày đón khách</Text>
            <Pressable
              style={styles.dateTimeField}
              onPress={() => openDateTimePicker("pickup", "date")}
            >
              <Text
                style={
                  pickupTime ? styles.dateTimeText : styles.dateTimePlaceholder
                }
              >
                {formatDateOnlyDisplay(pickupTime)}
              </Text>
            </Pressable>

            <Text style={styles.label}>Giờ đón khách</Text>
            <Pressable
              style={styles.dateTimeField}
              onPress={() => openDateTimePicker("pickup", "time")}
            >
              {pickupTime && !isPickupTimeValid ? (
                <Text style={styles.errorText}>
                  Giờ đón khách phải sau thời điểm hiện tại.
                </Text>
              ) : null}
              <Text
                style={
                  pickupTime ? styles.dateTimeText : styles.dateTimePlaceholder
                }
              >
                {formatTimeOnlyDisplay(pickupTime)}
              </Text>
            </Pressable>

            {direction === "ROUND_TRIP" ? (
              <>
                <Text style={styles.label}>Ngày quay về</Text>
                <Pressable
                  style={styles.dateTimeField}
                  onPress={() => openDateTimePicker("return", "date")}
                >
                  <Text
                    style={
                      returnTime
                        ? styles.dateTimeText
                        : styles.dateTimePlaceholder
                    }
                  >
                    {formatDateOnlyDisplay(returnTime)}
                  </Text>
                </Pressable>

                <Text style={styles.label}>Giờ quay về</Text>
                <Pressable
                  style={styles.dateTimeField}
                  onPress={() => openDateTimePicker("return", "time")}
                >
                  <Text
                    style={
                      returnTime
                        ? styles.dateTimeText
                        : styles.dateTimePlaceholder
                    }
                  >
                    {formatTimeOnlyDisplay(returnTime)}
                  </Text>
                </Pressable>

                {!returnTime ? (
                  <Text style={styles.errorText}>
                    Vui lòng chọn thời gian quay về để tính giá khứ hồi.
                  </Text>
                ) : null}

                {returnTime && !isReturnTimeValid ? (
                  <Text style={styles.errorText}>
                    Giờ quay về phải sau thời điểm xe dự kiến đã tới điểm đến.
                  </Text>
                ) : null}
              </>
            ) : null}

            <View style={styles.divider} />

            <Text style={styles.sectionTitle}>3. Loại xe</Text>

            <View style={styles.carTypeList}>
              {CAR_TYPE_OPTIONS.map((item) => {
                const active = item.value === carType;

                return (
                  <Pressable
                    key={item.value}
                    style={[
                      styles.carTypeButton,
                      active ? styles.carTypeButtonActive : null,
                    ]}
                    onPress={() => setCarType(item.value)}
                  >
                    <Text
                      style={[
                        styles.carTypeText,
                        active ? styles.carTypeTextActive : null,
                      ]}
                    >
                      {item.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.divider} />

            <Text style={styles.sectionTitle}>4. Quãng đường & thời gian</Text>

            {distanceKm && driveMinutes ? (
              <View style={styles.routeInfoBox}>
                <Text style={styles.routeInfoText}>
                  Quãng đường dự kiến: {distanceKm} km
                </Text>

                <Text style={styles.routeInfoText}>
                  Thời gian chuyến đi dự kiến:{" "}
                  {estimatedTripDurationLabel ||
                    formatDurationMinutes(driveMinutes)}
                </Text>

                <Text style={styles.helperText}>
                  Thông tin được hệ thống tính tự động từ lộ trình bản đồ và
                  loại chuyến bạn đã chọn.
                </Text>

                {direction === "ROUND_TRIP" && !!returnTime ? (
                  <Text style={styles.helperText}>
                    Đối với chuyến khứ hồi, hệ thống ước tính tổng thời gian
                    theo lộ trình và giờ quay về bạn đã chọn.
                  </Text>
                ) : null}
              </View>
            ) : (
              <Text style={styles.helperText}>
                Chọn điểm đón và ít nhất 1 điểm đến từ danh sách gợi ý để hệ
                thống tự động tính quãng đường và thời gian chuyến đi.
              </Text>
            )}

            {isRouteLoading ? (
              <Text style={styles.helperText}>Đang tính lộ trình...</Text>
            ) : null}

            <View style={styles.divider} />

            <Text style={styles.sectionTitle}>5. Thông tin khách</Text>

            <Text style={styles.label}>Tên khách hàng</Text>
            <TextInput
              value={riderName}
              onChangeText={setRiderName}
              placeholder="Ví dụ: Nguyễn Văn A"
              placeholderTextColor="#9CA3AF"
              style={[styles.input, showNameError ? styles.inputError : null]}
            />
            {showNameError ? (
              <Text style={styles.errorText}>
                Vui lòng nhập tên tối thiểu 2 ký tự.
              </Text>
            ) : null}

            <Text style={styles.label}>Số điện thoại</Text>
            <TextInput
              value={riderPhone}
              onChangeText={(value) =>
                setRiderPhone(value.replace(/[^\d]/g, ""))
              }
              placeholder={
                profileLoading
                  ? "Đang tải số điện thoại..."
                  : "Ví dụ: 0901234567"
              }
              placeholderTextColor="#9CA3AF"
              keyboardType="phone-pad"
              style={[styles.input, showPhoneError ? styles.inputError : null]}
            />
            {showPhoneError ? (
              <Text style={styles.errorText}>
                Vui lòng nhập số điện thoại Việt Nam hợp lệ.
              </Text>
            ) : null}
            {!!String(accountUser?.phone || "").trim() ? (
              <Text style={styles.helperText}>
                Mặc định lấy từ tài khoản, nhưng bạn có thể sửa để đặt xe giúp
                người khác.
              </Text>
            ) : null}

            <Text style={styles.label}>Ghi chú (tuỳ chọn)</Text>
            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder={tripConfig.riderBookingNotePlaceholder}
              placeholderTextColor="#9CA3AF"
              multiline
              textAlignVertical="top"
              style={[styles.input, styles.textArea]}
            />

            <View style={styles.footerSpace} />

            <Pressable
              style={[
                styles.primaryButton,
                !canEstimate || isEstimating ? styles.buttonDisabled : null,
              ]}
              onPress={handleEstimate}
              disabled={!canEstimate || isEstimating}
            >
              <Text style={styles.primaryButtonText}>
                {isRouteLoading
                  ? "Đang tính lộ trình..."
                  : isEstimating
                    ? "Đang tính giá..."
                    : "Tính giá"}
              </Text>
            </Pressable>
            {!canEstimate ? (
              <View style={styles.validationBox}>
                {!hasValidPickupSelection ? (
                  <Text style={styles.validationText}>
                    • Vui lòng chọn điểm đón từ danh sách gợi ý.
                  </Text>
                ) : null}

                {!hasAtLeastOneSelectedStop ? (
                  <Text style={styles.validationText}>
                    • Vui lòng chọn ít nhất 1 điểm đến.
                  </Text>
                ) : null}

                {!hasValidStopSelections ? (
                  <Text style={styles.validationText}>
                    • Một hoặc nhiều điểm đến chưa hợp lệ.
                  </Text>
                ) : null}

                {!pickupTime ? (
                  <Text style={styles.validationText}>
                    • Vui lòng chọn thời gian đón khách.
                  </Text>
                ) : null}

                {!isPickupTimeValid ? (
                  <Text style={styles.validationText}>
                    • Giờ đón khách phải sau thời điểm hiện tại.
                  </Text>
                ) : null}

                {direction === "ROUND_TRIP" && !returnTime ? (
                  <Text style={styles.validationText}>
                    • Vui lòng chọn thời gian quay về.
                  </Text>
                ) : null}

                {direction === "ROUND_TRIP" && !isReturnTimeValid ? (
                  <Text style={styles.validationText}>
                    • Giờ quay về chưa hợp lệ.
                  </Text>
                ) : null}

                {!isDistanceValid ? (
                  <Text style={styles.validationText}>
                    • Quãng đường phải tối thiểu {minDistanceKm} km.
                  </Text>
                ) : null}

                {!driveMinutes ? (
                  <Text style={styles.validationText}>
                    • Chưa tính được thời gian chuyến đi.
                  </Text>
                ) : null}

                {!isNameValid ? (
                  <Text style={styles.validationText}>
                    • Vui lòng nhập tên khách hàng.
                  </Text>
                ) : null}

                {!isPhoneValid ? (
                  <Text style={styles.validationText}>
                    • Vui lòng nhập nhập đúng số điện thoại.
                  </Text>
                ) : null}
              </View>
            ) : null}
          </View>

          {quote && !isQuoteExpired ? (
            <View
              style={styles.quoteCard}
              onLayout={(event) => {
                setQuoteCardY(event.nativeEvent.layout.y);
              }}
            >
              <Text style={styles.quoteTitle}>Giá cuối</Text>

              <Text style={styles.quotePrice}>
                {formatVND(quote.totalPrice)}
              </Text>

              <View style={styles.quoteBenefits}>
                <Text style={styles.quoteBenefitText}>
                  ✅ Đây là giá trọn gói, đã bao gồm phí cầu đường, cao tốc và
                  chi phí ăn nghỉ của tài xế trong toàn hành trình. Không phát
                  sinh thêm.
                </Text>

                <Text style={styles.quoteBenefitText}>
                  🚗 Thanh toán trực tiếp cho tài xế sau khi hoàn thành chuyến
                  đi
                </Text>

                <Text style={styles.quoteBenefitHint}>
                  💡 Đi càng xa, giá mỗi km càng rẻ
                </Text>
              </View>

              <Pressable
                style={[
                  styles.primaryButton,
                  !canCreateTrip ? styles.buttonDisabled : null,
                ]}
                onPress={handleCreateTrip}
                disabled={!canCreateTrip}
              >
                <Text style={styles.primaryButtonText}>
                  {isCreating ? "Đang tạo chuyến..." : "Đặt chuyến ngay"}
                </Text>
              </Pressable>

              <Text style={styles.quoteCountdown}>
                ⏳ Giữ giá trong {quoteCountdownLabel}
              </Text>
            </View>
          ) : null}

          {quote && isQuoteExpired ? (
            <View style={styles.quoteExpiredBox}>
              <Text style={styles.quoteExpiredText}>
                Giá đã hết hạn, vui lòng tính lại.
              </Text>
            </View>
          ) : null}
        </ScrollView>
      </SafeAreaView>

      {pickerTarget && Platform.OS === "ios" ? (
        <Modal
          transparent
          animationType="fade"
          visible
          onRequestClose={closeDateTimePicker}
        >
          <View
            style={{
              flex: 1,
              backgroundColor: "rgba(0,0,0,0.25)",
              justifyContent: "center",
              alignItems: "center",
              paddingHorizontal: 20,
            }}
          >
            <View
              style={{
                width: "100%",
                backgroundColor: "#FFFFFF",
                borderRadius: 20,
                padding: 16,
              }}
            >
              <DateTimePicker
                value={pickerValue}
                mode={pickerMode}
                display="spinner"
                minuteInterval={5}
                themeVariant="light"
                minimumDate={pickerMode === "date" ? todayStartDate : undefined}
                onChange={handleDateTimeChange}
                style={{
                  width: "100%",
                }}
              />

              <Pressable
                onPress={closeDateTimePicker}
                style={{
                  marginTop: 12,
                  backgroundColor: "#F97316",
                  borderRadius: 12,
                  height: 48,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text
                  style={{
                    color: "#FFFFFF",
                    fontWeight: "800",
                    fontSize: 16,
                  }}
                >
                  Xong
                </Text>
              </Pressable>
            </View>
          </View>
        </Modal>
      ) : null}

      {pickerTarget && Platform.OS === "android" ? (
        <DateTimePicker
          value={pickerValue}
          mode={pickerMode}
          display="default"
          is24Hour
          minuteInterval={5}
          minimumDate={
            pickerMode === "date"
              ? new Date(new Date().setHours(0, 0, 0, 0))
              : undefined
          }
          onChange={handleDateTimeChange}
        />
      ) : null}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    backgroundColor: "#F4F7FB",
  },
  contentContainer: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 32,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#111827",
    marginBottom: 14,
  },
  label: {
    fontSize: 14,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 8,
    marginTop: 2,
  },
  labelNoMargin: {
    fontSize: 14,
    fontWeight: "700",
    color: "#111827",
  },
  input: {
    minHeight: 52,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: "#111827",
    backgroundColor: "#FFFFFF",
    marginBottom: 14,
  },
  autocompleteList: {
    marginTop: -6,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    overflow: "hidden",
  },
  autocompleteItem: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  autocompleteTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#111827",
  },
  autocompleteSubtitle: {
    marginTop: 4,
    fontSize: 13,
    lineHeight: 18,
    color: "#6B7280",
  },
  dateTimeField: {
    minHeight: 52,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: "#FFFFFF",
    marginBottom: 14,
    justifyContent: "center",
  },
  dateTimeText: {
    fontSize: 16,
    color: "#111827",
    fontWeight: "600",
  },
  dateTimePlaceholder: {
    fontSize: 16,
    color: "#9CA3AF",
  },
  inputError: {
    borderColor: "#DC2626",
  },
  textArea: {
    minHeight: 96,
  },
  helperText: {
    fontSize: 13,
    color: "#6B7280",
    lineHeight: 20,
    marginBottom: 8,
  },
  helperTextBold: {
    fontWeight: "800",
    color: "#111827",
  },
  routeInfoBox: {
    gap: 8,
    marginBottom: 8,
  },
  routeInfoText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#111827",
    lineHeight: 22,
  },
  errorText: {
    fontSize: 13,
    color: "#DC2626",
    lineHeight: 20,
    marginTop: -6,
    marginBottom: 10,
    fontWeight: "700",
  },
  errorTextStrong: {
    color: "#DC2626",
    fontWeight: "800",
  },
  divider: {
    height: 1,
    backgroundColor: "#E5E7EB",
    marginVertical: 16,
  },
  rowBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
    gap: 10,
  },
  smallButton: {
    backgroundColor: "#FFF7ED",
    borderWidth: 1,
    borderColor: "#FDBA74",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  smallButtonText: {
    color: "#EA580C",
    fontSize: 13,
    fontWeight: "800",
  },
  stopBlock: {
    marginBottom: 2,
  },
  stopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  stopInputWrap: {
    flex: 1,
  },
  removeButton: {
    minWidth: 56,
    height: 52,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#FECACA",
    backgroundColor: "#FEF2F2",
    alignItems: "center",
    justifyContent: "center",
    marginTop: -14,
  },
  removeButtonDisabled: {
    opacity: 0.45,
  },
  removeButtonText: {
    color: "#DC2626",
    fontSize: 13,
    fontWeight: "800",
  },
  segmentWrap: {
    flexDirection: "row",
    backgroundColor: "#FFF1E6",
    borderRadius: 14,
    padding: 4,
    marginBottom: 14,
  },
  segmentButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  segmentButtonActive: {
    backgroundColor: "#F97316",
  },
  segmentText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#7C2D12",
  },
  segmentTextActive: {
    color: "#FFFFFF",
  },
  carTypeList: {
    gap: 10,
  },
  carTypeButton: {
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
  },
  carTypeButtonActive: {
    backgroundColor: "#FFF7ED",
    borderColor: "#F97316",
  },
  carTypeText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#111827",
  },
  carTypeTextActive: {
    color: "#EA580C",
  },
  footerSpace: {
    height: 4,
  },
  primaryButton: {
    backgroundColor: "#F97316",
    borderRadius: 14,
    minHeight: 54,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
  },
  buttonDisabled: {
    opacity: 0.55,
  },
  quoteCard: {
    marginTop: 16,
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  quoteTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#111827",
    marginBottom: 8,
  },
  quotePrice: {
    fontSize: 28,
    fontWeight: "900",
    color: "#111827",
    marginBottom: 10,
  },
  quoteNote: {
    fontSize: 14,
    lineHeight: 22,
    color: "#4B5563",
    marginBottom: 14,
  },
  quoteBenefits: {
    marginTop: 2,
    marginBottom: 14,
    gap: 6,
  },
  quoteBenefitText: {
    fontSize: 14,
    lineHeight: 22,
    color: "#4B5563",
    fontWeight: "700",
  },
  quoteBenefitHint: {
    fontSize: 14,
    lineHeight: 22,
    color: "#6B7280",
    fontWeight: "600",
  },
  quoteCountdown: {
    marginTop: 10,
    fontSize: 13,
    fontWeight: "700",
    color: "#6B7280",
    textAlign: "center",
  },
  quoteExpiredBox: {
    marginTop: 16,
    backgroundColor: "#FEF2F2",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "#FECACA",
  },
  quoteExpiredText: {
    color: "#DC2626",
    fontSize: 14,
    fontWeight: "800",
    textAlign: "center",
  },
  validationBox: {
    marginTop: 12,
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 6,
  },

  validationText: {
    fontSize: 13,
    lineHeight: 18,
    color: "#DC2626",
    fontWeight: "700",
  },
});
