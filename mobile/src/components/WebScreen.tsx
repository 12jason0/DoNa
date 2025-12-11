import React, { useCallback, useRef, useState, useEffect, useContext } from "react";
import { BackHandler, Platform, StyleSheet, View, ActivityIndicator, Linking } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";

import { loadAuthToken, saveAuthToken } from "../storage";
import { PushTokenContext } from "../context/PushTokenContext";
import { registerPushToken } from "../utils/registerPushToken";

type Props = { uri: string };

export default function WebScreen({ uri }: Props) {
    const webRef = useRef<WebView>(null);
    const [loading, setLoading] = useState(true);
    const [canGoBack, setCanGoBack] = useState(false);
    const pushToken = useContext(PushTokenContext);
    const [initialScript, setInitialScript] = useState<string | null>(null);

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

    // Build injected JS
    useEffect(() => {
        (async () => {
            const authToken = await loadAuthToken();
            const isIntroPage = uri.includes("/escape/intro");
            const isSplashPage = uri === "https://dona-two.vercel.app/" || uri === "https://dona-two.vercel.app";

            const lines: string[] = [];
            lines.push("(function(){");

            // 1) RN ↔ WebBridge
            lines.push(`
                window.__nativeBridge = {
                    post: function(type, payload){
                        try {
                            window.ReactNativeWebView.postMessage(
                                JSON.stringify({type:type, payload:payload})
                            );
                        } catch(e){}
                    }
                };
            `);

            // 2) inject tokens
            if (pushToken) {
                lines.push(`try{ localStorage.setItem('expoPushToken', '${pushToken}'); }catch(e){}`);
            }
            if (authToken) {
                lines.push(`try{ localStorage.setItem('authToken', '${authToken}'); }catch(e){}`);
            }

            // 3) Safe-area 처리 수정
            lines.push(`
 (function applySafeArea(){
        function update(){
            try {
                const path = window.location.pathname;
                const href = window.location.href;
                
                const isIntro = path.includes("/escape/intro");
                const isSplash = (href === "https://dona-two.vercel.app/" || 
                                  href === "https://dona-two.vercel.app" ||
                                  path === "/" && !document.querySelector('[class*="container"]'));

                // 🚩 HTML/BODY 높이를 뷰포트 높이로 설정하여 웹뷰 영역을 가득 채우게 함
                document.documentElement.style.height = '100%';
                document.body.style.minHeight = '100%';
                document.body.style.position = 'relative'; 

                if (isIntro || isSplash) {
                    // 풀스크린 (상/하단 모두 0)
                    document.documentElement.style.padding = "0px";
                    document.body.style.padding = "0px";
                    document.documentElement.style.marginTop = "0px";
                    document.body.style.marginTop = "0px";
                    
                    const old = document.getElementById("safe-area-style");
                    if (old) old.remove();
                    return;
                }

                // 🚩 일반 페이지: 상단 여백 제거 및 하단 확장 강제
                
                // 상단 여백 제거 (RN의 SafeAreaView가 이미 처리함)
                document.documentElement.style.setProperty('padding-top', '0px', 'important');
                document.body.style.setProperty('padding-top', '0px', 'important');
                document.documentElement.style.marginTop = "0px";
                document.body.style.marginTop = "0px";
                
                // 🚩 하단 여백을 0으로 강제하여 Safe Area까지 콘텐츠 확장
                // (기존의 !important 설정은 유지하되, 혹시 모를 충돌을 위해 paddingBottom만 확실히 보강)
                document.documentElement.style.setProperty('padding-bottom', '0px', 'important');
                document.body.style.setProperty('padding-bottom', '0px', 'important');
                
                // 🚩 웹 콘텐츠에 safe-area-inset-bottom이 적용된 경우도 무시하도록 max-height 설정
                // 이는 웹 콘텐츠 자체가 100vh로 제한될 경우를 대비
                document.body.style.setProperty('max-height', 'unset', 'important');

                const existing = document.getElementById("safe-area-style");
                if (existing) existing.remove();

            } catch(e){
                console.error('Safe area update error:', e);
            }
        }

                    // 초기 실행
                    update();

                    document.addEventListener("DOMContentLoaded", update);
                    window.addEventListener("load", update);

                    // hydration, SPA 전환 대응
                    setTimeout(update, 20);
                    setTimeout(update, 200);
                    setTimeout(update, 500);
                    
                    // 페이지 전환 감지
                    let lastPath = window.location.pathname;
                    setInterval(() => {
                        if (window.location.pathname !== lastPath) {
                            lastPath = window.location.pathname;
                            update();
                        }
                    }, 200);
                })();
            `);

            // 4) Escape footer 보정 (필요한 경우)
            if (uri.includes("/escape")) {
                lines.push(`
                    (function(){
                        function adjust(){
                            try{
                                const footer = document.querySelector('[class*="absolute"][class*="bottom"]');
                                if (footer && !window.location.pathname.includes("/escape/intro")) {
                                    footer.style.bottom = "calc(1rem + env(safe-area-inset-bottom, 0px))";
                                    footer.style.paddingBottom = "calc(0.5rem + env(safe-area-inset-bottom, 0px))";
                                }
                            }catch(e){}
                        }
                        document.addEventListener("DOMContentLoaded", adjust);
                        window.addEventListener("load", adjust);
                        setTimeout(adjust, 200);
                        setTimeout(adjust, 500);
                    })();
                `);
            }

            lines.push("})();");
            setInitialScript(lines.join("\n"));
        })();
    }, [pushToken, uri]);

    const isIntroPage = uri.includes("/escape/intro");
    const isSplashPage = uri === "https://dona-two.vercel.app/" || uri === "https://dona-two.vercel.app";
    const shouldUseFullScreen = isIntroPage || isSplashPage;

    return (
        <SafeAreaView
            style={{ flex: 1, backgroundColor: "#fff" }}
            edges={shouldUseFullScreen ? [] : ["top", "left", "right"]}
        >
            <View style={{ flex: 1 }}>
                {!!initialScript && (
                    <WebView
                        ref={webRef}
                        style={{ flex: 1 }}
                        source={{ uri }}
                        contentInset={{ top: 0, bottom: 0 }}
                        contentInsetAdjustmentBehavior="never"
                        onLoadStart={() => setLoading(true)}
                        onLoadEnd={() => setLoading(false)}
                        onNavigationStateChange={(nav) => setCanGoBack(nav.canGoBack)}
                        injectedJavaScriptBeforeContentLoaded={initialScript}
                        onMessage={async (ev) => {
                            try {
                                const data = JSON.parse(ev.nativeEvent.data || "{}");

                                if (data.type === "setAuthToken") {
                                    await saveAuthToken(String(data.payload || ""));
                                }

                                if (data.type === "loginSuccess") {
                                    const userId = data.payload?.userId;
                                    const token = data.payload?.token;
                                    if (token) await saveAuthToken(String(token));
                                    if (userId && pushToken) {
                                        await registerPushToken(userId, pushToken);
                                    }
                                }
                            } catch (e) {}
                        }}
                        onFileDownload={({ nativeEvent }) => {
                            Linking.openURL(nativeEvent.downloadUrl).catch(() => {});
                        }}
                        originWhitelist={["*"]}
                        javaScriptEnabled
                        domStorageEnabled
                        allowsInlineMediaPlayback
                        mediaPlaybackRequiresUserAction={false}
                    />
                )}

                {loading && (
                    <View style={styles.loading} pointerEvents="none">
                        <ActivityIndicator size="small" color="#6db48c" />
                    </View>
                )}
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
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
