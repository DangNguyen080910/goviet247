# Tạm dừng kiểm tra hợp đồng khi nhận chuyến — 22/11/2026

Driver Mobile đang phát hành có thể chưa mở được màn hình ký lại. Trong thời gian chờ phát hành bản mới, `apps/api/src/services/driverContractRollout.json` đặt `enforceForNewTrips: false`.

Sau khi áp dụng bản vá, cần deploy và khởi động lại API theo quy trình hiện tại. Không có migration, không sửa dữ liệu hợp đồng hoặc các bản ghi xác nhận. Chưa deploy thì production vẫn giữ hành vi cũ.

Phạm vi tạm dừng chỉ là kiểm tra hợp đồng mới trong API nhận chuyến. Các kiểm tra duyệt hồ sơ, khoá nhận chuyến, loại xe, nhiên liệu, số dư ví, giới hạn chuyến và tranh chấp nhận chuyến giữ nguyên. API xem/xác nhận hợp đồng và `needsAcceptance` vẫn hoạt động: Driver Mobile mới vẫn yêu cầu người chưa xác nhận đọc và đồng ý trước khi vào app. Đăng ký mới vẫn phải chấp thuận hợp đồng theo quy định hiện tại.

## Bật lại sau khi phát hành Driver Mobile mới

1. Phát hành bản có cửa kiểm tra hợp đồng lên cả App Store và Google Play; xác nhận đã tải được.
2. Kiểm tra tài khoản chưa ký được chuyển tới hợp đồng, ký thành công mới vào app; tài khoản đã ký vào bình thường.
3. Nâng Latest version và Minimum version của Driver Mobile trong Admin để bắt buộc cập nhật. Không tăng Rider/Admin nếu chưa phát hành bản tương ứng.
4. Đổi `enforceForNewTrips` thành `true`, deploy và khởi động lại API. Kiểm tra tài khoản chưa ký bị chặn nhận chuyến, tài khoản đã ký đúng phiên bản/nội dung không bị chặn vì hợp đồng.

Có thể dùng biến môi trường `DRIVER_CONTRACT_ENFORCE_NEW_TRIPS=true` để bật lại hoặc `false` để tạm dừng; biến này ưu tiên hơn file cấu hình. Chỉ chấp nhận đúng `true`/`false`. Khi thay đổi môi trường cần restart API với môi trường mới. Đây là công tắc riêng; biến cũ `DRIVER_CONTRACT_RECONSENT_ENABLED` không tắt được việc bắt ký của V2.3 đã phát hành.

Không tự động bật lại theo ngày: chỉ bật sau khi bản mới thực sự có trên store và đã kiểm tra. Giữ kiểm tra ở API để áp dụng nhất quán với mọi yêu cầu nhận chuyến.
