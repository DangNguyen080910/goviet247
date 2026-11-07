# Sửa các vấn đề rà soát luồng — 07/11/2026

Bản sửa nằm ở local; chưa triển khai server, chưa chạy migration trên cơ sở dữ liệu, chưa gửi thông báo/gọi thật.

## Những điểm đã sửa

1. Lịch sử cuộc gọi được tạo tại thời điểm kết thúc, để polling, chưa đọc và push nhận ra ngay. `historyAt` riêng giữ phạm vi lịch sử theo lượt phân công; cuộc gọi của lượt cũ không lọt sang khách/tài xế mới.
2. Worker kiểm tra lại trạng thái và thời hạn sau khi khoá bản ghi, tránh kết thúc cuộc gọi vừa được nghe máy.
3. Chuông gọi đọc hết các trang cuộc gọi đang đổ chuông; cuộc gọi thứ 51 không bị bỏ đói bởi 50 cuộc trước. Giữ outbox chống gửi lặp.
4. Tách hàng đợi cuộc gọi đang hoạt động và xử lý ghi âm; mỗi hàng đợi luân phiên trang riêng để các ghi âm chưa xử lý không chặn cuộc gọi mới.
5. Trang chủ admin web trỏ đúng trang chờ duyệt, chưa có tài xế và cảnh báo theo route hiện có.
6. Thông báo admin mobile mang mã chuyến đến màn hình chi tiết, kể cả chuyến vừa trả về chờ duyệt.
7. Thông báo khách web có nút Xem chuyến, nhận cả mã chuyến từ thông báo cũ dạng `[tripId:...]`.
8. Editor ghi chú đăng ký cổng lưu trước khi duyệt/đóng chi tiết trên web và mobile. Lưu thất bại giữ màn hình, không tiếp tục duyệt. Gửi đồng thời dùng chung tác vụ lưu. Điều hướng từ chi tiết sang chat chờ lưu xong.
9. Người trực tiếp tham gia cuộc gọi được giải thích khi chưa gọi được; người đặt dùm/quản lý không có nút gọi vượt quyền. Trình duyệt không hỗ trợ được hướng dẫn dùng app.
10. API trả danh sách mã tin đã xoá trong phạm vi người xem. Client xoá nội dung trên cả trang lịch sử đã tải, đóng ảnh và dừng âm thanh liên quan khi nhận cập nhật.
11. Mỗi lần nhận chuyến có `walletHoldId` riêng cho ba khoản giữ/hoàn. Nhận lại cùng chuyến không lẫn lần trước. Giao dịch cộng thủ công cùng lượt vẫn chặn hoàn tự động. Dữ liệu cũ chưa có mã lượt tiếp tục kiểm tra nghiêm ngặt; trường hợp mơ hồ cần đối soát.
12. Worker push xử lý tối đa 200 tin/lượt với 8 luồng, giữ claim và xác nhận từng thiết bị để tránh gửi lại tin đã nhận.
13. Thông báo tài xế trả chuyến nói rõ đang tìm tài xế thay thế.
14. Thông báo hủy dành cho khách không còn khiến khách hiểu nhầm khoản hoàn ví tài xế là tiền hoàn cho khách.
15. Chat đã kết thúc có đường mở Zalo hỗ trợ, đọc số chính thức từ cấu hình hiện có, không đoán số.
16. Khi trả chuyến, lưu dấu kết thúc lượt tài xế trong chat chỉ Admin thấy, không phát push; Admin vẫn giữ lịch sử.

## Kiểm tra

- Bộ Node 24: 548 bài; 499 đạt, 0 lỗi, 49 bỏ qua vì cần môi trường tích hợp.
- Bài tái hiện mới: vừa nghe máy lúc worker hết chuông; timestamp và phạm vi lịch sử cuộc gọi; hàng đợi độc lập; gửi chuông đến cuộc thứ 51 và chống lặp; hoàn ví đúng lượt và chặn hoàn lần hai; chờ lưu ghi chú và lan truyền lỗi.
- TypeScript admin/driver/rider mobile qua; Prisma validate và generate qua; build web và web-partners qua.
- Chưa kiểm thử gọi/chuông nền trên thiết bị thật hoặc giao dịch đồng thời trên PostgreSQL thật. Các bài tích hợp bị bỏ qua không được xem là đã xác nhận hoạt động trên server.

## Triển khai (Đ thực hiện)

1. Sao lưu DB theo quy trình hiện tại, cập nhật đầy đủ code và dependencies.
2. Tại thư mục repo server chạy `pnpm --filter @goviet247/api prisma migrate deploy`, sau đó `pnpm --filter @goviet247/api prisma generate`.
3. Hai migration mới của đợt sửa: `20261107050000_call_summary_history` và `20261107051000_wallet_assignment_scope`. Migration trước đó chưa triển khai cũng phải được áp dụng theo thứ tự; không dùng `migrate dev` trên production.
4. Khởi động lại API sau migration, triển khai bản web/web-partners mới và phát hành bản app mobile mới để nhận sửa giao diện/điều hướng. Chỉ cập nhật API không đưa sửa client vào app cũ.
5. Đợt sửa này không thêm biến `.env`. Các biến cuộc gọi/ghi âm/APNs và cấu hình hỗ trợ từ các bước trước vẫn cần đủ.
6. Thử trên iPhone TestFlight và Android nội bộ: cuộc gọi thành công, từ chối, không nghe máy, app nền; bấm thông báo đến đúng chuyến/tin; nhận chuyến biến mất ở máy tài xế khác; trả chuyến hoàn ví và nhận lại; ghi chú nhập rồi duyệt; xoá ảnh/ghi âm ở trang lịch sử đang mở trên máy kia.
