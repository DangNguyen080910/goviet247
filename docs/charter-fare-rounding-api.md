# Làm tròn tổng giá khi chọn Bao xe — API

Bản vá dựa trên `6af08d8` (Day 318A).

## Nguyên nhân và thay đổi

API trước đây làm tròn cước xe về mốc 10.000đ rồi mới cộng phí Bao xe tại điểm đến. Phí Bao xe theo thời gian phục vụ thực tế có thể lẻ, nên tổng cuối cùng lại lẻ.

Sửa trong `apps/api/src/services/pricingService.js`: cộng tất cả khoản phí vào `rawTotal`, sau đó làm tròn tổng cuối cùng **một lần** về mức 10.000đ gần nhất, giữ quy tắc Math.round hiện có (đúng nửa mốc thì lên).

Ví dụ trong ảnh: cước 1.580.000đ + phí Bao xe 1.064.286đ = 2.644.286đ → tổng thanh toán **2.640.000đ**.

Phí chi tiết từng ngày vẫn tính đúng theo thời gian phục vụ, không làm tròn riêng từng khoản. Phí Bao xe không bị cộng thêm % nhiên liệu, lễ/Tết hoặc miền; các cơ sở tính phụ thu không đổi. Giá báo và luồng tạo chuyến cùng dùng pricingService; booking wrapper trả lại tổng đã làm tròn. Không có thao tác cập nhật giá các chuyến đã lưu trong DB.

## Phát hành

- Áp dụng patch bằng script cùng thư mục.
- Chỉ deploy/restart API theo quy trình hiện tại. Không cần build lại Web, Web Partners hoặc các app Mobile cho thay đổi này.
- Không thêm dependency, cấu hình hay migration DB.
- Sau deploy, bấm Tính giá lại để lấy giá mới. Bản vá không tự deploy production.

## Kiểm tra

48 kiểm thử thành công: tái hiện đúng hai ngày Bao xe trong ảnh, làm tròn lên/xuống/đúng nửa mốc, tổng đã tròn, Bao xe miễn phí/nguyên ngày, chuyến không chọn Bao xe/một chiều, phụ thu nhiên liệu/lễ/Tết/miền, dữ liệu dịch vụ và luồng tạo chuyến cùng dùng giá đã làm tròn. Đã kiểm tra các bộ destination service, regional pricing flow/visibility, booking safety và rider pricing. Kiểm thử dùng dữ liệu giả lập, không ghi DB production.
