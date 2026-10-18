// Expo's default config already supports npm workspaces (watchFolders / nodeModulesPaths).
const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);
module.exports = withNativeWind(config, { input: './global.css', inlineRem: 16 });
