// Meta client token is a public mobile SDK credential. Never use the app secret here.
module.exports = ({ config }) => {
  const appID = process.env.META_APP_ID;
  const clientToken = process.env.META_CLIENT_TOKEN;
  const enabled = Boolean(appID && clientToken);
  if ((appID || clientToken) && !enabled) throw new Error('META_APP_ID and META_CLIENT_TOKEN must be configured together.');
  return {
    ...config,
    extra: { ...config.extra, metaAdsEnabled: enabled },
    plugins: [...(config.plugins || []), ...(enabled ? [
      ['react-native-fbsdk-next', { appID, clientToken, displayName: 'GoViet247', scheme: `fb${appID}`, isAutoInitEnabled: false, autoLogAppEventsEnabled: true, advertiserIDCollectionEnabled: false }],
      ['expo-tracking-transparency', { userTrackingPermission: 'GoViet247 xin phép sử dụng mã quảng cáo để đo hiệu quả quảng cáo và cải thiện cách giới thiệu ứng dụng.' }],
    ] : [])],
  };
};
