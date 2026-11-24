# Tóm tắt xe dưới tên tài xế — 25/11/2026

Trong Chuyến Tài Xế Đã Nhận, Admin Web thay dòng Màu xe dưới tên tài xế bằng tóm tắt số chỗ, nhiên liệu và đời xe, ví dụ:

**Xe 7 chỗ · Xe điện · Đời 2024**

Admin Mobile hiển thị cùng nội dung ngay dưới thông tin liên hệ tài xế trên mỗi thẻ và trong chi tiết. Áp dụng tất cả tab: Chưa liên hệ khách, Chưa đón khách, Đang trên hành trình, Đã hoàn thành, Đã huỷ.

Hàm định dạng dùng chung nhận `driver.driverProfile` từ Web và `driverVehicle` từ adapter Mobile. Không dùng `carType` / `fuelPreference` của chuyến để suy ra xe tài xế; đó là yêu cầu của khách. Thông tin thiếu được ghi rõ Chưa cập nhật. Khối hồ sơ xe đầy đủ trong chi tiết tiếp tục phục vụ việc đối chiếu.

Dữ liệu là hồ sơ xe hiện tại, gồm cả khi xem chuyến cũ. API hiện có đã select các trường này từ bản bổ sung thông tin xe trước; gói này không đổi controller, schema, tiền hoặc điều kiện nhận chuyến.

## Áp dụng

Chạy `ap_dung_xe_tai_xe_da_nhan_20261125.sh`, kiểm tra diff và commit/push. Build/deploy Web để cập nhật bảng. Build/phát hành Admin Mobile trong tháng 12 để cập nhật app. Không có migration hoặc thay đổi API mới trong gói này. Installer kiểm tra hash trước/sau, sao lưu trước sửa, chặn ghi đè khi có xung đột và chạy lại không chèn thêm.

## Kiểm tra

- Đối chiếu thủ công định dạng cho xe xăng/điện, loại xe dạng mã và nhãn tiếng Việt, đời xe số/chuỗi, hồ sơ thiếu và xe tài xế khác yêu cầu khách: đạt.
- 16 kiểm tra hiện có về dữ liệu xe, adapter, API các trạng thái và lộ trình: đạt.
- Build Web và TypeScript Admin Mobile (`tsc --noEmit`): đạt.
- Chưa deploy production hoặc kiểm thử giao diện trên điện thoại thật.
