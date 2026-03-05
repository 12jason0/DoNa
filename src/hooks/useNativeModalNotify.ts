"use client";

import { useEffect } from "react";
import { notifyNativeModalOpen, notifyNativeModalClose } from "@/lib/nativeModalNotify";

/**
 * 앱 WebView에서 모달이 열렸을 때 네이티브에 알려 AdMob 배너를 숨김.
 * 모달이 광고 위에 제대로 표시되도록 함.
 */
export function useNativeModalNotify(isOpen: boolean) {
    useEffect(() => {
        if (!isOpen) return;
        notifyNativeModalOpen();
        return () => notifyNativeModalClose();
    }, [isOpen]);
}
