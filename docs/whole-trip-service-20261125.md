# Gói phục vụ cho cả chuyến — 25/11/2026

Khách chọn một trong hai gói **Tiêu chuẩn** hoặc **Bao xe** cho toàn bộ thời gian lưu trú tại điểm đến. Web và Rider Mobile bỏ chọn theo từng ngày, giá gói/ngày, tổng phụ phí gói và nhãn “Đã bao gồm trong giá”. Khách xem tổng giá chuyến sau khi tính giá. Mô tả phạm vi, giờ phục vụ và giới hạn số giờ vẫn được giữ để khách hiểu dịch vụ.

Driver và Admin dùng bản tóm tắt gói, không liệt kê lịch từng ngày. Driver vẫn thấy tổng “Phụ phí phục vụ tour” đã chốt trong snapshot của chuyến, áp dụng cho cả Tiêu chuẩn và Bao xe. Chuyến cũ chỉ có tiền Bao xe mà chưa có tổng phí tour hiển thị đúng khoản đã biết, không suy đoán thêm tiền chờ/nghỉ đêm.

## Quy tắc đặt và tính giá

- Client mới gửi `destinationServiceMode: STANDARD | CHARTER`. Server tự suy ra toàn bộ khung Bao xe hợp lệ trong thời gian lưu trú khi chọn CHARTER. Danh sách ngày do client gửi kèm không thu hẹp gói.
- Ngày đến và ngày về vẫn áp dụng theo thời gian thực tế trong khung giờ đã cấu hình. Ngày không có giờ phục vụ hợp lệ không sinh thêm khung Bao xe. Giới hạn tối đa số giờ/ngày, bán kính và mô tả đã cấu hình được giữ.
- Các phép tính nội bộ, đơn giá, giảm trừ tiền chờ, phụ thu, làm tròn và snapshot phí không thay đổi. Gói Bao xe mới tương đương chọn tất cả ngày hợp lệ bằng cách cũ.
- Kéo dài ngày về khi đang chọn Bao xe tự mở rộng gói theo lịch mới và phải tính giá lại. Đổi gói, lịch trình, thời gian hoặc loại xe làm mất hiệu lực báo giá đang hiển thị; token giữ giá ràng buộc những lựa chọn này.
- CHARTER không có khung phục vụ hợp lệ hoặc mode sai bị từ chối. Giao diện mới không chấp nhận báo giá Bao xe từ API cũ chưa hiểu mode.
- Áp dụng chung 5/7/16 chỗ; không tự bật xe 16 chỗ hay chỉnh cấu hình giá.

## Tương thích chuyến và app cũ

Request không có mode vẫn giữ quy tắc chọn ngày cũ, snapshot phiên bản 3 và hash giữ giá cũ. Request có mode dùng snapshot phiên bản 4. Báo giá còn hạn, OTP draft và chuyến đã đặt giữ nguyên giá và phạm vi đã xác nhận.

Lịch cũ chỉ Bao xe một số ngày được tóm tắt “Bao xe theo lịch đã xác nhận”, không tự biến thành Bao xe toàn bộ chuyến. Dữ liệu lịch và giá từng ngày cũ vẫn lưu nguyên trong snapshot để đối chiếu.

## Áp dụng

1. Chạy installer để cập nhật mã trong repository rồi kiểm tra diff.
2. Deploy/khởi động lại API trước, sau đó build và deploy Web theo quy trình hiện có. Không cần migration hoặc generate Prisma.
3. Build Rider Mobile và Driver Mobile mới để giao diện gọn xuất hiện trên điện thoại. Admin Mobile dùng chung hàm tóm tắt nên cũng nhận thay đổi khi build lại. App đang cài bản cũ vẫn hiển thị giao diện cũ và tiếp tục dùng được API tương thích.
4. Không tự commit, push, gửi SMS/push hoặc thay đổi DB trong installer.

## Kiểm tra đã thực hiện

- Toàn bộ bộ kiểm tra: 994 tests, 942 đạt, 52 bỏ qua theo điều kiện môi trường, 0 lỗi.
- Build production Web đạt; TypeScript Rider, Driver và Admin Mobile đạt.
- Kiểm tra HTTP quote → giữ giá → đặt chuyến cho 5/7/16 chỗ, cả hai gói; đổi mode với token cũ bị từ chối. Kiểm tra public quote → OTP draft, không gửi SMS thật.
- Kiểm tra báo giá cũ theo ngày và lịch Bao xe một phần, giờ đến/về ngoài khung phục vụ, nội dung khách không có phụ phí, phí tổng Driver được giữ.
- Xem thử component Web thật bằng Chrome ở kích thước desktop và 390px: hai lựa chọn, tổng giá đổi theo gói, không tràn ngang hoặc hiện giá theo ngày. Đây là bản xem thử với dữ liệu giả lập, chưa phải production.
