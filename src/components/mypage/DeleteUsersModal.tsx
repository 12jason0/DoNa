"use client";

import React, { useState } from "react";
import { useLocale } from "@/context/LocaleContext";

interface DeleteUsersModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (withdrawalReason?: string) => Promise<void>;
    subscriptionTier?: string;
    subscriptionExpiresAt?: string | null;
}

const REASON_KEYS = ["reason0", "reason1", "reason2", "reason3", "reason4", "reason5"] as const;

export default function DeleteUsersModal({
    isOpen,
    onClose,
    onConfirm,
    subscriptionTier,
    subscriptionExpiresAt,
}: DeleteUsersModalProps) {
    const { t, isLocaleReady } = useLocale();
    const [isLoading, setIsLoading] = useState(false);
    const [showReasonStep, setShowReasonStep] = useState(false);
    const [selectedReason, setSelectedReason] = useState<string>("");
    const [customReason, setCustomReason] = useState<string>("");
    const [isAgreed, setIsAgreed] = useState(false);

    if (!isOpen) return null;

    const handleConfirm = async () => {
        try {
            if (showReasonStep && !isAgreed) {
                alert(t("deleteUsersModal.alertAgree"));
                return;
            }

            setIsLoading(true);

            const hasActiveSubscription =
                subscriptionTier &&
                subscriptionTier !== "FREE" &&
                subscriptionExpiresAt &&
                new Date(subscriptionExpiresAt) > new Date();

            if (hasActiveSubscription) {
                if (!window.confirm(t("deleteUsersModal.confirmSubscription"))) {
                    setIsLoading(false);
                    return;
                }
            }

            if (!showReasonStep) {
                setShowReasonStep(true);
                setIsLoading(false);
                return;
            }

            const withdrawalReason = selectedReason === "reason5" ? customReason : t(`deleteUsersModal.${selectedReason}` as "deleteUsersModal.reason0");
            await onConfirm(withdrawalReason);
        } catch (error: any) {
            console.error("탈퇴 처리 오류:", error);
            alert(error.message || t("deleteUsersModal.alertError"));
        } finally {
            setIsLoading(false);
        }
    };

    const donaGreen = "#00C73C";

    return (
        // [수정] inset-0과 items-center justify-center로 화면 정중앙 배치
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-2000 p-4 sm:p-6">
            {/* [수정] max-h-[90dvh]와 flex-col로 스크롤 가능하게 구성 */}
            <div className="bg-white rounded-2rem shadow-2xl overflow-hidden w-full max-w-[400px] flex flex-col max-h-[90dvh] animate-in zoom-in-95 duration-200">
                {/* 상단 장식 바 */}
                <div style={{ backgroundColor: donaGreen }} className="h-2 w-full shrink-0" />

                {/* [수정] overflow-y-auto를 적용한 스크롤 영역 */}
                <div className="p-6 sm:p-8 overflow-y-auto flex-1 custom-scrollbar">
                    {!isLocaleReady ? (
                        <div className="flex items-center justify-center py-16">
                            <div className="animate-spin rounded-full h-8 w-8 border-2 border-emerald-600 border-t-transparent" />
                        </div>
                    ) : (
                    <>
                    <div className="text-center mb-6">
                        <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-4">
                            <span className="text-3xl">🍃</span>
                        </div>
                        <h3 className="text-2xl font-black text-gray-900 tracking-tighter leading-tight">
                            {t("deleteUsersModal.title")}
                        </h3>
                    </div>

                    {/* 안내 정보 카드 */}
                    <div className="bg-gray-50 rounded-2xl p-5 mb-6 text-left border border-gray-100 space-y-4">
                        <div className="flex items-start gap-3">
                            <span className="text-lg">⚠️</span>
                            <div>
                                <p className="text-sm font-bold text-gray-800">{t("deleteUsersModal.warn1Title")}</p>
                                <p className="text-xs text-gray-500 leading-relaxed">
                                    {t("deleteUsersModal.warn1Desc")}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-start gap-3">
                            <span className="text-lg">⚖️</span>
                            <div>
                                <p className="text-sm font-bold text-gray-800">{t("deleteUsersModal.warn2Title")}</p>
                                <p className="text-xs text-gray-500 leading-relaxed">
                                    {t("deleteUsersModal.warn2Desc")}
                                </p>
                                <ul className="text-xs text-gray-500 leading-relaxed mt-1 ml-2 list-disc list-inside">
                                    <li>{t("deleteUsersModal.warn2Li1")}</li>
                                    <li>{t("deleteUsersModal.warn2Li2")}</li>
                                </ul>
                                <p className="text-xs text-gray-500 leading-relaxed mt-1">
                                    {t("deleteUsersModal.warn2Footer")}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* 2단계: 사유 선택 및 동의 */}
                    {showReasonStep && (
                        <div className="bg-blue-50 rounded-2xl p-5 mb-2 text-left border border-blue-100 animate-in slide-in-from-bottom-2">
                            <p className="text-sm font-bold text-blue-800 mb-3">{t("deleteUsersModal.reasonTitle")}</p>
                            <div className="space-y-2 mb-4">
                                {REASON_KEYS.map((key) => (
                                    <label key={key} className="flex items-center gap-2 cursor-pointer p-1">
                                        <input
                                            type="radio"
                                            name="reason"
                                            value={key}
                                            checked={selectedReason === key}
                                            onChange={(e) => setSelectedReason(e.target.value)}
                                            className="w-4 h-4 accent-[#00C73C]"
                                        />
                                        <span className="text-xs text-gray-700">{t(`deleteUsersModal.${key}` as const)}</span>
                                    </label>
                                ))}
                            </div>

                            {selectedReason === "reason5" && (
                                <textarea
                                    value={customReason}
                                    onChange={(e) => setCustomReason(e.target.value)}
                                    placeholder={t("deleteUsersModal.reasonOtherPlaceholder")}
                                    className="w-full p-3 text-xs text-black border bg-white border-blue-200 rounded-xl resize-none mb-4 focus:ring-1 focus:ring-blue-400 outline-none"
                                    rows={3}
                                />
                            )}

                            <label className="flex items-start gap-2 pt-4 border-t border-blue-200 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={isAgreed}
                                    onChange={(e) => setIsAgreed(e.target.checked)}
                                    className="mt-1 accent-[#00C73C]"
                                />
                                <span className="text-xs text-gray-600 font-medium leading-tight">
                                    {t("deleteUsersModal.agreeLabel")}
                                </span>
                            </label>
                        </div>
                    )}
                    </>
                    )}
                </div>

                {/* 버튼 영역 (하단 고정) */}
                {isLocaleReady && (
                <div className="p-6 pt-2 bg-white flex flex-col gap-3 shrink-0">
                    <button
                        onClick={onClose}
                        disabled={isLoading}
                        style={{ backgroundColor: donaGreen }}
                        className="w-full py-4 rounded-2xl text-white font-bold text-lg shadow-lg hover:brightness-105 active:scale-[0.98] transition-all disabled:opacity-50"
                    >
                        {t("deleteUsersModal.stay")}
                    </button>
                    <button
                        onClick={handleConfirm}
                        disabled={isLoading || (showReasonStep && !isAgreed)}
                        className={`w-full py-2 font-semibold text-sm transition-colors
                            ${showReasonStep ? "text-red-500" : "text-gray-400 hover:text-red-500"}`}
                    >
                        {isLoading
                            ? t("deleteUsersModal.submitting")
                            : showReasonStep
                            ? t("deleteUsersModal.deleteAccount")
                            : t("deleteUsersModal.withdraw")}
                    </button>
                </div>
                )}
            </div>
        </div>
    );
}
