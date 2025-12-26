/**
 * 리다이렉트 보안 검증 유틸리티
 * 외부 도메인으로의 리다이렉트를 방지합니다.
 */

/**
 * 리다이렉트 경로가 안전한지 검증합니다.
 * @param path - 검증할 경로
 * @returns 안전한 내부 경로인지 여부
 */
export function isValidRedirectPath(path: string | null | undefined): boolean {
    if (!path) return false;

    try {
        const url = new URL(path, "http://localhost");
        
        // 절대 URL인 경우, 같은 도메인인지 확인
        if (url.protocol === "http:" || url.protocol === "https:") {
            // 내부 도메인만 허용 (localhost, 같은 도메인 등)
            const allowedHosts = [
                "localhost",
                process.env.NEXT_PUBLIC_APP_URL?.replace(/^https?:\/\//, "").split(":")[0],
            ].filter(Boolean);
            
            return allowedHosts.some(host => url.hostname === host || url.hostname.endsWith(`.${host}`));
        }
        
        // 상대 경로인 경우 허용 (/, /courses, /courses/1 등)
        return path.startsWith("/") && !path.startsWith("//");
    } catch {
        // URL 파싱 실패 시 안전하게 처리
        return path.startsWith("/") && !path.startsWith("//");
    }
}

/**
 * 안전한 리다이렉트 경로를 반환합니다.
 * @param path - 원하는 경로
 * @param fallback - 검증 실패 시 사용할 기본 경로 (기본값: "/")
 * @returns 안전한 경로
 */
export function getSafeRedirectPath(path: string | null | undefined, fallback: string = "/"): string {
    if (isValidRedirectPath(path)) {
        return path!;
    }
    return fallback;
}

