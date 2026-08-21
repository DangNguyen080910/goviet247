import { useEffect } from "react";
import { Link, useLocation } from "react-router-dom";

const recentlyTrackedPaths = new Set();

export default function NotFoundPage() {
  const location = useLocation();

  useEffect(() => {
    const missingPath = location.pathname;

    // React StrictMode có thể chạy effect hai lần khi phát triển.
    // Chặn sự kiện trùng trong một khoảng ngắn nhưng vẫn ghi nhận lần truy cập sau.
    if (recentlyTrackedPaths.has(missingPath)) return undefined;

    recentlyTrackedPaths.add(missingPath);

    if (typeof window.gtag === "function") {
      window.gtag("event", "page_not_found", {
        page_path: missingPath,
      });
    }

    window.setTimeout(() => {
      recentlyTrackedPaths.delete(missingPath);
    }, 2000);

    return undefined;
  }, [location.pathname]);

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: "24px",
        background:
          "linear-gradient(145deg, rgba(255, 107, 0, 0.12), rgba(255, 255, 255, 0.92) 48%, rgba(0, 112, 243, 0.08))",
        color: "#182235",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <section
        style={{
          width: "min(560px, 100%)",
          padding: "40px 28px",
          border: "1px solid #e8ebf0",
          borderRadius: "20px",
          background: "rgba(255, 255, 255, 0.96)",
          boxShadow: "0 18px 55px rgba(24, 34, 53, 0.12)",
          textAlign: "center",
        }}
      >
        <img
          src="/GoViet247_logo.png"
          alt="GoViet247"
          width="72"
          height="72"
          style={{ borderRadius: "16px" }}
        />

        <p
          style={{
            margin: "22px 0 6px",
            color: "#ff6b00",
            fontSize: "14px",
            fontWeight: 700,
            letterSpacing: "0.08em",
          }}
        >
          LỖI 404
        </p>

        <h1 style={{ margin: 0, fontSize: "clamp(28px, 6vw, 38px)" }}>
          Không tìm thấy trang
        </h1>

        <p
          style={{
            margin: "16px auto 28px",
            maxWidth: "440px",
            color: "#667085",
            fontSize: "17px",
            lineHeight: 1.6,
          }}
        >
          Đường dẫn có thể đã thay đổi hoặc không còn tồn tại. Bạn có thể quay
          về trang chủ hoặc đặt xe ngay trên GoViet247.
        </p>

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "center",
            gap: "12px",
          }}
        >
          <Link
            to="/"
            style={{
              padding: "13px 22px",
              border: "1px solid #d7dce3",
              borderRadius: "10px",
              color: "#344054",
              fontWeight: 700,
              textDecoration: "none",
            }}
          >
            Về trang chủ
          </Link>

          <Link
            to="/dat-xe"
            style={{
              padding: "13px 22px",
              border: "1px solid #ff6b00",
              borderRadius: "10px",
              background: "#ff6b00",
              color: "#fff",
              fontWeight: 700,
              textDecoration: "none",
              boxShadow: "0 8px 20px rgba(255, 107, 0, 0.22)",
            }}
          >
            Đặt xe ngay
          </Link>
        </div>
      </section>
    </main>
  );
}
