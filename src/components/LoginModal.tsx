// src/components/LoginModal.tsx

"use client";

import React, { useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { CheckCircle, Sparkles, Ticket } from "lucide-react";

interface LoginModalProps {
    onClose: () => void;
    next?: string;
    title?: string;
    description?: string;
}

export default function LoginModal({ onClose, next, title, description }: LoginModalProps) {
    const router = useRouter();
    const pathname = usePathname();
    const [loginNavigating, setLoginNavigating] = useState(false);

    const handleLogin = () => {
        if (loginNavigating) return;
        setLoginNavigating(true);
        try {
            sessionStorage.setItem("auth:loggingIn", "1");
            // next가 있으면 사용, 없으면 pathname, 둘 다 없으면 "/"
            const redirectPath = next || pathname || "/";
            // 모달을 먼저 닫고 페이지 이동
            onClose();
            router.push(`/login?next=${encodeURIComponent(redirectPath)}`);
        } catch {
            onClose();
            window.location.href = "/login";
        }
    };

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-in fade-in duration-300">
            {/* 모달 컨테이너: 최대 높이(max-h)와 스크롤(overflow-y-auto) 추가 */}
            <div className="bg-white rounded-[32px] max-w-md w-full max-h-[90vh] overflow-y-auto relative shadow-[0_20px_50px_rgba(0,0,0,0.2)] transform transition-all animate-in zoom-in-95 slide-in-from-bottom-4 duration-300 scrollbar-hide">
                {/* 내부 여백을 감싸는 wrapper (p-6~8로 조정) */}
                <div className="p-6 sm:p-8">
                    {/* 닫기 버튼 - 위치 고정을 위해 absolute 유지 */}
                    <button
                        onClick={onClose}
                        aria-label="닫기"
                        className="absolute top-5 right-5 w-8 h-8 rounded-full bg-gray-50 text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all flex items-center justify-center active:scale-90 z-20"
                    >
                        x
                    </button>

                    {/* 상단 비주얼 - 모바일 대응 크기 조정 */}
                    <div className="text-center mb-6 sm:mb-8">
                        <div className="relative w-20 h-20 sm:w-24 sm:h-24 mx-auto mb-4 sm:mb-6">
                            <div className="absolute inset-0 bg-gradient-to-tr from-emerald-500 to-teal-300 rounded-[24px] sm:rounded-[28px] rotate-12 opacity-20 animate-pulse"></div>
                            <div className="relative w-full h-full rounded-[20px] sm:rounded-[24px] bg-gradient-to-tr from-emerald-600 to-emerald-400 flex items-center justify-center shadow-[0_10px_20px_rgba(16,185,129,0.3)]">
                                <Ticket className="w-8 h-8 sm:w-10 sm:h-10 text-white -rotate-12" />
                                <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-200 absolute top-3 right-3 sm:top-4 sm:right-4 animate-bounce" />
                            </div>
                        </div>

                        <h2 className="text-[20px] sm:text-[24px] font-[900] text-gray-900 tracking-tight mb-2 leading-tight">
                            {title || (
                                <>
                                    오늘 데이트 코스,
                                    <br />
                                    <span className="text-emerald-600">3초 만에</span> 받아볼까요?
                                </>
                            )}
                        </h2>
                        <p className="text-gray-500 text-[14px] sm:text-[16px] font-medium tracking-tight">
                            {description || "지금 가입하면 무료 추천권 3장을 드려요! 🎁"}
                        </p>
                    </div>

                    {/* 혜택 리스트 - 여백 슬림화 */}
                    <div className="mb-6 sm:mb-8 bg-gray-50/80 border border-gray-100 rounded-2xl p-4 sm:p-5">
                        <h3 className="text-[12px] sm:text-[14px] font-extrabold text-gray-400 uppercase tracking-widest mb-3 sm:mb-4">
                            Login Benefits
                        </h3>
                        <ul className="space-y-2.5 sm:space-y-3.5">
                            {[
                                "고민 해결! AI 맞춤 코스 추천권 3장 무료",
                                "우리 취향을 100% 반영한 커스텀 추천",
                                "멤버십 전용 시크릿 핫플레이스 공개",
                            ].map((benefit, index) => (
                                <li
                                    key={index}
                                    className="flex items-center text-[14px] sm:text-[15px] font-semibold text-gray-700 leading-snug"
                                >
                                    <div className="mr-3 flex-shrink-0 w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center">
                                        <CheckCircle className="w-3.5 h-3.5 text-emerald-600 stroke-[3]" />
                                    </div>
                                    {benefit}
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* 메인 액션 버튼 */}
                    <button
                        onClick={handleLogin}
                        disabled={loginNavigating}
                        className={`group relative w-full py-3.5 sm:py-4.5 rounded-full text-white text-[16px] sm:text-lg font-bold shadow-[0_8px_20px_rgba(16,185,129,0.4)] transition-all active:scale-[0.97] overflow-hidden ${
                            loginNavigating
                                ? "bg-emerald-400 cursor-not-allowed"
                                : "bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400"
                        }`}
                    >
                        <span className="relative z-10 flex items-center justify-center">
                            {loginNavigating ? (
                                "준비 중..."
                            ) : (
                                <>
                                    3장 받고 시작하기
                                    <Sparkles className="w-5 h-5 ml-2 group-hover:rotate-12 transition-transform" />
                                </>
                            )}
                        </span>
                        {!loginNavigating && (
                            <div className="absolute top-0 -inset-full h-full w-1/2 z-5 block transform -skew-x-12 bg-gradient-to-r from-transparent to-white opacity-20 group-hover:animate-shine" />
                        )}
                    </button>
                </div>
            </div>

            <style jsx>{`
                @keyframes shine {
                    from {
                        left: -100%;
                    }
                    to {
                        left: 100%;
                    }
                }
                .animate-shine {
                    animation: shine 1.5s infinite;
                }
                /* 스크롤바 숨기기 */
                .scrollbar-hide::-webkit-scrollbar {
                    display: none;
                }
                .scrollbar-hide {
                    -ms-overflow-style: none;
                    scrollbar-width: none;
                }
            `}</style>
        </div>
    );
}
