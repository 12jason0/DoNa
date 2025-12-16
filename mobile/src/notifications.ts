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

        // ✅ [수정됨] app.json에서 자동으로 ID를 가져옵니다 (하드코딩 X)
        // npx eas-cli init 명령어가 성공해야 이 부분이 작동합니다.
        const projectId = Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.manifest?.extra?.eas?.projectId;

        if (!projectId) {
            console.error("❌ Project ID를 찾을 수 없습니다. 'npx eas-cli init'을 실행했나요?");
            return null;
        }

        try {
            const tokenData = await Notifications.getExpoPushTokenAsync({
                projectId: projectId,
            });
            token = tokenData.data;
            console.log("✅ 성공! 푸시 토큰:", token);
        } catch (e) {
            console.error("❌ 토큰 발급 에러:", e);
        }
    } else {
        alert("실제 기기에서만 푸시 알림을 테스트할 수 있습니다.");
    }

    return token ?? null;
}
