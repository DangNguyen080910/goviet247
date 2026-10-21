# Sửa hồ sơ tài xế từ Admin web

## Sử dụng

1. Quản lý tài xế → bấm vào tài xế.
2. Tab Thông tin → Sửa thông tin: họ tên, tên hiển thị tài khoản, SĐT, tỉnh/thành, xác nhận khu vực, loại xe, hãng, model, đời xe, biển số.
3. Cùng tab có danh sách ngân hàng, Sửa tài khoản và Thêm tài khoản ngân hàng.
4. Tab Giấy tờ → Thay ảnh giấy tờ hoặc Bổ sung giấy tờ còn thiếu. Nhận JPG/PNG/WebP, tối đa 20MB, có xem trước ảnh.
5. Mỗi lần lưu bắt buộc ghi lý do; xem tại tab Lịch sử → Sửa thông tin tài xế.

## Quy tắc

- Chỉ ADMIN được sửa; STAFF vẫn chỉ xem qua các API đọc hiện có.
- API chỉ nhận các trường hồ sơ được liệt kê, không cho ghi tuỳ ý số dư ví, trạng thái duyệt hoặc trường nội bộ qua form này.
- Sửa từng trường đã đổi; hồ sơ nhập thiếu cũ không bị buộc phải điền lại mọi trường khi chỉ sửa một mục.
- Đổi SĐT chuẩn hoá +84, kiểm tra trùng và đặt trạng thái chưa xác thực. OTP đang chờ của số cũ hết hiệu lực. Không tự gộp tài khoản, không chuyển số đã tồn tại từ hồ sơ khác sang.
- Đây là chỉnh SĐT gắn với tài khoản, không chỉ một số liên hệ rời. Tài khoản có thể dùng cả hai vai trò tài xế/khách hàng; các phiên đang đăng nhập không bị tự đăng xuất bởi thao tác sửa.
- Kiểm tra biển số đã chuẩn hoá so với hồ sơ chờ duyệt/đã duyệt của người khác. Năm xe 1980 tới năm hiện tại +1; tỉnh/thành theo danh mục của hệ thống.
- Ngăn ghi đè hồ sơ hoặc tài khoản ngân hàng đã đổi kể từ khi mở form; cần mở lại chi tiết khi có xung đột.
- Nếu ngân hàng đã gắn với yêu cầu rút ví, sửa thông tin nhận tiền sẽ tạo bản mới và lưu trữ bản cũ bằng archivedAt. Yêu cầu/lịch sử rút ví vẫn trỏ tới bản cũ. Tài khoản cũ không còn xuất hiện trong danh sách để tạo yêu cầu mới.
- Nếu có yêu cầu PENDING/APPROVED còn dùng ngân hàng cũ, màn hình cảnh báo để admin kiểm tra riêng trước khi chi. Không tự đổi đích nhận tiền của yêu cầu đã tạo.
- Đổi ảnh giữ nguyên loại giấy tờ, đặt trạng thái UPLOADED, xoá dấu duyệt giấy tờ cũ. Giữ ảnh cũ trên S3 và mã đối tượng trong lịch sử để đối chiếu; không tự thay đổi trạng thái KYC toàn hồ sơ hoặc dừng chuyến đang chạy.
- Email và số CCCD dạng văn bản chưa có trường riêng trong cấu trúc hồ sơ hiện tại; không bổ sung bằng cách đoán dữ liệu từ ảnh. Họ tên/tên hiển thị vẫn chỉnh sửa được. Màn hình sửa hiển thị các trường thực sự đang lưu.

## Cập nhật máy chủ

Đưa đầy đủ mã và migration mới lên máy chủ; dùng biến môi trường DB hiện tại. Từ thư mục apps/api:

```sh
pnpm exec prisma migrate deploy --schema prisma/schema.prisma
pnpm exec prisma generate --schema prisma/schema.prisma
```

Migration thêm enum EDIT_PROFILE và cột DriverBankAccount.archivedAt nullable. Chạy cả hai bước thành công trước khi khởi động API mới. Sau đó build/cập nhật web theo quy trình đang dùng. Không cần thư viện mới.

Tính năng giao diện được thêm vào Admin web. Driver app nhận thông tin sửa từ API khi tải lại hồ sơ. Chưa thêm màn hình sửa tương ứng vào Admin Mobile trong đợt này.

## Kiểm tra đã thực hiện

Kiểm tra cú pháp, cấu trúc Prisma và build web. Chưa thử ghi dữ liệu thật, tải ảnh lên S3 hoặc thực hiện yêu cầu rút tiền trên máy chủ.
