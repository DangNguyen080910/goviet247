# Admin web: loại xe và thông báo tài xế bị khoá bấm nhận chuyến

- Ba danh sách Chờ duyệt, Chưa có tài xế, Tài xế đã nhận hiển thị loại xe 5/7/16 chỗ, kể cả các tab trạng thái.
- Khi API từ chối nhận chuyến vì `tripAcceptBlocked`, sau khi giao dịch đã rollback, ghi cảnh báo và gửi sự kiện riêng `admin:blocked_trip_accept_attempt` tới phòng socket `admins`.
- Chỉ ghi cho chuyến PENDING đã duyệt, chưa bị huỷ, chưa có tài xế và thuộc phạm vi tài xế được thấy.
- Thông báo web hiển thị tên tài xế và mã chuyến, có âm thanh theo công tắc chuông hiện tại. “Xem ngay” mở chi tiết chuyến. Mục Cảnh báo lưu tên, mã hồ sơ tài xế và mã chuyến để tra cứu.
- Gộp các lần bấm cùng tài xế/cùng chuyến trong 30 giây. Bộ nhớ tạm có giới hạn; kiểm tra thêm lịch sử trong DB để giảm trùng giữa các tiến trình (không bảo đảm tuyệt đối khi nhiều tiến trình đồng thời).
- Thất bại gửi/lưu cảnh báo không thay đổi kết quả từ chối nhận chuyến. Không tự mở khoá, không giao chuyến, không trừ ví.
- Dùng bảng AdminAlertLog sẵn có, không có migration hoặc dependency mới. Cần cập nhật API và Admin web, rồi khởi động lại API. Không thay đổi Driver Mobile/Admin Mobile và không gửi push mới.
- Chưa triển khai lên máy chủ và chưa thử luồng với dữ liệu thật.
