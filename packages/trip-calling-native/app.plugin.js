const {withInfoPlist}=require('expo/config-plugins');
module.exports=config=>withInfoPlist(config,c=>{
 c.modResults.UIBackgroundModes=[...new Set([...(c.modResults.UIBackgroundModes||[]),'audio','voip'])];
 c.modResults.NSMicrophoneUsageDescription='GoViet247 dùng micro để gọi qua internet và gửi tin nhắn thoại. Cuộc gọi được ghi âm để hỗ trợ chuyến.';
 return c;
});
