# Sửa 8 phát hiện sau rà soát flow — 07/11/2026

Phạm vi: chỉ code local; không triển khai API/web, không chạy migration DB thật, không gửi thông báo hay cuộc gọi thật.

## Những gì đã sửa

1. API thông báo cũ không còn tin `userId` do client truyền. Không đăng nhập chỉ đọc thông báo công khai cho Rider/Driver; khi có token phải xác thực và dùng danh tính trong token. Token sai không được rơi về nhánh công khai để đọc tin riêng.
2. Đăng xuất xoá mọi thiết bị gắn với đúng tài khoản và phiên hiện tại, gồm Rider. Gửi thông báo hệ thống/cập nhật chuyến cho Rider kiểm tra phiên còn hiệu lực. Thông báo Rider đích USER chỉ gửi cho đúng tài khoản đó. Không thể thu hồi push đã gửi cho APNs/Expo trước lúc đăng xuất.
3. Giao dịch phạt do tài xế tự trả chuyến được gắn walletHoldId của lần nhận. Báo cáo đối soát khớp khoản giữ theo lượt nhận; dữ liệu cũ tính khoản hoàn cùng khoảng thời gian và tham chiếu cả khoản hoàn ngoài quý. Tái hiện giữ 100 → hoàn 100 → giữ 100 → huỷ: tổng biến động báo cáo là -100, không còn -200. Khoản phạt không khớp vẫn giữ để đối soát, không tự xoá dữ liệu.
4. Bấm push hệ thống trên app tài xế mở hộp thông báo, đưa đúng mục lên đầu và đánh dấu nổi bật. API tải đúng ID có cùng kiểm tra quyền; thông báo ngoài 50 mục mới vẫn mở được. Thông báo bị gỡ/khác tài khoản hoặc lỗi tải có giải thích.
5. Mỗi lần bấm thông báo chuyến trên admin mobile có mã yêu cầu focus riêng; bấm lại cùng chuyến vẫn mở chi tiết. Giữ đúng tab theo trạng thái và chuyển về chờ duyệt nếu chuyến trở lại PENDING.
6. Nút tải lại ghi chú trên admin web/mobile yêu cầu xác nhận nếu có bản nháp chưa lưu. Có thể giữ bản nháp; chỉ bỏ khi người dùng chọn tải lại. Giữ cơ chế chờ lưu trước duyệt/đóng từ đợt trước.
7. Bỏ hai lần phát sự kiện Rider dư khi admin trả chuyến về chờ duyệt. Dùng một hàm gửi cho người đặt và hành khách hợp lệ. Không thay đổi quyền xem lịch sử chat.
8. Hàng đợi xoá file đi luân phiên qua các bản ghi lỗi, không kẹt ở 20 mục đầu; ảnh/âm thanh xoá thành công được ghi nhận riêng. Phục hồi ghi âm không dừng sau 24 giờ; bản ghi đến muộn vẫn được tìm lại. Không gọi dừng tài nguyên AWS đã dọn xong lặp lại trong lúc chờ file. Tài nguyên được tạo muộn mở lại cờ dọn dẹp. Bản ghi vẫn chỉ dành cho admin.

## Xác minh

- Node 24: 553 bài; 504 đạt, 0 lỗi, 49 bài tích hợp bỏ qua.
- Kiểm thử mới bao gồm: giả mạo userId, phiên Rider bị thu hồi, xoá thiết bị đúng phiên khi đăng xuất, mở lại cùng chuyến, thông báo cũ và giới hạn tài khoản, nhận lại sau hoàn ví, phục hồi ghi âm sau hai ngày, 20 file xoá lỗi không chặn file phía sau.
- TypeScript admin-mobile, driver-mobile, rider-mobile: đạt.
- Vite build web và web-partners: đạt; đầu ra kiểm tra ở /private/tmp, không triển khai website.
- git diff --check: đạt.
- Sửa thời điểm tạo token giả trong bài kiểm thử phiên đối tác để không lệch một giây giữa iat và exp; không nới quy tắc xác thực production.

## Triển khai

- Cần cập nhật API và khởi động lại để áp dụng kiểm tra thông báo, đăng xuất, đối soát và worker.
- Build/triển khai web mới để có xác nhận bỏ ghi chú. Phát hành app admin/driver mới để có sửa điều hướng và ghi chú mobile. Chỉ cập nhật API không đổi giao diện app đã cài.
- Đợt này không thêm migration hoặc biến môi trường. Các migration cuộc gọi/chat/wallet của đợt trước chưa áp dụng vẫn cần migrate deploy theo tài liệu đợt trước.
- Sau triển khai, thử iPhone TestFlight + Android nội bộ: bấm thông báo cũ/cùng chuyến nhiều lần; đăng xuất rồi phát sinh cập nhật mới; giữ/bỏ ghi chú; gọi không nghe máy/app nền; nhận chuyến trên hai máy tài xế. Chưa có kết luận kiểm thử thiết bị thật hoặc PostgreSQL thật từ bộ kiểm thử local này.
