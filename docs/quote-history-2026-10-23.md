# Lịch sử tính giá — 23/10/2026

## Phạm vi

- Sidebar Admin web: **Lịch sử tính giá** (`/admin/quote-history`), chỉ ADMIN có quyền xem và bật/tắt. Các API cũng kiểm tra ADMIN.
- Ghi một dòng cho mỗi lần API `/api/pricing/quote` tính giá thành công. Không ghi lần nhập thiếu/sai hoặc tính giá thất bại. Không hồi dựng được lịch sử trước khi triển khai.
- Lưu ảnh chụp tại thời điểm tính giá: tên/SĐT được cung cấp, tài khoản nếu xác thực được, điểm đón, tối đa 20 điểm đến, giờ đón/về, loại xe/chuyến/nhiên liệu, km, phút lái và giá đã báo. Giá lịch sử không thay đổi khi cấu hình giá thay đổi.
- Tên và SĐT trong form có thể là của hành khách khác. Nhãn “Đã đăng nhập” chỉ xác thực tài khoản, không xác thực các thông tin khách nhập.
- Nguồn Web/Android/iOS do ứng dụng gửi, không phải thông tin kiểm chứng thiết bị. Client cũ vẫn tính giá được nhưng lịch sử có thể thiếu nguồn, địa chỉ và thông tin khách.

## Thống kê và bộ lọc

- Mặc định 7 ngày theo giờ Việt Nam. Lọc ngày (bao gồm ngày cuối), tên/SĐT/điểm đón/mã chuyến, loại xe và nguồn; 25 dòng mỗi trang, mới nhất trước.
- Tổng lượt, lượt hôm nay trong bộ lọc, số khách/thiết bị nhận diện, tài khoản đã đăng nhập và lượt liên kết đặt chuyến đều áp dụng cùng bộ lọc.
- Khách/thiết bị dùng mã băm từ tài khoản đã xác thực hoặc mã ngẫu nhiên được giữ trong trình duyệt/thiết bị. Không lưu IP hoặc token đăng nhập. Khách chưa có mã nhận diện không cộng vào số khách khác nhau.
- Đây là số ước tính: cùng người dùng nhiều thiết bị, xoá dữ liệu hoặc chuyển từ vãng lai sang đăng nhập có thể được tính thành nhiều mã. Một người tính giá nhiều lần vẫn có nhiều lượt.
- Liên kết đặt chuyến qua một token ngẫu nhiên chỉ trả cho client đã tính giá; DB chỉ lưu mã băm. Ghi nhận ở máy chủ sau khi tạo chuyến, chỉ một chuyến cho mỗi lần tính giá. Không đoán “đã đặt” dựa trên SĐT hoặc tuyến đường giống nhau.
- Tắt lịch sử vẫn cho phép liên kết các lần đã ghi với chuyến tạo sau đó; không tạo dòng lịch sử mới khi tắt.

## Vận hành

- Migration bật ghi mặc định. Công tắc lưu ở DB; mỗi yêu cầu đọc trạng thái, không có cache trạng thái cũ. Yêu cầu đang xử lý lúc tắt có thể hoàn tất ghi. Tắt không xoá dữ liệu cũ và không ảnh hưởng API tính giá.
- Lỗi ghi/liên kết không làm thất bại việc trả giá hay tạo chuyến. Tối đa 50 tác vụ ghi đồng thời trong một tiến trình; nếu vượt ngưỡng sẽ bỏ qua ghi để giảm tải.
- Chi tiết chỉ xem trong 90 ngày. API tự dọn tối đa 5.000 dòng hết hạn mỗi giờ, đợt đầu sau khi khởi động 60 giây. Đợt dọn vẫn chạy khi tắt ghi; dữ liệu hết hạn không hiển thị trong lúc chờ dọn.
- Không có push hoặc chuông cho mỗi lần tính giá. Có nút Làm mới, không tự polling liên tục.
- Không thêm dependency. Chưa chạy migration lên DB hoặc triển khai máy chủ, chưa thử luồng với dữ liệu thật.

## Đưa lên máy chủ

1. Cập nhật mã, giữ bản API đang chạy đến khi migration và Prisma Client hoàn tất.
2. Trong `apps/api`, chạy `pnpm exec prisma migrate deploy`, sau đó `pnpm exec prisma generate`.
3. Khởi động lại tiến trình API GoViet247 theo quy trình đang dùng.
4. Build và cập nhật Web. Phát hành Rider Mobile mới để gửi đủ dữ liệu và liên kết lượt tính giá với chuyến đặt. Không cần cập nhật Driver Mobile/Admin Mobile.
5. ADMIN vào Lịch sử tính giá để kiểm tra trạng thái bật/tắt và dữ liệu sau khi có lượt tính giá mới.

Migration: `20261023033000_quote_history`. Không sửa/xoá các bảng chuyến, ví hoặc khách hàng hiện có.
