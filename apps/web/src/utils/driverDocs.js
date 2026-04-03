// Path: goviet247/apps/api/src/utils/driverDocs.js

export function docTypeLabel(type) {
  switch (type) {
    case "CCCD_FRONT":
      return "CCCD mặt trước";
    case "CCCD_BACK":
      return "CCCD mặt sau";
    case "PORTRAIT":
      return "Ảnh chân dung";
    case "DRIVER_LICENSE":
      return "Bằng lái";
    case "VEHICLE_REGISTRATION":
      return "Cà vẹt xe";
    default:
      return type || "-";
  }
}

export function docStatusLabel(status) {
  switch (status) {
    case "UPLOADED":
      return "Đã tải lên";
    case "APPROVED":
      return "Đã duyệt";
    case "REJECTED":
      return "Từ chối";
    default:
      return status || "-";
  }
}

export function docStatusColor(status) {
  switch (status) {
    case "UPLOADED":
      return "warning";
    case "APPROVED":
      return "success";
    case "REJECTED":
      return "error";
    default:
      return "default";
  }
}
