export type AuthUser = { id: number; email: string; name: string; nickname?: string } | null;

/**
 * 🟢 세션 확인 (쿠키 기반)
 *
 * 서버의 쿠키를 확인하여 현재 로그인 상태를 반환합니다.
 * localStorage를 사용하지 않고 쿠키만 사용합니다.
 */
export async function fetchSession(): Promise<{ authenticated: boolean; user: AuthUser }> {
    try {
        const res = await fetch("/api/auth/session", {
            method: "GET",
            credentials: "include", // 🟢 쿠키 전송 필수
            cache: "no-store",
        });

        if (!res.ok) {
            return { authenticated: false, user: null };
        }

        const data = await res.json();
        return {
            authenticated: !!data.authenticated,
            user: data.user ?? null,
        };
    } catch (error) {
        console.error("[authClient] 세션 확인 실패:", error);
        return { authenticated: false, user: null };
    }
}

/**
 * 🟢 로그아웃 (쿠키 기반)
 *
 * 서버의 쿠키를 삭제하여 로그아웃합니다.
 * localStorage를 사용하지 않고 쿠키만 사용합니다.
 */
export async function logout(): Promise<boolean> {
    try {
        const res = await fetch("/api/auth/logout", {
            method: "POST",
            credentials: "include", // 🟢 쿠키 전송 필수
        });

        if (res.ok) {
            // 🟢 로그아웃 성공 시 localStorage 정리
            if (typeof window !== "undefined") {
                localStorage.removeItem("authToken");
                localStorage.removeItem("user");
                localStorage.removeItem("loginTime");

                // 🟢 스플래시 화면을 다시 표시하기 위해 sessionStorage 삭제
                sessionStorage.removeItem("dona-splash-shown");

                // 🟢 로그아웃 이벤트 발생 (컴포넌트들이 상태를 초기화하도록)
                window.dispatchEvent(new CustomEvent("authLogout"));

                // 🟢 스플래시 화면을 보여주기 위해 메인 페이지로 이동 (새로고침 포함)
                window.location.href = "/";
            }
            return true;
        }

        return false;
    } catch (error) {
        console.error("[authClient] 로그아웃 실패:", error);

        // 🟢 에러 발생 시에도 안전을 위해 메인으로 강제 이동하며 새로고침
        if (typeof window !== "undefined") {
            sessionStorage.removeItem("dona-splash-shown");
            window.location.href = "/";
        }
        return false;
    }
}
/**
 * 🟢 범용 API 호출 헬퍼 (쿠키 자동 포함)
 * 모든 클라이언트 fetch 요청에 credentials: "include"를 자동으로 추가합니다.
 */
export async function apiFetch<T>(
    input: RequestInfo | URL,
    init?: RequestInit
): Promise<{ data: T | null; response: Response }> {
    const response = await fetch(input, {
        ...init,
        credentials: "include", // 🟢 모든 요청에 쿠키 포함
    });

    let data: T | null = null;
    try {
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
            data = await response.json();
        } else {
            // JSON이 아니면 텍스트로 시도하거나 null 반환
            data = (await response.text()) as T;
        }
    } catch (e) {
        console.warn("API 응답 JSON 파싱 실패 (무시):", e);
    }

    return { data, response };
}

/**
 * 🟢 인증이 필요한 API 호출 헬퍼
 * 401 Unauthorized 응답 시 자동으로 로그아웃 처리하고 로그인 페이지로 리다이렉트합니다.
 */
export async function authenticatedFetch<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T | null> {
    const { data, response } = await apiFetch<T>(input, init);

    if (response.status === 401) {
        console.warn("401 Unauthorized 응답 감지, 자동 로그아웃 처리.");
        await logout();
        // 로그인 페이지로 리다이렉트
        if (typeof window !== "undefined") {
            window.location.href = "/login";
        }
        return null;
    }

    if (!response.ok) {
        const errorMsg = (data as any)?.error || response.statusText || "알 수 없는 오류";
        console.error(`API 호출 실패 (${response.status}): ${errorMsg}`, data);
        throw new Error(errorMsg);
    }

    return data;
}
