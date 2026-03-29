import "react-native-gesture-handler";
import { useEffect, useState } from "react";
import { Platform, Text } from "react-native";
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

// ─── LINE Seed KR 전역 기본 폰트 설정 ────────────────────────────────────────
// 모든 Text 컴포넌트에 LINE Seed Rg를 기본 적용
// (bold 계열은 명시적으로 fontFamily: 'LINESeedKR-Bd' 설정 필요)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
if ((Text as any).defaultProps == null) (Text as any).defaultProps = {};
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(Text as any).defaultProps.style = { fontFamily: "LINESeedKR-Rg" };

export default function RootLayout() {
    const [showSplash, setShowSplash] = useState(true);

    const [fontsLoaded, fontError] = useFonts({
        "LINESeedKR-Th": require("../assets/fonts/LINESeedKR-Th.ttf"),
        "LINESeedKR-Rg": require("../assets/fonts/LINESeedKR-Rg.ttf"),
        "LINESeedKR-Bd": require("../assets/fonts/LINESeedKR-Bd.ttf"),
    });

    // 폰트 로드 완료 후 네이티브 스플래시 숨김 → 그 전까지 DonaSplashAnimation이 이미 렌더링된 상태
    // (mount 즉시 호출하면 폰트 미로드 상태에서 네이티브 스플래시가 사라져 탭 화면이 잠깐 노출됨)
    useEffect(() => {
        if (fontsLoaded || fontError) {
            SplashScreen.hideAsync().catch(() => {});
        }
    }, [fontsLoaded, fontError]);

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
                    <QueryClientProvider client={queryClient}>
                        <RootStatusBar />
                        <Stack
                            screenOptions={{
                                headerShown: false,
                                animation: "none",
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
