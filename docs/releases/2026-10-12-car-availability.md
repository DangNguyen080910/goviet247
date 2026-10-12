# Bật/tắt loại xe nhận đặt

## Sử dụng

Trong Admin → Cấu hình → Chuyến đi → Loại xe nhận đặt, tắt công tắc Xe 16 chỗ. Công tắc lưu ngay khi server xác nhận; không cần bấm Lưu cấu hình chuyến đi. Bật lại khi sẵn sàng phục vụ.

Công tắc dùng PricingConfig.isActive hiện có. Không cần migration. Tắt loại xe không xóa giá cước, phụ thu, hồ sơ tài xế hoặc thay đổi chuyến cũ. Giao diện Giá cước không còn công tắc trùng lặp; lưu giá cước không gửi isActive nên không ghi đè trạng thái nhận đặt.

## Đồng bộ và chặn đặt

- Web tải danh sách đang bật khi mở trang, quay lại cửa sổ/tab.
- Mobile tải khi mở/quay lại màn hình đặt xe và khi app trở lại foreground.
- Danh sách trống hoặc không tải được cấu hình không tự hiện lại danh sách mặc định. Màn hình báo tình trạng và ngừng báo giá/đặt mới.
- Xe đã chọn bị tắt: chọn lại xe đầu tiên còn bật, xóa báo giá theo luồng có sẵn khi lựa chọn thay đổi. Nếu không còn xe, không cho đặt.
- Server kiểm tra trạng thái khi tính giá và ngay trước khi ghi chuyến, kể cả OTP/báo giá cũ. Kiểm tra cuối dùng transaction và khóa chia sẻ hàng cấu hình, nên thao tác tắt và tạo chuyến đồng thời được xử lý theo thứ tự.
- Các bản Rider Mobile cũ còn có thể hiển thị danh sách cố định, nhưng API mới vẫn chặn báo giá/đặt loại xe đã tắt.

## Triển khai

Deploy API (kèm service carAvailability.js), web, rồi phát hành Rider Mobile mới. Không cần phát hành Driver Mobile cho thay đổi này. Chưa thay đổi trạng thái Xe 16 chỗ trên Prod hoặc deploy từ công việc này.

## Xác minh

Kiểm tra tự động sử dụng dữ liệu giả lập, không kết nối database thật: bật/tắt, giữ nguyên giá cước, danh sách trống/thiếu xe, báo giá xe tắt, kiểm tra cuối và OTP cũ. Biên dịch Rider Mobile TypeScript và build web. Chưa kiểm chứng transaction trên database thật hoặc thao tác trên điện thoại thật.
