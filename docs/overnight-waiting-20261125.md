# Giá chờ riêng cho chuyến lưu trú qua đêm — 25/11/2026

## Vấn đề và lựa chọn

Mức chờ 60.000đ/giờ ở mốc 50 km trước đây kéo giá chuyến 174,6 km lên theo cơ chế giữ tổng giá chạy và chờ, dù bậc của tuyến này chỉ là 20.000đ/giờ. Nếu chỉ bỏ mức giữ giá, cùng thời gian chờ hai đêm, 50 km có thể giá 3.330.000đ nhưng 50,1 km còn 2.570.000đ.

Đã chọn: giá chờ lưu trú riêng theo loại xe, không phụ thuộc bậc km. Bắt đầu bằng xe 5 chỗ 20.000đ/giờ; xe 7/16 chỗ giữ cách tính cũ cho tới khi quản trị cấu hình riêng. Mã không tự ghi mức tiền này vào database.

## Quy tắc mới

- `PricingConfig.roundTripWaitingConfig.overnightPricePerHour` là giá giờ tùy chọn. Dùng cột JSONB hiện có, không thêm cột/schema/migration.
- Thiếu trường hoặc `null`: dùng cách tính cũ. `0`: tiền giờ bằng 0; mức giữ giá tại lần chuyển sang lưu trú (nếu có) vẫn áp dụng. Số tiền phải là số nguyên không âm, tối đa 2.147.483.647.
- Chỉ áp dụng cho khứ hồi, có ít nhất một khoảng chờ đủ ngưỡng nghỉ đêm. Chỉ qua 0h hoặc lái xe qua đêm chưa đủ điều kiện. Mức giờ chỉ lấy từ cấu hình server, không lấy từ payload khách.
- Tiền chạy theo km vẫn lũy tiến. Thời gian chờ tính từ lúc xe dự kiến đến điểm cuối tới lúc bắt đầu quay về. Trừ đúng giờ nghỉ đêm đủ điều kiện, giờ Bao xe đã mua và một lần miễn phí mỗi chuyến; làm tròn tổng giờ tính phí lên như trước.
- Khi áp dụng giá riêng: `hourlyWaitCost = billableWaitHours × overnightPricePerHour`, `waitingTierAdjustment = 0`, `waitingPricingMode = OVERNIGHT_FLAT`.
- Có một mức giữ giá chuyển tiếp để tránh kéo dài giờ về vài phút tới ngưỡng đủ một đêm lại làm tổng tiền giảm: tổng tiền chạy + chờ + nghỉ đêm không thấp hơn tổng tiền chạy + chờ ngay trước lần đầu đủ điều kiện nghỉ đêm. Khoản bù chuyển tiếp nằm riêng ở `nightTransitionAdjustment`, cộng vào `waitCost`. Mốc tiền này cố định theo lần chuyển đầu, không tăng theo số ngày chờ; khoản bù giảm về 0 khi tiền theo giá lưu trú đã đủ cao. Tuyến 174,6 km trong ví dụ không phát sinh khoản bù này.
- Để các đêm tiếp theo cũng không làm giảm giá, cấu hình phải thỏa `overnightFee >= ceil(nightMinWaitHours) × overnightPricePerHour`. API và Web cùng kiểm tra khi sửa mức chờ, ngưỡng đêm hoặc phụ phí đêm. Với 20.000đ/giờ và ngưỡng 5 giờ, mức đêm tối thiểu là 100.000đ; mức hiện tại 300.000đ phù hợp.
- Chuyến một chiều và khứ hồi chưa đủ điều kiện nghỉ đêm giữ công thức cũ. Không sửa mức giá km, giá chờ theo bậc, phụ phí đêm hay cấu hình loại xe khác.
- Tiền xăng/lễ/miền vẫn cộng trên cùng cước nền; Bao xe cộng một lần; làm tròn 10.000đ một lần cuối.
- Chi tiết cách tính được trả trong báo giá và lưu trong `destinationService.tourDisplay` của các chuyến mới để đối chiếu; không tự tính lại chuyến đã lưu. `tourDisplay` không nằm trong chữ ký điều kiện phục vụ nên không làm hỏng bước đặt bằng báo giá đang giữ.

## Triển khai và bật mức đã thống nhất

1. Áp dụng bản vá, kiểm tra diff, commit/push theo quy trình hiện tại.
2. Triển khai API mới trước, sau đó build/triển khai Web. Không chạy migration, `db push` hoặc tạo lại Prisma client cho riêng thay đổi này. Không cần build app Mobile mới để dùng công thức server.
3. Tải lại Admin Web → Cấu hình → Giá cước → Xe 5 chỗ → Chờ và nghỉ đêm — chỉ khứ hồi. Nhập `20000` vào **Giá chờ/giờ khi lưu trú qua đêm**, giữ các giá trị khác và bấm lưu giá xe 5 chỗ.
4. Tải lại trang để xác nhận mức tiền được lưu. Xe 7 và 16 chỗ để trống cho đến khi chốt giá riêng. Nếu API cũ chưa được triển khai, trường mới không được lưu; không bật giá khi còn chạy API cũ.
5. Tính giá mới cho cùng tuyến/thời gian để đối chiếu. Báo giá đã giữ còn hạn tiếp tục dùng mức đã phát hành; cần bấm tính giá mới để thấy mức mới.

Admin client cũ gửi lại bốn trường chờ gốc không làm mất mức lưu trú mới; phải gửi rõ `overnightPricePerHour: null` để tắt. Không bắt các bản Rider/Driver cũ gửi trường mới khi đặt chuyến.

## Đối chiếu tuyến đã báo

TP.HCM → Tây Ninh → TP.HCM, xe 5 chỗ, Không yêu cầu nhiên liệu, 174,6 km. Đón 27/11/2026 07:00, đến 08:39. Chọn Tiêu chuẩn tất cả các ngày, không có phụ thu miền/lễ.

| Khoản | Về 28/11 15:00 | Về 29/11 15:00 |
|---|---:|---:|
| Mở cửa | 50.000đ | 50.000đ |
| Tiền km | 1.080.420đ | 1.080.420đ |
| Chờ tính giờ | 22 × 20.000 = 440.000đ | 38 × 20.000 = 760.000đ |
| Điều chỉnh bậc km / chuyển tiếp | 0đ / 0đ | 0đ / 0đ |
| Nghỉ đêm | 300.000đ | 600.000đ |
| Bao xe | 0đ | 0đ |
| Tổng sau làm tròn | **1.870.000đ** | **2.490.000đ** |

Thêm 24 giờ: 16 giờ chờ × 20.000đ + 1 đêm × 300.000đ = **620.000đ**.

## Kiểm tra

- Ca tái hiện 174,6 km; giá trước/sau, miễn phí một lần, không thu trùng đêm/Bao xe.
- Các phía của mốc 50/75/100/150/200/300 km với cùng thời gian chờ, cả khi khoản giữ giá chuyển tiếp đang có hiệu lực.
- Ngay trước/sau ngưỡng đêm đầu; theo nửa giờ trong 72 giờ gồm các đêm tiếp theo; xe đến giữa khung đêm.
- Thiếu/null/0/giá âm/giá lẻ/giá quá lớn; giữ mức mới khi Admin cũ lưu, xóa mức bằng null; kiểm tra ràng buộc phụ phí đêm.
- Phụ phí nhiên liệu/lễ, một chiều, giá tối thiểu và làm tròn; loại xe chưa bật giữ công thức cũ.
- Báo giá đang giữ không bị tính lại khi bật mức mới; payload bản Mobile đã phát hành không cần trường mới. Kiểm tra HTTP quote → JSONB → tạo chuyến cho payload Web và Mobile cũ.
- Form Web gửi đúng null khi xóa, đúng 0 khi nhập 0; build Web; bộ kiểm tra unit/HTTP-mock toàn dự án.

Kiểm tra dùng dữ liệu trong bộ nhớ và HTTP local, không sửa DB production, không gửi OTP/Push thực. Chưa kiểm thử trực tiếp bản native đang cài trên điện thoại hoặc triển khai lên production. Giá không giảm tại mốc km được so sánh với cùng thời gian chờ và các lựa chọn khác; tuyến thực có thời gian chạy/điểm đến khác nhau là báo giá khác.

## Tắt / quay lại

Tải Admin mới, xóa ô **Giá chờ/giờ khi lưu trú qua đêm** của loại xe cần tắt rồi lưu. Server nhận `null` và các báo giá mới quay lại cách tính cũ. Không ảnh hưởng chuyến đã đặt và báo giá đang giữ còn hạn. Không đổi về 0 để tắt: 0 là một mức giá giờ có hiệu lực.
