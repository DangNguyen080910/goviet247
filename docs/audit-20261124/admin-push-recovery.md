# Khôi phục push Admin — 24/11/2026

## Lỗi đã tái hiện

Bộ lọc push yêu cầu hạn phiên `pushExpiresAt` và phiên Admin hợp lệ. Luồng đăng ký Admin trước đây không lưu hạn phiên, nên thiết bị có thể bị bỏ qua. Commit `ffa4363` đã bổ sung hạn phiên từ JWT trên server; bản vá này giữ nguyên thay đổi đó. Thiết bị đã lưu trước đó vẫn cần đăng ký lại.

Admin Mobile trên Store đăng ký push khi khởi động/đăng nhập, chưa đăng ký lại mỗi lần từ nền trở về. Tắt hẳn rồi mở lại app sẽ đăng ký lại nếu phiên đăng nhập còn hợp lệ và đã cho phép thông báo. Không cần đăng xuất hoặc OTP. Nếu app thực sự yêu cầu đăng nhập, dùng tài khoản/mật khẩu Admin.

Ngoài ra, hàng đợi từng đánh dấu hoàn thành khi không tìm được thiết bị hợp lệ, dù chưa gửi push.

## Bản vá

- Không có thiết bị Admin hợp lệ: giữ lỗi có thể thử lại thay vì báo đã gửi.
- Sau khi đăng ký thành công bằng JWT Admin hợp lệ: đánh thức thông báo tạo chuyến trong hai giờ gần nhất, chưa gửi tới thiết bị nào, chuyến vẫn chờ duyệt. Không phát lại chuyến đã duyệt/huỷ hoặc thông báo đã được Expo chấp nhận.
- Kiểm tra lại trạng thái chuyến trước khi gửi để bỏ thông báo chờ duyệt đã hết hiệu lực.
- Giữ kiểm tra hạn phiên, phiên bản xác thực và trạng thái Admin. Không tự gia hạn phiên cũ, không dùng hạn phiên do client gửi.

## Áp dụng

Áp dụng script `ap_dung_hotfix_push_admin_20261124.sh`, kiểm tra diff, commit/push/deploy API theo quy trình hiện tại. Không có migration mới; không cần build Web hay Mobile cho bản vá này. Cần migration hàng đợi `20261123120000_notification_outbox` đã triển khai trong bản trước.

Sau khi API mới chạy, tắt hẳn và mở lại Admin Mobile một lần để thiết bị đăng ký lại. Quan sát một yêu cầu đặt xe thực tế tiếp theo khi đang mở app và khi khoá màn hình. Không tạo chuyến giả hoặc gửi hàng loạt thông báo để thử.

Nếu vẫn chưa có push, script `kiem_tra_push_admin_20261124.sh` đọc tổng số thiết bị đủ điều kiện và trạng thái mười job Admin gần nhất; chỉ đọc DB, không in token/mật khẩu/thông tin khách. Chạy tại môi trường có thể kết nối DATABASE_URL của API và có psql.

## Kiểm thử và giới hạn

- Toàn bộ bộ kiểm tra: 863 mục, 811 đạt, 52 bỏ qua theo điều kiện môi trường, 0 lỗi.
- Kiểm tra tập trung đăng ký thiết bị/hàng đợi/HTTP: 14/14 đạt.
- PostgreSQL 14 riêng: 1/1 đạt, gồm không phát lại job đã gửi, chuyến đã duyệt/huỷ, job cũ hoặc đang được xử lý; đăng ký lặp không đánh thức lặp cùng job.
- Installer được kiểm tra trước áp dụng, áp dụng trên clone riêng và chạy lại không thay đổi thêm.
- Chưa xác minh thiết bị/DB production hoặc nhận push thật trên máy Đ. Môi trường kiểm tra không phân giải được hostname RDS production; kết quả kiểm thử không chứng minh thông báo đã về điện thoại.
