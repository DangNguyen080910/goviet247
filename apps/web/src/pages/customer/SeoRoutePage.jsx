// Path: goviet247/apps/web/src/pages/customer/SeoRoutePage.jsx
import { useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { SEO_ROUTES } from "../../data/seoRoutes";

export default function SeoRoutePage({ routeKey }) {
  const route = useMemo(
    () => SEO_ROUTES.find((item) => item.key === routeKey),
    [routeKey],
  );

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

  return (
    <main style={styles.page}>
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

        <div style={styles.actions}>
          <Link to="/dat-xe" style={styles.primaryButton}>
            Tính giá & đặt xe
          </Link>

          <a href="tel:0326184628" style={styles.secondaryButton}>
            Gọi tư vấn
          </a>
        </div>
      </section>

      <section style={styles.card}>
        <h2 style={styles.sectionTitle}>
          Giá thuê xe đi {route.from} đi {route.to} được tính như thế nào?
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
          Bạn có thể bấm “Tính giá & đặt xe” để xem giá trước khi xác nhận. Giá
          rõ ràng, trọn gói theo chuyến và không phát sinh thêm.
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

      <section style={styles.popularRoutes}>
        <h2 style={styles.sectionTitle}>Tuyến phổ biến khác</h2>

        <div style={styles.routeLinks}>
          {SEO_ROUTES.filter((item) => item.key !== route.key).map((item) => (
            <Link key={item.key} to={`/${item.path}`} style={styles.routeLink}>
              {item.from} → {item.to}
            </Link>
          ))}
        </div>
      </section>

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
};
