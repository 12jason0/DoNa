"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { Gift, ChevronRight, X, Sparkles } from "lucide-react";
import { useAppLayout } from "@/context/AppLayoutContext";

interface NotificationModalProps {
    onClose: () => void;
}

const NotificationModal = ({ onClose }: NotificationModalProps) => {
    const router = useRouter();
    const { containInPhone } = useAppLayout();
    const posClass = containInPhone ? "absolute" : "fixed";

    const handleLoginRedirect = () => {
        onClose();
        router.push("/login?next=/");
    };

    return (
        <div
            className={`${posClass} inset-0 z-2000 flex items-end justify-center bg-black/60 dark:bg-black/70 backdrop-blur-sm animate-in fade-in duration-200`}
            onClick={onClose}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === "Escape" && onClose()}
            aria-label="알림 모달 닫기"
        >
            <div
                className={`${posClass} bottom-0 left-0 right-0 z-2001 max-h-[calc(100vh-3rem)] overflow-y-auto rounded-t-2xl bg-white dark:bg-[#1a241b] shadow-2xl`}
                style={{ animation: "slideUp 0.3s ease-out forwards" }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* 상단 닫기 버튼 */}
                <div className="flex justify-end p-4 pb-0">
                    <button
                        onClick={onClose}
                        className="p-1.5 bg-gray-50 dark:bg-gray-800 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                        aria-label="닫기"
                    >
                        <X className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                    </button>
                </div>

                <div className="p-5 pt-2 text-center pb-6">
                    {/* 프로모션 배지 */}
                    <div className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-700 text-[10px] font-black rounded-full mb-4">
                        <Sparkles className="w-2.5 h-2.5" />
                        <span>신규 회원 한정 혜택</span>
                    </div>

                    {/* 아이콘 섹션 */}
                    <div className="relative w-16 h-16 mx-auto mb-5">
                        <div className="absolute inset-0 bg-emerald-500 rounded-2xl rotate-12 opacity-10 animate-pulse"></div>
                        <div className="relative w-full h-full bg-linear-to-br from-emerald-400 to-teal-600 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-200">
                            <Gift className="w-8 h-8 text-white" />
                        </div>
                    </div>

                    {/* 텍스트 섹션 */}
                    <h3 className="text-lg font-black text-gray-900 mb-2 tracking-tighter">
                        지금 가입하면 <br />
                        <span className="text-emerald-600">맞춤 데이트 코스</span>를 받아보세요
                    </h3>

                    <div className="bg-emerald-50/50 rounded-xl p-3 mb-5 border border-emerald-100/50">
                        <p className="text-gray-600 text-xs leading-relaxed">
                            오늘의 데이트 추천 하루 1회 무료,
                            <br />
                            취향에 딱 맞는 코스를 추천해드려요!
                        </p>
                    </div>

                    {/* 액션 버튼 */}
                    <div className="space-y-2">
                        <button
                            onClick={handleLoginRedirect}
                            className="group w-full py-3 bg-gray-900 text-white rounded-xl font-bold text-base hover:bg-black transition-all active:scale-[0.98] shadow-xl flex items-center justify-center gap-2"
                        >
                            <span>시작하기</span>
                            <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                        </button>

                        <button
                            onClick={onClose}
                            className="w-full py-2 text-gray-400 font-bold text-xs hover:text-gray-600 transition-colors"
                        >
                            다음에 할게요
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default NotificationModal;
