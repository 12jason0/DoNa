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
        // 🟢 [Fix]: 로그아웃 중이라면 서버에 묻지도 않고 즉시 false 반환
        if (isLoggingOut) {
            console.log("[authClient] 로그아웃 중 - 세션 체크 차단");
            return { authenticated: false, user: null };
        }
        
        // 🟢 [Fix]: 로그인/로그아웃 직후라면 캐시를 무시하고 강제로 새로 확인 (로컬/카카오 로그인 통합)
        if (typeof window !== "undefined") {
            // 로그인 직후 강제 갱신
            const forceRefresh = sessionStorage.getItem("auth:forceRefresh");
            if (forceRefresh) {
                const timeSinceLogin = Date.now() - parseInt(forceRefresh, 10);
                // 로그인 후 10초 이내라면 캐시 무시
                if (timeSinceLogin < 10000) {
                    sessionPromise = null;
                    sessionStorage.removeItem("auth:forceRefresh");
                }
            }
            
            // 로그아웃 직후 강제 갱신
            const loggingOutTime = sessionStorage.getItem("auth:loggingOut");
            if (loggingOutTime) {
                const timeSinceLogout = Date.now() - parseInt(loggingOutTime, 10);
                // 로그아웃 후 10초 이내라면 캐시 무시
                if (timeSinceLogout < 10000) {
                    sessionPromise = null;
                }
            }
        }
        
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
     * 
     * @param options.skipRedirect - true이면 리다이렉트를 하지 않음 (스플래시 표시 후 수동 리다이렉트용)
     */
    export async function logout(options?: { skipRedirect?: boolean }): Promise<boolean> {
        if (isLoggingOut) return true;
        isLoggingOut = true;

        // 🟢 1. [핵심] 즉시 "비로그인 상태"를 캐시에 강제 주입
        // 이렇게 하면 이후 5초 동안 누가 fetchSession을 호출해도 서버에 묻지 않고 "비로그인"을 반환합니다.
        sessionPromise = Promise.resolve({ authenticated: false, user: null });

        if (typeof window !== "undefined") {
            // 🟢 2. 로그아웃 직후임을 표시하여 메인 페이지 스플래시 방지
            // clear() 전에 설정해야 clear()가 실행되어도 플래그가 유지됩니다.
            sessionStorage.setItem("dona-splash-shown", "true");
            sessionStorage.setItem("auth:loggingOut", Date.now().toString());
            
            // 🟢 3. 스토리지 청소 (dona-splash-shown은 위에서 설정했으므로 유지됨)
            localStorage.clear();
            sessionStorage.clear();
            
            // 🟢 4. clear() 후 다시 설정 (clear()가 이미 설정한 플래그를 삭제할 수 있으므로)
            sessionStorage.setItem("dona-splash-shown", "true");
            
            // 🟢 5. 전역 이벤트 발생 (Header/Footer 즉시 반응)
            window.dispatchEvent(new CustomEvent("authLogout"));
        }

        try {
            // 서버에 쿠키 삭제 요청
            await fetch("/api/auth/logout", { method: "POST", credentials: "include" });

            if (!options?.skipRedirect && typeof window !== "undefined") {
                // 🟢 4. [핵심] replace 대신 href로 "하드 새로고침"
                // 모든 자바스크립트 변수와 리액트 상태를 0에서 다시 시작하게 합니다.
                window.location.href = "/"; 
            }
            return true;
        } catch (error) {
            if (typeof window !== "undefined") window.location.href = "/";
            return false;
        } finally {
            // 리다이렉트가 되므로 의미는 없지만 논리적 완결성을 위해 유지
            setTimeout(() => { isLoggingOut = false; }, 2000);
        }
    }

    /**
     * 🟢 범용 API 호출 헬퍼 (쿠키 자동 포함)
     * 모든 클라이언트 fetch 요청에 credentials: "include"를 자동으로 추가합니다.
     */

    /**
     * 🟢 범용 API 호출 헬퍼 (쿠키 자동 포함)
     * 모든 클라이언트 fetch 요청에 credentials: "include"를 자동으로 추가합니다.
     */
    export async function apiFetch<T>(
        input: RequestInfo | URL,
        init?: RequestInit
    ): Promise<{ data: T | null; response: Response }> {
        // 🟢 [Fix]: 로그인 직후 캐시 완전 우회를 위해 headers 병합
        const headers = new Headers();
        
        // init에 기존 headers가 있으면 먼저 추가
        if (init?.headers) {
            if (init.headers instanceof Headers) {
                init.headers.forEach((value, key) => {
                    headers.set(key, value);
                });
            } else if (Array.isArray(init.headers)) {
                init.headers.forEach(([key, value]) => {
                    headers.set(key, value);
                });
            } else {
                // Record<string, string> 형태
                Object.entries(init.headers).forEach(([key, value]) => {
                    headers.set(key, value);
                });
            }
        }
        
        const response = await fetch(input, {
            ...init,
            headers,
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
