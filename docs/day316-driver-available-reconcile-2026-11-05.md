# Day 316 — Chuyến đã có tài xế vẫn hiện trong danh sách chờ

Ngày kiểm tra: 05/11/2026. Ảnh người dùng có chuyến #r2ciwx5j, 15:00 06/11/2026, còn nút Nhận chuyến. Người dùng xác nhận kéo xuống làm mới thì chuyến biến mất.

## Nhận định theo bằng chứng

Việc kéo xuống làm mất chuyến cho thấy lần tải mới đã loại chuyến ra; màn hình trước đó giữ danh sách cũ. Không có log của đúng máy/chuyến để kết luận vì sao tín hiệu realtime bị lỡ, socket chưa được thiết lập hoặc bản app đang cài chưa chứa bản sửa. Không dùng ảnh để khẳng định trạng thái cơ sở dữ liệu sản xuất.

Bản sửa Day 315A đã xử lý việc ẩn chuyến ngay khi nhận sự kiện và chặn phản hồi cũ khôi phục thẻ. Tuy nhiên dashboard chưa có đối chiếu HTTP định kỳ khi app đang mở. Nếu sự kiện bị lỡ, thẻ có thể tồn tại đến khi kéo xuống, có sự kiện mới hoặc app kết nối lại. Vòng tải realtime còn chờ cả Đơn của tôi; yêu cầu tải danh sách chờ trước đây không có thời hạn chờ.

Thông báo lỗi chi tiết nhận chuyến không đợi người dùng bấm/đóng mới làm mới danh sách. Đây là điểm đã kiểm tra riêng, không phải cơ chế gây giữ thẻ chuyến đến lúc thông báo đóng.

## Bổ sung local

- `apps/driver-mobile/app/dashboard.tsx`: khi app active, đối chiếu danh sách chờ mỗi 5 giây. Có lượt đối chiếu ngay khi app trở lại foreground. Dừng vòng đối chiếu khi unmount và không gửi lượt mới lúc cùng vòng đối chiếu đang tải.
- Vòng đối chiếu độc lập với hàng đợi realtime/Đơn của tôi, nên Đơn của tôi tải chậm không giữ danh sách chờ cũ mãi.
- `apps/driver-mobile/services/tripApi.ts`: tải danh sách chờ có AbortController, thời hạn 10 giây gồm đọc phản hồi, yêu cầu không dùng cache. Phản hồi không đúng cấu trúc không được hiểu nhầm là danh sách rỗng; lỗi vẫn do màn hình xử lý và có thể thử lại.
- `apps/api/src/controllers/tripController.js`: trả `Cache-Control: no-store` cho endpoint danh sách chuyến chờ, vẫn giữ lọc PENDING/chưa có driver và quyền xem chuyến.
- Giữ phần ẩn ngay khi nhận realtime, chống phản hồi cũ và chặn bấm nhận lặp của Day 315A.

Năm giây là chu kỳ kiểm tra dự phòng, không cam kết độ trễ tối đa: cần cộng thời gian mạng/API trả kết quả; khi offline không thể biết trạng thái mới. Thời hạn 10 giây bảo đảm yêu cầu fetch tuân thủ abort không giữ vòng tải mãi.

## Kiểm tra

38/38 kiểm thử liên quan đạt, không bỏ qua; TypeScript noEmit Driver đạt; git diff --check đạt.

```sh
node --test tests/driver-available-reconcile.test.cjs tests/driver-accept-ui.test.cjs apps/api/tests/availableTripState.test.js apps/api/tests/driverRealtimeRefresh.test.js apps/api/tests/tripAcceptFeedback.test.js apps/api/tests/tripAudience.test.js
node node_modules/typescript/bin/tsc --noEmit --pretty false -p apps/driver-mobile/tsconfig.json
```

Các ca mới thực thi effect/API client thật với mạng, vòng đời app và đồng hồ được giả lập: lỡ hoàn toàn sự kiện realtime, không bấm nhận/kéo xuống, không chồng lượt khi tải chậm, foreground/background/unmount, hàng đợi realtime kẹt Đơn của tôi, timeout rồi thử lại, phản hồi sai cấu trúc và header chống cache.

## Triển khai — cần phân biệt rõ

- **Chỉ cập nhật API** áp dụng cho thay đổi trước đó: tắt push chat của Admin Mobile.
- **Sửa danh sách chuyến trong Driver Mobile cần cập nhật bản app tài xế**; deploy API không thay JavaScript đã được đóng gói trong bản app đang cài. Riêng bản bổ sung này cũng có header chống cache ở API cần deploy.
- Chưa build/submit Store, chưa deploy máy chủ, chưa thử trực tiếp trên hai điện thoại trong công việc này. Đ tự deploy như đã thống nhất.
- Trong lúc chưa có bản app mới, kéo xuống làm mới là cách lấy danh sách mới; không coi đây là giải pháp cuối.
- Sau cập nhật, thử hai điện thoại: A nhận chuyến, B không thao tác. Thử tiếp B bị lỡ sự kiện/chuyển nền rồi mở lại: danh sách tự đối chiếu và bỏ chuyến, không chờ tài xế bấm Nhận chuyến.
