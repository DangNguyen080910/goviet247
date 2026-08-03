// Path: goviet247/apps/web/src/components/customer/HeroSection.jsx

import {
  Box,
  Container,
  Typography,
  Stack,
  Button,
  TextField,
  InputAdornment,
} from "@mui/material";

import ChatIcon from "@mui/icons-material/Chat";
import AppleIcon from "@mui/icons-material/Apple";
import AndroidIcon from "@mui/icons-material/Android";
import LocationOnOutlinedIcon from "@mui/icons-material/LocationOnOutlined";
import FlagOutlinedIcon from "@mui/icons-material/FlagOutlined";
import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";

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

  const appStoreUrl = "https://apps.apple.com/vn/app/goviet247/id6767422059";

  const playStoreUrl =
    "https://play.google.com/store/apps/details?id=com.goviet247.rider";

  const FEATURED_HERO_ROUTE_KEYS = [
    "vung-tau",
    "ho-tram",
    "binh-chau",
    "long-hai",
    "phuoc-hai",
    "da-lat",
    "bao-loc",
    "phan-thiet",
    "mui-ne",
    "nha-trang",
    "cam-ranh",
    "can-tho",
  ];

  const featuredRoutes = FEATURED_HERO_ROUTE_KEYS.map((key) =>
    SEO_ROUTES.find((route) => route.key === key),
  ).filter(Boolean);

  const mainSeoLinks = [
    {
      label: "Xe liên tỉnh",
      path: "/xe-lien-tinh",
    },
    {
      label: "TP.HCM đi các tỉnh",
      path: "/tp-hcm-di-cac-tinh",
    },
    {
      label: "Các tỉnh đi TP.HCM",
      path: "/cac-tinh-di-tp-hcm",
    },
    {
      label: "Thuê xe đi tỉnh",
      path: "/thue-xe-di-tinh",
    },
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

  /*
   * Chuyển khách sang trang đặt xe.
   *
   * focusField: "pickup" dùng để báo cho trang /dat-xe rằng
   * sau khi mở trang cần focus vào ô Điểm đón.
   */
  const goToBookingPage = () => {
    navigate("/dat-xe", {
      state: {
        focusField: "pickup",
        source: "homepage-hero",
      },
    });
  };

  const fakeInputSx = {
    flex: 1,
    minWidth: {
      xs: "100%",
      sm: 210,
    },

    "& .MuiOutlinedInput-root": {
      height: 54,
      borderRadius: 2.5,
      bgcolor: "rgba(255,255,255,0.97)",
      color: "#202633",
      cursor: "pointer",

      transition: "transform 160ms ease, box-shadow 160ms ease",

      "& fieldset": {
        borderColor: "rgba(255,255,255,0.65)",
      },

      "&:hover": {
        transform: "translateY(-1px)",
        boxShadow: "0 8px 22px rgba(0,0,0,0.18)",
      },

      "&:hover fieldset": {
        borderColor: "#1976d2",
      },

      "&.Mui-focused fieldset": {
        borderColor: "#1976d2",
        borderWidth: 2,
      },
    },

    "& .MuiInputBase-input": {
      cursor: "pointer",
      fontWeight: 700,
      fontSize: {
        xs: 14,
        md: 15,
      },
    },

    "& .MuiInputBase-input::placeholder": {
      color: "#667085",
      opacity: 1,
      fontWeight: 600,
    },
  };

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
      {/* Lớp phủ tối để nội dung nổi rõ trên ảnh nền */}
      <Box
        sx={{
          position: "absolute",
          inset: 0,

          background:
            "linear-gradient(90deg, rgba(10,12,18,0.84) 0%, rgba(10,12,18,0.52) 46%, rgba(10,12,18,0.18) 100%)",
        }}
      />

      {/* Hiệu ứng ánh sáng nhẹ bên phải */}
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
          spacing={{
            xs: 1.6,
            md: 2,
          }}
          sx={{
            maxWidth: 900,

            pt: {
              xs: 3,
              md: 5,
            },

            pb: {
              xs: 4,
              md: 5,
            },
          }}
        >
          {/* ===================================================== */}
          {/* KHỐI NHẬP HÀNH TRÌNH MỚI */}
          {/* ===================================================== */}

          <Box
            sx={{
              width: "100%",
              maxWidth: 900,
              mx: "auto",
              boxSizing: "border-box",

              p: {
                xs: 1.5,
                sm: 2,
              },

              borderRadius: 3.5,

              bgcolor: "rgba(15,23,42,0.58)",
              border: "1px solid rgba(255,255,255,0.20)",
              boxShadow: "0 16px 40px rgba(0,0,0,0.20)",

              backdropFilter: "blur(12px)",
              WebkitBackdropFilter: "blur(12px)",
            }}
          >
            <Typography
              sx={{
                mb: 1.3,

                fontSize: {
                  xs: 17,
                  sm: 19,
                  md: 21,
                },

                fontWeight: 900,
                color: "white",
                textShadow: "0 4px 16px rgba(0,0,0,0.28)",
              }}
            >
              Bạn muốn đi đâu?
            </Typography>

            <Stack
              direction={{
                xs: "column",
                sm: "row",
              }}
              spacing={1.2}
              sx={{
                width: "100%",
              }}
            >
              {/* Input giả Điểm đón */}
              <TextField
                fullWidth
                placeholder="Nhập điểm đón"
                value=""
                onClick={goToBookingPage}
                onFocus={goToBookingPage}
                slotProps={{
                  input: {
                    readOnly: true,

                    startAdornment: (
                      <InputAdornment position="start">
                        <LocationOnOutlinedIcon
                          sx={{
                            color: "#1976d2",
                          }}
                        />
                      </InputAdornment>
                    ),
                  },

                  htmlInput: {
                    "aria-label": "Nhập điểm đón",
                  },
                }}
                sx={fakeInputSx}
              />

              {/* Input giả Điểm đến */}
              <TextField
                fullWidth
                placeholder="Nhập điểm đến"
                value=""
                onClick={goToBookingPage}
                onFocus={goToBookingPage}
                slotProps={{
                  input: {
                    readOnly: true,

                    startAdornment: (
                      <InputAdornment position="start">
                        <FlagOutlinedIcon
                          sx={{
                            color: "#f97316",
                          }}
                        />
                      </InputAdornment>
                    ),
                  },

                  htmlInput: {
                    "aria-label": "Nhập điểm đến",
                  },
                }}
                sx={fakeInputSx}
              />

              {/* Nút chuyển sang trang đặt xe */}
              <Button
                variant="contained"
                size="large"
                endIcon={<ArrowForwardRoundedIcon />}
                onClick={goToBookingPage}
                sx={{
                  minWidth: {
                    xs: "100%",
                    sm: 190,
                  },

                  minHeight: 54,

                  px: 2.6,
                  borderRadius: 2.5,

                  textTransform: "none",

                  fontSize: {
                    xs: 15,
                    md: 16,
                  },

                  fontWeight: 900,

                  bgcolor: "#f97316",
                  color: "white",

                  boxShadow: "0 10px 24px rgba(249,115,22,0.34)",

                  "&:hover": {
                    bgcolor: "#ea580c",
                    boxShadow: "0 12px 28px rgba(249,115,22,0.44)",
                    transform: "translateY(-1px)",
                  },
                }}
              >
                Xem giá chuyến đi
              </Button>
            </Stack>

            <Typography
              sx={{
                mt: 1.1,
                fontSize: {
                  xs: 12,
                  sm: 13,
                },
                fontWeight: 600,
                opacity: 0.88,
              }}
            >
              Nhập hành trình để xem quãng đường và nhận báo giá trước khi đặt
              xe.
            </Typography>
          </Box>

          {/* ===================================================== */}
          {/* TIÊU ĐỀ HERO */}
          {/* ===================================================== */}

          <Typography
            variant="h2"
            sx={{
              fontWeight: 900,
              letterSpacing: -0.6,

              fontSize: {
                xs: 30,
                sm: 44,
                md: 56,
              },

              lineHeight: {
                xs: 1.12,
                md: 1.05,
              },

              textShadow: "0 10px 30px rgba(0,0,0,0.35)",
            }}
          >
            Thuê xe riêng, đi đường dài thoải mái
          </Typography>

          <Typography
            sx={{
              fontSize: {
                xs: 14,
                sm: 16,
                md: 18,
              },

              opacity: 0.95,
              maxWidth: 680,
            }}
          >
            Giá rõ ràng • Hỗ trợ 24/7 • Phù hợp du lịch, công việc, gia đình
          </Typography>

          <Typography
            sx={{
              fontSize: {
                xs: 14,
                sm: 16,
                md: 18,
              },

              opacity: 0.95,
              maxWidth: 680,
            }}
          >
            Báo giá trước · Không cần đặt cọc · Thanh toán sau chuyến đi
          </Typography>

          <Stack spacing={1.4} sx={{ pt: 0.5 }}>
            {/* Chỉ giữ lại Chat Zalo vì nút đặt xe đã nằm phía trên */}
            <Stack
              direction="row"
              sx={{
                flexWrap: "wrap",
                gap: 1.2,
                maxWidth: "100%",
              }}
            >
              <Button
                variant="outlined"
                size="large"
                startIcon={<ChatIcon />}
                href={`https://zalo.me/${zaloPhone}`}
                target="_blank"
                rel="noopener noreferrer"
                sx={{
                  textTransform: "none",
                  borderRadius: 2.5,
                  fontWeight: 900,
                  px: 3,
                  py: 1.1,

                  color: "white",
                  borderColor: "rgba(255,255,255,0.45)",

                  "&:hover": {
                    borderColor: "rgba(255,255,255,0.75)",
                    bgcolor: "rgba(255,255,255,0.10)",
                  },
                }}
              >
                Cần tư vấn? Chat Zalo
              </Button>
            </Stack>

            {/* Nút tải ứng dụng */}
            {/* Nút tải ứng dụng */}
            <Box
              sx={{
                mt: 0.6,
              }}
            >
              <Typography
                sx={{
                  mb: 1.1,
                  fontWeight: 900,
                  fontSize: {
                    xs: 15,
                    sm: 16,
                  },
                  opacity: 1,
                  textShadow: "0 3px 12px rgba(0,0,0,0.35)",
                }}
              >
                📱 Tải ứng dụng GoViet247
              </Typography>

              <Stack
                direction={{
                  xs: "column",
                  sm: "row",
                }}
                sx={{
                  gap: 1.1,
                  width: {
                    xs: "100%",
                    sm: "auto",
                  },
                  maxWidth: "100%",
                }}
              >
                <Button
                  variant="outlined"
                  startIcon={<AppleIcon />}
                  href={appStoreUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Tải ứng dụng GoViet247 cho iPhone trên App Store"
                  sx={{
                    minHeight: 50,
                    minWidth: {
                      xs: "100%",
                      sm: 185,
                    },

                    px: 2.5,
                    py: 1,

                    justifyContent: {
                      xs: "flex-start",
                      sm: "center",
                    },

                    textTransform: "none",
                    borderRadius: 2.5,
                    fontWeight: 900,
                    fontSize: 15,

                    color: "white",
                    borderColor: "rgba(255,255,255,0.72)",
                    bgcolor: "rgba(255,255,255,0.16)",

                    boxShadow: "0 8px 22px rgba(0,0,0,0.18)",

                    backdropFilter: "blur(10px)",
                    WebkitBackdropFilter: "blur(10px)",

                    transition:
                      "transform 160ms ease, background-color 160ms ease, border-color 160ms ease",

                    "& .MuiButton-startIcon": {
                      mr: 1.1,
                    },

                    "& .MuiSvgIcon-root": {
                      fontSize: 25,
                    },

                    "&:hover": {
                      borderColor: "rgba(255,255,255,0.95)",
                      bgcolor: "rgba(255,255,255,0.25)",
                      transform: "translateY(-1px)",
                    },
                  }}
                >
                  iPhone · App Store
                </Button>

                <Button
                  variant="outlined"
                  startIcon={<AndroidIcon />}
                  href={playStoreUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Tải ứng dụng GoViet247 cho Android trên Google Play"
                  sx={{
                    minHeight: 50,
                    minWidth: {
                      xs: "100%",
                      sm: 200,
                    },

                    px: 2.5,
                    py: 1,

                    justifyContent: {
                      xs: "flex-start",
                      sm: "center",
                    },

                    textTransform: "none",
                    borderRadius: 2.5,
                    fontWeight: 900,
                    fontSize: 15,

                    color: "white",
                    borderColor: "rgba(255,255,255,0.72)",
                    bgcolor: "rgba(255,255,255,0.16)",

                    boxShadow: "0 8px 22px rgba(0,0,0,0.18)",

                    backdropFilter: "blur(10px)",
                    WebkitBackdropFilter: "blur(10px)",

                    transition:
                      "transform 160ms ease, background-color 160ms ease, border-color 160ms ease",

                    "& .MuiButton-startIcon": {
                      mr: 1.1,
                    },

                    "& .MuiSvgIcon-root": {
                      fontSize: 25,
                    },

                    "&:hover": {
                      borderColor: "rgba(255,255,255,0.95)",
                      bgcolor: "rgba(255,255,255,0.25)",
                      transform: "translateY(-1px)",
                    },
                  }}
                >
                  Android · Google Play
                </Button>
              </Stack>
            </Box>
          </Stack>

          {/* ===================================================== */}
          {/* INTERNAL SEO LINKS */}
          {/* ===================================================== */}

          <Box sx={{ pt: 0.8 }}>
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
              GoViet247 hỗ trợ tuyến TP.HCM đi tỉnh, tỉnh về TP.HCM và các tuyến
              liên tỉnh như Đà Lạt → Phan Thiết, Vũng Tàu → Cần Thơ... Bạn có
              thể nhập bất kỳ điểm đón, điểm đến nào khi đặt xe.
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
