const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// Support platform-specific imports (.native, .ios, .android, .web)  
// Metro will prioritize these extensions based on platform
config.resolver.sourceExts = [
  ...config.resolver.sourceExts,
  "native.js", "native.ts", "native.tsx",
];

// Completely block react-native-maps from web bundle
const blockList = [
  ...(config.resolver.blockList || []),
  /node_modules[/\\]react-native-maps[/\\]/,
];

config.resolver.blockList = blockList;

module.exports = config;
