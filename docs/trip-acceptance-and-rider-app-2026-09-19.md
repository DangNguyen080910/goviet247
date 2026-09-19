# GoViet247 — nhận chuyến an toàn, khoá nhận chuyến và thống kê Rider app

Ngày: 19/09/2026. Đã sửa source local; chưa deploy, chưa chạy migration production, chưa build/publish bản native.

## Các thay đổi

- Nhận chuyến: khoá hàng DriverProfile trước rồi Trip trong transaction; kiểm tra cờ khoá, KYC, giới hạn chuyến, số dư và trạng thái chuyến mới nhất. Cập nhật chuyến có điều kiện, trừ ví và lưu lịch sử trong cùng transaction. Chỉ request thắng được nhận chuyến và giữ tiền.
- Admin > Tài xế > chi tiết: nút Khoá/Mở nhận chuyến, yêu cầu lý do nội bộ; chỉ ADMIN được đổi. Cờ độc lập với KYC, có lịch sử thao tác. Không phát thông báo cho tài xế. Bản mobile mới bỏ qua mã TRIP_ACCEPT_UNAVAILABLE; không chuyển tab, không báo thành công hay lỗi. Loading ngắn vẫn có thể xuất hiện.
- Khoá chỉ áp dụng lần nhận mới, không thu hồi chuyến đã nhận. Nếu nhận chuyến giữ lock trước thì có thể hoàn tất trước lệnh khoá; sau khi admin nhận phản hồi đã khoá, các lần nhận mới bị chặn.
- Rider web: bỏ nội dung xem trước trong menu tài khoản. Chỉ chấm đỏ khi chưa đọc; click Thông báo mới mở trang nội dung và đánh dấu đọc theo cơ chế hiện có.
- Admin > Khách hàng: cột Rider app, lọc Đã dùng app / Chưa ghi nhận / Android / iOS, thống kê toàn bộ kết quả tìm kiếm và lọc trạng thái/SĐT. Bộ lọc nền tảng chỉ lọc danh sách; các thẻ tổng hợp vẫn cho thấy cả các nhóm. Một khách có thể thuộc cả Android và iOS.
- RiderAppUsage lưu theo userId + platform, firstSeenAt/lastSeenAt. Migration lấy lịch sử từ Device có role RIDER và platform android/ios. Rider mới ghi nhận sau đăng nhập và khi getMe thành công, không phụ thuộc push permission. Backend tiếp tục ghi nhận từ đăng ký push của app cũ.
- Đây là bằng chứng đã sử dụng app, không phải danh sách hiện đang cài đặt. Chưa ghi nhận không chứng minh chưa cài; không phát hiện gỡ app hay cài nhưng chưa đăng nhập. Không đếm Driver app thành Rider app.

## Các lỗi liên quan đã xử lý

- Hai tài xế nhận cùng chuyến, hoặc một tài xế gửi nhiều lần vượt giới hạn chuyến.
- Huỷ chuyến đồng thời có thể lặp lịch sử phạt; nay đọc và cập nhật dưới lock, kiểm tra chủ chuyến/trạng thái.
- Admin sửa giá, trả về chờ duyệt, đổi giờ hoặc huỷ chuyến: khoá chuyến trước khi kiểm tra/cập nhật. Đổi trạng thái, duyệt và đẩy lại chuyến thêm điều kiện chống ghi đè trạng thái đã thay đổi.
- Nhận chuyến và rút tiền đồng thời có thể ghi đè số dư: luồng rút tiền dùng chung lock DriverProfile. Endpoint rút tiền cũ dùng chung luồng kiểm tra ngân hàng và giữ tiền, giữ alias `request` cho response cũ và điều kiện VERIFIED.
- Socket lỗi sau khi transaction nhận chuyến đã commit không còn làm API báo nhận thất bại.
- Đăng ký push token không còn ghi đè tên người dùng đã tồn tại thành "User". Không tự phục hồi các tên đã bị ghi đè trước đây vì không có nguồn dữ liệu chắc chắn.

## API và migration

- PATCH `/api/admin/drivers/:id/trip-acceptance` với `{ "blocked": true, "reason": "Lý do nội bộ" }`. `id` là DriverProfile.id. Boolean bắt buộc; lý do 1–500 ký tự. Cập nhật cùng giá trị là idempotent, không tạo thêm log.
- POST `/api/trips/driver/accept`: HTTP 409 + `{ "success": false, "code": "TRIP_ACCEPT_UNAVAILABLE", "message": "Hiện không thể nhận chuyến." }` khi bị khoá.
- POST `/api/devices/rider-app`: token người dùng, body `{ "platform": "android" }` hoặc `ios`. Token có appRole khác RIDER bị từ chối.
- GET `/api/admin/customers`: thêm riderAppUsages, appUsageSummary và query appPlatform.
- Migration: `20260919090000_trip_acceptance_and_rider_app_usage`. Thêm cột Boolean mặc định false, 2 enum audit và bảng RiderAppUsage. Không thay đổi số dư hay chuyến hiện có.

## Triển khai

1. Trong bản release backend, tạo Prisma Client theo schema mới (`pnpm exec prisma generate`, từ apps/api).
2. Chạy migration trên DB đích bằng quy trình deploy hiện có (`pnpm exec prisma migrate deploy`, từ apps/api, với DATABASE_URL đúng môi trường). Không dùng db push/migrate dev trên production.
3. Deploy/restart backend mới sau migration. Các cờ mặc định false nên không tự khoá tài xế.
4. Build/deploy apps/web (`pnpm build` tại apps/web).
5. Đ tăng phiên bản và build/phát hành Driver Mobile. Chỉ bật khoá sau khi tài xế có bản mới nếu cần hành vi im lặng. Backend vẫn chặn app cũ nhưng app cũ hiện lỗi chung.
6. Build/phát hành Rider Mobile để ghi nhận cả người không cấp quyền thông báo. Nếu chưa phát hành, thống kê vẫn có lịch sử Device và các đăng ký push mới, nhưng thiếu các trường hợp chưa đăng ký push.
7. Sau khi bản Driver mới đã khả dụng trên store, dùng cấu hình cập nhật bắt buộc hiện có nếu muốn. Chưa thay đổi version/minimum version hoặc cấu hình store trong lần này.

Nếu cần rollback ứng dụng, giữ migration bổ sung; không xoá bảng lịch sử hoặc cờ. Rollback backend cũ đồng nghĩa mất bảo vệ khoá/chống nhận trùng mới nên không dùng như phương án vận hành lâu dài.

## Kiểm tra

- Prisma schema validate và generate đạt; migration chạy thành công trên PostgreSQL tạm local từ schema trước thay đổi.
- 69 ca regression hiện có đạt (wallet, sessions, holiday surcharge).
- 16 ca tích hợp PostgreSQL mới: tranh chuyến, giới hạn một tài xế, block/accept theo thứ tự lock, toggle audit, rollback tiền, huỷ lặp, socket lỗi sau commit, rút tiền/nhận chuyến, endpoint cũ, thuế/phí, admin trả chờ duyệt và thống kê app.
- 6 ca mobile: im lặng đúng mã, lỗi khác vẫn hiện, thành công vẫn chuyển tab; telemetry Android/iOS không phụ thuộc push và bỏ qua web.
- Driver và Rider TypeScript noEmit đạt. Web production build đạt; có cảnh báo kích thước bundle lớn hiện có.
- Browser smoke với dữ liệu giả, chặn kết nối bên ngoài: Rider menu desktop/mobile 440px, chấm đỏ biến mất khi đọc, cột/thống kê khách hàng và nút khoá tài xế. Chưa chạy native build hay E2E trên điện thoại thật.

Chạy tests mới:

```sh
node --test tests/driver-accept-ui.test.cjs
TEST_DATABASE_URL='postgresql://USER@127.0.0.1:PORT/goviet247_test' node --test apps/api/tests/tripAcceptance.integration.test.js
```

Integration test chỉ chấp nhận DB local tên goviet247_test, dùng schema mới và XOÁ fixture trong DB đó trước mỗi ca. Không trỏ vào dữ liệu thật. Không đặt TEST_DATABASE_URL thì test tích hợp được skip.

## Giới hạn rà soát

Đã rà các luồng trực tiếp liên quan nhận/huỷ/đổi trạng thái chuyến, ví, thiết bị và UI được yêu cầu. Chưa kiểm toán toàn bộ hệ thống hoặc dữ liệu production; chưa xác định có trường hợp nhận trùng/lệch tiền đã xảy ra trong lịch sử. Không tự hoàn tiền hay sửa lịch sử tài chính cũ. Luồng rút tiền đã chống ghi đè số dư nhưng chưa bổ sung idempotency key cho mọi yêu cầu rút tiền độc lập.
