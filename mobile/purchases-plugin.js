// purchases-plugin.js
// Expo가 라이브러리 내부 파일을 직접 읽어서 터지는 것을 방지합니다.
module.exports = function (config) {
    return config; // 아무것도 찾지 말고 그냥 통과시켜!
};
