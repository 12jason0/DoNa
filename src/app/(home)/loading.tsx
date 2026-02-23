"use client";

import { usePathname } from "next/navigation";

// (home) 구간 페이지 전환 시 표시 - 검색 시 /nearby 등으로 이동할 때 로딩 UI가 보이도록 항상 표시
// 🟢 메인(/)은 초록 스플래시가 처리하므로 중복 로딩 UI 비표시
export default function HomeLoading() {
    const pathname = usePathname();
    if (pathname === "/") return null;

    return (
        <main className="min-h-screen bg-white/80 dark:bg-[#0f1710]/90 backdrop-blur-sm flex flex-col items-center justify-center fixed inset-0 z-9999">
            <div className="flex flex-col items-center gap-6 animate-fadeIn">
                <div className="relative">
                    <div className="h-16 w-16 rounded-full border-[6px] border-emerald-100 dark:border-emerald-900/30"></div>
                    <div className="absolute top-0 left-0 h-16 w-16 rounded-full border-[6px] border-t-emerald-500 dark:border-t-emerald-400 border-r-transparent border-b-transparent border-l-transparent animate-spin"></div>
                    <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-2xl animate-pulse">
                        📍
                    </div>
                </div>
                <div className="text-center space-y-1">
                    <h3 className="text-emerald-900 dark:text-emerald-400 font-extrabold text-lg tracking-tight">
                        DoNa
                    </h3>
                    <p className="text-emerald-600/80 dark:text-emerald-400/80 text-xs font-medium tracking-wide animate-pulse">
                        두나가 코스를 찾고 있어요...
                    </p>
                </div>
            </div>
        </main>
    );
}
