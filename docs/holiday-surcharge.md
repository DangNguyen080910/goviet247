# Phụ thu lễ, Tết

## Cấu hình

Trong Admin Web → Cấu hình → Giá cước, mỗi loại xe có một mục Phụ thu lễ, Tết ngay dưới phụ thu xe xăng:

- Phần trăm từ 0 đến 100, tối đa 2 chữ số thập phân. Mặc định 0, không thay đổi giá hiện có.
- Ngày bắt đầu/kết thúc có năm cụ thể, bao gồm cả hai ngày, theo Asia/Ho_Chi_Minh.
- Tên dịp lễ (100 ký tự) và ghi chú thêm (500 ký tự), không bắt buộc.
- Nội dung ngày được sinh tự động từ hai ô ngày; không phải nhập lặp lại trong ghi chú.

Một khoảng ngày cho mỗi loại xe; không tự lặp mỗi năm. Có thể cấu hình trước lễ: khách đặt hôm nay cho chuyến khởi hành trong khoảng đó được áp dụng ngay. Chuyến khởi hành ngoài khoảng không có phụ thu. Chuyến khứ hồi xét ngày khởi hành ban đầu, không xét riêng ngày về. Tắt ngay bằng cách đặt 0%.

## Tính giá

Sau giá tối thiểu, phụ thu xe xăng và lễ cùng tính trên giá gốc trước phụ thu, mỗi khoản làm tròn đến đồng; tổng được làm tròn theo quy tắc 10.000 đ sẵn có. Không lấy giá đã gồm phụ thu xe xăng để tính phần trăm lễ.

Ví dụ giá gốc 500.000 đ + xe xăng 20% (100.000 đ) + lễ 20% (100.000 đ) = 700.000 đ.

Backend tính lại khi tạo chuyến. Trip lưu holidaySurcharge là snapshot phần trăm, số tiền, giá gốc, khoảng ngày, tên và ghi chú; không thay đổi chuyến cũ khi chỉnh cấu hình. Quy tắc phí/hoa hồng tài xế hiện có tiếp tục áp dụng trên giá chuyến; không có quy tắc mới phân bổ riêng toàn bộ phụ thu cho tài xế.

Rider Web và Rider mobile hiển thị dưới giá cuối, sau phụ thu xe xăng:

Đã gồm phụ thu lễ, Tết 20%: 100.000 đ
Áp dụng cho chuyến khởi hành từ 01/09/2026 đến hết 02/09/2026 nhân dịp Quốc khánh.

Mức không áp dụng trả về 0 và ẩn dòng. App cũ vẫn nhận tổng giá do server tính, nhưng cần bản Rider mới để thấy dòng giải thích riêng.

## Triển khai

Chưa triển khai production. Sau khi commit/push và pull trên server, trong apps/api chạy:

```sh
pnpm exec prisma migrate status
pnpm exec prisma migrate deploy
pnpm exec prisma generate
pm2 restart goviet247-prod-api --update-env
```

Migration mới: 20260908120000_holiday_surcharge. Cần backup database và kiểm tra danh sách migration đang chờ trước khi deploy; migrate deploy áp dụng tất cả migration đang chờ, kể cả migration phiên đăng nhập nếu chưa chạy.

Build/deploy Web để cập nhật cả Admin và Rider Web. Phát hành Rider mobile cho phần hiển thị. Không cần biến .env riêng cho phụ thu.

Kiểm thử tự động chạy `node --test tests/holiday-surcharge.test.mjs`, kiểm tra ranh giới ngày VN, khứ hồi, 0%, xe xăng/điện, giá tối thiểu, làm tròn, nội dung và validation API. Chưa chạy migration trên database production hay kiểm thử chuyến thật.
