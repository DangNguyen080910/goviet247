# Rider Mobile — chọn ngày về cùng ngày khi chưa chọn giờ

Ngày: 23/11/2026. Nền mã nguồn: 0750212.

## Lỗi đã tái hiện

- Chọn ngày về khi giờ về chưa được xác nhận: state mang tạm giờ hiện tại (ví dụ 07:22), và giao diện báo sai thứ tự ngày giờ quá sớm. Code hiện tại không có nhánh từ chối lưu ngày vì so sánh này; chưa kiểm tra binary Store đang cài.
- Trên iOS, hộp ngày mở sẵn ở ngày hôm nay. Nếu người dùng bấm Xong mà native picker không phát sự kiện thay đổi, handler cũ chỉ đóng hộp, không lưu ngày về. Test điều kiện không có sự kiện native đã thất bại trước sửa và đạt sau sửa. Chưa xác minh bằng thao tác trên iPhone thật.

## Thay đổi

- Xong trên iOS luôn lưu ngày đang hiển thị, kể cả không xoay bánh chọn.
- Chọn ngày không tự xác nhận giờ/buổi. Không hiển thị cảnh báo thứ tự khi khách chưa xác nhận đủ hai giờ.
- Nhắc chọn giờ/buổi còn thiếu; giữ việc chặn tính giá và đặt chuyến khi chưa đủ thông tin.
- Sau khi chọn đủ, vẫn kiểm tra giờ về không trước thời điểm xe dự kiến tới điểm đến, gồm cả chuyến qua đêm. Đổi ngày giữ giờ đã chọn, cho phép sửa tiếp.
- Chuyển sang Một chiều xoá cả giờ về và cờ xác nhận giờ về để không dùng nhầm giờ tạm khi chuyển lại Khứ hồi.

## Kiểm tra

26 ca đạt: tests/rider-return-date.test.cjs, tests/trip-time.test.mjs, apps/api/tests/vietnamDate.test.js. Kiểm tra màn hình thật bằng module JSX/handler thực tế, giả lập React/native/service ở biên; không dùng dịch vụ production. Có iOS/Android, cùng ngày 08:00–15:00, chưa chọn giờ, bấm Xong không đổi ngày, giờ về trước lúc đến, qua đêm, đổi ngày và huỷ hộp Android. TypeScript Rider Mobile và git diff --check đạt.

## Áp dụng/phát hành

Chỉ đổi Rider Mobile và thêm kiểm thử/tài liệu. Không thay API/Web, không migration, không thêm thư viện. Cần build/phát hành Rider Mobile hoặc đưa vào đợt cập nhật ứng dụng phù hợp; chỉ deploy API không sửa được app đã cài. Chưa build native, chưa phát hành Store hoặc deploy production.

Thử trên iPhone/Android thật: lúc 07:22 chọn đón 08:00; chọn ngày về cùng ngày, chọn 15:00; xác nhận ngày đang mở sẵn bằng Xong; kiểm tra trường hợp qua đêm và giờ về trước lúc tới nơi.
