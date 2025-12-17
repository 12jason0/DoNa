import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { Platform } from "react-native";

export async function registerForPushNotificationsAsync(): Promise<string | null> {
    // 1. 웹 브라우저면 바로 종료 (알림 기능 안 씀 -> 오류 해결)
    if (Platform.OS === "web") {
        console.log("웹 환경이라 푸시 알림을 등록하지 않습니다.");
        return null;
    }

    let token;

    if (Platform.OS === "android") {
        await Notifications.setNotificationChannelAsync("default", {
            name: "default",
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: "#FF231F7C",
        });
    }

    // 2. 실제 기기(앱)일 때만 실행
    if (Device.isDevice) {
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
            console.error("❌ Project ID 없음");
            return null;
        }

        try {
            // 웹은 위에서 걸러졌으므로 vapidPublicKey 삭제해도 됨
            const tokenData = await Notifications.getExpoPushTokenAsync({
                projectId: projectId,
            });

            token = tokenData.data;
            console.log("✅ 앱 푸시 토큰:", token);
        } catch (e) {
            console.error("❌ 토큰 발급 에러:", e);
        }
    } else {
        alert("에뮬레이터에서는 푸시 알림이 작동하지 않을 수 있습니다.");
    }

    return token ?? null;
}
