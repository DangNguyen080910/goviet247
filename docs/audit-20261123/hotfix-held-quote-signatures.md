# Sửa từ chối nhầm báo giá khi tạo chuyến — 23/11/2026

## Nguyên nhân
Báo giá lưu snapshot và chữ ký SHA-256 vào BookingQuote. JSONB không giữ thứ tự khóa của object. Khi tạo chuyến, API băm lại JSON.stringify(snapshot đọc từ DB), khiến báo giá giữ nguyên nội dung bị báo “Điều kiện phục vụ đã thay đổi”. Kiểm tra giá theo miền cũng gặp cùng nguyên nhân.

## Thay đổi
Chỉ tại luồng tạo chuyến, đối chiếu chữ ký khách gửi với chữ ký do server đã cấp và lưu cùng snapshot; không băm lại object JSONB đã đổi thứ tự khóa. Báo giá tính mới vẫn dùng cách băm cũ. Không đổi tiền, TTL, cấu trúc payload, dữ liệu chuyến cũ hoặc yêu cầu OTP. Hai chữ ký lấy từ trusted.pricing của bookingQuotes, tuyệt đối không lấy chữ ký kỳ vọng từ req.body. Ràng buộc lộ trình, giờ, loại xe, nhiên liệu, ngày Bao xe, giá và hạn báo giá vẫn kiểm tra.

## Kiểm tra
- Trước sửa: 12/12 ca HTTP tính giá → lưu JSONB mô phỏng đổi thứ tự khóa → tạo chuyến báo 409, đúng lỗi khách.
- Sau sửa: 17/17 ca mới đạt; gồm một chiều/khứ hồi/Bao xe, miền 0%/10%, quoteToken của Web mới và quoteHistoryToken của app đã phát hành, app không có cả hai token, tạo lại không trùng chuyến.
- Các ca sửa giá, sửa chữ ký, đổi lịch trình/ngày Bao xe và báo giá hết hạn vẫn bị chặn.
- Nhóm kiểm tra đặt chuyến/giá/xác thực liên quan: 78/78 đạt.
- Chạy HTTP cục bộ với controller/router, pricing engine và createBookableTrip thật; DB là adapter thử có tái sắp xếp khóa JSONB. Không chạy ghi DB production, không gửi SMS, không tạo cuốc thật. PostgreSQL thử riêng không khởi tạo được do sandbox chặn shared memory. Không coi kiểm tra mô phỏng là bằng chứng prod đã hoạt động.

## Áp dụng
Chạy ap_dung_hotfix_dat_chuyen_20261123.sh tại máy Đ rồi commit/push/deploy API theo quy trình hiện có, khởi động lại API. Không cần migration, generate Prisma, build Web hoặc build mobile cho bản vá này. Cần kiểm tra một lượt đặt thực tế sau deploy mới xác nhận production đã phục hồi. Không chạy lại bản sửa tổng hợp cũ để áp bản vá này.
