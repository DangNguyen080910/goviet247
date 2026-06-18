// Path: goviet247/apps/web/src/components/customer/HeroSection.jsx
import { Box, Container, Typography, Stack, Button } from "@mui/material";
import ChatIcon from "@mui/icons-material/Chat";
import AppleIcon from "@mui/icons-material/Apple";
import AndroidIcon from "@mui/icons-material/Android";
import { Link, useNavigate } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import heroImage from "../../assets/xe.png";
import { HEADER_H, FOOTER_H } from "./CustomerLayout";
import { getPublicSystemConfig } from "../../api/systemConfig";
import { SEO_ROUTES } from "../../data/seoRoutes";

export default function HeroSection() {
  const navigate = useNavigate();
  const [zaloPhone, setZaloPhone] = useState("1900-0000");
  const [heroImageUrl, setHeroImageUrl] = useState("");
  const appStoreUrl = "https://apps.apple.com/vn/app/goviet247/id6767422059";

  const playStoreUrl =
    "https://play.google.com/store/apps/details?id=com.goviet247.rider";

  const deviceType = useMemo(() => {
    if (typeof window === "undefined") return "desktop";

    const ua = navigator.userAgent.toLowerCase();

    if (/iphone|ipad|ipod/.test(ua)) {
      return "ios";
    }

    if (/android/.test(ua)) {
      return "android";
    }

    return "desktop";
  }, []);

  const featuredRoutes = SEO_ROUTES.slice(0, 12);

  const mainSeoLinks = [
    { label: "Xe liên tỉnh", path: "/xe-lien-tinh" },
    { label: "TP.HCM đi các tỉnh", path: "/tp-hcm-di-cac-tinh" },
    { label: "Các tỉnh đi TP.HCM", path: "/cac-tinh-di-tp-hcm" },
    { label: "Thuê xe đi tỉnh", path: "/thue-xe-di-tinh" },
  ];

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

        height: {
          xs: "auto",
          md: `calc(100dvh - ${HEADER_H}px - ${FOOTER_H}px)`,
        },

        minHeight: {
          xs: `calc(100dvh - ${HEADER_H}px - ${FOOTER_H}px)`,
          md: 620,
        },

        display: "flex",

        alignItems: {
          xs: "flex-start",
          md: "center",
        },

        overflowX: "hidden",
        overflowY: {
          xs: "visible",
          md: "hidden",
        },
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

      <Container
        maxWidth="lg"
        sx={{
          position: "relative",
          zIndex: 1,
          width: "100%",
          maxWidth: "100%",
          overflowX: "hidden",
        }}
      >
        <Stack
          spacing={{ xs: 1.6, md: 2.2 }}
          sx={{
            maxWidth: 820,
            pt: { xs: 4, md: 10 },
            pb: { xs: 4, md: 10 },
          }}
        >
          <Typography
            variant="h2"
            sx={{
              fontWeight: 900,
              letterSpacing: -0.6,
              fontSize: { xs: 30, sm: 46, md: 60 },
              lineHeight: { xs: 1.12, md: 1.05 },
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

          <Stack spacing={1.8} sx={{ pt: 1 }}>
            <Stack
              direction="row"
              sx={{
                flexWrap: "wrap",
                gap: 1.2,
                maxWidth: "100%",
              }}
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

            <Box>
              <Typography
                sx={{
                  mb: 1,
                  fontWeight: 700,
                  fontSize: 13,
                  px: 1.8,
                  py: 0.7,
                  opacity: 0.82,
                }}
              >
                📱 Tải ứng dụng GoViet247
              </Typography>

              <Stack
                direction="row"
                sx={{
                  flexWrap: "wrap",
                  gap: 1,
                  maxWidth: "100%",
                }}
              >
                {(deviceType === "ios" || deviceType === "desktop") && (
                  <Button
                    variant="outlined"
                    startIcon={<AppleIcon />}
                    href={appStoreUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    sx={{
                      textTransform: "none",
                      borderRadius: 999,
                      fontWeight: 800,
                      color: "white",
                      borderColor: "rgba(255,255,255,0.35)",
                      bgcolor: "rgba(255,255,255,0.06)",
                      backdropFilter: "blur(8px)",
                      "&:hover": {
                        borderColor: "rgba(255,255,255,0.7)",
                        bgcolor: "rgba(255,255,255,0.12)",
                      },
                    }}
                  >
                    App Store
                  </Button>
                )}

                {(deviceType === "android" || deviceType === "desktop") && (
                  <Button
                    variant="outlined"
                    startIcon={<AndroidIcon />}
                    href={playStoreUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    sx={{
                      textTransform: "none",
                      borderRadius: 999,
                      fontWeight: 800,
                      color: "white",
                      borderColor: "rgba(255,255,255,0.35)",
                      bgcolor: "rgba(255,255,255,0.06)",
                      backdropFilter: "blur(8px)",
                      "&:hover": {
                        borderColor: "rgba(255,255,255,0.7)",
                        bgcolor: "rgba(255,255,255,0.12)",
                      },
                    }}
                  >
                    Google Play
                  </Button>
                )}
              </Stack>
            </Box>
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
              Đặt xe TP.HCM đi tỉnh, tỉnh về TP.HCM và liên tỉnh theo nhu cầu
            </Typography>

            <Typography
              sx={{
                mb: 1,
                fontSize: 13,
                opacity: 0.86,
                maxWidth: 680,
              }}
            >
              GoViet247 hỗ trợ tuyến TP.HCM đi tỉnh, tỉnh về TP.HCM và cả các
              tuyến liên tỉnh như Đà Lạt → Phan Thiết, Vũng Tàu → Cần Thơ... Bạn
              có thể nhập bất kỳ điểm đón, điểm đến nào khi đặt xe.
            </Typography>

            <Stack
              direction="row"
              sx={{
                flexWrap: "wrap",
                gap: 1,
                maxWidth: "100%",
                overflowX: "hidden",
              }}
            >
              {mainSeoLinks.map((item) => (
                <Button
                  key={item.path}
                  component={Link}
                  to={item.path}
                  variant="contained"
                  size="small"
                  sx={{
                    textTransform: "none",
                    borderRadius: 999,
                    fontWeight: 900,
                    bgcolor: "rgba(255,255,255,0.20)",
                    color: "white",
                    boxShadow: "none",
                    "&:hover": {
                      bgcolor: "rgba(255,255,255,0.28)",
                      boxShadow: "none",
                    },
                  }}
                >
                  {item.label}
                </Button>
              ))}

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
