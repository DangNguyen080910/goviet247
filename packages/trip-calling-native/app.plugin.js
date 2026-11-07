const {withInfoPlist}=require('expo/config-plugins');
module.exports=config=>withInfoPlist(config,c=>{
 c.modResults.UIBackgroundModes=[...new Set([...(c.modResults.UIBackgroundModes||[]),'audio','voip'])];
 c.modResults.NSMicrophoneUsageDescription=config.ios?.bundleIdentifier?.endsWith('.driver') ? 'Cho phép GoViet247 dùng micro để bạn và khách hàng gọi cho nhau, và gửi tin nhắn thoại.' : 'Cho phép GoViet247 dùng micro để bạn và tài xế gọi cho nhau, và gửi tin nhắn thoại.';
 return c;
});
