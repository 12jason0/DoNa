import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { WEB_BASE } from "./config";
import { loadAuthToken } from "./storage";

export async function registerPushTokenToServer(token: string | null): Promise<void> {
    if (!token) return;

    try {
        // 1. 내 ID와 인증 토큰 가져오기
        const userIdStr = await AsyncStorage.getItem("userId"); // 문자열로 가져옴
        const authToken = await loadAuthToken();

        // 로그인이 안 되어 있으면 전송 중단
        if (!userIdStr) {
            console.log("⚠️ 로그인 전이라 토큰 전송을 보류합니다.");
            return;
        }

        console.log(`🚀 서버로 토큰 전송 시작: ${WEB_BASE}/api/push`);

        // 2. userId를 숫자로 변환 (서버가 숫자를 원하기 때문)
        const userId = Number(userIdStr);

        // 3. 올바른 주소(/api/push)로 전송
        const response = await fetch(`${WEB_BASE}/api/push`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
            },
            body: JSON.stringify({
                userId: userId, // ✅ 숫자로 변환된 ID 전송
                token: token,
                platform: Platform.OS,
            }),
        });

        if (response.ok) {
            console.log("✅ 푸시 토큰 서버 저장 완료!");
        } else {
            console.log("❌ 토큰 저장 실패 Status:", response.status);
            // 에러 내용을 자세히 보기 위해 추가
            const errorText = await response.text();
            console.log("❌ 서버 에러 메시지:", errorText);
        }
    } catch (error) {
        console.error("❌ 토큰 전송 중 에러 발생:", error);
    }
}
