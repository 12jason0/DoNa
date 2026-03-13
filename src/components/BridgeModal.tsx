"use client";

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Lock } from "lucide-react";
import { BASIC_MONTHLY_PRICE } from "@/constants/subscription";
import { useAppLayout, ANDROID_MODAL_BOTTOM } from "@/context/AppLayoutContext";
import { useLocale } from "@/context/LocaleContext";
import { useNativeModalNotify } from "@/hooks/useNativeModalNotify";

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
    const { t, locale, isLocaleReady } = useLocale();
    const { containInPhone, modalContainerRef, isAndroidApp } = useAppLayout();
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

    useNativeModalNotify(true);

    const handleProceed = () => {
        setOpenSubscriptionAfterLogin();
        onClose();
        onProceedToLogin();
    };

    if (!mounted) return null;

    const priceFormatted = BASIC_MONTHLY_PRICE.toLocaleString(
        locale === "ko" ? "ko-KR" : locale === "ja" ? "ja-JP" : "en-US",
    );

    const posClass = containInPhone ? "absolute" : "fixed";
    const portalTarget = containInPhone && modalContainerRef?.current ? modalContainerRef.current : document.body;

    const modalContent = (
        <div
            className={`${posClass} inset-0 bg-black/70 dark:bg-black/80 backdrop-blur-md z-9999 animate-in fade-in duration-300 flex items-end justify-center`}
            onClick={onClose}
            aria-hidden
        >
            <div
                className={`${posClass} left-0 right-0 z-10000 w-full pointer-events-auto ${!isAndroidApp ? "bottom-3" : ""} ${containInPhone ? "max-h-[85%]" : "max-h-[90vh]"}`}
                style={isAndroidApp ? { bottom: ANDROID_MODAL_BOTTOM } : undefined}
                onClick={(e) => e.stopPropagation()}
            >
                <div
                    className="bg-white dark:bg-[#1a241b] rounded-t-[32px] border-t border-gray-100 dark:border-gray-800 w-full max-h-full overflow-y-auto shadow-[0_20px_50px_rgba(0,0,0,0.2)] scrollbar-hide transition-transform duration-300 ease-out"
                    style={{
                        transform: slideUp ? "translateY(0)" : "translateY(100%)",
                    }}
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="p-6 sm:p-8 relative pb-[calc(1rem+env(safe-area-inset-bottom))]">
                        <button
                            onClick={onClose}
                            aria-label={t("bridgeModal.close")}
                            className="absolute top-5 right-5 w-8 h-8 rounded-full bg-gray-50 dark:bg-gray-800 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 flex items-center justify-center z-20"
                        >
                            ×
                        </button>

                        {!isLocaleReady ? (
                            <div className="flex items-center justify-center py-16">
                                <div className="animate-spin rounded-full h-8 w-8 border-2 border-emerald-600 border-t-transparent" />
                            </div>
                        ) : (
                            <>
                                <div className="text-center mb-6">
                                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-900/30 mb-4">
                                        <Lock className="w-6 h-6 text-amber-600 dark:text-amber-400" />
                                    </div>
                                    <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
                                        {t("bridgeModal.title")}
                                    </h2>
                                    {/* 🟢 990원 유료팁 옵션 (4,900 구독 위에) */}
                                    <button
                                        onClick={handleProceed}
                                        className="w-full py-3.5 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-base shadow-lg transition-all active:scale-[0.98] flex items-center justify-center gap-2 mb-4"
                                    >
                                        <Lock className="w-4 h-4 shrink-0" />
                                        <span className="whitespace-pre-line text-center">{t("bridgeModal.tipsUnlockCta")}</span>
                                    </button>
                                    {/* 4,900원 구독 안내 */}
                                    <p className="text-[15px] text-gray-600 dark:text-gray-400 leading-relaxed whitespace-pre-line mb-4">
                                        {t("bridgeModal.desc")}{" "}
                                        <strong className="text-gray-900 dark:text-white">
                                            {t("bridgeModal.priceUnit", { price: priceFormatted })}
                                        </strong>
                                        {t("bridgeModal.desc2")}
                                    </p>

                                    <button
                                        onClick={handleProceed}
                                        className="w-full py-3.5 rounded-full bg-gray-900 dark:bg-gray-800 hover:bg-gray-800 dark:hover:bg-gray-700 text-white font-bold text-base shadow-lg transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                                    >
                                        <Lock className="w-4 h-4" />
                                        {t("bridgeModal.cta")}
                                    </button>

                                    <p className="mt-3 text-center text-xs text-gray-500 dark:text-gray-400">
                                        {t("bridgeModal.cancelHint")}
                                    </p>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );

    return createPortal(modalContent, portalTarget);
}
