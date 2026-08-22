ALTER TABLE "TripConfig"
ADD COLUMN "riderBookingNotePlaceholder" TEXT NOT NULL DEFAULT 'Ví dụ: Yêu cầu xe Fortuner đời 2023+, xe xăng, xe điện, xe biển trắng, có thú cưng, có em bé,... bạn có thể ghi thêm bất kỳ yêu cầu riêng nào';

ALTER TABLE "SystemConfig"
ADD COLUMN "riderLatestVersion" TEXT NOT NULL DEFAULT '1.0.6',
ADD COLUMN "riderMinimumVersion" TEXT NOT NULL DEFAULT '1.0.6',
ADD COLUMN "riderIosStoreUrl" TEXT NOT NULL DEFAULT 'https://apps.apple.com/vn/app/goviet247/id6767422059',
ADD COLUMN "riderAndroidStoreUrl" TEXT NOT NULL DEFAULT 'https://play.google.com/store/apps/details?id=com.goviet247.rider',
ADD COLUMN "riderUpdateMessage" TEXT NOT NULL DEFAULT 'GoViet247 đã có phiên bản mới với các cải tiến và sửa lỗi.',
ADD COLUMN "driverLatestVersion" TEXT NOT NULL DEFAULT '1.0.2',
ADD COLUMN "driverMinimumVersion" TEXT NOT NULL DEFAULT '1.0.2',
ADD COLUMN "driverIosStoreUrl" TEXT NOT NULL DEFAULT '',
ADD COLUMN "driverAndroidStoreUrl" TEXT NOT NULL DEFAULT 'https://play.google.com/store/apps/details?id=com.goviet247.driver',
ADD COLUMN "driverUpdateMessage" TEXT NOT NULL DEFAULT 'GoViet247 Driver đã có phiên bản mới với các cải tiến và sửa lỗi.',
ADD COLUMN "adminLatestVersion" TEXT NOT NULL DEFAULT '1.0.2',
ADD COLUMN "adminMinimumVersion" TEXT NOT NULL DEFAULT '1.0.2',
ADD COLUMN "adminIosStoreUrl" TEXT NOT NULL DEFAULT '',
ADD COLUMN "adminAndroidStoreUrl" TEXT NOT NULL DEFAULT 'https://play.google.com/store/apps/details?id=com.goviet247.admin',
ADD COLUMN "adminUpdateMessage" TEXT NOT NULL DEFAULT 'GoViet247 Admin đã có phiên bản mới với các cải tiến và sửa lỗi.';
