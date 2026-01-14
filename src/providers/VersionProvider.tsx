"use client";

import { createContext, useContext, useEffect, useState } from "react";

interface VersionContextType {
    isReview: boolean;
}

const VersionContext = createContext<VersionContextType>({ isReview: false });

export const VersionProvider = ({ children }: { children: React.ReactNode }) => {
    const [isReview, setIsReview] = useState(false);

    useEffect(() => {
        // 🟢 유저 에이전트를 한 번만 체크하여 전역 상태로 관리
        if (typeof window === "undefined") return;

        const ua = navigator.userAgent;
        // v1.2.1 심사용 빌드 감지
        if (ua.includes("DoNa_App_v1.2.1_Review")) {
            setIsReview(true);
        }
    }, []);

    return <VersionContext.Provider value={{ isReview }}>{children}</VersionContext.Provider>;
};

export const useVersion = () => useContext(VersionContext);
