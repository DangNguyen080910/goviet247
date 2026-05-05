// Path: goviet247/apps/web/src/components/customer/HeroSection.jsx
import { Box, Container, Typography, Stack, Button } from "@mui/material";
import ChatIcon from "@mui/icons-material/Chat";
import { Link, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import heroImage from "../../assets/xe.png";
import { HEADER_H, FOOTER_H } from "./CustomerLayout";
import { getPublicSystemConfig } from "../../api/systemConfig";
import { SEO_ROUTES } from "../../data/seoRoutes";

export default function HeroSection() {
  const navigate = useNavigate();
  const [zaloPhone, setZaloPhone] = useState("1900-0000");
  const [heroImageUrl, setHeroImageUrl] = useState("");

  const featuredRoutes = SEO_ROUTES.slice(0, 7);

  useEffect(() => {
    async function loadConfig() {
      try {
        const cfg = await getPublicSystemConfig();
        const phone = cfg?.supportPhoneRider || "1900-0000";

        setZaloPhone(phone);
        setHeroImageUrl(cfg?.riderWebBackgroundImageUrl || "");
      } catch (err) {
        console.error("Load hero system config failed:", err);
      }
    }

    loadConfig();
  }, []);

  return (
    <Box
      sx={{
        position: "relative",
        width: "100%",
        height: `calc(100dvh - ${HEADER_H}px - ${FOOTER_H}px)`,
        minHeight: 620,
        display: "flex",
        alignItems: "center",
        overflow: "hidden",
        backgroundImage: `url(${heroImageUrl || heroImage})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        color: "white",
      }}
    >
      <Box
        sx={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(90deg, rgba(10,12,18,0.80) 0%, rgba(10,12,18,0.48) 45%, rgba(10,12,18,0.18) 100%)",
        }}
      />

      <Box
        sx={{
          position: "absolute",
          top: -140,
          right: -160,
          width: 420,
          height: 420,
          borderRadius: "50%",
          bgcolor: "rgba(255,255,255,0.10)",
          filter: "blur(55px)",
        }}
      />

      <Container maxWidth="lg" sx={{ position: "relative", zIndex: 1 }}>
        <Stack spacing={2.2} sx={{ maxWidth: 820, py: { xs: 6, md: 10 } }}>
          <Typography
            variant="h2"
            sx={{
              fontWeight: 900,
              letterSpacing: -0.6,
              fontSize: { xs: 34, sm: 46, md: 60 },
              lineHeight: 1.05,
              textShadow: "0 10px 30px rgba(0,0,0,0.35)",
            }}
          >
            Thuê xe riêng, đi đường dài thoải mái
          </Typography>

          <Typography
            sx={{
              fontSize: { xs: 14, sm: 16, md: 18 },
              opacity: 0.95,
              maxWidth: 680,
            }}
          >
            Giá rõ ràng • Hỗ trợ 24/7 • Phù hợp du lịch, công việc, gia đình
          </Typography>

          <Stack
            direction="row"
            spacing={1.2}
            sx={{ pt: 1, flexWrap: "wrap", rowGap: 1.2 }}
          >
            <Button
              variant="contained"
              size="large"
              sx={{
                textTransform: "none",
                borderRadius: 2.5,
                fontWeight: 900,
                px: 3,
                py: 1.2,
              }}
              onClick={() => navigate("/dat-xe")}
            >
              Bắt Đầu Đặt Xe
            </Button>

            <Button
              variant="outlined"
              size="large"
              startIcon={<ChatIcon />}
              sx={{
                textTransform: "none",
                borderRadius: 2.5,
                fontWeight: 900,
                px: 3,
                py: 1.2,
                color: "white",
                borderColor: "rgba(255,255,255,0.45)",
                "&:hover": {
                  borderColor: "rgba(255,255,255,0.75)",
                  bgcolor: "rgba(255,255,255,0.06)",
                },
              }}
              href={`https://zalo.me/${zaloPhone}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              Chat Zalo
            </Button>
          </Stack>

          <Box sx={{ pt: 1.2 }}>
            <Typography
              sx={{
                mb: 0.5,
                fontSize: 14,
                fontWeight: 800,
                opacity: 0.95,
              }}
            >
              Đặt xe đi tỉnh, về TP.HCM hoặc liên tỉnh theo nhu cầu
            </Typography>

            <Typography
              sx={{
                mb: 1,
                fontSize: 13,
                opacity: 0.86,
                maxWidth: 680,
              }}
            >
              Các tuyến bên dưới chỉ là gợi ý phổ biến. Bạn có thể nhập bất kỳ
              điểm đón, điểm đến nào khi đặt xe.
            </Typography>

            <Stack
              direction="row"
              spacing={1}
              sx={{ flexWrap: "wrap", rowGap: 1 }}
            >
              {featuredRoutes.map((route) => (
                <Button
                  key={route.key}
                  component={Link}
                  to={`/${route.path}`}
                  variant="outlined"
                  size="small"
                  sx={{
                    textTransform: "none",
                    borderRadius: 999,
                    fontWeight: 800,
                    color: "white",
                    borderColor: "rgba(255,255,255,0.42)",
                    bgcolor: "rgba(255,255,255,0.08)",
                    "&:hover": {
                      borderColor: "rgba(255,255,255,0.75)",
                      bgcolor: "rgba(255,255,255,0.14)",
                    },
                  }}
                >
                  {route.from} → {route.to}
                </Button>
              ))}
            </Stack>
          </Box>
        </Stack>
      </Container>
    </Box>
  );
}
