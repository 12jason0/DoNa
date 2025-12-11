import "react-native-gesture-handler";
import React, { useEffect, useRef, useState } from "react";
import { NavigationContainer, DefaultTheme, Theme } from "@react-navigation/native";
import { StatusBar } from "expo-status-bar";
import * as Notifications from "expo-notifications";
import { Linking } from "react-native";

import WebScreen from "./src/components/WebScreen"; // ← 이 경로로 import
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
                console.log("푸시 토큰 서버 등록 완료:", t);
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
        <NavigationContainer theme={navTheme}>
            <StatusBar style="dark" />
            <PushTokenContext.Provider value={pushToken}>
                <WebScreen uri="https://dona.io.kr/secret-dev" />
            </PushTokenContext.Provider>
        </NavigationContainer>
    );
}
