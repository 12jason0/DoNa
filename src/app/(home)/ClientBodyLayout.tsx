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

    // 🛡️ [Fix]: releasePointerCapture 브라우저 에러 전역 방어 (로그인 버튼 등 모든 인터랙션 보호)
    React.useEffect(() => {
        if (typeof window === "undefined" || (window.Element as any)?._releasePointerCapturePatched) return;

        // 전역 패치 플래그 설정 (중복 패치 방지)
        (window.Element as any)._releasePointerCapturePatched = true;

        // 🟢 [Fix]: 포인터 캡처 해제 시 발생하는 NotFoundError를 안전하게 처리
        if (window.Element && Element.prototype.releasePointerCapture) {
            const originalRelease = Element.prototype.releasePointerCapture;
            Element.prototype.releasePointerCapture = function (pointerId) {
                try {
                    // hasPointerCapture로 먼저 확인하여 안전하게 해제
                    if (this.hasPointerCapture && this.hasPointerCapture(pointerId)) {
                        originalRelease.call(this, pointerId);
                    }
                } catch (e) {
                    // 🟢 [Fix]: 포인터가 이미 해제된 경우 에러를 무시하여 JS 크래시 방지
                    // 드래그/스와이프 로직이 중단되어 로그인 버튼 등 다른 인터랙션이 먹통이 되는 것을 방지
                    console.warn("[releasePointerCapture] 포인터 캡처 해제 실패 (안전하게 무시됨):", e);
                }
            };
        }
    }, []);

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
