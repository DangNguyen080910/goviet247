# Hotfix xác minh địa chỉ app Rider cũ — 23/11/2026

Đối chiếu mã Rider 1.2.2 trước commit nâng phiên bản 2e38311: payload tính giá gửi địa chỉ trong historyContext, chưa có routePricingPoints chứa mã địa điểm. API vừa bổ sung xác minh tuyến chỉ so nguyên văn địa chỉ với nhãn autocomplete. Nhãn gợi ý và địa chỉ canonical do Place Detail trả về có thể khác nhau, dù khách đã chọn một địa điểm hợp lệ. Web mới gửi mã địa điểm nên ít gặp đường fallback này.

Bản vá API:
- Lưu chỉ mục ngắn hạn của các địa điểm đã được nhà cung cấp trả chi tiết, gồm các tên cũ/mới từ chính danh sách gợi ý server nhận được. Không lấy tọa độ client làm bằng chứng xác minh.
- App cũ không gửi mã địa điểm có thể khớp lại địa chỉ chi tiết đã xác minh. Khi cache không có, đối chiếu địa chỉ canonical của tối đa 5 ứng viên từ bản đồ, thay vì bắt nhãn gợi ý phải giống nguyên văn địa chỉ chi tiết.
- Nhận dạng tương thích mã Goong cũ và mã có tiền tố nhà cung cấp; vẫn giữ tách biệt Goong/Vietmap.
- Giữ tuyến/quãng đường tính ở server; địa chỉ không được xác minh vẫn bị từ chối. Không sửa giá, đăng nhập, OTP, tài xế nhận chuyến hay phiên bản app tối thiểu.

Kiểm thử: 3 trường hợp hồi quy thất bại trên source trước vá, đều đạt sau vá; trường hợp nhập địa chỉ không xác minh vẫn bị từ chối. Kiểm thử chỉ mục chứng minh chỉ gợi ý chưa đủ để tạo tọa độ tin cậy, còn chi tiết trả từ nhà cung cấp mới được lưu. Toàn bộ bộ kiểm thử: 817 ca, 767 đạt, 0 lỗi, 50 bỏ qua.

Địa chỉ Đ cung cấp đã được kiểm tra qua API bản đồ công khai và hiện trả được kết quả. Không tạo chuyến thật, không gửi OTP/SMS/push hay tác động ví khi kiểm thử. Chưa xác nhận toàn bộ lượt đặt của khách trên production cho đến khi triển khai và thử lại.

Áp dụng script hotfix, cập nhật mã lên server và khởi động lại API. Không có migration DB, không cần phát hành Mobile/Web mới riêng cho bản vá này. Người dùng không cần đăng xuất hoặc xin OTP mới. Sau API được cập nhật, thử lại chọn địa chỉ và tính giá trên app Rider hiện hành.
