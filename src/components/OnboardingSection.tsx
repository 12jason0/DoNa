"use client";

import React, { useState, useEffect } from "react";
import LoginModal from "./LoginModal";

type Props = {
    onStart: () => void;
};

export default function OnboardingSection({ onStart }: Props) {
    const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
    const [showLoginModal, setShowLoginModal] = useState(false);

    // 로그인 상태 확인
    useEffect(() => {
        const checkLoginStatus = async () => {
            try {
                const { fetchSession } = await import("@/lib/authClient");
                const session = await fetchSession();
                setIsLoggedIn(session.authenticated);
            } catch (error) {
                console.error("로그인 상태 확인 실패:", error);
                setIsLoggedIn(false);
            }
        };
        checkLoginStatus();
    }, []);

    const handleClick = () => {
        // 로그인 상태 확인 중이면 아무것도 하지 않음
        if (isLoggedIn === null) return;

        // 비로그인 상태면 로그인 모달 표시
        if (!isLoggedIn) {
            setShowLoginModal(true);
            return;
        }

        // 로그인 상태면 기존 동작 실행
        onStart();
    };

    return (
        <>
            <section className="pt-6 pb-8 px-4 sm:px-0 w-full max-w-[480px] mx-auto">
                <button
                    onClick={handleClick}
                    // 1. 테두리와 그림자를 브랜드 컬러(Green/Emerald) 계열로 변경
                    className="w-full group relative flex items-center justify-between p-5 rounded-xl bg-white dark:bg-[#1a241b] border border-emerald-100 dark:border-emerald-900/30 transition-all duration-300 active:scale-98"
                >
                    {/* 배경: 아주 은은한 민트빛 그라데이션 */}
                    <div className="absolute inset-0 bg-linear-to-br from-emerald-50/60 dark:from-emerald-900/20 via-transparent to-transparent rounded-xl pointer-events-none" />

                    <div className="relative z-10 flex items-center gap-4">
                        {/* 2. 아이콘 배경: 연한 초록색 */}
                        <div className="relative flex items-center justify-center w-14 h-14 rounded-xl bg-[#E8FBF4] dark:bg-emerald-900/30 group-hover:scale-105 transition-transform duration-300 overflow-hidden">
                            {/* 오로라 효과: 초록색 + 청록색 */}
                            <div className="absolute top-0 left-0 w-full h-full bg-linear-to-br from-green-200/50 dark:from-emerald-800/50 to-teal-200/50 dark:to-teal-800/50 opacity-50 blur-md" />

                            {/* 3. 아이콘: 꽉 찬 면(Fill) + Green Gradient 적용 */}
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                viewBox="0 0 24 24"
                                className="w-8 h-8 relative z-10 drop-shadow-sm"
                            >
                                <defs>
                                    {/* [핵심] 두나 그린 그라데이션 (Emerald to Teal) */}
                                    <linearGradient id="donaGreenGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                                        <stop offset="0%" stopColor="#34d399" /> {/* emerald-400 (밝은 녹색) */}
                                        <stop offset="100%" stopColor="#059669" /> {/* emerald-600 (진한 녹색) */}
                                    </linearGradient>
                                </defs>
                                {/* 반짝이 아이콘 (두나의 스마트함을 상징) */}
                                <path
                                    fill="url(#donaGreenGradient)"
                                    d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z"
                                />
                            </svg>
                        </div>

                        <div className="text-left">
                            <h3 className="text-[17px] font-bold text-gray-800 dark:text-white leading-tight tracking-tight">
                                코스 고민은 DoNa에게!
                            </h3>
                            <p className="text-[13px] text-gray-500 dark:text-gray-400 mt-1 font-medium">
                                AI가{" "}
                                <span className="text-transparent bg-clip-text bg-linear-to-r from-emerald-600 to-teal-600 dark:from-emerald-400 dark:to-teal-400 font-bold">
                                    취향저격 데이트
                                </span>
                                를 준비해요
                            </p>
                        </div>
                    </div>

                    {/* 화살표: 녹색 계열로 변경 */}
                    <div className="relative z-10 w-8 h-8 flex items-center justify-center rounded-full bg-emerald-50 dark:bg-emerald-900/30 text-emerald-300 dark:text-emerald-400 group-hover:bg-emerald-100 dark:group-hover:bg-emerald-900/50 group-hover:text-emerald-600 dark:group-hover:text-emerald-500 transition-colors">
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                            strokeWidth={3}
                            stroke="currentColor"
                            className="w-4 h-4"
                        >
                            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                        </svg>
                    </div>
                </button>
            </section>
            {showLoginModal && <LoginModal onClose={() => setShowLoginModal(false)} />}
        </>
    );
}
