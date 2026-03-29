const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// react-native-svg 단일 인스턴스 보장
// reanimated v3 이하에서 svg를 내부 번들링하던 문제 방지용 (v4에서 해결됐지만 방어적으로 유지)
config.resolver.extraNodeModules = {
    ...config.resolver.extraNodeModules,
    'react-native-svg': path.resolve(__dirname, 'node_modules/react-native-svg'),
};

module.exports = config;
