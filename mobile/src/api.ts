import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { WEB_BASE } from "./config";
import { loadAuthToken } from "./storage";

export async function registerPushTokenToServer(token: string | null): Promise<void> {
    if (!token) return;

    try {
        // 1. 기존 기능 유지: 내 ID와 인증 토큰 가져오기 (로깅 및 사전 검증용)
        const userIdStr = await AsyncStorage.getItem("userId");
        const authToken = await loadAuthToken();

        // [기능 유지] 로그인이 안 되어 있으면 전송 중단
        if (!userIdStr) {
            console.log("⚠️ 로그인 정보가 없어 토큰 전송을 보류합니다.");
            return;
        }

        console.log(`🚀 서버로 푸시 토큰 전송 시작: ${WEB_BASE}/api/push`);

        // 2. 🟢 보안 강화: 서버 세션(쿠키) 기반 인증 연동 [cite: 2025-12-24]
        // 서버는 이제 body의 userId 대신 쿠키의 세션을 검증합니다.
        const response = await fetch(`${WEB_BASE}/api/push`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                // 하위 호환성을 위해 기존 헤더 유지, 시스템은 서버 세션을 우선함 [cite: 2025-12-24]
                ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
            },
            // 🟢 핵심: 클라이언트 쿠키를 서버 세션 검증(resolveUserId)에 전달 [cite: 2025-12-24]
            credentials: "include",
            body: JSON.stringify({
                // userId를 제거해도 서버의 resolveUserId가 쿠키로 식별하므로 안전합니다. [cite: 2025-12-24]
                token: token,
                platform: Platform.OS,
                subscribed: true, // 기본적으로 알림 활성화 상태로 등록
            }),
        });

        // 3. 응답 처리 및 성능 최적화 피드백 [cite: 2025-12-24]
        if (response.ok) {
            console.log("✅ 푸시 토큰 서버 저장 및 인증 동기화 완료!");
        } else if (response.status === 401) {
            // 2030 세대를 위한 빠르고 쾌적한 예외 처리 [cite: 2025-12-24]
            console.log("❌ 인증 세션이 만료되었습니다. 다시 로그인이 필요합니다.");
        } else {
            const errorData = await response.json().catch(() => ({}));
            console.log("❌ 토큰 저장 실패 Status:", response.status);
            console.log("❌ 서버 에러 메시지:", errorData.error || "알 수 없는 오류");
        }
    } catch (error) {
        // 네트워크 오류 시 2030 세대 타겟 앱의 안정성 확보를 위한 로그 [cite: 2025-12-14, 2025-12-24]
        console.error("❌ 푸시 토큰 전송 중 네트워크 에러 발생:", error);
    }
}
