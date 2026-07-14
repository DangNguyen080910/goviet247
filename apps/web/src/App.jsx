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
        {/* CÁC TRANG SEO TUYẾN XE */}
        {/* ==================================================== */}

        {SEO_ROUTES.filter(
          (route) => !SEO_HUB_PATHS.has(route.path),
        ).map((route) => (
          <Route
            key={route.key}
            path={route.path}
            element={<SeoRoutePage routeKey={route.key} />}
          />
        ))}

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

        <Route
          path="cash-transactions"
          element={<AdminCashTransactions />}
        />
      </Route>

      <Route path="/admin/*" element={<Navigate to="/admin" replace />} />

      <Route path="*" element={<div>Không tìm thấy trang</div>} />
    </Routes>
  );
}