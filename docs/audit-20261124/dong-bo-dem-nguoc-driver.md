# Đồng bộ đếm ngược nhận chuyến Driver — 24/11/2026

## Vấn đề và thay đổi

Trước đây, Dashboard dùng `driverAcceptOpenAt - Date.now()` trên điện thoại và cập nhật mỗi giây. Điện thoại lệch giờ làm nút mở sớm hoặc muộn; callback bị trễ khiến thời gian hiển thị cũ hơn thực tế. API vẫn dùng giờ máy chủ để chặn nhận trước mốc.

API danh sách chuyến chờ nhận bổ sung hai trường ISO có mili giây: `serverReceivedAt` (lúc vào handler) và `serverTime` (lúc tạo phản hồi). Hình dạng danh sách và các trường cũ giữ nguyên, kể cả danh sách rỗng.

Driver đồng bộ từ phản hồi đó và tính thời gian trôi qua bằng `performance.now()`. Sau đồng bộ, chỉnh đồng hồ điện thoại không làm thay đổi đếm ngược. Ước lượng độ trễ bằng nửa thời gian khứ hồi sau khi trừ thời gian xử lý handler; ưu tiên mẫu có độ trễ thấp trong một phút, bỏ phản hồi chồng lấn cũ, mẫu sai hoặc kéo dài quá mười giây.

Đồng bộ dùng chính các lần tải danh sách đã có: khi mở màn hình, kéo tải lại, có sự kiện chuyến, polling lúc foreground và khi trở về từ nền. Không thêm endpoint, OTP hoặc lượt gọi mạng riêng để lấy giờ.

Dashboard kiểm tra hiển thị mỗi 250 ms khi đang mở, chỉ cập nhật state khi số giây của một chuyến thay đổi. Trở về foreground cập nhật ngay. Khi bấm nhận, kiểm tra giờ đồng bộ hiện tại thay vì dùng mốc của lần render cũ. API tiếp tục quyết định nhận chuyến theo giờ máy chủ.

## Triển khai

1. Chạy `ap_dung_dong_bo_dem_nguoc_driver_20261124.sh` để áp dụng mã vào repository hiện tại; script sao lưu trước sửa và không tự commit/deploy.
2. Kiểm tra diff, commit/push/deploy API theo quy trình hiện tại. Không có migration hoặc dependency mới. API mới tương thích Driver/Rider/Admin đang có trên Store.
3. Build/phát hành Driver Mobile mới vào tháng 12 để sử dụng đồng hồ mới. App Driver đang trên Store vẫn giữ cách đếm cũ cho tới khi cập nhật; deploy API riêng không đổi phần hiển thị của app cũ.
4. Nếu app mới gặp API cũ hoặc phản hồi thiếu giờ, danh sách vẫn tải theo định dạng cũ và dùng giờ điện thoại trước khi có mẫu hợp lệ. Vì vậy nên deploy API trước khi phát hành Driver.

## Kiểm thử

Chín ca riêng bao gồm hai máy nhanh/chậm năm phút, sửa giờ máy sau đồng bộ, callback ngừng lâu, thời gian xử lý API, mẫu chậm/cũ/sai, client phân trang và API cũ, phản hồi lỗi, controller thật trả giờ cho danh sách rỗng, nút nhận dùng thời gian hiện tại và trở về foreground.

Các kiểm tra callback nhận chuyến, đồng bộ danh sách, phân quyền nhìn chuyến và toàn bộ bộ kiểm tra dự án cũng được chạy. Kết quả: 872 mục, 820 đạt, 52 bỏ qua theo điều kiện môi trường, 0 lỗi. TypeScript Driver (`tsc --noEmit`) đạt. Installer được kiểm tra trước áp dụng, áp dụng vào clone riêng và chạy lại không thay đổi thêm.

## Giới hạn

Không thể đảm bảo hai máy hiển thị trùng tuyệt đối từng mili giây do mạng hai chiều có thể bất đối xứng, middleware trước handler, hệ điều hành và việc vẽ màn hình. Bản sửa loại bỏ sự lệch do giờ điện thoại sau đồng bộ và hạn chế trễ hiển thị; mạng vẫn ảnh hưởng lúc yêu cầu nhận chuyến tới server. Chưa kiểm thử trên hai thiết bị iOS/Android thật hoặc deploy production.
