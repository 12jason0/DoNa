import "react-native-gesture-handler";
import * as Sentry from "@sentry/react-native";
import { useEffect, useRef, useState } from "react";
import { Platform, AppState } from "react-native";
import { router, Stack } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { StatusBar } from "expo-status-bar";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StyleSheet } from "react-native";
import * as Notifications from "expo-notifications";
import Purchases, { LOG_LEVEL } from "react-native-purchases";
import * as SplashScreen from "expo-splash-screen";
import { useFonts } from "expo-font";
import { migrateFromAsyncStorage } from "../src/lib/mmkv";
import { KAKAO_NATIVE_APP_KEY } from "../src/config";
import { AppSettingsProvider } from "../src/context/AppSettingsContext";
import { initializeKakaoSDK } from "@react-native-kakao/core";
import RootStatusBar from "../src/components/RootStatusBar";
import DonaSplashAnimation from "../src/components/DonaSplashAnimation";
import SyncTextFontToLocale from "../src/components/SyncTextFontToLocale";
import { ModalProvider } from "../src/lib/modalContext";
import ModalManager from "../src/components/ModalManager";
import { loadLocalePreference } from "../src/lib/appSettingsStorage";
import { applyDefaultTextFontForLocale } from "../src/lib/textDefaultFont";

// ─── Sentry 초기화 ────────────────────────────────────────────────────────────
if (process.env.EXPO_PUBLIC_SENTRY_DSN) {
    Sentry.init({
        dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
        tracesSampleRate: 0.2,
        enabled: !__DEV__,
    });
}

// ─── 스플래시 화면 유지 (초기화 완료 전까지) ─────────────────────────────────
SplashScreen.preventAutoHideAsync();

// ─── QueryClient 설정 ─────────────────────────────────────────────────────────

const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 1000 * 60 * 5, // 5분 캐시
            retry: 2,
            refetchOnWindowFocus: false,
        },
    },
});

// ─── 알림 핸들러 ──────────────────────────────────────────────────────────────

Notifications.setNotificationHandler({
    handleNotification: async () =>
        ({
            shouldPlaySound: true,
            shouldSetBadge: true,
            shouldShowBanner: true as any,
            shouldShowList: true as any,
        }) as Notifications.NotificationBehavior,
});

// ─── Root Layout ──────────────────────────────────────────────────────────────

// RN: locale별 단일 폰트. ko: Cafe24Dongdong / en: Kalam* / ja: HachiMaruPop / zh: ZCOOLKuaiLe
applyDefaultTextFontForLocale(loadLocalePreference());

export default function RootLayout() {
    const [showSplash, setShowSplash] = useState(true);
    const notificationListener = useRef<ReturnType<typeof Notifications.addNotificationResponseReceivedListener>>();

    useEffect(() => {
        // 앱 열릴 때 배지 초기화
        Notifications.setBadgeCountAsync(0);
        const appStateSub = AppState.addEventListener("change", (state) => {
            if (state === "active") Notifications.setBadgeCountAsync(0);
        });
        return () => appStateSub.remove();
    }, []);

    useEffect(() => {
        // 알림 탭 시 data.url 기반으로 라우팅
        notificationListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
            const url = response.notification.request.content.data?.url as string | undefined;
            if (!url) return;
            // 스플래시가 끝난 후 라우팅되도록 약간 지연
            setTimeout(() => {
                try {
                    router.push(url as any);
                } catch {
                    router.push("/");
                }
            }, 500);
        });
        return () => notificationListener.current?.remove();
    }, []);

    const [fontsLoaded, fontError] = useFonts({
        Cafe24Dongdong: require("../assets/fonts/Cafe24DongdongRegular.otf"),
        KalamLight: require("../assets/fonts/Kalam-Light.ttf"),
        KalamRegular: require("../assets/fonts/Kalam-Regular.ttf"),
        KalamBold: require("../assets/fonts/Kalam-Bold.ttf"),
        HachiMaruPop: require("../assets/fonts/HachiMaruPop-Regular.ttf"),
        ZCOOLKuaiLe: require("../assets/fonts/ZCOOLKuaiLe-Regular.ttf"),
    });

    // 네이티브 스플래시 즉시 숨김 → JS DonaSplashAnimation(4초)이 전체 스플래시를 담당
    useEffect(() => {
        SplashScreen.hideAsync().catch(() => {});
    }, []);

    useEffect(() => {
        // MMKV 마이그레이션은 즉시 실행 (스토리지 의존성 있음)
        migrateFromAsyncStorage();
    }, []);

    useEffect(() => {
        // RevenueCat + 카카오 SDK는 스플래시 후 백그라운드에서 초기화
        // 결제/로그인 버튼은 스플래시 이후에 접근 가능하므로 지연 초기화 안전
        if (showSplash) return;

        (async () => {
            // RevenueCat 초기화
            const apiKey =
                Platform.OS === "ios"
                    ? (process.env.EXPO_PUBLIC_REVENUECAT_API_KEY_IOS ?? "")
                    : (process.env.EXPO_PUBLIC_REVENUECAT_API_KEY_ANDROID ?? "");

            if (apiKey) {
                try {
                    Purchases.configure({ apiKey });
                } catch {
                    /* already configured */
                }
                if (__DEV__) Purchases.setLogLevel(LOG_LEVEL.DEBUG);
            }

            // 카카오 SDK 초기화 (Android만)
            if (Platform.OS === "android" && KAKAO_NATIVE_APP_KEY) {
                try {
                    await initializeKakaoSDK(KAKAO_NATIVE_APP_KEY);
                } catch (e) {
                    console.error("[Kakao] initializeKakaoSDK 실패:", e);
                }
            }
        })();
    }, [showSplash]);

    return (
        <GestureHandlerRootView style={styles.root}>
            <SafeAreaProvider>
                <AppSettingsProvider>
                    <SyncTextFontToLocale />
                    <QueryClientProvider client={queryClient}>
                        <ModalProvider>
                            <RootStatusBar />
                            {(fontsLoaded || fontError) && (
                                <Stack
                                    screenOptions={{
                                        headerShown: false,
                                        animation: "none",
                                        // Android: 전환 시 window 배경색(녹색) 비침 방지
                                        contentStyle: { backgroundColor: "#ffffff" },
                                        // Android: 레이아웃이 상태바 아래부터 시작하지 않도록 설정
                                        // (미설정 시 상태바 높이가 두 번 적용되어 헤더가 과도하게 내려감)
                                        statusBarTranslucent: Platform.OS === "android",
                                    }}
                                />
                            )}
                            {/* 전역 모달 */}
                            <ModalManager />
                            {/* JS 스플래시: 네이티브 스플래시 즉시 숨김 후 4초 JS 애니메이션 */}
                            {showSplash && (
                                <DonaSplashAnimation onDone={() => setShowSplash(false)} />
                            )}
                        </ModalProvider>
                    </QueryClientProvider>
                </AppSettingsProvider>
            </SafeAreaProvider>
        </GestureHandlerRootView>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: "#ffffff" },
});
