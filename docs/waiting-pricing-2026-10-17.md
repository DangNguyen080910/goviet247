# Giá chờ theo bậc km và nghỉ đêm khứ hồi

## Cấu hình

- Mỗi bậc `kmTiers` có thêm `pricePerWaitHour`. `null` dùng giá chờ dự phòng `pricePerHour`; `0` là miễn phí.
- Dùng tổng km cả chuyến để chọn một giá chờ. Tại ranh giới dùng bậc trước: 0–50, trên 50–100.
- Tiền chạy/km vẫn tính lũy tiến như cũ. Chuyến một chiều không áp dụng giá chờ theo bậc.
- `roundTripWaitingConfig` lưu số phút miễn phí và quy tắc nghỉ đêm. Giá trị mặc định: 60 phút miễn phí; khung 22h–6h, ít nhất 4 giờ chờ trong mỗi khung đêm.
- Chỉ khoảng từ lúc dự kiến đến điểm cuối tới giờ bắt đầu quay về được tính là chờ. Thời gian lái xe không được tính để đạt ngưỡng nghỉ đêm.
- Mỗi khung đêm đạt ngưỡng tính một phụ phí. Chỉ phần chờ thực sự nằm trong khung đêm đủ điều kiện được loại khỏi tiền chờ giờ. Phần còn lại trừ thời gian miễn phí một lần mỗi chuyến, sau đó làm tròn lên giờ.
- Nếu bậc xa có giá chờ thấp hơn, giữ tổng tiền chạy và chờ không thấp hơn giá ở các ranh giới đã vượt. Chênh lệch nằm trong `waitingTierAdjustment`, cộng vào `waitCost`; `hourlyWaitCost` là phần giá giờ thuần.
- Báo giá trả thêm `overnightCoveredMinutes`, `hourlyWaitMinutes`, `billableWaitHours`, `waitingRules`, `hourlyWaitCost`, `waitingTierAdjustment`.
- Một chiều vẫn dùng ngưỡng km hoặc giờ lái hiện tại cho phụ phí; giao diện đã ghi rõ các ô này chỉ dành cho một chiều.
- Bậc km cũ chưa có giá chờ riêng tiếp tục dùng giá dự phòng. Chưa tự tăng giá chờ của bất kỳ loại xe nào. Quy tắc nghỉ đêm mới áp dụng cho báo giá khứ hồi sau khi API mới chạy, kể cả khi cấu hình JSON còn null.
- Không tự tính lại giá những chuyến đã lưu. Các thao tác báo giá lại sau cập nhật dùng công thức mới.

## Thứ tự cập nhật máy chủ

Sau khi đưa đầy đủ mã và migration mới lên máy chủ, dùng môi trường/biến kết nối DB hiện có của API. Tại thư mục `apps/api`:

```sh
pnpm exec prisma migrate deploy --schema prisma/schema.prisma
pnpm exec prisma generate --schema prisma/schema.prisma
```

Chỉ tiếp tục khi cả hai bước thành công. Migration thêm một cột JSONB nullable, không cập nhật giao dịch hay giá chuyến cũ. Không dùng `db push` thay migration.

Sau đó build web bằng quy trình triển khai hiện có và khởi động lại API. Không cần cài thư viện mới. Client Prisma ở máy local đã được tạo lại; database máy chủ chưa được thay đổi trong lúc sửa mã.

Trong Cấu hình > Giá cước, mỗi loại xe có thêm cột Giá chờ/giờ và khu vực Chờ và nghỉ đêm. Nhập mức tiền mong muốn rồi Lưu. Để trống giá ở bậc nếu muốn dùng giá dự phòng.

## Trường hợp cần đối chiếu trước khi áp dụng giá kinh doanh

- Khứ hồi 21h → 1h sáng: chưa đủ 4 giờ chờ trong khung 22h–6h, không phụ phí nghỉ đêm.
- Đến điểm cuối 22h, quay về 7h: một khung đêm đủ điều kiện; 8 giờ đêm được bao gồm trong phụ phí, một giờ chờ còn lại được miễn theo cấu hình mặc định.
- Tới điểm cuối 4h sáng, quay về 7h: hai giờ trong khung đêm chưa đạt ngưỡng; tính chờ giờ theo cấu hình.
- Chờ nhiều đêm: xét từng khung đêm riêng, không dựa trên số lần đổi ngày.
- Giữ cùng thời gian chờ khi so sánh hai phía ranh giới 50/100/150/200 km; tổng tiền chạy và chờ không giảm khi tăng km.
- Chuyến một chiều và chuyến đã lưu không bị cộng giá chờ mới.

Đã kiểm tra cú pháp, Prisma schema và build web. Chưa chạy thử nghiệp vụ trên cơ sở dữ liệu hoặc máy chủ thật.
