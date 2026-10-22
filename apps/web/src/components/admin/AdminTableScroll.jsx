import { Box } from "@mui/material";

export const tripActionCellStyle = {
  position: "sticky",
  right: 0,
  zIndex: 2,
  backgroundColor: "#fff",
  boxShadow: "-3px 0 6px rgba(0, 0, 0, 0.08)",
  minWidth: 260,
  width: 260,
  maxWidth: 260,
};

export default function AdminTableScroll({ children, label = "Bảng dữ liệu" }) {
  return (
    <Box
      role="region"
      aria-label={label}
      tabIndex={0}
      sx={{ width: "100%", maxWidth: "100%", minWidth: 0, overflowX: "auto" }}
    >
      {children}
    </Box>
  );
}
