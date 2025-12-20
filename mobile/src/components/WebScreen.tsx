import React, { useCallback, useRef, useState, useEffect, useContext } from "react";
import { BackHandler, Platform, StyleSheet, View, ActivityIndicator, Linking, StatusBar } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";
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

    // 7초 후 스플래시 종료 처리
    useEffect(() => {
        const timer = setTimeout(() => setIsSplashDone(true), 7000);
        return () => clearTimeout(timer);
    }, []);

    const isSplashPage = currentUrl.replace(/\/$/, "") === "https://dona.io.kr";
    const dynamicPaddingTop = isSplashPage && !isSplashDone ? 0 : insets.top;

    // 외부 브라우저 및 앱 실행 처리
    const openExternalBrowser = async (url: string) => {
        if (!url.startsWith("http")) {
            try {
                if (Platform.OS === "android" && url.startsWith("intent://")) {
                    const parsedUrl = url.replace("intent://", "kakaokommunication://");
                    await Linking.openURL(parsedUrl);
                    return;
                }
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

    // 안드로이드 뒤로가기 버튼 처리
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

    // 초기 자바스크립트 주입 (토큰 전송 및 Bridge 설정)
    useEffect(() => {
        (async () => {
            const authToken = await loadAuthToken();
            const lines: string[] = [];
            lines.push("(function(){");
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
    }, [pushToken, currentUrl]);

    return (
        <View style={[styles.container, { paddingTop: dynamicPaddingTop }]}>
            <StatusBar barStyle={!isSplashDone ? "light-content" : "dark-content"} />

            <View style={{ flex: 1 }}>
                <WebView
                    ref={webRef}
                    style={{ flex: 1 }}
                    source={{ uri: initialUri }}
                    onNavigationStateChange={(nav) => {
                        setCanGoBack(nav.canGoBack);
                        setCurrentUrl(nav.url);
                        if (!nav.loading) setLoading(false);
                    }}
                    onShouldStartLoadWithRequest={(request) => {
                        const { url } = request;

                        // ⭐ 카카오 로그인 및 내부 서비스 도메인 허용
                        const isInternal =
                            url.includes("dona.io.kr") ||
                            url.includes("dona-two.vercel.app") ||
                            url.includes("localhost") ||
                            url.includes("auth.kakao.com") ||
                            url.includes("kauth.kakao.com") ||
                            url.includes("accounts.kakao.com"); // 계정 페이지 허용

                        if (isInternal) {
                            return true; // 내부 웹뷰에서 열기
                        }

                        // 카카오톡 앱 실행 주소(딥링크) 처리
                        if (
                            url.startsWith("kakaolink://") ||
                            url.startsWith("kakaokommunication://") ||
                            url.startsWith("intent://")
                        ) {
                            openExternalBrowser(url);
                            return false;
                        }

                        // 그 외 외부 주소는 시스템 브라우저로
                        openExternalBrowser(url);
                        return false;
                    }}
                    // ⭐ 팝업 차단 해제를 위한 핵심 설정
                    setSupportMultipleWindows={false} // 새 창을 만들지 않고 현재 창에서 로드
                    javaScriptCanOpenWindowsAutomatically={true} // 자바스크립트 팝업 허용
                    // ⭐ 보안 차단 회피를 위한 정교한 User-Agent
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
                            if (data.type === "setAuthToken") await saveAuthToken(String(data.payload || ""));
                            if (data.type === "loginSuccess") {
                                const userId = data.payload?.userId;
                                const token = data.payload?.token;
                                if (token) await saveAuthToken(String(token));
                                if (userId && pushToken) await registerPushToken(userId, pushToken);
                            }
                        } catch (e) {}
                    }}
                    originWhitelist={["*"]}
                    javaScriptEnabled={true}
                    domStorageEnabled={true}
                    allowsInlineMediaPlayback={true}
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
        paddingHorizontal: 8,
        paddingVertical: 6,
        borderRadius: 10,
    },
});
