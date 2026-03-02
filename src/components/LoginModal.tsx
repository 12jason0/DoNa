// src/components/LoginModal.tsx

"use client";

import React, { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { createPortal } from "react-dom";
import { CheckCircle, Sparkles, Ticket } from "lucide-react";
import { useAppLayout } from "@/context/AppLayoutContext";

const DEFAULT_BENEFITS = [
    "고민 해결! 오늘의 데이트 추천 하루 1회 무료",
    "우리 취향을 100% 반영한 커스텀 추천",
    "멤버십 전용 시크릿 핫플레이스 공개",
];

interface LoginModalProps {
    onClose: () => void;
    next?: string;
    title?: string;
    description?: string;
    benefits?: readonly string[];
}

export default function LoginModal({ onClose, next, title, description, benefits }: LoginModalProps) {
    const router = useRouter();
    const { containInPhone, modalContainerRef } = useAppLayout();
    const pathname = usePathname();
    const [loginNavigating, setLoginNavigating] = useState(false);
    const [mounted, setMounted] = useState(false);
    const [slideUp, setSlideUp] = useState(false);

    useEffect(() => {
        setMounted(true);
        document.body.style.overflow = "hidden";
        return () => {
            setMounted(false);
            document.body.style.overflow = "";
        };
    }, []);

    useEffect(() => {
        if (!mounted) return;
        const t = requestAnimationFrame(() => setSlideUp(true));
        return () => cancelAnimationFrame(t);
    }, [mounted]);

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

    if (!mounted) return null;

    const posClass = containInPhone ? "absolute" : "fixed";
    const modalContent = (
        <>
            {/* 배경 딤드 */}
            <div
                className={`${posClass} inset-0 bg-black/70 dark:bg-black/80 backdrop-blur-md z-9999 animate-in fade-in duration-300`}
                onClick={onClose}
                aria-hidden
            />
            {/* 하단 시트: 아래·양쪽에 붙이고 상단만 둥글게. 웹 폰 목업 내에서는 컨테이너 기준 85% */}
            <div
                className={`${posClass} left-0 right-0 bottom-0 z-10000 w-full ${containInPhone ? "max-h-[85%]" : "max-h-[90vh]"}`}
                style={{ pointerEvents: "auto" }}
            >
                <div
                    className="bg-white dark:bg-[#1a241b] rounded-t-[32px] border-t border-gray-100 dark:border-gray-800 w-full max-h-full overflow-y-auto shadow-[0_20px_50px_rgba(0,0,0,0.2)] scrollbar-hide transition-transform duration-300 ease-out"
                    style={{
                        transform: slideUp ? "translateY(0)" : "translateY(100%)",
                    }}
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="p-6 sm:p-8 pb-[calc(1rem+env(safe-area-inset-bottom))] relative">
                        {/* 닫기 버튼 */}
                        <button
                            onClick={onClose}
                            aria-label="닫기"
                            className="absolute top-5 right-5 w-8 h-8 rounded-full bg-gray-50 dark:bg-gray-800 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-all flex items-center justify-center active:scale-90 z-20"
                        >
                            x
                        </button>

                        {/* 상단 비주얼 - 모바일 대응 크기 조정 */}
                        <div className="text-center mb-6 sm:mb-8">
                            <div className="relative w-20 h-20 sm:w-24 sm:h-24 mx-auto mb-4 sm:mb-6">
                                <div className="absolute inset-0 bg-linear-to-tr from-emerald-500 to-teal-300 rounded-[24px] sm:rounded-[28px] rotate-12 opacity-20 animate-pulse"></div>
                                <div className="relative w-full h-full rounded-[20px] sm:rounded-[24px] bg-linear-to-tr from-emerald-600 to-emerald-400 flex items-center justify-center shadow-[0_10px_20px_rgba(16,185,129,0.3)]">
                                    <Ticket className="w-8 h-8 sm:w-10 sm:h-10 text-white -rotate-12" />
                                    <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-200 absolute top-3 right-3 sm:top-4 sm:right-4 animate-bounce" />
                                </div>
                            </div>

                            <h2 className="text-[20px] sm:text-[24px] font-black text-gray-900 dark:text-white tracking-tight mb-2 leading-tight whitespace-pre-line">
                                {title || (
                                    <>
                                        오늘 데이트 코스,
                                        <br />
                                        <span className="text-emerald-600 dark:text-emerald-400">3초 만에</span>{" "}
                                        받아볼까요?
                                    </>
                                )}
                            </h2>
                            <p className="text-gray-500 dark:text-gray-400 text-[14px] sm:text-[16px] font-medium tracking-tight whitespace-pre-line">
                                {description || "로그인하고 맞춤 데이트 코스를 받아보세요! 🎁"}
                            </p>
                        </div>

                        {/* 혜택 리스트 - 여백 슬림화 */}
                        <div className="mb-6 sm:mb-8 bg-gray-50/80 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700 rounded-2xl p-4 sm:p-5">
                            <h3 className="text-[12px] sm:text-[14px] font-extrabold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-3 sm:mb-4">
                                로그인 혜택
                            </h3>
                            <ul className="space-y-2.5 sm:space-y-3.5">
                                {(benefits ?? DEFAULT_BENEFITS).map((benefit, index) => (
                                    <li
                                        key={index}
                                        className="flex items-center text-[14px] sm:text-[15px] font-semibold text-gray-700 dark:text-white leading-snug"
                                    >
                                        <div className="mr-3 shrink-0 w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                                            <CheckCircle className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 stroke-3" />
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
                                    : "bg-linear-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400"
                            }`}
                        >
                            <span className="relative z-10 flex items-center justify-center">
                                {loginNavigating ? (
                                    "준비 중..."
                                ) : (
                                    <>
                                        로그인하고 계속 보기
                                        <Sparkles className="w-5 h-5 ml-2 group-hover:rotate-12 transition-transform" />
                                    </>
                                )}
                            </span>
                            {!loginNavigating && (
                                <div className="absolute top-0 -inset-full h-full w-1/2 z-5 block transform -skew-x-12 bg-linear-to-r from-transparent to-white opacity-20 group-hover:animate-shine" />
                            )}
                        </button>
                    </div>
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
                .scrollbar-hide::-webkit-scrollbar {
                    display: none;
                }
                .scrollbar-hide {
                    -ms-overflow-style: none;
                    scrollbar-width: none;
                }
            `}</style>
        </>
    );

    const portalTarget = containInPhone && modalContainerRef?.current ? modalContainerRef.current : document.body;
    return createPortal(modalContent, portalTarget);
}
