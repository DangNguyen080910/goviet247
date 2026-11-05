# Day 316 — Bật lại push chat Admin — 05/11/2026

Theo yêu cầu mới của Đ, khôi phục cách gửi push chat Admin/Staff GoViet247 như trước thay đổi ngày 04/11. Chỉ cập nhật local; Đ tự deploy.

## Thay đổi

- `apps/api/src/services/tripAcceptanceChat.js`: đưa Admin/Staff đang hoạt động vào danh sách người nhận chat push, giữ lọc bên gửi, quyền xem nội dung riêng và người tham gia đúng chuyến.
- `apps/api/src/services/tripChatService.js`: bỏ chặn `admin-*`, khôi phục chọn thiết bị Admin chưa hết hạn nhận push. Thiết bị khách/tài xế vẫn qua kiểm tra phiên như cũ.
- Khi Admin ở nền/đóng, tin mới đủ điều kiện được gửi qua Expo với `sound: default`, kênh `trip_chat_default_v1`. Điện thoại cần cho phép thông báo; âm lượng/quyền chạy nền vẫn do hệ điều hành quyết định.
- Giữ nguyên số chưa đọc, chuông trong app, giao diện mobile/web và thông báo ngoài chat. Không replay lại những tin đã được đánh dấu xử lý xong trong thời gian tắt push.

## Triển khai

Deploy hai file API trên và khởi động lại các tiến trình API/worker dùng code đó. Riêng việc bật lại push Admin **không cần build app Admin, triển khai web, migration hoặc cấu hình mới**. Đây là thay đổi khác với sửa tự đối chiếu chuyến Driver; phần Driver vẫn cần cập nhật app như tài liệu `day316-driver-available-reconcile-2026-11-05.md`.

Tài liệu tắt push ngày 04/11 đã được đánh dấu là lịch sử, thay bằng quyết định mới này. Chưa deploy máy chủ và chưa gửi push thật từ lần cập nhật local này.

## Kiểm tra

31/31 kiểm thử liên quan đạt; kiểm tra cú pháp hai file API và `git diff --check` đạt. Bao gồm Admin nhận lại push, không gửi lại sau khi hoàn tất, tin đã đọc không báo, phiên hết hạn không nhận, người gửi không tự nhận lại, Admin khác và khách/tài xế vẫn nhận, giữ quyền riêng tư và chuông trong app.

```sh
node --test tests/chat-admin-push.test.mjs tests/trip-acceptance-chat.test.mjs tests/chat-alert-sound.test.cjs tests/chat-push-session-expiry.test.mjs tests/chat-push-transport.test.mjs
```
