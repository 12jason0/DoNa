import { isMobileApp } from "@/lib/platform";

export type AuthUser = { id: number; email: string; name: string; nickname?: string } | null;

/** * 🟢 인증 요청 캐싱 변수
 * 짧은 시간 내에 발생하는 중복 인증 요청을 하나로 합치기 위해 사용합니다.
 */
let sessionPromise: Promise<{ authenticated: boolean; user: AuthUser }> | null = null;

/**
 * 🟢 세션 확인 (쿠키 기반) - [최적화 버전]
 *
 * 서버의 쿠키를 확인하여 현재 로그인 상태를 반환합니다.
 * 동시에 여러 번 호출되더라도 서버에는 단 1번만 요청을 보냅니다.
 */
export async function fetchSession(): Promise<{ authenticated: boolean; user: AuthUser }> {
    // 1. 이미 진행 중인 인증 요청이 있다면 그 결과를 재사용 (중복 호출 차단)
    if (sessionPromise) return sessionPromise;

    // 2. 새로운 인증 요청 생성
    sessionPromise = (async () => {
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
            return { authenticated: false, user: null };
        }
    })();

    // 3. 요청이 완료된 후 5초 동안은 동일한 결과를 반환하도록 유지 (서버 부하 방어)
    // 5초 후에는 변수를 비워 다음 필요 시 다시 서버에서 신선한 정보를 가져오게 합니다.
    const result = await sessionPromise;
    setTimeout(() => {
        sessionPromise = null;
    }, 5000);

    return result;
}

// 🟢 [Fix]: 로그아웃 중복 실행 방지
let isLoggingOut = false;
let logoutPromise: Promise<boolean> | null = null;

/**
 * 🟢 로그아웃 (쿠키 기반)
 *
 * 서버의 쿠키를 삭제하여 로그아웃합니다.
 * localStorage를 사용하지 않고 쿠키만 사용합니다.
 */
export async function logout(): Promise<boolean> {
    // 🟢 [Fix]: 이미 로그아웃 중이면 기존 Promise 반환
    if (isLoggingOut && logoutPromise) {
        console.warn("[authClient] 로그아웃이 이미 진행 중입니다.");
        return logoutPromise;
    }

    isLoggingOut = true;

    logoutPromise = (async () => {
        try {
            // 🟢 [Fix]: 애플 로그인 직후 쿠키 동기화 대기
            // 애플 로그인 후 5초 이내라면 쿠키 동기화를 위해 짧은 대기
            if (typeof window !== "undefined") {
                const loginSuccessTime = sessionStorage.getItem("login_success_trigger");
                if (loginSuccessTime) {
                    const timeSinceLogin = Date.now() - parseInt(loginSuccessTime, 10);
                    if (timeSinceLogin < 5000) {
                        // 🟢 쿠키 동기화를 위해 200ms 대기
                        await new Promise((resolve) => setTimeout(resolve, 200));
                    }
                }
            }

            const res = await fetch("/api/auth/logout", {
                method: "POST",
                credentials: "include", // 🟢 쿠키 전송 필수
                cache: "no-store", // 🟢 캐시 방지
            });

            // 🟢 로그아웃 성공 여부와 관계없이 클라이언트 상태 정리
            if (typeof window !== "undefined") {
                // 🟢 localStorage 정리
                localStorage.removeItem("authToken");
                localStorage.removeItem("user");
                localStorage.removeItem("loginTime");

                // 🟢 스플래시 화면을 다시 표시하기 위해 sessionStorage 삭제
                sessionStorage.removeItem("dona-splash-shown");
                sessionStorage.removeItem("login_success_trigger");

                // 🟢 로그아웃 이벤트 발생 (컴포넌트들이 상태를 초기화하도록)
                window.dispatchEvent(new CustomEvent("authLogout"));

                // 🟢 [Fix]: 앱 환경에서 로그아웃 처리 강화
                const isApp = isMobileApp();

                if (isApp && (window as any).ReactNativeWebView) {
                    // 🟢 앱 환경: WebView에 로그아웃 완료 메시지 전송 및 강제 리로드
                    try {
                        (window as any).ReactNativeWebView.postMessage(
                            JSON.stringify({ type: "logout", success: res.ok })
                        );
                    } catch (e) {
                        console.warn("[authClient] WebView 메시지 전송 실패:", e);
                    }
                    // 🟢 앱 환경에서는 쿠키 삭제를 확실히 하기 위해 페이지를 강제로 리로드
                    // replace를 사용하여 히스토리에 남지 않도록 하고, 더 긴 대기 시간 확보
                    setTimeout(() => {
                        window.location.replace("/");
                    }, 200);
                } else {
                    // 🟢 웹 환경: 로그아웃 성공 여부 확인 후 리다이렉트
                    if (res.ok) {
                        // 🟢 서버 로그아웃 성공 - 즉시 리다이렉트
                        window.location.replace("/");
                        return true;
                    } else {
                        // 🟢 [Fix]: 로그아웃 실패 시 재시도 (애플 로그인 후 쿠키 동기화 문제 대응)
                        console.warn("[authClient] 로그아웃 실패, 재시도 중...");
                        try {
                            // 🟢 100ms 후 재시도
                            await new Promise((resolve) => setTimeout(resolve, 100));
                            const retryRes = await fetch("/api/auth/logout", {
                                method: "POST",
                                credentials: "include",
                                cache: "no-store",
                            });

                            if (retryRes.ok) {
                                window.location.replace("/");
                                return true;
                            }
                        } catch (retryError) {
                            console.error("[authClient] 로그아웃 재시도 실패:", retryError);
                        }

                        // 🟢 재시도 실패해도 클라이언트 상태는 정리하고 리다이렉트
                        window.location.replace("/");
                        return false;
                    }
                }

                return res.ok;
            }

            return res.ok;
        } catch (error) {
            console.error("[authClient] 로그아웃 실패:", error);

            // 🟢 에러 발생 시에도 안전을 위해 메인으로 강제 이동
            if (typeof window !== "undefined") {
                sessionStorage.removeItem("dona-splash-shown");
                sessionStorage.removeItem("login_success_trigger");
                window.dispatchEvent(new CustomEvent("authLogout"));

                // 🟢 앱 환경에서는 강제 리로드
                const isApp = isMobileApp();
                if (isApp && (window as any).ReactNativeWebView) {
                    try {
                        (window as any).ReactNativeWebView.postMessage(
                            JSON.stringify({ type: "logout", success: false })
                        );
                    } catch (e) {
                        console.warn("[authClient] WebView 메시지 전송 실패:", e);
                    }
                    setTimeout(() => {
                        window.location.replace("/");
                    }, 200);
                } else {
                    window.location.replace("/");
                }
            }
            return false;
        } finally {
            // 🟢 [Fix]: 로그아웃 완료 후 플래그 초기화 (3초 후)
            setTimeout(() => {
                isLoggingOut = false;
                logoutPromise = null;
            }, 3000);
        }
    })();

    return logoutPromise;
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
 * * @param shouldRedirect - true일 경우 401 응답 시 자동 로그아웃 및 리다이렉트 수행 (기본값: true)
 */
export async function authenticatedFetch<T>(
    input: RequestInfo | URL,
    init?: RequestInit,
    shouldRedirect: boolean = true // 기본값은 true로 두어 기존 기능 보존
): Promise<T | null> {
    const { data, response } = await apiFetch<T>(input, init);

    if (response.status === 401) {
        // 🟢 [Fix]: 로그인 직후 쿠키 동기화 시간을 고려하여 일정 시간 동안 401 무시
        if (typeof window !== "undefined") {
            const loginSuccessTime = sessionStorage.getItem("login_success_trigger");
            if (loginSuccessTime) {
                const timeSinceLogin = Date.now() - parseInt(loginSuccessTime, 10);
                // 🟢 로그인 후 5초 이내에는 401을 무시 (쿠키 동기화 시간 확보)
                if (timeSinceLogin < 5000) {
                    console.log("[authenticatedFetch] 로그인 직후 쿠키 동기화 대기 중, 401 무시");
                    return null; // 🟢 리다이렉트하지 않고 null만 반환
                }
            }
        }

        if (shouldRedirect && typeof window !== "undefined") {
            // [Critical] 인증 실패 시 로그아웃 처리하되 무한 루프 방지를 위해 조건부 실행
            console.warn("401 Unauthorized 응답 감지, 자동 로그아웃 처리.");
            await logout();
            return null;
        }
        // shouldRedirect가 false인 경우 리다이렉트 없이 null 반환
        return null;
    }

    if (!response.ok) {
        const errorMsg = (data as any)?.error || response.statusText || "알 수 없는 오류";
        console.error(`API 호출 실패 (${response.status}): ${errorMsg}`, data);
        throw new Error(errorMsg);
    }

    return data;
}
