import React, { useCallback, useRef, useState, useEffect, useContext } from "react";
import { BackHandler, Platform, StyleSheet, View, ActivityIndicator, Linking, StatusBar } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { WebView, WebViewNavigation } from "react-native-webview";
import * as WebBrowser from "expo-web-browser";
import * as AppleAuthentication from "expo-apple-authentication";

import { loadAuthToken, saveAuthToken } from "../storage";
import { PushTokenContext } from "../context/PushTokenContext";

type Props = { uri: string };

export default function WebScreen({ uri: initialUri }: Props) {
    const webRef = useRef<WebView>(null);
    const [loading, setLoading] = useState(true);
    const [canGoBack, setCanGoBack] = useState(false);
    const [currentUrl, setCurrentUrl] = useState(initialUri);
    const insets = useSafeAreaInsets();
    const pushToken = useContext(PushTokenContext);
    const [initialScript, setInitialScript] = useState<string | null>(null);
    const [isSplashDone, setIsSplashDone] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => setIsSplashDone(true), 7000);
        return () => clearTimeout(timer);
    }, []);

    const isSplashPage = currentUrl.replace(/\/$/, "") === "https://dona.io.kr";
    const dynamicPaddingTop = isSplashPage && !isSplashDone ? 0 : insets.top;

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
        <View style={[styles.container, { paddingTop: dynamicPaddingTop }]}>
            <StatusBar barStyle={!isSplashDone ? "light-content" : "dark-content"} />

            <View style={{ flex: 1 }}>
                <WebView
                    ref={webRef}
                    style={{ flex: 1 }}
                    source={{ uri: initialUri }}
                    // 🟢 핵심 설정: 보안 및 기능 최적화
                    sharedCookiesEnabled={true} // 서버 사이드 보안 쿠키 동기화 활성화
                    thirdPartyCookiesEnabled={true} // 인증 도메인 간 쿠키 전달 허용
                    geolocationEnabled={true} // 네이버 지도 위치 정확도 및 거리 계산 오류 해결
                    domStorageEnabled={true} // 웹 리소스 저장을 위한 필수 설정
                    cacheEnabled={true} // 2030 세대가 선호하는 빠른 로딩 속도 확보
                    cacheMode="LOAD_CACHE_ELSE_NETWORK" // CloudFront 이미지 캐싱 최적화
                    allowsInlineMediaPlayback={true}
                    mediaPlaybackRequiresUserAction={false}
                    allowsBackForwardNavigationGestures={true}
                    onNavigationStateChange={(nav: WebViewNavigation) => {
                        setCanGoBack(nav.canGoBack);
                        setCurrentUrl(nav.url);
                        if (!nav.loading) setLoading(false);
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
                    userAgent={
                        Platform.OS === "android"
                            ? "Mozilla/5.0 (Linux; Android 13; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36"
                            : "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
                    }
                    injectedJavaScriptBeforeContentLoaded={initialScript || ""}
                    onMessage={async (ev) => {
                        try {
                            const data = JSON.parse(ev.nativeEvent.data || "{}");
                            if (data.type === "setAuthToken") {
                                await saveAuthToken(String(data.payload || ""));
                            } else if (data.type === "appleLogin" && data.action === "start") {
                                if (Platform.OS === "ios") {
                                    const credential = await AppleAuthentication.signInAsync({
                                        requestedScopes: [
                                            AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
                                            AppleAuthentication.AppleAuthenticationScope.EMAIL,
                                        ],
                                    });
                                    webRef.current?.injectJavaScript(`
                                        window.dispatchEvent(new CustomEvent('appleLoginSuccess', {
                                            detail: ${JSON.stringify(credential)}
                                        }));
                                    `);
                                }
                            }
                        } catch (e) {
                            console.error("WebView message error:", e);
                        }
                    }}
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
