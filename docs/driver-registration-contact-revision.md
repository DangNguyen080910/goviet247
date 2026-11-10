# Điều khoản liên hệ trong hợp đồng đăng ký tài xế mới

Ngày sửa: 10/11/2026.

- API GET hợp đồng khi user chưa có DriverProfile trả nội dung dùng cho đăng ký mới.
- Luồng POST đăng ký kiểm tra cùng phiên bản/hash cả trước và trong transaction, rồi lưu snapshot nội dung mềm hơn.
- Nếu hợp đồng nguồn chứa đúng điều khoản v1 cũ, chỉ thay điều khoản đó bằng hai đoạn về liên hệ trong app, không mời chào chuyến ngoài, xác minh và tiếp nhận giải trình trước xử lý theo mức độ. Các điều khoản khác giữ nguyên.
- Nguồn v1.0 tạo phiên bản đăng ký v1.1-2026-11-10. Nguồn đã phát hành khác có điều khoản cũ dùng hậu tố -contact-20261110. Nguồn đã mềm hơn giữ nguyên phiên bản/hash.
- Không sửa tệp lịch sử v1/v2, bản hợp đồng trong DB hoặc bản ghi chấp thuận cũ. Không coi tài xế cũ đã đồng ý nội dung mới.
- Mặc định DRIVER_CONTRACT_RECONSENT_ENABLED không bật: không nhắc ký lại, không chặn nhận chuyến vì chưa ký lại và từ chối endpoint ký lại. Giữ nguyên bước đồng ý khi đăng ký mới.
- Driver Mobile đã được sửa để ẩn mục xem hợp đồng và lịch sử; quy định/hướng dẫn đóng sẵn cũng đã đổi đoạn xử lý. Cần phát hành app để các thay đổi đóng sẵn xuất hiện.

## Triển khai

Deploy API để hợp đồng lấy từ server trong đăng ký mới đổi nội dung; không cần bấm phát hành hợp đồng cho toàn bộ tài xế. Phát hành Driver Mobile để ẩn giao diện ký lại/xem hợp đồng và đồng bộ quy định/hướng dẫn. Không cần migration hoặc thư viện mới riêng cho thay đổi này. Chưa deploy production trong công việc này.

App đăng ký phải tải và gửi version/hash từ API; nếu đang giữ nội dung cũ, cần mở lại hợp đồng. Server không tự coi việc đồng ý bản cũ là đồng ý bản mới.
