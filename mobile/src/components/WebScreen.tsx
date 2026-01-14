import React, { useCallback, useRef, useState, useEffect, useContext } from "react";
import { BackHandler, Platform, StyleSheet, View, ActivityIndicator, Linking, StatusBar } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { WebView, WebViewNavigation } from "react-native-webview";
import * as WebBrowser from "expo-web-browser";
import * as AppleAuthentication from "expo-apple-authentication";
import AsyncStorage from "@react-native-async-storage/async-storage";
// 🟢 [IN-APP PURCHASE]: RevenueCat SDK
import Purchases from "react-native-purchases";

import { loadAuthToken, saveAuthToken } from "../storage";
import { PushTokenContext } from "../context/PushTokenContext";

type Props = {
    uri: string;
    onUserLogin?: (userId: string) => void;
    onUserLogout?: () => void;
};

export default function WebScreen({ uri: initialUri, onUserLogin, onUserLogout }: Props) {
    // 🟢 [수정]: uri prop이 제대로 전달되었는지 확인 및 기본값 설정
    const resolvedUri = initialUri || "http://192.168.219.220:3000";

    // 🟢 [디버깅]: uri 전달 확인
    useEffect(() => {
        if (!initialUri) {
            console.warn("[WebScreen] uri prop이 undefined입니다. 기본값을 사용합니다:", resolvedUri);
        } else {
            console.log("[WebScreen] uri prop 전달 확인:", initialUri);
        }
    }, [initialUri, resolvedUri]);

    const webRef = useRef<WebView>(null);
    const [loading, setLoading] = useState(true);
    const [canGoBack, setCanGoBack] = useState(false);
    const [currentUrl, setCurrentUrl] = useState(resolvedUri);
    const insets = useSafeAreaInsets();
    const pushToken = useContext(PushTokenContext);
    const [initialScript, setInitialScript] = useState<string | null>(null);
    const [isSplashDone, setIsSplashDone] = useState(false);

    // 🟢 [설정]: 스플래시 배경색 (app.json의 배경색과 일치시켜주세요)
    const SPLASH_COLOR = "#6db48c";

    useEffect(() => {
        // 🟢 성능 최적화: 7초는 너무 깁니다. 2초로 단축하여 체감 속도 향상
        const timer = setTimeout(() => setIsSplashDone(true), 2000);
        return () => clearTimeout(timer);
    }, []);

    // 🟢 [수정]: 스플래시 중이든 아니든 항상 상단 안전 여백(insets.top)을 적용하여 덮지 않음
    const dynamicPaddingTop = insets.top;

    // 🟢 [추가]: 안드로이드 내비게이션 바 및 iOS 하단 바 영역 확보
    const dynamicPaddingBottom = insets.bottom;

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
        await WebBrowser.openBrowserAsync(url, { readerMode: false, toolbarColor: "#ffffff" });
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
            lines.push("})();");
            setInitialScript(lines.join("\n"));
        })();
    }, [pushToken]);

    return (
        // 🟢 [수정]: 상단(paddingTop)뿐만 아니라 하단(paddingBottom) 여백도 시스템 영역만큼 확보
        <View
            style={[
                styles.container,
                {
                    paddingTop: dynamicPaddingTop,
                    paddingBottom: dynamicPaddingBottom, // 👈 안드로이드 뒤로가기/홈 버튼 영역 위로 푸터를 올림
                    backgroundColor: !isSplashDone ? SPLASH_COLOR : "#ffffff",
                },
            ]}
        >
            {/* 🟢 [핵심 수정]: 상태바 배경색을 스플래시 색상과 동기화 */}
            <StatusBar
                // 배경이 밝으면 dark-content(검정글자), 어두우면 light-content(흰글자)
                barStyle="dark-content"
                translucent={true}
                // 스플래시 중에는 SPLASH_COLOR, 완료 후에는 흰색(#ffffff)
                backgroundColor={!isSplashDone ? SPLASH_COLOR : "#ffffff"}
                hidden={false} // 👈 상태바를 항상 표시
            />

            <View style={{ flex: 1 }}>
                <WebView
                    ref={webRef}
                    style={{ flex: 1 }}
                    source={{ uri: resolvedUri }} // 🟢 [수정]: resolvedUri 사용
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
                        // 앱 스킴 및 카카오톡 리다이렉트 처리
                        if (
                            url.startsWith("kakaokompassauth://") ||
                            url.startsWith("kakaolink://") ||
                            url.startsWith("kakaotalk://") ||
                            url.startsWith("duna://")
                        ) {
                            Linking.openURL(url).catch(() => {});
                            return false;
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

                        const isInternal =
                            url.includes("dona.io.kr") ||
                            url.includes("auth.kakao.com") ||
                            url.includes("kauth.kakao.com") ||
                            url.includes("accounts.kakao.com") ||
                            isCloudFront; // CloudFront 이미지 허용

                        if (isInternal) return true;

                        openExternalBrowser(url);
                        return false;
                    }}
                    onError={(syntheticEvent) => {
                        const { nativeEvent } = syntheticEvent;
                        if (nativeEvent.code === -1002) return;
                    }}
                    // 🟢 카카오 로그인을 위해 UserAgent 끝에 'KAKAOTALK' 명시
                    // 🟢 [VERSION CONTROL]: 심사용 빌드 식별자를 추가하여 웹에서 버전 분기 처리 가능하도록 함
                    userAgent={
                        Platform.OS === "android"
                            ? "Mozilla/5.0 (Linux; Android 13; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36; KAKAOTALK DoNa_App_v1.2.1_Review_Android"
                            : "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1; KAKAOTALK DoNa_App_v1.2.1_Review_iOS"
                    }
                    injectedJavaScriptBeforeContentLoaded={initialScript || ""}
                    onMessage={async (ev) => {
                        try {
                            const data = JSON.parse(ev.nativeEvent.data || "{}");
                            if (data.type === "setAuthToken") {
                                await saveAuthToken(String(data.payload || ""));
                            }
                            // 🟢 [추가]: 로그인 이벤트 처리 (RevenueCat 동기화용)
                            else if (data.type === "login" && data.userId) {
                                await AsyncStorage.setItem("userId", String(data.userId));
                                onUserLogin?.(String(data.userId));
                            }
                            // 🟢 [배포용 최종 Fix]: 웹에서 보낸 로그아웃 신호 처리
                            else if (data.type === "logout") {
                                // 1. 앱 내 Native 저장소(SecureStore/AsyncStorage) 비우기
                                await saveAuthToken(null);
                                await AsyncStorage.removeItem("userId");
                                onUserLogout?.();

                                // 2. 🟢 [핵심]: WebView 내부 세션 및 쿠키 강제 초기화 스크립트 주입
                                // document.cookie를 만료시키고, 로컬 저장소를 비웁니다.
                                const redirectUrl = data.redirect || "/";
                                const clearScript = `
                                    (function() {
                                        // 🟢 [도메인 일관성]: 모든 가능한 서브도메인에서 쿠키 삭제
                                        // 메인 도메인과 서브도메인(api, auth 등) 모두 처리
                                        const domains = [
                                            "", // 도메인 없이 (현재 도메인)
                                            ".dona.io.kr", // 모든 서브도메인 포함 (.으로 시작)
                                            "dona.io.kr", // 메인 도메인
                                            "api.dona.io.kr", // API 서브도메인
                                            "auth.dona.io.kr" // 인증 서브도메인
                                        ];
                                        
                                        // 모든 쿠키 삭제 (HttpOnly 쿠키는 서버에서 삭제되지만, 클라이언트 쿠키도 정리)
                                        document.cookie.split(";").forEach(function(c) {
                                            const cookieName = c.split("=")[0].trim();
                                            if (cookieName) {
                                                // 각 도메인별로 쿠키 삭제 시도
                                                domains.forEach(function(domain) {
                                                    const domainPart = domain ? ";domain=" + domain : "";
                                                    document.cookie = cookieName + "=;expires=" + new Date(0).toUTCString() + ";path=/" + domainPart;
                                                    // Secure 및 SameSite 옵션도 시도
                                                    document.cookie = cookieName + "=;expires=" + new Date(0).toUTCString() + ";path=/;Secure;SameSite=None" + domainPart;
                                                });
                                            }
                                        });
                                        
                                        // 로컬/세션 스토리지 완전 초기화
                                        try {
                                            localStorage.clear();
                                            sessionStorage.clear();
                                        } catch(e) {
                                            console.warn("스토리지 초기화 오류:", e);
                                        }
                                        
                                        // 🟢 [무한 루프 방지]: _logout 파라미터 대신 해시 사용
                                        // URL에 파라미터를 추가하지 않고, 리다이렉트만 수행하여 미들웨어와 충돌 방지
                                        // replace를 사용하여 히스토리도 정리하고, 캐시 버스팅은 서버 헤더로 처리
                                        window.location.replace("${redirectUrl}");
                                    })();
                                `;
                                webRef.current?.injectJavaScript(clearScript);

                                // 3. Android 캐시 잔류 방지 - reload로 확실히 세션 초기화
                                if (Platform.OS === "android") {
                                    setTimeout(() => {
                                        webRef.current?.reload();
                                    }, 300);
                                }

                                console.log("[App] 로그아웃 및 쿠키 삭제 프로세스 완료");
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
