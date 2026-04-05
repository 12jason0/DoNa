import { Platform } from "react-native";

/** 안드로이드: 모달이 상태바 + 하단 네비게이션 바 영역까지 그려지도록 */
export const MODAL_ANDROID_PROPS =
    Platform.OS === "android"
        ? ({ statusBarTranslucent: true, navigationBarTranslucent: true, hardwareAccelerated: true } as Record<string, boolean>)
        : {};
