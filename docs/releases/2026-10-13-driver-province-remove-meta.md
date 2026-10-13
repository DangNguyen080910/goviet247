# Tỉnh/thành thường hoạt động và gỡ Meta Rider Mobile

## Tài xế

Danh mục dùng chung 34 tỉnh/thành, lưu mã tỉnh ổn định và tên hiển thị không gắn phân loại tỉnh/thành phố (trừ TP. Hồ Chí Minh quen thuộc). Nguồn: https://chinhphu.vn/thong-tin-tinh-thanh và bảng mã tại https://datafiles.chinhphu.vn/cpp/files/vbpq/2025/7/19ttg.signed.pdf.

Driver Mobile mới bắt buộc chọn một tỉnh/thành khi đăng ký, tìm được bằng chữ có hoặc không dấu. Hồ sơ tài xế có chọn lại và lưu, không thay đổi tình trạng duyệt/quyền nhận chuyến. API chỉ cập nhật khu vực của tài khoản đang đăng nhập, kiểm tra mã hợp lệ.

Migration thêm operatingProvinceCode mặc định 79 (TP.HCM), operatingProvinceConfirmedAt mặc định NULL, và index tỉnh. Tài xế cũ và đăng ký bằng app cũ được đánh dấu chưa xác nhận. Tài xế mới gửi mã hoặc tài xế tự lưu khu vực được ghi thời điểm xác nhận. Dữ liệu khu vực không phải vị trí GPS trực tiếp.

Admin Web: cột tỉnh và dấu chưa xác nhận, lọc tỉnh, lọc trạng thái xác nhận; thống kê đầy đủ theo 34 khu vực ngoài phân trang. Thống kê áp dụng tìm kiếm, trạng thái hồ sơ, bộ lọc SĐT và nhận chuyến hiện hành; không bị thu hẹp bởi lọc tỉnh/xác nhận. Mỗi khu vực hiển thị số đã xác nhận và số chưa xác nhận riêng. Click khu vực để lọc bảng.

## Meta

Gỡ react-native-fbsdk-next, expo-tracking-transparency, mã khởi động Meta, cấu hình plugin và file mẫu biến Meta trong Rider Mobile. app.config.js không đọc META_APP_ID/META_CLIENT_TOKEN, nên biến cũ trên EAS không kích hoạt SDK. Có thể xóa hai biến đó trong các environment EAS nếu còn lưu; công việc này không xóa remote environment.

Chặn com.google.android.gms.permission.AD_ID qua app.json và Android manifest. Không còn yêu cầu theo dõi dành riêng cho Meta trong app. Những biến môi trường khác giữ nguyên. Các bài kiểm tra dành riêng cho tính năng Meta đã gỡ cũng được bỏ.

Build native mới bắt buộc để gỡ SDK khỏi binary; cập nhật JS/OTA không đủ. Sau khi tải AAB mới lên Play Console, kiểm tra manifest thực tế và các SDK còn lại trước khi khai báo không dùng Advertising ID; các bản cũ còn hoạt động trên track khác phải được xem xét. Data Safety và khai báo quyền phải phù hợp binary phát hành. Không thể bảo đảm thời gian duyệt Google bằng việc gỡ SDK.

## Triển khai

1. Chạy migration 20261013093000_driver_operating_province bằng quy trình migrate deploy của dự án, generate Prisma Client mới.
2. Triển khai API, gồm driverOperatingProvince.js và apps/api/src/data/vietnam-provinces.json. Danh mục nằm trong src/data và được đóng gói cùng API; API, Web, Driver Mobile cùng dùng danh mục này.
3. Triển khai Admin Web và phát hành Driver Mobile mới.
4. Cài dependencies theo lockfile mới và build/phát hành Rider Mobile native mới.

Chưa áp dụng migration hoặc deploy lên Prod; chưa build AAB/IPA hay kiểm chứng trên máy thật. Kiểm tra biên dịch TypeScript hai app, build Web, cú pháp API và cấu trúc Prisma được thực hiện trên máy phát triển.
