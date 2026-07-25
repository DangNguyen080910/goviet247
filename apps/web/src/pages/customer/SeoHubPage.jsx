// Path: goviet247/apps/web/src/pages/customer/SeoHubPage.jsx

import { useEffect, useMemo } from "react";
import { Link, useLocation } from "react-router-dom";
import { SEO_ROUTES } from "../../data/seoRoutes";

/*
 * Các route tổng quát này được dùng làm Hub SEO.
 * Không hiển thị chúng như một tuyến xe con trong danh sách.
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
 * Số tuyến hiển thị trên mỗi trang.
 *
 * Không nên đưa toàn bộ hơn 6.000 URL vào cùng một trang vì:
 * - DOM sẽ quá lớn
 * - Trang tải chậm
 * - Google khó đánh giá cấu trúc
 *
 * Mỗi trang 120 link là đủ mạnh cho internal link và vẫn nhẹ.
 */
const ROUTES_PER_PAGE = 120;

/*
 * Các tên thường dùng để chỉ TP.HCM.
 */
const HCM_NAMES = new Set([
  "tp.hcm",
  "tp hcm",
  "tphcm",
  "hcm",
  "sài gòn",
  "sai gon",
  "thành phố hồ chí minh",
  "ho chi minh",
]);

const HUB_CONFIGS = {
  "inter-province": {
    path: "/xe-lien-tinh",

    badge: "GoViet247 • Xe liên tỉnh",

    title: "Xe liên tỉnh, xe riêng đưa đón tận nơi",

    description:
      "Danh sách các tuyến xe liên tỉnh của GoViet247, bao gồm TP.HCM đi các tỉnh, các tỉnh về TP.HCM và nhiều tuyến tỉnh đi tỉnh theo nhu cầu.",

    heading: "Danh sách tuyến xe liên tỉnh",

    intro:
      "Chọn tuyến phù hợp để xem thông tin hành trình, thời gian di chuyển tham khảo và đặt xe riêng. GoViet247 hỗ trợ xe 5 chỗ, 7 chỗ và 16 chỗ, không ghép khách.",

    emptyText: "Hiện chưa tìm thấy tuyến xe liên tỉnh phù hợp.",

    filter: () => true,
  },

  "from-hcm": {
    path: "/tp-hcm-di-cac-tinh",

    badge: "GoViet247 • TP.HCM đi tỉnh",

    title: "Xe từ TP.HCM đi các tỉnh, xe riêng giá rõ ràng",

    description:
      "Tổng hợp các tuyến xe từ TP.HCM, HCM và Sài Gòn đi các tỉnh, thành phố, khu du lịch, sân bay, khu công nghiệp và địa điểm nổi bật.",

    heading: "Các tuyến từ TP.HCM đi tỉnh",

    intro:
      "GoViet247 hỗ trợ đón tận nơi tại TP.HCM, biết giá trước khi đặt, không cần đặt cọc và thanh toán sau khi hoàn thành chuyến.",

    emptyText: "Hiện chưa tìm thấy tuyến từ TP.HCM đi tỉnh phù hợp.",

    filter: (route) => isHcmLocation(route.from),
  },

  "to-hcm": {
    path: "/cac-tinh-di-tp-hcm",

    badge: "GoViet247 • Tỉnh về TP.HCM",

    title: "Xe từ các tỉnh về TP.HCM, đón tận nơi",

    description:
      "Tổng hợp các tuyến xe từ tỉnh, thành phố, khu du lịch và sân bay về TP.HCM. Xe riêng không ghép khách, hỗ trợ đưa đón tận nơi.",

    heading: "Các tuyến từ tỉnh về TP.HCM",

    intro:
      "Chọn điểm khởi hành để xem tuyến xe về TP.HCM. Giá được báo trước khi đặt và có thể lựa chọn xe 5 chỗ, 7 chỗ hoặc 16 chỗ.",

    emptyText: "Hiện chưa tìm thấy tuyến từ tỉnh về TP.HCM phù hợp.",

    filter: (route) => isHcmLocation(route.to),
  },

  rental: {
    path: "/thue-xe-di-tinh",

    badge: "GoViet247 • Thuê xe đi tỉnh",

    title: "Thuê xe đi tỉnh, xe riêng 5 chỗ, 7 chỗ, 16 chỗ",

    description:
      "Danh sách các tuyến thuê xe đi tỉnh, thuê xe riêng đường dài, thuê xe một chiều, khứ hồi, xe có tài xế và xe đưa đón tận nơi.",

    heading: "Các tuyến thuê xe đi tỉnh",

    intro:
      "GoViet247 hỗ trợ thuê xe riêng đi du lịch, công tác, thăm người thân hoặc về quê. Không ghép khách, không đặt cọc và thanh toán sau chuyến đi.",

    emptyText: "Hiện chưa tìm thấy tuyến thuê xe đi tỉnh phù hợp.",

    filter: (route) => {
      const searchableText = [
        route.key,
        route.path,
        route.title,
        route.description,
        route.routeText,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return (
        searchableText.includes("thuê xe") ||
        searchableText.includes("thue-xe") ||
        searchableText.includes("xe riêng") ||
        searchableText.includes("xe-rieng")
      );
    },
  },

  "car-5-seat": {
    path: "/xe-5-cho",

    badge: "GoViet247 • Xe 5 chỗ đi tỉnh",

    title: "Xe 5 chỗ đi tỉnh, xe riêng đưa đón tận nơi",

    description:
      "Tổng hợp các tuyến xe 5 chỗ đi tỉnh dành cho cá nhân, cặp đôi, gia đình nhỏ và khách công tác. Xe riêng không ghép khách, biết giá trước khi đặt.",

    heading: "Danh sách tuyến xe 5 chỗ đi tỉnh",

    intro:
      "Xe 5 chỗ phù hợp hành trình liên tỉnh cần sự riêng tư, linh hoạt và thoải mái. GoViet247 hỗ trợ đưa đón tận nơi, không đặt cọc và thanh toán sau chuyến đi.",

    emptyText: "Hiện chưa tìm thấy tuyến xe 5 chỗ phù hợp.",

    filter: (route) => {
      const searchableText = [
        route.key,
        route.path,
        route.title,
        route.description,
        route.routeText,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return (
        searchableText.includes("5 chỗ") ||
        searchableText.includes("5 cho") ||
        searchableText.includes("xe-5-cho")
      );
    },
  },

  "car-7-seat": {
    path: "/xe-7-cho",

    badge: "GoViet247 • Xe 7 chỗ đi tỉnh",

    title: "Xe 7 chỗ đi tỉnh, phù hợp gia đình và nhóm nhỏ",

    description:
      "Tổng hợp các tuyến xe 7 chỗ đi tỉnh dành cho gia đình, nhóm bạn và khách có nhiều hành lý. Xe riêng, không ghép khách và đưa đón tận nơi.",

    heading: "Danh sách tuyến xe 7 chỗ đi tỉnh",

    intro:
      "Xe 7 chỗ mang lại không gian rộng rãi cho hành trình đường dài, du lịch, công tác hoặc về quê. Khách biết giá trước khi đặt và chủ động lịch trình.",

    emptyText: "Hiện chưa tìm thấy tuyến xe 7 chỗ phù hợp.",

    filter: (route) => {
      const searchableText = [
        route.key,
        route.path,
        route.title,
        route.description,
        route.routeText,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return (
        searchableText.includes("7 chỗ") ||
        searchableText.includes("7 cho") ||
        searchableText.includes("xe-7-cho")
      );
    },
  },

  "car-16-seat": {
    path: "/xe-16-cho",

    badge: "GoViet247 • Xe 16 chỗ đi tỉnh",

    title: "Xe 16 chỗ đi tỉnh, phù hợp nhóm và đoàn khách",

    description:
      "Tổng hợp các tuyến xe 16 chỗ đi tỉnh phục vụ nhóm bạn, gia đình đông người, công ty và đoàn du lịch. Xe riêng có tài xế, lịch trình linh hoạt.",

    heading: "Danh sách tuyến xe 16 chỗ đi tỉnh",

    intro:
      "Xe 16 chỗ phù hợp hành trình du lịch, công tác, team building, sự kiện và đưa đón đoàn khách. GoViet247 hỗ trợ đón trả tận nơi và hoạt động 24/7.",

    emptyText: "Hiện chưa tìm thấy tuyến xe 16 chỗ phù hợp.",

    filter: (route) => {
      const searchableText = [
        route.key,
        route.path,
        route.title,
        route.description,
        route.routeText,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return (
        searchableText.includes("16 chỗ") ||
        searchableText.includes("16 cho") ||
        searchableText.includes("xe-16-cho")
      );
    },
  },

  tourism: {
    path: "/xe-di-du-lich",

    badge: "GoViet247 • Xe riêng đi du lịch",

    title: "Xe đi du lịch, xe riêng đưa đón tận nơi",

    description:
      "Tổng hợp các tuyến xe riêng đi du lịch dành cho gia đình, nhóm bạn và đoàn khách. Không ghép khách, chủ động lịch trình và biết giá trước khi đặt.",

    heading: "Danh sách tuyến xe đi du lịch",

    intro:
      "Dịch vụ phù hợp cho khách đi biển, nghỉ dưỡng, tham quan và khám phá các điểm đến nổi tiếng. Hỗ trợ xe 5 chỗ, 7 chỗ và 16 chỗ.",

    emptyText: "Hiện chưa tìm thấy tuyến xe du lịch phù hợp.",

    filter: (route) => {
      const searchableText = [
        route.key,
        route.path,
        route.title,
        route.description,
        route.routeText,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return (
        searchableText.includes("du lịch") ||
        searchableText.includes("du lich") ||
        searchableText.includes("tham quan") ||
        searchableText.includes("nghỉ dưỡng") ||
        searchableText.includes("nghi duong")
      );
    },
  },

  business: {
    path: "/xe-di-cong-tac",

    badge: "GoViet247 • Xe riêng đi công tác",

    title: "Xe đi công tác, đưa đón đúng giờ và tận nơi",

    description:
      "Tổng hợp các tuyến xe riêng phục vụ khách đi công tác, gặp đối tác, làm việc tại khu công nghiệp hoặc di chuyển liên tỉnh trong ngày.",

    heading: "Danh sách tuyến xe đi công tác",

    intro:
      "Xe riêng giúp khách chủ động thời gian, không phải chờ ghép khách và thuận tiện khi cần di chuyển nhiều địa điểm trong hành trình.",

    emptyText: "Hiện chưa tìm thấy tuyến xe công tác phù hợp.",

    filter: (route) => {
      const searchableText = [
        route.key,
        route.path,
        route.title,
        route.description,
        route.routeText,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return (
        searchableText.includes("công tác") ||
        searchableText.includes("cong tac") ||
        searchableText.includes("gặp đối tác") ||
        searchableText.includes("gap doi tac") ||
        searchableText.includes("khu công nghiệp") ||
        searchableText.includes("khu cong nghiep")
      );
    },
  },

  airport: {
    path: "/xe-dua-don-san-bay",

    badge: "GoViet247 • Xe đưa đón sân bay",

    title: "Xe đưa đón sân bay, đón trả tận nơi 24/7",

    description:
      "Tổng hợp các tuyến xe đưa đón sân bay đi tỉnh và từ các tỉnh về sân bay. Hỗ trợ hành lý, theo dõi lịch trình và đón trả tận nơi.",

    heading: "Danh sách tuyến xe đưa đón sân bay",

    intro:
      "Phù hợp khách đi sân bay Tân Sơn Nhất, Long Thành, Cam Ranh và các sân bay khác. Có xe 5 chỗ, 7 chỗ và 16 chỗ.",

    emptyText: "Hiện chưa tìm thấy tuyến xe sân bay phù hợp.",

    filter: (route) => {
      const searchableText = [
        route.key,
        route.path,
        route.from,
        route.to,
        route.title,
        route.description,
        route.routeText,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return (
        searchableText.includes("sân bay") ||
        searchableText.includes("san bay") ||
        searchableText.includes("tân sơn nhất") ||
        searchableText.includes("tan son nhat") ||
        searchableText.includes("cam ranh") ||
        searchableText.includes("long thành") ||
        searchableText.includes("long thanh")
      );
    },
  },

  resort: {
    path: "/xe-dua-don-resort",

    badge: "GoViet247 • Xe đưa đón resort",

    title: "Xe đưa đón resort, khách sạn và khu nghỉ dưỡng",

    description:
      "Tổng hợp các tuyến xe riêng đưa đón khách sạn, resort và khu nghỉ dưỡng. Phù hợp gia đình, nhóm bạn và khách cần hành trình riêng tư.",

    heading: "Danh sách tuyến xe đưa đón resort",

    intro:
      "GoViet247 hỗ trợ đón tận nhà và trả tận resort, khách sạn hoặc khu nghỉ dưỡng tại Hồ Tràm, Mũi Né, Đà Lạt, Nha Trang và nhiều điểm đến khác.",

    emptyText: "Hiện chưa tìm thấy tuyến xe resort phù hợp.",

    filter: (route) => {
      const searchableText = [
        route.key,
        route.path,
        route.from,
        route.to,
        route.title,
        route.description,
        route.routeText,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return (
        searchableText.includes("resort") ||
        searchableText.includes("khách sạn") ||
        searchableText.includes("khach san") ||
        searchableText.includes("nghỉ dưỡng") ||
        searchableText.includes("nghi duong")
      );
    },
  },
};

function normalizeText(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function isHcmLocation(value) {
  return HCM_NAMES.has(normalizeText(value));
}

function isUsefulRoute(route) {
  if (!route?.key || !route?.path) return false;

  if (GENERIC_ROUTE_KEYS.has(route.key)) return false;

  const from = normalizeText(route.from);
  const to = normalizeText(route.to);

  const genericLocations = new Set([
    "",
    "các tỉnh",
    "cac tinh",
    "theo nhu cầu",
    "theo nhu cau",
    "liên tỉnh",
    "lien tinh",
  ]);

  if (genericLocations.has(from)) return false;
  if (genericLocations.has(to)) return false;

  return true;
}

function removeDuplicatePaths(routes) {
  const seenPaths = new Set();

  return routes.filter((route) => {
    if (seenPaths.has(route.path)) return false;

    seenPaths.add(route.path);
    return true;
  });
}

function sortRoutes(routes) {
  return [...routes].sort((a, b) => {
    const fromCompare = String(a.from || "").localeCompare(
      String(b.from || ""),
      "vi",
    );

    if (fromCompare !== 0) return fromCompare;

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

export default function SeoHubPage({ hubType }) {
  const location = useLocation();

  const config = HUB_CONFIGS[hubType] || HUB_CONFIGS["inter-province"];

  const filteredRoutes = useMemo(() => {
    const routes = SEO_ROUTES.filter(isUsefulRoute).filter(config.filter);

    return sortRoutes(removeDuplicatePaths(routes));
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

  /*
   * Cập nhật title, description, canonical và ItemList schema.
   */
  useEffect(() => {
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

    const oldSchema = document.getElementById("seo-hub-item-list-schema");

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
    script.id = "seo-hub-item-list-schema";
    script.type = "application/ld+json";
    script.textContent = JSON.stringify(schema);

    document.head.appendChild(script);

    return () => {
      const currentSchema = document.getElementById("seo-hub-item-list-schema");

      if (currentSchema) {
        currentSchema.remove();
      }
    };
  }, [config, currentPage, currentRoutes]);

  return (
    <main style={styles.page}>
      <section style={styles.hero}>
        <p style={styles.badge}>{config.badge}</p>

        <h1 style={styles.title}>{config.title}</h1>

        <p style={styles.description}>{config.description}</p>

        <p style={styles.description}>{config.intro}</p>

        <div style={styles.benefits}>
          <span style={styles.benefit}>Xe riêng, không ghép khách</span>
          <span style={styles.benefit}>Biết giá trước khi đặt</span>
          <span style={styles.benefit}>Không đặt cọc</span>
          <span style={styles.benefit}>Thanh toán sau chuyến đi</span>
          <span style={styles.benefit}>Đưa đón tận nơi</span>
          <span style={styles.benefit}>Hỗ trợ 24/7</span>
        </div>

        <div style={styles.actions}>
          <Link to="/dat-xe" style={styles.primaryButton}>
            Tính giá và đặt xe
          </Link>

          <Link to="/" style={styles.secondaryButton}>
            Về trang chủ
          </Link>
        </div>
      </section>

      <Link
        to="/xe-5-cho"
        style={{
          ...styles.hubNavigationLink,
          ...(hubType === "car-5-seat" ? styles.hubNavigationLinkActive : {}),
        }}
      >
        Xe 5 chỗ
      </Link>

      <Link
        to="/xe-7-cho"
        style={{
          ...styles.hubNavigationLink,
          ...(hubType === "car-7-seat" ? styles.hubNavigationLinkActive : {}),
        }}
      >
        Xe 7 chỗ
      </Link>

      <Link
        to="/xe-16-cho"
        style={{
          ...styles.hubNavigationLink,
          ...(hubType === "car-16-seat" ? styles.hubNavigationLinkActive : {}),
        }}
      >
        Xe 16 chỗ
      </Link>

      <section style={styles.routesSection}>
        <div style={styles.sectionHeader}>
          <div>
            <p style={styles.smallBadge}>Danh mục tuyến xe</p>

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
          <div style={styles.emptyState}>{config.emptyText}</div>
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
        <h2 style={styles.ctaTitle}>Chưa thấy đúng hành trình cần đi?</h2>

        <p style={styles.ctaText}>
          Bạn có thể nhập trực tiếp điểm đón và điểm đến để hệ thống kiểm tra
          hành trình và báo giá trước khi đặt.
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

  hubNavigationLinkActive: {
    background: "#f97316",
    color: "#ffffff",
    borderColor: "#f97316",
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
