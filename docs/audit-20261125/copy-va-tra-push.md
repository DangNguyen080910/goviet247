# Mã chuyến / Copy và tra push Admin — 25/11/2026

## Copy nằm cạnh mã chuyến

Tạo cụm TripCode dùng lại mã chuyến đầy đủ và nút Copy hiện có. Mã dài có thể xuống dòng trong phần chữ; nút Copy cùng cụm, không bị đặt trong nhóm Liên hệ / Lịch sử / các thao tác khác. Giữ nguyên mã khi sao chép, bao gồm chữ hoa/thường; nút không kích hoạt thao tác của thẻ bên ngoài.

- Admin Web: đầu chi tiết chuyến theo ảnh báo lỗi, bảng chờ duyệt/chưa có tài xế/đã nhận/cảnh báo, lịch sử chuyến, ví, sổ sách, hoa hồng, góp ý, lịch sử tính giá, thông báo và hội thoại Admin.
- Admin Mobile: các thẻ/chi tiết chuyến, ví, hoa hồng, góp ý, cảnh báo, lịch sử, thông tin xe, gợi ý chuyến khi duyệt và hội thoại Admin.
- Form nhập mã chuyến trên Web đặt Copy ở cạnh phải ô nhập. Các hành động xem chuyến hoặc mở hội thoại giữ nguyên.
- Phần chat dùng chung có renderer riêng cho Admin; cách hiển thị Rider/Driver giữ nguyên.

Áp dụng `ap_dung_copy_ma_chuyen_admin_20261125.sh`, kiểm tra diff và commit/push. Build/deploy Web để thấy thay đổi trên trình duyệt. Build/phát hành Admin Mobile trong tháng 12 để thấy thay đổi trong app. Bản giao diện này không cần deploy API hoặc chạy migration.

Kiểm tra: build Web đạt; TypeScript Admin Mobile đạt; 878 mục trong bộ kiểm tra dự án, 826 đạt, 52 bỏ qua theo điều kiện môi trường, 0 lỗi. 18 kiểm tra tập trung về sao chép, hội thoại và modal xe đạt. Chưa thử giao diện trên điện thoại thật. Installer kiểm tra hash trước/sau, có sao lưu và chạy lại không chèn trùng.

## Tra sự cố push chuyến cmwv09rbg01endca74q8cc2x9

Bản sửa push trước đã có trong source hiện tại (commit 7cd86b0): lưu hạn phiên từ JWT, thử lại khi chưa có thiết bị hợp lệ và khôi phục một số job chưa gửi khi Admin đăng ký lại thiết bị. Chưa có dữ liệu production của sự cố này để kết luận nguyên nhân hoặc xác nhận bản API đang chạy.

Đã thử kết nối production bằng lệnh chỉ đọc nhưng môi trường công cụ không phân giải được hostname RDS. Không thay đổi thêm logic push dựa trên suy đoán.

Lệnh `kiem_tra_push_chuyen_20261125.sh` (bản trong repository: `scripts/diagnose-admin-trip-push.sh`) chỉ đọc DB trong `apps/api/.env`. Cách chạy:

```bash
bash scripts/diagnose-admin-trip-push.sh cmwv09rbg01endca74q8cc2x9 /duong/dan/goviet247
```

Cần Python 3 và psql tại môi trường có thể kết nối DB. Script ép chế độ transaction chỉ đọc, giới hạn thời gian truy vấn, kiểm tra mã chuyến, không gửi thông báo và không in token, mật khẩu, tên, SĐT hoặc địa chỉ khách.

| Trường kết quả | Ý nghĩa |
|---|---|
| trip | Mốc tạo/duyệt/huỷ và trạng thái của đúng chuyến |
| notification_table_exists | Có bảng hàng đợi thông báo hay chưa |
| admin_devices_now | Tổng thiết bị và điều kiện phiên hiện tại; không phải trạng thái tại lúc xảy ra sự cố |
| trip_admin_push_jobs | Job của đúng chuyến, số lần thử, mốc xử lý và mã lỗi |
| checkpointed_devices | Thiết bị đã được đánh dấu xử lý; có thể là Expo chấp nhận hoặc token đã bị loại, không chứng minh điện thoại đã hiện thông báo |

Job được dọn sau bảy ngày theo worker hiện tại, nên không tìm thấy job cũ không đủ để kết luận chưa từng gửi. Mã hiện tại chưa lưu đầy đủ Expo ticket/receipt để xác minh việc hệ điều hành thực sự hiển thị.

Đã thử script bằng PostgreSQL riêng với thiết bị hợp lệ/thiếu hạn phiên và job đúng chuyến: truy vấn và lọc đạt, đầu ra không lộ token/hash. DB thử đã được xoá. Cần kết quả JSON production hoặc log máy chủ để tiếp tục chẩn đoán sự cố thật.
