// Path: goviet247/apps/web/src/pages/admin/AdminConfig.jsx
import React from "react";
import {
  Box,
  Typography,
  Paper,
  Tabs,
  Tab,
  Grid,
  TextField,
  Alert,
  Button,
  Divider,
  IconButton,
  Stack,
  Chip,
  Switch,
  FormControlLabel,
  Snackbar,
  CircularProgress,
  MenuItem,
} from "@mui/material";
import SettingsIcon from "@mui/icons-material/Settings";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import DirectionsCarIcon from "@mui/icons-material/DirectionsCar";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import LocalTaxiIcon from "@mui/icons-material/LocalTaxi";
import TuneIcon from "@mui/icons-material/Tune";
import SaveIcon from "@mui/icons-material/Save";
import AccountBalanceWalletIcon from "@mui/icons-material/AccountBalanceWallet";
import TimerOutlinedIcon from "@mui/icons-material/TimerOutlined";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";

import { getAdminUser } from "../../utils/adminAuth";
import {
  fetchPricingConfigs,
  patchPricingConfig,
  fetchTripConfig,
  patchTripConfig,
  fetchDriverConfig,
  patchDriverConfig,
  fetchAlertConfig,
  patchAlertConfig,
  fetchSystemConfig,
  patchSystemConfig,
  uploadSystemConfigMedia,
} from "../../api/adminConfig";

function TabPanel({ value, index, children }) {
  if (value !== index) return null;
  return <Box sx={{ pt: 3 }}>{children}</Box>;
}

function SectionCard({ title, description, children }) {
  return (
    <Paper
      elevation={0}
      sx={{
        p: 3,
        borderRadius: 3,
        border: "1px solid",
        borderColor: "divider",
        height: "100%",
      }}
    >
      <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.5 }}>
        {title}
      </Typography>

      {description ? (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {description}
        </Typography>
      ) : null}

      <Divider sx={{ mb: 2 }} />

      {children}
    </Paper>
  );
}

function AlertConfigCard({
  title,
  description,
  enabled,
  startMinutes,
  repeatMinutes,
  phones,
  phoneInput,
  onToggleEnabled,
  onChangeStartMinutes,
  onChangeRepeatMinutes,
  onChangePhoneInput,
  onAddPhone,
  onRemovePhone,
}) {
  return (
    <SectionCard title={title} description={description}>
      <Stack spacing={2}>
        <FormControlLabel
          control={
            <Switch checked={Boolean(enabled)} onChange={onToggleEnabled} />
          }
          label={enabled ? "Đang bật cảnh báo" : "Đang tắt cảnh báo"}
        />

        <TextField
          label="Bắt đầu cảnh báo sau (phút)"
          value={startMinutes}
          onChange={onChangeStartMinutes}
          fullWidth
          type="number"
          inputProps={{ min: 0 }}
        />

        <TextField
          label="Lặp lại cảnh báo mỗi (phút)"
          value={repeatMinutes}
          onChange={onChangeRepeatMinutes}
          fullWidth
          type="number"
          inputProps={{ min: 1 }}
        />

        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={1.25}
          alignItems={{ xs: "stretch", sm: "center" }}
        >
          <TextField
            label="Số điện thoại nhận SMS"
            value={phoneInput}
            onChange={onChangePhoneInput}
            fullWidth
            placeholder="Ví dụ: 0901234567"
          />

          <Button
            variant="outlined"
            onClick={onAddPhone}
            sx={{ minWidth: 120 }}
          >
            Thêm số
          </Button>
        </Stack>

        <Box>
          {phones.length > 0 ? (
            <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
              {phones.map((phone) => (
                <Chip
                  key={phone}
                  label={phone}
                  onDelete={() => onRemovePhone(phone)}
                  color="primary"
                  variant="outlined"
                />
              ))}
            </Stack>
          ) : (
            <Typography variant="body2" color="text.secondary">
              Chưa có số điện thoại nào được thêm.
            </Typography>
          )}
        </Box>
      </Stack>
    </SectionCard>
  );
}

const CAR_TYPE_ORDER = ["CAR_5", "CAR_7", "CAR_16"];

const CAR_TYPE_META = {
  CAR_5: {
    title: "Xe 5 chỗ",
    description: "Cấu hình giá cước cho xe 5 chỗ.",
  },
  CAR_7: {
    title: "Xe 7 chỗ",
    description: "Cấu hình giá cước cho xe 7 chỗ.",
  },
  CAR_16: {
    title: "Xe 16 chỗ",
    description: "Cấu hình giá cước cho xe 16 chỗ.",
  },
};

function toFormValue(v) {
  if (v == null) return "";
  return String(v);
}

function parsePhoneCsv(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .filter((item, index, arr) => arr.indexOf(item) === index);
}

function normalizeKmTiersForForm(kmTiers) {
  if (!Array.isArray(kmTiers) || kmTiers.length === 0) {
    return [{ from: "0", to: "", pricePerKm: "" }];
  }

  return kmTiers.map((item) => ({
    from: toFormValue(item?.from),
    to: item?.to == null ? "" : toFormValue(item?.to),
    pricePerKm: toFormValue(item?.pricePerKm),
  }));
}

function buildKmTiersPayload(kmTiers) {
  return (kmTiers || []).map((item) => ({
    from: Number(item.from || 0),
    to: item.to === "" ? null : Number(item.to),
    pricePerKm: Number(item.pricePerKm || 0),
  }));
}

function validateKmTiers(kmTiers) {
  if (!Array.isArray(kmTiers) || kmTiers.length === 0) {
    return "Vui lòng cấu hình ít nhất 1 bậc km.";
  }

  const normalized = kmTiers.map((item, index) => {
    const from = Number(item?.from);
    const to = item?.to === "" ? null : Number(item?.to);
    const pricePerKm = Number(item?.pricePerKm);

    if (!Number.isFinite(from) || from < 0) {
      return { error: `Bậc km #${index + 1}: Từ km không hợp lệ.` };
    }

    if (to !== null && (!Number.isFinite(to) || to <= from)) {
      return { error: `Bậc km #${index + 1}: Đến km phải lớn hơn Từ km.` };
    }

    if (!Number.isFinite(pricePerKm) || pricePerKm < 0) {
      return { error: `Bậc km #${index + 1}: Giá/km không hợp lệ.` };
    }

    return { from, to, pricePerKm };
  });

  const firstError = normalized.find((item) => item.error);
  if (firstError) return firstError.error;

  const rows = normalized.sort((a, b) => a.from - b.from);

  if (rows[0].from !== 0) {
    return "Bậc km đầu tiên phải bắt đầu từ 0.";
  }

  for (let i = 0; i < rows.length; i++) {
    const current = rows[i];
    const next = rows[i + 1];

    if (next && current.to == null) {
      return "Chỉ bậc km cuối cùng mới được để trống mốc Đến km.";
    }

    if (next && current.to !== next.from) {
      return "Các bậc km phải nối tiếp nhau. Ví dụ: 0-50, 50-100, 100-200.";
    }
  }

  return "";
}

function normalizePricingRows(rows) {
  const mapped = {};

  for (const row of rows || []) {
    mapped[row.carType] = {
      id: row.id,
      carType: row.carType,
      baseFare: toFormValue(row.baseFare),
      pricePerKm: toFormValue(row.pricePerKm),
      pricePerHour: toFormValue(row.pricePerHour),
      minFare: toFormValue(row.minFare),
      overnightFee: toFormValue(row.overnightFee),
      overnightTriggerKm: toFormValue(row.overnightTriggerKm),
      overnightTriggerHours: toFormValue(row.overnightTriggerHours),
      kmTiers: normalizeKmTiersForForm(row.kmTiers),
      isActive: Boolean(row.isActive),
      updatedAt: row.updatedAt || null,
    };
  }

  return mapped;
}

function buildPayloadFromForm(item) {
  return {
    baseFare: Number(item.baseFare || 0),
    pricePerKm: Number(item.pricePerKm || 0),
    pricePerHour: Number(item.pricePerHour || 0),
    minFare: Number(item.minFare || 0),
    overnightFee: Number(item.overnightFee || 0),
    overnightTriggerKm: Number(item.overnightTriggerKm || 0),
    overnightTriggerHours: Number(item.overnightTriggerHours || 0),
    kmTiers: buildKmTiersPayload(item.kmTiers),
    isActive: Boolean(item.isActive),
  };
}

function formatDateTimeVN(input) {
  if (!input) return "N/A";

  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return "N/A";

  return new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    dateStyle: "short",
    timeStyle: "short",
  }).format(d);
}

function parsePercentInput(value, label) {
  const raw = String(value ?? "").trim();

  if (!raw) {
    return `${label} không được để trống.`;
  }

  const num = Number(raw);

  if (!Number.isFinite(num) || num < 0 || num > 100) {
    return `${label} phải nằm trong khoảng 0 đến 100.`;
  }

  return "";
}

const TAX_BASE_MODE_OPTIONS = [
  {
    value: "GROSS_TRIP_AMOUNT",
    label: "Tính trên tổng chuyến",
  },
  {
    value: "NET_AFTER_PLATFORM_COMMISSION",
    label: "Tính trên doanh thu sau hoa hồng nền tảng",
  },
];

function isValidTaxBaseMode(value) {
  return TAX_BASE_MODE_OPTIONS.some((item) => item.value === value);
}

function BrandingMediaField({
  label,
  mediaType,
  value,
  uploading,
  accept,
  previewType = "image",
  helperText = "",
  onChange,
  onUpload,
}) {
  const isImage = previewType === "image";
  const isAudio = previewType === "audio";

  return (
    <Stack spacing={1.25}>
      <TextField
        label={label}
        value={value || ""}
        onChange={onChange}
        fullWidth
        size="small"
      />

      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={1}
        alignItems={{ xs: "stretch", sm: "center" }}
      >
        <Button
          variant="outlined"
          component="label"
          disabled={uploading}
          sx={{ minWidth: 150 }}
        >
          {uploading ? "Đang upload..." : "Chọn file upload"}
          <input
            hidden
            type="file"
            accept={accept}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              onUpload(mediaType, file);
              e.target.value = "";
            }}
          />
        </Button>

        {helperText ? (
          <Typography variant="caption" color="text.secondary">
            {helperText}
          </Typography>
        ) : null}
      </Stack>

      {isImage && value ? (
        <Box
          sx={{
            border: "1px solid",
            borderColor: "divider",
            borderRadius: 2,
            overflow: "hidden",
            bgcolor: "#fafafa",
            p: 1,
          }}
        >
          <Box
            component="img"
            src={value}
            alt={label}
            sx={{
              width: "100%",
              maxHeight: 180,
              objectFit: "contain",
              display: "block",
              borderRadius: 1.5,
            }}
          />
        </Box>
      ) : null}

      {isAudio && value ? (
        <Box
          sx={{
            border: "1px solid",
            borderColor: "divider",
            borderRadius: 2,
            p: 1.25,
            bgcolor: "#fafafa",
          }}
        >
          <audio controls src={value} style={{ width: "100%" }} />
        </Box>
      ) : null}
    </Stack>
  );
}

function PricingCard({
  carType,
  item,
  saving,
  onFieldChange,
  onToggleActive,
  onKmTierChange,
  onAddKmTier,
  onRemoveKmTier,
  onSave,
}) {
  const meta = CAR_TYPE_META[carType] || {
    title: carType,
    description: "",
  };

  return (
    <SectionCard title={meta.title} description={meta.description}>
      <Stack spacing={2}>
        <TextField
          label="Giá mở cửa"
          value={item?.baseFare || ""}
          onChange={onFieldChange(carType, "baseFare")}
          fullWidth
          type="number"
          inputProps={{ min: 0 }}
        />

        <TextField
          label="Giá mỗi km (fallback)"
          value={item?.pricePerKm || ""}
          onChange={onFieldChange(carType, "pricePerKm")}
          fullWidth
          type="number"
          inputProps={{ min: 0 }}
          helperText="Chỉ dùng khi chưa cấu hình bậc km."
        />

        <TextField
          label="Giá chờ mỗi giờ"
          value={item?.pricePerHour || ""}
          onChange={onFieldChange(carType, "pricePerHour")}
          fullWidth
          type="number"
          inputProps={{ min: 0 }}
        />

        <TextField
          label="Giá tối thiểu"
          value={item?.minFare || ""}
          onChange={onFieldChange(carType, "minFare")}
          fullWidth
          type="number"
          inputProps={{ min: 0 }}
        />

        <TextField
          label="Phụ phí qua đêm"
          value={item?.overnightFee || ""}
          onChange={onFieldChange(carType, "overnightFee")}
          fullWidth
          type="number"
          inputProps={{ min: 0 }}
        />

        <TextField
          label="Số km kích hoạt qua đêm"
          value={item?.overnightTriggerKm || ""}
          onChange={onFieldChange(carType, "overnightTriggerKm")}
          fullWidth
          type="number"
          inputProps={{ min: 0 }}
        />

        <TextField
          label="Số giờ kích hoạt qua đêm"
          value={item?.overnightTriggerHours || ""}
          onChange={onFieldChange(carType, "overnightTriggerHours")}
          fullWidth
          type="number"
          inputProps={{ min: 0 }}
        />

        <Box
          sx={{
            p: 1.5,
            borderRadius: 2,
            border: "1px dashed",
            borderColor: "divider",
            bgcolor: "rgba(0,0,0,0.015)",
          }}
        >
          <Stack spacing={1.25}>
            <Stack
              direction="row"
              alignItems="center"
              justifyContent="space-between"
            >
              <Box>
                <Typography sx={{ fontWeight: 700, fontSize: 14 }}>
                  Bậc km
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Ví dụ: 0-50, 50-100, 100-200, 200+
                </Typography>
              </Box>

              <Button
                size="small"
                variant="outlined"
                startIcon={<AddIcon />}
                onClick={() => onAddKmTier(carType)}
              >
                Thêm bậc
              </Button>
            </Stack>

            <Stack spacing={1}>
              {(item?.kmTiers || []).map((tier, index) => (
                <Stack
                  key={`${carType}-tier-${index}`}
                  direction="row"
                  spacing={1}
                  alignItems="center"
                >
                  <TextField
                    label="Từ km"
                    value={tier.from}
                    onChange={onKmTierChange(carType, index, "from")}
                    type="number"
                    fullWidth
                    inputProps={{ min: 0 }}
                  />

                  <TextField
                    label="Đến km"
                    value={tier.to}
                    onChange={onKmTierChange(carType, index, "to")}
                    type="number"
                    fullWidth
                    placeholder="Để trống nếu là bậc cuối"
                    inputProps={{ min: 0 }}
                  />

                  <TextField
                    label="Giá/km"
                    value={tier.pricePerKm}
                    onChange={onKmTierChange(carType, index, "pricePerKm")}
                    type="number"
                    fullWidth
                    inputProps={{ min: 0 }}
                  />

                  <IconButton
                    color="error"
                    onClick={() => onRemoveKmTier(carType, index)}
                    disabled={(item?.kmTiers || []).length <= 1}
                  >
                    <DeleteOutlineIcon />
                  </IconButton>
                </Stack>
              ))}
            </Stack>
          </Stack>
        </Box>

        <FormControlLabel
          control={
            <Switch
              checked={Boolean(item?.isActive)}
              onChange={onToggleActive(carType)}
            />
          }
          label={item?.isActive ? "Đang hoạt động" : "Tạm tắt"}
        />

        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          spacing={1.5}
          sx={{ pt: 0.5 }}
        >
          <Typography variant="caption" color="text.secondary">
            Cập nhật: {formatDateTimeVN(item?.updatedAt)}
          </Typography>

          <Button
            variant="contained"
            startIcon={
              saving ? (
                <CircularProgress size={16} color="inherit" />
              ) : (
                <SaveIcon />
              )
            }
            onClick={() => onSave(carType)}
            disabled={saving}
          >
            {saving ? "Đang lưu..." : "Lưu"}
          </Button>
        </Stack>
      </Stack>
    </SectionCard>
  );
}

export default function AdminConfig() {
  const user = getAdminUser();
  const role = String(user?.role || "").toUpperCase();
  const isSuperAdmin = role === "ADMIN";

  const [tab, setTab] = React.useState(0);

  const [pricingMap, setPricingMap] = React.useState({});
  const [loadingPricing, setLoadingPricing] = React.useState(true);
  const [pricingError, setPricingError] = React.useState("");
  const [savingMap, setSavingMap] = React.useState({});

  const [loadingTripConfig, setLoadingTripConfig] = React.useState(true);
  const [tripConfigError, setTripConfigError] = React.useState("");
  const [savingTripConfig, setSavingTripConfig] = React.useState(false);

  const [loadingDriverConfig, setLoadingDriverConfig] = React.useState(true);
  const [driverConfigError, setDriverConfigError] = React.useState("");
  const [savingDriverConfig, setSavingDriverConfig] = React.useState(false);

  const [loadingAlertConfig, setLoadingAlertConfig] = React.useState(true);
  const [alertConfigError, setAlertConfigError] = React.useState("");
  const [savingAlertConfig, setSavingAlertConfig] = React.useState(false);

  const [loadingSystemConfig, setLoadingSystemConfig] = React.useState(true);
  const [systemConfigError, setSystemConfigError] = React.useState("");
  const [savingSystemConfig, setSavingSystemConfig] = React.useState(false);
  const [uploadingMediaMap, setUploadingMediaMap] = React.useState({});

  const [snackbar, setSnackbar] = React.useState({
    open: false,
    severity: "success",
    message: "",
  });

  const [form, setForm] = React.useState({
    // Trips
    maxStops: "10",
    minDistanceKm: "5",
    maxDistanceKm: "2000",
    quoteExpireSeconds: "120",

    // Drivers
    commissionPercent: "10",
    driverVatPercent: "3",
    driverPitPercent: "1.5",
    driverVatBaseMode: "GROSS_TRIP_AMOUNT",
    driverPitBaseMode: "GROSS_TRIP_AMOUNT",
    driverDepositAmount: "500000",
    maxActiveTrips: "1",
    newTripAcceptDelaySeconds: "10",

    // Alerts
    pendingWatcherEnabled: true,
    pendingTripEnabled: true,
    pendingTripStartMinutes: "1",
    pendingTripRepeatMinutes: "5",
    pendingTripPhones: [],

    unassignedTripEnabled: true,
    unassignedTripStartMinutes: "15",
    unassignedTripRepeatMinutes: "15",
    unassignedTripPhones: [],

    // System
    supportPhoneDriver: "0977100917",
    supportEmailDriver: "driver@goviet247.com",
    supportPhoneRider: "0977100917",
    supportEmailRider: "help@goviet247.com",
    timezone: "Asia/Ho_Chi_Minh",

    // Driver wallet topup config
    driverTopupBankName: "",
    driverTopupAccountNumber: "",
    driverTopupAccountHolderName: "",
    driverTopupTransferPrefix: "NAPVI",
    driverTopupQrImageUrl: "",
    driverTopupNote: "",
    // Branding & Media
    brandName: "GoViet247",
    brandLogoUrl: "",
    riderWebHeroImageUrl: "",
    riderMobileHeroImageUrl: "",
    driverMobileHeroImageUrl: "",
    defaultInAppSoundUrl: "",
    footerCopyright:
      "© 2023 GoViet247 - Công ty TNHH Công nghệ ViNa LightHouse",
  });

  const [alertPhoneInputs, setAlertPhoneInputs] = React.useState({
    pendingTrip: "",
    unassignedTrip: "",
  });

  const setField = (key) => (e) => {
    const value =
      e?.target?.type === "checkbox"
        ? Boolean(e.target.checked)
        : e.target.value;

    setForm((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const showSnackbar = React.useCallback((severity, message) => {
    setSnackbar({
      open: true,
      severity,
      message,
    });
  }, []);

  const handleCloseSnackbar = () => {
    setSnackbar((prev) => ({ ...prev, open: false }));
  };

  const loadPricingConfigs = React.useCallback(async () => {
    try {
      setLoadingPricing(true);
      setPricingError("");

      const rows = await fetchPricingConfigs();
      const normalized = normalizePricingRows(rows);

      setPricingMap(normalized);
    } catch (err) {
      setPricingError(err.message || "Không thể tải cấu hình giá cước.");
    } finally {
      setLoadingPricing(false);
    }
  }, []);

  const loadTripConfig = React.useCallback(async () => {
    try {
      setLoadingTripConfig(true);
      setTripConfigError("");

      const item = await fetchTripConfig();

      setForm((prev) => ({
        ...prev,
        maxStops: toFormValue(item?.maxStops),
        minDistanceKm: toFormValue(item?.minDistanceKm),
        maxDistanceKm: toFormValue(item?.maxDistanceKm),
        quoteExpireSeconds: toFormValue(item?.quoteExpireSeconds),
      }));
    } catch (err) {
      setTripConfigError(err.message || "Không thể tải cấu hình chuyến đi.");
    } finally {
      setLoadingTripConfig(false);
    }
  }, []);

  const loadDriverConfig = React.useCallback(async () => {
    try {
      setLoadingDriverConfig(true);
      setDriverConfigError("");

      const item = await fetchDriverConfig();

      setForm((prev) => ({
        ...prev,
        commissionPercent: toFormValue(item?.commissionPercent),
        driverVatPercent: toFormValue(item?.driverVatPercent),
        driverPitPercent: toFormValue(item?.driverPitPercent),
        driverVatBaseMode: item?.driverVatBaseMode || "GROSS_TRIP_AMOUNT",
        driverPitBaseMode: item?.driverPitBaseMode || "GROSS_TRIP_AMOUNT",
        driverDepositAmount: toFormValue(item?.driverDepositAmount),
        maxActiveTrips: toFormValue(item?.maxActiveTrips),
        newTripAcceptDelaySeconds: toFormValue(item?.newTripAcceptDelaySeconds),
      }));
    } catch (err) {
      setDriverConfigError(err.message || "Không thể tải cấu hình tài xế.");
    } finally {
      setLoadingDriverConfig(false);
    }
  }, []);

  const loadAlertConfig = React.useCallback(async () => {
    try {
      setLoadingAlertConfig(true);
      setAlertConfigError("");

      const item = await fetchAlertConfig();

      setForm((prev) => ({
        ...prev,
        pendingWatcherEnabled: Boolean(item?.pendingWatcherEnabled),

        pendingTripEnabled: Boolean(item?.pendingTripEnabled),
        pendingTripStartMinutes: toFormValue(item?.pendingTripStartMinutes),
        pendingTripRepeatMinutes: toFormValue(item?.pendingTripRepeatMinutes),
        pendingTripPhones: parsePhoneCsv(item?.pendingTripPhones),

        unassignedTripEnabled: Boolean(item?.unassignedTripEnabled),
        unassignedTripStartMinutes: toFormValue(
          item?.unassignedTripStartMinutes,
        ),
        unassignedTripRepeatMinutes: toFormValue(
          item?.unassignedTripRepeatMinutes,
        ),
        unassignedTripPhones: parsePhoneCsv(item?.unassignedTripPhones),
      }));

      setAlertPhoneInputs({
        pendingTrip: "",
        unassignedTrip: "",
      });
    } catch (err) {
      setAlertConfigError(err.message || "Không thể tải cấu hình cảnh báo.");
    } finally {
      setLoadingAlertConfig(false);
    }
  }, []);

  const loadSystemConfig = React.useCallback(async () => {
    try {
      setLoadingSystemConfig(true);
      setSystemConfigError("");

      const item = await fetchSystemConfig();

      setForm((prev) => ({
        ...prev,
        supportPhoneDriver: toFormValue(item?.supportPhoneDriver),
        supportEmailDriver: toFormValue(item?.supportEmailDriver),
        supportPhoneRider: toFormValue(item?.supportPhoneRider),
        supportEmailRider: toFormValue(item?.supportEmailRider),
        timezone: toFormValue(item?.timezone),

        driverTopupBankName: toFormValue(item?.driverTopupBankName),
        driverTopupAccountNumber: toFormValue(item?.driverTopupAccountNumber),
        driverTopupAccountHolderName: toFormValue(
          item?.driverTopupAccountHolderName,
        ),
        driverTopupTransferPrefix: toFormValue(
          item?.driverTopupTransferPrefix || "NAPVI",
        ),
        driverTopupQrImageUrl: toFormValue(item?.driverTopupQrImageUrl),
        driverTopupNote: toFormValue(item?.driverTopupNote),
        brandName: toFormValue(item?.brandName || "GoViet247"),
        brandLogoUrl: toFormValue(item?.brandLogoUrl),
        riderWebHeroImageUrl: toFormValue(item?.riderWebHeroImageUrl),
        riderMobileHeroImageUrl: toFormValue(item?.riderMobileHeroImageUrl),
        driverMobileHeroImageUrl: toFormValue(item?.driverMobileHeroImageUrl),
        defaultInAppSoundUrl: toFormValue(item?.defaultInAppSoundUrl),
        footerCopyright: toFormValue(item?.footerCopyright),
      }));
    } catch (err) {
      setSystemConfigError(err.message || "Không thể tải cấu hình hệ thống.");
    } finally {
      setLoadingSystemConfig(false);
    }
  }, []);

  React.useEffect(() => {
    if (!isSuperAdmin) return;
    loadPricingConfigs();
    loadTripConfig();
    loadDriverConfig();
    loadAlertConfig();
    loadSystemConfig();
  }, [
    isSuperAdmin,
    loadPricingConfigs,
    loadTripConfig,
    loadDriverConfig,
    loadAlertConfig,
    loadSystemConfig,
  ]);

  const handlePricingFieldChange = (carType, field) => (e) => {
    const value = e.target.value;

    setPricingMap((prev) => ({
      ...prev,
      [carType]: {
        ...prev[carType],
        [field]: value,
      },
    }));
  };

  const handleToggleActive = (carType) => (_, checked) => {
    setPricingMap((prev) => ({
      ...prev,
      [carType]: {
        ...prev[carType],
        isActive: checked,
      },
    }));
  };

  const handleKmTierChange = (carType, index, field) => (e) => {
    const value = e.target.value;

    setPricingMap((prev) => ({
      ...prev,
      [carType]: {
        ...prev[carType],
        kmTiers: (prev[carType]?.kmTiers || []).map((tier, i) =>
          i === index ? { ...tier, [field]: value } : tier,
        ),
      },
    }));
  };

  const handleAddKmTier = (carType) => {
    setPricingMap((prev) => {
      const currentTiers = prev[carType]?.kmTiers || [];
      const lastTier = currentTiers[currentTiers.length - 1];

      const nextFrom =
        lastTier?.to !== "" && lastTier?.to != null ? String(lastTier.to) : "";

      return {
        ...prev,
        [carType]: {
          ...prev[carType],
          kmTiers: [
            ...currentTiers,
            { from: nextFrom, to: "", pricePerKm: "" },
          ],
        },
      };
    });
  };

  const handleRemoveKmTier = (carType, index) => {
    setPricingMap((prev) => {
      const currentTiers = prev[carType]?.kmTiers || [];
      const nextTiers = currentTiers.filter((_, i) => i !== index);

      return {
        ...prev,
        [carType]: {
          ...prev[carType],
          kmTiers:
            nextTiers.length > 0
              ? nextTiers
              : [{ from: "0", to: "", pricePerKm: "" }],
        },
      };
    });
  };

  const validatePricingItem = (item) => {
    const fields = [
      { key: "baseFare", label: "Giá mở cửa" },
      { key: "pricePerKm", label: "Giá mỗi km fallback" },
      { key: "pricePerHour", label: "Giá chờ mỗi giờ" },
      { key: "minFare", label: "Giá tối thiểu" },
      { key: "overnightFee", label: "Phụ phí qua đêm" },
      { key: "overnightTriggerKm", label: "Số km kích hoạt qua đêm" },
      { key: "overnightTriggerHours", label: "Số giờ kích hoạt qua đêm" },
    ];

    for (const field of fields) {
      const raw = item?.[field.key];
      if (raw === "" || raw == null) {
        return `${field.label} không được để trống.`;
      }

      const num = Number(raw);
      if (!Number.isFinite(num) || num < 0) {
        return `${field.label} không hợp lệ.`;
      }
    }

    const kmTiersError = validateKmTiers(item?.kmTiers || []);
    if (kmTiersError) {
      return kmTiersError;
    }

    return "";
  };

  const validateTripConfigForm = () => {
    const maxStops = Number(form.maxStops);
    const minDistanceKm = Number(form.minDistanceKm);
    const maxDistanceKm = Number(form.maxDistanceKm);
    const quoteExpireSeconds = Number(form.quoteExpireSeconds);

    if (!Number.isInteger(maxStops) || maxStops < 0) {
      return "Số điểm dừng tối đa không hợp lệ.";
    }

    if (!Number.isInteger(minDistanceKm) || minDistanceKm < 0) {
      return "Quãng đường tối thiểu không hợp lệ.";
    }

    if (!Number.isInteger(maxDistanceKm) || maxDistanceKm <= 0) {
      return "Quãng đường tối đa phải lớn hơn 0.";
    }

    if (minDistanceKm > maxDistanceKm) {
      return "Quãng đường tối thiểu không được lớn hơn quãng đường tối đa.";
    }

    if (!Number.isInteger(quoteExpireSeconds) || quoteExpireSeconds <= 0) {
      return "Thời gian hiệu lực báo giá phải lớn hơn 0 giây.";
    }

    return "";
  };

  const validateDriverConfigForm = () => {
    const commissionPercent = Number(form.commissionPercent);
    const driverVatPercent = Number(form.driverVatPercent);
    const driverPitPercent = Number(form.driverPitPercent);
    const driverDepositAmount = Number(form.driverDepositAmount);
    const maxActiveTrips = Number(form.maxActiveTrips);
    const newTripAcceptDelaySeconds = Number(form.newTripAcceptDelaySeconds);

    const commissionError = parsePercentInput(
      form.commissionPercent,
      "Hoa hồng hệ thống",
    );
    if (commissionError) return commissionError;

    const vatError = parsePercentInput(form.driverVatPercent, "VAT tài xế");
    if (vatError) return vatError;

    const pitError = parsePercentInput(form.driverPitPercent, "PIT tài xế");
    if (pitError) return pitError;

    if (!Number.isInteger(driverDepositAmount) || driverDepositAmount < 0) {
      return "Tiền ký quỹ tài xế không hợp lệ.";
    }

    if (!Number.isInteger(maxActiveTrips) || maxActiveTrips <= 0) {
      return "Số chuyến hoạt động tối đa phải lớn hơn 0.";
    }

    if (
      !Number.isInteger(newTripAcceptDelaySeconds) ||
      newTripAcceptDelaySeconds < 0
    ) {
      return "Thời gian chờ mở nhận chuyến mới phải là số nguyên từ 0 giây trở lên.";
    }

    if (newTripAcceptDelaySeconds > 300) {
      return "Thời gian chờ mở nhận chuyến mới không được vượt quá 300 giây.";
    }

    if (!Number.isFinite(commissionPercent)) {
      return "Hoa hồng hệ thống không hợp lệ.";
    }

    if (!Number.isFinite(driverVatPercent)) {
      return "VAT tài xế không hợp lệ.";
    }

    if (!Number.isFinite(driverPitPercent)) {
      return "PIT tài xế không hợp lệ.";
    }

    if (!isValidTaxBaseMode(form.driverVatBaseMode)) {
      return "Cách tính VAT tài xế không hợp lệ.";
    }

    if (!isValidTaxBaseMode(form.driverPitBaseMode)) {
      return "Cách tính PIT tài xế không hợp lệ.";
    }

    return "";
  };

  const validateAlertConfigForm = () => {
    const pendingTripStartMinutes = Number(form.pendingTripStartMinutes);
    const pendingTripRepeatMinutes = Number(form.pendingTripRepeatMinutes);
    const unassignedTripStartMinutes = Number(form.unassignedTripStartMinutes);
    const unassignedTripRepeatMinutes = Number(
      form.unassignedTripRepeatMinutes,
    );

    if (
      !Number.isInteger(pendingTripStartMinutes) ||
      pendingTripStartMinutes < 0
    ) {
      return "Thời gian bắt đầu cảnh báo Chuyến (Chờ Duyệt) không hợp lệ.";
    }

    if (
      !Number.isInteger(pendingTripRepeatMinutes) ||
      pendingTripRepeatMinutes <= 0
    ) {
      return "Chu kỳ lặp lại cảnh báo Chuyến (Chờ Duyệt) phải lớn hơn 0 phút.";
    }

    if (
      !Number.isInteger(unassignedTripStartMinutes) ||
      unassignedTripStartMinutes <= 0
    ) {
      return "Thời gian bắt đầu cảnh báo Chuyến Chưa Có Tài Xế phải lớn hơn 0 phút.";
    }

    if (
      !Number.isInteger(unassignedTripRepeatMinutes) ||
      unassignedTripRepeatMinutes <= 0
    ) {
      return "Chu kỳ lặp lại cảnh báo Chuyến Chưa Có Tài Xế phải lớn hơn 0 phút.";
    }

    if (form.pendingTripEnabled && form.pendingTripPhones.length === 0) {
      return "Vui lòng thêm ít nhất 1 số điện thoại cho cảnh báo Chuyến (Chờ Duyệt).";
    }

    if (form.unassignedTripEnabled && form.unassignedTripPhones.length === 0) {
      return "Vui lòng thêm ít nhất 1 số điện thoại cho cảnh báo Chuyến Chưa Có Tài Xế.";
    }

    return "";
  };

  const validateSystemConfigForm = () => {
    const supportPhoneDriver = String(form.supportPhoneDriver || "").trim();
    const supportEmailDriver = String(form.supportEmailDriver || "").trim();
    const supportPhoneRider = String(form.supportPhoneRider || "").trim();
    const supportEmailRider = String(form.supportEmailRider || "").trim();
    const timezone = String(form.timezone || "").trim();
    const brandName = String(form.brandName || "").trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!supportPhoneDriver) {
      return "Số điện thoại hỗ trợ driver không được để trống.";
    }

    if (!supportEmailDriver) {
      return "Email hỗ trợ driver không được để trống.";
    }

    if (!emailRegex.test(supportEmailDriver)) {
      return "Email hỗ trợ driver không hợp lệ.";
    }

    if (!supportPhoneRider) {
      return "Số điện thoại hỗ trợ khách hàng không được để trống.";
    }

    if (!supportEmailRider) {
      return "Email hỗ trợ khách hàng không được để trống.";
    }

    if (!emailRegex.test(supportEmailRider)) {
      return "Email hỗ trợ khách hàng không hợp lệ.";
    }

    if (!timezone) {
      return "Timezone không được để trống.";
    }

    if (!brandName) {
      return "Tên thương hiệu không được để trống.";
    }

    return "";
  };

  const validateDriverTopupConfigForm = () => {
    const prefix = String(form.driverTopupTransferPrefix || "").trim();

    if (!prefix) {
      return "Tiền tố nội dung chuyển khoản không được để trống.";
    }

    return "";
  };

  const addPhoneToList = (field, inputKey) => {
    const raw = String(alertPhoneInputs[inputKey] || "").trim();

    if (!raw) {
      showSnackbar("error", "Vui lòng nhập số điện thoại trước khi thêm.");
      return;
    }

    setForm((prev) => {
      const nextList = Array.from(new Set([...(prev[field] || []), raw]));
      return {
        ...prev,
        [field]: nextList,
      };
    });

    setAlertPhoneInputs((prev) => ({
      ...prev,
      [inputKey]: "",
    }));
  };

  const removePhoneFromList = (field, phone) => {
    setForm((prev) => ({
      ...prev,
      [field]: (prev[field] || []).filter((item) => item !== phone),
    }));
  };

  const handleSavePricing = async (carType) => {
    const item = pricingMap[carType];
    if (!item) {
      showSnackbar("error", "Không tìm thấy dữ liệu cấu hình để lưu.");
      return;
    }

    const validationError = validatePricingItem(item);
    if (validationError) {
      showSnackbar("error", validationError);
      return;
    }

    try {
      setSavingMap((prev) => ({ ...prev, [carType]: true }));

      const payload = buildPayloadFromForm(item);
      const updated = await patchPricingConfig(carType, payload);

      setPricingMap((prev) => ({
        ...prev,
        [carType]: {
          id: updated.id,
          carType: updated.carType,
          baseFare: toFormValue(updated.baseFare),
          pricePerKm: toFormValue(updated.pricePerKm),
          pricePerHour: toFormValue(updated.pricePerHour),
          minFare: toFormValue(updated.minFare),
          overnightFee: toFormValue(updated.overnightFee),
          overnightTriggerKm: toFormValue(updated.overnightTriggerKm),
          overnightTriggerHours: toFormValue(updated.overnightTriggerHours),
          kmTiers: normalizeKmTiersForForm(updated.kmTiers),
          isActive: Boolean(updated.isActive),
          updatedAt: updated.updatedAt || null,
        },
      }));

      const label = CAR_TYPE_META[carType]?.title || carType;
      showSnackbar("success", `Đã lưu cấu hình ${label} thành công.`);
    } catch (err) {
      showSnackbar("error", err.message || "Lưu cấu hình thất bại.");
    } finally {
      setSavingMap((prev) => ({ ...prev, [carType]: false }));
    }
  };

  const handleSaveTripConfig = async () => {
    const validationError = validateTripConfigForm();
    if (validationError) {
      showSnackbar("error", validationError);
      return;
    }

    try {
      setSavingTripConfig(true);

      const updated = await patchTripConfig({
        maxStops: Number(form.maxStops),
        minDistanceKm: Number(form.minDistanceKm),
        maxDistanceKm: Number(form.maxDistanceKm),
        quoteExpireSeconds: Number(form.quoteExpireSeconds),
      });

      setForm((prev) => ({
        ...prev,
        maxStops: toFormValue(updated?.maxStops),
        minDistanceKm: toFormValue(updated?.minDistanceKm),
        maxDistanceKm: toFormValue(updated?.maxDistanceKm),
        quoteExpireSeconds: toFormValue(updated?.quoteExpireSeconds),
      }));

      showSnackbar("success", "Đã lưu cấu hình chuyến đi thành công.");
    } catch (err) {
      showSnackbar("error", err.message || "Lưu cấu hình chuyến đi thất bại.");
    } finally {
      setSavingTripConfig(false);
    }
  };

  const handleSaveDriverConfig = async () => {
    const validationError = validateDriverConfigForm();
    if (validationError) {
      showSnackbar("error", validationError);
      return;
    }

    try {
      setSavingDriverConfig(true);

      const updated = await patchDriverConfig({
        commissionPercent: Number(form.commissionPercent),
        driverVatPercent: Number(form.driverVatPercent),
        driverPitPercent: Number(form.driverPitPercent),
        driverVatBaseMode: form.driverVatBaseMode,
        driverPitBaseMode: form.driverPitBaseMode,
        driverDepositAmount: Number(form.driverDepositAmount),
        maxActiveTrips: Number(form.maxActiveTrips),
        newTripAcceptDelaySeconds: Number(form.newTripAcceptDelaySeconds),
      });

      setForm((prev) => ({
        ...prev,
        commissionPercent: toFormValue(updated?.commissionPercent),
        driverVatPercent: toFormValue(updated?.driverVatPercent),
        driverPitPercent: toFormValue(updated?.driverPitPercent),
        driverVatBaseMode: updated?.driverVatBaseMode || "GROSS_TRIP_AMOUNT",
        driverPitBaseMode: updated?.driverPitBaseMode || "GROSS_TRIP_AMOUNT",
        driverDepositAmount: toFormValue(updated?.driverDepositAmount),
        maxActiveTrips: toFormValue(updated?.maxActiveTrips),
        newTripAcceptDelaySeconds: toFormValue(
          updated?.newTripAcceptDelaySeconds,
        ),
      }));

      showSnackbar("success", "Đã lưu cấu hình tài xế thành công.");
    } catch (err) {
      showSnackbar("error", err.message || "Lưu cấu hình tài xế thất bại.");
    } finally {
      setSavingDriverConfig(false);
    }
  };

  const handleSaveAlertConfig = async () => {
    const validationError = validateAlertConfigForm();
    if (validationError) {
      showSnackbar("error", validationError);
      return;
    }

    try {
      setSavingAlertConfig(true);

      const updated = await patchAlertConfig({
        pendingWatcherEnabled: Boolean(form.pendingWatcherEnabled),

        pendingTripEnabled: Boolean(form.pendingTripEnabled),
        pendingTripStartMinutes: Number(form.pendingTripStartMinutes),
        pendingTripRepeatMinutes: Number(form.pendingTripRepeatMinutes),
        pendingTripPhones: (form.pendingTripPhones || []).join(","),

        unassignedTripEnabled: Boolean(form.unassignedTripEnabled),
        unassignedTripStartMinutes: Number(form.unassignedTripStartMinutes),
        unassignedTripRepeatMinutes: Number(form.unassignedTripRepeatMinutes),
        unassignedTripPhones: (form.unassignedTripPhones || []).join(","),
      });

      setForm((prev) => ({
        ...prev,
        pendingWatcherEnabled: Boolean(updated?.pendingWatcherEnabled),

        pendingTripEnabled: Boolean(updated?.pendingTripEnabled),
        pendingTripStartMinutes: toFormValue(updated?.pendingTripStartMinutes),
        pendingTripRepeatMinutes: toFormValue(
          updated?.pendingTripRepeatMinutes,
        ),
        pendingTripPhones: parsePhoneCsv(updated?.pendingTripPhones),

        unassignedTripEnabled: Boolean(updated?.unassignedTripEnabled),
        unassignedTripStartMinutes: toFormValue(
          updated?.unassignedTripStartMinutes,
        ),
        unassignedTripRepeatMinutes: toFormValue(
          updated?.unassignedTripRepeatMinutes,
        ),
        unassignedTripPhones: parsePhoneCsv(updated?.unassignedTripPhones),
      }));

      setAlertPhoneInputs({
        pendingTrip: "",
        unassignedTrip: "",
      });

      showSnackbar(
        "success",
        updated?.pendingWatcherEnabled
          ? "Đã bật pendingWatcher và lưu cấu hình cảnh báo thành công."
          : "Đã tắt pendingWatcher và lưu cấu hình cảnh báo thành công.",
      );
    } catch (err) {
      showSnackbar("error", err.message || "Lưu cấu hình cảnh báo thất bại.");
    } finally {
      setSavingAlertConfig(false);
    }
  };

  const handleSaveDriverTopupConfig = async () => {
    const validationError = validateDriverTopupConfigForm();
    if (validationError) {
      showSnackbar("error", validationError);
      return;
    }

    try {
      setSavingSystemConfig(true);

      const updated = await patchSystemConfig({
        driverTopupBankName: String(form.driverTopupBankName || "").trim(),
        driverTopupAccountNumber: String(
          form.driverTopupAccountNumber || "",
        ).trim(),
        driverTopupAccountHolderName: String(
          form.driverTopupAccountHolderName || "",
        ).trim(),
        driverTopupTransferPrefix: String(
          form.driverTopupTransferPrefix || "",
        ).trim(),
        driverTopupQrImageUrl: String(form.driverTopupQrImageUrl || "").trim(),
        driverTopupNote: String(form.driverTopupNote || "").trim(),
      });

      setForm((prev) => ({
        ...prev,
        driverTopupBankName: toFormValue(updated?.driverTopupBankName),
        driverTopupAccountNumber: toFormValue(
          updated?.driverTopupAccountNumber,
        ),
        driverTopupAccountHolderName: toFormValue(
          updated?.driverTopupAccountHolderName,
        ),
        driverTopupTransferPrefix: toFormValue(
          updated?.driverTopupTransferPrefix || "NAPVI",
        ),
        driverTopupQrImageUrl: toFormValue(updated?.driverTopupQrImageUrl),
        driverTopupNote: toFormValue(updated?.driverTopupNote),
      }));

      showSnackbar("success", "Đã lưu cấu hình nạp ví tài xế thành công.");
    } catch (err) {
      showSnackbar(
        "error",
        err.message || "Lưu cấu hình nạp ví tài xế thất bại.",
      );
    } finally {
      setSavingSystemConfig(false);
    }
  };

  const handleUploadSystemMedia = async (mediaType, file) => {
    try {
      setUploadingMediaMap((prev) => ({
        ...prev,
        [mediaType]: true,
      }));

      const result = await uploadSystemConfigMedia({
        file,
        mediaType,
      });

      const nextUrl = String(result?.url || "").trim();

      if (!nextUrl) {
        throw new Error("Upload thành công nhưng không nhận được URL file.");
      }

      const mediaFieldMap = {
        brand_logo: "brandLogoUrl",
        rider_web_hero: "riderWebHeroImageUrl",
        rider_mobile_hero: "riderMobileHeroImageUrl",
        driver_mobile_hero: "driverMobileHeroImageUrl",
        default_in_app_sound: "defaultInAppSoundUrl",
      };

      const targetField = mediaFieldMap[mediaType];

      if (!targetField) {
        throw new Error("mediaType không được hỗ trợ ở giao diện.");
      }

      setForm((prev) => ({
        ...prev,
        [targetField]: nextUrl,
      }));

      showSnackbar("success", "Upload media thành công.");
    } catch (err) {
      showSnackbar("error", err.message || "Upload media thất bại.");
    } finally {
      setUploadingMediaMap((prev) => ({
        ...prev,
        [mediaType]: false,
      }));
    }
  };

  const handleSaveSystemConfig = async () => {
    const validationError = validateSystemConfigForm();
    if (validationError) {
      showSnackbar("error", validationError);
      return;
    }

    try {
      setSavingSystemConfig(true);

      const updated = await patchSystemConfig({
        supportPhoneDriver: String(form.supportPhoneDriver || "").trim(),
        supportEmailDriver: String(form.supportEmailDriver || "").trim(),
        supportPhoneRider: String(form.supportPhoneRider || "").trim(),
        supportEmailRider: String(form.supportEmailRider || "").trim(),
        timezone: String(form.timezone || "").trim(),

        brandName: String(form.brandName || "").trim(),
        brandLogoUrl: String(form.brandLogoUrl || "").trim(),
        riderWebHeroImageUrl: String(form.riderWebHeroImageUrl || "").trim(),
        riderMobileHeroImageUrl: String(
          form.riderMobileHeroImageUrl || "",
        ).trim(),
        driverMobileHeroImageUrl: String(
          form.driverMobileHeroImageUrl || "",
        ).trim(),
        defaultInAppSoundUrl: String(form.defaultInAppSoundUrl || "").trim(),
        footerCopyright: String(form.footerCopyright || "").trim(),
      });

      setForm((prev) => ({
        ...prev,
        supportPhoneDriver: toFormValue(updated?.supportPhoneDriver),
        supportEmailDriver: toFormValue(updated?.supportEmailDriver),
        supportPhoneRider: toFormValue(updated?.supportPhoneRider),
        supportEmailRider: toFormValue(updated?.supportEmailRider),
        timezone: toFormValue(updated?.timezone),

        brandName: toFormValue(updated?.brandName || "GoViet247"),
        brandLogoUrl: toFormValue(updated?.brandLogoUrl),
        riderWebHeroImageUrl: toFormValue(updated?.riderWebHeroImageUrl),
        riderMobileHeroImageUrl: toFormValue(updated?.riderMobileHeroImageUrl),
        driverMobileHeroImageUrl: toFormValue(
          updated?.driverMobileHeroImageUrl,
        ),
        defaultInAppSoundUrl: toFormValue(updated?.defaultInAppSoundUrl),
        footerCopyright: toFormValue(updated?.footerCopyright),
      }));

      showSnackbar("success", "Đã lưu cấu hình hệ thống thành công.");
    } catch (err) {
      showSnackbar("error", err.message || "Lưu cấu hình hệ thống thất bại.");
    } finally {
      setSavingSystemConfig(false);
    }
  };

  if (!isSuperAdmin) {
    return (
      <Box>
        <Alert severity="warning" sx={{ borderRadius: 2 }}>
          Bạn không có quyền truy cập trang cấu hình hệ thống.
        </Alert>
      </Box>
    );
  }

  return (
    <Box>
      <Stack spacing={2}>
        <Stack
          direction={{ xs: "column", md: "row" }}
          justifyContent="space-between"
          alignItems={{ xs: "flex-start", md: "center" }}
          spacing={1.5}
        >
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 800 }}>
              Cấu hình hệ thống
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Quản lý giá cước, quy định chuyến đi, tài xế, cảnh báo và thông
              tin hệ thống.
            </Typography>
          </Box>

          <Chip
            color="primary"
            icon={<SettingsIcon />}
            label="Admin only"
            sx={{ fontWeight: 700 }}
          />
        </Stack>

        <Paper
          elevation={0}
          sx={{
            borderRadius: 3,
            border: "1px solid",
            borderColor: "divider",
            overflow: "hidden",
          }}
        >
          <Tabs
            value={tab}
            onChange={(_, next) => setTab(next)}
            variant="scrollable"
            scrollButtons="auto"
            sx={{ px: 2, pt: 1 }}
          >
            <Tab
              label="Giá cước"
              icon={<DirectionsCarIcon />}
              iconPosition="start"
            />
            <Tab label="Chuyến đi" icon={<TuneIcon />} iconPosition="start" />
            <Tab label="Tài xế" icon={<LocalTaxiIcon />} iconPosition="start" />
            <Tab
              label="Nạp ví tài xế"
              icon={<AccountBalanceWalletIcon />}
              iconPosition="start"
            />
            <Tab
              label="Cảnh báo"
              icon={<WarningAmberIcon />}
              iconPosition="start"
            />
            <Tab
              label="Hệ thống"
              icon={<LockOutlinedIcon />}
              iconPosition="start"
            />
          </Tabs>

          <Box sx={{ p: 3 }}>
            {/* TAB 1: GIÁ CƯỚC */}
            <TabPanel value={tab} index={0}>
              <Stack spacing={2.5}>
                {loadingPricing ? (
                  <Paper
                    elevation={0}
                    sx={{
                      borderRadius: 3,
                      border: "1px solid",
                      borderColor: "divider",
                      p: 4,
                    }}
                  >
                    <Stack
                      spacing={2}
                      alignItems="center"
                      justifyContent="center"
                    >
                      <CircularProgress />
                      <Typography color="text.secondary">
                        Đang tải cấu hình giá cước...
                      </Typography>
                    </Stack>
                  </Paper>
                ) : pricingError ? (
                  <Paper
                    elevation={0}
                    sx={{
                      borderRadius: 3,
                      border: "1px solid",
                      borderColor: "error.light",
                      p: 3,
                    }}
                  >
                    <Stack spacing={2}>
                      <Alert severity="error" sx={{ borderRadius: 2 }}>
                        {pricingError}
                      </Alert>

                      <Box>
                        <Button variant="outlined" onClick={loadPricingConfigs}>
                          Tải lại
                        </Button>
                      </Box>
                    </Stack>
                  </Paper>
                ) : (
                  <Grid container spacing={2.5}>
                    {CAR_TYPE_ORDER.map((carType) => (
                      <Grid item xs={12} md={4} key={carType}>
                        <PricingCard
                          carType={carType}
                          item={pricingMap[carType]}
                          saving={Boolean(savingMap[carType])}
                          onFieldChange={handlePricingFieldChange}
                          onToggleActive={handleToggleActive}
                          onKmTierChange={handleKmTierChange}
                          onAddKmTier={handleAddKmTier}
                          onRemoveKmTier={handleRemoveKmTier}
                          onSave={handleSavePricing}
                        />
                      </Grid>
                    ))}
                  </Grid>
                )}
              </Stack>
            </TabPanel>

            {/* TAB 2: CHUYẾN ĐI */}
            <TabPanel value={tab} index={1}>
              <Stack spacing={2.5}>
                {loadingTripConfig ? (
                  <Paper
                    elevation={0}
                    sx={{
                      borderRadius: 3,
                      border: "1px solid",
                      borderColor: "divider",
                      p: 4,
                    }}
                  >
                    <Stack
                      spacing={2}
                      alignItems="center"
                      justifyContent="center"
                    >
                      <CircularProgress />
                      <Typography color="text.secondary">
                        Đang tải cấu hình chuyến đi...
                      </Typography>
                    </Stack>
                  </Paper>
                ) : tripConfigError ? (
                  <Paper
                    elevation={0}
                    sx={{
                      borderRadius: 3,
                      border: "1px solid",
                      borderColor: "error.light",
                      p: 3,
                    }}
                  >
                    <Stack spacing={2}>
                      <Alert severity="error" sx={{ borderRadius: 2 }}>
                        {tripConfigError}
                      </Alert>

                      <Box>
                        <Button variant="outlined" onClick={loadTripConfig}>
                          Tải lại
                        </Button>
                      </Box>
                    </Stack>
                  </Paper>
                ) : (
                  <>
                    <Grid container spacing={2.5}>
                      <Grid item xs={12} md={3}>
                        <SectionCard
                          title="Giới hạn điểm dừng"
                          description="Số điểm dừng tối đa cho một chuyến."
                        >
                          <TextField
                            label="Max stops"
                            value={form.maxStops}
                            onChange={setField("maxStops")}
                            fullWidth
                            type="number"
                            inputProps={{ min: 0 }}
                          />
                        </SectionCard>
                      </Grid>

                      <Grid item xs={12} md={3}>
                        <SectionCard
                          title="Khoảng cách tối thiểu"
                          description="Quãng đường tối thiểu để được đặt chuyến."
                        >
                          <TextField
                            label="Min distance (km)"
                            value={form.minDistanceKm}
                            onChange={setField("minDistanceKm")}
                            fullWidth
                            type="number"
                            inputProps={{ min: 0 }}
                          />
                        </SectionCard>
                      </Grid>

                      <Grid item xs={12} md={3}>
                        <SectionCard
                          title="Khoảng cách tối đa"
                          description="Quãng đường tối đa được phép báo giá."
                        >
                          <TextField
                            label="Max distance (km)"
                            value={form.maxDistanceKm}
                            onChange={setField("maxDistanceKm")}
                            fullWidth
                            type="number"
                            inputProps={{ min: 1 }}
                          />
                        </SectionCard>
                      </Grid>

                      <Grid item xs={12} md={3}>
                        <SectionCard
                          title="Hết hạn báo giá"
                          description="Số giây giữ giá trước khi khách phải tính lại."
                        >
                          <TextField
                            label="Quote expire (s)"
                            value={form.quoteExpireSeconds}
                            onChange={setField("quoteExpireSeconds")}
                            fullWidth
                            type="number"
                            inputProps={{ min: 1 }}
                          />
                        </SectionCard>
                      </Grid>
                    </Grid>

                    <Stack
                      direction="row"
                      justifyContent="flex-end"
                      sx={{ pt: 0.5 }}
                    >
                      <Button
                        variant="contained"
                        startIcon={
                          savingTripConfig ? (
                            <CircularProgress size={16} color="inherit" />
                          ) : (
                            <SaveIcon />
                          )
                        }
                        onClick={handleSaveTripConfig}
                        disabled={savingTripConfig}
                      >
                        {savingTripConfig
                          ? "Đang lưu..."
                          : "Lưu cấu hình chuyến đi"}
                      </Button>
                    </Stack>
                  </>
                )}
              </Stack>
            </TabPanel>

            {/* TAB 3: TÀI XẾ */}
            <TabPanel value={tab} index={2}>
              <Stack spacing={2.5}>
                {loadingDriverConfig ? (
                  <Paper
                    elevation={0}
                    sx={{
                      borderRadius: 3,
                      border: "1px solid",
                      borderColor: "divider",
                      p: 4,
                    }}
                  >
                    <Stack
                      spacing={2}
                      alignItems="center"
                      justifyContent="center"
                    >
                      <CircularProgress />
                      <Typography color="text.secondary">
                        Đang tải cấu hình tài xế...
                      </Typography>
                    </Stack>
                  </Paper>
                ) : driverConfigError ? (
                  <Paper
                    elevation={0}
                    sx={{
                      borderRadius: 3,
                      border: "1px solid",
                      borderColor: "error.light",
                      p: 3,
                    }}
                  >
                    <Stack spacing={2}>
                      <Alert severity="error" sx={{ borderRadius: 2 }}>
                        {driverConfigError}
                      </Alert>

                      <Box>
                        <Button variant="outlined" onClick={loadDriverConfig}>
                          Tải lại
                        </Button>
                      </Box>
                    </Stack>
                  </Paper>
                ) : (
                  <>
                    <Grid container spacing={2.5}>
                      <Grid item xs={12} md={3}>
                        <SectionCard
                          title="Hoa hồng hệ thống"
                          description="Tỷ lệ phần trăm nền tảng thu từ tài xế."
                        >
                          <Stack spacing={2}>
                            <TextField
                              label="Commission (%)"
                              value={form.commissionPercent}
                              onChange={setField("commissionPercent")}
                              fullWidth
                              type="number"
                              inputProps={{ min: 0, max: 100, step: "0.01" }}
                            />
                          </Stack>
                        </SectionCard>
                      </Grid>

                      <Grid item xs={12} md={3}>
                        <SectionCard
                          title="VAT tài xế"
                          description="Tỷ lệ VAT khấu trừ và cách xác định base tính VAT cho tài xế."
                        >
                          <Stack spacing={2}>
                            <TextField
                              label="VAT (%)"
                              value={form.driverVatPercent}
                              onChange={setField("driverVatPercent")}
                              fullWidth
                              type="number"
                              inputProps={{ min: 0, max: 100, step: "0.01" }}
                            />

                            <TextField
                              select
                              label="Base tính VAT"
                              value={form.driverVatBaseMode}
                              onChange={setField("driverVatBaseMode")}
                              fullWidth
                              helperText="Chọn số tiền gốc dùng để tính VAT tài xế."
                            >
                              {TAX_BASE_MODE_OPTIONS.map((option) => (
                                <MenuItem
                                  key={option.value}
                                  value={option.value}
                                >
                                  {option.label}
                                </MenuItem>
                              ))}
                            </TextField>
                          </Stack>
                        </SectionCard>
                      </Grid>

                      <Grid item xs={12} md={3}>
                        <SectionCard
                          title="PIT tài xế"
                          description="Tỷ lệ PIT khấu trừ và cách xác định base tính PIT cho tài xế."
                        >
                          <Stack spacing={2}>
                            <TextField
                              label="PIT (%)"
                              value={form.driverPitPercent}
                              onChange={setField("driverPitPercent")}
                              fullWidth
                              type="number"
                              inputProps={{ min: 0, max: 100, step: "0.01" }}
                            />

                            <TextField
                              select
                              label="Base tính PIT"
                              value={form.driverPitBaseMode}
                              onChange={setField("driverPitBaseMode")}
                              fullWidth
                              helperText="Chọn số tiền gốc dùng để tính PIT tài xế."
                            >
                              {TAX_BASE_MODE_OPTIONS.map((option) => (
                                <MenuItem
                                  key={option.value}
                                  value={option.value}
                                >
                                  {option.label}
                                </MenuItem>
                              ))}
                            </TextField>
                          </Stack>
                        </SectionCard>
                      </Grid>

                      <Grid item xs={12} md={3}>
                        <SectionCard
                          title="Ký quỹ tài xế"
                          description="Số tiền ký quỹ tiêu chuẩn cho tài xế."
                        >
                          <Stack spacing={2}>
                            <TextField
                              label="Tiền ký quỹ"
                              value={form.driverDepositAmount}
                              onChange={setField("driverDepositAmount")}
                              fullWidth
                              type="number"
                              inputProps={{ min: 0 }}
                            />
                          </Stack>
                        </SectionCard>
                      </Grid>

                      <Grid item xs={12} md={3}>
                        <SectionCard
                          title="Giới hạn chuyến hoạt động"
                          description="Số chuyến tài xế được giữ cùng lúc."
                        >
                          <Stack spacing={2}>
                            <TextField
                              label="Max active trips"
                              value={form.maxActiveTrips}
                              onChange={setField("maxActiveTrips")}
                              fullWidth
                              type="number"
                              inputProps={{ min: 1 }}
                            />
                          </Stack>
                        </SectionCard>
                      </Grid>

                      <Grid item xs={12} md={3}>
                        <SectionCard
                          title="Mở nhận chuyến mới"
                          description="Số giây khóa nút nhận chuyến khi chuyến mới vừa vào pool tài xế."
                        >
                          <Stack spacing={2}>
                            <Stack
                              direction="row"
                              spacing={1}
                              alignItems="center"
                            >
                              <TimerOutlinedIcon
                                color="primary"
                                fontSize="small"
                              />
                              <Typography
                                variant="body2"
                                color="text.secondary"
                              >
                                Áp dụng cho chuyến mới và chuyến bị trả về pool.
                              </Typography>
                            </Stack>

                            <TextField
                              label="Thời gian chờ (giây)"
                              value={form.newTripAcceptDelaySeconds}
                              onChange={setField("newTripAcceptDelaySeconds")}
                              fullWidth
                              type="number"
                              inputProps={{ min: 0, max: 300 }}
                              helperText="Ví dụ: 10 giây. Nhập 0 nếu muốn mở nhận ngay."
                            />
                          </Stack>
                        </SectionCard>
                      </Grid>
                    </Grid>

                    <Stack
                      direction="row"
                      justifyContent="flex-end"
                      sx={{ pt: 0.5 }}
                    >
                      <Button
                        variant="contained"
                        startIcon={
                          savingDriverConfig ? (
                            <CircularProgress size={16} color="inherit" />
                          ) : (
                            <SaveIcon />
                          )
                        }
                        onClick={handleSaveDriverConfig}
                        disabled={savingDriverConfig}
                      >
                        {savingDriverConfig
                          ? "Đang lưu..."
                          : "Lưu cấu hình tài xế"}
                      </Button>
                    </Stack>
                  </>
                )}
              </Stack>
            </TabPanel>

            {/* TAB 4: NẠP VÍ TÀI XẾ */}
            <TabPanel value={tab} index={3}>
              <Stack spacing={2.5}>
                {loadingSystemConfig ? (
                  <Paper
                    elevation={0}
                    sx={{
                      borderRadius: 3,
                      border: "1px solid",
                      borderColor: "divider",
                      p: 4,
                    }}
                  >
                    <Stack
                      spacing={2}
                      alignItems="center"
                      justifyContent="center"
                    >
                      <CircularProgress />
                      <Typography color="text.secondary">
                        Đang tải cấu hình nạp ví tài xế...
                      </Typography>
                    </Stack>
                  </Paper>
                ) : systemConfigError ? (
                  <Paper
                    elevation={0}
                    sx={{
                      borderRadius: 3,
                      border: "1px solid",
                      borderColor: "error.light",
                      p: 3,
                    }}
                  >
                    <Stack spacing={2}>
                      <Alert severity="error" sx={{ borderRadius: 2 }}>
                        {systemConfigError}
                      </Alert>

                      <Box>
                        <Button variant="outlined" onClick={loadSystemConfig}>
                          Tải lại
                        </Button>
                      </Box>
                    </Stack>
                  </Paper>
                ) : (
                  <>
                    <Grid container spacing={2.5}>
                      <Grid item xs={12} md={4}>
                        <SectionCard
                          title="Ngân hàng nhận tiền"
                          description="Thông tin tài khoản để tài xế chuyển khoản nạp ví."
                        >
                          <Stack spacing={2}>
                            <TextField
                              label="Tên ngân hàng"
                              value={form.driverTopupBankName}
                              onChange={setField("driverTopupBankName")}
                              fullWidth
                            />

                            <TextField
                              label="Số tài khoản"
                              value={form.driverTopupAccountNumber}
                              onChange={setField("driverTopupAccountNumber")}
                              fullWidth
                            />

                            <TextField
                              label="Tên chủ tài khoản"
                              value={form.driverTopupAccountHolderName}
                              onChange={setField(
                                "driverTopupAccountHolderName",
                              )}
                              fullWidth
                            />
                          </Stack>
                        </SectionCard>
                      </Grid>

                      <Grid item xs={12} md={4}>
                        <SectionCard
                          title="Nội dung chuyển khoản"
                          description="Driver cần ghi đúng nội dung để admin dễ đối soát."
                        >
                          <Stack spacing={2}>
                            <TextField
                              label="Tiền tố nội dung"
                              value={form.driverTopupTransferPrefix}
                              onChange={setField("driverTopupTransferPrefix")}
                              fullWidth
                              helperText="Ví dụ: NAPVI. Nội dung thực tế có thể là NAPVI123456."
                            />

                            <TextField
                              label="Ghi chú thêm"
                              value={form.driverTopupNote}
                              onChange={setField("driverTopupNote")}
                              fullWidth
                              multiline
                              minRows={4}
                            />
                          </Stack>
                        </SectionCard>
                      </Grid>

                      <Grid item xs={12} md={4}>
                        <SectionCard
                          title="QR chuyển khoản"
                          description="Dán URL ảnh QR để app driver hiển thị mã quét nhanh."
                        >
                          <Stack spacing={2}>
                            <TextField
                              label="QR image URL"
                              value={form.driverTopupQrImageUrl}
                              onChange={setField("driverTopupQrImageUrl")}
                              fullWidth
                            />

                            <Alert severity="info" sx={{ borderRadius: 2 }}>
                              Có thể để trống nếu chưa dùng QR. Khi có ảnh QR
                              thật thì chỉ cần dán URL vào đây.
                            </Alert>
                          </Stack>
                        </SectionCard>
                      </Grid>
                    </Grid>

                    <Stack
                      direction="row"
                      justifyContent="flex-end"
                      sx={{ pt: 0.5 }}
                    >
                      <Button
                        variant="contained"
                        startIcon={
                          savingSystemConfig ? (
                            <CircularProgress size={16} color="inherit" />
                          ) : (
                            <SaveIcon />
                          )
                        }
                        onClick={handleSaveDriverTopupConfig}
                        disabled={savingSystemConfig}
                      >
                        {savingSystemConfig
                          ? "Đang lưu..."
                          : "Lưu cấu hình nạp ví tài xế"}
                      </Button>
                    </Stack>
                  </>
                )}
              </Stack>
            </TabPanel>

            {/* TAB 5: CẢNH BÁO */}
            <TabPanel value={tab} index={4}>
              <Stack spacing={2.5}>
                {loadingAlertConfig ? (
                  <Paper
                    elevation={0}
                    sx={{
                      borderRadius: 3,
                      border: "1px solid",
                      borderColor: "divider",
                      p: 4,
                    }}
                  >
                    <Stack
                      spacing={2}
                      alignItems="center"
                      justifyContent="center"
                    >
                      <CircularProgress />
                      <Typography color="text.secondary">
                        Đang tải cấu hình cảnh báo...
                      </Typography>
                    </Stack>
                  </Paper>
                ) : alertConfigError ? (
                  <Paper
                    elevation={0}
                    sx={{
                      borderRadius: 3,
                      border: "1px solid",
                      borderColor: "error.light",
                      p: 3,
                    }}
                  >
                    <Stack spacing={2}>
                      <Alert severity="error" sx={{ borderRadius: 2 }}>
                        {alertConfigError}
                      </Alert>

                      <Box>
                        <Button variant="outlined" onClick={loadAlertConfig}>
                          Tải lại
                        </Button>
                      </Box>
                    </Stack>
                  </Paper>
                ) : (
                  <>
                    <SectionCard
                      title="Trạng thái watcher cảnh báo"
                      description="Bật hoặc tắt hẳn pendingWatcher. Khi tắt, server sẽ clearInterval và dừng quét tự động hoàn toàn."
                    >
                      <Stack spacing={2}>
                        <FormControlLabel
                          control={
                            <Switch
                              checked={Boolean(form.pendingWatcherEnabled)}
                              onChange={(_, checked) =>
                                setForm((prev) => ({
                                  ...prev,
                                  pendingWatcherEnabled: checked,
                                }))
                              }
                            />
                          }
                          label={
                            form.pendingWatcherEnabled
                              ? "Đang bật pendingWatcher"
                              : "Đang tắt pendingWatcher"
                          }
                        />

                        <Alert
                          severity={
                            form.pendingWatcherEnabled ? "success" : "warning"
                          }
                          sx={{ borderRadius: 2 }}
                        >
                          {form.pendingWatcherEnabled
                            ? "Watcher đang hoạt động. Hệ thống sẽ tự động quét và gửi cảnh báo theo cấu hình bên dưới."
                            : "Watcher đang tắt hẳn. Hệ thống sẽ không quét, không gửi SMS và không tạo cảnh báo mới cho đến khi bạn bật lại."}
                        </Alert>
                      </Stack>
                    </SectionCard>
                    <Grid container spacing={2.5}>
                      <Grid item xs={12} md={6}>
                        <AlertConfigCard
                          title="Cảnh báo Chuyến (Chờ Duyệt)"
                          description="Cảnh báo SMS khi chuyến mới chưa được admin xác minh."
                          enabled={form.pendingTripEnabled}
                          startMinutes={form.pendingTripStartMinutes}
                          repeatMinutes={form.pendingTripRepeatMinutes}
                          phones={form.pendingTripPhones}
                          phoneInput={alertPhoneInputs.pendingTrip}
                          onToggleEnabled={(_, checked) =>
                            setForm((prev) => ({
                              ...prev,
                              pendingTripEnabled: checked,
                            }))
                          }
                          onChangeStartMinutes={setField(
                            "pendingTripStartMinutes",
                          )}
                          onChangeRepeatMinutes={setField(
                            "pendingTripRepeatMinutes",
                          )}
                          onChangePhoneInput={(e) =>
                            setAlertPhoneInputs((prev) => ({
                              ...prev,
                              pendingTrip: e.target.value,
                            }))
                          }
                          onAddPhone={() =>
                            addPhoneToList("pendingTripPhones", "pendingTrip")
                          }
                          onRemovePhone={(phone) =>
                            removePhoneFromList("pendingTripPhones", phone)
                          }
                        />
                      </Grid>

                      <Grid item xs={12} md={6}>
                        <AlertConfigCard
                          title="Cảnh báo Chuyến Chưa Có Tài Xế"
                          description="Cảnh báo SMS khi chuyến đã xác minh nhưng chưa có tài xế nhận."
                          enabled={form.unassignedTripEnabled}
                          startMinutes={form.unassignedTripStartMinutes}
                          repeatMinutes={form.unassignedTripRepeatMinutes}
                          phones={form.unassignedTripPhones}
                          phoneInput={alertPhoneInputs.unassignedTrip}
                          onToggleEnabled={(_, checked) =>
                            setForm((prev) => ({
                              ...prev,
                              unassignedTripEnabled: checked,
                            }))
                          }
                          onChangeStartMinutes={setField(
                            "unassignedTripStartMinutes",
                          )}
                          onChangeRepeatMinutes={setField(
                            "unassignedTripRepeatMinutes",
                          )}
                          onChangePhoneInput={(e) =>
                            setAlertPhoneInputs((prev) => ({
                              ...prev,
                              unassignedTrip: e.target.value,
                            }))
                          }
                          onAddPhone={() =>
                            addPhoneToList(
                              "unassignedTripPhones",
                              "unassignedTrip",
                            )
                          }
                          onRemovePhone={(phone) =>
                            removePhoneFromList("unassignedTripPhones", phone)
                          }
                        />
                      </Grid>
                    </Grid>

                    <Stack
                      direction="row"
                      justifyContent="flex-end"
                      sx={{ pt: 0.5 }}
                    >
                      <Button
                        variant="contained"
                        startIcon={
                          savingAlertConfig ? (
                            <CircularProgress size={16} color="inherit" />
                          ) : (
                            <SaveIcon />
                          )
                        }
                        onClick={handleSaveAlertConfig}
                        disabled={savingAlertConfig}
                      >
                        {savingAlertConfig
                          ? "Đang lưu..."
                          : "Lưu cấu hình cảnh báo"}
                      </Button>
                    </Stack>
                  </>
                )}
              </Stack>
            </TabPanel>

            {/* TAB 6: HỆ THỐNG */}
            <TabPanel value={tab} index={5}>
              <Stack spacing={2.5}>
                {loadingSystemConfig ? (
                  <Paper
                    elevation={0}
                    sx={{
                      borderRadius: 3,
                      border: "1px solid",
                      borderColor: "divider",
                      p: 4,
                    }}
                  >
                    <Stack
                      spacing={2}
                      alignItems="center"
                      justifyContent="center"
                    >
                      <CircularProgress />
                      <Typography color="text.secondary">
                        Đang tải cấu hình hệ thống...
                      </Typography>
                    </Stack>
                  </Paper>
                ) : systemConfigError ? (
                  <Paper
                    elevation={0}
                    sx={{
                      borderRadius: 3,
                      border: "1px solid",
                      borderColor: "error.light",
                      p: 3,
                    }}
                  >
                    <Stack spacing={2}>
                      <Alert severity="error" sx={{ borderRadius: 2 }}>
                        {systemConfigError}
                      </Alert>

                      <Box>
                        <Button variant="outlined" onClick={loadSystemConfig}>
                          Tải lại
                        </Button>
                      </Box>
                    </Stack>
                  </Paper>
                ) : (
                  <>
                    <Grid container spacing={2.5}>
                      <Grid item xs={12} md={4}>
                        <SectionCard
                          title="Hỗ trợ tài xế"
                          description="Thông tin hỗ trợ hiển thị ở app tài xế."
                        >
                          <Stack spacing={2}>
                            <TextField
                              label="Số điện thoại driver"
                              value={form.supportPhoneDriver}
                              onChange={setField("supportPhoneDriver")}
                              fullWidth
                            />

                            <TextField
                              label="Email driver"
                              value={form.supportEmailDriver}
                              onChange={setField("supportEmailDriver")}
                              fullWidth
                            />
                          </Stack>
                        </SectionCard>
                      </Grid>

                      <Grid item xs={12} md={4}>
                        <SectionCard
                          title="Hỗ trợ khách hàng"
                          description="Thông tin hỗ trợ hiển thị ở web khách hàng."
                        >
                          <Stack spacing={2}>
                            <TextField
                              label="Số điện thoại rider"
                              value={form.supportPhoneRider}
                              onChange={setField("supportPhoneRider")}
                              fullWidth
                            />

                            <TextField
                              label="Email rider"
                              value={form.supportEmailRider}
                              onChange={setField("supportEmailRider")}
                              fullWidth
                            />
                          </Stack>
                        </SectionCard>
                      </Grid>

                      <Grid item xs={12} md={4}>
                        <SectionCard
                          title="Timezone"
                          description="Timezone mặc định cho toàn hệ thống."
                        >
                          <TextField
                            label="Timezone"
                            value={form.timezone}
                            onChange={setField("timezone")}
                            fullWidth
                          />
                        </SectionCard>
                      </Grid>

                      <Grid item xs={12}>
                        <SectionCard
                          title="Branding & Media"
                          description="Quản lý tên thương hiệu, logo, ảnh nền Rider Web/Mobile, Driver Mobile và âm thanh in-app mặc định."
                        >
                          <Stack spacing={2.25}>
                            <TextField
                              label="Tên thương hiệu"
                              value={form.brandName}
                              onChange={setField("brandName")}
                              fullWidth
                            />

                            <TextField
                              label="Footer copyright"
                              value={form.footerCopyright}
                              onChange={setField("footerCopyright")}
                              fullWidth
                              multiline
                              minRows={2}
                            />

                            <BrandingMediaField
                              label="Logo thương hiệu"
                              mediaType="brand_logo"
                              value={form.brandLogoUrl}
                              uploading={Boolean(uploadingMediaMap.brand_logo)}
                              accept="image/*"
                              previewType="image"
                              helperText="Khuyên dùng PNG nền trong hoặc JPG ngang gọn."
                              onChange={setField("brandLogoUrl")}
                              onUpload={handleUploadSystemMedia}
                            />

                            <BrandingMediaField
                              label="Ảnh nền Rider Web"
                              mediaType="rider_web_hero"
                              value={form.riderWebHeroImageUrl}
                              uploading={Boolean(
                                uploadingMediaMap.rider_web_hero,
                              )}
                              accept="image/*"
                              previewType="image"
                              helperText="Ảnh hero cho trang chủ web khách hàng."
                              onChange={setField("riderWebHeroImageUrl")}
                              onUpload={handleUploadSystemMedia}
                            />

                            <BrandingMediaField
                              label="Banner Rider Mobile"
                              mediaType="rider_mobile_hero"
                              value={form.riderMobileHeroImageUrl}
                              uploading={Boolean(
                                uploadingMediaMap.rider_mobile_hero,
                              )}
                              accept="image/*"
                              previewType="image"
                              helperText="Chuẩn bị sẵn cho app Rider Mobile."
                              onChange={setField("riderMobileHeroImageUrl")}
                              onUpload={handleUploadSystemMedia}
                            />

                            <BrandingMediaField
                              label="Banner Driver Mobile"
                              mediaType="driver_mobile_hero"
                              value={form.driverMobileHeroImageUrl}
                              uploading={Boolean(
                                uploadingMediaMap.driver_mobile_hero,
                              )}
                              accept="image/*"
                              previewType="image"
                              helperText="Chuẩn bị sẵn cho app Driver Mobile."
                              onChange={setField("driverMobileHeroImageUrl")}
                              onUpload={handleUploadSystemMedia}
                            />

                            <BrandingMediaField
                              label="Âm thanh in-app mặc định"
                              mediaType="default_in_app_sound"
                              value={form.defaultInAppSoundUrl}
                              uploading={Boolean(
                                uploadingMediaMap.default_in_app_sound,
                              )}
                              accept="audio/*"
                              previewType="audio"
                              helperText="File mp3/wav dùng cho in-app sound về sau."
                              onChange={setField("defaultInAppSoundUrl")}
                              onUpload={handleUploadSystemMedia}
                            />
                          </Stack>
                        </SectionCard>
                      </Grid>
                    </Grid>

                    <Stack
                      direction="row"
                      justifyContent="flex-end"
                      sx={{ pt: 0.5 }}
                    >
                      <Button
                        variant="contained"
                        startIcon={
                          savingSystemConfig ? (
                            <CircularProgress size={16} color="inherit" />
                          ) : (
                            <SaveIcon />
                          )
                        }
                        onClick={handleSaveSystemConfig}
                        disabled={savingSystemConfig}
                      >
                        {savingSystemConfig
                          ? "Đang lưu..."
                          : "Lưu cấu hình hệ thống"}
                      </Button>
                    </Stack>
                  </>
                )}
              </Stack>
            </TabPanel>
          </Box>
        </Paper>
      </Stack>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      >
        <Alert
          severity={snackbar.severity}
          onClose={handleCloseSnackbar}
          sx={{ width: "100%", borderRadius: 2 }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
