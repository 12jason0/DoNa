"use client";

import { usePathname } from "next/navigation";
import PageLoadingSpinner from "@/components/PageLoadingSpinner";

// (home) 구간 페이지 전환 시 표시 - 검색 시 /nearby 등으로 이동할 때 로딩 UI가 보이도록 항상 표시
// 🟢 메인(/)은 초록 스플래시가 처리하므로 중복 로딩 UI 비표시
export default function HomeLoading() {
    const pathname = usePathname();
    if (pathname === "/") return null;

    return <PageLoadingSpinner messageKey="loading.findingCourses" />;
}
