// Path: goviet247/apps/web/src/pages/customer/CustomerHome.jsx
import { Link } from "react-router-dom";
import HeroSection from "../../components/customer/HeroSection";
import { SEO_ROUTES } from "../../data/seoRoutes";

export default function CustomerHome() {
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
            {SEO_ROUTES.map((route) => (
              <Link key={route.key} to={`/${route.path}`} style={styles.card}>
                <strong>
                  {route.from} → {route.to}
                </strong>
                <span>{route.duration}</span>
              </Link>
            ))}
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
};
