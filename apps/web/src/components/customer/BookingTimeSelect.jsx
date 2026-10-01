import { FormControl, InputLabel, MenuItem, Select, Stack, Typography } from "@mui/material";
import dayjs from "dayjs";

export default function BookingTimeSelect({ label, value, period, onPeriodChange, onChange }) {
  const hour = value ? dayjs(value).hour() : 0;
  const minute = value ? dayjs(value).minute() : 0;
  function update(hour12, nextMinute, nextPeriod) {
    const base = value ? dayjs(value) : dayjs("2000-01-15T00:00:00");
    onChange(base.hour((hour12 % 12) + (nextPeriod === "PM" ? 12 : 0)).minute(nextMinute).second(0).millisecond(0));
  }
  return (
    <Stack spacing={0.75} sx={{ width: "100%", minWidth: 0 }}>
      <Stack sx={{ display: "grid", gap: 1, gridTemplateColumns: { xs: "1fr 1fr", sm: "1fr 1fr 1.6fr" } }}>
        <FormControl size="small" sx={{ flex: 1, minWidth: 65 }}>
          <InputLabel>{label}</InputLabel>
          <Select label={label} inputProps={{ "aria-label": label }} value={value ? hour % 12 || 12 : ""}
            onChange={(event) => update(Number(event.target.value), minute, period)}
            MenuProps={{ PaperProps: { sx: { maxHeight: 280 } } }}>
            {Array.from({ length: 12 }, (_, i) => i + 1).map((h) => <MenuItem key={h} value={h}>{String(h).padStart(2, "0")}</MenuItem>)}
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ flex: 1, minWidth: 65 }}>
          <InputLabel>Phút</InputLabel>
          <Select label="Phút" inputProps={{ "aria-label": `${label} - phút` }} value={value ? minute : ""}
            onChange={(event) => update(hour % 12 || 12, Number(event.target.value), period)}>
            {Array.from({ length: 12 }, (_, i) => i * 5).map((m) => <MenuItem key={m} value={m}>{String(m).padStart(2, "0")}</MenuItem>)}
          </Select>
        </FormControl>
        <FormControl required size="small" sx={{ minWidth: 120, gridColumn: { xs: "1 / -1", sm: "auto" } }}>
          <InputLabel>Buổi</InputLabel>
          <Select label="Buổi" inputProps={{ "aria-label": `${label} - buổi` }} value={period} onChange={(event) => {
            onPeriodChange(event.target.value);
            update(hour % 12 || 12, minute, event.target.value);
          }}>
            <MenuItem value="AM">Sáng (AM)</MenuItem>
            <MenuItem value="PM">Chiều / tối (PM)</MenuItem>
          </Select>
        </FormControl>
      </Stack>
      {value && period && <Typography variant="body2" sx={{ fontWeight: 700 }}>
        {String(hour % 12 || 12).padStart(2, "0")}:{String(minute).padStart(2, "0")} {hour === 0 ? "đêm" : hour < 12 ? "sáng" : hour === 12 ? "trưa" : hour < 18 ? "chiều" : "tối"} · {dayjs(value).format("HH:mm")} (giờ Việt Nam)
      </Typography>}
    </Stack>
  );
}
