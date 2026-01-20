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
        // 🟢 [Fix]: 이미 로그아웃 중이면 기존 Promise 반환
        if (isLoggingOut && logoutPromise) {
            console.warn("[authClient] 로그아웃이 이미 진행 중입니다.");
            return logoutPromise;
        }

        isLoggingOut = true;

        // 🟢 [긴급 Fix]: 진행 중이거나 캐시된 세션 확인 요청을 즉시 파괴
        // 사용자가 로그아웃을 눌렀는데, 마침 1초 전에 fetchSession이 실행되어 "로그인 성공" 상태가 5초 캐시에 잡혀있다면
        // 로그아웃 리다이렉트 직후 홈 화면에서 앱이 다시 로그인 상태라고 착각할 수 있음
        sessionPromise = null;
        
        // 🟢 [Fix]: 로그아웃 플래그를 sessionStorage에 저장하여 다른 컴포넌트에서 세션 캐시를 무시하도록 함
        if (typeof window !== "undefined") {
            sessionStorage.setItem("auth:loggingOut", Date.now().toString());
        }

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

                // 🟢 [배포용 최종 핵무기]: 서버가 못 지우는 로컬/세션 스토리지 강제 삭제
                // 앱의 WebView가 끈질기게 데이터를 붙잡고 있으므로 API 호출 전에 먼저 삭제
                if (typeof window !== "undefined") {
                    try {
                        localStorage.clear();
                        sessionStorage.clear();
                    } catch (e) {
                        console.warn("[authClient] 스토리지 초기화 중 오류:", e);
                    }
                }

                const res = await fetch("/api/auth/logout", {
                    method: "POST",
                    credentials: "include", // 🟢 쿠키 전송 필수
                    cache: "no-store", // 🟢 캐시 방지
                    headers: {
                        "Content-Type": "application/json",
                    },
                });

                // 🟢 로그아웃 성공 여부와 관계없이 추가 정리 (이미 위에서 clear 했지만 안전장치)
                if (typeof window !== "undefined") {
                    // 🟢 [배포용 최종 핵무기]: 추가로 남아있을 수 있는 데이터 완전 삭제
                    try {
                        // clear()가 실패했을 경우를 대비한 개별 삭제
                        localStorage.removeItem("authToken");
                        localStorage.removeItem("user");
                        localStorage.removeItem("loginTime");
                        localStorage.removeItem("isLoggedIn");
                        // 🟢 로그아웃 시 스플래시를 표시하지 않도록 설정 (메인으로 이동 후 스플래시가 나오지 않도록)
                        sessionStorage.setItem("dona-splash-shown", "true");
                        sessionStorage.removeItem("login_success_trigger");
                        sessionStorage.removeItem("auth:loggingIn");
                        
                        // 🟢 출석 현황 관련 localStorage 삭제
                        const checkinKeys = [];
                        for (let i = 0; i < localStorage.length; i++) {
                            const key = localStorage.key(i);
                            if (key && (key.includes("checkin") || key.includes("attendance") || key.includes("todayChecked") || key.includes("weekStamps") || key.includes("weekCount") || key.includes("streak"))) {
                                checkinKeys.push(key);
                            }
                        }
                        checkinKeys.forEach(key => localStorage.removeItem(key));
                    } catch (fallbackError) {
                        console.warn("[authClient] 개별 스토리지 삭제 중 오류:", fallbackError);
                    }

                    // 🟢 [긴급 Fix]: 로그아웃 이벤트를 여러 번 발생시켜 모든 컴포넌트가 확실히 받도록 함
                    // 앱 WebView에서는 이벤트 전파가 지연될 수 있으므로 약간의 지연을 두고 여러 번 발생
                    window.dispatchEvent(new CustomEvent("authLogout"));
                    window.dispatchEvent(new CustomEvent("authTokenChange"));

                    // 🟢 추가 이벤트 발생 (약간의 지연을 두어 모든 컴포넌트가 확실히 받도록)
                    setTimeout(() => {
                        window.dispatchEvent(new CustomEvent("authLogout"));
                        window.dispatchEvent(new CustomEvent("authTokenChange"));
                    }, 50);

                    setTimeout(() => {
                        window.dispatchEvent(new CustomEvent("authLogout"));
                    }, 150);

                    // 🟢 [배포용 최종 Fix]: 앱 환경에서 로그아웃 처리 강화
                    const isApp = isMobileApp();

                    // 🟢 [배포용 최종 Fix]: 단순 이동 대신 replace("/")로 히스토리와 캐시를 날림
                    // 타임스탬프를 붙이지 않고 깔끔하게 메인으로 이동하여 무한 루프 방지
                    const forceRedirect = () => {
                        if (isApp && (window as any).ReactNativeWebView) {
                            // 🟢 [Fix]: 앱에서는 replace 대신 초기 페이지로 이동 유도만 하고
                            // 실제 네비게이션은 Native bridge 메시지로 처리하는 것이 가장 안전함
                            console.log(
                                "[authClient] App environment detected. Skipping window.location.replace to prevent IP exposure."
                            );
                        } else {
                            // 🟢 중요: window.location.replace("/")로 히스토리와 캐시를 완전히 날림
                            window.location.replace("/");
                        }
                    };

                    if (isApp && (window as any).ReactNativeWebView) {
                        // 🟢 [App] Expo/React Native 클라이언트 대응
                        // 앱은 웹보다 쿠키 처리에 보수적이므로 API 호출 후 앱 내부의 전역 상태를 반드시 초기화해야 함
                        try {
                            (window as any).ReactNativeWebView.postMessage(
                                JSON.stringify({
                                    type: "logout",
                                    success: res.ok,
                                    // 🟢 [배포용 최종 Fix]: 타임스탬프 제거, 깔끔한 리다이렉트
                                    redirect: "/",
                                    // 🟢 [App] 전역 상태 초기화 지시
                                    clearState: true, // userContext나 Zustand 등에 저장된 유저 정보를 null로 바꾸도록 지시
                                    navigateTo: "Login", // navigation.replace('Login') 실행 지시
                                })
                            );
                        } catch (e) {
                            console.warn("[authClient] WebView 메시지 전송 실패:", e);
                        }
                        // 🟢 [Fix]: 앱에서는 location.replace("/")가 IP 노출의 주범일 수 있음
                        // 약간의 지연 후 세션 스토리지만 비우고 네이티브의 처리를 기다림
                        setTimeout(() => {
                            isLoggingOut = false;
                            logoutPromise = null;
                            // 🟢 [Fix]: 앱 환경에서는 window.location.replace 호출하지 않음
                            // Native bridge 메시지로 네비게이션 처리하도록 함
                        }, 500);
                        return res.ok;
                    } else {
                        // 🟢 웹 환경: 로그아웃 성공 여부 확인 후 리다이렉트
                        if (res.ok) {
                            // 🟢 skipRedirect 옵션이 있으면 리다이렉트 건너뛰기 (스플래시 표시 후 수동 리다이렉트용)
                            if (!options?.skipRedirect) {
                                // 🟢 서버 로그아웃 성공 - 캐시 버스팅 적용
                                forceRedirect();
                            }
                            // 🟢 [Fix]: 리다이렉트 후에는 플래그 즉시 초기화
                            isLoggingOut = false;
                            logoutPromise = null;
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
                                    forceRedirect();
                                    // 🟢 [Fix]: 리다이렉트 후에는 플래그 즉시 초기화
                                    isLoggingOut = false;
                                    logoutPromise = null;
                                    return true;
                                }
                            } catch (retryError) {
                                console.error("[authClient] 로그아웃 재시도 실패:", retryError);
                            }

                            // 🟢 재시도 실패해도 클라이언트 상태는 정리하고 리다이렉트 (캐시 버스팅 적용)
                            forceRedirect();
                            // 🟢 [Fix]: 리다이렉트 후에는 플래그 즉시 초기화
                            isLoggingOut = false;
                            logoutPromise = null;
                            return false;
                        }
                    }
                }

                return res.ok;
            } catch (error) {
                console.error("[authClient] 로그아웃 실패:", error);

                // 🟢 [배포용 최종 Fix]: 에러 발생 시에도 안전을 위해 메인으로 강제 이동
                if (typeof window !== "undefined") {
                    // 스토리지 완전 초기화
                    try {
                        localStorage.clear();
                        sessionStorage.clear();
                    } catch (e) {
                        console.warn("[authClient] 스토리지 초기화 중 오류:", e);
                    }

                    window.dispatchEvent(new CustomEvent("authLogout"));

                    // 🟢 [배포용 최종 Fix]: 단순 이동 대신 replace("/")로 히스토리와 캐시를 날림
                    const isApp = isMobileApp();
                    const forceRedirect = () => {
                        if (isApp && (window as any).ReactNativeWebView) {
                            // 🟢 [Fix]: 앱에서는 replace 대신 초기 페이지로 이동 유도만 하고
                            // 실제 네비게이션은 Native bridge 메시지로 처리하는 것이 가장 안전함
                            console.log(
                                "[authClient] App environment detected. Skipping window.location.replace to prevent IP exposure."
                            );
                        } else {
                            // 🟢 중요: window.location.replace("/")로 히스토리와 캐시를 완전히 날림
                            window.location.replace("/");
                        }
                    };

                    if (isApp && (window as any).ReactNativeWebView) {
                        // 🟢 [App] 에러 발생 시에도 전역 상태 초기화 지시
                        try {
                            (window as any).ReactNativeWebView.postMessage(
                                JSON.stringify({
                                    type: "logout",
                                    success: false,
                                    // 🟢 [배포용 최종 Fix]: 타임스탬프 제거, 깔끔한 리다이렉트
                                    redirect: "/",
                                    // 🟢 [App] 전역 상태 초기화 지시
                                    clearState: true,
                                    navigateTo: "Login",
                                })
                            );
                        } catch (e) {
                            console.warn("[authClient] WebView 메시지 전송 실패:", e);
                        }
                        // 🟢 [Fix]: 앱 환경에서는 window.location.replace 호출하지 않음
                        // Native bridge 메시지로 네비게이션 처리하도록 함
                        setTimeout(() => {
                            isLoggingOut = false;
                            logoutPromise = null;
                        }, 500);
                    } else {
                        forceRedirect();
                        // 🟢 [Fix]: 리다이렉트 후에는 플래그 즉시 초기화
                        isLoggingOut = false;
                        logoutPromise = null;
                    }
                }
                return false;
            } finally {
                // 🟢 [Fix]: 에러 발생 시에도 플래그 초기화 (리다이렉트가 실행되지 않은 경우를 대비)
                // 리다이렉트가 실행된 경우는 이미 위에서 초기화했으므로 여기서는 안전장치 역할
                if (isLoggingOut) {
                    setTimeout(() => {
                        isLoggingOut = false;
                        logoutPromise = null;
                    }, 1000);
                }
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
