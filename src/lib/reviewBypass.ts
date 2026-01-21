/**
 * 서버용 Android 앱 리뷰 우회 유틸
 * User-Agent로 Android + DoNa 앱(WebView) 요청인지 판별
 * → Android 앱에서만 우회, iOS·웹은 해당 없음
 */
export function isAndroidAppRequest(headers: { get(name: string): string | null }): boolean {
    const ua = (headers.get("user-agent") || "").toLowerCase();
    return /android/.test(ua) && /dona_app|expo|reactnative/i.test(ua);
}
