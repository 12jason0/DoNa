/**
 * 플랫폼 감지 유틸리티
 * iOS와 Android를 구분하여 다른 UI/UX를 제공하기 위한 함수들
 */

export type Platform = "ios" | "android" | "web";

/**
 * 수정된 플랫폼 감지 유틸리티
 * @returns 'ios' | 'android' | 'web'
 */
export function detectPlatform(): Platform {
    if (typeof window === "undefined") return "web";

    const userAgent = window.navigator.userAgent.toLowerCase();
    const platform = navigator.platform?.toLowerCase() || "";

    // 🟢 iPadOS 감지 (더 강력한 체크)
    // 1. User Agent에 "ipad" 포함
    // 2. 또는 Macintosh User Agent + maxTouchPoints >= 5 (iPad는 보통 5 이상)
    // 3. 또는 navigator.platform에 "iPad" 포함
    const isIPadUA = /ipad/.test(userAgent);
    const isMacLike = /macintosh|mac os x/.test(userAgent);
    const hasTouchPoints = navigator.maxTouchPoints >= 5; // iPad는 최소 5개 터치 포인트
    const isIPadPlatform = /ipad/.test(platform);

    const isIPadOS = isIPadUA || (isMacLike && hasTouchPoints) || isIPadPlatform;

    // iOS 감지 (iPhone, iPad, iPod 및 최신 iPadOS 대응)
    if (/iphone|ipod/.test(userAgent) || isIPadOS) {
        return "ios";
    }

    // Android 감지
    if (/android/.test(userAgent)) {
        return "android";
    }

    return "web";
}

/**
 * iOS 플랫폼인지 확인합니다.
 * detectPlatform() 함수를 사용하여 일관성 유지
 */
export function isIOS(): boolean {
    return detectPlatform() === "ios";
}

/**
 * Android 플랫폼인지 확인합니다.
 */
export function isAndroid(): boolean {
    return detectPlatform() === "android";
}

/**
 * 웹 플랫폼인지 확인합니다.
 */
export function isWeb(): boolean {
    return detectPlatform() === "web";
}

/**
 * 모바일 앱 환경(WebView)인지 확인합니다.
 * ReactNativeWebView 또는 Expo 환경을 감지합니다.
 */
export function isMobileApp(): boolean {
    if (typeof window === "undefined") return false;

    // ReactNativeWebView 객체 확인
    const hasWebView = !!(window as any).ReactNativeWebView;

    // User Agent로 Expo/ReactNative 확인
    const userAgent = window.navigator.userAgent;
    const isExpo = /ReactNative|Expo/i.test(userAgent);

    return hasWebView || isExpo;
}
