# Phục vụ tại điểm đến — 25/10/2026

## Phạm vi

Admin Web có tab “Phục vụ tại điểm đến”, dùng chung cho mọi loại xe. Cấu hình bật/tắt, tên/nội dung, phạm vi, số lượt, giờ phục vụ, phụ phí và thông báo giá trọn gói. Các số trong nội dung lấy từ biến mẫu; không viết cứng số nếu muốn chúng thay đổi theo cấu hình.

Tiêu chuẩn mặc định: tối đa 3 lượt đi ăn khứ hồi/ngày, trong 5 km đường ô tô từ nơi lưu trú xác nhận, 07:00–21:00. Không cộng dồn, không bao gồm tham quan. Ngày đến/về chỉ hỗ trợ các bữa trong thời gian thực tế.

Bao xe: 800.000đ/ngày chọn, 30 km, tối đa 8 giờ trong 07:00–21:00. Khách chọn từng ngày; ngày không chọn dùng Tiêu chuẩn. Giao diện công bố chính xác khoảng phục vụ: bắt đầu lúc muộn hơn giữa giờ đến dự kiến và giờ mở phục vụ; kết thúc khi đủ giờ hoặc tới giờ về/đóng phục vụ. Ngày phục vụ ít giờ vẫn tính đủ phí/ngày và được ghi rõ trước đặt. Thời gian chờ, đi ăn nằm trong giờ Bao xe. Không phục vụ tách đoàn; thống nhất lịch và khoảng nghỉ với tài xế.

Nơi lưu trú là mốc riêng, mặc định gợi ý từ điểm cuối, cho khách xác nhận/sửa. Thêm điểm tham quan không thay mốc; thêm chặng đường ngoài phạm vi vào lộ trình trước khi tính giá. Phạm vi 5/30 km là điều kiện phục vụ, chưa có theo dõi GPS để tự chặn một yêu cầu di chuyển thực tế.

## Giá và thỏa thuận

1. Tính giá tuyến đường, phí nghỉ đêm như trước.
2. Trừ đúng khoảng giờ Bao xe đã chọn khỏi thời gian chờ tính phí, dùng hợp của các khoảng để không trừ lại phần nghỉ đêm. Sau đó áp dụng thời gian chờ miễn phí và bậc giá hiện có.
3. Áp dụng mức tối thiểu, phụ thu nhiên liệu/lễ và làm tròn như trước.
4. Cộng phí Bao xe theo ngày sau các phụ thu, không nhân phụ thu nhiên liệu/lễ thêm lên phí Bao xe; phí này giữ đúng mức Admin cấu hình.

Báo giá trả snapshot và chữ ký điều kiện; tạo chuyến tính lại từ cấu hình server, kiểm tra chữ ký và giá dự kiến. Nếu điều kiện/giá đổi thì yêu cầu tính giá lại. Server không tin phí hoặc quyền lợi gửi từ client. Tất cả chuyến mới lưu `Trip.destinationService`, gồm câu giá trọn gói. Rider Web/Mobile, Driver chờ nhận/đang chạy/lịch sử và Admin chi tiết dùng cùng snapshot. Chuyến cũ chưa có snapshot hiển thị thông báo giá trọn gói mặc định, không tự gán quyền lợi Bao xe.

Địa chỉ mốc phục vụ vẫn được che ở danh sách Driver trước nhận và lịch sử theo chính sách địa chỉ hiện tại. Các quyền lợi, ngày, giờ và tiền vẫn giữ nguyên.

## Cập nhật hệ thống

Mã nguồn đã thay đổi tại máy local. Chưa chạy migration lên DB hoặc triển khai production.

Migration: `20261025090000_destination_service` thêm hai cột JSONB nullable vào Trip và TripConfig. Chạy quy trình migration hiện có tại apps/api (`pnpm exec prisma migrate deploy`, sau đó `pnpm exec prisma generate`) trước khi khởi động API mới. Cần đưa API, Web và hai app Rider/Driver lên cùng đợt phát hành. Mặc định trong mã áp dụng khi cấu hình JSON chưa được lưu.

Nguồn quy tắc dùng chung đặt tại `apps/api/src/shared/destinationService.js` để Docker API hiện tại vẫn đóng gói độc lập được. Web/Mobile nhập qua `packages/shared` trong monorepo, không gọi trực tiếp dịch vụ tính giá từ client.

Các thao tác Admin điều chỉnh lịch trình/giá hiện có vẫn cần đối chiếu thỏa thuận đã lưu; chưa có giao diện sửa riêng các ngày Bao xe trên chuyến đã đặt. Khi khách thay đổi gói, cần xác nhận và báo giá lại trước thực hiện.

## Kiểm tra

- Test nghiệp vụ ngày phục vụ, phí cố định, trừ thời gian chờ, không trừ trùng nghỉ đêm, ngày không hợp lệ, cấu hình và thay đổi thỏa thuận.
- Các test cũ về giá lễ, thời gian Việt Nam, xe đang nhận đặt và báo giá trễ.
- Kiểm tra TypeScript Rider/Driver; build Web; đóng gói Expo iOS cả hai ứng dụng.
- Xem thử cấu hình bằng trình duyệt với dữ liệu giả; không gọi API thật hoặc tạo chuyến thật. Chưa kiểm thử chuyến thực trên thiết bị hoặc DB sau migration.


## Bổ sung đối chiếu trên Rider

Rider Mobile dùng màn hình “Hoạt động” (`app/trip-history.tsx`) cho cả chuyến đang theo dõi và lịch sử. Rider Web dùng danh sách “Lịch sử chuyến đi” trong tài khoản. Mỗi thẻ chuyến giữ phần thông tin gói đã lưu, gồm mốc phục vụ, quyền lợi, ngày/giờ Bao xe và phụ phí.

Cả hai thông báo giá trọn gói và thanh toán trực tiếp cho tài xế đều in đậm trong phần thông tin chung này. Câu thanh toán được cấu hình và lưu cùng thỏa thuận (`paymentNotice`), nên không thay đổi theo cấu hình mới khi khách xem lại. Chuyến cũ thiếu trường này dùng câu thanh toán mặc định; chuyến chưa có dữ liệu gói chỉ hiện thông báo chung, không tự gán quyền lợi Bao xe. Driver và phần xem trước của Admin sử dụng cùng nội dung. Phần báo giá Rider đã bỏ câu thanh toán cũ trùng lặp.

Không thêm migration cho thay đổi này vì trường mới nằm trong JSON đã có của tính năng. Vẫn giữ kế hoạch phát hành đồng thời Backend, Web và Mobile sau 31/10; chưa triển khai hệ thống thật.
