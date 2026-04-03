// Path: goviet247/apps/web/src/pages/admin/AdminNotifications.jsx
import { useState } from "react";
import { Box, Paper, Typography, TextField } from "@mui/material";

import AlertsTable from "../../components/admin/AlertsTable";
import TripDetailModal from "../../components/admin/TripDetailModal";

export default function AdminNotifications() {
  // tripId đang được chọn để xem chi tiết
  const [selectedTripId, setSelectedTripId] = useState("");
  const [searchText, setSearchText] = useState("");

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h5" sx={{ fontWeight: 800, mb: 1 }}>
        Cảnh Báo
      </Typography>

      <Typography variant="body2" sx={{ color: "text.secondary", mb: 2 }}>
        Lịch sử cảnh báo các chuyến đang chờ xử lý quá lâu.
      </Typography>

      <Paper elevation={3} sx={{ p: 2 }}>
        <Typography variant="h6" sx={{ mb: 2 }}>
          Lịch sử cảnh báo
        </Typography>

        <TextField
          fullWidth
          size="small"
          label="Tìm kiếm"
          placeholder="Nhập mã chuyến, cấp độ, kênh, nội dung cảnh báo..."
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          sx={{ mb: 2, maxWidth: 620 }}
        />

        <AlertsTable
          searchText={searchText}
          onSelectTrip={(id) => setSelectedTripId(id)}
        />
      </Paper>

      <TripDetailModal
        open={!!selectedTripId}
        tripId={selectedTripId}
        onClose={() => setSelectedTripId("")}
      />
    </Box>
  );
}