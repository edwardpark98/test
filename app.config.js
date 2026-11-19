// Builds on app.json. With PILLTIME_SIDELOAD=1 (set by scripts/build-ipa.sh) it makes the
// AltStore version: a free Apple ID can't sign the Time Sensitive notification entitlement,
// so it is left out. Everything else is identical.
module.exports = ({ config }) => {
  if (process.env.PILLTIME_SIDELOAD !== '1') return config;
  const { entitlements, ...ios } = config.ios || {};
  const rest = { ...(entitlements || {}) };
  delete rest['com.apple.developer.usernotifications.time-sensitive'];
  return {
    ...config,
    ios: Object.keys(rest).length ? { ...ios, entitlements: rest } : ios,
  };
};
