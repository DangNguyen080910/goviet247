# Day 312B — Số CCCD tài xế

- Driver Mobile mới: bắt buộc nhập CCCD gồm đúng 12 chữ số khi gửi hồ sơ; lưu dạng chuỗi để giữ số 0 đầu.
- Admin Web: hiển thị CCCD trong chi tiết tài xế; sửa qua Sửa thông tin, có lý do và lịch sử (che số, chỉ giữ 4 số cuối).
- Hồ sơ cũ: CCCD để trống, hiển thị Chưa cập nhật; Admin bổ sung sau đối chiếu giấy tờ.
- BE tạm nhận payload từ mobile cũ thiếu citizenId; nếu có gửi thì phải đúng 12 chữ số. Chưa bật bắt buộc toàn BE vì mobile chưa phát hành trước 31/10/2026.

## Deploy do Đ thực hiện

1. Backup DB theo quy trình hiện tại.
2. Trong apps/api, chạy `pnpm exec prisma migrate deploy` và `pnpm exec prisma generate` trước khi restart BE. Có migration destination_service đang nằm trong working tree: kiểm tra và triển khai cùng phần thay đổi đã chuẩn bị.
3. Build/deploy Web và restart BE theo quy trình hiện tại.
4. Trong Cấu hình, tắt hiển thị lựa chọn tiêu chuẩn/bao xe theo kế hoạch; kiểm tra đăng ký và đặt chuyến bằng mobile hiện hành.
5. Thử Admin: hồ sơ cũ hiện Chưa cập nhật, nhập CCCD bắt đầu bằng 0, lưu rồi mở lại; giá trị sai định dạng bị từ chối.
6. Khi phát hành Driver Mobile mới ngày 31/10, thử hồ sơ mới: thiếu/sai CCCD không gửi được, số đúng lưu và hiện ở Admin.

Chưa thay đổi cấu hình production, chưa deploy hoặc chạy migration trên DB.
