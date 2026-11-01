# Ảnh trong hội thoại chuyến — 01/11/2026

## Phạm vi
- Rider/Driver/Admin Mobile: Chụp ảnh, Chọn ảnh, xem trước, gửi, ảnh thu nhỏ và mở ảnh lớn.
- Rider/Admin Web: chọn ảnh; camera điện thoại dùng trình chụp của hệ thống; máy tính dùng camera trình duyệt khi được cho phép.
- Admin xoá ảnh cùng cơ chế xoá tin nhắn, có nhật ký; worker dọn tệp trên S3.
- Push thông báo đã gửi hình ảnh. Không đưa ảnh hay đường dẫn ảnh vào nội dung push.
- Một ảnh/lần; JPEG/PNG/WebP, tối đa 10 MB; máy chủ giới hạn 40 megapixel, chuyển JPEG tối đa 1920px, bỏ EXIF/GPS. Không hỗ trợ video/GIF/SVG.
- Quyền truy cập như hội thoại hiện tại: chỉ người đặt, hành khách đã xác minh, tài xế được giao và Admin. Tài xế thay thế không được đọc ảnh trước thời điểm nhận. Rider mất quyền khi hoàn thành/huỷ.
- Kho S3 dùng lại TRIP_CHAT_AUDIO_BUCKET, kiểm tra chặn công khai và mã hoá AES256. URL xem ảnh có hiệu lực 60 giây; URL đã cấp có thể còn hiệu lực đến hết thời gian này sau khi thu hồi quyền. Ảnh đã tải/chụp màn hình không thể thu hồi.
- Chặn số điện thoại trong chữ không áp dụng cho chữ nằm trong ảnh (chưa có OCR).

## Deploy sau
1. Deploy BE với dependency sharp và chạy migration `20261101090000_trip_chat_images` bằng quy trình migrate deploy hiện có. Generate Prisma Client khi build.
2. Deploy Web.
3. Build lại Rider/Driver/Admin Mobile để áp dụng mô tả quyền camera/thư viện ảnh/microphone; gửi bản mới lên kênh tương ứng. Không chỉ cập nhật JavaScript.
4. App cũ nhận IMAGE dưới dạng thông báo chữ yêu cầu cập nhật, tránh rơi vào nhánh vị trí cũ. App mới gửi query `media=images` để nhận loại IMAGE.

## Kiểm tra trước phát hành
- Thử chụp/chọn ảnh thật trên iOS/Android, từ chối quyền camera, thử HEIC trên iPhone; thư viện chọn ảnh dùng chế độ compatible và quality 0.75.
- Thử gửi trên mạng yếu, gửi lại không trùng ảnh, xem ảnh lớn, xoá ảnh ở Admin và thông báo khi chạy nền.
- Kiểm thử tự động: xử lý ảnh thật, file giả/quá lớn, quyền truy cập HTTP, đổi tài xế, đóng chuyến khi đang upload, dọn ảnh khi xoá, tương thích client cũ.
- Kiểm tra TypeScript ba app, build Web, Expo autolink và cấu hình quyền trên cả hai nền tảng.
- Chưa deploy, chưa build bản native phát hành, chưa thử camera/notification trên điện thoại thật trong phiên này.
