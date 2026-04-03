// Path: goviet247/apps/web/src/components/customer/ZaloFloatingButton.jsx
import { Box, Tooltip } from "@mui/material";
import ChatIcon from "@mui/icons-material/Chat";
import { useEffect, useState } from "react";
import { getPublicSystemConfig } from "../../api/systemConfig";

/**
 * Nút Chat Zalo nổi góc phải màn hình
 * - Tự lấy supportPhoneRider từ SystemConfig
 * - Dùng chung số hỗ trợ khách hàng để mở Zalo
 */
export default function ZaloFloatingButton() {
  const [zaloPhone, setZaloPhone] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const cfg = await getPublicSystemConfig();
        const phone = cfg?.supportPhoneRider || "";

        setZaloPhone(phone);
      } catch (err) {
        console.error("Load Zalo config failed:", err);
      }
    }

    load();
  }, []);

  if (!zaloPhone) return null;

  const link = `https://zalo.me/${zaloPhone}`;

  return (
    <Tooltip title="Chat Zalo hỗ trợ">
      <Box
        component="a"
        href={link}
        target="_blank"
        rel="noopener noreferrer"
        sx={{
          position: "fixed",
          right: 20,
          bottom: 80,
          zIndex: (t) => t.zIndex.drawer + 5,
          width: 56,
          height: 56,
          borderRadius: "50%",
          bgcolor: "#0068ff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 6px 20px rgba(0,0,0,0.25)",
          cursor: "pointer",
          transition: "all 0.2s ease",
          "&:hover": {
            transform: "scale(1.08)",
            boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
          },
        }}
      >
        <ChatIcon sx={{ color: "white", fontSize: 28 }} />
      </Box>
    </Tooltip>
  );
}