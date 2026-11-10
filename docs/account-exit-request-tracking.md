# Theo dõi yêu cầu xóa và đăng nhập lại

Admin Web có cột “Yêu cầu xóa / Đăng nhập lại” trong Tài Xế và Khách Hàng.

- Ghi khi người dùng xác nhận nút xóa và API xử lý thành công; không ghi chỉ mở hộp thoại hoặc hủy.
- Giữ hồ sơ, số điện thoại, vai trò, ví và chuyến. Giữ nguyên hành vi thu hồi phiên/thiết bị của endpoint cũ (hiện áp dụng toàn user, không riêng app).
- Marker riêng theo user + vai trò DRIVER/RIDER, lấy vai trò từ token đã xác thực. Đăng nhập OTP thành công chỉ cập nhật marker cùng vai trò.
- Lưu lần yêu cầu gần nhất, số lần yêu cầu và lần đăng nhập lại đầu tiên sau yêu cầu đó. Yêu cầu mới đặt lại trạng thái quay lại. Đây không phải lịch sử đầy đủ mọi sự kiện.
- Không có marker cũ để truy hồi trước thời điểm triển khai. Cột trống hiển thị dấu gạch, không khẳng định người đó chưa từng bấm trước đây.
- Trạng thái xuất hiện khi tải/làm mới danh sách Admin; không gửi push hoặc thông báo chủ động.
- Nội dung nút/hộp thoại trên Mobile được giữ nguyên theo phạm vi yêu cầu. Marker chỉ ghi nhận yêu cầu, không chứng minh dữ liệu đã xóa.

## Triển khai

Triển khai API và build/deploy Web. Không cần phát hành Rider/Driver Mobile hoặc thêm thư viện.

Cần chạy migration `20261110170000_account_exit_requests` trước khi khởi động API mới; tạo Prisma client sau cập nhật mã. Theo quy trình hiện tại, tại `apps/api` chạy `pnpm exec prisma migrate deploy`, `pnpm exec prisma generate`, rồi khởi động lại API. Migration chỉ thêm bảng và ràng buộc; không xóa hoặc chuyển dữ liệu tài khoản. Chưa chạy migration production trong công việc này.

## Kiểm tra

Kiểm thử riêng: vai trò từ token, tách hai vai trò cùng user, lần quay lại đầu tiên, yêu cầu lặp, sự kiện cũ không xóa trạng thái yêu cầu mới, đăng nhập thường không tạo marker. Schema validate và generate cục bộ; Web build đạt. Chưa thử với tài khoản thật trên production.
