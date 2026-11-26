# Duyệt chuyến tự động — 26/11/2026

## Hành vi

Admin Web → Cấu Hình → Chuyến Đi có hai công tắc độc lập, lưu ngay:

- **Tự duyệt chuyến mới**: kiểm tra sau khi khách đặt thành công, bao gồm xác nhận OTP khách vãng lai, Rider đăng nhập và chuyến đối tác dùng chung luồng tạo chuyến.
- **Tự duyệt lại chuyến tài xế huỷ**: áp dụng khi Driver tự huỷ hoặc Admin đưa chuyến tài xế huỷ về chờ duyệt để tìm tài xế khác, gồm cả hoàn ví và giữ phạt. Không áp dụng huỷ hẳn, khách huỷ hoặc điều hành chủ động đưa chuyến chưa có tài xế về chờ duyệt để thương lượng giá.

Mặc định hai công tắc **tắt**. Chỉ Admin được xem/đổi qua API riêng; STAFF bị từ chối. Mobile có mục Cấu Hình trên Trang Chủ dành riêng Admin. Các thay đổi được kiểm tra bằng phiên bản `updatedAt`, tránh ghi đè công tắc vừa được đổi từ thiết bị khác. Bật không duyệt hàng loạt chuyến cũ đang chờ. Tắt không thu hồi những chuyến đã duyệt.

## Địa chỉ và miền

Hệ thống dùng bộ xác minh địa chỉ trên server đang dùng cho báo giá, không tin tỉnh, toạ độ hoặc miền do client tự gửi. Các địa chỉ canonical đã xác minh được dùng lại qua cache để tránh gọi bản đồ lặp khi vừa đặt chuyến.

Mọi điểm đón và điểm đến phải qua sàng lọc. Chấp nhận số nhà kèm tên đường, địa điểm có tên như bệnh viện/khách sạn/chùa/sân bay trên bản đồ, hoặc ấp/thôn/bản/buôn/làng/xóm/sóc kèm xã và tỉnh. Tên tỉnh, phường/xã, đường chung, tên đường dạng ngày tháng chưa có số nhà, hoặc dữ liệu bản đồ chưa xác minh đều giữ chờ duyệt. Đây là quy tắc sàng lọc; không thể bảo đảm nhà có tồn tại hoặc mọi địa chỉ vùng quê đều được tự duyệt. Trường hợp không chắc được chuyển cho người duyệt.

Miền nhận chuyến lấy từ **tỉnh/thành của điểm đón**, dùng bảng tỉnh và miền có sẵn, kể cả tên tỉnh cũ. Đối tượng là toàn bộ tài xế VERIFIED, không bị chặn nhận chuyến, có tỉnh/thành đã xác nhận trong miền đó. Điều kiện nhận chuyến và giới hạn ví/chuyến/hợp đồng vẫn do luồng nhận chuyến hiện tại kiểm tra.

Không xác định được miền, không còn tài xế trong miền, bản đồ lỗi hoặc giờ đón đã tới: không phát công khai; giữ chờ duyệt, lưu `autoApprovalReviewReason`, gửi thông báo chờ duyệt. Web hiển thị lý do trong bảng; Mobile hiển thị trong chi tiết chuyến.

## Đồng bộ và thông báo

Yêu cầu kiểm tra tự duyệt được ghi vào `NotificationJob` cùng transaction tạo/gỡ tài xế. Kiểm tra bản đồ chạy sau commit, không giữ khoá ví hoặc làm khách chờ kết quả gửi push. Worker tự duyệt xử lý riêng với worker Expo để việc gửi push chậm không giữ hàng kiểm tra chuyến.

Trước khi duyệt, hệ thống khoá chuyến và kiểm tra lại trạng thái, phiên bản, thời gian sửa, công tắc hiện tại và giờ đón. Chuyến vừa được huỷ, duyệt tay, giao tài xế hoặc sửa thông tin sẽ không bị tự duyệt đè lên. Duyệt, lịch sử và các job thông báo được commit cùng nhau. Xử lý trùng chỉ ghi một lần; lỗi transaction không tạo duyệt dở dang. Không thay đổi giá, ghi chú khách, lịch trình, hoặc các bút toán hoàn ví/phạt đã thực hiện.

Sau mỗi lần thành công:

- Socket `trip:new` chỉ phát tới các phòng tài xế trong danh sách miền đã lưu. Không bao giờ dùng mảng rỗng để đại diện cho miền không có tài xế vì mảng rỗng trong hệ thống hiện tại có nghĩa phát công khai.
- Mọi máy nhận cùng `driverAcceptOpenAt`, lấy từ giờ server và delay đang cấu hình. Không bảo đảm push đến mọi điện thoại cùng lúc; thiết bị/mạng và hệ điều hành vẫn ảnh hưởng lúc nhận.
- Admin Web có thông báo cập nhật kèm âm thanh theo luồng đổi trạng thái. Admin Mobile nhận push `ADMIN_TRIP_STATUS_CHANGED`, source `auto_verify_trip`, ghi rõ mới hay duyệt lại và miền. Chạm thông báo mở đúng chuyến; nếu chuyến đã có tài xế thì chuyển sang danh sách đã nhận.
- Rider nhận cập nhật chuyến theo luồng hiện tại. Job push và realtime có lưu bền, kiểm tra lại trạng thái trước khi gửi để bỏ những lượt duyệt cũ đã mất hiệu lực. Việc có job không chứng minh điện thoại đã hiển thị push.

## Triển khai

1. Chạy installer để áp dụng mã, xem diff rồi commit/push theo quy trình dự án. Installer chỉ sửa file và tạo bản sao lưu; không chạy DB, build, push, gửi thông báo thật hay bật tính năng.
2. Trên môi trường cần triển khai, chạy migration bổ sung cột trước khi khởi động API mới:

   ```bash
   pnpm --filter @goviet247/api exec prisma migrate deploy --schema prisma/schema.prisma
   pnpm --filter @goviet247/api exec prisma generate --schema prisma/schema.prisma
   ```

3. Deploy/khởi động lại API rồi build/deploy Web theo quy trình hiện tại. Migration thêm hai boolean mặc định false vào `TripConfig` và lý do duyệt tay nullable vào `Trip`; không tự sửa chuyến cũ.
4. Build và phát hành Admin Mobile để có mục Cấu Hình, hai công tắc, lý do duyệt tay và điều hướng push mới. Rider/Driver đang cài bản cũ có thể dùng tự duyệt qua API, không cần build chỉ cho tính năng này. Quyền thông báo/phiên push trên từng máy vẫn phải hợp lệ.
5. Sau khi cập nhật, kiểm tra trước với công tắc tắt; bật riêng một công tắc, đặt chuyến thử địa chỉ cụ thể và địa chỉ chung để đối chiếu trạng thái, miền, lịch sử, countdown và thông báo. Kiểm tra trường hợp Driver huỷ/hoàn ví theo nghiệp vụ hiện tại trước khi dùng qua đêm.

Nếu cần rollback API, tắt cả hai công tắc và cho worker mới xử lý hết job tự duyệt trước. API cũ không xử lý được hai loại job mới; các cột DB bổ sung có thể giữ nguyên.

## Kiểm tra và giới hạn môi trường

Đã kiểm tra bằng unit/HTTP fixture: công tắc độc lập và chống ghi đè; quyền ADMIN/STAFF/phiên bị thu hồi; địa chỉ cụ thể/chung/vùng quê/nhiều điểm đến; miền theo điểm đón; 5/7/16 chỗ; giữ đúng giá; đếm ngược chung; không phát công khai khi miền rỗng; duyệt trùng; huỷ/sửa/duyệt tay/tắt công tắc trong lúc chờ bản đồ; rollback job và lịch sử; giữ nguyên bút toán huỷ/hoàn ví; điều hướng thông báo; các worker nhận đúng loại job riêng.

Web build production, TypeScript Admin Mobile và Prisma validate được chạy. Giao diện Web thật được thử bằng trình duyệt với API fixture, cả desktop và 390px, bật từng công tắc và tải lại; chưa thao tác cấu hình production.

Kiểm tra PostgreSQL thật được bổ sung tại `apps/api/tests/tripAutoApprovalPostgres.test.js`, chỉ chạy với DB dùng một lần có tên `goviet247_auto_approval_test_*` trên localhost và đã có đầy đủ schema mới. Môi trường hiện tại không khởi tạo được PostgreSQL do quyền shared memory; Docker daemon không chạy. Vì vậy chưa chạy migration hoặc kiểm tra tranh chấp transaction trên PostgreSQL thật, không dùng DB production thay thế. Bộ kiểm tra thường chủ động xoá biến DB này để không vô tình truy cập DB thật.

Để chạy kiểm tra PostgreSQL riêng trên máy/môi trường cho phép, chuẩn bị DB kiểm thử dùng một lần với đầy đủ schema, generate client mới rồi đặt `AUTO_APPROVAL_TEST_DB_URL`; có thể đặt `AUTO_APPROVAL_TEST_CLIENT` trỏ client được generate riêng. Test xoá dữ liệu trong DB thử đó và tuyệt đối không dùng DB dev/production.
