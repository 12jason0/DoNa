// src/app/(admin)/layout.tsx
import type { Metadata } from "next";
import Link from "next/link";
import AdminAuthGuard from "@/components/AdminAuthGuard";
import { isDemoMode } from "@/lib/demo";

export const metadata: Metadata = {
    title: "DoNa 관리자",
    description: "두나 서비스 관리자 페이지입니다.",
    // 중요: 관리자 페이지가 구글 검색에 걸리지 않도록 차단
    robots: {
        index: false,
        follow: false,
    },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    // 체험 데모: 로그인 없이 열고, 위쪽 데모 띠(h-8)만큼 사이드바·모바일 헤더를 내림
    const demo = isDemoMode();
    return (
        // 관리자 화면은 시스템 기본 폰트 (globals.css .admin-system-font, 로그인 화면 포함)
        <div className="admin-system-font">
        <AdminAuthGuard demo={demo}>
            <div className="flex min-h-screen bg-gray-50 text-gray-900 font-sans">
                {/* 1. 왼쪽 사이드바 (PC 화면용) */}
                <aside className={`w-64 bg-white border-r border-gray-200 hidden md:flex flex-col fixed z-10 ${demo ? "top-8 bottom-0" : "h-full"}`}>
                    {/* 로고 영역 */}
                    <div className="p-6 border-b border-gray-100">
                        <Link href="/admin">
                            <h1 className="text-2xl font-bold text-green-700 cursor-pointer">DoNa Admin</h1>
                        </Link>
                    </div>

                    {/* 네비게이션 메뉴 */}
                    <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
                        <p className="px-4 text-xs font-semibold text-gray-400 uppercase mb-2">메인</p>
                        <Link
                            href="/admin"
                            className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-green-50 text-gray-700 hover:text-green-700 font-medium transition"
                        >
                            📊 대시보드
                        </Link>
                        {!demo && (<>
                        <Link
                            href="/admin/metrics"
                            className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-green-50 text-gray-700 hover:text-green-700 font-medium transition"
                        >
                            🔢 핵심 숫자
                        </Link>
                        </>)}
                        <Link
                            href="/admin/tips"
                            className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-green-50 text-gray-700 hover:text-green-700 font-medium transition"
                        >
                            📝 팁 검수
                        </Link>

                        <p className="px-4 text-xs font-semibold text-gray-400 uppercase mt-6 mb-2">데이터 관리</p>
                        <Link
                            href="/admin/courses"
                            className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-green-50 text-gray-700 hover:text-green-700 font-medium transition"
                        >
                            🗺️ 코스 관리
                        </Link>
                        {!demo && (<>
                        <Link
                            href="/admin/places"
                            className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-green-50 text-gray-700 hover:text-green-700 font-medium transition"
                        >
                            📍 장소 관리
                        </Link>
                        <Link
                            href="/admin/regions"
                            className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-green-50 text-gray-700 hover:text-green-700 font-medium transition"
                        >
                            🏙️ 지역 관리
                        </Link>
                        <Link
                            href="/admin/suggest"
                            className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-green-50 text-gray-700 hover:text-green-700 font-medium transition"
                        >
                            📨 장소 제보 검토
                        </Link>
                        <Link
                            href="/admin/escape-stories"
                            className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-green-50 text-gray-700 hover:text-green-700 font-medium transition"
                        >
                            🕵️‍♀️ 방탈출 스토리
                        </Link>
                        </>)}

                        <Link
                            href="/admin/card-news"
                            className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-green-50 text-gray-700 hover:text-green-700 font-medium transition"
                        >
                            📸 카드뉴스 생성
                        </Link>
                        {demo && (
                            <Link
                                href="/admin/telegram-demo"
                                className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-green-50 text-gray-700 hover:text-green-700 font-medium transition"
                            >
                                🤖 텔레그램 등록 예시
                            </Link>
                        )}

                        {!demo && (<>
                        <p className="px-4 text-xs font-semibold text-gray-400 uppercase mt-6 mb-2">운영</p>
                        <Link
                            href="/admin/notifications"
                            className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-green-50 text-gray-700 hover:text-green-700 font-medium transition"
                        >
                            📢 알림 발송
                        </Link>
                        <Link
                            href="/admin/refunds"
                            className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-green-50 text-gray-700 hover:text-green-700 font-medium transition"
                        >
                            💰 환불 관리
                        </Link>
                        <Link
                            href="/admin/partner"
                            className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-green-50 text-gray-700 hover:text-green-700 font-medium transition"
                        >
                            🤝 제휴 문의
                        </Link>
                        </>)}
                    </nav>

                    {/* 하단 정보 */}
                    <div className="p-4 border-t border-gray-100">
                        <div className="flex items-center gap-3 px-4 py-2">
                            <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center text-green-700 font-bold text-xs">
                                A
                            </div>
                            <div>
                                <p className="text-sm font-medium">관리자</p>
                                <p className="text-xs text-gray-500">admin@dona.io.kr</p>
                            </div>
                        </div>
                    </div>
                </aside>

                {/* 2. 메인 콘텐츠 영역 (사이드바 너비만큼 왼쪽 여백) */}
                <div className="flex-1 md:ml-64 flex flex-col min-h-screen">
                    {/* 모바일용 헤더 (화면 작을 때만 보임) */}
                    <header className={`md:hidden bg-white h-16 border-b flex items-center justify-between px-4 sticky z-20 shadow-sm ${demo ? "top-8" : "top-0"}`}>
                        <Link href="/admin">
                            <span className="font-bold text-green-700 text-lg">DoNa Admin</span>
                        </Link>
                        {/* 모바일 메뉴 버튼은 기능 구현이 복잡하므로 일단 생략하거나 필요시 추가 */}
                        <span className="text-xs text-gray-400">Mobile View</span>
                    </header>

                    {/* 실제 페이지 내용 (`page.tsx`가 들어가는 곳) */}
                    <main className="flex-1 p-6 md:p-10 overflow-auto">{children}</main>
                </div>
            </div>
        </AdminAuthGuard>
        </div>
    );
}
