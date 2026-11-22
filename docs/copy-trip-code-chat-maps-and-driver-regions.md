# Copy mã chuyến, định vị chat và thống kê ba miền

Bản cập nhật dựa trên `46e2514` (Day 318A), ngày 22/11/2026.

## Thay đổi

- Nút **Copy** sao chép nguyên mã chuyến, giữ nguyên chữ hoa/thường, kể cả khi thẻ chỉ hiển thị mã rút gọn. Thao tác copy không mở thẻ, không chọn tài xế và không nhận chuyến. Có thông báo lỗi nếu clipboard không hoạt động.
- Dùng chung nút cho Driver, Rider và Admin Mobile; Admin Web, Rider Web và Web Partners. Bao gồm đầu hội thoại, danh sách hội thoại, chi tiết mở từ chat, danh sách/chi tiết/lịch sử chuyến, góp ý, cảnh báo, tham chiếu chuyến trong ví/sổ sách/hoa hồng/lịch sử tính giá và nhật ký chuyến của đối tác. Mã giao dịch, mã nhân viên, mã công ty không được coi là mã chuyến. Tài liệu in/PDF/Excel và thông báo hệ điều hành không thể có nút copy tương tác; copy nằm trong màn hình liên quan.
- Sửa nút copy cũ ở lịch sử Driver vốn chỉ dùng `navigator.clipboard`, có thể báo thành công trên native mà chưa chép gì.
- Chi tiết trong chat bỏ quãng đường ở cả API allowlist và phần dựng giao diện. Giữ nguyên toàn bộ điểm đón/đến/chặng quay về và dữ liệu tính cước; biểu mẫu đặt chuyến và báo cáo Admin khác không đổi.
- iPhone trong app: thử Google Maps nếu cài; mở không được/chưa cài thì dùng Apple Maps; nếu Apple Maps cũng không mở được thì dùng Google Maps trên web. Khai báo `comgooglemaps` trong Info.plist của cả ba app qua app.json.
- Android: dùng liên kết Google Maps; nếu hệ thống không mở được liên kết HTTPS thì thử ứng dụng xử lý `geo:`.
- Web: dùng Google Maps HTTPS/Universal Link, có nút **Mở bằng Apple Maps** riêng trên iPhone/iPad. Trình duyệt không cho kiểm tra chắc chắn app nào đã cài, nên không dùng bộ đếm giờ tự chuyển hướng gây mở hai bản đồ. Khi chưa cài Google Maps, liên kết Google mở bản đồ trong trình duyệt.
- Thống kê Tài Xế chia **Miền Bắc / Miền Trung / Miền Nam**, dùng đúng danh sách tỉnh của tính năng phát chuyến ba miền hiện có. Hồ sơ chưa xác nhận được tính riêng. Admin Mobile nhận tổng thống kê từ API, không đếm riêng mười hồ sơ của trang đang mở; bấm tỉnh để lọc, bấm Tất cả tỉnh/thành để bỏ lọc.

## Áp dụng và phát hành

1. Chạy script áp dụng cùng thư mục file patch; script chỉ chép thay đổi mã nguồn sau khi kiểm tra patch và không deploy tự động.
2. Tại gốc repo chạy `pnpm install --frozen-lockfile`. Rider Mobile mới khai báo trực tiếp `expo-clipboard` để native autolinking đúng, lockfile đã cập nhật theo phiên bản có sẵn trong workspace.
3. Build/deploy API và hai Web (`apps/web`, `apps/web-partners`) theo quy trình hiện tại. Không có migration mới cho bản cập nhật này.
4. Build lại **Admin Mobile, Driver Mobile, Rider Mobile** cho iOS/Android khi đến đợt phát hành. Đặc biệt iOS cần binary mới để nhận Info.plist và Rider cần native module clipboard; không chỉ phát JS OTA cho binary cũ. Không tự tăng Minimum version trước khi bản mới tải được trên store.
5. Bản vá không sửa cấu hình tạm cho nhận chuyến khi chưa ký V2.3.

## Kiểm tra thủ công trên thiết bị trước khi phát hành

- Copy ở thẻ chờ nhận, Đơn của tôi, lịch sử, chat, ví và màn hình đối tác: dán ra phải là mã đầy đủ; thao tác không kích hoạt nút/thẻ cha.
- iPhone có và không có Google Maps: gửi một vị trí rồi bấm mở; kiểm tra ghim đúng vị trí và quay lại chat bình thường. Thử cả trường hợp gỡ Apple Maps.
- Trình duyệt iPhone: liên kết Google Maps và nút Apple Maps; thử trong Safari và trình duyệt bên trong TikTok/Zalo, vì việc mở app ngoài còn chịu giới hạn của trình duyệt đó.
- Xác nhận chat không còn quãng đường nhưng vẫn đủ các điểm đến/chặng về; đặt chuyến vẫn tính quãng đường như cũ.
- Thống kê ba miền khớp tổng đã xác nhận, không cộng hồ sơ mặc định chưa xác nhận vào số đã xác nhận; đổi trang không làm thay đổi tổng thống kê.

## Tài liệu nền tảng

- Google Maps iOS URL Scheme: https://developers.google.com/maps/documentation/urls/ios-urlscheme
- Google Maps Universal URLs: https://developers.google.com/maps/documentation/urls/get-started
- React Native Linking: https://reactnative.dev/docs/linking

## Kết quả kiểm tra mã nguồn

- 77 kiểm thử thành công, không thất bại/không bỏ qua: clipboard native/web, định vị iPhone/Android và dự phòng, binding React Native Linking, thống kê đủ 34 tỉnh theo ba miền, dữ liệu chat không có quãng đường, đầy đủ các chặng và hồi quy chat.
- TypeScript không lỗi ở cả ba app mobile.
- Hai Web build production thành công (còn cảnh báo kích thước bundle có sẵn).
- Ba app export JavaScript iOS thành công; đã kiểm tra bundle chứa mã copy và Google Maps mới. Đây không phải IPA/Android binary đã phát hành.
- Native autolinking và khai báo dependency được kiểm tra cho iOS và Android ở cả ba app.
- Script đã thử áp dụng trên bản sao sạch, chạy lại an toàn và kiểm tra các file khớp mã nguồn.
- Chưa thử trên iPhone/Android thật và chưa tự deploy production.
