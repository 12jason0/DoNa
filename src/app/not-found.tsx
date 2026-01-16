"use client";

import Link from "next/link";
import { Home, Search, ArrowLeft, MapPin } from "lucide-react";
import Footer from "@/components/Footer";

export default function NotFound() {
    return (
        <div className="min-h-screen bg-white dark:bg-[#0f1710] flex flex-col">
            {/* 메인 콘텐츠 - Footer 공간을 고려한 패딩 */}
            <main className="flex-1 flex items-center justify-center px-6 pb-24">
                <div className="w-full max-w-[320px] text-center space-y-6">
                    {/* 🟢 비주얼 요소: 크기 축소 */}
                    <div className="relative flex items-center justify-center py-1">
                        <div className="absolute w-24 h-24 bg-emerald-100 dark:bg-emerald-900/20 rounded-full blur-2xl opacity-60"></div>
                        <div className="relative w-16 h-16 bg-white dark:bg-[#1a241b] rounded-[24px] shadow-[0_10px_25px_rgba(16,185,129,0.15)] flex items-center justify-center border border-emerald-50 dark:border-emerald-900/30">
                            <MapPin className="w-8 h-8 text-emerald-500 stroke-[1.5]" />
                            <div className="absolute -top-1 -right-1 w-6 h-6 bg-emerald-500 rounded-full border-3 border-white dark:border-[#0f1710] flex items-center justify-center shadow-md">
                                <span className="text-white text-[9px] font-bold">?</span>
                            </div>
                        </div>
                    </div>

                    {/* 🟢 텍스트 섹션: 간격 축소 */}
                    <div className="space-y-2">
                        <div className="inline-block px-2 py-0.5 bg-gray-50 dark:bg-gray-800/50 rounded-md">
                            <span className="text-[10px] font-bold text-gray-400 tracking-widest uppercase">
                                Error 404
                            </span>
                        </div>
                        <h2 className="text-xl font-black text-gray-900 dark:text-white tracking-tight leading-tight">
                            원하시는 코스를
                            <br />
                            찾지 못했어요
                        </h2>
                        <p className="text-gray-500 dark:text-gray-400 text-[13px] leading-relaxed break-keep">
                            길을 잃어도 괜찮아요.
                            <br />더 멋진 데이트 코스가 기다리고 있으니까요.
                        </p>
                    </div>

                    {/* 🟢 액션 버튼: 크기 축소 */}
                    <div className="space-y-2.5">
                        <Link
                            href="/"
                            className="w-full h-12 bg-[#10b981] text-white rounded-2xl font-bold text-[15px] shadow-[0_6px_12px_rgba(16,185,129,0.2)] active:scale-[0.97] transition-all flex items-center justify-center gap-2"
                        >
                            <Home className="w-4 h-4" />
                            홈으로 돌아가기
                        </Link>

                        <Link
                            href="/courses"
                            className="w-full h-12 bg-white dark:bg-[#1a241b] text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-800 rounded-2xl font-bold text-[15px] active:scale-[0.97] transition-all flex items-center justify-center gap-2"
                        >
                            <Search className="w-4 h-4" />
                            코스 둘러보기
                        </Link>

                        <button
                            onClick={() => window.history.back()}
                            className="w-full py-1.5 text-gray-400 dark:text-gray-600 font-semibold text-xs hover:text-gray-600 flex items-center justify-center gap-1"
                        >
                            <ArrowLeft className="w-3.5 h-3.5" />
                            이전 페이지로
                        </button>
                    </div>
                </div>
            </main>
        </div>
    );
}
