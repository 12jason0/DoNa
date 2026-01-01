"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

export default function NavigationLoader() {
    const pathname = usePathname();
    const [isLoading, setIsLoading] = useState(false);
    const [prevPathname, setPrevPathname] = useState<string | null>(null);

    useEffect(() => {
        // 첫 로드가 아닐 때만 로딩 표시
        if (prevPathname !== null && pathname !== prevPathname) {
            setIsLoading(true);
            setPrevPathname(pathname);

            // 페이지 전환 완료 후 로딩 숨김
            const timer = setTimeout(() => {
                setIsLoading(false);
            }, 500);

            return () => clearTimeout(timer);
        } else if (prevPathname === null) {
            // 첫 로드 시에는 prevPathname만 설정
            setPrevPathname(pathname);
        }
    }, [pathname, prevPathname]);

    // 🟢 로딩 메시지 제거: 항상 null 반환
    return null;
}
