import "react-native-gesture-handler";
import React, { useEffect, useRef, useState } from "react";
import { View, Platform } from "react-native"; // View 추가
import { NavigationContainer, DefaultTheme, Theme } from "@react-navigation/native";
import { StatusBar } from "expo-status-bar";
import * as Notifications from "expo-notifications";
import { SafeAreaProvider } from "react-native-safe-area-context";
// 🟢 [IN-APP PURCHASE]: RevenueCat SDK
import Purchases, { LOG_LEVEL } from "react-native-purchases";
import AsyncStorage from "@react-native-async-storage/async-storage";

import WebScreen from "./src/components/WebScreen";
import { registerForPushNotificationsAsync } from "./src/notifications";
import { registerPushTokenToServer } from "./src/api";
import { initDB } from "./src/utils/storage";
import { PushTokenContext } from "./src/context/PushTokenContext";

const navTheme: Theme = {
    ...DefaultTheme,
    colors: { ...DefaultTheme.colors, primary: "#6db48c", background: "#ffffff" },
};

Notifications.setNotificationHandler({
    handleNotification: async () =>
        ({
            shouldShowAlert: true,
            shouldPlaySound: true,
            shouldSetBadge: true,
            shouldShowBanner: true as any,
            shouldShowList: true as any,
        } as Notifications.NotificationBehavior),
});

export default function App() {
    const [pushToken, setPushToken] = useState<string | null>(null);
    const notificationListener = useRef<Notifications.Subscription | null>(null);
    const responseListener = useRef<Notifications.Subscription | null>(null);

    useEffect(() => {
        initDB().catch((error) => {
            console.error("DB 초기화 실패:", error);
        });

        // 🟢 [IN-APP PURCHASE]: RevenueCat 초기화
        (async () => {
            try {
                // TODO: RevenueCat API Key를 환경변수에서 가져오기
                // iOS와 Android 각각 다른 키 필요
                const apiKey =
                    Platform.OS === "ios"
                        ? process.env.EXPO_PUBLIC_REVENUECAT_API_KEY_IOS || ""
                        : process.env.EXPO_PUBLIC_REVENUECAT_API_KEY_ANDROID || "";

                if (apiKey) {
                    await Purchases.configure({ apiKey });
                    // 개발 환경에서 디버그 로그 활성화
                    if (__DEV__) {
                        Purchases.setLogLevel(LOG_LEVEL.DEBUG);
                    }
                    console.log("[RevenueCat] 초기화 완료");

                    // 🟢 [추가]: 앱 시작 시 저장된 사용자 ID로 RevenueCat 동기화
                    const userIdStr = await AsyncStorage.getItem("userId");
                    if (userIdStr) {
                        try {
                            await Purchases.logIn(userIdStr);
                            console.log("[RevenueCat] 기존 사용자 ID로 로그인:", userIdStr);
                        } catch (error) {
                            console.error("[RevenueCat] 사용자 로그인 실패:", error);
                        }
                    }
                } else {
                    console.warn("[RevenueCat] API Key가 설정되지 않았습니다.");
                }
            } catch (error) {
                console.error("[RevenueCat] 초기화 실패:", error);
            }
        })();

        (async () => {
            const t = await registerForPushNotificationsAsync();
            setPushToken(t);
            try {
                await registerPushTokenToServer(t || null);
            } catch (error) {
                console.error("푸시 토큰 서버 등록 실패:", error);
            }
        })();

        notificationListener.current = Notifications.addNotificationReceivedListener((notification) => {
            console.log("📩 알림 수신:", notification);
        });

        responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
            console.log("👆 알림 클릭:", response);
        });

        return () => {
            notificationListener.current?.remove?.();
            responseListener.current?.remove?.();
        };
    }, []);

    return (
        <SafeAreaProvider>
            {/* 배경색을 흰색으로 지정하여 상태바 영역이 튀지 않게 합니다. */}
            <View style={{ flex: 1, backgroundColor: "#ffffff" }}>
                <NavigationContainer theme={navTheme}>
                    <StatusBar style="dark" />
                    <PushTokenContext.Provider value={pushToken}>
                        {/* WebScreen 내부에서 이전에 작성한 useSafeAreaInsets 로직이 
                          정상 작동하려면 반드시 SafeAreaProvider 내부에 있어야 합니다. 
                        */}
                        {/* <WebScreen uri="https://dona.io.kr" /> */}
                        <WebScreen
                            uri="http://192.168.219.220:3000"
                            onUserLogin={async (userId: string) => {
                                // 🟢 [RevenueCat 동기화]: 로그인 시 사용자 ID를 RevenueCat에 등록
                                try {
                                    await Purchases.logIn(userId);
                                    console.log("[RevenueCat] 사용자 로그인 완료:", userId);
                                } catch (error) {
                                    console.error("[RevenueCat] 사용자 로그인 실패:", error);
                                }
                            }}
                            onUserLogout={async () => {
                                // 🟢 [RevenueCat 동기화]: 로그아웃 시 RevenueCat 계정 연결 해제
                                try {
                                    await Purchases.logOut();
                                    console.log("[RevenueCat] 사용자 로그아웃 완료");
                                } catch (error) {
                                    console.error("[RevenueCat] 사용자 로그아웃 실패:", error);
                                }
                            }}
                        />
                    </PushTokenContext.Provider>
                </NavigationContainer>
            </View>
        </SafeAreaProvider>
    );
}
