"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function RoutePrefetcher() {
    const router = useRouter();

    useEffect(() => {
        const routes = ["/courses", "/nearby", "/personalized-home", "/onboarding", "/login", "/escape/intro"];
        const doPrefetch = () => {
            try {
                routes.forEach((r) => router.prefetch(r));
            } catch {}
        };
        // 유휴 시간 또는 다음 틱에 사전 로드
        // @ts-ignore
        const ric = window.requestIdleCallback || ((cb: any) => setTimeout(cb, 1));
        ric(doPrefetch);
    }, [router]);

    return null;
}
