# Điều chỉnh giá theo miền

Trong Admin Web → Cấu hình → Giá cước → Điều chỉnh giá theo miền có ba mức Bắc, Trung, Nam, dùng chung cho mọi loại xe. Mặc định cả ba là 0%; không tự bật mức tăng trên hệ thống đang chạy.

## Quy tắc giá

- Xét điểm đón và toàn bộ điểm đến đã chọn, lấy mức cao nhất một lần. Không tính các tỉnh chỉ đi ngang qua.
- Dùng cùng danh sách 34 tỉnh/thành và ba miền với bộ lọc tài xế. Tên tỉnh cũ từ bản đồ được quy về tỉnh hiện tại.
- Cước nền B là giá mở cửa + giá km + chờ + nghỉ đêm, sau khi áp dụng giá tối thiểu.
- Tiền điều chỉnh miền = làm tròn đồng(B × phần trăm / 100).
- Tổng = làm tròn 10.000đ(B + phụ thu xăng + phụ thu lễ/Tết + điều chỉnh miền) + phí phục vụ tại điểm đến. Các phần trăm dùng chung B; không nhân chồng phụ thu.
- Giá và chi tiết miền được lưu trong `Trip.destinationService.tourDisplay.regionalSurcharge`. Thay đổi cấu hình không tính lại tiền chuyến đã tạo.
- Báo giá chưa đặt cần tính lại nếu cấu hình hoặc lộ trình thay đổi. Lưu cấu hình dùng kiểm tra phiên bản để tránh ghi đè thay đổi của Admin khác.

## Hiển thị nội bộ

- Cấu hình và chi tiết điều chỉnh miền chỉ hiển thị trong Admin Web/Admin Mobile.
- Báo giá, đặt chuyến, lịch sử và Đơn của tôi của Rider/Driver chỉ hiển thị giá cuối cùng cùng các thông tin hiện có; không thêm dòng điều chỉnh miền.
- API loại `regionalSurcharge` và `regionalPricingConfig` khỏi phản hồi Rider/Driver/cổng đối tác, kể cả dữ liệu lồng trong `destinationService.tourDisplay`. API Admin (gồm đường dẫn cũ `/api/trips/admin/...`) giữ đầy đủ snapshot; dữ liệu lưu DB không bị sửa.
- `regionalPricingSignature` vẫn được gửi như mã kiểm tra báo giá để đảm bảo giá không bị thay đổi lúc đặt chuyến.
- Nhãn miền mở nhận chuyến của tài xế vẫn giữ nguyên: đó là phạm vi nhận chuyến, không phải chi tiết tăng giá.
- Ẩn chi tiết không thay đổi yêu cầu tương thích: giữ ba mức 0% nếu Rider Mobile chưa cập nhật dữ liệu địa điểm.

## Địa điểm

Web, Rider Mobile và cổng đối tác gửi `routePricingPoints` gồm mã địa điểm và địa chỉ đầy đủ, dùng cùng dữ liệu cho cả báo giá và đặt chuyến. API tự đối chiếu địa điểm; không tin miền/tỉnh do client tự gửi. Lộ trình tính giá phải khớp toàn bộ điểm được lưu, gồm cả điểm đến cuối.

Các lựa chọn địa điểm tĩnh của app có trong `src/data/regional-pricing-places.json`. Sau khi thay danh sách địa điểm tĩnh, chạy từ gốc repo:

```sh
node apps/api/scripts/generateRegionalPricingPlaces.mjs
```

Địa điểm ngoài danh sách được đối chiếu Goong/VietMap theo placeId, có cache tối đa 1.000 mục trong 15 phút và timeout 8 giây cho mỗi truy vấn. Không xác định được miền thì trả lỗi yêu cầu chọn lại, không tự coi là miền Nam.

## Triển khai

1. Áp dụng patch vào mã nguồn đang làm việc.
2. Trong `apps/api`, dùng môi trường DB triển khai để chạy:

   ```sh
   pnpm exec prisma migrate deploy
   pnpm exec prisma generate
   ```

   Migration mới: `20261119220000_regional_pricing`, thêm cột JSON nullable vào TripConfig. Mặc định 0% nên migration có thể chạy trước khi cập nhật mobile.
3. Deploy API, Admin/Web Rider và cổng đối tác; phát hành Rider Mobile mới. Chỉ Admin Web và Admin Mobile hiển thị chi tiết điều chỉnh giá trên chuyến. Rider/Driver và cổng đối tác không hiển thị miền, tỷ lệ hoặc số tiền điều chỉnh miền; giá cuối cùng đã bao gồm khoản này.
4. Giữ ba mức 0% cho đến khi các ứng dụng đặt chuyến đã cập nhật. Khi bật một miền lớn hơn 0%, client cũ không gửi địa điểm đầy đủ sẽ được yêu cầu cập nhật/chọn lại địa điểm để tính giá; hệ thống không báo thiếu tiền.
5. Sau triển khai, vào Admin → Cấu hình → Giá cước → Điều chỉnh giá theo miền, nhập mức cần áp dụng và lưu. Ví dụ Bắc 10%, Trung 5%, Nam 0%.

Không cần sửa dữ liệu hoặc giá của các chuyến cũ. Bản cập nhật này không tự chạy migration, deploy hay thay tỷ lệ trên production.

## Kiểm tra đã chạy

Bản bổ sung ẩn chi tiết miền: 28 test về ẩn dữ liệu API, giữ chi tiết Admin, báo giá/đặt chuyến, giá lưu và phụ thu đều qua. Build Web/cổng đối tác và TypeScript ba app mobile đều qua. Không có migration mới cho phần ẩn hiển thị này.

- 43 test về giá miền, các luồng báo giá/đặt chuyến/OTP, phụ thu, chờ, nghỉ đêm và phục vụ tại điểm đến đều qua.
- Build Web và Web Partners; TypeScript Rider/Driver/Admin Mobile; Prisma validate đều qua.
- Một test sẵn có ở `carAvailability.test.js` lỗi thiếu mock `respondToOtpLock`, đã xác nhận cùng lỗi trên mã nguồn gốc. Test OTP mới trong `regionalPricingFlow.test.js` kiểm tra lưu giá miền qua xác nhận OTP đã qua.
- Chưa chạy DB migration, API bản đồ thật hoặc thử trên thiết bị thật trong phiên này.
