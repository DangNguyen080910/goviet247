# Phụ thu nhiều đợt và thông báo tài xế — 12/10/2026

## Thay đổi

- Admin: tab Phụ thu lễ, Tết nằm giữa Giá cước và Chuyến đi. Mỗi loại xe có tối đa 100 đợt với tên, phần trăm, ngày áp dụng, ghi chú, bật/tắt. Lưu riêng theo loại xe; thêm/sửa/xóa chỉ áp dụng sau khi bấm Lưu phụ thu. Bản nháp giữ khi đổi tab.
- Chặn khoảng ngày trùng nhau giữa các đợt đang bật có phần trăm lớn hơn 0 cho cùng loại xe. Ngày đầu/cuối được tính, theo giờ Việt Nam; khứ hồi xét ngày khởi hành ban đầu. Phụ thu tính trên cùng giá gốc với xe xăng. Giá/snapshot của chuyến đã đặt giữ nguyên.
- Migration chuyển cấu hình lễ hiện tại thành đợt legacy; giữ các cột cũ để tương thích triển khai. Danh sách rỗng có nghĩa là không có phụ thu, không khôi phục giá trị cũ.
- Driver push: thiết bị gắn với phiên đăng nhập và hạn token. Gửi chuyến mới chỉ tới tài xế hồ sơ VERIFIED với phiên hợp lệ. Thiết bị cũ chưa có thông tin phiên tạm dừng push cho tới lần đăng ký thiết bị tiếp theo.
- Đăng xuất thu hồi phiên, ngắt socket của phiên, xóa thiết bị driver thuộc phiên đó. Những thiết bị khác với phiên riêng vẫn nhận bình thường. App xóa thông báo đã hiển thị/badge sau đăng xuất và chặn hiển thị foreground/điều hướng khi không có token.

## Triển khai

1. Áp dụng migration `20261012130000_holiday_periods_driver_push_sessions` vào database đích bằng quy trình Prisma migrate deploy của dự án. Migration này bắt buộc trước khi chạy API mới. Không chỉnh phụ thu bằng trang quản trị cũ trong lúc chuyển phiên bản.
2. Generate Prisma Client với schema mới và triển khai API (bao gồm service driverPushAccess.js), rồi triển khai web admin.
3. Phát hành Driver Mobile mới. Yêu cầu tài xế mở lại app để gắn thiết bị với phiên. App cũ vẫn đăng ký được qua API mới khi chạy bootstrap nhưng không có phần dọn thông báo và chặn foreground mới.
4. Không cần phát hành Rider Mobile chỉ để dùng danh sách phụ thu: cấu trúc snapshot phụ thu trả cho khách giữ nguyên.

Không có migration hoặc deploy nào đã được chạy lên Prod trong công việc này. Việc generate client chỉ thực hiện trên máy phát triển.

## Giới hạn xác minh

Đã kiểm tra cú pháp API, cấu trúc Prisma, biên dịch TypeScript Driver Mobile và build web admin. Chưa chạy kiểm thử chức năng, migration trên database hoặc nhận push trên thiết bị thật. Thông báo đã được gửi tới Expo/FCM/APNs trước lúc đăng xuất có thể vẫn đến sau đó; server ngừng các lần gửi mới theo phiên đã thu hồi.
