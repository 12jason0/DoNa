import React, { useCallback, useRef, useState, useEffect, useContext } from "react";
import { BackHandler, Platform, StyleSheet, View, ActivityIndicator, Linking, StatusBar } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { WebView, WebViewNavigation } from "react-native-webview";
import * as WebBrowser from "expo-web-browser";
import * as AppleAuthentication from "expo-apple-authentication";
import AsyncStorage from "@react-native-async-storage/async-storage";
// 🟢 [IN-APP PURCHASE]: RevenueCat SDK
import Purchases from "react-native-purchases";
// 🟢 [2025-12-28] 안드로이드 키 해시 확인용
import * as Application from "expo-application";

import { loadAuthToken, saveAuthToken } from "../storage";
import { PushTokenContext } from "../context/PushTokenContext";

type Props = {
    uri: string;
    onUserLogin?: (userId: string) => void;
    onUserLogout?: () => void;
};

export default function WebScreen({ uri: initialUri, onUserLogin, onUserLogout }: Props) {
    // 🟢 [2026-01-21] 딥링크 처리: 앱이 딥링크로 열릴 때 URL 처리
    const [deepLinkUrl, setDeepLinkUrl] = useState<string | null>(null);

    // 🟢 [2026-01-21] 딥링크 URL 파싱 함수
    const parseDeepLinkUrl = (url: string): string | null => {
        try {
            if (url.includes("dona.io.kr")) {
                const urlObj = new URL(url);
                const path = urlObj.pathname;
                // /courses/:id 형식인 경우 해당 경로로 설정
                if (path.startsWith("/courses/")) {
                    return path;
                } else if (urlObj.searchParams.has("courseId")) {
                    // 쿼리 파라미터로 courseId가 전달된 경우
                    const courseId = urlObj.searchParams.get("courseId");
                    return `/courses/${courseId}`;
                }
            }
        } catch (error) {
            console.error("[WebScreen] 딥링크 URL 파싱 실패:", error);
        }
        return null;
    };

    // 🟢 [2026-01-21] 앱 시작 시 딥링크 URL 확인
    useEffect(() => {
        const checkDeepLink = async () => {
            try {
                const initialUrl = await Linking.getInitialURL();
                if (initialUrl) {
                    console.log("[WebScreen] 딥링크 URL 감지:", initialUrl);
                    const parsedPath = parseDeepLinkUrl(initialUrl);
                    if (parsedPath) {
                        setDeepLinkUrl(parsedPath);
                    }
                }
            } catch (error) {
                console.error("[WebScreen] 딥링크 확인 실패:", error);
            }
        };
        checkDeepLink();
    }, []);

    // 🟢 [2026-01-21] 앱 실행 중 딥링크 수신 처리
    useEffect(() => {
        const subscription = Linking.addEventListener("url", (event) => {
            const { url } = event;
            console.log("[WebScreen] 앱 실행 중 딥링크 수신:", url);
            const parsedPath = parseDeepLinkUrl(url);
            if (parsedPath) {
                setDeepLinkUrl(parsedPath);
                // WebView를 해당 경로로 이동 (source prop이 변경되면 자동으로 로드됨)
                const targetUrl = parsedPath.startsWith("http") ? parsedPath : `https://dona.io.kr${parsedPath}`;
                if (webRef.current) {
                    // React Native WebView에서는 source prop 변경 시 자동으로 새 URL 로드
                    // 또는 injectJavaScript로 location 변경
                    webRef.current.injectJavaScript(`window.location.href = "${targetUrl}";`);
                }
            }
        });

        return () => {
            subscription.remove();
        };
    }, []);

    // 🟢 [2026-01-21] 딥링크 URL이 있으면 우선 사용, 없으면 기본값 사용
    const resolvedUri = deepLinkUrl
        ? deepLinkUrl.startsWith("http")
            ? deepLinkUrl
            : `https://dona.io.kr${deepLinkUrl}`
        : initialUri || "http://192.168.124.102:3000";

    // 🟢 [디버깅]: uri 전달 확인
    useEffect(() => {
        if (deepLinkUrl) {
            console.log("[WebScreen] 딥링크로 초기 URL 설정:", resolvedUri);
        } else if (!initialUri) {
            console.warn("[WebScreen] uri prop이 undefined입니다. 기본값을 사용합니다:", resolvedUri);
        } else {
            console.log("[WebScreen] uri prop 전달 확인:", initialUri);
        }
    }, [initialUri, resolvedUri, deepLinkUrl]);

    const webRef = useRef<WebView>(null);
    const [loading, setLoading] = useState(true);
    const [canGoBack, setCanGoBack] = useState(false);
    const [currentUrl, setCurrentUrl] = useState(resolvedUri);
    const insets = useSafeAreaInsets();
    const pushToken = useContext(PushTokenContext);
    const [initialScript, setInitialScript] = useState<string | null>(null);
    const [isSplashDone, setIsSplashDone] = useState(false);
    // 🔴 [Fix]: 로그아웃 처리 중 플래그 - 무한 로그인 루프 방지
    const isProcessingLogoutRef = useRef(false);

    // 🟢 [설정]: 스플래시 배경색 (app.json의 배경색과 일치시켜주세요)
    const SPLASH_COLOR = "#6db48c";

    useEffect(() => {
        // 🟢 [설정]: 스플래시 표시 시간 6초
        const timer = setTimeout(() => setIsSplashDone(true), 6500);
        return () => clearTimeout(timer);
    }, []);

    // 🟢 [수정]: 스플래시 중에는 상태바 영역까지 스플래시 색상으로 채우기 위해 paddingTop을 0으로 설정
    const dynamicPaddingTop = !isSplashDone ? 0 : insets.top;

    // 🟢 [추가]: 안드로이드 내비게이션 바 및 iOS 하단 바 영역 확보
    const dynamicPaddingBottom = insets.bottom * 0.8;

    const openExternalBrowser = async (url: string) => {
        if (!url.startsWith("http")) {
            try {
                await Linking.openURL(url);
            } catch (e) {
                if (url.includes("kakao")) {
                    Linking.openURL("https://apps.apple.com/kr/app/id362033756");
                }
            }
            return;
        }
        await WebBrowser.openBrowserAsync(url, { readerMode: false, toolbarColor: "#6db48c" });
    };

    const handleAndroidBack = useCallback(() => {
        if (canGoBack && webRef.current) {
            webRef.current.goBack();
            return true;
        }
        return false;
    }, [canGoBack]);

    useEffect(() => {
        if (Platform.OS === "android") {
            const sub = BackHandler.addEventListener("hardwareBackPress", handleAndroidBack);
            return () => sub.remove();
        }
    }, [handleAndroidBack]);

    useEffect(() => {
        (async () => {
            const lines: string[] = [];
            lines.push("(function(){");
            // Native Bridge 설정
            lines.push(
                `if (!window.ReactNativeWebView) { window.ReactNativeWebView = { postMessage: function(msg) { window.__nativeBridge?.post('webview', JSON.parse(msg || '{}')); } }; }`
            );
            lines.push(
                `window.__nativeBridge = { post: function(t,p){ window.ReactNativeWebView.postMessage(JSON.stringify({type:t, payload:p})); } };`
            );

            // 🟢 푸시 토큰은 유지하되, 보안 취약점인 'authToken' localStorage 주입은 삭제했습니다.
            if (pushToken) lines.push(`try{ localStorage.setItem('expoPushToken', '${pushToken}'); }catch(e){}`);

            // SafeArea 업데이트 로직
            lines.push(
                `(function applySafeArea(){ function update(){ try { document.documentElement.style.paddingTop = "0px"; document.body.style.paddingTop = "0px"; } catch(e){} } update(); setInterval(update, 2000); })();`
            );
            // 🔴 [Fix 1]: 세션 복구 로직 강화 - 쿠키가 없으면 아예 서버 요청 차단
            lines.push(`
                (async function restoreSession() {
                    try {
                        const hasAuth = document.cookie.includes('authorization') || document.cookie.includes('auth');
                        if (!hasAuth) {
                            console.log('[세션 복구] 인증 쿠키 없음 - 중단');
                            return;
                        }

                        const sessionRes = await fetch('/api/auth/session', { method: 'GET', credentials: 'include' });
                        const sessionData = await sessionRes.json();
                        
                        // 앱 시작 시 혹은 새로고침 시에만 동작
                        if (sessionData.authenticated && sessionData.user?.id) {
                            if (window.ReactNativeWebView) {
                                window.ReactNativeWebView.postMessage(JSON.stringify({
                                    type: 'login',
                                    userId: sessionData.user.id,
                                    fromRestore: true
                                }));
                            }
                        }
                    } catch (e) { console.warn('[세션 복구] 실패:', e); }
                })();
            `);
            lines.push("})();");
            setInitialScript(lines.join("\n"));
        })();
    }, [pushToken]);

    // 🟢 [추가]: 스플래시와 상태바가 동시에 전환되도록 배경색 변수 통일
    const statusBarBackgroundColor = !isSplashDone ? SPLASH_COLOR : "#ffffff";
    const containerBackgroundColor = !isSplashDone ? SPLASH_COLOR : "#ffffff";

    return (
        // 🟢 [수정]: 상단(paddingTop)뿐만 아니라 하단(paddingBottom) 여백도 시스템 영역만큼 확보
        <View
            style={[
                styles.container,
                {
                    paddingTop: dynamicPaddingTop,
                    paddingBottom: dynamicPaddingBottom, // 👈 안드로이드 뒤로가기/홈 버튼 영역 위로 푸터를 올림
                    backgroundColor: containerBackgroundColor, // 🟢 스플래시 종료 시 컨테이너와 상태바가 동시에 흰색으로 전환
                },
            ]}
        >
            {/* 🟢 [핵심 수정]: 상태바 배경색을 스플래시 색상과 동기화 - 스플래시 종료 시 동시에 흰색으로 전환 */}
            <StatusBar
                // 배경이 밝으면 dark-content(검정글자), 어두우면 light-content(흰글자)
                barStyle="dark-content"
                // 스플래시 중에는 상태바 영역까지 스플래시 색상으로 채우기 위해 translucent를 false로 설정
                translucent={!isSplashDone ? false : true}
                // 🟢 스플래시 종료 시 컨테이너와 동시에 흰색으로 전환
                backgroundColor={statusBarBackgroundColor}
                hidden={false} // 👈 상태바를 항상 표시
            />

            <View style={{ flex: 1 }}>
                <WebView
                    ref={webRef}
                    key={deepLinkUrl || "default"} // 🟢 [2026-01-21] 딥링크 URL 변경 시 WebView 재마운트
                    style={{ flex: 1 }}
                    source={{ uri: resolvedUri }} // 🟢 [수정]: resolvedUri 사용 (딥링크 우선)
                    // 🟢 [추가]: 화이트리스트 설정을 통해 모든 요청 가로채기 활성화
                    originWhitelist={["*"]}
                    // 🟢 핵심 설정: 보안 및 기능 최적화
                    sharedCookiesEnabled={true} // 서버 사이드 보안 쿠키 동기화 활성화
                    thirdPartyCookiesEnabled={true} // 인증 도메인 간 쿠키 전달 허용
                    geolocationEnabled={true} // 네이버 지도 위치 정확도 및 거리 계산 오류 해결
                    domStorageEnabled={true} // 웹 리소스 저장을 위한 필수 설정
                    cacheEnabled={true} // 2030 세대가 선호하는 빠른 로딩 속도 확보
                    cacheMode="LOAD_DEFAULT" // 🟢 캐시 설정을 기본으로 하여 안정성 확보
                    allowsInlineMediaPlayback={true}
                    mediaPlaybackRequiresUserAction={false}
                    allowsBackForwardNavigationGestures={true}
                    onNavigationStateChange={(nav: WebViewNavigation) => {
                        setCanGoBack(nav.canGoBack);
                        setCurrentUrl(nav.url);
                        if (!nav.loading) {
                            setLoading(false);
                        }
                    }}
                    onShouldStartLoadWithRequest={(request) => {
                        const { url } = request;

                        // 🟢 [2026-01-21] 네이티브 앱 실행 스킴 처리: intent:// 및 카카오 스킴 가로채기
                        // 안드로이드 WebView에서 intent:// 스킴을 처리하지 못해 발생하는 JSApplicationIllegalArgumentException 에러 방지
                        if (
                            url.startsWith("kakaokompassauth://") ||
                            url.startsWith("kakaolink://") ||
                            url.startsWith("kakaotalk://") ||
                            url.startsWith("intent://") ||
                            url.includes("kakaonavi://") ||
                            url.startsWith("duna://")
                        ) {
                            // 🟢 [2026-01-21] intent:// 스킴은 안드로이드에서 우선적으로 처리
                            if (url.startsWith("intent://") && Platform.OS === "android") {
                                try {
                                    // intent:// URL에서 kakaolink 스키마 추출 시도
                                    const intentMatch = url.match(/intent:\/\/send([^#]*)/);
                                    if (intentMatch && intentMatch[1]) {
                                        const kakaoSchema = "kakaolink://send" + intentMatch[1];
                                        console.log("[App] 🔄 intent:// → kakaolink:// 변환:", kakaoSchema);
                                        // kakaolink://로 직접 시도 (에러 로그 최소화)
                                        Linking.openURL(kakaoSchema).catch(() => {
                                            // 조용히 실패 처리 (에러 로그 없음)
                                        });
                                        return false; // 웹뷰 내부 이동 차단
                                    }
                                } catch (parseError) {
                                    // 파싱 실패 시 조용히 처리 (에러 로그 없음)
                                }
                            }

                            // 🟢 일반적인 카카오 스킴 처리
                            console.log("[App] 📲 네이티브 앱 실행 시도:", url);

                            Linking.openURL(url).catch((err) => {
                                // 🟢 [2026-01-21] JSApplicationIllegalArgumentException 에러는 조용히 처리
                                // 안드로이드 WebView에서 intent://를 처리하지 못할 때 발생하는 정상적인 상황
                                if (err?.message?.includes("JSApplicationIllegalArgumentException")) {
                                    // 조용히 처리 (에러 로그 없음)
                                    return;
                                }

                                // 🔴 intent:// 형식이 실패했을 때, kakaolink 스키마로 재시도
                                if (url.startsWith("intent://")) {
                                    try {
                                        const intentMatch = url.match(/intent:\/\/send([^#]*)/);
                                        if (intentMatch && intentMatch[1]) {
                                            const kakaoSchema = "kakaolink://send" + intentMatch[1];
                                            console.log("[App] 🔄 kakaolink 스키마로 재시도:", kakaoSchema);
                                            Linking.openURL(kakaoSchema).catch(() => {
                                                // 둘 다 실패 시 스토어 이동
                                                const storeUrl =
                                                    Platform.OS === "ios"
                                                        ? "https://apps.apple.com/kr/app/id362033756"
                                                        : "https://play.google.com/store/apps/details?id=com.kakao.talk";
                                                Linking.openURL(storeUrl).catch(() => {});
                                            });
                                            return;
                                        }
                                    } catch (parseError) {
                                        // 파싱 실패 시 조용히 처리
                                    }
                                }

                                // 일반적인 실패 시 스토어 이동
                                const storeUrl =
                                    Platform.OS === "ios"
                                        ? "https://apps.apple.com/kr/app/id362033756"
                                        : "https://play.google.com/store/apps/details?id=com.kakao.talk";
                                Linking.openURL(storeUrl).catch(() => {});
                            });
                            return false; // 웹뷰 내부 이동 차단
                        }

                        // 2. [카카오 웹 공유창]: 🔴 절대 Linking.openURL을 쓰지 말고 웹뷰 내부에서 열리게 허용(true)
                        if (url.includes("sharer.kakao.com")) {
                            console.log("[App] 🌏 카카오 웹 공유창 내부 로드");
                            return true; // 🟢 외부로 나가지 않고 웹뷰 안에서 창을 띄움
                        }

                        if (url.includes("#webTalkLogin")) {
                            const cleanUrl = url.split("#")[0];
                            setTimeout(() => {
                                webRef.current?.injectJavaScript(`window.location.href = "${cleanUrl}";`);
                            }, 50);
                            return false;
                        }

                        // 🟢 CloudFront 이미지 도메인 허용 (웹의 CloudFront 마이그레이션 지원)
                        const isCloudFront =
                            url.includes("d13xx6k6chk2in.cloudfront.net") || url.includes("cloudfront.net");

                        // 🟢 [Fix]: 로컬 개발 IP 주소도 내부 주소로 인정하여 외부 브라우저로 열리지 않도록 방지
                        const isLocalDev =
                            url.includes("192.168.") || url.includes("localhost") || url.includes("127.0.0.1");

                        const isInternal =
                            url.includes("dona.io.kr") ||
                            url.includes("auth.kakao.com") ||
                            url.includes("kauth.kakao.com") ||
                            url.includes("accounts.kakao.com") ||
                            isCloudFront || // CloudFront 이미지 허용
                            isLocalDev; // 🟢 [핵심 추가]: 개발용 로컬 IP도 내부 주소로 인정

                        if (isInternal) return true;

                        openExternalBrowser(url);
                        return false;
                    }}
                    onError={(syntheticEvent) => {
                        const { nativeEvent } = syntheticEvent;
                        if (nativeEvent.code === -1002) return;
                    }}
                    // 🟢 [2025-12-28] UserAgent에서 'KAKAOTALK' 제거 (카카오 공유 충돌 방지)
                    // 🟢 [VERSION CONTROL]: 심사용 빌드 식별자를 추가하여 웹에서 버전 분기 처리 가능하도록 함
                    userAgent={
                        Platform.OS === "android"
                            ? "Mozilla/5.0 (Linux; Android 13; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36; DoNa_App_Android"
                            : "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1; DoNa_App_iOS"
                    }
                    injectedJavaScriptBeforeContentLoaded={initialScript || ""}
                    onMessage={async (ev) => {
                        try {
                            const data = JSON.parse(ev.nativeEvent.data || "{}");
                            if (data.type === "setAuthToken") {
                                await saveAuthToken(String(data.payload || ""));
                            }
                            // 🔴 [Fix 2]: 로그인 신호 수신부 - 어떤 로그인 신호도 Cooldown 중엔 차단
                            if ((data.type === "login" || data.type === "loginSuccess") && data.userId) {
                                if (isProcessingLogoutRef.current) {
                                    console.log(
                                        "[App] 🔴 로그아웃 보호 기간 중 자동 로그인 차단 (유저 ID:",
                                        data.userId,
                                        ")"
                                    );
                                    return;
                                }
                                await AsyncStorage.setItem("userId", String(data.userId));
                                onUserLogin?.(String(data.userId));
                                console.log("[App] 로그인 정보 동기화 완료:", data.userId);
                            }
                            // 🔴 [Fix 3]: 로그아웃 신호 처리 - 모든 세션 박멸
                            else if (data.type === "logout") {
                                console.log("[App] 🔴 로그아웃 프로세스 강제 시작 - 모든 세션 박멸");
                                isProcessingLogoutRef.current = true; // 7초간 로그인 신호 차단

                                // 네이티브 저장소(AsyncStorage) 무조건 삭제
                                const forceNativeClear = async () => {
                                    try {
                                        await saveAuthToken(null);
                                        await AsyncStorage.removeItem("userId");
                                        if (onUserLogout) onUserLogout();
                                    } catch (e) {
                                        console.log("[App] Native clear skipped");
                                    }
                                };
                                forceNativeClear();

                                // 🔴 [핵심]: 웹뷰 내부에서 서버 API 직접 호출 및 쿠키/스토리지 파괴
                                const nuclearClearScript = `
                                    (async function() {
                                        try {
                                            // 서버 세션 쿠키 파괴 (API 호출 필수)
                                            await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
                                            
                                            // 로컬 데이터 박멸
                                            localStorage.clear();
                                            sessionStorage.clear();
                                            
                                            // 클라이언트측 쿠키 강제 만료
                                            const host = window.location.hostname;
                                            ["", host, "." + host, ".dona.io.kr"].forEach(d => {
                                                document.cookie.split(";").forEach(c => {
                                                    const name = c.split("=")[0].trim();
                                                    if (name) {
                                                        document.cookie = name + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=" + d;
                                                        document.cookie = name + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/";
                                                    }
                                                });
                                            });

                                            console.log("[WebView] 모든 세션 파괴 완료");
                                            // 미들웨어 리다이렉트를 피하기 위해 파라미터와 함께 이동
                                            window.location.replace("/?logout=true");
                                        } catch (e) {
                                            window.location.replace("/");
                                        }
                                    })();
                                `;
                                webRef.current?.injectJavaScript(nuclearClearScript);

                                // 3. 루프 방지 Cooldown (7초)
                                setTimeout(() => {
                                    isProcessingLogoutRef.current = false;
                                    console.log("[App] 로그아웃 보호 종료 - 이제 정상 로그인 가능");
                                }, 7000);
                            }
                            // 🟢 [카카오 공유]: 웹에서 보낸 카카오 공유 신호 처리
                            else if (data.type === "kakaoShare" && data.webShareUrl) {
                                try {
                                    // 웹 공유 링크(Web Sharer) 열기
                                    await Linking.openURL(data.webShareUrl);
                                } catch (error) {
                                    console.error("카카오 공유 링크 열기 실패:", error);
                                    // Fallback: 카카오톡 앱 설치 페이지로 이동
                                    if (Platform.OS === "ios") {
                                        Linking.openURL("https://apps.apple.com/kr/app/id362033756").catch(() => {});
                                    } else {
                                        Linking.openURL(
                                            "https://play.google.com/store/apps/details?id=com.kakao.talk"
                                        ).catch(() => {});
                                    }
                                }
                            }
                            // 🟢 [PHYSICAL PRODUCT]: 두나샵을 외부 브라우저로 열기 (실물 상품 결제용)
                            else if (data.type === "openExternalBrowser") {
                                const { url } = data;
                                if (url) {
                                    openExternalBrowser(url);
                                }
                            }
                            // 🟢 [IN-APP PURCHASE]: RevenueCat 인앱결제 요청 처리
                            else if (data.type === "requestInAppPurchase") {
                                const { planId, planType } = data;
                                try {
                                    // 🟢 [IN-APP PURCHASE]: RevenueCat SDK로 결제 진행
                                    const offerings = await Purchases.getOfferings();

                                    if (!offerings.current) {
                                        throw new Error("상품 목록을 불러올 수 없습니다.");
                                    }

                                    // 🟢 상품 ID 매핑: planId를 RevenueCat Package identifier로 변환
                                    // RevenueCat에서는 Package identifier가 다를 수 있으므로 확인 필요
                                    // 예: planId가 "sub_basic"이면 Package identifier도 "sub_basic"이거나 다를 수 있음
                                    const packageToPurchase = offerings.current.availablePackages.find(
                                        (pkg: any) => pkg.identifier === planId
                                    );

                                    if (!packageToPurchase) {
                                        // 상품을 찾을 수 없는 경우, 첫 번째 패키지를 사용 (임시)
                                        // TODO: RevenueCat 대시보드에서 정확한 identifier 설정 필요
                                        console.warn(
                                            `[IN-APP PURCHASE] 상품 ${planId}을 찾을 수 없습니다. 첫 번째 패키지를 사용합니다.`
                                        );
                                        if (offerings.current.availablePackages.length === 0) {
                                            throw new Error("구매 가능한 상품이 없습니다.");
                                        }
                                        const firstPackage = offerings.current.availablePackages[0];
                                        const { customerInfo } = await Purchases.purchasePackage(firstPackage);

                                        // 성공 처리
                                        webRef.current?.injectJavaScript(`
                                            window.dispatchEvent(new CustomEvent('purchaseResult', {
                                                detail: {
                                                    success: true,
                                                    planId: '${planId}',
                                                    customerInfo: ${JSON.stringify(customerInfo)}
                                                }
                                            }));
                                        `);
                                        return;
                                    }

                                    // 🟢 결제 진행
                                    const { customerInfo } = await Purchases.purchasePackage(packageToPurchase);

                                    // 🟢 결제 성공: WebView로 결과 전달
                                    webRef.current?.injectJavaScript(`
                                        window.dispatchEvent(new CustomEvent('purchaseResult', {
                                            detail: {
                                                success: true,
                                                planId: '${planId}',
                                                planType: '${planType}'
                                            }
                                        }));
                                    `);

                                    console.log("[IN-APP PURCHASE] 결제 성공:", { planId, planType });
                                } catch (error: any) {
                                    console.error("[IN-APP PURCHASE] 결제 오류:", error);

                                    // 🟢 사용자가 결제를 취소한 경우
                                    if (error.userCancelled) {
                                        webRef.current?.injectJavaScript(`
                                            window.dispatchEvent(new CustomEvent('purchaseResult', {
                                                detail: {
                                                    success: false,
                                                    error: '결제가 취소되었습니다.',
                                                    planId: '${planId}'
                                                }
                                            }));
                                        `);
                                        return;
                                    }

                                    // 🟢 기타 오류
                                    const errorMessage = error?.message || "결제 처리 중 오류가 발생했습니다.";
                                    webRef.current?.injectJavaScript(`
                                        window.dispatchEvent(new CustomEvent('purchaseResult', {
                                            detail: {
                                                success: false,
                                                error: ${JSON.stringify(errorMessage)},
                                                planId: '${planId}'
                                            }
                                        }));
                                    `);
                                }
                            } else if (data.type === "appleLogin" && data.action === "start") {
                                if (Platform.OS === "ios") {
                                    try {
                                        const credential = await AppleAuthentication.signInAsync({
                                            requestedScopes: [
                                                AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
                                                AppleAuthentication.AppleAuthenticationScope.EMAIL,
                                            ],
                                        });

                                        // 🟢 서버에 Apple 로그인 요청 전송 (쿠키 설정을 위해)
                                        // WebView에서 fetch 요청 시 쿠키가 제대로 전달되지 않을 수 있으므로
                                        // WebView 내부에서 직접 API를 호출하도록 JavaScript를 주입
                                        webRef.current?.injectJavaScript(`
                                            (async function() {
                                                try {
                                                    const response = await fetch('/api/auth/apple', {
                                                        method: 'POST',
                                                        headers: { 'Content-Type': 'application/json' },
                                                        credentials: 'include',
                                                        body: JSON.stringify({
                                                            identityToken: ${JSON.stringify(credential.identityToken)},
                                                            authorizationCode: ${JSON.stringify(
                                                                credential.authorizationCode
                                                            )},
                                                            fullName: ${JSON.stringify(credential.fullName)},
                                                            email: ${JSON.stringify(credential.email)}
                                                        })
                                                    });
                                                    
                                                    if (response.ok) {
                                                        // 🟢 쿠키 기반 인증: localStorage 제거
                                                        localStorage.removeItem('authToken');
                                                        localStorage.removeItem('user');
                                                        localStorage.removeItem('loginTime');
                                                        
                                                        // 🟢 로그인 성공 이벤트 발생
                                                        window.dispatchEvent(new CustomEvent('authLoginSuccess'));
                                                        
                                                        window.dispatchEvent(new CustomEvent('appleLoginSuccess', {
                                                            detail: ${JSON.stringify(credential)}
                                                        }));
                                                        
                                                        // 🟢 [Fix]: Apple 로그인 성공 후 세션 API 호출하여 userId 가져오기
                                                        try {
                                                            const sessionRes = await fetch('/api/auth/session', {
                                                                method: 'GET',
                                                                credentials: 'include'
                                                            });
                                                            const sessionData = await sessionRes.json();
                                                            if (sessionData.authenticated && sessionData.user?.id) {
                                                                // 🟢 앱에 userId 전달
                                                                if (window.ReactNativeWebView) {
                                                                    window.ReactNativeWebView.postMessage(JSON.stringify({
                                                                        type: 'login',
                                                                        userId: sessionData.user.id
                                                                    }));
                                                                }
                                                            }
                                                        } catch (e) {
                                                            console.warn('세션 정보 가져오기 실패:', e);
                                                        }
                                                        
                                                        // 🟢 [Fix]: 쿠키가 브라우저에 저장될 시간을 충분히 주고 메인 페이지로 이동
                                                        // reload() 대신 replace()를 사용하여 로그인 페이지로 돌아가지 않도록 함
                                                        setTimeout(() => {
                                                            window.location.replace('/');
                                                        }, 500);
                                                    } else {
                                                        window.dispatchEvent(new CustomEvent('appleLoginError', {
                                                            detail: { message: 'Apple 로그인 처리에 실패했습니다.' }
                                                        }));
                                                    }
                                                } catch (error) {
                                                    console.error('Apple 로그인 오류:', error);
                                                    window.dispatchEvent(new CustomEvent('appleLoginError', {
                                                        detail: { message: 'Apple 로그인 중 오류가 발생했습니다.' }
                                                    }));
                                                }
                                            })();
                                        `);
                                    } catch (error) {
                                        console.error("Apple 로그인 오류:", error);
                                        webRef.current?.injectJavaScript(`
                                            window.dispatchEvent(new CustomEvent('appleLoginError', {
                                                detail: { message: 'Apple 로그인 중 오류가 발생했습니다.' }
                                            }));
                                        `);
                                    }
                                }
                            }
                        } catch (e) {
                            console.error("WebView message error:", e);
                        }
                    }}
                    // 🟢 성능 최적화: 하드웨어 가속
                    androidLayerType="hardware"
                />

                {loading && (
                    <View style={styles.loading} pointerEvents="none">
                        <ActivityIndicator size="small" color="#6db48c" />
                    </View>
                )}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#fff" },
    loading: {
        position: "absolute",
        top: 8,
        right: 8,
        backgroundColor: "rgba(255,255,255,0.85)",
        padding: 8,
        borderRadius: 10,
    },
});
