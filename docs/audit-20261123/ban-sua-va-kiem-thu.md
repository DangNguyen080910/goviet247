# Bản sửa sau rà soát — 23/11/2026

Bản sửa mã nguồn dựa trên commit `0750212`, giữ lại bản sửa chọn ngày về cùng ngày đã có trong máy Đ. Chưa triển khai lên production. Không gọi SMS, push, S3 hay DB production để kiểm thử.

## Những phần đã sửa

| # theo báo cáo rà soát | Thay đổi |
|---|---|
| 1 | POST tạo chuyến thông thường bắt buộc phiên đăng nhập hợp lệ. Khách đang đăng nhập dùng phiên đó; không gửi hoặc hỏi OTP lại. Luồng OTP khách chưa đăng nhập và luồng đối tác có xác thực riêng vẫn được giữ. |
| 2 | API xác minh địa chỉ/địa điểm và lấy tuyến từ dịch vụ bản đồ. Giá, quãng đường, phút di chuyển và tọa độ lưu chuyến lấy từ kết quả server, không lấy số client tự sửa. Có cache tuyến, địa điểm xác minh và danh mục địa điểm nội bộ. |
| 3 | Thiết bị nhận push chỉ đăng ký vai trò thuộc phiên đã xác minh. Push Admin kiểm tra tài khoản Admin hiện hành và phiên của thiết bị. |
| 4 | Parse multipart đúng một lần, sau đó mới kiểm tra quyền theo scope. Scope query/body khác nhau bị từ chối. Hạn chế kích thước, số phần upload và loại tệp. |
| 5 | Hồ sơ mới chỉ nhận tài liệu trong thư mục của chính tài xế. Link có chữ ký không được tạo cho key của tài khoản khác hoặc thư mục kế toán. Giữ quyền đọc tài liệu legacy `unknown-driver` đã gắn sẵn vào hồ sơ để tránh làm hỏng hồ sơ cũ. |
| 6 | Phiên Admin gắn phiên bản DB. Khoá tài khoản, đổi quyền/mật khẩu thu hồi token cũ; bật lại tài khoản không làm sống lại token đó. HTTP kiểm tra mỗi yêu cầu; socket kiểm tra lại mỗi 30 giây; push kiểm tra phiên thiết bị. Lỗi DB trả lỗi tạm thời, không biến thành yêu cầu OTP. |
| 7 | Kiểm tra khách bị khoá trước khi tạo chuyến, gồm tài khoản đặt và số khách đã xác thực liên quan. |
| 8 | Từ chối giờ đón không hợp lệ hoặc trong quá khứ ở đường tạo chuyến chính. |
| 9 | Thêm mã yêu cầu duy nhất, unique index và khoá giao dịch theo mã để gửi lại không tạo chuyến/trừ thao tác hai lần. Cùng mã nhưng đổi thông tin chuyến bị từ chối. |
| 10 | Cưỡng chế thời gian chờ gửi lại OTP tại server trước khi tạo/gửi mã. Giữ quy tắc chống lạm dụng hiện có. Dùng bộ sinh số ngẫu nhiên mật mã; không trả debug OTP trong production. |
| 11 | Luồng OTP đặt chuyến cũ lưu đầy đủ điểm đến và phút lượt đi. Chi tiết chuyến chung include danh sách điểm theo thứ tự. |
| 12 | Thêm phân trang có cursor cho chuyến Rider, chuyến đang mở và chuyến của Driver; client mới đọc đủ các trang. Client cũ không truyền phân trang nhận danh sách đầy đủ, tránh bị cắt ngầm 50/100 chuyến. |
| 13 | Các đường liên hệ bị phát hiện dùng số cũ nay chọn số đã xác thực mới nhất. Giữ nguyên thứ tự danh sách chuyến Admin. |
| 14 | Nhắc tài xế liên hệ ngay, chậm nhất 15 phút; bỏ nội dung 5 phút đang mâu thuẫn. |
| 15 | Giữ báo giá tại DB bằng token có hạn dùng và dấu vân tay lịch trình/giờ/xe/nhiên liệu/Bao xe. Báo giá còn hạn giữ đúng giá khi cấu hình đổi. Đổi thông tin hoặc dùng token mới hết hạn phải tính lại. |
| 16 | Vietmap lấy thời gian chặng cuối làm lượt về, phần còn lại làm lượt đi; không chia đôi tổng thời gian. Có kiểm thử tuyến nhiều điểm lệch thời lượng lượt đi/về. |
| 17 | Lịch sử tài xế Admin Mobile có ngày, giờ, phút theo giờ Việt Nam. |
| 18 | Tách tải các trang Admin, chat và form đặt xe Partners. Bundle chính Web giảm khoảng 1.604 kB → 1.115 kB; Partners khoảng 992 kB → 587 kB. Vẫn còn cảnh báo chunk lớn, gồm SDK gọi điện khoảng 1.144 kB tải riêng; chưa coi đây là tối ưu hiệu năng hoàn tất. |
| 19 | Cập nhật các fixture lỗi thời, bổ sung kiểm thử hồi quy và lệnh `pnpm test` tại gốc. Không vô hiệu kiểm thử để làm xanh bộ kiểm thử. |

Ngoài ra: thêm rate limit cho đăng nhập Admin, proxy bản đồ, tính giá, tạo chuyến và upload; timeout 8 giây cho dịch vụ bản đồ; ghi rõ “Giờ bắt đầu quay về”; giữ bản sửa ngày về Rider và tránh báo lỗi giờ trước khi chọn đủ giờ/buổi trên Web.

## OTP và tương thích bản app đang dùng

- Đã đăng nhập: tiếp tục dùng token/phiên hợp lệ để đặt chuyến, không yêu cầu OTP thêm. Kiểm thử HTTP chạy 10 yêu cầu đặt bằng phiên hợp lệ và không gọi gửi OTP.
- Chưa đăng nhập: vẫn phải xác thực OTP theo luồng hiện hành. Không mở lại lỗ tạo chuyến ẩn danh để né OTP.
- Không ép Rider/Driver đăng xuất do đợt sửa này. Không bật lại chặn hợp đồng Driver lúc nhận chuyến: `driverContractRollout.json` vẫn giữ `enforceForNewTrips: false` theo chỉ định của Đ.
- Admin cần đăng nhập lại bằng **mật khẩu một lần** sau nâng API; sau đó mở Admin Mobile để đăng ký lại thiết bị push. Đợt này không phát sinh SMS cho thao tác đó. Token Admin/thiết bị cũ bị loại chủ ý để vá quyền truy cập.
- App cũ còn gửi `quoteHistoryToken` tiếp tục dùng được báo giá server giữ. Không có token mới thì server xác minh tuyến và tính lại; các kiểm tra giá/ký nhận dịch vụ hiện hữu vẫn áp dụng.
- Chống gửi trùng cần mã yêu cầu ổn định. Client cũ có `quoteHistoryToken` được dùng mã này; client không gửi bất kỳ mã nào vẫn tương thích nhưng chưa có đảm bảo chống trùng. Không gộp hai chuyến giống nhau bằng suy đoán vì khách có thể đặt hai xe thật.

## Kiểm thử đã chạy

| Kiểm tra | Kết quả |
|---|---|
| Toàn bộ bộ kiểm thử unit/HTTP với dịch vụ giả lập | **810 ca: 760 đạt, 0 thất bại, 50 bỏ qua** |
| TypeScript Admin, Rider, Driver Mobile | Cả ba đạt |
| Production build Web và Web Partners | Cả hai đạt; còn cảnh báo chunk lớn như mô tả trên |
| Prisma validate và diff schema trước/sau | Đạt; DDL cột/bảng/index khớp migration viết kèm |
| Kiểm tra cú pháp JavaScript API và `git diff --check` | Đạt |

Đã bổ sung kiểm thử sửa quãng đường/thời gian client, giữ giá qua thay đổi cấu hình, token gắn thông tin chuyến, hết hạn, payload app cũ, gửi song song cùng mã, khách bị khoá, thu hồi phiên Admin, multipart thực, giả vai trò push Admin, OTP cooldown, quyền key tài liệu, đọc nhiều trang và thời gian Vietmap nhiều điểm.

**Giới hạn:** PostgreSQL thử riêng không khởi tạo được trong sandbox do hệ thống chặn shared memory. Migration SQL và đua giao dịch chưa chạy trên PostgreSQL thật; kiểm thử đồng thời dùng DB giả lập có mô hình khoá. 50 kiểm thử tích hợp cần môi trường riêng chưa chạy. Chưa kiểm thử trên điện thoại thật, APNs/FCM, SMS, S3 hoặc dịch vụ bản đồ thật. Không kết luận production đã được vá từ các kết quả local này.

## Thứ tự áp dụng

1. Áp dụng mã bằng script kèm bản vá. Script kiểm tra toàn bộ trước khi sửa, có bản sao lưu; không tự deploy hoặc chạy migration.
2. Trên môi trường thử riêng, chạy `pnpm --filter @goviet247/api exec prisma migrate deploy`, rồi `pnpm --filter @goviet247/api exec prisma generate`.
3. Kiểm tra tạo chuyến đã đăng nhập, OTP khách mới, chọn nhiều điểm/khứ hồi, giữ giá và gửi lại cùng mã. Kiểm tra Admin đăng nhập, push và thu hồi phiên khi khoá/đổi mật khẩu. Dùng DB/thông tin dịch vụ thử riêng.
4. Khi triển khai API: **migration → generate client → khởi động API mới**. Không chạy API mới với schema/client cũ. Không dùng `db push` thay migration.
5. Build/deploy Web và Web Partners. Những thay đổi giao diện/đọc phân trang trong ba app Mobile cần build/cập nhật app mới. API có nhánh tương thích bản app cũ như trên.

Migration mới: `apps/api/prisma/migrations/20261123090000_booking_idempotency/migration.sql` tạo bảng giữ báo giá, mã yêu cầu chuyến, phiên bản xác thực Admin/thiết bị và trigger tăng phiên khi thay thông tin bảo mật. Không thay giá hay trạng thái các chuyến đã đặt. Migration này có index trên bảng Trip, nên thử trên staging và chọn thời điểm phù hợp trước production.

Biến môi trường cần xem lại khi triển khai:

- Review store: chỉ bật luồng review khi có đủ `APP_REVIEW_LOGIN_ENABLED=true`, `APP_REVIEW_PHONE_E164` và `APP_REVIEW_OTP` được cấu hình rõ ràng. Không còn số/mã mặc định ngầm. Kiểm tra lại thông tin tài khoản đã cung cấp cho bên xét duyệt store nếu đang cần dùng luồng này.
- `TRUST_PROXY`: mặc định chỉ tin proxy loopback. Nếu hạ tầng dùng reverse proxy/ALB khác, cấu hình đúng IP/CIDR/hop đáng tin để rate limit phân biệt đúng khách. Không tin mọi header IP do client tự gửi. Chưa kiểm tra WAF/proxy production; rate limit trong bản vá là theo từng tiến trình, chưa phải quota tập trung toàn cụm.

## Phần Bao xe đã chốt theo yêu cầu mới của Đ

Giữ giao diện chọn Tiêu chuẩn/Bao xe theo ngày hiện tại. Bỏ ô “Nơi lưu trú làm mốc phục vụ” cùng hướng dẫn nhập mốc khỏi Web, Web Partners và Rider Mobile. Bỏ dòng hiển thị “Mốc phục vụ” trong tóm tắt gói dùng chung, để không tiếp tục gắn toàn chuyến vào một địa điểm hiển thị cố định.

Không triển khai form chọn điểm đến theo từng ngày. Không thêm bước đặt xe; không đổi cách tính km, phí Bao xe, giới hạn giờ/km hay các giá trị cấu hình hiện tại. Giá trị tương thích bên trong và dữ liệu chuyến đã đặt được giữ nguyên. Phần bỏ ô này không cần migration DB riêng; vẫn cần migration cho nhóm sửa API chính nêu ở trên.

Đã loại bản nháp lịch trình từng ngày khỏi mã phát hành theo chỉ định mới của Đ. Các tóm tắt gói Tiêu chuẩn/Bao xe và mô tả còn lại được giữ nguyên.
