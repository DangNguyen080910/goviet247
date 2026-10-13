# Cập nhật quãng đường khi đổi điểm đến

- Web: trước đây xóa điểm đến chỉ xóa báo giá, không yêu cầu tính lại lộ trình. Lần tính giá kế tiếp dùng số km và thời gian cũ.
- Web và Mobile: một effect theo dõi điểm đón, các điểm đến và hướng chuyến để cập nhật lộ trình. Thêm/xóa/đổi điểm hoặc đổi một chiều/khứ hồi đều bỏ dữ liệu cũ và tính lại từ danh sách mới.
- Chỉ cho tính giá và tạo chuyến khi dữ liệu quãng đường khớp lộ trình hiện tại. Phản hồi bản đồ/báo giá cũ bị bỏ qua nếu lộ trình hoặc thông tin tính giá đã đổi.
- Nếu bản đồ lỗi hoặc điểm đến chưa hợp lệ, xóa dữ liệu quãng đường và không dùng lại số km cũ.
- Chi tiết địa chỉ trả về trễ không được ghi đè danh sách điểm đến đã thay đổi.

Triển khai Web để sửa trường hợp được báo. Phát hành Rider Mobile mới để có các chặn phản hồi trễ bổ sung. Không đổi API/database. Không tự tính giá liên tục: app cập nhật quãng đường tự động, khách bấm Tính giá để lấy báo giá mới.

Các kiểm tra tự động dùng phản hồi bản đồ/báo giá giả lập, không gọi dịch vụ trả phí hoặc tạo chuyến thật. Chưa tái hiện thao tác trên trang Prod hoặc điện thoại thật. Giá có thể vẫn bằng nhau khi hai hành trình có tổng quãng đường gần nhau, nằm cùng mức làm tròn hoặc giá tối thiểu; quãng đường phải được cập nhật đúng trước khi kết luận lỗi giá.
