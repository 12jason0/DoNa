"use client";

import React, { useState, useEffect } from "react";
import LoginModal from "./LoginModal";
import { LOGIN_MODAL_PRESETS } from "@/constants/loginModalPresets";

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
            <section className="pt-4 px-4 sm:px-0 w-full max-w-[480px] mx-auto">
                <button
                    onClick={handleClick}
                    className="w-full group relative flex items-center justify-between p-5 rounded-xl bg-white dark:bg-[#1a241b] border border-transparent dark:border-transparent transition-all duration-300 active:scale-98"
                >
                    {/* 배경: 연한 펄 그린 */}
                    <div className="absolute inset-0 bg-[#99c08e]/8 dark:bg-[#99c08e]/12 via-transparent to-transparent rounded-xl pointer-events-none" />

                    <div className="relative z-10 flex items-center gap-4">
                        <div className="relative flex items-center justify-center w-14 h-14 rounded-xl bg-gray-100 dark:bg-gray-800 group-hover:scale-105 transition-transform duration-300 overflow-hidden">
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                viewBox="0 0 24 24"
                                className="w-8 h-8 relative z-10 drop-shadow-sm text-gray-600 dark:text-gray-400"
                            >
                                <path
                                    fill="currentColor"
                                    d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z"
                                />
                            </svg>
                        </div>

                        <div className="text-left">
                            <h3 className="text-[17px] font-bold leading-tight tracking-tight text-[#99c08e] dark:text-[#99c08e]">
                                {isLoggedIn ? "코스 고민은 DoNa에게" : "오늘 데이트, 두나에게 맡겨요"}
                            </h3>
                            <p className="text-[13px] text-gray-500 dark:text-gray-400 mt-1 font-medium">
                                {isLoggedIn ? "추천을 더 정확하게 받고 싶다면" : ""}
                            </p>
                        </div>
                    </div>

                    <div className="relative z-10 w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500 group-hover:bg-gray-200 dark:group-hover:bg-gray-700 group-hover:text-gray-600 dark:group-hover:text-gray-300 transition-colors">
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
            {showLoginModal && (
                <LoginModal
                    onClose={() => setShowLoginModal(false)}
                    next="/personalized-home"
                    {...LOGIN_MODAL_PRESETS.recommendation}
                />
            )}
        </>
    );
}
