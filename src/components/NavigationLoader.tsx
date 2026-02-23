"use client";

import { useEffect, useState, useRef } from "react";
import { usePathname } from "next/navigation";

export default function NavigationLoader() {
    const pathname = usePathname();
    const [isLoading, setIsLoading] = useState(false);
    const prevPathnameRef = useRef<string | null>(null);

    // 클릭 시에만 로딩 표시 (내부 링크) - touchstart 제거로 스크롤 시 오탐 방지
    useEffect(() => {
        const handleNavStart = (e: MouseEvent) => {
            const target = (e.target as HTMLElement).closest("a");
            if (!target || target.target === "_blank" || target.download || !target.href) return;
            try {
                const url = new URL(target.href);
                if (url.origin !== window.location.origin) return;
                if (url.pathname === window.location.pathname && !url.hash) return;
                setIsLoading(true);
            } catch {
                // ignore
            }
        };

        document.addEventListener("click", handleNavStart, { passive: true });
        return () => document.removeEventListener("click", handleNavStart);
    }, []);

    // pathname 변경 시 로딩 숨김
    useEffect(() => {
        if (prevPathnameRef.current !== null && prevPathnameRef.current !== pathname) {
            const t = setTimeout(() => setIsLoading(false), 100);
            return () => clearTimeout(t);
        }
        prevPathnameRef.current = pathname;
    }, [pathname]);

    // 🟢 안전 장치: 10초 이상 로딩 시 강제 해제 (네비게이션 멈춤 방지)
    useEffect(() => {
        if (!isLoading) return;
        const t = setTimeout(() => setIsLoading(false), 1000);
        return () => clearTimeout(t);
    }, [isLoading]);
}
