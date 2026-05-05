// Path: goviet247/apps/web/src/pages/customer/SeoVungTau.jsx
import { Link } from "react-router-dom";

export default function SeoVungTau() {
  return (
      <main style={styles.page}>
        <section style={styles.hero}>
          <p style={styles.badge}>GoViet247 • Xe riêng đi tỉnh</p>

          <h1 style={styles.title}>
            Thuê xe đi Vũng Tàu giá rẻ, xe riêng đưa đón tận nơi
          </h1>

          <p style={styles.description}>
            Bạn đang cần thuê xe đi Vũng Tàu nhanh chóng, tiện lợi và không phải
            chờ đợi như xe khách? GoViet247 cung cấp dịch vụ xe riêng đi Vũng
            Tàu từ TP.HCM với nhiều loại xe 5 chỗ, 7 chỗ và 16 chỗ, phù hợp cho
            cá nhân, gia đình và nhóm bạn.
          </p>

          <p style={styles.description}>
            Với tài xế kinh nghiệm, xe đời mới và giá trọn gói, bạn có thể yên
            tâm tận hưởng chuyến đi mà không lo phát sinh chi phí.
          </p>

          <div style={styles.actions}>
            <Link to="/dat-xe" style={styles.primaryButton}>
              Đặt xe ngay
            </Link>

            <a href="tel:0900000000" style={styles.secondaryButton}>
              Gọi tư vấn
            </a>
          </div>
        </section>

        <section style={styles.card}>
          <h2 style={styles.sectionTitle}>Giá thuê xe đi Vũng Tàu tham khảo</h2>

          <div style={styles.priceGrid}>
            <div style={styles.priceBox}>
              <strong>Xe 5 chỗ</strong>
              <span>từ 900.000đ</span>
            </div>

            <div style={styles.priceBox}>
              <strong>Xe 7 chỗ</strong>
              <span>từ 1.100.000đ</span>
            </div>

            <div style={styles.priceBox}>
              <strong>Xe 16 chỗ</strong>
              <span>từ 1.800.000đ</span>
            </div>
          </div>

          <p style={styles.note}>
            Giá đã bao gồm phí cầu đường, xăng xe và tài xế. Giá trọn gói,
            không phát sinh thêm chi phí ngoài thỏa thuận.
          </p>
        </section>

        <section style={styles.card}>
          <h2 style={styles.sectionTitle}>Tại sao nên chọn GoViet247?</h2>

          <ul style={styles.list}>
            <li>Xe riêng, không ghép khách</li>
            <li>Đón tận nơi tại TP.HCM</li>
            <li>Giá rõ ràng, không phát sinh</li>
            <li>Tài xế thân thiện, đúng giờ</li>
            <li>Hỗ trợ đặt xe nhanh chóng qua web, hotline hoặc Zalo</li>
          </ul>
        </section>

        <section style={styles.card}>
          <h2 style={styles.sectionTitle}>Lộ trình TP.HCM đi Vũng Tàu</h2>

          <p style={styles.text}>
            Lộ trình phổ biến: TP.HCM → Long Thành → Bà Rịa → Vũng Tàu.
            Thời gian di chuyển thường khoảng 2 đến 2.5 giờ tùy tình trạng giao
            thông.
          </p>
        </section>

        <section style={styles.card}>
          <h2 style={styles.sectionTitle}>Câu hỏi thường gặp</h2>

          <div style={styles.faqItem}>
            <h3>Giá xe đi Vũng Tàu đã bao gồm phí cầu đường chưa?</h3>
            <p>Có. Giá là trọn gói theo chuyến và đã bao gồm phí cầu đường.</p>
          </div>

          <div style={styles.faqItem}>
            <h3>Có thể đặt xe một chiều không?</h3>
            <p>Có. GoViet247 hỗ trợ đặt xe một chiều hoặc khứ hồi.</p>
          </div>

          <div style={styles.faqItem}>
            <h3>Có cần đặt xe trước không?</h3>
            <p>Nên đặt trước để GoViet247 sắp xếp tài xế phù hợp cho bạn.</p>
          </div>

          <div style={styles.faqItem}>
            <h3>Có xe 5 chỗ, 7 chỗ và 16 chỗ không?</h3>
            <p>Có. Bạn có thể chọn loại xe phù hợp khi đặt chuyến.</p>
          </div>
        </section>

        <section style={styles.cta}>
          <h2>Đặt xe đi Vũng Tàu ngay hôm nay</h2>
          <p>
            Nhập điểm đón, điểm đến và thời gian khởi hành để nhận giá nhanh từ
            GoViet247.
          </p>

          <Link to="/dat-xe" style={styles.primaryButton}>
            Đặt chuyến
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
    margin: 0,
    lineHeight: 1.8,
    color: "#475569",
    fontSize: 16,
  },
  faqItem: {
    borderTop: "1px solid #e2e8f0",
    paddingTop: 14,
    marginTop: 14,
  },
  cta: {
    textAlign: "center",
    background: "#172033",
    color: "#ffffff",
    borderRadius: 24,
    padding: 28,
  },
};