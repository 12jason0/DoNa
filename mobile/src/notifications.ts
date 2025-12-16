import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { Platform } from "react-native";

export async function registerForPushNotificationsAsync(): Promise<string | null> {
    let token;

    if (Platform.OS === "android") {
        await Notifications.setNotificationChannelAsync("default", {
            name: "default",
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: "#FF231F7C",
        });
    }

    if (Device.isDevice || Platform.OS === "web") {
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;

        if (existingStatus !== "granted") {
            const { status } = await Notifications.requestPermissionsAsync();
            finalStatus = status;
        }

        if (finalStatus !== "granted") {
            alert("알림 권한이 없어 푸시 알림을 받을 수 없습니다!");
            return null;
        }

        const projectId = Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.manifest?.extra?.eas?.projectId;

        if (!projectId) {
            console.error("❌ Project ID를 찾을 수 없습니다. 'npx eas-cli init'을 실행했나요?");
            return null;
        }

        try {
            // ✅ [수정됨] 'as any'를 붙여서 TypeScript 오류를 무시합니다.
            const tokenData = await Notifications.getExpoPushTokenAsync({
                projectId: projectId,
                vapidPublicKey:
                    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ??
                    "BMW3e7lNnYLnS2-pRm-WDzsLpKSsssMvpY4a0v-XsAAUMY_vnxdMT8bCEPRugZrOpwxIExCt4ILNZON1e-QqqKI",
            } as any);

            token = tokenData.data;
            console.log("✅ 성공! 푸시 토큰:", token);
        } catch (e) {
            console.error("❌ 토큰 발급 에러:", e);
        }
    } else {
        alert("에뮬레이터에서는 푸시 알림이 작동하지 않을 수 있습니다.");
    }

    return token ?? null;
}
