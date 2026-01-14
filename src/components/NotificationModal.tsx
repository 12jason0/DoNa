"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { Gift, ChevronRight, X, Ticket } from "lucide-react";

interface NotificationModalProps {
    onClose: () => void;
}

const NotificationModal = ({ onClose }: NotificationModalProps) => {
    const router = useRouter();

    const handleLoginRedirect = () => {
        onClose();
        router.push("/login?next=/");
    };

    return (
        <div className="fixed inset-0 z-2000 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl w-full max-w-xs overflow-hidden shadow-2xl animate-in zoom-in-95 slide-in-from-bottom-4 duration-300">
                {/* 상단 닫기 버튼 */}
                <div className="flex justify-end p-4 pb-0">
                    <button
                        onClick={onClose}
                        className="p-1.5 bg-gray-50 rounded-full hover:bg-gray-100 transition-colors"
                    >
                        <X className="w-4 h-4 text-gray-400" />
                    </button>
                </div>

                <div className="p-5 pt-2 text-center">
                    {/* 프로모션 배지 */}
                    <div className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-700 text-[10px] font-black rounded-full mb-4">
                        <Sparkles className="w-2.5 h-2.5" />
                        <span>신규 회원 한정 혜택</span>
                    </div>

                    {/* 아이콘 섹션: 선물 상자와 티켓 조합 */}
                    <div className="relative w-16 h-16 mx-auto mb-5">
                        <div className="absolute inset-0 bg-emerald-500 rounded-2xl rotate-12 opacity-10 animate-pulse"></div>
                        <div className="relative w-full h-full bg-linear-to-br from-emerald-400 to-teal-600 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-200">
                            <Gift className="w-8 h-8 text-white" />
                            {/* 쿠폰 2개 강조 표시 */}
                            <div className="absolute -top-1 -right-1 bg-gray-900 text-white w-7 h-7 rounded-full border-2 border-white flex items-center justify-center font-black text-xs">
                                x2
                            </div>
                        </div>
                    </div>

                    {/* 텍스트 섹션 */}
                    <h3 className="text-lg font-black text-gray-900 mb-2 tracking-tighter">
                        지금 가입하면 <br />
                        <span className="text-emerald-600">쿠폰이 2배! (1+1)</span>
                    </h3>

                    <div className="bg-emerald-50/50 rounded-xl p-3 mb-5 border border-emerald-100/50">
                        <p className="text-gray-600 text-xs leading-relaxed">
                            <span className="font-bold text-emerald-700">1월 31일까지</span>만 드리는 혜택 📅
                            <br />
                            회원가입 즉시 AI 추천 쿠폰 <br />
                            <span className="font-extrabold text-gray-900 underline decoration-emerald-400 decoration-2 underline-offset-2">
                                총 2매
                            </span>
                            를 바로 지급해드려요!
                        </p>
                    </div>

                    {/* 액션 버튼 */}
                    <div className="space-y-2">
                        <button
                            onClick={handleLoginRedirect}
                            className="group w-full py-3 bg-gray-900 text-white rounded-xl font-bold text-base hover:bg-black transition-all active:scale-[0.98] shadow-xl flex items-center justify-center gap-2"
                        >
                            <span>쿠폰 2개 받고 시작하기</span>
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

                {/* 하단 정보 바 */}
                <div className="py-2 bg-gray-50 text-[9px] text-gray-400 font-medium">
                    * 기간 내 신규 가입 시 자동 지급됩니다
                </div>
            </div>
        </div>
    );
};

// 상단 아이콘용 추가 컴포넌트
const Sparkles = ({ className }: { className?: string }) => (
    <svg
        className={className}
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
    >
        <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
        <path d="M5 3v4" />
        <path d="M19 17v4" />
        <path d="M3 5h4" />
        <path d="M17 19h4" />
    </svg>
);

export default NotificationModal;
