# Mở thông báo đúng tin và giảm gửi trùng — 07/11/2026

## Kết quả rà soát và sửa local

- Trước đây push chat có messageId nhưng app chỉ dùng tripId. Driver, Rider, Admin nay giữ messageId khi bấm thông báo, tải trang chứa tin đó, cuộn và viền nổi bật tin được chọn; hỗ trợ tin cũ ngoài 50 tin gần nhất. API kiểm tra quyền với chính tin được dùng làm mốc, không mở rộng quyền đọc.
- Sau khi mở tin cũ, polling tải tiếp tuần tự các trang mới hơn để không bỏ khoảng lịch sử ở giữa. Tin bị xóa giữ trạng thái xóa; tin không còn quyền truy cập hiện lỗi/quy định đóng hội thoại hiện hành.
- Ghi nhận cuộc gọi nhỡ đã tồn tại nhưng chưa có thông báo ngoài riêng. Push từ dòng lịch sử MISSED nay gửi người nhận cuộc gọi và Admin; người đặt dùm, người gọi và quản lý không trực tiếp nhận cuộc gọi không bị báo nhỡ. Payload có tripId, messageId và callId. Bấm mở đúng dòng cuộc gọi trong chat.
- Một thao tác bấm push có thể được trả về qua callback và kết quả khởi động. Ba app dùng chung chặn xử lý lại; Driver/Rider xóa last response sau xử lý, Admin bổ sung xử lý cold start.
- Nhận chuyến từng có push cập nhật trạng thái + push tin nhắn hệ thống, Admin còn nhận hai tin riêng hai phía. Giữ trạng thái cho khách/Admin, giữ một thông báo riêng cho tài xế vừa nhận. Đối tác đăng nhập riêng vẫn có thông báo thuộc phạm vi đối tác; không loại bỏ quyền chat.
- Tin hệ thống booking_created vẫn lưu trong chat, không tạo thêm push cạnh thông báo chuyến mới cho Admin. Tin chat thông thường giữ thông báo như hiện tại.
- Admin realtime từng tự tạo thông báo local cạnh remote push. Bỏ đường tạo local dư; realtime giữ refresh/badge, push phụ trách báo ngoài. Bỏ rung lặp trong trang Home. warmupAdminNotify không ghi đè handler chống trùng chat của root nữa.
- Giới hạn âm báo thay đổi chuyến Driver khi polling và socket cùng cập nhật trong 1,8 giây.
- Gộp các bản ghi thiết bị trùng push token cho chat và cập nhật trạng thái Rider. Tin ghi âm sẵn sàng cập nhật trong chat; không gửi thêm thông báo ngoài thứ hai sau thông báo kết thúc cuộc gọi.
- Worker chat lưu SHA-256 push token đã được Expo chấp nhận. Retry lỗi từng phần bỏ qua thiết bị đã xác nhận, bao gồm khi phải tách batch do khác Expo project. Không lưu thêm khóa hoặc token thô.

## Triển khai

Có **migration mới** `20261107030000_chat_push_delivery_receipts` thêm cột `TripChatMessage.pushDeliveredTokens` (mảng rỗng mặc định).

Sau khi Đ cập nhật mã nguồn server, chạy trong thư mục API trước khi restart API:

```sh
cd /home/ec2-user/goviet247/goviet247/apps/api
pnpm exec prisma migrate deploy
pnpm exec prisma generate
```

Lệnh migrate deploy chạy cả những migration đang chờ khác của repo, gồm tính năng gọi nếu chưa triển khai. Không thêm biến môi trường cho thay đổi đợt này. Cần cập nhật cả ba app để có điều hướng đến tin, cuộn và chống thông báo local dư. Không tự deploy hoặc migrate server trong đợt làm việc này.

## Giới hạn kiểm chứng

Kiểm tra tự động kiểm chứng payload, phân trang/quyền truy cập, recipient cuộc gọi nhỡ, chặn bấm hai lần, cuộn native theo layout, chống trùng token và retry sau thành công một phần. Schema Prisma validate và generate local; TypeScript ba app. Chưa gửi push thật hoặc chạy migration server. Cần thử máy thật: app mở/nền/đóng, tin cũ trên 50 tin, nhỡ cuộc gọi và nhận chuyến.

Expo chấp nhận push chưa đồng nghĩa thiết bị đã hiển thị. Nếu mạng ngắt sau nhà cung cấp nhận nhưng trước khi API nhận/lưu xác nhận, không thể cam kết tuyệt đối không lặp. Hai điện thoại hợp lệ cùng tài khoản nhận mỗi máy một thông báo là hành vi mong muốn.

## Bổ sung sau rà soát flow

- Người gọi cúp khi chưa được nghe: MISSED; người nhận chủ động từ chối trước 45 giây: REJECTED; kết thúc lúc hết chuông: MISSED. Android tự hết chuông đóng giao diện và để worker quyết định timeout, không gửi lệnh từ chối.
- Worker không áp mốc heartbeat 35 giây cho trạng thái RINGING; chờ đủ 45 giây. Các cuộc đã kết nối vẫn có bảo vệ mất kết nối.
- Mở tin cũ không tự đánh dấu các tin tải thêm là đã đọc khi chưa ở cuối hội thoại. Các trang sau tin được chọn tải tiếp sau 100ms thay vì đợi chu kỳ 4 giây.
- Nội dung xác nhận đón/trả ở Driver và ghi chú trạng thái API thống nhất gửi ảnh/định vị trong Liên hệ chuyến. Giữ yêu cầu xin phép khách khi chụp hình.
- 26 kiểm tra liên quan qua, TypeScript ba app qua. Chưa build native Android hoặc thử iPhone/Android thật. Sửa flow này không thêm migration/env ngoài migration xác nhận push đã nêu trên.
