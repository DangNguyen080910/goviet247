# Rà soát thư viện Mobile — 02/11/2026

## Kết luận theo phạm vi kiểm tra
Không phát hiện thiếu AsyncStorage hoặc các module native đang dùng cho hội thoại (ghi âm, vị trí, ảnh, thông báo, haptic, SecureStore) trong các bản build đã đối chiếu:

| App | Bản iOS đã kiểm tra | Bản Android đã kiểm tra |
|---|---|---|
| Rider | 1.1.8 / build 49 | 1.1.8 / versionCode 31 |
| Admin | 1.1.6 / build 43 | 1.1.6 / versionCode 36 |
| Driver | 1.1.4 / build 21 | 1.1.4 / versionCode 30 |

Dữ liệu: lịch sử EAS và log INSTALL_PODS/RUN_GRADLEW của đúng build; không coi thông tin package.json trong log là bằng chứng native đã được cài. Các Pods iOS được đối chiếu từ các dòng Installing/Using trong bước INSTALL_PODS. Cấu hình iOS cục bộ cũ không dùng để suy ra nội dung bản EAS trên Store.

Code hiện tại: Rider 1.1.9, Admin 1.1.7, Driver 1.1.4. Đã rà import trực tiếp và shared mobile-chat; Android/iOS đều resolve đủ native dependencies. Đây không phải xác nhận bản Rider 1.1.9 hoặc Admin 1.1.7 đã được build/phát hành.

## Đã bổ sung
- Rider trực tiếp khai báo @expo/vector-icons và @react-navigation/native, vốn được import nhưng đang dựa vào dependency gián tiếp. Dùng đúng phiên bản đã tồn tại trong lockfile; không nâng phiên bản module native.
- Cả ba app chạy check:native và eas-build-post-install với checker chung tại apps/mobile-chat/check-native-linking.cjs.
- Checker đọc import từ app và mobile-chat, phát hiện package chưa khai báo; kiểm tra React Native/Expo autolinking theo nền tảng thực tế, bao gồm module chỉ hỗ trợ iOS.
- Trên EAS iOS, post-install hook kiểm tra thêm PODS trong ios/Podfile.lock (hook chạy sau pod install). Chỉ có tên trong phần DEPENDENCIES không được coi là cài thành công.
- Giữ đường dẫn script cũ của Driver để lệnh hiện có tiếp tục hoạt động.

## Validation
- Hai kiểm thử: import dùng chung có module thiếu; iOS resolver có AsyncStorage nhưng danh sách Pods cài thiếu.
- Sáu lần chạy checker: Rider 16 Android / 17 iOS; Admin và Driver 23 Android / 25 iOS (native dependencies trực tiếp).
- Đối chiếu checker với Pods cài thực trong log iOS: Rider 97 Pods, Admin/Driver 111 Pods.
- TypeScript noEmit cả ba app và kiểm tra frozen-lockfile pnpm 10.20.0.

## Giới hạn và việc tiếp theo
- Log Expo Doctor có cảnh báo patch Expo chưa mới nhất: Rider 7, Admin/Driver 9 package trong các build đã kiểm tra. Chưa nâng các phiên bản này trong đợt rà soát; cảnh báo không chứng minh thiếu native module hay là nguyên nhân crash.
- Kiểm tra thư viện không thay thế thử app thật: cần cài đúng build qua TestFlight/APK, thử cold launch, đăng nhập, chat, microphone, camera, vị trí và push khi chạy nền trước khi phát hành.
- Không tạo build trả phí, không submit Store và không deploy trong đợt rà soát này. Các guard chỉ có hiệu lực ở build tạo sau khi cập nhật mã nguồn.
