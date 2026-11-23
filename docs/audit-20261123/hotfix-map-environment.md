# Hotfix gợi ý địa chỉ — 23/11/2026

Đã xác nhận GET `/api/maps/autocomplete?q=Saigon` trên production trả HTTP 500 khi kiểm tra. Bản sửa tổng hợp đã thêm import `bookingQuotes` trước `dotenv/config`. Dependency này nạp `mapService`, nơi các khóa và lựa chọn nhà cung cấp bản đồ được đọc ngay lúc khởi tạo module. Nếu khóa nằm trong `.env`, module giữ giá trị chưa được nạp dù dotenv chạy sau đó.

Sửa: đưa `import "dotenv/config";` lên đầu entrypoint API, trước các dependency có đọc cấu hình. Không thay endpoint, payload, giá, dữ liệu tài khoản, điều kiện hợp đồng, số phiên hay cấu hình mobile minimum version. Không có migration DB mới.

Kiểm thử hồi quy dùng module bản đồ thật, ESM thật và mạng giả lập: tái hiện `GOONG_API_KEY_MISSING` với thứ tự cũ; thứ tự entrypoint mới trả gợi ý thành công. Toàn bộ bộ kiểm thử: 812 ca, 762 đạt, 0 lỗi, 50 bỏ qua. Kiểm tra cú pháp entrypoint và diff đạt. Chưa coi production đã khôi phục trước khi triển khai và kiểm tra lại HTTP.

Áp dụng script hotfix trên repo local, commit/push theo quy trình hiện tại, cập nhật mã trên server và khởi động lại tiến trình API. Không cần build lại Web, Web Partners hay Mobile riêng cho hotfix này. Không cần đợi lịch phát hành Mobile tháng 12. Giữ `enforceForNewTrips: false` như đã cấu hình.
