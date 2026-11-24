# Thông tin xe trong các chuyến — Admin Mobile, 24/11/2026

## Giao diện

Hiển thị riêng yêu cầu của khách và xe tài xế đang đăng ký, gồm loại xe/số chỗ, hãng/dòng xe, màu, đời xe, nhiên liệu và biển số. Biển số có nút Copy. Thông tin thiếu hiện “Chưa cập nhật”; chưa có tài xế hoặc chưa có hồ sơ xe được giải thích riêng.

| Vị trí | Cách xem |
|---|---|
| Chuyến tài xế đã nhận: đã nhận, đã liên hệ, đang đi, hoàn thành, đã huỷ | Thẻ thông tin xe hiển thị trực tiếp trên từng chuyến và trong chi tiết |
| Chờ duyệt / Chưa có tài xế và các tab đã huỷ | Nút Thông tin xe trên thẻ; thông tin hiển thị trực tiếp trong chi tiết |
| Cảnh báo, ví tài xế / giao dịch / phạt, hoa hồng, thư góp ý, lịch sử tính giá đã liên kết chuyến | Nút Thông tin xe cạnh lịch sử chuyến |
| Tin nhắn chuyến | Nút Thông tin xe trong đầu hội thoại và khi xem chi tiết chuyến |
| Màn lịch sử chuyến | Nút Thông tin xe ngay trong màn lịch sử |

Nút lấy dữ liệu chuyến hiện tại khi mở, có Tải lại/Đóng và trạng thái tải/lỗi. Không gọi thêm API cho từng mã chuyến khi vẽ ví, cảnh báo hay hội thoại. Phản hồi đến muộn sau khi chuyển mã chuyến hoặc đóng màn bị bỏ qua; phản hồi có mã chuyến khác bị báo lỗi.

Nhãn “Xe tài xế đang đăng ký” và ghi chú “Thông tin theo hồ sơ hiện tại của tài xế” phân biệt dữ liệu hiện tại với hồ sơ xe tại thời điểm chuyến cũ. Chưa bổ sung ảnh chụp hồ sơ xe vào lịch sử từng chuyến trong phạm vi này.

## Mã và API

- API danh sách chuyến đã nhận bổ sung các trường xe vào select `driver.driverProfile` hiện có. Không tạo thêm truy vấn theo từng tài xế và không thay cấu trúc phản hồi cũ.
- API chi tiết Admin đã trả đủ thông tin xe; các adapter Mobile nay giữ lại thay vì bỏ mất dữ liệu. Yêu cầu khách (`carType`, `fuelPreference`) không dùng làm thông tin xe thực của tài xế.
- Dùng API Admin hiện có và quyền truy cập hiện có. Phần triển khai chỉ thay Admin Mobile và dữ liệu của API danh sách Admin; không thêm migration hoặc dependency.

## Áp dụng và phát hành

Chạy `ap_dung_thong_tin_xe_admin_mobile_20261124.sh`, kiểm tra diff, commit/push theo quy trình hiện tại. Script sao lưu file trước sửa, không tự build hoặc deploy.

Deploy API trước để danh sách chuyến có đủ thông tin xe. Các app đang trên Store tiếp tục hoạt động. Build/phát hành Admin Mobile mới trong tháng 12 để thấy giao diện mới; API riêng không thể bổ sung giao diện vào app cũ. Không cần build Web/Rider/Driver cho tính năng này.

## Kiểm thử

- Kiểm tra xe thực khác yêu cầu của khách: giữ tách biệt số chỗ và nhiên liệu.
- Hồ sơ thiếu hoặc chưa có tài xế không bị lấy nhầm thông tin khách làm xe thực.
- Bốn adapter danh sách/chi tiết giữ đầy đủ dữ liệu xe.
- Mọi trạng thái danh sách Admin lấy thông tin xe trong truy vấn sẵn có.
- Nút tải theo nhu cầu, bỏ phản hồi cũ và phản hồi sai mã chuyến.
- Kiểm tra hồi quy lộ trình khứ hồi, TypeScript Admin và bộ kiểm tra toàn dự án.

Kết quả: 878 mục, 826 đạt, 52 bỏ qua theo điều kiện môi trường, 0 lỗi. TypeScript Admin (`tsc --noEmit`) đạt; 16 kiểm tra tập trung về xe/lộ trình đạt. Installer được kiểm tra trước áp dụng, áp dụng vào clone riêng và chạy lại không thay đổi thêm. Chưa deploy production hoặc kiểm thử giao diện trên điện thoại thật.
