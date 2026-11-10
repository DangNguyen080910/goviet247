# Hợp đồng tài xế và bằng chứng chấp thuận

## Trạng thái phát hành

- Bản v2.0-2026-11-09 là dự thảo gửi kế toán/người rà soát pháp lý. Không tự đổi bản ghi v1 thành v2.
- Mặc định API vẫn dùng v1.0. Chỉ bật v2 sau khi rà soát mô hình kinh doanh, điều kiện vận tải, căn cứ khai/nộp thay, mức phí và sự phù hợp của quy trình vận hành thực tế.
- Không thay đổi cách tính thuế, thu tiền hay phát hành hóa đơn trong thay đổi này. Câu chữ hợp đồng không tự xác lập nghĩa vụ hoặc xác nhận đã nộp thuế.

## Phạm vi sửa

- Nội dung có phiên bản được lưu ở apps/api/src/contracts; app mới đọc từ API thay vì chép riêng trong màn hình.
- API kiểm tra mã, phiên bản và SHA-256 nội dung. Với app mới, lưu snapshot nội dung và định danh tại thời điểm xác nhận. Không dùng title/file/hash tự khai của client làm chứng cứ độc lập.
- App cũ v1 không gửi hash vẫn có thể đăng ký khi v1 đang hoạt động; bản ghi được đánh dấu LEGACY_CLIENT_NO_CONTENT_HASH, không tự dựng bản nội dung đã đồng ý.
- Không backfill nội dung, OTP, ngày hoặc sự đồng ý cho hồ sơ cũ. Các trường hợp chưa đủ bằng chứng được xuất đúng giới hạn, không gắn nội dung hiện tại vào lịch sử.
- Màn hình Hồ sơ tài xế có liên kết xem hợp đồng. Xác nhận bổ sung là hành động tự nguyện riêng, ngày thực tế; không chặn nhận chuyến cũ trong thay đổi này.
- Admin > Tài xế > Chi tiết > Thông tin > Xuất bản ghi đồng ý hợp đồng: tải HTML có thể mở và in PDF. JSON gốc tại GET /api/admin/drivers/:id/contract-evidence. Chỉ ADMIN được xuất.
- Thông tin hồ sơ hiện tại trên bản xuất không được coi là thông tin tại ngày ký cũ. Không có hash/snapshot thì báo rõ không chứng minh được nội dung chính xác tại ngày cũ.

## Triển khai có migration

Chưa triển khai production. Không cần cài thêm thư viện.

1. Sao lưu theo quy trình DB hiện hành và kiểm tra các thay đổi riêng trên server trước khi pull.
2. Từ apps/api, chạy Prisma migrate deploy để áp dụng 20261109140000_driver_contract_content_snapshot. Migration chỉ thêm cột JSONB nullable contentSnapshot, không UPDATE/INSERT/DELETE bản ghi.
3. Tạo lại Prisma Client bằng Prisma generate. Không chỉ restart API với client cũ.
4. Restart tiến trình API. Kiểm tra đăng ký tài xế, GET /api/driver/profile/contract, và xuất bản ghi ADMIN trước khi phát hành Web/app mới.
5. Build/deploy Admin Web; cập nhật Driver Mobile (hoặc bản web của app). App mới cần endpoint mới, nên triển khai API sau migration trước app.
6. Để giữ nguyên nội dung v1, không cấu hình DRIVER_CONTRACT_VERSION hoặc dùng v1.0.

Sau khi nội dung v2 đã được rà soát và chốt, phải sửa JSON nếu có thay đổi, xuất lại Word tương ứng và đổi version nếu nội dung đã từng công bố. Chỉ sau đó cấu hình:

    DRIVER_CONTRACT_VERSION=v2.0-2026-11-09
    DRIVER_CONTRACT_V2_APPROVED=true

Thiếu cờ APPROVED hoặc version không hợp lệ thì API từ chối phục vụ giao kết thay vì tự chọn nội dung khác. App cũ gửi v1 sau khi bật v2 nhận 409 và cần cập nhật app; không tự nhận là đã đồng ý v2.

## Kiểm tra

Node: --test apps/api/tests/driverContract.test.js apps/api/tests/driverCitizenId.test.js.
Prisma validate; Driver Mobile TypeScript; build Admin Web. Không chạy migration trên DB thật trong kiểm tra local.

## Giới hạn bằng chứng

Hash nội dung không phải chữ ký số hay chứng minh đã đọc; IP/thiết bị không thay thế xác minh định danh. Chưa có OTP dành riêng cho việc ký hợp đồng. Không biến một dòng dữ liệu chấp thuận thành hợp đồng kinh doanh được cơ quan thuế bảo đảm chấp nhận. Kế toán phải xác định đúng hồ sơ/thủ tục theo mô hình và giao dịch thực tế.


## Bổ sung 10/11/2026: Cấu hình → Hợp đồng

- Hai mục Tài xế / Nhân viên. Mục Nhân viên chỉ là thông báo chưa triển khai, không tạo hợp đồng lao động.
- Tài xế: Đang áp dụng, Soạn thảo, Lịch sử phiên bản, Tình trạng xác nhận (50 hồ sơ/trang).
- Admin tạo/sửa bản nháp với thông tin doanh nghiệp, tên/phiên bản, các điều khoản, lời xác nhận, tóm tắt thay đổi, số ngày chuyển tiếp. Nội dung đã phát hành không được sửa qua API; muốn thay đổi phải sao chép thành bản mới.
- Phát hành phải xem bản lưu, xác nhận đã rà soát và khớp updatedAt/hash. Lưu riêng người tạo/phát hành và thời gian. Không tự phát hành mẫu v2.
- Tải bản HTML để xem/in PDF. Đây là bản nội dung, không thay bản ghi chấp thuận cá nhân. Xuất bằng chứng cá nhân vẫn ở Admin → Tài xế → Chi tiết.
- App lấy phiên bản đã phát hành mới nhất từ DB; chưa có thì giữ nguồn hợp đồng nền v1 theo cấu hình cũ. Không tạo lại lịch sử.
- Tài xế cũ: banner ở trang chính cả hai danh sách chuyến, mở Xem và xác nhận; đường dẫn cố định Hồ sơ → Hợp đồng. Lịch sử hiển thị từng snapshot đã lưu, ghi rõ giới hạn với bản cũ thiếu nội dung.
- Banner làm mới khi app về foreground và mỗi 60 giây; lỗi mạng không làm hỏng danh sách chuyến. Server luôn kiểm tra khi nhận chuyến nếu đã bật yêu cầu.
- Mặc định chỉ nhắc, không chặn. Nếu Admin bật yêu cầu xác nhận, sau thời hạn chuyển tiếp (1–90 ngày, mặc định 7) chỉ chặn endpoint nhận chuyến mới khi chưa có receipt đúng version/hash. Không thay đổi ví, rút tiền, chuyến đã nhận.
- Hồ sơ thiếu CCCD/địa chỉ cần bổ sung qua Support/Admin trước khi xác nhận bản mới. Không tự điền hộ hoặc coi là đã chấp thuận.
- Phát hành/đăng ký/xác nhận dùng cùng khóa giao dịch để ngăn xác nhận bản đã thay đổi khi đang đọc.
- Không có OTP riêng hoặc chữ ký số mới trong đợt này. Xác nhận là thao tác chủ động trong app, lưu phiên bản, hash, nội dung, định danh, thời điểm và ngữ cảnh; không gắn nhãn đã ký số/OTP.

### Triển khai bổ sung

Có **hai migration** nếu cả gói từ hôm trước chưa lên server:
1. 20261109140000_driver_contract_content_snapshot: thêm snapshot nullable.
2. 20261110150000_driver_contract_versions: tạo bảng phiên bản, không seed, không phát hành và không sửa bản ghi cũ.

Sao lưu DB; kiểm tra thay đổi riêng trên server; commit/push đủ các file mới; chạy Prisma migrate deploy, Prisma generate rồi restart API. Build/deploy Admin Web. Build/phát hành Driver App có banner và màn hợp đồng trước khi Admin phát hành phiên bản mới; đặc biệt không bật chặn nhận chuyến khi bản app này chưa tới người dùng. Không cài thêm dependency.

Kiểm thử: node --test apps/api/tests/contractManagement.test.js apps/api/tests/driverContract.test.js apps/api/tests/driverCitizenId.test.js (24 bài); Prisma validate/generate; Driver tsc; Web vite build. Chưa chạy migration production, chưa phát hành hợp đồng.
