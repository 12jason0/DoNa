"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function RoutePrefetcher() {
    const router = useRouter();

    useEffect(() => {
        // 🟢 성능 최적화: 더 많은 라우트 추가 및 우선순위별 그룹화
        const priorityRoutes = ["/courses", "/nearby", "/personalized-home", "/map", "/mypage"];
        const secondaryRoutes = ["/onboarding", "/login", "/signup", "/about", "/help"];
        
        const doPrefetch = () => {
            try {
                // 우선순위가 높은 라우트 먼저 prefetch
                priorityRoutes.forEach((r) => router.prefetch(r));
                // 그 다음 보조 라우트 prefetch (약간의 지연)
                setTimeout(() => {
                    secondaryRoutes.forEach((r) => router.prefetch(r));
                }, 500);
            } catch {}
        };
        // 유휴 시간 또는 다음 틱에 사전 로드
        // @ts-ignore
        const ric = window.requestIdleCallback || ((cb: any) => setTimeout(cb, 1));
        ric(doPrefetch);
    }, [router]);

    return null;
}
