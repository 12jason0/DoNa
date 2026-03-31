"use client";

import { useState, useRef, useEffect } from "react";
import { X } from "lucide-react";
import { useAppLayout, ANDROID_MODAL_BOTTOM } from "@/context/AppLayoutContext";
import { useLocale } from "@/context/LocaleContext";

const DRAG_CLOSE_THRESHOLD = 60;

interface BenefitConsentModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function BenefitConsentModal({ isOpen, onClose }: BenefitConsentModalProps) {
    const { t, isLocaleReady } = useLocale();
    const { containInPhone, isAndroidApp, iosIgnoreSafeAreaBottom } = useAppLayout();
    const posClass = containInPhone ? "absolute" : "fixed";
    const [selected, setSelected] = useState<string[]>(["COURSE", "NEW_ESCAPE"]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [slideUp, setSlideUp] = useState(false);
    const [dragY, setDragY] = useState(0);
    const [isDragging, setIsDragging] = useState(false);
    const startYRef = useRef(0);
    const pointerIdRef = useRef<number | null>(null);
    const dragYRef = useRef(0);

    const getClientY = (e: React.TouchEvent | React.PointerEvent) =>
        "touches" in e ? e.touches[0]?.clientY : e.clientY;

    const onDragStart = (clientY: number, pointerId?: number) => {
        startYRef.current = clientY;
        pointerIdRef.current = pointerId ?? null;
    };
    const onDragMove = (clientY: number) => {
        const dy = Math.max(0, clientY - startYRef.current);
        dragYRef.current = dy;
        if (dy > 0) setIsDragging(true);
        setDragY(dy);
    };
    const onDragEnd = () => {
        if (dragYRef.current > DRAG_CLOSE_THRESHOLD) onClose();
        else {
            dragYRef.current = 0;
            setDragY(0);
        }
        setIsDragging(false);
        pointerIdRef.current = null;
    };

    const toggleTopic = (topic: string) => {
        setSelected((prev) => (prev.includes(topic) ? prev.filter((x) => x !== topic) : [...prev, topic]));
    };

    const getNextDayMidnightKST = (): string => {
        const now = new Date();
        const kstOffset = 9 * 60 * 60 * 1000;
        const kstNow = new Date(now.getTime() + kstOffset);
        const nextDayKST = new Date(kstNow);
        nextDayKST.setUTCDate(nextDayKST.getUTCDate() + 1);
        nextDayKST.setUTCHours(0, 0, 0, 0);
        const nextDayUTC = new Date(nextDayKST.getTime() - kstOffset);
        return nextDayUTC.toISOString();
    };

    const handleLater = () => {
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
        onClose();

        try {
            const { apiFetch } = await import("@/lib/authClient");
            const { data, response } = await apiFetch<any>("/api/users/notifications/consent", {
                method: "POST",
                body: JSON.stringify({ topics: selected }),
                cache: "no-store",
            });

            if (response.ok) {
                if (typeof window !== "undefined") {
                    window.dispatchEvent(new CustomEvent("notificationUpdated", { detail: { subscribed: true } }));
                }
            } else {
                console.error("알림 동의 처리 실패:", data?.error);
            }
        } catch (error) {
            console.error("알림 동의 처리 오류:", error);
        } finally {
            setIsSubmitting(false);
        }
    };

    useEffect(() => {
        if (!isOpen) return;
        document.body.style.overflow = "hidden";
        setSlideUp(false);
        setDragY(0);
        dragYRef.current = 0;
        const id = requestAnimationFrame(() => {
            requestAnimationFrame(() => setSlideUp(true));
        });
        return () => {
            cancelAnimationFrame(id);
            document.body.style.overflow = "";
        };
    }, [isOpen]);

    if (!isOpen) return null;

    return (
        <div
            className={`${posClass} inset-0 z-9999 flex items-end justify-center bg-black/60 dark:bg-black/80 backdrop-blur-sm animate-in fade-in duration-200`}
            onClick={onClose}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === "Escape" && onClose()}
            aria-label={t("common.close")}
        >
            <div
                className={`${posClass} left-0 right-0 bottom-0 z-10000 w-full overflow-hidden rounded-t-2xl bg-white dark:bg-[#1a241b] shadow-2xl ${containInPhone ? "max-h-[85%]" : "max-h-[calc(100dvh-env(safe-area-inset-top,0px))]"} ${!isDragging && slideUp ? "transition-transform duration-300 ease-out" : ""}`}
                style={{
                    transform: slideUp ? (dragY > 0 ? `translateY(${dragY}px)` : "translateY(0)") : "translateY(100%)",
                    ...(iosIgnoreSafeAreaBottom ? { bottom: 0 } : isAndroidApp ? { bottom: ANDROID_MODAL_BOTTOM } : {}),
                }}
                onClick={(e) => e.stopPropagation()}
            >
                <div className="relative flex shrink-0 flex-col items-center pt-3 pb-2">
                    <div
                        role="button"
                        tabIndex={0}
                        aria-label={t("benefitConsentModal.dragToClose")}
                        className="w-12 h-1.5 rounded-full bg-gray-200 dark:bg-gray-700 touch-none cursor-grab active:cursor-grabbing select-none"
                        onTouchStart={(e) => onDragStart(getClientY(e))}
                        onTouchMove={(e) => onDragMove(getClientY(e))}
                        onTouchEnd={() => onDragEnd()}
                        onPointerDown={(e) => {
                            e.preventDefault();
                            onDragStart(e.clientY, e.pointerId);
                            (e.target as HTMLElement).setPointerCapture(e.pointerId);
                        }}
                        onPointerMove={(e) => {
                            if (pointerIdRef.current === e.pointerId) onDragMove(e.clientY);
                        }}
                        onPointerUp={(e) => {
                            if (pointerIdRef.current === e.pointerId) {
                                onDragEnd();
                                (e.target as HTMLElement).releasePointerCapture(e.pointerId);
                            }
                        }}
                        onPointerCancel={(e) => {
                            if (pointerIdRef.current === e.pointerId) {
                                onDragEnd();
                                try {
                                    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
                                } catch {
                                    /* ignore */
                                }
                            }
                        }}
                        onKeyDown={(e) => e.key === "Enter" && onClose()}
                    />
                    <button
                        type="button"
                        onClick={onClose}
                        className="absolute right-3 top-1 p-1.5 bg-gray-50 dark:bg-gray-800 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                        aria-label={t("common.close")}
                    >
                        <X className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                    </button>
                </div>

                <div
                    className={`max-h-[min(72vh,calc(100dvh-8rem))] overflow-y-auto px-5 max-w-lg mx-auto w-full ${iosIgnoreSafeAreaBottom ? "pb-8" : "pb-[max(1.5rem,env(safe-area-inset-bottom,0px))]"}`}
                >
                    {!isLocaleReady ? (
                        <div className="flex items-center justify-center py-16">
                            <div className="animate-spin rounded-full h-8 w-8 border-2 border-emerald-600 border-t-transparent" />
                        </div>
                    ) : (
                        <>
                            <div className="text-center mb-6">
                                <span className="text-4xl">💌</span>
                                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mt-4 leading-tight tracking-tight whitespace-pre-line">
                                    {t("benefitConsentModal.title")}
                                </h2>
                            </div>

                            <div className="space-y-3 mb-8">
                                <button
                                    type="button"
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
                                            <p className="font-medium text-gray-900 dark:text-white text-sm tracking-tight">
                                                {t("benefitConsentModal.topicCourse")}
                                            </p>
                                            <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-relaxed">
                                                {t("benefitConsentModal.topicCourseDesc")}
                                            </p>
                                        </div>
                                    </div>
                                    {selected.includes("COURSE") && (
                                        <div className="w-5 h-5 bg-emerald-500 dark:bg-emerald-600 rounded-full flex items-center justify-center text-white text-[10px] font-medium">
                                            ✓
                                        </div>
                                    )}
                                </button>

                                <button
                                    type="button"
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
                                            <p className="font-medium text-gray-900 dark:text-white text-sm tracking-tight">
                                                {t("benefitConsentModal.topicEscape")}
                                            </p>
                                            <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-relaxed">
                                                {t("benefitConsentModal.topicEscapeDesc")}
                                            </p>
                                        </div>
                                    </div>
                                    {selected.includes("NEW_ESCAPE") && (
                                        <div className="w-5 h-5 bg-emerald-500 dark:bg-emerald-600 rounded-full flex items-center justify-center text-white text-[10px] font-medium">
                                            ✓
                                        </div>
                                    )}
                                </button>
                            </div>

                            <div className="space-y-3">
                                <button
                                    type="button"
                                    onClick={handleConfirm}
                                    disabled={isSubmitting || selected.length === 0}
                                    className="w-full py-4 bg-gray-900 dark:bg-slate-800 text-white rounded-2xl font-semibold text-[16px] shadow-lg active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:bg-black dark:hover:bg-slate-700"
                                >
                                    {isSubmitting ? t("benefitConsentModal.submitting") : t("benefitConsentModal.cta")}
                                </button>
                                <button
                                    type="button"
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
        </div>
    );
}
