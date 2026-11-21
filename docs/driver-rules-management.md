# Quản lý quy định quy tắc tài xế

## Cách sử dụng

Trong **Cấu hình → Quy định quy tắc tài xế** (giữa Nạp ví tài xế và Cảnh báo):

1. Lần đầu đã có sẵn toàn bộ 4 nhóm, 37 mục từ app hiện tại, gồm hướng dẫn lỗi nhận chuyến, thời hạn liên hệ 15 phút và lưu ý giữ trạng thái đăng nhập.
2. Chọn nhóm để thêm, sửa, xoá hoặc sắp xếp mục; có thể thêm/xoá nhóm. Một dòng trống tách hai đoạn nội dung.
3. Nhập tóm tắt thay đổi, lưu nháp, xem trước toàn bộ rồi xác nhận rà soát.
4. Bấm Phát hành. Lưu nháp không làm thay đổi nội dung tài xế đang xem.
5. Tra cứu tài xế đã/chưa xác nhận và thời điểm xác nhận trong Lịch sử phát hành & xác nhận. Bản đang áp dụng và bản cũ không sửa trực tiếp; chỉnh sửa tạo một bản nháp mới.
6. Bỏ bản nháp không ảnh hưởng nội dung đã phát hành. Xoá mục ở bản mới không xoá mục tương ứng khỏi lịch sử cũ.

## Driver Mobile

- Dấu đỏ trên nút menu và dòng Quy định & quy tắc khi có bản đã phát hành chưa được xác nhận.
- Nhãn Mới cập nhật cho nhóm/mục khác với bản gần nhất mà chính tài xế đã xác nhận. Người chưa xác nhận lần nào được đánh dấu tất cả.
- Một xác nhận chung: “Tôi đã đọc và đồng ý tuân thủ…” cho toàn bộ phiên bản. Chạm ô, xác nhận trong hộp thoại; sau khi lưu thành công ô được giữ nguyên và không thể bỏ chọn.
- Khi Admin phát hành phiên bản mới, tài xế cần xác nhận bản mới. Lịch sử cũ vẫn còn.
- Cập nhật khi mở menu, quay lại app và định kỳ 60 giây khi app đang mở. Không gửi SMS/OTP để nhắc đọc.
- Khi mất mạng, vẫn đọc được nội dung đang lưu; không ghi nhận xác nhận mới khi chưa kết nối được. Không tự đăng xuất khi tải quy định lỗi.
- Có kiểm tra phiên bản và mã nội dung ở server: mở bản cũ rồi xác nhận sau một lần phát hành mới sẽ được yêu cầu tải lại, không ghi nhận nhầm bản mới.
- Chỉ nhắc đọc/xác nhận; không thêm điều kiện chặn nhận chuyến và không thay đổi luồng Hợp đồng tài xế.

## Triển khai

Chạy từ thư mục gốc repository theo quy trình deploy hiện tại:

```bash
pnpm --dir apps/api exec prisma migrate deploy
pnpm --dir apps/api exec prisma generate
```

Sau đó deploy API và Admin Web. Migration bổ sung hai bảng, không sửa dữ liệu chuyến hoặc ví. Các bản mobile cũ vẫn hoạt động theo cách cũ; cần cập nhật Driver Mobile một lần để có nội dung động, dấu đỏ và xác nhận. Có thể chuẩn bị API/Admin trước và cập nhật Driver vào tháng 12 như kế hoạch.

Lần đầu cần lưu nháp và phát hành trong Admin để bắt đầu yêu cầu xác nhận. Chưa phát hành thì app vẫn có nội dung tham khảo và chưa yêu cầu xác nhận.

Các lần thay đổi nội dung tiếp theo dùng Admin, không phải phát hành lại Driver Mobile. STAFF không có quyền sửa/phát hành hoặc xem danh sách xác nhận qua các API quản trị này.

## Kiểm tra

```bash
node --test tests/managed-driver-rules.test.mjs tests/managed-driver-rules.integration.test.mjs
```

Bộ integration cần PostgreSQL tạm riêng. Chỉ chạy với cơ sở dữ liệu `rules_test` ở `127.0.0.1`; không trỏ vào dữ liệu production. Cấp `DRIVER_RULES_TEST_DATABASE_URL` và `DRIVER_RULES_TEST_CLIENT` (đường dẫn Prisma Client được generate riêng từ schema mới). Áp dụng schema gốc và migration bổ sung vào cơ sở dữ liệu này trước khi chạy. Nếu không có các biến trên, bộ integration tự bỏ qua.

Đã kiểm tra schema Prisma, TypeScript Driver, build Admin Web, đóng gói Driver iOS và các kiểm tra logic bằng Node. Chưa chạy thử trên điện thoại thật hoặc migration trên PostgreSQL: môi trường hiện tại chặn shared memory khi khởi động PostgreSQL tạm và không có Docker daemon đang chạy.
