// Path: goviet247/apps/web/src/App.jsx

import { Routes, Route, Navigate } from "react-router-dom";

// ADMIN
import AdminLogin from "./pages/admin/AdminLogin";
import RequireAdmin from "./pages/admin/RequireAdmin";
import AdminLayout from "./pages/admin/AdminLayout";
import AdminHome from "./pages/admin/AdminHome";
import AdminPendingTrips from "./pages/admin/AdminPendingTrips";
import AdminNotifications from "./pages/admin/AdminNotifications";
import AdminSystemNotifications from "./pages/admin/AdminSystemNotifications";
import AdminTripsAssigned from "./pages/admin/AdminTripsAssigned";
import AdminDrivers from "./pages/admin/AdminDrivers";
import AdminCustomers from "./pages/admin/AdminCustomers";
import AdminTrips from "./pages/admin/AdminTrips";
import AdminConfig from "./pages/admin/AdminConfig";
import AdminDriverWallets from "./pages/admin/AdminDriverWallets";
import AdminLedger from "./pages/admin/AdminLedger";
import AdminFeedback from "./pages/admin/AdminFeedback";
import AdminCashTransactions from "./pages/admin/AdminCashTransactions";

// CUSTOMER
import CustomerLayout from "./components/customer/CustomerLayout";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import CustomerHome from "./pages/customer/CustomerHome";
import CustomerBooking from "./pages/customer/CustomerBooking";
import CustomerAuth from "./pages/customer/CustomerAuth";
import CustomerProfile from "./pages/customer/CustomerProfile";
import CustomerNotifications from "./pages/customer/CustomerNotifications";
import SeoRoutePage from "./pages/customer/SeoRoutePage";
import SeoHubPage from "./pages/customer/SeoHubPage";
import SeoProvinceHubPage from "./pages/customer/SeoProvinceHubPage";
import NotFoundPage from "./pages/customer/NotFoundPage";

import { SEO_ROUTES } from "./data/seoRoutes";

/*
 * Các URL Hub SEO.
 *
 * Những path này có dữ liệu trong SEO_ROUTES nhưng không được render bằng
 * SeoRoutePage vì chúng là trang danh mục, không phải một tuyến xe cụ thể.
 */
const SEO_HUB_PATHS = new Set([
  "xe-lien-tinh",
  "tp-hcm-di-cac-tinh",
  "cac-tinh-di-tp-hcm",
  "thue-xe-di-tinh",

  "vung-tau",
  "ho-tram",
  "long-hai",
  "binh-chau",
  "phan-thiet",
  "mui-ne",
  "da-lat",
  "nha-trang",
  "tay-ninh",
  "can-tho",
  "ben-tre",
  "long-an",
  "tien-giang",
  "vinh-long",
  "dong-thap",
  "an-giang",
  "kien-giang",

  "xe-5-cho",
  "xe-7-cho",
  "xe-16-cho",

  "xe-di-du-lich",
  "xe-di-cong-tac",
  "xe-dua-don-san-bay",
  "xe-dua-don-resort",
]);

export default function App() {
  return (
    <Routes>
      {/* ====================================================== */}
      {/* CUSTOMER */}
      {/* ====================================================== */}

      <Route path="/" element={<CustomerLayout />}>
        <Route index element={<CustomerHome />} />

        <Route path="dat-xe" element={<CustomerBooking />} />
        <Route path="ho-so" element={<CustomerProfile />} />
        <Route path="thong-bao" element={<CustomerNotifications />} />

        {/* ==================================================== */}
        {/* SEO HUBS */}
        {/* ==================================================== */}

        <Route
          path="xe-lien-tinh"
          element={<SeoHubPage hubType="inter-province" />}
        />

        <Route
          path="tp-hcm-di-cac-tinh"
          element={<SeoHubPage hubType="from-hcm" />}
        />

        <Route
          path="cac-tinh-di-tp-hcm"
          element={<SeoHubPage hubType="to-hcm" />}
        />

        <Route
          path="thue-xe-di-tinh"
          element={<SeoHubPage hubType="rental" />}
        />

        {/* ==================================================== */}
        {/* SEO HUBS THEO LOẠI XE */}
        {/* ==================================================== */}

        <Route path="xe-5-cho" element={<SeoHubPage hubType="car-5-seat" />} />

        <Route path="xe-7-cho" element={<SeoHubPage hubType="car-7-seat" />} />

        <Route
          path="xe-16-cho"
          element={<SeoHubPage hubType="car-16-seat" />}
        />

                {/* ==================================================== */}
        {/* SEO HUBS THEO NHU CẦU CHUYẾN ĐI */}
        {/* ==================================================== */}

        <Route
          path="xe-di-du-lich"
          element={<SeoHubPage hubType="tourism" />}
        />

        <Route
          path="xe-di-cong-tac"
          element={<SeoHubPage hubType="business" />}
        />

        <Route
          path="xe-dua-don-san-bay"
          element={<SeoHubPage hubType="airport" />}
        />

        <Route
          path="xe-dua-don-resort"
          element={<SeoHubPage hubType="resort" />}
        />

        {/* ==================================================== */}
        {/* SEO HUBS THEO TỈNH / ĐIỂM ĐẾN */}
        {/* ==================================================== */}

        <Route
          path="vung-tau"
          element={<SeoProvinceHubPage provinceKey="vung-tau" />}
        />

        <Route
          path="ho-tram"
          element={<SeoProvinceHubPage provinceKey="ho-tram" />}
        />

        <Route
          path="long-hai"
          element={<SeoProvinceHubPage provinceKey="long-hai" />}
        />

        <Route
          path="binh-chau"
          element={<SeoProvinceHubPage provinceKey="binh-chau" />}
        />

        <Route
          path="phan-thiet"
          element={<SeoProvinceHubPage provinceKey="phan-thiet" />}
        />

        <Route
          path="mui-ne"
          element={<SeoProvinceHubPage provinceKey="mui-ne" />}
        />

        <Route
          path="da-lat"
          element={<SeoProvinceHubPage provinceKey="da-lat" />}
        />

        <Route
          path="nha-trang"
          element={<SeoProvinceHubPage provinceKey="nha-trang" />}
        />

        <Route
          path="tay-ninh"
          element={<SeoProvinceHubPage provinceKey="tay-ninh" />}
        />

        <Route
          path="can-tho"
          element={<SeoProvinceHubPage provinceKey="can-tho" />}
        />

        <Route
          path="ben-tre"
          element={<SeoProvinceHubPage provinceKey="ben-tre" />}
        />

        <Route
          path="long-an"
          element={<SeoProvinceHubPage provinceKey="long-an" />}
        />

        <Route
          path="tien-giang"
          element={<SeoProvinceHubPage provinceKey="tien-giang" />}
        />

        <Route
          path="vinh-long"
          element={<SeoProvinceHubPage provinceKey="vinh-long" />}
        />

        <Route
          path="dong-thap"
          element={<SeoProvinceHubPage provinceKey="dong-thap" />}
        />

        <Route
          path="an-giang"
          element={<SeoProvinceHubPage provinceKey="an-giang" />}
        />

        <Route
          path="kien-giang"
          element={<SeoProvinceHubPage provinceKey="kien-giang" />}
        />

        {/* ==================================================== */}
        {/* CÁC TRANG SEO TUYẾN XE */}
        {/* ==================================================== */}

        {SEO_ROUTES.filter((route) => !SEO_HUB_PATHS.has(route.path)).map(
          (route) => (
            <Route
              key={route.key}
              path={route.path}
              element={<SeoRoutePage routeKey={route.key} />}
            />
          ),
        )}

        <Route path="dang-nhap" element={<CustomerAuth mode="login" />} />
        <Route path="dang-ky" element={<CustomerAuth mode="register" />} />

        <Route path="privacy-policy" element={<PrivacyPolicy />} />
      </Route>

      {/* ====================================================== */}
      {/* ADMIN LOGIN */}
      {/* ====================================================== */}

      <Route path="/admin/login" element={<AdminLogin />} />

      {/* ====================================================== */}
      {/* ADMIN PROTECTED */}
      {/* ====================================================== */}

      <Route
        path="/admin"
        element={
          <RequireAdmin>
            <AdminLayout />
          </RequireAdmin>
        }
      >
        <Route index element={<AdminHome />} />
        <Route path="pending" element={<AdminPendingTrips />} />
        <Route path="alerts" element={<AdminNotifications />} />

        <Route
          path="system-notifications"
          element={<AdminSystemNotifications />}
        />

        <Route path="trips/assigned" element={<AdminTripsAssigned />} />
        <Route path="drivers" element={<AdminDrivers />} />
        <Route path="users" element={<AdminCustomers />} />
        <Route path="trips" element={<AdminTrips />} />
        <Route path="config" element={<AdminConfig />} />
        <Route path="wallets" element={<AdminDriverWallets />} />
        <Route path="ledger" element={<AdminLedger />} />
        <Route path="feedback" element={<AdminFeedback />} />

        <Route path="cash-transactions" element={<AdminCashTransactions />} />
      </Route>

      <Route path="/admin/*" element={<Navigate to="/admin" replace />} />

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
