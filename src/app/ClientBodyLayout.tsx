"use client";

import React from "react";
import { usePathname } from "next/navigation";
import LayoutContent from "@/components/LayoutContent";
import RoutePrefetcher from "@/components/RoutePrefetcher";
import SearchModal from "@/components/SearchModal";

export default function ClientBodyLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const isGarden = pathname?.startsWith("/garden");

    // 2. [추가] 메인 페이지인지 확인 (여기가 바로 포스터 페이지입니다)
    const isLanding = pathname === "/";
    const [isSearchModalOpen, setIsSearchModalOpen] = React.useState(false);

    React.useEffect(() => {
        const handleOpenSearch = () => setIsSearchModalOpen(true);
        window.addEventListener("openSearchModal", handleOpenSearch);
        return () => window.removeEventListener("openSearchModal", handleOpenSearch);
    }, []);

    React.useEffect(() => {
        // Next.js Dev Tools 배지/버튼 강제 제거 (개발용)
        const removeDevBadge = () => {
            const selectors = [
                "[data-next-badge]",
                "[data-nextjs-dev-tools-button]",
                "button[data-nextjs-dev-tools-button]",
                "#nextjs-dev-tools-menu",
                "#nextjs-devtools-container",
                '[aria-label="Open Next.js Dev Tools"]',
                '[aria-haspopup="menu"][aria-controls*="nextjs"]',
                "nextjs-devtools",
            ];
            const removeFrom = (root: Document | ShadowRoot | HTMLElement) => {
                selectors.forEach((sel) => {
                    try {
                        // @ts-ignore
                        const list = root.querySelectorAll?.(sel) || [];
                        // @ts-ignore
                        list.forEach((el: Element) => el.remove());
                    } catch {}
                });
                // @ts-ignore
                const all: any[] = root.querySelectorAll?.("*") ? Array.from(root.querySelectorAll("*")) : [];
                all.forEach((el) => {
                    // @ts-ignore
                    if (el && el.shadowRoot) {
                        // @ts-ignore
                        removeFrom(el.shadowRoot);
                    }
                });
            };
            removeFrom(document);
        };
        removeDevBadge();
        const mo = new MutationObserver(() => removeDevBadge());
        try {
            mo.observe(document.documentElement, { childList: true, subtree: true });
        } catch {}
        // 간헐적 재부착 대비: 짧은 인터벌로 몇 초간 반복 제거
        const interval = window.setInterval(removeDevBadge, 1000);
        window.setTimeout(() => window.clearInterval(interval), 10000);
        return () => {
            try {
                mo.disconnect();
            } catch {}
            window.clearInterval(interval);
        };
    }, []);
    return (
        <>
            <RoutePrefetcher />
            <SearchModal isOpen={isSearchModalOpen} onClose={() => setIsSearchModalOpen(false)} />
            {isGarden || isLanding ? <>{children}</> : <LayoutContent>{children}</LayoutContent>}
        </>
    );
}
