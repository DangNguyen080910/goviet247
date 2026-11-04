# Day 315A — Thông báo tin nhắn — 04/11/2026

## Trạng thái bản sửa

Đã cập nhật **API local** theo yêu cầu Đ. **Đ tự deploy**, chưa sửa hệ thống đang chạy hoặc phát hành app/web từ công việc này.

API ngừng gửi push loại `TRIP_CHAT` đến Admin/Staff của GoViet247. Admin Mobile chỉ báo tin qua cơ chế trong app khi mở app. Những tài khoản Admin công ty đối tác là nhóm `partner-*` riêng; không bị hiểu nhầm thành Admin GoViet247.

Không thay đổi quyền xem hội thoại, tin đã đọc/chưa đọc, danh sách tin, nội dung tin hoặc đăng ký thiết bị. Giữ nguyên push chat của khách/tài xế đủ điều kiện và các thông báo ngoài chat như chuyến mới, thay đổi chuyến, cảnh báo và ví.

### File triển khai

- `apps/api/src/services/tripAcceptanceChat.js`: không đưa Admin/Staff GoViet247 vào danh sách người nhận push chat; vẫn giữ đối tác và các bên đúng quyền.
- `apps/api/src/services/tripChatService.js`: chặn thêm người nhận/thiết bị `admin-*` tại lớp gửi push, bỏ nhánh gửi chat riêng cho thiết bị Admin.
- Deploy hai file cùng phiên bản và khởi động lại toàn bộ tiến trình API/worker đang chạy code đó. Không cần migration, biến môi trường mới hay build lại app/web **cho riêng thay đổi này**.
- Tin đang chờ trong hàng đợi cũng dùng quy tắc mới khi được xử lý; tin đã chuyển tới dịch vụ push trước lúc cập nhật có thể vẫn đến. Bản sửa không thu hồi các thông báo đã hiện trên điện thoại.

## Bảng xử lý theo code hiện tại

| Nơi sử dụng | Khi đang mở | Khi chạy nền / đóng | Âm tin nhắn |
|---|---|---|---|
| Admin Mobile | Hiện số chưa đọc; kiểm tra hộp thư khoảng 15 giây/lượt. Hội thoại đang mở kiểm tra khoảng 4 giây/lượt. Tin được phát hiện có thể phát chuông/rung trong app. | Sau khi deploy API mới: không gửi push chat ra màn hình khóa/trung tâm thông báo. Mở lại app sẽ tải hộp thư. | File chung `apps/mobile-chat/assets/chat_notice.wav`. |
| Driver Mobile | Push có thể báo tin sớm; có cơ chế kiểm tra trong app 15 giây/lượt, trong hội thoại 4 giây/lượt. Đang xem đúng hội thoại thì ẩn banner push và vẫn có âm báo trong app cho tin mới. | Vẫn có push chat nếu đủ quyền, phiên thiết bị hợp lệ, tin chưa đọc và hệ điều hành cho phép. | Đang mở: `chat_notice.wav`. Push nền: âm mặc định hệ điều hành. |
| Rider Mobile | Cùng cơ chế chuông chung và chu kỳ 15 giây/4 giây như Driver. Đang xem đúng hội thoại thì không hiện banner push của chính hội thoại đó. | Vẫn có push chat theo quyền thông báo, phiên và trạng thái tin/chuyến. | Đang mở: `chat_notice.wav`. Push nền: âm mặc định hệ điều hành. |
| Web Admin | Số tin chưa đọc, báo tin trong trang và chuông; hộp thư khoảng 10 giây/lượt, hội thoại mở khoảng 4 giây/lượt. | Tab còn mở nhưng bị ẩn: vẫn có thể hiện thông báo trình duyệt nếu được cấp quyền. Đóng tab: không có Web Push trong code hiện tại. | Chuông được tạo bằng Web Audio trong `apps/web/src/components/TripChatHub.jsx`. |
| Web khách | Dùng chung `TripChatHub`, cách kiểm tra và âm báo giống Web Admin. | Cần tab còn mở để kiểm tra tin; thông báo khi tab ẩn tùy quyền trình duyệt. Không có push sau khi đóng tab. | Web Audio, cùng hàm `quietTone()`. |
| Web đối tác và cổng quản trị đối tác | Dùng lại `TripChatHub`; số chưa đọc, chuông và báo trong trang, chu kỳ 10 giây/4 giây. | Cùng giới hạn tab còn mở và quyền thông báo của trình duyệt. | Web Audio, cùng hàm `quietTone()`. |

**Lưu ý:** tắt push Admin Mobile bằng API không tắt thông báo desktop của Web Admin. Web Admin tự gọi `new Notification(...)` khi tab ẩn. Muốn đổi riêng hành vi web này cần sửa và triển khai web; bản sửa hiện tại chỉ xử lý Admin Mobile như đã thống nhất.

Các chu kỳ trên là thời gian đặt trong code, không cam kết độ trễ tối đa: còn phụ thuộc mạng, thời gian API trả dữ liệu, hệ điều hành và việc trình duyệt hạn chế tab nền. Bảng mô tả mã nguồn hiện có; bản app cũ đang cài có thể chưa chứa toàn bộ thay đổi giao diện/âm thanh ở các đợt trước.

## Âm thanh đang dùng và vị trí

### Chuông trong ba app điện thoại

- File: `apps/mobile-chat/assets/chat_notice.wav`.
- Chuông WAV ngắn tạo riêng cho app, **0,45 giây**, mono, 22.050 Hz; không phải bài nhạc có tên thương mại.
- Nơi phát: `apps/mobile-chat/chatAlerts.ts`, hàm `playChatAlert()`; âm lượng đặt ở 0,75 rồi còn chịu mức âm lượng của thiết bị.
- Cùng một file được Admin/Driver/Rider dùng qua module chat chung.
- Có rung haptic, chặn phát lặp cùng ID tin nhắn và giới hạn các tiếng báo sát nhau khoảng 1,5 giây. Khi đang ghi âm, âm chat được chặn để tránh lọt vào bản ghi.
- Audio mode hiện đặt `playsInSilentModeIOS: true`: tiếng trong app có thể phát khi iPhone ở chế độ im lặng, tùy cài đặt âm thanh thực tế. Điều này khác với âm push do hệ điều hành xử lý.

### Chuông push khi Driver/Rider ở nền

- API gửi `sound: 'default'` vào kênh Android `trip_chat_default_v1`.
- Đây là âm thông báo do hệ điều hành/kênh thông báo quyết định; không có file WAV/MP3 riêng của dự án cho âm `default` này. Người dùng có thể đã đổi/tắt âm kênh trên điện thoại.
- Driver còn khai báo kênh cũ `trip_chat_v1` với `new_trip.wav`; API chat hiện tại dùng `trip_chat_default_v1`, vì vậy không lấy kênh cũ làm bằng chứng âm chat đang phát.
- Admin sẽ không nhận push chat mới sau khi API mới có hiệu lực. Các kênh/âm cho thông báo khác vẫn được giữ.

### Chuông trên web

- Không dùng file MP3/WAV cho tiếng chat.
- Hàm `quietTone()` trong `apps/web/src/components/TripChatHub.jsx` tạo âm 740 Hz, chuyển sang 988 Hz ở giây 0,16, dừng ở giây 0,5; âm nhỏ dần.
- Cách nhau tối thiểu khoảng 2 giây giữa các tiếng. Cần người dùng tương tác để trình duyệt mở quyền phát âm; có nút bật âm/thông báo.
- Website khách, Web Admin và hai giao diện cổng đối tác dùng chung đoạn này.

Âm duyệt chuyến mới của Admin (`apps/admin-mobile/assets/sounds/duyetChuyen.mp3`) là thông báo chuyến mới riêng; bản sửa tắt push chat không thay đổi phần này.

## Kiểm tra

**30/30 kiểm thử liên quan đạt**, cùng kiểm tra cú pháp hai file API và `git diff --check`:

```sh
node --test tests/chat-admin-push.test.mjs tests/trip-acceptance-chat.test.mjs tests/chat-alert-sound.test.cjs tests/chat-push-session-expiry.test.mjs tests/chat-push-transport.test.mjs
```

Bao gồm: Admin/Staff không nhận push kể cả khi bị đưa nhầm vào danh sách thiết bị; tin chỉ có người nhận Admin được hoàn tất mà không lặp mãi; khách/tài xế vẫn nhận; Admin gửi tin vẫn báo cho các bên khác; công ty đối tác giữ người nhận riêng; tin đã đọc, phiên hết hạn và quyền riêng tư vẫn được lọc; chuông trong app hoạt động độc lập với push và được chống phát trùng.

Không gửi push thật, không thử phát âm trên thiết bị vật lý và không deploy trong công việc này. Sau khi Đ deploy, nên thử một tin khi Admin mở app và một tin khi Admin đã đưa app về nền; đối chiếu thêm Driver/Rider để xác nhận các bên đó vẫn nhận push.
