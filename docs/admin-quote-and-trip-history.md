# Lịch sử tính giá trên Admin Mobile và lịch sử chuyến — 22/11/2026

## Đặt vào sử dụng

Bản sửa chưa tự triển khai lên production. Sau khi áp dụng và kiểm tra code:

1. Trước khi chạy API mới, vào `apps/api` và chạy `pnpm exec prisma migrate deploy`, sau đó `pnpm exec prisma generate`. Migration mới `20261122073000_trip_driver_history` chỉ thêm cột JSONB `eventData` vào `AdminTripActionLog`, không sửa bản ghi cũ. Kiểm tra các migration đang chờ trước khi chạy; lệnh migrate deploy sẽ áp dụng tất cả migration đang chờ.
2. Deploy/restart API theo quy trình production hiện tại. Không restart code mới trước khi migration hoàn tất.
3. Build/deploy Admin Web và phát hành Admin Mobile. Không cần phát hành Driver/Rider cho hai tính năng này. Chạy migration + API trước khi phát hành giao diện mới.

## Lịch sử tính giá

Admin Mobile > Lịch Sử Tính Giá, chỉ ADMIN thấy và truy cập. Dùng cùng API/dữ liệu/bật-tắt ghi nhận như Admin Web. Mặc định hôm nay theo giờ Việt Nam, có nhanh 7 ngày, lọc ngày, nguồn Web/iOS/Android, loại xe và tìm tên/SĐT/điểm đón/mã chuyến; phân trang 25 lượt. Có chi tiết lộ trình, giờ, giá, trạng thái liên kết đặt chuyến và mở chuyến tương ứng.

Đây là các lần tính giá thành công, không đếm lượt mở app hoặc số người xem chuyến. Một người có thể tính nhiều lần; số khách/thiết bị là ước tính. Lịch sử giữ 90 ngày theo chính sách đang có. Tắt ghi nhận không ảnh hưởng khách tính giá.

## Lịch sử chuyến

Nút Lịch sử chuyến nằm ở danh sách/chi tiết chuyến chờ duyệt, chưa có tài xế, tài xế đã nhận (kể cả các tab đã huỷ/hoàn thành), cảnh báo, góp ý, ví/sổ sách/hoa hồng có mã chuyến, chi tiết đối tác trong Admin Web, lịch sử tính giá liên kết chuyến, và hội thoại Admin. Chỉ ADMIN/STAFF qua GET /api/admin/trips/:id/history. Rider/Driver/đối tác không có quyền xem API này.

Hiển thị ngày, giờ, phút, giây Việt Nam, mới nhất trước; loại hành động, người thực hiện, tài xế liên quan, trạng thái trước/sau, lý do, nội dung trước/sau khi sửa, nguồn bản ghi. Những sự kiện được gom: tạo chuyến, duyệt/phát lại, nhận/huỷ và giao lại, đổi trạng thái, sửa lịch/giá/lộ trình/ghi chú, đổi điều phối viên đối tác, phạt và giao dịch ví có liên kết chuyến.

Nhật ký mới được ghi cùng transaction với cập nhật chuyến. Lần nhận/huỷ có snapshot tên/SĐT/mã tài xế/mã lượt nhận, nên giao lại cho người khác vẫn giữ dấu vết. Tính giá/phí/hoàn ví không được sửa bởi tính năng lịch sử. Duyệt/phát lại được ghi cùng transaction với việc cập nhật, chỉ gửi thông báo sau khi commit.

Bản ghi cũ được tổng hợp từ log xử lý, giao dịch ví, phạt huỷ, log phân công, nhật ký đối tác và mốc dữ liệu chuyến còn lưu. Không backfill bằng chứng hoặc gán người huỷ từ người duyệt phạt. Phần thiếu dữ liệu được nói rõ; không hứa khôi phục mọi thay đổi trước khi tính năng được triển khai. Mỗi nguồn giới hạn 501 bản ghi mới nhất để tránh tải vô hạn; giao diện báo nếu lịch sử quá dài.

## Kiểm tra

Các bài kiểm tra mới kiểm chứng giữ danh tính sau giao lại, không lặp các thành phần khấu trừ ví, nhiều lượt cùng tài xế, không suy người huỷ từ duyệt phạt, tổng hợp mọi loại sự kiện, mốc thời gian VN, bộ lọc Mobile giống Web, và rollback cả nhận chuyến/khấu trừ khi không ghi được lịch sử. Bộ hồi quy bao gồm huỷ/hoàn ví, điều kiện nhận chuyến, phạm vi duyệt, quyền khách, đặt chuyến và ghi chú. Kiểm tra schema, TypeScript, Web và đóng gói Admin Mobile riêng; không dùng production để nhận/huỷ chuyến thử.
