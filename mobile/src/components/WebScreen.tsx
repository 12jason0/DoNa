import React, { useCallback, useRef, useState, useEffect, useContext } from "react";
import { BackHandler, Platform, StyleSheet, View, ActivityIndicator, Linking, StatusBar } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { WebView, WebViewNavigation } from "react-native-webview";
import * as WebBrowser from "expo-web-browser";

import { loadAuthToken, saveAuthToken } from "../storage";
import { PushTokenContext } from "../context/PushTokenContext";
import { registerPushToken } from "../utils/registerPushToken";

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
            const authToken = await loadAuthToken();
            const lines: string[] = [];
            lines.push("(function(){");
            // ReactNativeWebView 객체를 명시적으로 주입 (카카오 로그인 감지용)
            lines.push(
                `if (!window.ReactNativeWebView) { window.ReactNativeWebView = { postMessage: function(msg) { window.__nativeBridge?.post('webview', JSON.parse(msg || '{}')); } }; }`
            );
            lines.push(
                `window.__nativeBridge = { post: function(t,p){ window.ReactNativeWebView.postMessage(JSON.stringify({type:t, payload:p})); } };`
            );
            if (pushToken) lines.push(`try{ localStorage.setItem('expoPushToken', '${pushToken}'); }catch(e){}`);
            if (authToken) lines.push(`try{ localStorage.setItem('authToken', '${authToken}'); }catch(e){}`);
            lines.push(
                `(function applySafeArea(){ function update(){ try { document.documentElement.style.paddingTop = "0px"; document.body.style.paddingTop = "0px"; } catch(e){} } update(); setInterval(update, 500); })();`
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
                    onNavigationStateChange={(nav: WebViewNavigation) => {
                        setCanGoBack(nav.canGoBack);
                        setCurrentUrl(nav.url);
                        if (!nav.loading) setLoading(false);
                    }}
                    onShouldStartLoadWithRequest={(request) => {
                        const { url } = request;

                        // 1. 카카오톡 앱 인증 및 앱 자체 스킴(duna://) 처리 ⭐
                        if (
                            url.startsWith("kakaokompassauth://") ||
                            url.startsWith("kakaolink://") ||
                            url.startsWith("kakaotalk://") ||
                            url.startsWith("duna://") // 🟢 대표님의 앱 스킴을 추가하여 마지막 리다이렉트 에러 방지
                        ) {
                            // 앱 외부(시스템)에서 처리하도록 던짐
                            Linking.openURL(url).catch(() => {
                                // 카카오톡이 없을 경우 웹 로그인을 계속 진행하도록 true 반환
                            });
                            return false; // 🔴 웹뷰가 이 주소를 로드하려다 -1002 에러를 내는 것을 원천 봉쇄
                        }

                        // 2. 이미 성공하신 기존 #webTalkLogin 처리 로직 (그대로 유지)
                        if (url.includes("#webTalkLogin")) {
                            const cleanUrl = url.split("#")[0];
                            setTimeout(() => {
                                webRef.current?.injectJavaScript(`window.location.href = "${cleanUrl}";`);
                            }, 50);
                            return false;
                        }

                        // 3. 내부 도메인 허용 로직 (그대로 유지)
                        const isInternal =
                            url.includes("dona.io.kr") ||
                            url.includes("auth.kakao.com") ||
                            url.includes("kauth.kakao.com") ||
                            url.includes("accounts.kakao.com");

                        if (isInternal) return true;

                        // 그 외 외부 링크는 외부 브라우저로 열기
                        openExternalBrowser(url);
                        return false;
                    }}
                    // 🚩 -1002 에러가 나더라도 경고창을 띄우지 않도록 설정
                    onError={(syntheticEvent) => {
                        const { nativeEvent } = syntheticEvent;
                        if (nativeEvent.code === -1002) {
                            console.log("지원되지 않는 URL 무시됨:", nativeEvent.url);
                            return;
                        }
                    }}
                    setSupportMultipleWindows={false}
                    javaScriptCanOpenWindowsAutomatically={true}
                    userAgent={
                        Platform.OS === "android"
                            ? "Mozilla/5.0 (Linux; Android 13; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36"
                            : "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
                    }
                    contentInsetAdjustmentBehavior="never"
                    injectedJavaScriptBeforeContentLoaded={initialScript || ""}
                    onMessage={async (ev) => {
                        try {
                            const data = JSON.parse(ev.nativeEvent.data || "{}");
                            if (data.type === "setAuthToken") {
                                await saveAuthToken(String(data.payload || ""));
                            } else if (data.type === "loginSuccess") {
                                // 카카오 로그인 성공 시 토큰 저장
                                if (data.token) {
                                    await saveAuthToken(String(data.token || ""));
                                }
                            }
                        } catch (e) {
                            console.error("WebView message 처리 오류:", e);
                        }
                    }}
                    originWhitelist={["*"]}
                    javaScriptEnabled
                    domStorageEnabled
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
