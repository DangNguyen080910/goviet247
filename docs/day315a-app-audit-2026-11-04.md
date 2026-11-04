# Day 315A — Rà soát GoViet247 — 04/11/2026

## Kết quả

Đã rà mã nguồn và chạy kiểm tra cho API, Driver Mobile, Rider Mobile, Admin Mobile, website khách/quản trị và cổng đối tác tại dự án này. Đợt rà soát này không xác nhận mọi chức năng đã được thử trên điện thoại thật hoặc bản đang phát hành.

Kết quả cuối: **426 kiểm thử đạt, 0 thất bại, 0 bỏ qua**, gồm **22 kiểm thử tích hợp PostgreSQL**. Kiểm tra kiểu dữ liệu cả ba app đạt; hai website build thành công; kiểm tra khai báo và liên kết thư viện native Android/iOS cả ba app đạt.

## Những lỗi đã sửa

### 1. Chuyến đã có tài xế vẫn còn trên danh sách và có thể bị dữ liệu cũ đưa trở lại

- Trước: Driver nhận `trip:changed` nhưng chỉ bỏ thẻ chuyến sau khi gọi API lấy lại danh sách. Một phản hồi HTTP cũ có thể đến sau tín hiệu nhận chuyến.
- Sau: loại chuyến ngay khi nhận trạng thái không còn mở nhận, đồng thời chặn bấm nhận trên thẻ cũ trước khi giao diện render lại. Phản hồi tải danh sách bắt đầu trước tín hiệu mới hoặc phản hồi cũ hơn lượt tải gần nhất bị loại bỏ.
- App vẫn lấy danh sách chính thức từ API; chỉ dữ liệu mới có thể đưa chuyến được trả lại về danh sách. Bấm liên tục chỉ gửi một yêu cầu nhận tại một thời điểm. Lỗi mạng chưa rõ kết quả không bị hiểu nhầm là tài xế khác đã nhận.
- File: `apps/driver-mobile/app/dashboard.tsx`, `apps/api/src/shared/availableTripState.js`.
- Giới hạn: chỉ có thể ẩn ngay **sau khi app nhận tín hiệu**; mất mạng hoặc app bị hệ điều hành tạm dừng vẫn gây trễ trước thời điểm đó.

### 2. Chuyến và các điểm đến chưa được lưu trong cùng giao dịch

- Trước: chuyến thường được commit trước, sau đó route mới ghi `TripStop`. Nếu ghi điểm đến thất bại, một chuyến thiếu dữ liệu vẫn tồn tại trong khi người dùng nhận thông báo lỗi.
- Sau: chuyển danh sách điểm đến vào `createBookableTrip`; ghi chuyến, điểm đến và lời nhắn hệ thống trong cùng giao dịch. Ghi điểm đến thất bại sẽ rollback toàn bộ. Giữ cách xử lý điểm đến riêng của đối tác, không tạo trùng.
- File: `apps/api/src/routes/trips.js`, `apps/api/src/services/carAvailability.js`.
- Đã kiểm chứng rollback và thứ tự điểm đến trên PostgreSQL thử nghiệm.

### 3. Lỗi realtime sau khi lưu thành công có thể làm API trả thất bại sai

- Trước: một số luồng đặt/xác nhận OTP/hủy/đổi trạng thái/duyệt/sửa chuyến gửi sự kiện realtime sau commit nhưng chưa tách lỗi gửi khỏi kết quả lưu. Nếu thao tác gửi ném lỗi, API có thể báo thất bại dù dữ liệu đã đổi, khiến người dùng thử lại.
- Sau: bắt và ghi log lỗi realtime sau khi lưu; vẫn trả đúng kết quả thao tác đã hoàn tất. Không thay đổi kiểm tra quyền, điều kiện nhận/hủy, cách tính tiền, phạt hoặc hoàn ví.
- Phạm vi sửa: đặt chuyến thường và OTP; tài xế trả chuyến/đổi trạng thái; khách/đối tác tự hủy; quản trị duyệt, đẩy lại, chuyển về chờ duyệt, đổi trạng thái, chỉnh lịch và thông tin, hủy/hoàn ví.
- File: `apps/api/src/controllers/tripController.js`, `adminTripController.js`, `tripPublicController.js`; `apps/api/src/routes/trips.js`, `partners.js`.
- Kiểm thử xác nhận lỗi realtime không làm mất kết quả lưu, thao tác lặp không trừ ví hoặc ghi phạt thêm. Lỗi gửi vẫn được ghi nhận; thay đổi này không bổ sung hàng đợi đảm bảo phát lại mọi sự kiện.

### 4. Kết quả tìm địa chỉ cũ có thể ghi đè kết quả mới

- Trước: hủy bộ đếm chờ tìm địa chỉ không vô hiệu hóa yêu cầu mạng đã chạy. Một tìm kiếm cũ trả về chậm có thể thay gợi ý mới hoặc bật lại gợi ý sau khi khách đã chọn địa chỉ.
- Sau: bỏ qua kết quả/thông báo lỗi/trạng thái tải của lượt tìm đã hết hiệu lực, áp dụng cho cả điểm đón và điểm đến trên Rider Mobile.
- File: `apps/rider-mobile/app/booking.tsx`.
- Sáu tình huống kiểm thử với phản hồi đảo thứ tự và yêu cầu cũ thất bại đã tái hiện lỗi trước khi sửa và đạt sau khi sửa.

## Bằng chứng kiểm tra

| Kiểm tra | Kết quả |
|---|---|
| Toàn bộ bộ kiểm thử tự động | 426 đạt, 0 thất bại, 0 bỏ qua |
| PostgreSQL tích hợp | 22 đạt, bao gồm tranh chấp nhận chuyến, giới hạn chuyến, nhận/rút tiền đồng thời, rollback, phạt/hoàn phí, sự kiện realtime lỗi |
| TypeScript Driver / Rider / Admin | Cả ba đạt |
| Native dependencies Android / iOS | Driver: 23 / 25; Admin: 23 / 25; Rider: 16 / 17 — đều đạt |
| Website khách/quản trị | Build thành công |
| Cổng đối tác | Build thành công |
| `git diff --check` | Đạt |

PostgreSQL được tạo riêng trong thư mục tạm, chỉ nghe trên localhost, database `goviet247_test`; không dùng dữ liệu sản xuất. Các bài test thay thế dịch vụ gửi thông báo/đối tượng bên ngoài bằng dữ liệu kiểm thử. Chỉ tạo bản build website cục bộ; chưa deploy, chưa tạo bản Store, chưa submit phát hành.

### Chạy lại bộ kiểm thử

Không đặt `TEST_DATABASE_URL` sẽ bỏ qua 22 bài tích hợp. Khi chạy đủ, dùng database PostgreSQL riêng, có thể xóa sạch, tên `goviet247_test` trên localhost; bài tích hợp sẽ xóa dữ liệu kiểm thử trước mỗi ca. Không trỏ vào database dùng chung.

```sh
node --test apps/api/tests/*.test.js tests/*.test.cjs tests/*.test.mjs apps/mobile-chat/tests/*.test.cjs apps/admin-mobile/tests/*.test.cjs apps/admin-mobile/scripts/wallet-safety.test.cjs apps/rider-mobile/tests/*.test.cjs
```

## Các mục còn tồn tại, chưa đồng nghĩa lỗi vận hành

- Kiểm tra quy tắc code website hiện có **28 lỗi lint, 24 cảnh báo**: biến thừa, khối catch rỗng, quy tắc Fast Refresh và React hooks. Website vẫn build được. Chưa sửa hàng loạt các component này trong đợt xử lý lỗi hành vi để tránh thay đổi giao diện/luồng ngoài phần đã kiểm thử.
- Kiểm tra lint Driver có **1 lỗi, 13 cảnh báo**; Admin **3 lỗi, 29 cảnh báo**. Các lỗi `__dirname` nằm trong script/test CommonJS do cấu hình môi trường lint, không phải lỗi chạy app điện thoại. Còn cảnh báo import, biến thừa và dependency hooks cần dọn riêng.
- Bundle website ban đầu còn lớn: website khoảng **1,47 MB** JavaScript trước gzip (~413 kB gzip), cổng đối tác khoảng **919 kB** (~272 kB gzip). Có cảnh báo chia nhỏ bundle; đây là cơ hội cải thiện thời gian tải web, không phải bằng chứng nguyên nhân độ trễ chuyến trên app tài xế.
- Chưa kiểm thử thiết bị thật cho vòng đời app, mạng yếu, push chạy nền, camera/microphone/GPS, tương tác nhiều điện thoại hoặc phiên bản đang cài của Đ. Kiểm tra autolinking không thay cho chạy bản cài native.

## Trước khi phát hành

1. Áp dụng code API và cập nhật mã ứng dụng Driver/Rider vào bản phát hành phù hợp. Các sửa xử lý API của Admin/đối tác có hiệu lực sau khi triển khai API; chỉ sửa file ở máy chưa cập nhật ứng dụng đang dùng.
2. Thử hai tài xế cùng mở một chuyến: A nhận, thẻ chuyến trên B biến mất khi B nhận tín hiệu; bấm liên tục không gửi lặp. Thử thêm app B chuyển nền rồi mở lại, mất mạng rồi nối lại.
3. Thử đặt chuyến nhiều điểm đến và gõ/chọn địa chỉ nhanh với mạng yếu; kiểm tra thứ tự điểm đến, không hiện lại gợi ý cũ.
4. Thử đổi trạng thái/hủy chuyến và xem ví/lịch sử trên bản kiểm thử; đối chiếu kết quả hiển thị với dữ liệu đã lưu.

Không thể kết luận “không còn lỗi” chỉ từ các kiểm tra trên; kết quả xác nhận những phạm vi và tình huống đã ghi rõ.
