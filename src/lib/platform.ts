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
    // 🟢 앱 WebView 초기 스크립트에서 주입 (UA보다 우선)
    if ((window as any).__DoNa_App === true) return true;

    const userAgent = window.navigator.userAgent;
    
    // 🟢 1순위: User Agent에 DoNa_App이 포함되어 있으면 확실히 앱 환경
    const hasDoNaApp = /DoNa_App/i.test(userAgent);
    if (hasDoNaApp) return true;

    // 🟢 2순위: ReactNativeWebView 객체 확인 (앱에서 주입됨)
    const hasWebView = !!(window as any).ReactNativeWebView;
    
    // 🟢 3순위: User Agent로 Expo/ReactNative 확인
    const isExpo = /ReactNative|Expo/i.test(userAgent);

    // 🟢 웹 브라우저에서는 ReactNativeWebView가 없어야 함
    // 단, ReactNativeWebView가 있고 User Agent에 DoNa_App이 없으면 웹 브라우저로 간주
    // (개발 환경에서 수동으로 주입된 경우 방지)
    if (hasWebView && !hasDoNaApp && !isExpo) {
        // 웹 브라우저에서 수동으로 주입된 경우일 수 있으므로 false 반환
        return false;
    }

    return hasWebView || isExpo;
}

/**
 * Android 앱 WebView에서 리뷰 우회용으로, 클라이언트에서만 사용.
 * (서버는 reviewBypass.isAndroidAppRequest + User-Agent 사용)
 * → Android 앱에서만 true, iOS·웹은 false
 */
export function isAndroidReviewBypass(): boolean {
    return isMobileApp() && isAndroid();
}
