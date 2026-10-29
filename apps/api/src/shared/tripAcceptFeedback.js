export function tripAcceptFeedback(error) {
  if (error?.code === "TRIP_ACCEPT_UNAVAILABLE") return null;
  const code = error?.code;
  if (code === "AUTH_REQUIRED" || error?.status === 401) return "Phiên đăng nhập đã hết hạn. Anh/chị vui lòng đăng nhập lại để nhận chuyến.";
  if (code === "NETWORK_UNCONFIRMED") return "Chưa xác nhận được kết quả nhận chuyến. Anh/chị kiểm tra Đơn của tôi trước khi thử lại.";
  const known = ["DRIVER_PROFILE_MISSING", "DRIVER_NOT_VERIFIED", "TRIP_NOT_FOUND", "TRIP_NOT_AVAILABLE", "TRIP_NOT_APPROVED", "TRIP_CANCELLED", "TRIP_ALREADY_ACCEPTED", "TRIP_ALREADY_YOURS", "TRIP_NOT_OPEN", "ACTIVE_TRIP_LIMIT", "INSUFFICIENT_BALANCE", "TRIP_CHANGED"];
  if (known.includes(code) && error?.message) return error.message;
  // Compatible with older backend responses, without exposing internal errors.
  const legacy = String(error?.message || "");
  if (legacy.includes("Số dư ví không đủ")) return legacy;
  if (legacy === "Chuyến đã có tài xế nhận") return "Chuyến này đã được tài xế khác nhận trước. Anh/chị vui lòng chọn chuyến khác.";
  if (legacy === "Chuyến đã bị huỷ") return "Chuyến này đã bị huỷ nên không thể nhận. Danh sách chuyến sẽ được cập nhật lại.";
  if (legacy.includes("token đăng nhập") || legacy === "Unauthorized") return "Phiên đăng nhập đã hết hạn. Anh/chị vui lòng đăng nhập lại để nhận chuyến.";
  return "Hệ thống chưa xử lý được yêu cầu. Anh/chị kiểm tra Đơn của tôi; nếu chưa có chuyến, vui lòng thử lại sau ít giây.";
}
