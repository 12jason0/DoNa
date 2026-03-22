"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";

export default function RoutePrefetcher() {
    const router = useRouter();
    const pathname = usePathname();

    useEffect(() => {
        const priorityRoutes = ["/", "/courses", "/nearby", "/map", "/mypage", "/personalized-home"];
        const secondaryRoutes = ["/onboarding", "/login", "/about", "/ticketplan", "/shop", "/escape/intro"];
        let secondaryTimer: ReturnType<typeof setTimeout> | null = null;

        const doPrefetch = () => {
            try {
                priorityRoutes.forEach((r) => {
                    if (r !== pathname) router.prefetch(r);
                });
                secondaryTimer = setTimeout(() => {
                    secondaryRoutes.forEach((r) => {
                        if (r !== pathname) router.prefetch(r);
                    });
                    secondaryTimer = null;
                }, 80);
            } catch {}
        };

        const isDoNaApp =
            typeof window !== "undefined" &&
            ((window as any).__DoNa_App === true ||
                !!(window as any).ReactNativeWebView);

        if (isDoNaApp) {
            try {
                [...priorityRoutes, ...secondaryRoutes].forEach((r) => {
                    if (r !== pathname) router.prefetch(r);
                });
            } catch {}
            return;
        }

        // 🟢 즉시 priority prefetch (idle 대기 단축 → 100ms), 타이밍 최적화
        const hasRic = typeof window.requestIdleCallback === "function";
        const id = hasRic
            ? (window.requestIdleCallback as (cb: () => void, opts?: { timeout: number }) => number)(doPrefetch, { timeout: 150 })
            : setTimeout(doPrefetch, 50);

        return () => {
            if (secondaryTimer != null) clearTimeout(secondaryTimer);
            if (hasRic && typeof window.cancelIdleCallback === "function") {
                window.cancelIdleCallback(id as number);
            } else {
                clearTimeout(id);
            }
        };
    }, [pathname, router]);

    return null;
}
