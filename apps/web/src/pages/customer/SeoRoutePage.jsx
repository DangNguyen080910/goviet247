// Path: goviet247/apps/web/src/pages/customer/SeoRoutePage.jsx
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  Box,
  Button,
  InputAdornment,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import LocationOnOutlinedIcon from "@mui/icons-material/LocationOnOutlined";
import FlagOutlinedIcon from "@mui/icons-material/FlagOutlined";
import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import { getPublicSystemConfig } from "../../api/systemConfig";
import { getSeoRouteByPath } from "../../api/seoRoutes";

/*
 * Các Hub SEO chính.
 *
 * Mỗi trang tuyến xe đều liên kết về các Hub để:
 * - Tạo cấu trúc Homepage → Hub → Route
 * - Giúp Google hiểu nhóm nội dung
 * - Tăng internal link cho các trang danh mục
 */
const SEO_HUB_LINKS = [
  {
    label: "Xe liên tỉnh",
    path: "/xe-lien-tinh",
  },
  {
    label: "TP.HCM đi các tỉnh",
    path: "/tp-hcm-di-cac-tinh",
  },
  {
    label: "Các tỉnh về TP.HCM",
    path: "/cac-tinh-di-tp-hcm",
  },
  {
    label: "Thuê xe đi tỉnh",
    path: "/thue-xe-di-tinh",
  },
  {
    label: "Xe 5 chỗ",
    path: "/xe-5-cho",
  },
  {
    label: "Xe 7 chỗ",
    path: "/xe-7-cho",
  },
  {
    label: "Xe 16 chỗ",
    path: "/xe-16-cho",
  },
];

/*
 * Các Hub SEO theo tỉnh hoặc điểm đến.
 *
 * aliases dùng để nhận diện tỉnh trong:
 * - route.from
 * - route.to
 * - route.title
 * - route.description
 * - route.routeText
 * - route.path
 */
const PROVINCE_HUB_LINKS = [
  {
    label: "Vũng Tàu",
    path: "/vung-tau",
    aliases: [
      "vũng tàu",
      "vung tau",
      "bà rịa - vũng tàu",
      "bà rịa vũng tàu",
      "ba ria vung tau",
    ],
  },
  {
    label: "Hồ Tràm",
    path: "/ho-tram",
    aliases: ["hồ tràm", "ho tram"],
  },
  {
    label: "Long Hải",
    path: "/long-hai",
    aliases: ["long hải", "long hai"],
  },
  {
    label: "Bình Châu",
    path: "/binh-chau",
    aliases: ["bình châu", "binh chau"],
  },
  {
    label: "Phan Thiết",
    path: "/phan-thiet",
    aliases: ["phan thiết", "phan thiet"],
  },
  {
    label: "Mũi Né",
    path: "/mui-ne",
    aliases: ["mũi né", "mui ne"],
  },
  {
    label: "Đà Lạt",
    path: "/da-lat",
    aliases: ["đà lạt", "da lat"],
  },
  {
    label: "Nha Trang",
    path: "/nha-trang",
    aliases: ["nha trang"],
  },
  {
    label: "Tây Ninh",
    path: "/tay-ninh",
    aliases: ["tây ninh", "tay ninh"],
  },
  {
    label: "Cần Thơ",
    path: "/can-tho",
    aliases: ["cần thơ", "can tho"],
  },
  {
    label: "Bến Tre",
    path: "/ben-tre",
    aliases: ["bến tre", "ben tre"],
  },
  {
    label: "Long An",
    path: "/long-an",
    aliases: ["long an"],
  },
  {
    label: "Tiền Giang",
    path: "/tien-giang",
    aliases: ["tiền giang", "tien giang"],
  },
  {
    label: "Vĩnh Long",
    path: "/vinh-long",
    aliases: ["vĩnh long", "vinh long"],
  },
  {
    label: "Đồng Tháp",
    path: "/dong-thap",
    aliases: ["đồng tháp", "dong thap"],
  },
  {
    label: "An Giang",
    path: "/an-giang",
    aliases: ["an giang"],
  },
  {
    label: "Kiên Giang",
    path: "/kien-giang",
    aliases: ["kiên giang", "kien giang"],
  },
];

function normalizeSeoText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

function getRouteSearchableText(route) {
  return normalizeSeoText(
    [
      route?.from,
      route?.to,
      route?.title,
      route?.description,
      route?.routeText,
      route?.path,
      route?.key,
    ]
      .filter(Boolean)
      .join(" "),
  );
}

function getProvinceHubLinks(route) {
  const searchableText = getRouteSearchableText(route);

  return PROVINCE_HUB_LINKS.filter((hub) =>
    hub.aliases.some((alias) =>
      searchableText.includes(normalizeSeoText(alias)),
    ),
  );
}

/*
 * Hub thông minh theo nội dung của từng tuyến.
 *
 * Ví dụ:
 * - Tuyến có "5 chỗ" → link Hub xe 5 chỗ
 * - Tuyến có "du lịch" → link Hub xe đi du lịch
 * - Tuyến có "sân bay" → link Hub đưa đón sân bay
 */
const SMART_HUB_CONFIGS = [
  {
    key: "car-5-seat",
    label: "Xe 5 chỗ",
    path: "/xe-5-cho",
    keywords: ["5 chỗ", "5 cho", "xe-5-cho"],
  },
  {
    key: "car-7-seat",
    label: "Xe 7 chỗ",
    path: "/xe-7-cho",
    keywords: ["7 chỗ", "7 cho", "xe-7-cho"],
  },
  {
    key: "car-16-seat",
    label: "Xe 16 chỗ",
    path: "/xe-16-cho",
    keywords: ["16 chỗ", "16 cho", "xe-16-cho"],
  },
  {
    key: "tourism",
    label: "Xe đi du lịch",
    path: "/xe-di-du-lich",
    keywords: [
      "du lịch",
      "du lich",
      "tham quan",
      "nghỉ dưỡng",
      "nghi duong",
      "khám phá",
      "kham pha",
    ],
  },
  {
    key: "business",
    label: "Xe đi công tác",
    path: "/xe-di-cong-tac",
    keywords: [
      "công tác",
      "cong tac",
      "đối tác",
      "doi tac",
      "chuyên gia",
      "chuyen gia",
      "khu công nghiệp",
      "khu cong nghiep",
      "nhà máy",
      "nha may",
    ],
  },
  {
    key: "airport",
    label: "Xe đưa đón sân bay",
    path: "/xe-dua-don-san-bay",
    keywords: [
      "sân bay",
      "san bay",
      "tân sơn nhất",
      "tan son nhat",
      "cam ranh",
      "long thành",
      "long thanh",
    ],
  },
  {
    key: "resort",
    label: "Xe đưa đón resort",
    path: "/xe-dua-don-resort",
    keywords: [
      "resort",
      "khách sạn",
      "khach san",
      "khu nghỉ dưỡng",
      "khu nghi duong",
    ],
  },
  {
    key: "rental",
    label: "Thuê xe đi tỉnh",
    path: "/thue-xe-di-tinh",
    keywords: [
      "thuê xe",
      "thue xe",
      "thue-xe",
      "xe riêng",
      "xe rieng",
      "xe-rieng",
    ],
  },
];

function getSmartHubLinks(route) {
  const searchableText = getRouteSearchableText(route);

  return SMART_HUB_CONFIGS.filter((hub) =>
    hub.keywords.some((keyword) =>
      searchableText.includes(normalizeSeoText(keyword)),
    ),
  ).slice(0, 6);
}

export default function SeoRoutePage({ routeKey }) {
  const navigate = useNavigate();
  const { seoPath } = useParams();
  const [zaloPhone, setZaloPhone] = useState("0326184628");
  const [remoteRoute, setRemoteRoute] = useState(null);
  const [remoteRelatedRoutes, setRemoteRelatedRoutes] = useState([]);
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeNotFound, setRouteNotFound] = useState(false);
  const appStoreUrl = "https://apps.apple.com/vn/app/goviet247/id6767422059";
  const playStoreUrl =
    "https://play.google.com/store/apps/details?id=com.goviet247.rider";

  const requestedPath = routeKey || seoPath;
  const route = remoteRoute;

  useEffect(() => {
    if (!requestedPath) {
      setRemoteRoute(null);
      setRemoteRelatedRoutes([]);
      setRouteLoading(false);
      setRouteNotFound(false);
      return undefined;
    }

    const controller = new AbortController();
    setRouteLoading(true);
    setRouteNotFound(false);

    getSeoRouteByPath(requestedPath, { signal: controller.signal })
      .then((data) => {
        setRemoteRoute(data.route);
        setRemoteRelatedRoutes(data.relatedRoutes || []);
      })
      .catch((error) => {
        if (error.name === "AbortError") return;
        setRemoteRoute(null);
        setRemoteRelatedRoutes([]);
        setRouteNotFound(error.status === 404);
        console.error("Load SEO route failed:", error);
      })
      .finally(() => {
        if (!controller.signal.aborted) setRouteLoading(false);
      });

    return () => controller.abort();
  }, [requestedPath]);

  /*
   * Chuyển khách sang trang đặt xe và yêu cầu trang /dat-xe
   * tự cuộn tới, sau đó focus vào ô Điểm đón.
   */
  const goToBookingPage = () => {
    navigate("/dat-xe", {
      state: {
        focusField: "pickup",
        source: "seo-route",
        routeFrom: route?.from,
        routeTo: route?.to,
      },
    });
  };

  /*
   * Style dùng chung cho 2 ô nhập giả.
   * Hai ô này chỉ đóng vai trò CTA, khách bấm vào sẽ sang trang /dat-xe.
   */
  const fakeInputSx = {
    flex: 1,
    minWidth: {
      xs: "100%",
      md: 220,
    },

    "& .MuiOutlinedInput-root": {
      height: 54,
      borderRadius: 2.5,
      bgcolor: "#ffffff",
      cursor: "pointer",
      transition: "transform 160ms ease, box-shadow 160ms ease",

      "& fieldset": {
        borderColor: "#fed7aa",
      },

      "&:hover": {
        transform: "translateY(-1px)",
        boxShadow: "0 8px 22px rgba(15,23,42,0.10)",
      },

      "&:hover fieldset": {
        borderColor: "#f97316",
      },

      "&.Mui-focused fieldset": {
        borderColor: "#f97316",
        borderWidth: 2,
      },
    },

    "& .MuiInputBase-input": {
      cursor: "pointer",
      fontWeight: 700,
      fontSize: 15,
    },

    "& .MuiInputBase-input::placeholder": {
      color: "#64748b",
      opacity: 1,
      fontWeight: 600,
    },
  };

  useEffect(() => {
    async function loadConfig() {
      try {
        const cfg = await getPublicSystemConfig();
        const phone = cfg?.supportPhoneRider || "0326184628";
        setZaloPhone(String(phone).replace(/\D/g, ""));
      } catch (err) {
        console.error("Load SEO route system config failed:", err);
      }
    }

    loadConfig();
  }, []);

  useEffect(() => {
    if (!route) return;

    document.title = `${route.title} | GoViet247`;

    let canonical = document.querySelector('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.rel = "canonical";
      document.head.appendChild(canonical);
    }
    canonical.href = `https://goviet247.com/${encodeURI(route.path)}`;

    let robots = document.querySelector('meta[name="robots"]');
    if (!robots) {
      robots = document.createElement("meta");
      robots.name = "robots";
      document.head.appendChild(robots);
    }
    robots.content = route.indexable ? "index,follow" : "noindex,follow";

    const description = route.description;
    let meta = document.querySelector('meta[name="description"]');

    if (!meta) {
      meta = document.createElement("meta");
      meta.setAttribute("name", "description");
      document.head.appendChild(meta);
    }

    meta.setAttribute("content", description);

    return () => {
      if (canonical.isConnected) canonical.remove();
      if (robots.isConnected) robots.remove();
    };
  }, [route]);

  if (routeLoading) {
    return <main style={styles.page}>Đang tải thông tin tuyến xe...</main>;
  }

  if (!route || routeNotFound) {
    return <main style={styles.page}>Không tìm thấy tuyến xe.</main>;
  }

  const provinceHubLinks = getProvinceHubLinks(route);
  const smartHubLinks = getSmartHubLinks(route);

  const relatedRoutes = remoteRelatedRoutes
    .filter((item) => item.key !== route.key)
    .filter((item) => item.path !== route.path)
    .filter((item) => {
      const sameFrom = item.from === route.from;
      const sameTo = item.to === route.to;

      const reverseRoute = item.from === route.to && item.to === route.from;

      const sameArea =
        item.from === route.from ||
        item.to === route.from ||
        item.from === route.to ||
        item.to === route.to;

      const isUsefulRoute =
        !["các tỉnh", "theo nhu cầu"].includes(
          String(item.to || "").toLowerCase(),
        ) &&
        !["các tỉnh", "theo nhu cầu"].includes(
          String(item.from || "").toLowerCase(),
        );

      return isUsefulRoute && (sameFrom || sameTo || reverseRoute || sameArea);
    })
    .filter((item, index, arr) => {
      return arr.findIndex((x) => x.path === item.path) === index;
    })
    .slice(0, 12);

  return (
    <main style={styles.page}>
      {/* ===================================================== */}
      {/* BREADCRUMB */}
      {/* ===================================================== */}

      <nav style={styles.breadcrumb} aria-label="Breadcrumb">
        <Link to="/" style={styles.breadcrumbLink}>
          Trang chủ
        </Link>

        <span style={styles.breadcrumbSeparator}>›</span>

        <Link to="/xe-lien-tinh" style={styles.breadcrumbLink}>
          Xe liên tỉnh
        </Link>

        <span style={styles.breadcrumbSeparator}>›</span>

        <span style={styles.breadcrumbCurrent}>
          {route.from} → {route.to}
        </span>
      </nav>

      {/* ===================================================== */}
      {/* SEO HUB description */}
      {/* ===================================================== */}

      <section style={styles.hero}>
        <p style={styles.badge}>GoViet247 • Xe riêng đi tỉnh</p>

        <h1 style={styles.title}>{route.title}</h1>

        <p style={styles.description}>{route.description}</p>

        <p style={styles.description}>
          Hành trình tham khảo từ <strong>{route.from}</strong> đến{" "}
          <strong>{route.to}</strong>. Để xem giá cho chuyến đi của bạn, hãy chọn
          địa chỉ đón và trả cụ thể, thời gian khởi hành cùng loại xe. Hệ thống
          tính giá theo thông tin bạn nhập trước khi xác nhận đặt chuyến.
        </p>

        {/* ===================================================== */}
        {/* KHỐI NHẬP HÀNH TRÌNH */}
        {/* ===================================================== */}

        <Box sx={styles.routeSearchBox}>
          <Typography sx={styles.routeSearchTitle}>Bạn muốn đi đâu?</Typography>

          <Stack
            direction={{
              xs: "column",
              md: "row",
            }}
            spacing={1.2}
            sx={{
              width: "100%",
            }}
          >
            <TextField
              fullWidth
              placeholder={`Chọn địa chỉ đón tại ${route.from}`}
              value=""
              onClick={goToBookingPage}
              onFocus={goToBookingPage}
              slotProps={{
                input: {
                  readOnly: true,
                  startAdornment: (
                    <InputAdornment position="start">
                      <LocationOnOutlinedIcon sx={{ color: "#1976d2" }} />
                    </InputAdornment>
                  ),
                },
                htmlInput: {
                  "aria-label": "Nhập điểm đón",
                },
              }}
              sx={fakeInputSx}
            />

            <TextField
              fullWidth
              placeholder={`Chọn địa chỉ trả tại ${route.to}`}
              value=""
              onClick={goToBookingPage}
              onFocus={goToBookingPage}
              slotProps={{
                input: {
                  readOnly: true,
                  startAdornment: (
                    <InputAdornment position="start">
                      <FlagOutlinedIcon sx={{ color: "#f97316" }} />
                    </InputAdornment>
                  ),
                },
                htmlInput: {
                  "aria-label": "Nhập điểm đến",
                },
              }}
              sx={fakeInputSx}
            />

            <Button
              variant="contained"
              size="large"
              endIcon={<ArrowForwardRoundedIcon />}
              onClick={goToBookingPage}
              sx={styles.routeSearchButton}
            >
              Xem giá chuyến đi
            </Button>
          </Stack>

          <Typography sx={styles.routeSearchNote}>
            Nhập hành trình để xem quãng đường và nhận báo giá trước khi đặt xe.
          </Typography>
        </Box>

        <div style={styles.actions}>
          <a
            href={`https://zalo.me/${zaloPhone}`}
            target="_blank"
            rel="noopener noreferrer"
            style={styles.secondaryButton}
          >
            Nhắn Zalo hỗ trợ
          </a>
        </div>
        <div style={styles.downloadAppBox}>
          <p style={styles.downloadTitle}>📱 Tải ứng dụng GoViet247</p>

          <div style={styles.downloadButtons}>
            <a
              href={appStoreUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={styles.downloadButton}
            >
               App Store
            </a>

            <a
              href={playStoreUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={styles.downloadButton}
            >
              🤖 Google Play
            </a>
          </div>
        </div>
      </section>

      <section style={styles.card}>
        <h2 style={styles.sectionTitle}>
          Xem giá xe {route.from} đi {route.to}
        </h2>
        <p style={styles.note}>
          Trang này không có một mức giá cố định cho cả tuyến. Giá thực tế cần
          địa chỉ đón trả cụ thể, thời gian đi, loại xe, số điểm dừng và lựa chọn
          một chiều hoặc khứ hồi. Nhập các thông tin đó để xem giá trước khi
          quyết định đặt chuyến.
        </p>
      </section>
      <section style={styles.card}>
        <h2 style={styles.sectionTitle}>
          Thông tin tuyến {route.from} → {route.to}
        </h2>

        <p style={styles.text}>
          <strong>Lộ trình tham khảo:</strong> {route.routeText}.
        </p>

        <p style={styles.text}>
          <strong>Thời gian tham khảo:</strong> {route.duration}. Thời gian và
          đường đi thực tế phụ thuộc địa chỉ đón trả, thời điểm và tình trạng
          giao thông.
        </p>
      </section>
      <section style={styles.card}>
        <h2 style={styles.sectionTitle}>Chuẩn bị thông tin trước khi xem giá</h2>
        <ul style={styles.list}>
          <li>Chọn địa chỉ đón cụ thể, không chỉ tên tỉnh hoặc khu vực.</li>
          <li>Chọn địa chỉ trả cụ thể; thêm điểm dừng nếu cần.</li>
          <li>Chọn ngày giờ, loại xe và một chiều hoặc khứ hồi.</li>
          <li>Kiểm tra quãng đường và giá hệ thống tính trước khi xác nhận.</li>
        </ul>
      </section>

      {/* ===================================================== */}
      {/* SEO HUB NAVIGATION */}
      {/* ===================================================== */}

      <nav style={styles.hubNavigation} aria-label="Danh mục xe đi tỉnh">
        {SEO_HUB_LINKS.map((item) => (
          <Link key={item.path} to={item.path} style={styles.hubNavigationLink}>
            {item.label}
          </Link>
        ))}
      </nav>

      {provinceHubLinks.length > 0 && (
        <section style={styles.provinceHubSection}>
          <div style={styles.provinceHubHeader}>
            <div>
              <p style={styles.provinceHubBadge}>Khám phá theo điểm đến</p>

              <h2 style={styles.provinceHubTitle}>
                Xem thêm các tuyến xe cùng khu vực
              </h2>
            </div>
          </div>

          <div style={styles.provinceHubLinks}>
            {provinceHubLinks.map((hub) => (
              <Link key={hub.path} to={hub.path} style={styles.provinceHubLink}>
                Xe đi {hub.label}
                <span style={styles.provinceHubArrow}>→</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {smartHubLinks.length > 0 && (
        <section style={styles.smartHubSection}>
          <div style={styles.smartHubHeader}>
            <div>
              <p style={styles.smartHubBadge}>Gợi ý theo hành trình</p>

              <h2 style={styles.smartHubTitle}>
                Dịch vụ phù hợp với tuyến này
              </h2>
            </div>
          </div>

          <div style={styles.smartHubLinks}>
            {smartHubLinks.map((hub) => (
              <Link key={hub.key} to={hub.path} style={styles.smartHubLink}>
                <span>{hub.label}</span>
                <span style={styles.smartHubArrow}>→</span>
              </Link>
            ))}
          </div>
        </section>
      )}
      {/* ----------------------------- */}

      {relatedRoutes.length > 0 && (
        <section style={styles.popularRoutes}>
          <h2 style={styles.sectionTitle}>Tuyến liên quan</h2>

          <div style={styles.routeLinks}>
            {relatedRoutes.map((item) => (
              <Link
                key={item.key}
                to={`/${item.path}`}
                style={styles.routeLink}
              >
                {item.from} → {item.to}
              </Link>
            ))}
          </div>
        </section>
      )}

      <section style={styles.cta}>
        Đặt xe {route.from} → {route.to} ngay hôm nay
        <p>
          Nhập thông tin chuyến đi để nhận giá nhanh và đặt xe riêng cùng
          GoViet247.
        </p>
        <Link
          to="/dat-xe"
          state={{
            focusField: "pickup",
            source: "seo-route",
            routeFrom: route.from,
            routeTo: route.to,
          }}
          style={styles.ctaButton}
        >
          Nhập địa chỉ để xem giá
        </Link>
      </section>
    </main>
  );
}

const styles = {
  page: {
    maxWidth: 1080,
    margin: "0 auto",
    padding: "32px 16px 56px",
    color: "#172033",
  },
  breadcrumb: {
    display: "flex",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 14,
    color: "#64748b",
    fontSize: 14,
  },

  breadcrumbLink: {
    color: "#c2410c",
    textDecoration: "none",
    fontWeight: 700,
  },

  breadcrumbSeparator: {
    color: "#94a3b8",
  },

  breadcrumbCurrent: {
    color: "#475569",
    fontWeight: 700,
  },

  hubNavigation: {
    display: "flex",
    flexWrap: "wrap",
    gap: 9,
    padding: 14,
    marginBottom: 18,
    borderRadius: 18,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
  },

  hubNavigationLink: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "9px 13px",
    borderRadius: 999,
    background: "#fff7ed",
    color: "#c2410c",
    border: "1px solid #fed7aa",
    textDecoration: "none",
    fontSize: 14,
    fontWeight: 800,
  },
  hero: {
    background: "linear-gradient(135deg, #fff7ed, #ffffff)",
    border: "1px solid #fed7aa",
    borderRadius: 24,
    padding: 28,
    marginBottom: 20,
  },
  badge: {
    display: "inline-block",
    margin: "0 0 12px",
    padding: "6px 12px",
    borderRadius: 999,
    background: "#ffedd5",
    color: "#c2410c",
    fontWeight: 700,
    fontSize: 14,
  },
  title: {
    margin: "0 0 16px",
    fontSize: "clamp(30px, 5vw, 48px)",
    lineHeight: 1.12,
    fontWeight: 800,
  },
  description: {
    margin: "0 0 12px",
    fontSize: 17,
    lineHeight: 1.7,
    color: "#475569",
  },
  routeSearchBox: {
    mt: 3,
    p: {
      xs: 1.5,
      sm: 2,
    },
    borderRadius: 3,
    background: "rgba(255,255,255,0.82)",
    border: "1px solid #fed7aa",
    boxShadow: "0 12px 30px rgba(15,23,42,0.08)",
  },

  routeSearchTitle: {
    mb: 1.3,
    fontSize: {
      xs: 17,
      sm: 19,
    },
    fontWeight: 900,
    color: "#172033",
  },

  routeSearchButton: {
    minWidth: {
      xs: "100%",
      md: 190,
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
    color: "#ffffff",
    boxShadow: "0 10px 24px rgba(249,115,22,0.24)",

    "&:hover": {
      bgcolor: "#ea580c",
      boxShadow: "0 12px 28px rgba(249,115,22,0.34)",
      transform: "translateY(-1px)",
    },
  },

  routeSearchNote: {
    mt: 1.1,
    fontSize: {
      xs: 12,
      sm: 13,
    },
    fontWeight: 600,
    color: "#64748b",
  },

  actions: {
    display: "flex",
    flexWrap: "wrap",
    gap: 12,
    marginTop: 22,
  },
  primaryButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "12px 18px",
    borderRadius: 999,
    background: "#f97316",
    color: "#ffffff",
    textDecoration: "none",
    fontWeight: 800,
  },
  secondaryButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "12px 18px",
    borderRadius: 999,
    background: "#ffffff",
    color: "#ea580c",
    textDecoration: "none",
    fontWeight: 800,
    border: "1px solid #fdba74",
  },
  provinceHubSection: {
    padding: 18,
    marginBottom: 18,
    borderRadius: 20,
    background: "linear-gradient(135deg, #fff7ed, #ffffff)",
    border: "1px solid #fed7aa",
  },

  smartHubSection: {
    padding: 18,
    marginBottom: 18,
    borderRadius: 20,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    boxShadow: "0 8px 24px rgba(15, 23, 42, 0.04)",
  },

  smartHubHeader: {
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 14,
  },

  smartHubBadge: {
    margin: "0 0 5px",
    color: "#ea580c",
    fontSize: 13,
    fontWeight: 800,
  },

  smartHubTitle: {
    margin: 0,
    color: "#172033",
    fontSize: 20,
    lineHeight: 1.35,
    fontWeight: 900,
  },

  smartHubLinks: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
    gap: 10,
  },

  smartHubLink: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    padding: "12px 14px",
    borderRadius: 14,
    background: "#f8fafc",
    color: "#334155",
    border: "1px solid #e2e8f0",
    textDecoration: "none",
    fontWeight: 800,
  },

  smartHubArrow: {
    color: "#ea580c",
    fontSize: 17,
    lineHeight: 1,
  },

  provinceHubHeader: {
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 14,
  },

  provinceHubBadge: {
    margin: "0 0 5px",
    color: "#ea580c",
    fontSize: 13,
    fontWeight: 800,
  },

  provinceHubTitle: {
    margin: 0,
    color: "#172033",
    fontSize: 20,
    lineHeight: 1.35,
    fontWeight: 900,
  },

  provinceHubLinks: {
    display: "flex",
    flexWrap: "wrap",
    gap: 10,
  },

  provinceHubLink: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    minWidth: 170,
    padding: "11px 14px",
    borderRadius: 14,
    background: "#ffffff",
    color: "#c2410c",
    border: "1px solid #fdba74",
    textDecoration: "none",
    fontWeight: 800,
  },

  provinceHubArrow: {
    fontSize: 17,
    lineHeight: 1,
  },
  card: {
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: 20,
    padding: 22,
    marginBottom: 18,
    boxShadow: "0 10px 30px rgba(15, 23, 42, 0.06)",
  },
  sectionTitle: {
    margin: "0 0 14px",
    fontSize: 24,
    fontWeight: 800,
  },
  note: {
    margin: 0,
    lineHeight: 1.7,
    color: "#475569",
  },
  list: {
    margin: 0,
    paddingLeft: 22,
    lineHeight: 1.9,
    color: "#475569",
    fontSize: 16,
  },
  text: {
    margin: "0 0 10px",
    lineHeight: 1.8,
    color: "#475569",
    fontSize: 16,
  },
  popularRoutes: {
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: 20,
    padding: 22,
    marginBottom: 18,
  },
  routeLinks: {
    display: "flex",
    flexWrap: "wrap",
    gap: 10,
  },
  routeLink: {
    padding: "9px 12px",
    borderRadius: 999,
    background: "#fff7ed",
    color: "#c2410c",
    border: "1px solid #fed7aa",
    textDecoration: "none",
    fontWeight: 700,
  },
  cta: {
    textAlign: "center",
    background: "#172033",
    color: "#ffffff",
    borderRadius: 24,
    padding: 28,
  },
  ctaButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
    padding: "12px 18px",
    borderRadius: 999,
    background: "#f97316",
    color: "#ffffff",
    textDecoration: "none",
    fontWeight: 800,
  },
  downloadAppBox: {
    marginTop: 18,
  },
  downloadTitle: {
    margin: "0 0 10px",
    fontWeight: 800,
    fontSize: 14,
    color: "#475569",
  },
  downloadButtons: {
    display: "flex",
    flexWrap: "wrap",
    gap: 10,
  },
  downloadButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "10px 16px",
    borderRadius: 999,
    background: "#172033",
    color: "#ffffff",
    textDecoration: "none",
    fontWeight: 800,
  },
};
