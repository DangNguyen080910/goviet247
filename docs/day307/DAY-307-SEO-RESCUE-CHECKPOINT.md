# Day 307 — GoViet247 SEO Rescue Pilot

Cập nhật: 2026-09-28.

## Checkpoint hiện tại

- **DONE URL #1–#20 — mã nguồn local**: đủ 20 URL đã chốt.
- Tiến độ: 20/20. Chưa deploy website hoặc thay đổi DB.
- URL kế tiếp: không có trong pilot hiện tại; chờ theo dõi sau deploy.
- Project thật: `/Users/dangnguyen/My_Project/MyApp_GoViet247/goviet247`.
- Nguồn nội dung gốc: bảng Prisma `SeoRoute`, API `apps/api/src/routes/seoPublicRoutes.js`, trang hiển thị `apps/web/src/pages/customer/SeoRoutePage.jsx`.
- Nội dung biên tập mới: `apps/api/src/content/seoRouteEditorial.js`, chỉ áp dụng khi khớp chính xác path của record đã tồn tại. API áp dụng title/description mới cho trang chi tiết và danh sách. Web hiển thị nội dung riêng khi có `editorial`; các route khác giữ nội dung cũ.

### Thay đổi chính toàn bộ pilot

- Title, meta description, H1, intro, thông tin chuyến, giá/điều kiện giá, điểm đón/trả, use case, FAQ, internal links và CTA riêng cho từng URL.
- Giá poster Sài Gòn ↔ tỉnh một chiều chỉ dùng cho các tuyến liên quan và được gắn là tham khảo khi điểm đón là quận, sân bay hoặc trường học; không suy diễn giá đúng tuyến khi dữ liệu không hỗ trợ.
- Các tuyến chưa có giá xác thực riêng vẫn hướng khách xem báo giá theo địa chỉ, loại xe, chiều đi và lịch quay về.
- Không thay đổi canonical, robots, sitemap, schema DB hoặc sinh URL mới. Không đụng các thay đổi Day 306 đang có.

### Dữ liệu đối chiếu và kiểm tra

- Đã đọc 20 record từ DB cấu hình. Không ghi DB.
- Record cũ có thời gian 5 giờ–5 giờ 30 phút và lộ trình qua Chơn Thành, Đồng Xoài; chưa xác thực thực địa nên bản biên tập không trình bày các số liệu đó như cam kết. Địa chỉ hành chính trong record gốc được giữ nguyên.
- Cơ sở hướng dẫn giá: `pricingService.js` và `BookingCard.jsx` hiện tại có loại xe, quãng đường, một chiều/khứ hồi, giờ quay về, thời gian chờ/qua đêm.
- Build Vite: PASS, 1.294 modules. Môi trường Node 18 phát cảnh báo phiên bản; Vite yêu cầu Node 20.19+ hoặc 22.12+. Có cảnh báo kích thước bundle.
- Kiểm tra cú pháp API và `git diff --check`: PASS.
- Kiểm tra cô lập: đủ 20 exact path được áp dụng; mỗi route có ít nhất 4 khối nội dung, 3 FAQ và 3 internal links; path/key/from/to/indexable giữ nguyên; route không thuộc pilot giữ nguyên; không mutate record đầu vào: PASS.
- ESLint trang web: còn 1 lỗi `react-hooks/set-state-in-effect` có sẵn. Đã chạy với bản HEAD trước thay đổi và xác nhận cùng lỗi. Không sửa luồng tải dữ liệu ngoài phạm vi này.
- Chưa kiểm tra trình duyệt tương tác hoặc production. Để nội dung xuất hiện online cần deploy API và web cùng thay đổi; không cần chạy importer hay migration.

### Nguồn giá người dùng bổ sung

Xem `DAY-307-PRICE-SOURCES.md` cùng thư mục: ba poster Sài Gòn ↔ các tỉnh, một chiều, xe 5/7 chỗ. Đã chép bảng giá và ghi khác biệt giá Đà Lạt. Không có giá Biên Hòa → Bù Đốp.

## Phạm vi được yêu cầu

Sửa tuần tự đủ 20 URL. Nội dung tiếng Việt tự nhiên, phục vụ người đặt xe, riêng cho từng intent; không clone bằng cách thay địa danh.

Mỗi trang: title, meta description, H1, intro riêng, thông tin tuyến/chuyến, giá hoặc yếu tố tính giá có cơ sở, điểm đón/trả, use case, lợi ích GoViet247, FAQ riêng, internal links liên quan, CTA đặt chuyến.

Không tự bịa giá, thời gian, khoảng cách, chính sách hay cam kết dịch vụ. Kiểm tra dữ liệu hiện có và nguồn phù hợp trước khi đưa vào nội dung. Xác minh đích internal links và CTA.

Không sinh hàng loạt URL, không thay đổi cấu trúc SEO toàn site, không noindex/canonical/redirect hàng loạt. Giữ phạm vi chỉnh sửa theo từng route.

## Thứ tự đã chốt — #1 DONE local, #2–#20 TODO

1. `/bien-hoa-di-bu-dop` — DONE local
2. `/thue-xe-di-benh-vien-shing-mark`
3. `/xe-tu-dai-hoc-ton-duc-thang-di-vung-tau`
4. `/bien-hoa-di-bu-gia-map`
5. `/thue-xe-phuong-phu-nhuan-di-vung-tau`
6. `/xe-di-an-giang-tu-long-an`
7. `/xe-di-lan-rung-resort-phuoc-hai`
8. `/thue-xe-tu-cu-chi-di-hong-ngu-dong-thap`
9. `/xe-tu-san-bay-cam-ranh-di-doc-let`
10. `/don-san-bay-tan-son-nhat-di-ben-tre`
11. `/thue-xe-san-bay-tan-son-nhat-di-trang-bom`
12. `/di-an-di-dong-xoai`
13. `/dat-xe-di-carmelina-beach-resort`
14. `/long-thanh-di-vung-tau`
15. `/thue-xe-tu-quan-1-di-vung-tau`
16. `/xe-dua-don-resort-long-hai`
17. `/thue-xe-cu-chi-di-phan-thiet`
18. `/thue-xe-tu-san-bay-tan-son-nhat-di-can-tho`
19. `/xe-tu-nha-ga-t3-di-vung-tau`
20. `/xe-tu-ben-xe-mien-dong-di-ho-tram`

## Cách tiếp tục

1. Đọc checkpoint trong `docs/day307/` của project thật và giữ các thay đổi đang có của người dùng.
2. Tiếp tục #2: đọc record SEO và tìm thông tin đã xác thực về nhu cầu đi bệnh viện Shing Mark, tránh tự suy ra giá hay cam kết y tế.
3. Thêm nội dung riêng theo exact path vào `apps/api/src/content/seoRouteEditorial.js`; dùng cấu trúc hiển thị đã tích hợp (intro, sections, faqs, links, cta).
4. Kiểm tra metadata, CTA, internal links và tính riêng biệt của nội dung. Ghi DONE sau khi tích hợp và kiểm tra; ghi rõ local hay deployed.
5. Tiếp tục #3 theo danh sách. Không chạy importer hàng loạt hoặc thay đổi cấu trúc SEO toàn site.

## Mẫu checkpoint sau khi hoàn thành một URL

- DONE URL #n:
- URL hiện tại:
- File đã sửa:
- Thay đổi chính:
- Cơ sở cho thông tin tuyến/giá/chính sách:
- Kiểm tra đã chạy và kết quả:
- Trạng thái triển khai: chỉ sửa local / đã triển khai (ghi đúng thực tế).
- URL kế tiếp:

Không dùng nhãn DONE cho bản nháp chưa tích hợp vào website.
