"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";

interface OnboardingBottomSheetProps {
    isOpen: boolean;
    onClose: () => void;
    /** 클릭 시 이동할 경로 (예: /onboarding?returnTo=/personalized-home) */
    onboardingUrl: string;
}

/**
 * personalized-home 3회차 진입 시 표시되는 온보딩 유도 바텀시트
 * - 하단 고정, 아래에서 위로 슬라이드 업
 * - 취향 등록 시 더 정확한 추천을 받을 수 있다는 문구
 */
export default function OnboardingBottomSheet({ isOpen, onClose, onboardingUrl }: OnboardingBottomSheetProps) {
    const router = useRouter();
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted || !isOpen) return null;

    const handleGoToOnboarding = () => {
        router.push(onboardingUrl);
        onClose();
    };

    return (
        <div
            className="fixed inset-0 z-10020 flex items-end justify-center animate-in fade-in duration-200"
            role="presentation"
        >
            {/* 배경 딤 */}
            <div
                className="absolute inset-0 bg-black/50 backdrop-blur-sm cursor-pointer"
                onClick={onClose}
                aria-hidden="true"
            />
            {/* 바텀시트 패널 */}
            <div
                className="relative w-full max-w-md bg-white dark:bg-[#1a241b] rounded-t-3xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom duration-300"
                style={{ animationFillMode: "forwards" }}
            >
                <div className="p-6 pb-8 pt-8">
                    <div className="flex justify-center mb-4">
                        <div className="w-14 h-14 rounded-2xl bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center">
                            <Sparkles className="w-7 h-7 text-emerald-600 dark:text-emerald-400" />
                        </div>
                    </div>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white text-center mb-2">
                        취향을 알려주시면
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 text-center mb-6 leading-relaxed">
                        더 정확한 데이트 코스 추천을 받을 수 있어요
                    </p>
                    <div className="flex flex-col gap-3">
                        <button
                            onClick={handleGoToOnboarding}
                            className="w-full py-3.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm transition-colors active:scale-[0.98]"
                        >
                            취향 등록하러 가기
                        </button>
                        <button
                            onClick={onClose}
                            className="w-full py-3 px-4 rounded-xl text-gray-500 dark:text-gray-400 text-sm font-medium hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                        >
                            다음에 할게요
                        </button>
                    </div>
                </div>
                {/* Safe area padding for mobile */}
                <div className="h-[env(safe-area-inset-bottom)]" />
            </div>
        </div>
    );
}
