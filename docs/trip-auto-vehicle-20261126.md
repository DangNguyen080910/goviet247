# Lọc xe theo yêu cầu khách khi tự duyệt — 26/11/2026

Bản bổ sung trên nền tính năng tự duyệt ở commit 7b25977. Áp dụng cho cả chuyến mới và chuyến tài xế huỷ được đưa về chờ duyệt. Không thêm công tắc, không đổi giá và không thêm migration.

## Quy tắc

| Khách đặt | Xe được nhận |
| --- | --- |
| 5 chỗ | 5, 7, 16 chỗ |
| 7 chỗ | 7, 16 chỗ |
| 16 chỗ | 16 chỗ |
| Xe xăng | Chỉ xe xăng |
| Xe điện | Chỉ xe điện |
| Không yêu cầu nhiên liệu | Cả hai; hồ sơ chưa có nhiên liệu vẫn được xét nếu đủ số chỗ |

Phải đồng thời thoả số chỗ và nhiên liệu. Hồ sơ thiếu/không xác định loại xe không được nhận. Các nhãn cũ như “Xe 7 chỗ” vẫn được nhận diện. Xe lớn hơn nhận theo giá và loại xe khách đã đặt, không tự nâng giá.

Tự duyệt chỉ chọn hồ sơ đã VERIFIED, đã xác nhận tỉnh hoạt động trong miền điểm đón và không bị khoá nhận chuyến. Danh sách được đọc lại trong giao dịch sau khi kiểm tra địa chỉ. Không có tài xế phù hợp thì giữ chờ duyệt, ghi lý do và gửi thông báo điều hành; không dùng danh sách rỗng vì danh sách rỗng có nghĩa là công khai trong hệ thống hiện tại.

## Thực thi trên máy chủ

- Một chính sách dùng chung cho tự duyệt, push chuyến mới và kiểm tra lúc nhận.
- Danh sách chuyến lọc loại xe/nhiên liệu ở truy vấn trước phân trang. Vẫn giữ ràng buộc tài xế chỉ định/miền đã duyệt.
- Lúc bấm nhận, API đọc hồ sơ xe mới nhất dưới khoá hồ sơ, đọc chuyến dưới khoá chuyến, kiểm tra yêu cầu trước giới hạn chuyến đang chạy và trước mọi thao tác ví/nhận chuyến.
- Push dùng yêu cầu của chuyến đang lưu trong DB và hồ sơ xe hiện tại, giới hạn trong danh sách đã duyệt. Job cũ không bỏ qua bộ lọc.
- Ràng buộc danh sách/nhận/push áp dụng cả chuyến duyệt tay hoặc đã duyệt trước đó. Admin chọn tài xế khác nhiên liệu hoặc thiếu số chỗ không còn cho phép vượt yêu cầu khách.
- Không mở rộng lại danh sách tự duyệt khi một tài xế mới đổi xe/khu vực; việc đổi hồ sơ thành không phù hợp sẽ bị chặn ở feed/nhận/push. Các chuyến đã nhận không bị thay đổi.
- Giữ nguyên cơ chế thông báo điều hành khi tự duyệt và mốc mở nhận chung cho tất cả người nhận của chuyến.

App Driver cũ vẫn bị API chặn khi nhận sai xe. App cũ có thể còn card được lưu hoặc thông báo đã gửi trước lúc triển khai; khi tải lại danh sách/bấm nhận, máy chủ áp dụng quy tắc mới. Socket cho chuyến tự duyệt phát theo danh sách đã lưu; nếu đổi xe sau đó, feed và API nhận vẫn kiểm tra lại.

## Áp dụng

1. Chạy `ap_dung_loc_xe_tu_duyet_20261126.sh --check` ở Mac để đối chiếu trước. Script có hash từng file, không ghi đè thay đổi khác, sao lưu trước sửa và chạy lại không áp dụng trùng.
2. Áp dụng bản vá, xem diff, commit/push theo quy trình hiện tại.
3. Triển khai/khởi động lại API và build/deploy Web. Bản bổ sung này không cần migration hoặc generate Prisma mới; nền tự duyệt trước đó phải đã được triển khai.
4. Build Admin Mobile để cập nhật câu giải thích điều kiện xe. Build Driver Mobile để hiện lý do từ chối cụ thể mới. Không cần build Driver/Rider để thực thi lọc và chặn nhận sai xe trên API.

Script chỉ cập nhật mã nguồn, không bật công tắc tự duyệt, không kết nối DB, không gửi push, không commit/deploy.

## Kiểm tra

- Toàn bộ suite an toàn: 1.064 tests, 1.011 pass, 53 skip, 0 fail. Các kiểm tra PostgreSQL thật là opt-in và không chạy khi thiếu DB thử cục bộ.
- Ma trận số chỗ/nhiên liệu gồm hồ sơ thiếu dữ liệu và nhãn loại xe cũ; đối chiếu chính sách với bộ lọc SQL.
- Chạy thân controller thật: từ chối không phù hợp trước ví/claim; xe 5/7/16 nhận chuyến 5 chỗ giữ giá và chỉ giữ ví đúng một lần.
- NEW/REQUEUE × 5/7/16 × ANY/xăng/điện; không có xe phù hợp; xe đổi nhiên liệu trong lúc xác minh bản đồ; push theo dữ liệu hiện tại; phân trang không giấu chuyến hợp lệ sau các chuyến không phù hợp.
- Web production build; TypeScript Admin Mobile và Driver Mobile đạt. Vite có cảnh báo kích thước bundle sẵn có.
- Chưa triển khai production hoặc gửi thông báo thật.
