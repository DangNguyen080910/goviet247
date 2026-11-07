# Thông báo chuyến và chuyển đến chuyến vừa đặt — 07/11/2026

- Tin nhắn hệ thống khi đặt/nhận chuyến hướng dẫn mở **Liên hệ chuyến**. Khách đặt dùm chỉ được hướng dẫn gọi đối với người trực tiếp đi; chuyến đối tác hướng dẫn tài xế gọi điều phối viên phụ trách.
- API dùng chung nội dung thông báo trong app và push cho duyệt, nhận, liên hệ, bắt đầu, hoàn thành, hủy. Rider web dùng cùng nội dung khi cập nhật trực tiếp, tránh báo nhận chuyến lần nữa ở trạng thái CONTACTED.
- Nút gọi app Driver/Rider và web có nhãn nhỏ luôn hiện: **Gọi khách**, **Gọi tài xế**, **Gọi điều phối**, theo người nhận API cho phép. Quyền gọi không đổi.
- Rider mobile đã chuyển/focus sau đặt xe. Rider web nay chuyển ngay đến lịch sử, cuộn và làm nổi bật đúng chuyến; Partner web mở chi tiết chuyến vừa tạo, không phụ thuộc trang danh sách. Đặt chuyến trong Admin giữ công ty đang chọn và mở chuyến mới.
- Tin nhắn đã lưu trước đây giữ nguyên. Không đổi quy trình xác nhận bằng chứng/Zalo hay các thông báo tài chính.

## Kiểm tra

52 trường hợp kiểm tra liên quan đã qua; TypeScript Driver/Rider đã qua; web Rider/Partner build thành công. ESLint còn cảnh báo hook sẵn có trong BookingCard/CustomerProfile.

## Đưa lên hệ thống

Đây là thay đổi local. Cần deploy API + hai web, phát hành bản Driver/Rider mới để có nhãn nút gọi và câu hướng dẫn mobile. Riêng thay đổi nội dung/focus này không thêm migration hoặc biến môi trường; các migration/env của tính năng gọi đã chuẩn bị trước đó vẫn cần khi triển khai tính năng gọi lần đầu.
