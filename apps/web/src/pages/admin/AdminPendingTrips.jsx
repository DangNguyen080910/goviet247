// Path: goviet247/apps/web/src/pages/admin/AdminPendingTrips.jsx

import { useEffect, useState } from "react";
import { Box, Tabs, Tab, Typography, TextField } from "@mui/material";
import { useLocation } from "react-router-dom";

import PendingTripsTable from "../../components/admin/PendingTripsTable";
import TripDetailModal from "../../components/admin/TripDetailModal";

export default function AdminPendingTrips() {
  const location = useLocation();
  const [selectedTripId, setSelectedTripId] = useState("");
  const [tab, setTab] = useState(0); // 0: chưa có tài xế | 1: đã huỷ
  const [searchText, setSearchText] = useState("");

  // ✅ key để force remount table => auto reload data
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const tangRefresh = () => {
      if (location.pathname.startsWith("/admin/pending")) {
        setRefreshKey((k) => k + 1);
      }
    };

    window.addEventListener("admin:new_trip", tangRefresh);
    window.addEventListener("admin:trip_accepted", tangRefresh);
    window.addEventListener("admin:trip_status_changed", tangRefresh);
    window.addEventListener("admin:trip_cancelled", tangRefresh);
    window.addEventListener("admin:dashboard_changed", tangRefresh);

    return () => {
      window.removeEventListener("admin:new_trip", tangRefresh);
      window.removeEventListener("admin:trip_accepted", tangRefresh);
      window.removeEventListener("admin:trip_status_changed", tangRefresh);
      window.removeEventListener("admin:trip_cancelled", tangRefresh);
      window.removeEventListener("admin:dashboard_changed", tangRefresh);
    };
  }, [location.pathname]);

  return (
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 800, mb: 1 }}>
        Chuyến Chưa Có Tài Xế
      </Typography>

      <Typography variant="body2" sx={{ color: "text.secondary", mb: 2 }}>
        {tab === 0
          ? "Danh sách chuyến PENDING đã duyệt, đang chờ tài xế nhận."
          : "Danh sách chuyến đã huỷ (để cần thì gọi lại cho khách)."}
      </Typography>

      <Tabs
        value={tab}
        onChange={(_, v) => setTab(v)}
        sx={{ mb: 2 }}
        variant="scrollable"
        allowScrollButtonsMobile
      >
        <Tab label="Chưa có tài xế" />
        <Tab label="Đã huỷ" />
      </Tabs>

      <TextField
        fullWidth
        size="small"
        label="Tìm kiếm"
        placeholder="Nhập mã chuyến, tên khách, số điện thoại..."
        value={searchText}
        onChange={(e) => setSearchText(e.target.value)}
        sx={{ mb: 2, maxWidth: 520 }}
      />

      <PendingTripsTable
        key={`${tab}-${refreshKey}`}
        showCustomer
        mode={tab === 0 ? "active" : "cancelled"}
        searchText={searchText}
        onSelectTrip={(id) => setSelectedTripId(id)}
      />

      <TripDetailModal
        open={!!selectedTripId}
        tripId={selectedTripId}
        onClose={() => setSelectedTripId("")}
      />
    </Box>
  );
}
