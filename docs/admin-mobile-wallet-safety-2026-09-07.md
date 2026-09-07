# Kiểm tra app admin mobile — sự cố cộng ví báo lỗi

## Kết luận từ mã nguồn

Một đường lỗi phù hợp với sự cố: endpoint nạp ví đã commit số dư + lịch sử ví + thu chi trong một transaction, nhưng sau đó vẫn await tạo thông báo và gửi push. Lỗi tạo thông báo rơi vào catch của endpoint, trả thất bại dù tiền đã lưu; push chậm cũng có thể kéo dài phản hồi. Không có log hay bản build của thời điểm sự cố nên chưa kết luận nguyên nhân thực tế duy nhất.

Mỗi POST trước đây tạo giao dịch mới, không có idempotency key. App giữ form khi thất bại và hiển thị số dư cũ. Tải màn ví dùng Promise.all, có cả endpoint phạt đã ẩn; một endpoint lỗi làm cả màn không nhận dữ liệu mới. Refresh bỏ mất bộ lọc tìm kiếm. Nút Lịch sử ví chỉ đổi state, không fetch/render. Alert.prompt nhập lý do từ chối chỉ hỗ trợ iOS.

Điều chỉnh trừ ví không tự tạo khoản chi công ty là hành vi hiện có: điều chỉnh số dư không đồng nghĩa chuyển tiền ngân hàng. Không thay đổi quy tắc này, không sửa/xóa dữ liệu thật. Một giao dịch nạp sai cần đối soát bút toán gốc riêng; không tự suy ra khoản chi tiền mặt từ một điều chỉnh ví.

## Thay đổi

- API: ba thao tác ví dùng chung mutation service. Idempotency key được băm cùng admin ID thành primary key của DriverWalletTransaction. Unique constraint hiện có chặn retry trùng xuyên tiến trình/restart; không cần migration. Nội dung khác dùng lại key bị từ chối. Khi replay, trả lại biên nhận và số dư hiện tại.
- Số dư tăng/giảm nguyên tử. Debit kiểm tra số dư ngay trong UPDATE; lịch sử và thu chi nạp tiền cùng transaction. Nếu ghi thu chi lỗi, thay đổi ví rollback.
- Thông báo ví chạy sau commit, lỗi được log riêng, không chặn phản hồi giao dịch. Socket dashboard được cô lập lỗi. Đây là best-effort notification, chưa có durable outbox; tiến trình dừng có thể làm mất thông báo, không mất giao dịch ví.
- Rút ví: chuyển trạng thái có điều kiện ngăn hai request từ chối hoàn tiền hai lần hoặc ghi PAID hai lần. Retry trạng thái đã hoàn tất trả thành công; request cạnh tranh sai trạng thái yêu cầu tải lại.
- Mobile: lưu thao tác chưa xác nhận trước khi gửi, phân tách theo admin. Retry dùng cùng mã kể cả mở lại app. Một thao tác chưa xác nhận chặn thao tác khác cho đến khi xử lý. Có nút kiểm tra giao dịch đang chờ. Lỗi xóa journal sau thành công không đổi kết quả thành thất bại.
- Mobile kiểm tra capability trước khi gửi tiền, chặn API cũ chưa hỗ trợ idempotency. Tương thích client web cũ vẫn được giữ; request không có key KHÔNG được đảm bảo chống retry tuần tự.
- Chống bấm liên tiếp cùng request đang chạy tại lớp request chung toàn app. Không tự retry thao tác ghi. Phản hồi JSON lỗi không còn được coi là thành công; lỗi mạng giải thích kết quả có thể chưa xác định. Chỉ HTTP 401 kích hoạt hết phiên, tránh nhầm lỗi token thông báo thành hết phiên admin.
- Ví tải từng phần, giữ bộ lọc, loại request phạt không dùng, bỏ phản hồi tìm kiếm cũ, dùng số dư máy chủ. Bổ sung lịch sử ví. Form từ chối dùng chung iOS/Android.
- Sổ sách tải lại khi focus, bắt lỗi, ẩn số liệu khi tải lỗi, bỏ phản hồi cũ khi đổi quý/năm.

## Phạm vi rà soát và xác minh

Đã đọc luồng request và các thao tác của Ví, Sổ sách, Tài xế, Khách hàng, Chuyến chờ duyệt, Chuyến chưa có tài xế, Chuyến đã nhận, Góp ý; kiểm tra thêm Home/Auth và các endpoint API liên quan. Các màn ngoài Ví vốn phần lớn đã tách refresh khỏi kết quả lưu; lớp request chung được cải thiện. Đây là rà soát mã nguồn, không phải kiểm thử thủ công toàn bộ màn hình trên thiết bị.

17 kiểm thử tự động: mất phản hồi rồi khởi động lại, bấm trùng, API cũ, journal cleanup lỗi, phản hồi JSON lỗi, replay/conflict payload, nạp độc lập, rollback thu chi, debit thiếu tiền, lỗi/hang thông báo sau commit, unique conflict, hoàn ví/PAID cạnh tranh. Database được giả lập có transaction rollback và serialize; chưa kiểm chứng cạnh tranh trên PostgreSQL thật. Controller được cô lập khỏi các import tích hợp để không truy cập DB/notification thật.

Lệnh kiểm tra tại root:

```sh
node --test apps/api/tests/adminWalletMutation.test.js apps/admin-mobile/scripts/wallet-safety.test.cjs
node_modules/.bin/tsc --noEmit -p apps/admin-mobile/tsconfig.json
cd apps/admin-mobile
../../node_modules/.bin/eslint app services
```

TypeScript đạt. Lint app/services: 0 lỗi, 25 cảnh báo ở các phần ngoài tập file sửa; tập file sửa đạt không cảnh báo. Chưa chạy native build hoặc thao tác tiền trên production. Prisma client trong môi trường hiện tại chưa generate; test cô lập không cần thay đổi client/schema.

## Áp dụng

1. Triển khai API trước, xác minh GET /api/admin/wallet-operations/capabilities với phiên admin trả walletOperationVersion: 1.
2. Trên môi trường test với tài xế giả, gửi đồng thời cùng key, ngắt phản hồi sau commit rồi retry, xác nhận chỉ một bút toán nạp và một bút toán thu. Kiểm tra hai key khác nhau là hai giao dịch hợp lệ; kiểm tra hoàn ví/PAID cạnh tranh.
3. Build/phát hành admin mobile mới. Kiểm thử iOS và Android: bấm nhanh, mất mạng, mở lại app, kiểm tra giao dịch chờ, lịch sử ví và bộ lọc.
4. Client cũ hoặc app cài lại/xóa dữ liệu sẽ không giữ journal. Không coi dedup là phát hiện hai khoản chuyển ngân hàng giống nhau; đây là chống gửi lại cùng thao tác. Phải đối soát trước khi tạo giao dịch mới sau khi mất dữ liệu máy.

Chưa deploy, chưa commit, không thay đổi tài khoản/số dư/giao dịch thật.
