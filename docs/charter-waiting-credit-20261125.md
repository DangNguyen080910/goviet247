# Sửa tương tác Bao xe và tiền chờ — 25/11/2026

## Vấn đề và kết quả

Một số lựa chọn chỉ Bao xe ngày đến làm giảm cả tiền giờ và khoản giữ giá chuyển tiếp; chọn Bao xe ngày về lại làm khoản giữ giá tăng để bù phần giờ đã bỏ. Vì vậy nâng gói hoặc chọn thêm ngày có thể ra giá thấp hơn gói ít dịch vụ hơn.

Đã sửa theo phương án được chốt: **cước Tiêu chuẩn làm gốc; Bao xe chỉ thay thế phần tiền giờ thực; giữ khoản bù theo bậc km và giữ giá chuyển tiếp của cước Tiêu chuẩn**. Áp dụng chung cho **5, 7 và 16 chỗ**, kể cả cấu hình cũ chưa bật giá chờ lưu trú riêng. Không thay trạng thái nhận đặt, đơn giá km/chờ, phụ phí nghỉ đêm, xăng, lễ hoặc giá gói. Xe 16 chỗ đang tắt vẫn tắt.

Ca trong ảnh: xe 5 chỗ, Không yêu cầu nhiên liệu, tổng khứ hồi 49,2 km; đón 28/11/2026 12:00, đến 12:34, bắt đầu quay về 29/11/2026 15:00. Cấu hình đêm 200.000đ, chờ lưu trú 20.000đ/giờ, Bao xe đủ khung 600.000đ/07:00–21:00, tối đa 8 giờ/ngày.

| Gói | Trước sửa | Sau sửa |
|---|---:|---:|
| Tiêu chuẩn cả hai ngày | 1.280.000đ | **1.280.000đ** |
| Bao xe chỉ ngày 28 | 1.210.000đ | **1.490.000đ** |
| Bao xe chỉ ngày 29 | 1.630.000đ | **1.470.000đ** |
| Bao xe cả hai ngày | 1.510.000đ | **1.670.000đ** |

Cước chờ Tiêu chuẩn 640.000đ gồm tiền giờ 360.000đ và khoản chuyển tiếp 280.000đ. Sau sửa, khoản 280.000đ giữ nguyên ở mọi cách chọn gói cho cùng lịch. Bao xe mỗi ngày thay thế 8 giờ = 160.000đ tiền giờ; cả hai ngày 320.000đ. Phí gói 361.429đ và 342.857đ được cộng đúng một lần. Làm tròn 10.000đ một lần cuối.

## Quy tắc tính

1. Tính cước chờ Tiêu chuẩn không loại giờ Bao xe: giờ nghỉ đêm đủ điều kiện được loại, phút miễn phí trừ một lần mỗi chuyến, giờ tính phí làm tròn lên như trước. Lấy cả đơn giá giờ và các khoản bù từ kết quả Tiêu chuẩn.
2. Vẫn tính thời gian được Bao xe phục vụ để hiển thị và kiểm tra: chặn khoảng ngoài thời gian lưu trú, tối đa số giờ gói, không tính phần đã được phí đêm bao gồm.
3. Tiền giờ đề nghị trừ của từng ngày = số phút được Bao xe thay thế × giá chờ giờ đang áp dụng / 60, làm tròn tới đồng. Không làm tròn một phút phục vụ thành một giờ giảm tiền chờ. Cước Tiêu chuẩn được làm tròn giờ một lần; đây là một khoản giảm theo phút từ cước đó, không tính lại cước từ đầu sau mỗi lựa chọn.
4. Giới hạn khoản trừ của từng ngày để tổng giá không giảm khi nâng gói, kể cả phụ thu xăng/lễ/miền: chọn khoản trừ nguyên đồng lớn nhất không vượt mức đề nghị và thỏa `credit + Σ ceil(credit × percent / 100) <= phí Bao xe của ngày`. Các tỷ lệ cộng trên cùng nền, không nhân chồng. Dùng giới hạn trên của phép làm tròn để kết quả đúng với mọi số lẻ của nền cước.
5. Tổng tiền được trừ không vượt tiền giờ Tiêu chuẩn. Không trừ vào `waitingTierAdjustment` hoặc `nightTransitionAdjustment`. Gói giá 0 không được dùng để làm giảm cước Tiêu chuẩn; tiền giờ 0 không tạo khoản giảm âm hoặc giả.
6. Tính lại nền cước sau khoản trừ, áp dụng giá tối thiểu và các phụ thu trên cùng nền mới. Phí Bao xe nằm ngoài nền phụ thu và được cộng một lần. Làm tròn cuối theo quy tắc hiện tại.

Với cùng tuyến, lịch, cấu hình và nhiên liệu, thêm một ngày gói không làm giảm tổng giá. Một ngày gói quá ngắn/rẻ có thể chỉ thay thế một phần nhỏ tiền chờ hoặc có tổng bằng Tiêu chuẩn sau làm tròn; không tự tăng phí gói để ép có chênh lệch. Phần thời gian và `billableWaitHours` vẫn phản ánh thời gian sau khi loại gói; khi có giảm theo phút, không diễn giải tiền chờ bằng cách nhân lại số giờ làm tròn của thời gian còn lại.

## Dữ liệu và tương thích

- Helper thuần: `apps/api/src/services/charterWaitingCredit.js`.
- Engine: `apps/api/src/services/pricingService.js`.
- Báo giá mới có `charterPricingVersion: 1`, `standardHourlyWaitCost`, `standardWaitCost`, `charterWaitingCredit`, `charterWaitingCredits`. Các trường này cũng được lưu trong `destinationService.tourDisplay` để đối chiếu.
- `waitCost` và `hourlyWaitCost` là số tiền còn lại sau khoản trừ; khoản bù theo bậc và chuyển tiếp bằng các khoản của cước Tiêu chuẩn.
- Nội dung gói, phí gói và chữ ký điều kiện phục vụ giữ nguyên cấu trúc. `tourDisplay` không tham gia chữ ký. Không có trường mới bắt buộc trong payload Rider/Mobile.
- Báo giá đang giữ còn hạn dùng giá/snapshot đã phát hành, không bị tính lại khi deploy. Chuyến đã lưu không bị cập nhật bởi bản sửa này. Phải tính giá mới để thấy công thức mới.
- Chuyến một chiều và các báo giá không mua Bao xe giữ nguyên kết quả. Không có migration hoặc thay đổi Prisma schema.

## Kiểm tra

- Đúng bốn lựa chọn trong ảnh; khoản chuyển tiếp giữ nguyên.
- Tất cả tập con của ba ngày gói cho 5/7/16 chỗ, nhiều bậc km và nhiên liệu; thêm ngày không hạ giá.
- Gói một phút; gói miễn phí/rất rẻ; giá tối thiểu; giá giờ 0; trường hợp chưa có giá chờ lưu trú riêng; gói chồng khung đêm.
- Tiền chờ được trừ theo phút, không tạo thêm một giờ giảm tiền do làm tròn.
- Phụ thu xăng/lễ/miền và các nền tiền lẻ; ngân sách giảm tiền theo ngày vẫn an toàn sau làm tròn phần trăm.
- Lùi giờ quay về qua khung phục vụ với cùng ngày gói đã chọn.
- Giữ báo giá trước cập nhật; HTTP báo giá → JSONB → tạo chuyến với payload Web/Mobile cũ cho 5/7/16 chỗ và phụ thu miền bật/tắt.
- Chạy bộ unit/HTTP-mock hiện có và lượt rà giá mô phỏng bổ sung. Mọi DB, bản đồ, OTP/Push trong kiểm tra đều là in-memory/mock hoặc địa điểm fixture; không tạo chuyến hoặc ghi cấu hình production.

Lượt rà bổ sung có thể tái chạy từ root dự án:

```sh
DATABASE_URL=postgresql://audit:audit@127.0.0.1:1/disposable_audit_only AWS_EC2_METADATA_DISABLED=true node scripts/audit-charter-pricing-20261125.mjs
```

Script chứa các mức giá tại thời điểm rà; không tự lấy cấu hình production mới. Kiểm tra hữu hạn không bảo đảm mọi cấu hình tương lai, thời gian lẻ giây, tuyến bản đồ hoặc bản native đang cài thực tế đã được bao phủ.

## Triển khai

1. Chạy file áp dụng trên Mac, xem diff rồi commit/push theo quy trình hiện tại.
2. **Chỉ deploy/khởi động lại API** với đầy đủ file helper mới và pricingService mới. Không cần build Web/Mobile, migration hay tạo lại Prisma client cho bản sửa này.
3. Giữ nguyên cấu hình đang lưu. Không tự bật xe 16 chỗ.
4. Bấm tính giá mới khi kiểm tra. Báo giá đang giữ còn hạn và chuyến đã đặt tiếp tục giữ giá cũ.
