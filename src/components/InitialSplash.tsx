"use client";

import { useState, useEffect } from "react";

type InitialSplashProps = {
    logoUrl: string;
};

const SPLASH_SHOWN_KEY = "dona-splash-shown";

/**
 * 초기 스플래시. 첫 방문(세션)에만 표시, F5(새로고침) 시에는 미표시 → Hydration 오류 방지.
 */
export default function InitialSplash({ logoUrl }: InitialSplashProps) {
    const [showSplash, setShowSplash] = useState(false); // 클라이언트에서 첫 방문일 때만 true
    const [visible, setVisible] = useState(true);
    const [fadeOut, setFadeOut] = useState(false);

    useEffect(() => {
        try {
            // F5(새로고침) 시 이미 본 적 있으면 스플래시 안 띄움
            if (typeof window !== "undefined" && sessionStorage.getItem(SPLASH_SHOWN_KEY)) {
                return;
            }
            setShowSplash(true);

            let t1: ReturnType<typeof setTimeout> | undefined;
            let t2: ReturnType<typeof setTimeout> | undefined;
            const raf = requestAnimationFrame(() => {
                t1 = setTimeout(() => setFadeOut(true), 100);
                t2 = setTimeout(() => {
                    setVisible(false);
                    try {
                        sessionStorage.setItem(SPLASH_SHOWN_KEY, "1");
                    } catch {
                        // ignore
                    }
                }, 450);
            });
            return () => {
                cancelAnimationFrame(raf);
                if (t1 !== undefined) clearTimeout(t1);
                if (t2 !== undefined) clearTimeout(t2);
            };
        } catch {
            return undefined;
        }
    }, []);

    // 서버·클라이언트 첫 렌더는 null → Hydration mismatch 방지. 첫 방문일 때만 스플래시 표시
    if (!showSplash || !visible) return null;

    return (
        <div
            id="initial-splash"
            suppressHydrationWarning
            style={{
                position: "fixed",
                inset: 0,
                backgroundColor: "#7FCC9F",
                zIndex: 9999,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexDirection: "column",
                opacity: fadeOut ? 0 : 1,
                transition: "opacity 0.3s ease-out",
            }}
        >
            <img
                src={logoUrl}
                alt="DoNa"
                style={{
                    width: "120px",
                    height: "120px",
                    objectFit: "contain",
                    marginBottom: "16px",
                }}
            />
            <div
                style={{
                    color: "white",
                    fontSize: "24px",
                    fontWeight: "bold",
                }}
            >
                두나
            </div>
        </div>
    );
}
