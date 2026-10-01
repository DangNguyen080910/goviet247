# Day 306 — bàn giao triển khai (26/09/2026)

Đã triển khai trong repo này. Chưa deploy API/Web, chưa migrate DB thật, chưa chạy EAS build/submit và chưa có kết quả attribution từ campaign thật. Những thay đổi chưa commit có sẵn trước Day 306 được giữ lại.

## 1. Duyệt và show cho tài xế chỉ định

Admin Web: Chuyến (Chờ Duyệt) → Duyệt cho tài xế chỉ định. Admin Mobile: chi tiết chuyến chờ duyệt → Duyệt và show cho tài xế chỉ định. Tìm tên/SĐT/biển số, chọn 1–100 tài xế. Tài xế được gợi ý xếp trước, không tự chọn thay admin.

Không gán `driverId` và không trừ ví lúc duyệt. Vẫn là `PENDING`, `isVerified=true`. Tài xế nhận qua API hiện tại: kiểm tra hồ sơ, chặn nhận chuyến, giới hạn chuyến đang chạy, thời gian mở nhận, số dư; khóa profile rồi trip; giữ commission/VAT/PIT, ghi ledger, đổi trạng thái, thông báo như trước. Chỉ một tài xế thắng.

### Schema và migration

`apps/api/prisma/migrations/202609260001_day306_targeted_trips/migration.sql`:

- `Trip.audienceDriverIds: String[]`, NOT NULL, mặc định `[]`, GIN index. Dùng **User.id**, không dùng DriverProfile.id. `[]` nghĩa là công khai như trước; danh sách khác rỗng là riêng tư.
- `TripConfig.returnSuggestionRadiusKm`: số nguyên 1–500, mặc định 20 km.
- `TripConfig.returnSuggestionDays`: số nguyên 1–30, mặc định 2 ngày.

Admin Web → Cấu hình → Chuyến đi có hai ô cấu hình. API GET/PATCH `/api/admin/trip-config` trả/nhận hai trường trên. Không cần env BE mới.

### API

- `GET /api/trips/admin/trips/:id/audience-candidates?q=...`, ADMIN/STAFF: trả `items[{userId,name,phone,plateNumber,suggestion}]`, `config{radiusKm,days}`, `warning`.
- `POST /api/trips/admin/trips/:id/verify`, ADMIN/STAFF: `{note,driverIds:[userId,...]}`. PATCH cũ dùng chung controller. Kiểm tra tài xế VERIFIED, không bị chặn; ghi audience cùng trạng thái duyệt bằng update có điều kiện. Nếu chuyến đã được người khác duyệt, action chỉ định trả 409.
- Request cũ không có `driverIds` vẫn hoạt động. Với chuyến riêng tư trả về chờ duyệt, việc duyệt lại không truyền danh sách **giữ nguyên audience**, không tự mở công khai. Muốn đổi nhóm: trả về chờ duyệt rồi chọn nhóm mới. Không thêm action tự chuyển riêng tư sang công khai.
- GET `/api/trips/driver/available`: lọc audience ngay trong DB trước `take:50`.
- POST `/api/trips/driver/accept`: kiểm tra audience sau khi khóa trip, trước mọi ghi ví.
- GET `/api/trips/:id`: nay yêu cầu token, chỉ rider sở hữu hoặc tài xế đang giữ chuyến xem toàn bộ chi tiết. Admin dùng API admin vốn có. Driver chưa nhận dùng danh sách masked hiện tại.

### Giữ riêng tư

Mọi broadcast `trip:new`/`trip:changed` tới driver đều đọc audience đã lưu, gồm duyệt, đẩy lại, huỷ, trả chuyến và đổi trạng thái. Chuyến riêng tư chỉ gửi các phòng `driver:<userId>` đã xác thực. Nếu DB lỗi, không phát ra phòng chung. Push cuốc mới lọc Device.userId bằng audience trong DB, không tin audience truyền vào hàm. Audience giữ nguyên qua resend/cancel/review; không có timeout tự mở cho tất cả tài xế.

**Phát hiện quan trọng:** socket cũ tin `registerDriver({userId})`, thậm chí cho client tự đăng ký phòng admin. Đã thay bằng xác thực token tại handshake, lấy ID từ token và bỏ qua ID/role client tự khai. Client Web admin/rider và Driver/Rider Mobile đã gửi token. Admin Mobile đã có token handshake sẵn.

### Logic gợi ý và giới hạn

Cửa sổ tính từ thời điểm hiện tại lùi lại N ngày, theo `pickupTime` vì schema hiện tại không có `completedAt`. Chỉ xét chuyến `ONE_WAY`, `COMPLETED`, tài xế hiện đủ điều kiện; điểm đến nằm trong bán kính Haversine với điểm đón mới.

Loại gợi ý nếu cùng tài xế đã có chuyến sau đó (ACCEPTED/CONTACTED/IN_PROGRESS/COMPLETED), điểm đón gần điểm đến cũ và điểm đến gần điểm đón cũ trong cùng bán kính. Huỷ không tính là đã có chuyến về. Thiếu tọa độ thì không suy đoán từ địa chỉ, vẫn cho tìm/chọn thủ công.

Đây là suy luận từ lịch sử trong hệ thống, không khẳng định tài xế vẫn đang ở đó hoặc chưa nhận cuốc ngoài GoViet247. Admin cần xác nhận. Cửa sổ N ngày là cửa sổ gợi ý, không phải thời hạn riêng tư. Hiện endpoint đọc toàn bộ ứng viên/lịch sử trong cửa sổ; cần phân trang/tối ưu truy vấn khi quy mô tăng lớn.

## 2. Rider Mobile — Meta app install attribution

Expo SDK 54, RN 0.81.5, New Architecture. Đã thêm `react-native-fbsdk-next` 13.4.3 và `expo-tracking-transparency` ~6.0.8, cập nhật pnpm lockfile. Dùng SDK native của Meta thông qua config plugin; không dùng Pixel Web hay bộ đếm đăng nhập thay cho install.

`app.config.js` nối cấu hình hiện có, lấy:

```
META_APP_ID=<Meta application ID>
META_CLIENT_TOKEN=<Meta client token>
```

Mẫu ở `apps/rider-mobile/.env.meta.example`. Đây là thông tin SDK đóng vào binary; **không dùng App Secret/access token**. Đặt ở EAS environment cho từng profile development/preview/production. EAS build thiếu cấu hình sẽ dừng rõ ràng; cấu hình dở dang cũng báo lỗi. Local native prebuild/run cũng phải có hai giá trị. Khi không cấu hình, JS không khởi tạo SDK; Expo Go không có native module nên bỏ qua an toàn.

App events tự động được bật để SDK ghi nhận activation/install và tự chống đếm lặp. Không tự log một custom event tên “install”. Thu mã quảng cáo mặc định tắt. Trên iOS, runtime xin ATT khi app active, chỉ bật thu mã quảng cáo nếu granted; kiểm tra lại khi foreground để phản ánh thay đổi trong Settings. Từ chối ATT vẫn giữ cơ chế đo tổng hợp của SDK, không gửi tên/SĐT/email/user ID từ code này. Android khởi tạo SDK và bật advertiser ID collection theo hành vi nền tảng, không xin ATT.

### Việc cần cấu hình và kiểm chứng ngoài code

1. Trong Meta Developers/Business: chọn đúng app; thêm iOS bundle `com.goviet247.rider`, App Store ID `6767422059`; thêm Android package `com.goviet247.rider`, Play URL và key hashes đúng certificate (đặc biệt Google Play App Signing, không chỉ upload/debug key). Xác nhận Android activity theo manifest của binary.
2. Liên kết app/data source với đúng Business và tài khoản quảng cáo, cấp quyền cần thiết và cấu hình app events. Dùng campaign App Promotion trỏ đúng store/app và tối ưu install.
3. iOS: cấu hình đo app events/SKAdNetwork trong Events Manager theo khả năng của app/account, cho SDK quản lý conversion nếu chọn phương án này. Không chạy thêm MMP hoặc code conversion value cạnh tranh. Không thêm danh sách `SKAdNetworkItems` của app hiển thị quảng cáo vào Rider chỉ để đo install; Rider là app được quảng cáo. ATT denied không thể đảm bảo nhận diện từng người/campaign; SKAN là đo tổng hợp, có độ trễ và ngưỡng riêng tư.
4. Android: SDK Meta có thành phần Google Play Install Referrer; kiểm tra merged manifest/dependency ở binary release và quyền AD_ID/Data Safety. Cài từ track Google Play để kiểm tra referrer, không dùng APK sideload làm bằng chứng attribution hoàn tất. Không cần viết API BE tự khai install.
5. Cập nhật App Privacy trên App Store, Data Safety trên Play và chính sách quyền riêng tư theo SDK thực tế. Kiểm tra ATT granted/denied, cold start, mở lại app, đổi quyền trong Settings trên thiết bị thật.
6. Build mới Rider là bắt buộc do thêm native SDK. Kiểm tra Events Manager/Test Events/Diagnostics rồi chạy campaign thử và đối chiếu Ads Manager. Sự kiện đến Events Manager chưa tự chứng minh campaign attribution đã đúng. Không thể hồi tố mọi lượt cài cũ.

Nguồn kỹ thuật đã đối chiếu:
- [Expo: Facebook SDK cần development/native build](https://docs.expo.dev/guides/facebook-authentication/)
- [FBSDK Next: Expo config và app events](https://github.com/thebergamo/react-native-fbsdk-next)
- [Expo SDK 54: Tracking Transparency](https://docs.expo.dev/versions/v54.0.0/sdk/tracking-transparency/)
- [Apple: SKAdNetwork](https://developer.apple.com/documentation/storekit/skadnetwork)
- [Meta Android SDK: Install Referrer dependency](https://github.com/facebook/facebook-android-sdk/blob/main/facebook-core/build.gradle.kts)

## 3. Sort ví tài xế

Bảng danh sách ví trên Admin Web bấm header để đổi tăng/giảm cho Tài xế, SĐT, KYC, Số dư ví, Biển số. Cột Hành động không sort. Dùng API sort hiện có, thêm `balance` dạng số; BE sort toàn bộ kết quả trước phân trang, có ID làm khóa phụ. Màn hình vẫn giới hạn 100 dòng như trước. Không thay đổi ledger hay nghiệp vụ cộng/trừ ví.

## 4. Kiểm tra giờ chưa release

- Rider: `BookingTimePicker`/`bookingTime.ts` đã hiển thị sáng/trưa/chiều/tối kèm giờ 24h, chuyển sang ISO có +07:00. Giữ nguyên fix.
- Admin Mobile: `utils/tripTime.ts` và các màn hình chỉnh chuyến đã parse/format giờ Việt Nam, giữ giây/millisecond khi không sửa lịch. Giữ nguyên fix.
- Driver: dashboard đã dùng +7, lịch sử dùng Asia/Ho_Chi_Minh. Còn `wallet.tsx` dùng múi giờ thiết bị; Day 306 đã thêm Asia/Ho_Chi_Minh và 24h.
- Test chạy các múi giờ UTC, Asia/Ho_Chi_Minh, America/Los_Angeles, Asia/Tokyo; phân biệt 06:30/18:30, trưa/đêm và qua ngày. Test OTP cũ có ngày cố định trong quá khứ đã được cố định clock trong harness, không sửa logic booking để né test.

## 5. Kiểm tra đã chạy

- 73/73 test pass, 0 skipped, gồm PostgreSQL thật **tạm** ở localhost:55436/goviet247_test: hai tài xế chỉ định nhận đồng thời chỉ một thắng/một hold; outsider không có debit; regression commission/tax/refund và giới hạn chuyến.
- Test audience, approval, socket spoofing, push recipient filtering, gợi ý loại chuyến về, ATT granted/denied và bỏ qua Expo Go/Web.
- Prisma generate thành công. Migration SQL mới chạy thành công trong transaction trên DB tạm rồi rollback; chuyến cũ được backfill audience rỗng.
- Admin Web production build thành công bằng Node 22.22.2 (Vite cần Node >=20.19 hoặc >=22.12); còn cảnh báo bundle lớn.
- TypeScript `--noEmit` pass cho Admin, Driver, Rider Mobile.
- Expo config introspection với app ID/token giả xác nhận cấu hình native iOS/Android và ATT; không gửi event thật.
- Chưa test giao diện trên máy thật/simulator, chưa compile native iOS/Android, chưa kiểm chứng Meta dashboard/campaign. Đây là các bước QA release còn cần thực hiện.

### Lệnh test/build

Chạy từ repo root với Node 22:

```sh
pnpm install --frozen-lockfile
pnpm --filter @goviet247/api exec prisma generate
node --test apps/api/tests/*.test.js tests/trip-time.test.mjs tests/meta-ads.test.cjs
pnpm exec tsc --noEmit -p apps/admin-mobile/tsconfig.json
pnpm exec tsc --noEmit -p apps/driver-mobile/tsconfig.json
pnpm exec tsc --noEmit -p apps/rider-mobile/tsconfig.json
pnpm --filter goviet247-web build
```

Để test tích hợp không bị skip, tạo DB PostgreSQL disposable tên `goviet247_test` trên localhost, dùng **URL test rõ ràng**, áp schema rồi chạy:

```sh
DATABASE_URL="$TEST_DATABASE_URL" pnpm --filter @goviet247/api exec prisma db push
TEST_DATABASE_URL="$TEST_DATABASE_URL" node --test apps/api/tests/*.test.js tests/trip-time.test.mjs tests/meta-ads.test.cjs
```

Integration test có TRUNCATE và chỉ chấp nhận localhost/127.0.0.1 + tên database goviet247_test. Không đặt biến này thành DB thật.

Release API sau khi kiểm tra các migration đang chờ của repo:

```sh
pnpm --filter @goviet247/api exec prisma migrate status
pnpm --filter @goviet247/api exec prisma migrate deploy
pnpm --filter @goviet247/api exec prisma generate
```

Build từng app tại thư mục tương ứng (đầu tháng sau theo kế hoạch, dùng EAS env đã cấu hình):

```sh
cd apps/rider-mobile
npx expo config --type introspect
npx eas-cli build --platform all --profile production
# Chạy cùng lệnh eas-cli build tại apps/admin-mobile và apps/driver-mobile.
```

### Tương thích và thứ tự release

Schema là additive; chuyến cũ và API nhận chuyến cũ giữ format. Driver không cần giao diện nhận chuyến mới, nhưng **cần phát hành bản Driver mới để socket có token**, đồng thời có fix giờ ví. Driver cũ vẫn có API list/accept và push hiện tại, nhưng socket không token sẽ bị từ chối. Rider cũ cũng mất socket không token; bản mới đã sửa. Có thể đưa client mới lên trước vì BE cũ bỏ qua trường auth, rồi migrate/deploy BE và Web; chỉ dùng duyệt chỉ định sau khi BE mới đã phục vụ toàn bộ traffic.

Không chạy lẫn BE cũ/mới khi đã có chuyến riêng tư: BE cũ không hiểu audience và có thể phát công khai. Nếu cần rollback, phải ngừng duyệt/nhận/broadcast chuyến riêng tư và xử lý chúng trước; không chỉ rollback server một cách mù quáng. Không thêm chế độ cho socket không token vào phòng để “tương thích”, vì sẽ phá yêu cầu giữ riêng tư.

## 6. File thuộc thay đổi Day 306

- `apps/api/prisma/schema.prisma`
- `apps/api/prisma/migrations/202609260001_day306_targeted_trips/migration.sql`
- `apps/api/src/controllers/tripAudienceController.js`
- `apps/api/src/services/tripAudiencePolicy.js`
- `apps/api/src/services/tripAudience.js`
- `apps/api/src/controllers/tripController.js`
- `apps/api/src/controllers/adminTripController.js`
- `apps/api/src/controllers/adminController.js`
- `apps/api/src/controllers/tripConfigController.js`
- `apps/api/src/services/notificationService.js`
- `apps/api/src/routes/trips.js`
- `apps/api/src/server.js`
- `apps/web/src/components/admin/TripAudienceDialog.jsx`
- `apps/web/src/pages/admin/AdminTrips.jsx`
- `apps/web/src/api/adminTrips.js`
- `apps/web/src/pages/admin/AdminConfig.jsx`
- `apps/web/src/pages/admin/AdminDriverWallets.jsx`
- `apps/web/src/pages/admin/AdminLayout.jsx`
- `apps/web/src/services/adminSocket.js`
- `apps/web/src/pages/customer/CustomerProfile.jsx`
- `apps/admin-mobile/components/TripAudiencePicker.tsx`
- `apps/admin-mobile/app/pending-trips.tsx`
- `apps/driver-mobile/app/dashboard.tsx`
- `apps/driver-mobile/app/wallet.tsx`
- `apps/rider-mobile/app.config.js`
- `apps/rider-mobile/.env.meta.example`
- `apps/rider-mobile/services/metaAds.ts`
- `apps/rider-mobile/app/_layout.tsx`
- `apps/rider-mobile/services/riderSocket.ts`
- `apps/rider-mobile/package.json`
- `pnpm-lock.yaml`
- `apps/api/tests/tripAudience.test.js`
- `apps/api/tests/tripAcceptance.integration.test.js`
- `apps/api/tests/tripPublicTime.test.js`
- `tests/meta-ads.test.cjs`

Các file ngày giờ khác đang hiện trong git diff là thay đổi có sẵn trước phiên này; đã kiểm tra thay vì viết lại.
