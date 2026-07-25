// Path: goviet247/apps/web/src/pages/customer/SeoRoutePage.jsx
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
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
import { SEO_ROUTES } from "../../data/seoRoutes";
import { getPublicSystemConfig } from "../../api/systemConfig";

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
  const [zaloPhone, setZaloPhone] = useState("0326184628");
  const appStoreUrl = "https://apps.apple.com/vn/app/goviet247/id6767422059";
  const playStoreUrl =
    "https://play.google.com/store/apps/details?id=com.goviet247.rider";

  const route = useMemo(
    () => SEO_ROUTES.find((item) => item.key === routeKey),
    [routeKey],
  );

  /*
   * Chuyển khách sang trang đặt xe và yêu cầu trang /dat-xe
   * tự cuộn tới, sau đó focus vào ô Điểm đón.
   */
  const goToBookingPage = () => {
    navigate("/dat-xe", {
      state: {
        focusField: "pickup",
        source: "seo-route",
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

    const description = route.description;
    let meta = document.querySelector('meta[name="description"]');

    if (!meta) {
      meta = document.createElement("meta");
      meta.setAttribute("name", "description");
      document.head.appendChild(meta);
    }

    meta.setAttribute("content", description);

    const oldSchema = document.getElementById("seo-route-faq-schema");
    if (oldSchema) oldSchema.remove();

    const schema = {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: [
        {
          "@type": "Question",
          name: "Giá xe có hiển thị trước khi đặt không?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Có. Bạn nhập điểm đón, điểm đến, loại xe và thời gian khởi hành để xem giá trước khi xác nhận đặt chuyến.",
          },
        },
        {
          "@type": "Question",
          name: "Có thể đặt xe một chiều hoặc khứ hồi không?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Có. GoViet247 hỗ trợ đặt xe một chiều hoặc khứ hồi tùy nhu cầu.",
          },
        },
        {
          "@type": "Question",
          name: "GoViet247 có hỗ trợ xe liên tỉnh không?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Có. GoViet247 hỗ trợ xe từ TP.HCM đi tỉnh, từ tỉnh về TP.HCM và các tuyến liên tỉnh theo nhu cầu.",
          },
        },
      ],
    };

    const script = document.createElement("script");
    script.id = "seo-route-faq-schema";
    script.type = "application/ld+json";
    script.textContent = JSON.stringify(schema);
    document.head.appendChild(script);

    return () => {
      const currentSchema = document.getElementById("seo-route-faq-schema");
      if (currentSchema) currentSchema.remove();
    };
  }, [route]);

  if (!route) {
    return <main style={styles.page}>Không tìm thấy tuyến xe.</main>;
  }

  const provinceHubLinks = getProvinceHubLinks(route);
  const smartHubLinks = getSmartHubLinks(route);

  const relatedRoutes = SEO_ROUTES.filter((item) => item.key !== route.key)
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
          GoViet247 hỗ trợ đặt xe riêng không ghép khách, bao gồm:
          {` `}
          <strong>
            {route.from} đi {route.to}
          </strong>
          ,{` `}
          chiều ngược lại{" "}
          <strong>
            {route.to} về {route.from}
          </strong>
          , và cả các tuyến liên tỉnh như Đà Lạt đi Phan Thiết, Vũng Tàu đi Cần
          Thơ…
        </p>

        <p style={styles.description}>
          Ngoài các tuyến phổ biến, GoViet247 còn hỗ trợ đặt xe từ TP.HCM đi các
          tỉnh, từ các tỉnh về TP.HCM và các tuyến tỉnh đi tỉnh theo nhu cầu.
          Tùy khu vực và thời điểm, hệ thống sẽ kiểm tra tài xế phù hợp để xác
          nhận chuyến.
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
              placeholder="Nhập điểm đón"
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
              placeholder="Nhập điểm đến"
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
          Giá thuê xe {route.from} đi {route.to} được tính như thế nào?
        </h2>

        <div style={styles.priceGrid}>
          <div style={styles.priceBox}>
            <strong>Xe 5 chỗ</strong>
            <span>Phù hợp cá nhân, cặp đôi, gia đình nhỏ</span>
          </div>

          <div style={styles.priceBox}>
            <strong>Xe 7 chỗ</strong>
            <span>Phù hợp gia đình, nhóm bạn, hành lý nhiều</span>
          </div>

          <div style={styles.priceBox}>
            <strong>Xe 16 chỗ</strong>
            <span>Phù hợp nhóm đông, công ty, du lịch</span>
          </div>
        </div>

        <p style={styles.note}>
          Giá được tính theo điểm đón, điểm đến, loại xe và thời gian di chuyển.
          Bạn có thể nhập điểm đón và điểm đến phía trên để xem quãng đường,
          nhận báo giá và đặt xe. Giá rõ ràng, trọn gói theo chuyến và không
          phát sinh thêm.
        </p>
      </section>
      <section style={styles.card}>
        <h2 style={styles.sectionTitle}>Tại sao nên chọn GoViet247?</h2>

        <ul style={styles.list}>
          <li>Xe riêng, không ghép khách</li>
          <li>Đón tận nơi tại TP.HCM và khu vực hỗ trợ</li>
          <li>Tính giá trước khi đặt, dễ kiểm tra chi phí</li>
          <li>Hỗ trợ xe 5 chỗ, 7 chỗ và 16 chỗ</li>
          <li>Phù hợp du lịch, công tác, gia đình và đi tỉnh đường dài</li>
          <li>Hỗ trợ nhanh qua hotline hoặc Zalo</li>
        </ul>
      </section>
      <section style={styles.card}>
        <h2 style={styles.sectionTitle}>
          Lộ trình {route.from} đi {route.to}
        </h2>

        <p style={styles.text}>
          Lộ trình tham khảo: <strong>{route.routeText}</strong>.
        </p>

        <p style={styles.text}>
          Thời gian di chuyển thường {route.duration}. Thời gian thực tế có thể
          thay đổi theo thời điểm khởi hành, tình trạng giao thông và điểm đón
          cụ thể.
        </p>
      </section>
      <section style={styles.card}>
        <h2 style={styles.sectionTitle}>Câu hỏi thường gặp</h2>

        <div style={styles.faqItem}>
          <h3>Giá xe có hiển thị trước khi đặt không?</h3>
          <p>
            Có. Bạn nhập điểm đón, điểm đến, loại xe và thời gian khởi hành để
            xem giá trước khi xác nhận đặt chuyến.
          </p>
        </div>

        <div style={styles.faqItem}>
          <h3>Có thể đặt xe một chiều hoặc khứ hồi không?</h3>
          <p>Có. GoViet247 hỗ trợ đặt xe một chiều hoặc khứ hồi tùy nhu cầu.</p>
        </div>

        <div style={styles.faqItem}>
          <h3>Có xe 5 chỗ, 7 chỗ và 16 chỗ không?</h3>
          <p>Có. Bạn có thể chọn loại xe phù hợp khi tính giá và đặt chuyến.</p>
        </div>

        <div style={styles.faqItem}>
          <h3>Có nên đặt xe trước không?</h3>
          <p>
            Nên đặt trước để GoViet247 sắp xếp tài xế và loại xe phù hợp cho
            chuyến đi.
          </p>
        </div>
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
        <Link to="/dat-xe" style={styles.ctaButton}>
          Tính giá & đặt chuyến
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
  priceGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: 12,
    marginBottom: 14,
  },
  priceBox: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
    padding: 16,
    borderRadius: 16,
    background: "#fff7ed",
    border: "1px solid #fed7aa",
    fontSize: 16,
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
  faqItem: {
    borderTop: "1px solid #e2e8f0",
    paddingTop: 14,
    marginTop: 14,
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
