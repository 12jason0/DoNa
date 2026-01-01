"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";

export default function RoutePrefetcher() {
    const router = useRouter();
    const pathname = usePathname();

    useEffect(() => {
        // 🟢 성능 최적화: 메인 페이지를 최우선으로 즉시 prefetch
        // 다른 페이지에 있을 때 메인 페이지를 미리 로드하여 빠른 전환 보장
        if (pathname !== "/") {
            // 즉시 prefetch (다른 페이지에서 메인으로 빠른 전환)
            router.prefetch("/");
            // 🟢 추가 최적화: 메인 페이지 데이터를 백그라운드에서 미리 로드
            if (typeof window !== "undefined") {
                // requestIdleCallback을 사용하여 메인 스레드 부하 최소화
                const ric = window.requestIdleCallback || ((cb: any) => setTimeout(cb, 100));
                ric(() => {
                    // 메인 페이지의 주요 데이터 미리 로드
                    Promise.all([
                        fetch("/api/courses?limit=30&imagePolicy=any", { 
                            method: "GET",
                            cache: "force-cache",
                        }).catch(() => null),
                        fetch("/api/courses?limit=10&imagePolicy=any&grade=FREE", { 
                            method: "GET",
                            cache: "force-cache",
                        }).catch(() => null),
                    ]).catch(() => {});
                });
            }
        }

        // 🟢 성능 최적화: 더 많은 라우트 추가 및 우선순위별 그룹화
        const priorityRoutes = ["/", "/courses", "/nearby", "/personalized-home", "/map", "/mypage"];
        const secondaryRoutes = ["/onboarding", "/login", "/signup", "/about", "/help"];
        
        const doPrefetch = () => {
            try {
                // 우선순위가 높은 라우트 먼저 prefetch
                priorityRoutes.forEach((r) => {
                    if (r !== pathname) {
                        router.prefetch(r);
                    }
                });
                // 그 다음 보조 라우트 prefetch (약간의 지연)
                setTimeout(() => {
                    secondaryRoutes.forEach((r) => {
                        if (r !== pathname) {
                            router.prefetch(r);
                        }
                    });
                }, 500);
            } catch {}
        };
        // 유휴 시간 또는 다음 틱에 사전 로드
        // @ts-ignore
        const ric = window.requestIdleCallback || ((cb: any) => setTimeout(cb, 1));
        ric(doPrefetch);
    }, [router, pathname]);

    return null;
}
