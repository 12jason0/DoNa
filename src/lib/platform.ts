/**
 * 플랫폼 감지 유틸리티
 * iOS와 Android를 구분하여 다른 UI/UX를 제공하기 위한 함수들
 */

export type Platform = "ios" | "android" | "web";

/**
 * 현재 접속한 플랫폼을 감지합니다.
 * @returns 'ios' | 'android' | 'web'
 */
export function detectPlatform(): Platform {
    if (typeof window === "undefined") return "web";

    const userAgent = window.navigator.userAgent.toLowerCase();

    // iOS 감지 (iPhone, iPad, iPod)
    if (/iphone|ipad|ipod/.test(userAgent)) {
        return "ios";
    }

    // Android 감지
    if (/android/.test(userAgent)) {
        return "android";
    }

    // 기본값: 웹
    return "web";
}

/**
 * iOS 플랫폼인지 확인합니다.
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
