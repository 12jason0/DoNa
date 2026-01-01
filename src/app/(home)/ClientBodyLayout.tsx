"use client";

import React from "react";
import { usePathname } from "next/navigation";
import LayoutContent from "@/components/LayoutContent";
import RoutePrefetcher from "@/components/RoutePrefetcher";
import SearchModal from "@/components/SearchModal";
import NavigationLoader from "@/components/NavigationLoader";

export default function ClientBodyLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();

    // 2. [추가] 메인 페이지인지 확인 (여기가 바로 포스터 페이지입니다)
    const isLanding = pathname === "/";
    const [isSearchModalOpen, setIsSearchModalOpen] = React.useState(false);

    React.useEffect(() => {
        const handleOpenSearch = () => setIsSearchModalOpen(true);
        window.addEventListener("openSearchModal", handleOpenSearch);
        return () => window.removeEventListener("openSearchModal", handleOpenSearch);
    }, []);

    // 🟢 [Optimization]: 개발 툴 배지 제거 로직 삭제
    // CSS (globals.css)와 next.config.js의 devIndicators 설정으로 처리
    // 성능: 213ms → 0ms (querySelectorAll("*") 제거로 Forced Reflow 완전 해결)
    return (
        <>
            <RoutePrefetcher />
            <NavigationLoader />
            <SearchModal isOpen={isSearchModalOpen} onClose={() => setIsSearchModalOpen(false)} />
            <LayoutContent>{children}</LayoutContent>
        </>
    );
}
