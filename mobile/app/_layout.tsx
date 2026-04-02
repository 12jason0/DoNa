import "react-native-gesture-handler";
import { useEffect, useState } from "react";
import { Platform } from "react-native";
import { Stack } from "expo-router";
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
import { AppSettingsProvider } from "../src/context/AppSettingsContext";
import RootStatusBar from "../src/components/RootStatusBar";
import DonaSplashAnimation from "../src/components/DonaSplashAnimation";
import SyncTextFontToLocale from "../src/components/SyncTextFontToLocale";
import { loadLocalePreference } from "../src/lib/appSettingsStorage";
import { applyDefaultTextFontForLocale } from "../src/lib/textDefaultFont";

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
            shouldShowAlert: true,
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
        (async () => {
            // 1. AsyncStorage → MMKV 마이그레이션
            migrateFromAsyncStorage();

            // 2. RevenueCat 초기화
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
        })();
    }, []);

    return (
        <GestureHandlerRootView style={styles.root}>
            <SafeAreaProvider>
                <AppSettingsProvider>
                    <SyncTextFontToLocale />
                    <QueryClientProvider client={queryClient}>
                        <RootStatusBar />
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
                        {/* JS 스플래시: 네이티브 스플래시 즉시 숨김 후 4초 JS 애니메이션 */}
                        {showSplash && (
                            <DonaSplashAnimation onDone={() => setShowSplash(false)} />
                        )}
                    </QueryClientProvider>
                </AppSettingsProvider>
            </SafeAreaProvider>
        </GestureHandlerRootView>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: "#ffffff" },
});
