import { Platform } from "react-native";

/**
 * 하단 시스템 내비/제스처 바 — 인셋이 0으로 나오는 안드로이드 기기 보정 + 최소 여백
 * navigationBarTranslucent: true 설정 시 insets.bottom이 실제 네비 높이를 반환하므로
 * 해당 값을 그대로 사용하되 최소 여백만 보장
 */
export function modalBottomPadding(bottomInset: number): number {
    const min = Platform.OS === "android" ? 24 : 8;
    return Math.max(bottomInset, min);
}
