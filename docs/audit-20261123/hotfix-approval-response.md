# Trả kết quả duyệt ngay sau khi lưu — 23/11/2026

## Hiện tượng và nguyên nhân
Chuyến rời danh sách chờ duyệt qua realtime nhưng dialog Admin vẫn “Đang duyệt…”. adminVerifyTrip đã commit transaction, lưu lịch sử duyệt, tạo thông báo trong app và phát realtime rồi vẫn await sendNewTripToDrivers, sau đó await push Rider trước khi trả JSON. sendExpoPushMessages đợi 4 giây để kiểm tra receipt cho từng batch tối đa 100 thiết bị, ngoài thời gian mạng. Push nhiều batch hoặc mạng chậm kéo dài request dù chuyến đã được duyệt.

## Thay đổi
Chỉ sửa adminVerifyTrip: trả response thành công sau transaction và realtime, rồi khởi chạy hai tác vụ push độc lập có bắt lỗi. Driver push chậm không giữ Rider push. Không bỏ lọc tài xế, không đổi nhóm nhận chuyến, không duyệt trước khi DB commit. Không đổi trạng thái, thu tiền hay logic nhận chuyến. Cả Admin Web và Admin Mobile dùng chung endpoint nên không cần build Mobile.

## Kiểm tra
- HTTP duyệt cho 620 tài xế: trước sửa request không trả khi push pending; sau sửa trả 200 với isVerified=true trong khi cả hai push vẫn pending.
- Hai push vẫn được khởi chạy; lỗi đồng bộ/bất đồng bộ được ghi log riêng và không đổi response đã thành công.
- Transaction lỗi không trả thành công và không phát realtime/push.
- Yêu cầu đã duyệt trùng nhóm không phát push lần nữa.
- 53/53 kiểm tra duyệt, miền, nhóm tài xế, nhiên liệu, giờ chuyến và quyền Rider đạt.
- DB và Expo trong kiểm tra là adapter thử; không duyệt chuyến thật, không gửi push thật, không kiểm chứng latency production.

## Vận hành
Push tiếp tục trên tiến trình Node đang chạy; đây không phải durable queue/outbox. API trả thành công nghĩa là duyệt đã lưu, không phải mọi thiết bị đã nhận push. Không đổi cơ chế gửi/receipt trong service push ở bản vá này.

## Áp dụng
Chạy ap_dung_hotfix_duyet_chuyen_nhanh_20261123.sh, commit/push/deploy API và khởi động lại theo quy trình hiện có. Không cần migration, generate Prisma, build Web hoặc build app Mobile. Chưa deploy chỉ bằng việc áp mã. Kiểm tra một chuyến duyệt thực tế sau deploy để xác nhận production.
