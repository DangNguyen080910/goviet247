// Path: goviet247/apps/web/src/pages/customer/SeoProvinceHubPage.jsx

import { useEffect, useMemo } from "react";
import { Link, useLocation } from "react-router-dom";
import { SEO_ROUTES } from "../../data/seoRoutes";

/*
 * Hub SEO theo từng tỉnh hoặc điểm đến.
 *
 * Ví dụ:
 * /vung-tau        → toàn bộ tuyến liên quan Vũng Tàu
 * /da-lat          → toàn bộ tuyến liên quan Đà Lạt
 * /nha-trang       → toàn bộ tuyến liên quan Nha Trang
 *
 * Component nhận provinceKey từ Router:
 *
 * <SeoProvinceHubPage provinceKey="vung-tau" />
 */

const ROUTES_PER_PAGE = 120;

/*
 * Những route tổng quát không phải tuyến xe cụ thể.
 * Không đưa chúng vào danh sách của Hub tỉnh.
 */
const GENERIC_ROUTE_KEYS = new Set([
  "xe-lien-tinh",
  "xe-tu-tp-hcm-di-cac-tinh",
  "xe-tu-cac-tinh-ve-tp-hcm",
  "thue-xe-di-tinh",
  "xe-di-tinh",
  "taxi-di-tinh",
  "taxi-duong-dai",
  "xe-rieng-di-tinh",
  "xe-tien-chuyen",
  "xe-rieng-gia-tien-chuyen",
  "xe-ve-que",
]);

/*
 * Cấu hình các Hub tỉnh và điểm đến.
 *
 * aliases:
 * Những tên có thể xuất hiện trong route.from, route.to,
 * title, description, path hoặc routeText.
 */
const PROVINCE_HUB_CONFIGS = {
  "vung-tau": {
    path: "/vung-tau",
    name: "Vũng Tàu",
    badge: "GoViet247 • Xe đi Vũng Tàu",
    title: "Xe đi Vũng Tàu, xe riêng đưa đón tận nơi",
    description:
      "Tổng hợp các tuyến xe đi Vũng Tàu và từ Vũng Tàu đi các khu vực khác. GoViet247 hỗ trợ xe riêng không ghép khách, biết giá trước khi đặt và đưa đón tận nơi.",
    heading: "Danh sách tuyến xe liên quan Vũng Tàu",
    aliases: ["vũng tàu", "vung tau", "bà rịa - vũng tàu", "ba ria vung tau"],
  },

  "ho-tram": {
    path: "/ho-tram",
    name: "Hồ Tràm",
    badge: "GoViet247 • Xe đi Hồ Tràm",
    title: "Xe đi Hồ Tràm, đưa đón resort tận nơi",
    description:
      "Tổng hợp các tuyến xe đi Hồ Tràm và từ Hồ Tràm đi các khu vực khác. Phù hợp khách nghỉ dưỡng, đi resort, du lịch gia đình hoặc công tác.",
    heading: "Danh sách tuyến xe liên quan Hồ Tràm",
    aliases: ["hồ tràm", "ho tram"],
  },

  "long-hai": {
    path: "/long-hai",
    name: "Long Hải",
    badge: "GoViet247 • Xe đi Long Hải",
    title: "Xe đi Long Hải, xe riêng giá rõ ràng",
    description:
      "Tổng hợp các tuyến xe đi Long Hải và từ Long Hải đi các khu vực khác. Hỗ trợ xe 5 chỗ, 7 chỗ và 16 chỗ, đón trả tận nơi.",
    heading: "Danh sách tuyến xe liên quan Long Hải",
    aliases: ["long hải", "long hai"],
  },

  "binh-chau": {
    path: "/binh-chau",
    name: "Bình Châu",
    badge: "GoViet247 • Xe đi Bình Châu",
    title: "Xe đi Bình Châu, xe riêng đưa đón tận nơi",
    description:
      "Tổng hợp các tuyến xe đi Bình Châu, suối khoáng nóng Bình Châu và các khu nghỉ dưỡng lân cận. Biết giá trước khi đặt, không cần đặt cọc.",
    heading: "Danh sách tuyến xe liên quan Bình Châu",
    aliases: ["bình châu", "binh chau"],
  },

  "phan-thiet": {
    path: "/phan-thiet",
    name: "Phan Thiết",
    badge: "GoViet247 • Xe đi Phan Thiết",
    title: "Xe đi Phan Thiết, xe riêng đường dài",
    description:
      "Tổng hợp các tuyến xe đi Phan Thiết và từ Phan Thiết đi các tỉnh, thành phố khác. Hỗ trợ đi du lịch, công tác, thăm người thân và nghỉ dưỡng.",
    heading: "Danh sách tuyến xe liên quan Phan Thiết",
    aliases: ["phan thiết", "phan thiet"],
  },

  "mui-ne": {
    path: "/mui-ne",
    name: "Mũi Né",
    badge: "GoViet247 • Xe đi Mũi Né",
    title: "Xe đi Mũi Né, đưa đón khách sạn và resort",
    description:
      "Tổng hợp các tuyến xe đi Mũi Né và từ Mũi Né đi các khu vực khác. Xe riêng không ghép khách, hỗ trợ đón trả tận khách sạn và resort.",
    heading: "Danh sách tuyến xe liên quan Mũi Né",
    aliases: ["mũi né", "mui ne"],
  },

  "da-lat": {
    path: "/da-lat",
    name: "Đà Lạt",
    badge: "GoViet247 • Xe đi Đà Lạt",
    title: "Xe đi Đà Lạt, xe riêng 5 chỗ, 7 chỗ, 16 chỗ",
    description:
      "Tổng hợp các tuyến xe đi Đà Lạt và từ Đà Lạt đi các khu vực khác. Phù hợp du lịch, công tác, gia đình và nhóm bạn.",
    heading: "Danh sách tuyến xe liên quan Đà Lạt",
    aliases: ["đà lạt", "da lat"],
  },

  "nha-trang": {
    path: "/nha-trang",
    name: "Nha Trang",
    badge: "GoViet247 • Xe đi Nha Trang",
    title: "Xe đi Nha Trang, xe riêng đưa đón tận nơi",
    description:
      "Tổng hợp các tuyến xe đi Nha Trang và từ Nha Trang đi các tỉnh, thành phố khác. Hỗ trợ đưa đón khách sạn, resort và sân bay.",
    heading: "Danh sách tuyến xe liên quan Nha Trang",
    aliases: ["nha trang"],
  },

  "tay-ninh": {
    path: "/tay-ninh",
    name: "Tây Ninh",
    badge: "GoViet247 • Xe đi Tây Ninh",
    title: "Xe đi Tây Ninh, xe riêng giá rõ ràng",
    description:
      "Tổng hợp các tuyến xe đi Tây Ninh, núi Bà Đen, Tòa Thánh Tây Ninh và các khu vực lân cận. Đón tận nơi, hoạt động 24/7.",
    heading: "Danh sách tuyến xe liên quan Tây Ninh",
    aliases: ["tây ninh", "tay ninh"],
  },

  "can-tho": {
    path: "/can-tho",
    name: "Cần Thơ",
    badge: "GoViet247 • Xe đi Cần Thơ",
    title: "Xe đi Cần Thơ, xe riêng về miền Tây",
    description:
      "Tổng hợp các tuyến xe đi Cần Thơ và từ Cần Thơ đi các tỉnh, thành phố khác. Hỗ trợ du lịch, công tác, về quê và đưa đón tận nơi.",
    heading: "Danh sách tuyến xe liên quan Cần Thơ",
    aliases: ["cần thơ", "can tho"],
  },

  "ben-tre": {
    path: "/ben-tre",
    name: "Bến Tre",
    badge: "GoViet247 • Xe đi Bến Tre",
    title: "Xe đi Bến Tre, xe riêng đưa đón tận nơi",
    description:
      "Tổng hợp các tuyến xe đi Bến Tre và từ Bến Tre đi các khu vực khác. Xe riêng không ghép khách, phù hợp về quê, công tác và du lịch.",
    heading: "Danh sách tuyến xe liên quan Bến Tre",
    aliases: ["bến tre", "ben tre"],
  },

  "long-an": {
    path: "/long-an",
    name: "Long An",
    badge: "GoViet247 • Xe đi Long An",
    title: "Xe đi Long An, đón trả tận nơi",
    description:
      "Tổng hợp các tuyến xe đi Long An và từ Long An đi các tỉnh, thành phố khác. Hỗ trợ xe riêng đi công tác, về quê và đưa đón khu công nghiệp.",
    heading: "Danh sách tuyến xe liên quan Long An",
    aliases: ["long an"],
  },

  "tien-giang": {
    path: "/tien-giang",
    name: "Tiền Giang",
    badge: "GoViet247 • Xe đi Tiền Giang",
    title: "Xe đi Tiền Giang, xe riêng về miền Tây",
    description:
      "Tổng hợp các tuyến xe đi Tiền Giang, Mỹ Tho, Gò Công, Cai Lậy và các khu vực lân cận. Giá rõ ràng và đưa đón tận nơi.",
    heading: "Danh sách tuyến xe liên quan Tiền Giang",
    aliases: ["tiền giang", "tien giang"],
  },

  "vinh-long": {
    path: "/vinh-long",
    name: "Vĩnh Long",
    badge: "GoViet247 • Xe đi Vĩnh Long",
    title: "Xe đi Vĩnh Long, xe riêng đưa đón tận nơi",
    description:
      "Tổng hợp các tuyến xe đi Vĩnh Long và từ Vĩnh Long đi các tỉnh, thành phố khác. Phù hợp đi công tác, du lịch, thăm người thân và về quê.",
    heading: "Danh sách tuyến xe liên quan Vĩnh Long",
    aliases: ["vĩnh long", "vinh long"],
  },

  "dong-thap": {
    path: "/dong-thap",
    name: "Đồng Tháp",
    badge: "GoViet247 • Xe đi Đồng Tháp",
    title: "Xe đi Đồng Tháp, xe riêng về Cao Lãnh và Sa Đéc",
    description:
      "Tổng hợp các tuyến xe đi Đồng Tháp, Cao Lãnh, Sa Đéc và các khu vực lân cận. Xe riêng không ghép khách, đưa đón tận nơi.",
    heading: "Danh sách tuyến xe liên quan Đồng Tháp",
    aliases: ["đồng tháp", "dong thap"],
  },

  "an-giang": {
    path: "/an-giang",
    name: "An Giang",
    badge: "GoViet247 • Xe đi An Giang",
    title: "Xe đi An Giang, xe riêng về Long Xuyên và Châu Đốc",
    description:
      "Tổng hợp các tuyến xe đi An Giang, Long Xuyên, Châu Đốc và các khu vực lân cận. Hỗ trợ du lịch, hành hương, công tác và về quê.",
    heading: "Danh sách tuyến xe liên quan An Giang",
    aliases: ["an giang"],
  },

  "kien-giang": {
    path: "/kien-giang",
    name: "Kiên Giang",
    badge: "GoViet247 • Xe đi Kiên Giang",
    title: "Xe đi Kiên Giang, xe riêng về Rạch Giá và Hà Tiên",
    description:
      "Tổng hợp các tuyến xe đi Kiên Giang, Rạch Giá, Hà Tiên và các khu vực đất liền. Xe riêng không ghép khách, biết giá trước khi đặt.",
    heading: "Danh sách tuyến xe liên quan Kiên Giang",
    aliases: ["kiên giang", "kien giang"],
  },
};

function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .trim()
    .toLowerCase()
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ");
}

function getSearchableText(route) {
  return normalizeText(
    [
      route?.key,
      route?.path,
      route?.from,
      route?.to,
      route?.title,
      route?.description,
      route?.routeText,
    ]
      .filter(Boolean)
      .join(" "),
  );
}

function isUsefulRoute(route) {
  if (!route?.key || !route?.path) return false;

  if (GENERIC_ROUTE_KEYS.has(route.key)) return false;

  const from = normalizeText(route.from);
  const to = normalizeText(route.to);

  const genericLocations = new Set([
    "",
    "cac tinh",
    "theo nhu cau",
    "lien tinh",
  ]);

  if (genericLocations.has(from)) return false;
  if (genericLocations.has(to)) return false;

  return true;
}

function routeMatchesProvince(route, aliases) {
  const searchableText = getSearchableText(route);

  return aliases.some((alias) => {
    const normalizedAlias = normalizeText(alias);
    return searchableText.includes(normalizedAlias);
  });
}

function removeDuplicatePaths(routes) {
  const seenPaths = new Set();

  return routes.filter((route) => {
    if (!route?.path || seenPaths.has(route.path)) {
      return false;
    }

    seenPaths.add(route.path);
    return true;
  });
}

function sortRoutes(routes, provinceAliases) {
  const normalizedAliases = provinceAliases.map(normalizeText);

  function getPriority(route) {
    const normalizedTo = normalizeText(route.to);
    const normalizedFrom = normalizeText(route.from);

    const destinationMatch = normalizedAliases.some(
      (alias) =>
        normalizedTo === alias ||
        normalizedTo.includes(alias) ||
        alias.includes(normalizedTo),
    );

    const departureMatch = normalizedAliases.some(
      (alias) =>
        normalizedFrom === alias ||
        normalizedFrom.includes(alias) ||
        alias.includes(normalizedFrom),
    );

    /*
     * Ưu tiên:
     * 1. Tuyến đi đến tỉnh
     * 2. Tuyến xuất phát từ tỉnh
     * 3. Tuyến chỉ nhắc tỉnh trong title/description/path
     */
    if (destinationMatch) return 1;
    if (departureMatch) return 2;

    return 3;
  }

  return [...routes].sort((a, b) => {
    const priorityCompare = getPriority(a) - getPriority(b);

    if (priorityCompare !== 0) {
      return priorityCompare;
    }

    const fromCompare = String(a.from || "").localeCompare(
      String(b.from || ""),
      "vi",
    );

    if (fromCompare !== 0) {
      return fromCompare;
    }

    return String(a.to || "").localeCompare(String(b.to || ""), "vi");
  });
}

function getPageNumber(search) {
  const searchParams = new URLSearchParams(search);
  const requestedPage = Number(searchParams.get("page"));

  if (!Number.isInteger(requestedPage) || requestedPage < 1) {
    return 1;
  }

  return requestedPage;
}

export default function SeoProvinceHubPage({ provinceKey }) {
  const location = useLocation();

  const config = PROVINCE_HUB_CONFIGS[provinceKey];

  const filteredRoutes = useMemo(() => {
    if (!config) return [];

    const routes = SEO_ROUTES.filter(isUsefulRoute).filter((route) =>
      routeMatchesProvince(route, config.aliases),
    );

    return sortRoutes(removeDuplicatePaths(routes), config.aliases);
  }, [config]);

  const requestedPage = getPageNumber(location.search);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredRoutes.length / ROUTES_PER_PAGE),
  );

  const currentPage = Math.min(requestedPage, totalPages);

  const currentRoutes = useMemo(() => {
    const startIndex = (currentPage - 1) * ROUTES_PER_PAGE;
    const endIndex = startIndex + ROUTES_PER_PAGE;

    return filteredRoutes.slice(startIndex, endIndex);
  }, [filteredRoutes, currentPage]);

  useEffect(() => {
    if (!config) return;

    const pageSuffix = currentPage > 1 ? ` - Trang ${currentPage}` : "";

    document.title = `${config.title}${pageSuffix} | GoViet247`;

    let metaDescription = document.querySelector('meta[name="description"]');

    if (!metaDescription) {
      metaDescription = document.createElement("meta");
      metaDescription.setAttribute("name", "description");
      document.head.appendChild(metaDescription);
    }

    metaDescription.setAttribute(
      "content",
      `${config.description}${currentPage > 1 ? ` Trang ${currentPage}.` : ""}`,
    );

    let canonical = document.querySelector('link[rel="canonical"]');

    if (!canonical) {
      canonical = document.createElement("link");
      canonical.setAttribute("rel", "canonical");
      document.head.appendChild(canonical);
    }

    const canonicalUrl =
      currentPage > 1
        ? `https://goviet247.com${config.path}?page=${currentPage}`
        : `https://goviet247.com${config.path}`;

    canonical.setAttribute("href", canonicalUrl);

    const oldSchema = document.getElementById("seo-province-hub-schema");

    if (oldSchema) {
      oldSchema.remove();
    }

    const schema = {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: `${config.title}${pageSuffix}`,
      description: config.description,
      url: canonicalUrl,
      mainEntity: {
        "@type": "ItemList",
        numberOfItems: currentRoutes.length,
        itemListElement: currentRoutes.map((route, index) => ({
          "@type": "ListItem",
          position: (currentPage - 1) * ROUTES_PER_PAGE + index + 1,
          name: route.title || `${route.from} đi ${route.to}`,
          url: `https://goviet247.com/${route.path}`,
        })),
      },
    };

    const script = document.createElement("script");
    script.id = "seo-province-hub-schema";
    script.type = "application/ld+json";
    script.textContent = JSON.stringify(schema);

    document.head.appendChild(script);

    return () => {
      const currentSchema = document.getElementById("seo-province-hub-schema");

      if (currentSchema) {
        currentSchema.remove();
      }
    };
  }, [config, currentPage, currentRoutes]);

  if (!config) {
    return (
      <main style={styles.page}>
        <section style={styles.emptyState}>
          Không tìm thấy Hub tỉnh phù hợp.
        </section>
      </main>
    );
  }

  return (
    <main style={styles.page}>
      <nav style={styles.breadcrumb} aria-label="Breadcrumb">
        <Link to="/" style={styles.breadcrumbLink}>
          Trang chủ
        </Link>

        <span style={styles.breadcrumbSeparator}>›</span>

        <Link to="/xe-lien-tinh" style={styles.breadcrumbLink}>
          Xe liên tỉnh
        </Link>

        <span style={styles.breadcrumbSeparator}>›</span>

        <span style={styles.breadcrumbCurrent}>{config.name}</span>
      </nav>

      <section style={styles.hero}>
        <p style={styles.badge}>{config.badge}</p>

        <h1 style={styles.title}>{config.title}</h1>

        <p style={styles.description}>{config.description}</p>

        <p style={styles.description}>
          Chọn tuyến phù hợp để xem lộ trình, thời gian di chuyển tham khảo và
          đặt xe. GoViet247 hỗ trợ xe 5 chỗ, 7 chỗ và 16 chỗ, hoạt động 24/7.
        </p>

        <div style={styles.benefits}>
          <span style={styles.benefit}>Xe riêng, không ghép khách</span>
          <span style={styles.benefit}>Biết giá trước khi đặt</span>
          <span style={styles.benefit}>Không đặt cọc</span>
          <span style={styles.benefit}>Thanh toán sau chuyến đi</span>
          <span style={styles.benefit}>Đưa đón tận nơi</span>
          <span style={styles.benefit}>Hoạt động 24/7</span>
        </div>

        <div style={styles.actions}>
          <Link to="/dat-xe" style={styles.primaryButton}>
            Tính giá và đặt xe
          </Link>

          <Link to="/xe-lien-tinh" style={styles.secondaryButton}>
            Xem tất cả tuyến liên tỉnh
          </Link>
        </div>
      </section>

      <nav style={styles.hubNavigation} aria-label="Danh mục tuyến xe">
        <Link to="/xe-lien-tinh" style={styles.hubNavigationLink}>
          Xe liên tỉnh
        </Link>

        <Link to="/tp-hcm-di-cac-tinh" style={styles.hubNavigationLink}>
          TP.HCM đi các tỉnh
        </Link>

        <Link to="/cac-tinh-di-tp-hcm" style={styles.hubNavigationLink}>
          Các tỉnh về TP.HCM
        </Link>

        <Link to="/thue-xe-di-tinh" style={styles.hubNavigationLink}>
          Thuê xe đi tỉnh
        </Link>

        <Link to="/xe-5-cho" style={styles.hubNavigationLink}>
          Xe 5 chỗ
        </Link>

        <Link to="/xe-7-cho" style={styles.hubNavigationLink}>
          Xe 7 chỗ
        </Link>

        <Link to="/xe-16-cho" style={styles.hubNavigationLink}>
          Xe 16 chỗ
        </Link>
      </nav>

      <section style={styles.routesSection}>
        <div style={styles.sectionHeader}>
          <div>
            <p style={styles.smallBadge}>Hub tuyến xe</p>

            <h2 style={styles.sectionTitle}>{config.heading}</h2>
          </div>

          <p style={styles.routeCount}>
            Có {filteredRoutes.length.toLocaleString("vi-VN")} tuyến
          </p>
        </div>

        {currentRoutes.length > 0 ? (
          <div style={styles.grid}>
            {currentRoutes.map((route) => (
              <Link
                key={`${route.key}-${route.path}`}
                to={`/${route.path}`}
                style={styles.routeCard}
              >
                <strong style={styles.routeName}>
                  {route.from} → {route.to}
                </strong>

                <span style={styles.routeDuration}>
                  {route.duration || "Thời gian tùy hành trình"}
                </span>

                <span style={styles.routeAction}>Xem thông tin tuyến →</span>
              </Link>
            ))}
          </div>
        ) : (
          <div style={styles.emptyState}>
            Hiện chưa tìm thấy tuyến xe liên quan {config.name}.
          </div>
        )}

        {totalPages > 1 && (
          <nav style={styles.pagination} aria-label="Phân trang tuyến xe">
            {currentPage > 1 ? (
              <Link
                to={`${config.path}${
                  currentPage - 1 > 1 ? `?page=${currentPage - 1}` : ""
                }`}
                style={styles.paginationButton}
              >
                ← Trang trước
              </Link>
            ) : (
              <span
                style={{
                  ...styles.paginationButton,
                  ...styles.paginationDisabled,
                }}
              >
                ← Trang trước
              </span>
            )}

            <span style={styles.paginationStatus}>
              Trang {currentPage}/{totalPages}
            </span>

            {currentPage < totalPages ? (
              <Link
                to={`${config.path}?page=${currentPage + 1}`}
                style={styles.paginationButton}
              >
                Trang sau →
              </Link>
            ) : (
              <span
                style={{
                  ...styles.paginationButton,
                  ...styles.paginationDisabled,
                }}
              >
                Trang sau →
              </span>
            )}
          </nav>
        )}
      </section>

      <section style={styles.cta}>
        <h2 style={styles.ctaTitle}>Cần đặt xe đi {config.name}?</h2>

        <p style={styles.ctaText}>
          Nhập điểm đón, điểm đến và loại xe để hệ thống kiểm tra quãng đường và
          báo giá trước khi bạn xác nhận đặt chuyến.
        </p>

        <Link to="/dat-xe" style={styles.ctaButton}>
          Nhập hành trình và xem giá
        </Link>
      </section>
    </main>
  );
}

const styles = {
  page: {
    maxWidth: 1180,
    margin: "0 auto",
    padding: "32px 16px 64px",
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

  hero: {
    padding: 28,
    marginBottom: 18,
    borderRadius: 24,
    border: "1px solid #fed7aa",
    background: "linear-gradient(135deg, #fff7ed, #ffffff)",
  },

  badge: {
    display: "inline-block",
    margin: "0 0 12px",
    padding: "6px 12px",
    borderRadius: 999,
    background: "#ffedd5",
    color: "#c2410c",
    fontSize: 14,
    fontWeight: 800,
  },

  title: {
    margin: "0 0 16px",
    fontSize: "clamp(30px, 5vw, 48px)",
    lineHeight: 1.12,
    fontWeight: 900,
  },

  description: {
    maxWidth: 900,
    margin: "0 0 12px",
    color: "#475569",
    fontSize: 17,
    lineHeight: 1.75,
  },

  benefits: {
    display: "flex",
    flexWrap: "wrap",
    gap: 9,
    marginTop: 20,
  },

  benefit: {
    padding: "8px 12px",
    borderRadius: 999,
    background: "#ffffff",
    border: "1px solid #fed7aa",
    color: "#9a3412",
    fontSize: 14,
    fontWeight: 700,
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
    color: "#c2410c",
    border: "1px solid #fdba74",
    textDecoration: "none",
    fontWeight: 800,
  },

  hubNavigation: {
    display: "flex",
    flexWrap: "wrap",
    gap: 10,
    padding: 16,
    marginBottom: 18,
    borderRadius: 20,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
  },

  hubNavigationLink: {
    padding: "10px 14px",
    borderRadius: 999,
    background: "#f8fafc",
    color: "#334155",
    border: "1px solid #e2e8f0",
    textDecoration: "none",
    fontWeight: 800,
  },

  routesSection: {
    padding: 22,
    marginBottom: 18,
    borderRadius: 22,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    boxShadow: "0 10px 30px rgba(15, 23, 42, 0.05)",
  },

  sectionHeader: {
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 20,
  },

  smallBadge: {
    margin: "0 0 8px",
    color: "#ea580c",
    fontSize: 14,
    fontWeight: 800,
  },

  sectionTitle: {
    margin: 0,
    fontSize: "clamp(24px, 4vw, 34px)",
    lineHeight: 1.2,
    fontWeight: 900,
  },

  routeCount: {
    margin: 0,
    color: "#64748b",
    fontSize: 14,
    fontWeight: 700,
  },

  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
    gap: 12,
  },

  routeCard: {
    display: "flex",
    flexDirection: "column",
    gap: 9,
    minHeight: 112,
    padding: 16,
    borderRadius: 17,
    background: "#fff7ed",
    color: "#172033",
    border: "1px solid #fed7aa",
    textDecoration: "none",
  },

  routeName: {
    fontSize: 16,
    lineHeight: 1.45,
  },

  routeDuration: {
    color: "#64748b",
    fontSize: 14,
  },

  routeAction: {
    marginTop: "auto",
    color: "#c2410c",
    fontSize: 13,
    fontWeight: 800,
  },

  emptyState: {
    padding: 28,
    borderRadius: 16,
    background: "#f8fafc",
    color: "#64748b",
    textAlign: "center",
  },

  pagination: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexWrap: "wrap",
    gap: 12,
    marginTop: 26,
  },

  paginationButton: {
    padding: "10px 15px",
    borderRadius: 999,
    background: "#fff7ed",
    color: "#c2410c",
    border: "1px solid #fed7aa",
    textDecoration: "none",
    fontWeight: 800,
  },

  paginationDisabled: {
    color: "#94a3b8",
    background: "#f8fafc",
    borderColor: "#e2e8f0",
  },

  paginationStatus: {
    color: "#475569",
    fontWeight: 800,
  },

  cta: {
    padding: 28,
    borderRadius: 24,
    background: "#172033",
    color: "#ffffff",
    textAlign: "center",
  },

  ctaTitle: {
    margin: "0 0 10px",
    fontSize: 28,
    fontWeight: 900,
  },

  ctaText: {
    maxWidth: 720,
    margin: "0 auto 18px",
    color: "#cbd5e1",
    fontSize: 16,
    lineHeight: 1.7,
  },

  ctaButton: {
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
};
