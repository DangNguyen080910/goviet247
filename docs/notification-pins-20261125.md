# Ghim và thu gọn thông báo — 25/11/2026

## Hành vi

- Driver và Rider Web/Mobile: mặc định xem trước ba dòng, có Xem thêm / Thu gọn và Ghim / Bỏ ghim. Mở nội dung đã tải vẫn hoạt động khi mất mạng; nếu chưa lưu được lựa chọn lên server thì báo lỗi để người dùng biết.
- Thông báo ghim đứng trước, mỗi nhóm mới nhất trước. Giữ nguyên mã chuyến, nút sao chép và liên kết tới chuyến.
- Admin Web và màn mới Thông Báo Hệ Thống trên Admin Mobile: tạo thông báo, kích hoạt/tắt và đặt/bỏ ghim mặc định. Chỉ ADMIN được thay đổi; STAFF giữ quyền đọc API hiện tại.
- Người nhận có thể ghi đè ghim mặc định. Bỏ ghim riêng vẫn được tôn trọng kể cả khi Admin tắt rồi bật ghim lại. Ghim riêng vẫn tồn tại khi Admin bỏ ghim mặc định.
- Thu gọn chỉ cập nhật lựa chọn thu gọn, không vô tình ghi đè lựa chọn ghim mặc định. Các lựa chọn lưu theo tài khoản và thông báo, dùng chung giữa các thiết bị sau khi tải lại dữ liệu.
- Ghim/thu gọn không đổi trạng thái đã đọc, không tạo thông báo mới và không gửi thêm push. Luồng tạo thông báo có kích hoạt vẫn gửi push như trước.
- Lấy thêm tất cả thông báo ghim hợp lệ ngoài cửa sổ 50 thông báo mới; không cho thông báo cũ đã ghim bị trôi mất. Kiểm tra quyền xem trước khi lưu lựa chọn, kể cả thông báo liên quan tới người đi có số điện thoại đã xác minh.

## Triển khai

1. Chạy file áp dụng trên máy Mac, kiểm tra diff rồi commit/push theo quy trình dự án.
2. Trên server đã lấy mã mới, trong thư mục gốc `goviet247`, chạy trước khi khởi động API mới:

   ```bash
   pnpm --filter @goviet247/api exec prisma migrate deploy
   pnpm --filter @goviet247/api exec prisma generate
   ```

3. Khởi động lại API bằng quy trình triển khai hiện tại. Sau đó build/deploy Web. Không bật Web mới trước API mới và migration.
4. Build Driver, Rider, Admin Mobile trong đợt phát hành tháng 12. Bản Store cũ tiếp tục đọc API cùng cấu trúc `items`, không bị yêu cầu OTP mới bởi tính năng này; các nút mới cần binary mới.

Migration `20261125060000_notification_preferences` thêm cột `SystemNotification.isPinnedByDefault` mặc định false và bảng `SystemNotificationPreference`. Không thay đổi nội dung thông báo cũ hoặc các bản ghi đã đọc. Cần tạo Prisma Client mới. File áp dụng không tự chạy migration, push, gửi thông báo hay deploy production.

## Kiểm tra

- Kiểm tra TypeScript Driver, Rider, Admin Mobile và build Web.
- Kiểm tra luồng Admin ghim mặc định không gửi lại push, từ chối boolean sai kiểu, và tương thích request tạo cũ không có trường ghim.
- Kiểm tra quyền truy cập, thông báo ghim ngoài 50 bản ghi, bỏ ghim riêng, thu gọn độc lập, bảo toàn trạng thái đã đọc và API client dùng phiên đăng nhập sẵn có.
- Chạy migration từ schema cũ trong PostgreSQL cục bộ riêng, tạo Prisma Client riêng rồi kiểm tra bằng `scripts/test-notification-preferences-postgres.mjs`. Chỉ cho phép URL cơ sở dữ liệu local có tên bắt đầu `goviet247_notification_test_`; đã xoá DB thử sau kiểm tra. Không truy cập hoặc thay đổi DB production.

Chưa build binary iOS/Android hoặc kiểm tra trên thiết bị thật trong lượt này. Các app sẽ cần được thử lại sau khi build để xác nhận giao diện và thao tác cảm ứng.
