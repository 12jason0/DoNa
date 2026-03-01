"use client";

import React, { createContext, useContext } from "react";

interface AppLayoutContextType {
    /** 웹에서 폰 목업 내부에만 모달/바텀시트가 표시되도록 함 */
    containInPhone: boolean;
    /** containInPhone일 때 모달 포탈 대상 (폰 컨테이너) */
    modalContainerRef: React.RefObject<HTMLDivElement | null>;
}

const AppLayoutContext = createContext<AppLayoutContextType>({
    containInPhone: false,
    modalContainerRef: { current: null },
});

export function useAppLayout() {
    return useContext(AppLayoutContext);
}

export const AppLayoutProvider = AppLayoutContext.Provider;
