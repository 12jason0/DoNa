"use client";

import { useState } from "react";
import { useLocale } from "@/context/LocaleContext";

interface BenefitConsentModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function BenefitConsentModal({ isOpen, onClose }: BenefitConsentModalProps) {
    const { t, isLocaleReady } = useLocale();
    const [selected, setSelected] = useState<string[]>(["COURSE", "NEW_ESCAPE"]);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const toggleTopic = (topic: string) => {
        setSelected((prev) => (prev.includes(topic) ? prev.filter((t) => t !== topic) : [...prev, topic]));
    };

    // 🟢 다음날 한국 시간 00시 계산 함수
    const getNextDayMidnightKST = (): string => {
        const now = new Date();
        // 한국 시간으로 변환 (UTC+9)
        const kstOffset = 9 * 60 * 60 * 1000;
        const kstNow = new Date(now.getTime() + kstOffset);
        
        // 다음날 00시로 설정 (KST 기준)
        const nextDayKST = new Date(kstNow);
        nextDayKST.setUTCDate(nextDayKST.getUTCDate() + 1);
        nextDayKST.setUTCHours(0, 0, 0, 0);
        
        // UTC로 변환하여 ISO 문자열로 반환 (저장용)
        const nextDayUTC = new Date(nextDayKST.getTime() - kstOffset);
        return nextDayUTC.toISOString();
    };

    const handleLater = () => {
        // 🟢 다음날 한국 시간 00시를 localStorage에 저장
        const nextDayMidnight = getNextDayMidnightKST();
        if (typeof window !== "undefined") {
            localStorage.setItem("benefitConsentModalHideUntil", nextDayMidnight);
        }
        onClose();
    };

    const handleConfirm = async () => {
        if (selected.length === 0) {
            alert(t("benefitConsentModal.alertSelectOne"));
            return;
        }

        setIsSubmitting(true);

        // 🟢 Optimistic update: UI를 먼저 닫아서 빠른 반응성 제공
        // API 호출은 백그라운드에서 진행
        const originalOnClose = onClose;
        onClose();

        try {
            // 🟢 성능 최적화: apiFetch 사용하여 빠른 응답 처리
            const { apiFetch } = await import("@/lib/authClient");
            const { data, response } = await apiFetch<any>("/api/users/notifications/consent", {
                method: "POST",
                body: JSON.stringify({ topics: selected }),
                // 🟢 캐시 없이 최신 데이터 처리
                cache: "no-store",
            });

            if (response.ok) {
                // 🟢 알림 상태 변경 이벤트 dispatch (마이페이지 UI 즉시 업데이트용)
                if (typeof window !== "undefined") {
                    window.dispatchEvent(
                        new CustomEvent("notificationUpdated", { detail: { subscribed: true } })
                    );
                }
            } else {
                // ❌ 실패 시 사용자에게 알림 (모달은 이미 닫혀있음)
                console.error("알림 동의 처리 실패:", data?.error);
                // 실패 시 나중에 다시 표시할 수 있도록 처리 (필요시)
            }
        } catch (error) {
            console.error("알림 동의 처리 오류:", error);
            // 에러는 콘솔에만 기록 (UI는 이미 닫혀있음)
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-9999 flex items-center justify-center p-6 bg-black/60 dark:bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-[#1a241b] rounded-[2.5rem] p-8 max-w-[360px] w-full shadow-2xl animate-in zoom-in-95 duration-300">
                {!isLocaleReady ? (
                    <div className="flex items-center justify-center py-16">
                        <div className="animate-spin rounded-full h-8 w-8 border-2 border-emerald-600 border-t-transparent" />
                    </div>
                ) : (
                <>
                <div className="text-center mb-6">
                    <span className="text-4xl">💌</span>
                    <h2 className="text-xl font-extrabold text-gray-900 dark:text-white mt-4 leading-tight tracking-tight whitespace-pre-line">
                        {t("benefitConsentModal.title")}
                    </h2>
                </div>

                <div className="space-y-3 mb-8">
                    <button
                        onClick={() => toggleTopic("COURSE")}
                        disabled={isSubmitting}
                        className={`w-full flex items-center justify-between p-4 rounded-2xl border-2 transition-all ${
                            selected.includes("COURSE")
                                ? "border-emerald-500 dark:border-emerald-600 bg-emerald-50 dark:bg-emerald-900/30"
                                : "border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-[#0f1710] opacity-60 dark:opacity-80"
                        } ${isSubmitting ? "opacity-50 cursor-not-allowed" : "hover:opacity-80 active:scale-[0.98]"}`}
                    >
                        <div className="flex items-center gap-3">
                            <span className="text-xl">📍</span>
                            <div className="text-left">
                                <p className="font-bold text-gray-900 dark:text-white text-sm tracking-tight">{t("benefitConsentModal.topicCourse")}</p>
                                <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-relaxed">
                                    {t("benefitConsentModal.topicCourseDesc")}
                                </p>
                            </div>
                        </div>
                        {selected.includes("COURSE") && (
                            <div className="w-5 h-5 bg-emerald-500 dark:bg-emerald-600 rounded-full flex items-center justify-center text-white text-[10px] font-bold">
                                ✓
                            </div>
                        )}
                    </button>

                    <button
                        onClick={() => toggleTopic("NEW_ESCAPE")}
                        disabled={isSubmitting}
                        className={`w-full flex items-center justify-between p-4 rounded-2xl border-2 transition-all ${
                            selected.includes("NEW_ESCAPE")
                                ? "border-emerald-500 dark:border-emerald-600 bg-emerald-50 dark:bg-emerald-900/30"
                                : "border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-[#0f1710] opacity-60 dark:opacity-80"
                        } ${isSubmitting ? "opacity-50 cursor-not-allowed" : "hover:opacity-80 active:scale-[0.98]"}`}
                    >
                        <div className="flex items-center gap-3">
                            <span className="text-xl">🔑</span>
                            <div className="text-left">
                                <p className="font-bold text-gray-900 dark:text-white text-sm tracking-tight">{t("benefitConsentModal.topicEscape")}</p>
                                <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-relaxed">
                                    {t("benefitConsentModal.topicEscapeDesc")}
                                </p>
                            </div>
                        </div>
                        {selected.includes("NEW_ESCAPE") && (
                            <div className="w-5 h-5 bg-emerald-500 dark:bg-emerald-600 rounded-full flex items-center justify-center text-white text-[10px] font-bold">
                                ✓
                            </div>
                        )}
                    </button>
                </div>

                <div className="space-y-3">
                    <button
                        onClick={handleConfirm}
                        disabled={isSubmitting || selected.length === 0}
                        className="w-full py-4 bg-gray-900 dark:bg-slate-800 text-white rounded-2xl font-bold text-[16px] shadow-lg active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:bg-black dark:hover:bg-slate-700"
                    >
                        {isSubmitting ? t("benefitConsentModal.submitting") : t("benefitConsentModal.cta")}
                    </button>
                    <button
                        onClick={handleLater}
                        disabled={isSubmitting}
                        className="w-full text-gray-400 dark:text-gray-500 text-[13px] font-medium py-2 hover:text-gray-600 dark:hover:text-gray-400 transition-colors disabled:opacity-50"
                    >
                        {t("benefitConsentModal.later")}
                    </button>
                </div>

                <p className="mt-6 text-[10px] text-gray-300 dark:text-gray-500 text-center leading-tight whitespace-pre-line">
                    {t("benefitConsentModal.footer")}
                </p>
                </>
                )}
            </div>
        </div>
    );
}
