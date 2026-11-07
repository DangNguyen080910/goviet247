# Huỷ tài xế, ghi chú duyệt và lịch sử hội thoại — 07/11/2026

## Thay đổi
- Admin web: mọi nơi dùng CancelTripDialog có thêm “Tài xế huỷ — hoàn ví, đưa về Chờ duyệt tìm tài xế khác (không phạt)”.
- Admin mobile: cùng lựa chọn trong Huỷ chuyến đã nhận. Chuyến chưa có tài xế không có khoản giữ để hoàn; chuyến đang thực hiện vẫn cần đối soát riêng.
- API nhận `cancel_origin=DRIVER`, `cancel_resolution=REFUND_AND_REVIEW`. Hoàn đúng các khoản giữ phí môi giới/VAT/PIT trong một giao dịch với việc gỡ tài xế; không tạo phạt. Khóa ví rồi khóa chuyến theo thứ tự nhận/huỷ chuyến. Yêu cầu lặp bị từ chối sau khi chuyến đã về PENDING.
- Tiếp tục chặn hoàn tự động nếu giao dịch giữ không khớp, đã hoàn thủ công hoặc cùng tài xế nhận lại nhiều lần khiến không xác định được khoản giữ; Admin cần đối soát ví trước.
- Ghi chú điều hành đã tồn tại, được đưa lên đầu chi tiết chuyến chờ duyệt ở Admin web/mobile. Bấm lưu ghi chú trước khi duyệt; khách không đọc được ghi chú này.
- Khi tài xế huỷ (tự huỷ hoặc Admin đưa về chờ duyệt), lưu mốc `Trip.chatVisibleFrom`. Khách/đối tác chỉ xem phần trao đổi từ mốc này; tài xế mới còn bị giới hạn từ thời điểm nhận chuyến. Admin giữ toàn bộ lịch sử theo quyền hiện có.
- Áp dụng giới hạn cho truy vấn hội thoại, tin nhắn, mốc phân trang, ảnh/âm thanh, thả tim, xoá và push gửi chậm. Link media đã cấp trước đó vẫn có thể dùng đến hết hạn ngắn 60 giây; không thể thu hồi nội dung người dùng đã đọc/chụp lại.
- Native và web loại phần lịch sử cũ khi poll nhận mốc mới, bỏ phản hồi cũ đến chậm. Không thể đảm bảo xoá màn hình từ xa khi thiết bị mất mạng; mở/tải lại dùng quyền API mới.
- Nhật ký cuộc gọi dùng thời điểm bắt đầu để cuộc gọi cũ kết thúc muộn không xuất hiện trong hội thoại của lần giao mới.

## Deploy (Đ thực hiện)
1. Đưa mã nguồn lên server như quy trình hiện tại.
2. Tại apps/api chạy Prisma migrate deploy rồi Prisma generate. Migration mới: `20261107040000_chat_assignment_history`. Migration bổ sung cột và lấy mốc từ nhật ký huỷ/đưa về chờ duyệt cũ; không xoá tin nhắn.
3. Restart API, cập nhật web/Rider web và web đối tác. Không cần thêm biến .env cho thay đổi này.
4. Build/cập nhật Admin mobile; cập nhật Rider/Driver mobile để màn hình đang mở cũng bỏ cache lịch sử cũ. API chặn đọc lại lịch sử cũ kể cả app chưa cập nhật.
5. Thử bằng chuyến test trước đón khách: tài xế A nhận, trao đổi, Admin hoàn ví/về chờ duyệt; kiểm tra đúng số tiền; tài xế B nhận; khách/đối tác/B không đọc được trao đổi cũ, Admin vẫn thấy. Thử bấm lại yêu cầu để chắc không hoàn lần hai.

## Kiểm tra local
- 55 kiểm thử hoàn ví/huỷ, phân trang, quyền lịch sử, push và cuộc gọi đã qua; 27 kiểm thử tích hợp cần DB riêng được bỏ qua.
- TypeScript Admin/Driver/Rider qua; Prisma validate và generate qua.
- Build web và web đối tác qua (cảnh báo kích thước bundle có sẵn).
- Chưa chạy migration server, chưa deploy và chưa xác nhận giao diện trên thiết bị thật.
