const { withAndroidManifest } = require("expo/config-plugins");

const BARCODE_SCANNER_ACTIVITY =
  "com.google.mlkit.vision.codescanner.internal.GmsBarcodeScanningDelegateActivity";

module.exports = function withAndroid16Compatibility(config) {
  return withAndroidManifest(config, (configWithManifest) => {
    const manifest = configWithManifest.modResults.manifest;
    manifest.$ = manifest.$ || {};
    manifest.$["xmlns:tools"] = "http://schemas.android.com/tools";

    const application = manifest.application?.[0];
    if (!application) return configWithManifest;

    for (const activity of application.activity || []) {
      if (activity.$) delete activity.$["android:screenOrientation"];
    }

    application.activity = application.activity || [];
    const scannerActivity = application.activity.find(
      (activity) => activity.$?.["android:name"] === BARCODE_SCANNER_ACTIVITY,
    );
    const override = scannerActivity || { $: { "android:name": BARCODE_SCANNER_ACTIVITY } };
    override.$["tools:node"] = "merge";
    override.$["tools:remove"] = "android:screenOrientation";
    if (!scannerActivity) application.activity.push(override);

    return configWithManifest;
  });
};
