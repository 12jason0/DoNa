import "react-native-gesture-handler";
import React, { useEffect, useRef, useState } from "react";
import { View } from "react-native"; // View 추가
import { NavigationContainer, DefaultTheme, Theme } from "@react-navigation/native";
import { StatusBar } from "expo-status-bar";
import * as Notifications from "expo-notifications";
import { SafeAreaProvider } from "react-native-safe-area-context";

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
                        <WebScreen uri="https://dona.io.kr" />
                    </PushTokenContext.Provider>
                </NavigationContainer>
            </View>
        </SafeAreaProvider>
    );
}
