"use client";

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Lock } from "lucide-react";
import { BASIC_MONTHLY_PRICE } from "@/constants/subscription";

const AUTH_OPEN_SUBSCRIPTION_KEY = "auth:openSubscriptionAfterLogin";

export function setOpenSubscriptionAfterLogin() {
    if (typeof window !== "undefined") {
        sessionStorage.setItem(AUTH_OPEN_SUBSCRIPTION_KEY, "1");
    }
}

export function checkAndClearOpenSubscriptionAfterLogin(): boolean {
    if (typeof window === "undefined") return false;
    const val = sessionStorage.getItem(AUTH_OPEN_SUBSCRIPTION_KEY);
    if (val) {
        sessionStorage.removeItem(AUTH_OPEN_SUBSCRIPTION_KEY);
        return true;
    }
    return false;
}

interface BridgeModalProps {
    onClose: () => void;
    onProceedToLogin: () => void;
}

export default function BridgeModal({ onClose, onProceedToLogin }: BridgeModalProps) {
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

    const handleProceed = () => {
        setOpenSubscriptionAfterLogin();
        onClose();
        onProceedToLogin();
    };

    if (!mounted) return null;

    const priceFormatted = BASIC_MONTHLY_PRICE.toLocaleString("ko-KR");

    const modalContent = (
        <>
            <div
                className="fixed inset-0 bg-black/70 dark:bg-black/80 backdrop-blur-md z-9999 animate-in fade-in duration-300"
                onClick={onClose}
                aria-hidden
            />
            <div
                className="fixed left-0 right-0 bottom-0 z-10000 w-full max-h-[90vh]"
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
                        <button
                            onClick={onClose}
                            aria-label="닫기"
                            className="absolute top-5 right-5 w-8 h-8 rounded-full bg-gray-50 dark:bg-gray-800 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 flex items-center justify-center z-20"
                        >
                            ×
                        </button>

                        <div className="text-center mb-6">
                            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-900/30 mb-4">
                                <Lock className="w-6 h-6 text-amber-600 dark:text-amber-400" />
                            </div>
                            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
                                멤버십 전용 시크릿 정보입니다
                            </h2>
                            <p className="text-[15px] text-gray-600 dark:text-gray-400 leading-relaxed">
                                지금 가입하고{" "}
                                <strong className="text-gray-900 dark:text-white">월 {priceFormatted}원</strong>으로
                                <br />
                                서울 코스 핫플 공략집 무제한 보기
                            </p>
                        </div>

                        <button
                            onClick={handleProceed}
                            className="w-full py-3.5 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-base shadow-lg transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                        >
                            <Lock className="w-4 h-4" />
                            3초 만에 로그인하고 잠금 해제
                        </button>

                        <p className="mt-3 text-center text-xs text-gray-500 dark:text-gray-400">
                            첫 달은 언제든 해지 가능해요
                        </p>
                    </div>
                </div>
            </div>
        </>
    );

    return createPortal(modalContent, document.body);
}
