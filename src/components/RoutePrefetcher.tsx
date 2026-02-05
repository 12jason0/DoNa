"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";

export default function RoutePrefetcher() {
    const router = useRouter();
    const pathname = usePathname();

    useEffect(() => {
        const priorityRoutes = ["/", "/courses", "/nearby", "/map", "/mypage"];
        const secondaryRoutes = ["/personalized-home", "/onboarding", "/login", "/about"];
        let secondaryTimer: ReturnType<typeof setTimeout> | null = null;

        // 🟢 마이페이지는 바로 prefetch (idle 대기 없이) → 클릭 시 빠른 진입
        try {
            if (pathname !== "/mypage") router.prefetch("/mypage");
        } catch {}

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
                }, 150);
            } catch {}
        };

        const hasRic = typeof window !== "undefined" && typeof window.requestIdleCallback === "function";
        const id = hasRic
            ? (window.requestIdleCallback as (cb: () => void, opts?: { timeout: number }) => number)(doPrefetch, { timeout: 300 })
            : setTimeout(doPrefetch, 0);

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
