"use client";

import React, { createContext, useContext } from "react";

/** Footer와 동일한 하단 오프셋 (Android 앱에서 모달이 footer와 같은 위치에서 시작) */
export const ANDROID_MODAL_BOTTOM = "calc(1.25rem + env(safe-area-inset-bottom, 0px))";

interface AppLayoutContextType {
    /** 웹에서 폰 목업 내부에만 모달/바텀시트가 표시되도록 함 */
    containInPhone: boolean;
    /** containInPhone일 때 모달 포탈 대상 (폰 컨테이너) */
    modalContainerRef: React.RefObject<HTMLDivElement | null>;
    /** Android 앱 WebView 여부 — 바텀시트 모달을 footer와 같은 bottom에서 시작 */
    isAndroidApp: boolean;
}

const AppLayoutContext = createContext<AppLayoutContextType>({
    containInPhone: false,
    modalContainerRef: { current: null },
    isAndroidApp: false,
});

export function useAppLayout() {
    return useContext(AppLayoutContext);
}

export const AppLayoutProvider = AppLayoutContext.Provider;
