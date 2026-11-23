# Sửa phản hồi chậm, OTP và push — 23/11/2026

Mốc áp dụng: 0f8c03d (đã có bản sửa báo giá và duyệt chuyến). Không cần chạy lại bản sửa tổng hợp cũ.

## Kết quả
- Sáu hàm gửi push dùng chung chuyển sang ghi tác vụ NotificationJob thay vì giữ request trong lúc gửi Expo. Các luồng nhận/huỷ/trạng thái chuyến, tạo/huỷ chuyến Rider/Partner, rút tiền, hồ sơ, quản trị tài xế, thông báo hệ thống và góp ý đều được hưởng thay đổi này.
- Worker lấy tối đa 4 tác vụ/lượt, có lease, heartbeat và retry/backoff tối đa 8 lần. Lưu hash của token đã được Expo chấp nhận để bỏ qua khi retry. Kiểm tra lại quyền nhận, phiên thiết bị và nhóm tài xế tại lúc gửi. Tác vụ cuốc mới cũ bị bỏ nếu đã nhận/huỷ/đổi lần phát chuyến; push trạng thái Rider cũ cũng bị bỏ nếu trạng thái hoặc tài xế đã đổi.
- Bỏ chờ receipts 4 giây trên request; transport có timeout 15 giây, phân loại lỗi từng ticket, tách batch khác Expo project và xoá token không còn đăng ký. Log accepted/removed/skipped không đồng nhất với điện thoại thực sự đã nhận.
- Push chat và push thường của Admin dùng chung kiểm tra hạn, vai trò, is_active và adminAuthVersion. Phiên cũ bị thu hồi không tiếp tục nhận push chat.
- Rider Web giữ kết quả xác thực OTP, ưu tiên dùng user API verify-otp đã trả, không gọi lại verify khi getMe/tạo chuyến lỗi. Sau đăng nhập, đóng dialog OTP; giá hết hạn thì yêu cầu tính lại và xác nhận, không cần OTP mới. Nếu chỉ tải tài khoản lỗi, nút Tiếp tục vẫn dùng được khi mã OTP đã hết hạn nhưng đã xác thực thành công.
- JSON API trên các helper đã rà soát có deadline 25 giây, bao gồm đọc body; giữ HTTP status, không tự gửi lại thao tác ghi hoặc ép đăng xuất khi mất mạng. Ghi chú điều hành trước duyệt cũng có deadline. Driver vẫn giữ bước đối chiếu nhận chuyến sẵn có.
- Web/Rider Mobile có thể đối chiếu kết quả tạo chuyến qua GET /api/trips/booking-result?requestId=... khi mất phản hồi. Endpoint chỉ trả id/status của yêu cầu thuộc user hiện tại; không tạo lại chuyến hay gửi thêm SMS.

## Phạm vi giữ nguyên
Giá và cách tính tiền, hạn báo giá phía server, transaction/khoá ví, quyền duyệt/nhận/huỷ, thông tin liên hệ và cơ chế tạm nới hợp đồng Driver giữ nguyên. Payload cũ vẫn nhận được; app đang trên Store tiếp tục dùng được sau khi cập nhật API. Các thay đổi helper mobile chỉ có khi build bản mới.

## Áp dụng và deploy
1. Máy Đ: chạy ap_dung_sua_treo_otp_push_20261123.sh; script kiểm tra xung đột, sao lưu rồi áp mã. Script không tự commit/push, migrate, build hay deploy.
2. Commit/push theo quy trình hiện tại. Trên môi trường API đúng DATABASE_URL chạy:

```bash
pnpm --filter @goviet247/api exec prisma migrate deploy
pnpm --filter @goviet247/api exec prisma generate
```

Migration 20261123120000_notification_outbox chỉ tạo bảng NotificationJob và index, không sửa Trip/DriverWallet. Migrate deploy áp tất cả migration đang chờ; kiểm tra đúng môi trường. Dockerfile API hiện có đã chạy generate khi build và migrate deploy lúc khởi động; nếu dùng đúng quy trình đó thì các bước này được thực hiện tự động.

3. Khởi động API mới rồi build/deploy Web và Web Partner theo quy trình đang dùng. API trước Web. Không cần phát hành mobile ngay; các thay đổi mobile ở sẵn để build tháng 12.
4. Sau deploy kiểm tra tạo chuyến đã đăng nhập, khách qua OTP (gồm trường hợp giá hết hạn), duyệt/nhận/huỷ/đổi trạng thái và push trên điện thoại thật. Khi một thao tác ghi báo chưa xác nhận, kiểm tra Hoạt động/trạng thái trước khi thực hiện lại.

## Kiểm tra đã hoàn tất
- Toàn project: 859 ca, 808 đạt, 51 skip, không thất bại. Trong đó 1 ca PostgreSQL được chủ động tách khỏi suite offline và đã chạy riêng thành công.
- Nhóm DB/worker/phiên Admin/ticket push riêng: 7/7 đạt, gồm PostgreSQL 14 thật trên localhost, migration mới, hai worker đồng thời, retry sau khởi động lại, checkpoint token và lease cũ.
- Báo giá cũng được lưu/đọc bằng BookingQuote JSONB thật trong DB thử: thứ tự object thay đổi nhưng chữ ký phục vụ và miền vẫn xác nhận đúng, giữ nguyên giá đã cấp.
- Admin/Driver/Rider Mobile: TypeScript --noEmit đạt. Prisma schema validate đạt. Web và Web Partner build đạt, còn cảnh báo chunk lớn như trước.
- Không gửi SMS/push thật, không tạo cuốc hay thay đổi ví production. Chỉ tạo rồi xoá các DB thử riêng mang tiền tố goviet247_notification_test_ trên localhost. Prisma client thử được generate ở thư mục riêng rồi xoá, không thay client dùng chung của repository gốc.

## Giới hạn vận hành
- Ghi job nằm sau commit nghiệp vụ; việc gửi là at-least-once. Nếu tiến trình chết đúng giữa Expo chấp nhận và lưu checkpoint, một push có thể lặp. Không tuyên bố điện thoại nhận đúng một lần.
- Nếu chưa có bảng hoặc enqueue DB lỗi, API ghi log và gửi nền dự phòng để không báo sai thất bại cho nghiệp vụ đã lưu. Dự phòng theo tiến trình không bền qua restart; cần chạy migration để có retry bền vững. Worker đợi lại 30 giây khi DB lỗi, tránh vòng lỗi mỗi giây.
- Tác vụ hết hạn sau 24 giờ, tối đa 8 lần, bản ghi được dọn sau 7 ngày. lastError giữ tên/mã lỗi, không giữ token rõ.
- Chưa chạy binary Store/thiết bị thật hoặc deploy production. Kết quả test không thay cho kiểm tra thực tế sau release. Cảnh báo bundle lớn vẫn là việc tối ưu riêng.
