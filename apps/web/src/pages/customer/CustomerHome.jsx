// Path: goviet247/apps/web/src/pages/customer/CustomerHome.jsx
import { Link } from "react-router-dom";
import HeroSection from "../../components/customer/HeroSection";
import { useSeoRouteCatalog } from "../../hooks/useSeoRouteCatalog";

const PINNED_ROUTE_CARDS = [
  {
    key: "home-xe-lien-tinh",
    path: "xe-lien-tinh",
    label: "Liên tỉnh → theo nhu cầu",
    duration: "Tùy tuyến",
  },
  {
    key: "home-tp-hcm-di-cac-tinh",
    path: "tp-hcm-di-cac-tinh",
    label: "TP.HCM → các tỉnh",
    duration: "Tùy tuyến",
  },
  {
    key: "home-cac-tinh-di-tp-hcm",
    path: "cac-tinh-di-tp-hcm",
    label: "Các tỉnh → TP.HCM",
    duration: "Tùy tuyến",
  },
  {
    key: "home-thue-xe-di-tinh",
    path: "thue-xe-di-tinh",
    label: "Thuê xe đi tỉnh",
    duration: "Tùy tuyến",
  },
];

const HIDDEN_ROUTE_KEYS = new Set([
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

export default function CustomerHome() {
  const SEO_ROUTES = useSeoRouteCatalog({ limit: 40 });
  const visibleRoutes = SEO_ROUTES.filter(
    (route) => !HIDDEN_ROUTE_KEYS.has(route.key),
  );

  const featuredRoutes = visibleRoutes.slice(0, 28);

  return (
    <>
      <HeroSection />

      <section style={styles.section}>
        <div style={styles.inner}>
          <p style={styles.badge}>Tuyến phổ biến</p>

          <h2 style={styles.title}>Đặt xe riêng đi tỉnh từ TP.HCM</h2>

          <p style={styles.description}>
            GoViet247 hỗ trợ đặt xe riêng đi tỉnh, đi sân bay, du lịch và công
            tác với xe 5 chỗ, 7 chỗ, 16 chỗ. Giá được tính trước khi đặt, rõ
            ràng và thuận tiện.
          </p>

          <div style={styles.grid}>
            {PINNED_ROUTE_CARDS.map((route) => (
              <Link key={route.key} to={`/${route.path}`} style={styles.card}>
                <strong>{route.label}</strong>
                <span>{route.duration}</span>
              </Link>
            ))}

            {featuredRoutes.map((route) => (
              <Link key={route.key} to={`/${route.path}`} style={styles.card}>
                <strong>
                  {route.from} → {route.to}
                </strong>
                <span>{route.duration}</span>
              </Link>
            ))}
          </div>
          <div style={styles.viewAllWrapper}>
            <Link to="/xe-lien-tinh" style={styles.viewAllButton}>
              Xem tất cả tuyến xe →
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}

const styles = {
  section: {
    background: "#ffffff",
    padding: "48px 16px 72px",
  },
  inner: {
    maxWidth: 1080,
    margin: "0 auto",
  },
  badge: {
    display: "inline-block",
    margin: "0 0 10px",
    padding: "6px 12px",
    borderRadius: 999,
    background: "#ffedd5",
    color: "#c2410c",
    fontWeight: 800,
    fontSize: 14,
  },
  title: {
    margin: "0 0 12px",
    fontSize: "clamp(28px, 4vw, 40px)",
    lineHeight: 1.15,
    fontWeight: 900,
    color: "#172033",
  },
  description: {
    maxWidth: 760,
    margin: "0 0 22px",
    fontSize: 16,
    lineHeight: 1.7,
    color: "#475569",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: 12,
  },
  card: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
    padding: 16,
    borderRadius: 18,
    background: "#fff7ed",
    color: "#172033",
    border: "1px solid #fed7aa",
    textDecoration: "none",
  },
  viewAllWrapper: {
    display: "flex",
    justifyContent: "center",
    marginTop: 24,
  },

  viewAllButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "12px 24px",
    borderRadius: 999,
    background: "#f97316",
    color: "#fff",
    textDecoration: "none",
    fontWeight: 800,
  },
};
