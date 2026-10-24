# Đánh dấu cảnh báo đã xem

- Thêm `AdminAlertLog.readAt` và `readBy`, lưu lần đầu một ADMIN/STAFF đánh dấu. Đây là trạng thái chung của đội quản trị, không phải trạng thái riêng từng tài khoản.
- `PATCH /api/admin/alerts/:id/read` yêu cầu ADMIN hoặc STAFF. Gọi lặp không thay đổi người/thời điểm đã xem đầu tiên. Không xoá cảnh báo, thay đổi chuyến hoặc mở khoá tài xế.
- Sidebar và chỉ số trang chủ dùng cùng `stats.recentAlertsCount`: số cảnh báo **chưa xem trong 24 giờ**, giữ nguyên khoảng thời gian đếm cũ.
- Bảng mặc định Chưa xem, có bộ lọc Đã xem/Tất cả. Bấm Đánh dấu đã xem không mở chi tiết chuyến. Sau thao tác thành công sẽ tải lại để đưa các cảnh báo chưa xem tiếp theo vào danh sách (mỗi lần tối đa 50 dòng).
- `admin:alerts_read` cập nhật im lặng các màn hình Admin web và số sidebar, không phát chuông hay tạo cảnh báo mới. Nếu mất socket, tab vừa bấm vẫn cập nhật qua sự kiện local; các tab khác cập nhật lại khi lấy dashboard định kỳ/focus.
- API dashboard đã đổi số đếm nên Admin Mobile nhận số mới khi tải lại; không sửa giao diện hay phát hành Admin Mobile trong đợt này.
- Bản ghi cũ có `readAt = null`; chỉ các bản ghi trong 24 giờ được tính vào badge. Không đánh dấu hàng loạt bản ghi cũ.

## Triển khai

Migration: `20261024081000_admin_alert_read`.

Trong `apps/api`, chạy `pnpm exec prisma migrate deploy`, rồi `pnpm exec prisma generate` **trước khi khởi động lại API mới**. Sau đó build/cập nhật Admin web.

Chưa chạy migration trên DB hoặc triển khai máy chủ. Chưa thử luồng trên dữ liệu thật.
