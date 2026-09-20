# Day 304A/B — chất lượng các tuyến SEO còn lại

Ngày kiểm tra: 20/09/2026. Nguồn: truy vấn chỉ đọc bảng `SeoRoute` trên DB đang cấu hình trong project và mã web hiện tại. Không thay đổi DB hoặc production trong lần kiểm tra này.

## Kết quả

- 13.969 tuyến ngoài cohort `V2` đang nằm trong sitemap; cộng 3 URL tĩnh thành 13.972 URL.
- 13.963 mô tả khác nhau nguyên văn, nhưng 1.901 mô tả ngắn hơn 100 ký tự và 6.755 mô tả ngắn hơn 160 ký tự. Độ dài chỉ là tín hiệu để rà soát, không phải tiêu chí Google dùng để quyết định index.
- 9.855 lộ trình khác nhau nguyên văn; 3.553 lộ trình ngắn hơn 40 ký tự. Một lộ trình `TP.HCM → Long Thành → Vũng Tàu` xuất hiện 182 lần.
- 8.628 cặp `from → to` khác nhau. Có 66 cặp chứa ít nhất 10 URL, chiếm 3.884 URL. Riêng `TP.HCM → Vũng Tàu` có 317 URL.
- 541 slug mở đầu bằng nhóm từ khóa giá/báo giá/chi phí; 42 tiêu đề ghi “bảng giá”. Trang tuyến hiện không có bảng giá cố định, chỉ dẫn sang công cụ tính giá theo địa chỉ và thời gian cụ thể.
- 1.280 tiêu đề dùng “giá tốt”, trong khi record `SeoRoute` không chứa giá để chứng minh so sánh này.
- Có 6.070 record thuộc cặp tuyến đảo chiều. Hai chiều có thể là nhu cầu khác nhau, nên không tự động gộp.

## Đánh giá

Nhiều trang có nhu cầu thật (đặt xe theo tuyến), nhưng các biến thể từ khóa cùng hành trình có thể không bổ sung thông tin mới cho người đọc. Thêm chữ mẫu hàng loạt không giải quyết được khoảng trống đó. Nhóm trang “bảng giá” cần giá có nguồn/điều kiện cụ thể hoặc cần đổi kỳ vọng thành xem giá theo hành trình thực tế. Cần dữ liệu GSC theo từng trang trước khi quyết định URL nào giữ, gộp, chuyển hướng hoặc noindex.

## Thay đổi mã đã chuẩn bị

- Trang tuyến bỏ đoạn quảng cáo chung, cam kết giá không có bằng chứng, và FAQ giống nhau trên mọi trang.
- Trang trình bày rõ lộ trình và thời gian là tham khảo; giải thích dữ liệu cần nhập để có giá thực tế.
- Khi đi từ trang tuyến sang đặt xe, màn đặt xe giữ gợi ý điểm đầu/cuối và yêu cầu khách chọn địa chỉ cụ thể từ danh sách trước khi tính giá.
- Không đổi title/description/path trong DB, canonical hay sitemap trong lần này.

## Bước biên tập tiếp theo

1. Xuất GSC Performance → Pages trong 3 tháng gần nhất với clicks, impressions, CTR và average position. Ghép theo URL với cohort và nhóm cặp tuyến.
2. Ưu tiên 20–50 tuyến có nhu cầu và chuyển đổi cao; bổ sung thông tin kiểm chứng được: địa chỉ/khu vực đón trả, ví dụ báo giá có điều kiện, chính sách phí, điểm dừng, thời gian được xác nhận theo chuyến.
3. Với các biến thể cùng ý định tìm kiếm, chọn URL chính dựa trên hiệu quả GSC và chất lượng nội dung; lập bảng redirect/canonical/noindex để review trước khi áp dụng. Không gộp chỉ vì hai record có cùng `from` và `to`.
4. Theo dõi GSC sau mỗi cohort. Không kỳ vọng thay đổi template sẽ tự phục hồi traffic.
