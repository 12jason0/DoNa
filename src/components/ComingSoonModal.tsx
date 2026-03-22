"use client";

import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useAppLayout, ANDROID_MODAL_BOTTOM } from "@/context/AppLayoutContext";
import { useLocale } from "@/context/LocaleContext";

const DRAG_CLOSE_THRESHOLD = 60;

interface ComingSoonModalProps {
    onClose: () => void;
}

export default function ComingSoonModal({ onClose }: ComingSoonModalProps) {
    const { t, isLocaleReady } = useLocale();
    const { containInPhone, modalContainerRef, isAndroidApp, iosIgnoreSafeAreaBottom } = useAppLayout();
    const [mounted, setMounted] = useState(false);
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
        else setDragY(0);
        setIsDragging(false);
        pointerIdRef.current = null;
    };

    const [hasNotification, setHasNotification] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // 🟢 사용자가 이미 NEW_ESCAPE 알림을 신청했는지 확인
    useEffect(() => {
        const checkNotificationStatus = async () => {
            try {
                // 🟢 쿠키 기반 인증: apiFetch 사용 (401 시 로그아웃하지 않도록)
                const { apiFetch } = await import("@/lib/authClient");
                const { data, response } = await apiFetch<any>("/api/users/notifications/interests");

                // 401이거나 데이터가 없으면 알림 신청 안 한 것으로 간주
                if (response.status === 401 || !data) {
                    setIsLoading(false);
                    return;
                }

                // 🟢 notification_interests 테이블에서 NEW_ESCAPE 확인
                const hasNewEscape = data?.interests?.some((item: any) => item.topic === "NEW_ESCAPE");
                setHasNotification(hasNewEscape || false);
            } catch (error) {
                console.error("알림 상태 확인 실패:", error);
            } finally {
                setIsLoading(false);
            }
        };

        checkNotificationStatus();
    }, []);

    useEffect(() => {
        setMounted(true);
        document.body.style.overflow = "hidden";
        const t = requestAnimationFrame(() => {
            requestAnimationFrame(() => setSlideUp(true));
        });
        return () => {
            cancelAnimationFrame(t);
            setMounted(false);
            document.body.style.overflow = "unset";
        };
    }, []);

    const handleNotification = async () => {
        setIsSubmitting(true);
        try {
            // 🟢 쿠키 기반 인증: 로그인 여부 확인
            const { fetchSession } = await import("@/lib/authClient");
            const session = await fetchSession();

            if (!session.authenticated) {
                alert(t("comingSoonModal.alertLoginRequired"));
                setIsSubmitting(false);
                return;
            }

            // 🟢 NEW_ESCAPE 알림 신청 API 호출 (쿠키 기반)
            const { apiFetch } = await import("@/lib/authClient");
            const { data, response } = await apiFetch<any>("/api/users/notifications/consent", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ topics: ["NEW_ESCAPE"] }),
            });

            if (response.ok) {
                setHasNotification(true);
                alert(t("comingSoonModal.alertSuccess"));
                onClose();
            } else {
                const errorMsg = data?.error || t("comingSoonModal.alertFail");
                alert(errorMsg);
            }
        } catch (error) {
            console.error("알림 신청 실패:", error);
            alert(t("comingSoonModal.alertError"));
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!mounted) return null;

    const posClass = containInPhone ? "absolute" : "fixed";
    const portalTarget = containInPhone && modalContainerRef?.current ? modalContainerRef.current : document.body;

    return createPortal(
        <div
            className={`${posClass} inset-0 bg-black/40 dark:bg-black/70 flex flex-col justify-end z-9999 animate-in fade-in duration-200`}
            onClick={onClose}
        >
            <div
                className={`${posClass} left-0 right-0 w-full flex justify-center ${!iosIgnoreSafeAreaBottom && !isAndroidApp ? "bottom-3" : ""}`}
                style={
                    isAndroidApp
                        ? { bottom: ANDROID_MODAL_BOTTOM }
                        : iosIgnoreSafeAreaBottom
                          ? { bottom: 0 }
                          : undefined
                }
            >
                <div
                    className={`bg-white dark:bg-[#1a241b] rounded-t-2xl border-t border-x border-gray-100 dark:border-gray-800 w-full max-w-lg mx-auto p-6 text-center ${iosIgnoreSafeAreaBottom ? "pb-6" : "pb-[calc(1.5rem+env(safe-area-inset-bottom))]"} ${!isDragging ? "transition-transform duration-300 ease-out" : ""}`}
                    style={{
                        transform: slideUp ? (dragY > 0 ? `translateY(${dragY}px)` : "translateY(0)") : "translateY(100%)",
                    }}
                    onClick={(e) => e.stopPropagation()}
                >
                {/* 하단 시트 그랩버: 아래로 스와이프 시 모달 닫힘 */}
                <div
                    role="button"
                    tabIndex={0}
                    aria-label={t("comingSoonModal.dragToClose")}
                    className="w-12 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full mx-auto mb-5 touch-none cursor-grab active:cursor-grabbing"
                    onTouchStart={(e) => {
                        onDragStart(getClientY(e));
                    }}
                    onTouchMove={(e) => {
                        onDragMove(getClientY(e));
                    }}
                    onTouchEnd={() => {
                        onDragEnd();
                    }}
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
                />
                {!isLocaleReady ? (
                    <div className="flex items-center justify-center py-16">
                        <div className="animate-spin rounded-full h-8 w-8 border-2 border-emerald-600 border-t-transparent" />
                    </div>
                ) : (
                    <>
                        {/* 아이콘 영역: 룰렛 -> 잠금(Lock) 아이콘으로 변경 */}
                        <div className="w-16 h-16 mx-auto mb-5 bg-[#7aa06f]/10 dark:bg-emerald-900/30 rounded-full flex items-center justify-center">
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                fill="none"
                                viewBox="0 0 24 24"
                                strokeWidth={1.8}
                                stroke="currentColor"
                                className="w-7 h-7 text-[#7aa06f] dark:text-emerald-400"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
                                />
                            </svg>
                        </div>

                        {/* 텍스트 영역 */}
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2 tracking-tight">
                            {t("comingSoonModal.title")}
                        </h3>
                        <p className="text-[15px] text-gray-500 dark:text-gray-400 leading-relaxed mb-6 break-keep whitespace-pre-line">
                            {t("comingSoonModal.desc")}
                        </p>

                        {/* 버튼 영역: 알림 받기(강조) + 닫기(보조) */}
                        <div className="space-y-3">
                            {/* 🟢 이미 알림을 신청한 경우 버튼 숨김 */}
                            {!isLoading && !hasNotification && (
                                <button
                                    onClick={handleNotification}
                                    disabled={isSubmitting}
                                    style={{ backgroundColor: "#7aa06f" }}
                                    className="w-full py-3.5 rounded-lg text-white text-[15px] font-bold hover:brightness-95 active:scale-[0.96] transition-all flex items-center justify-center gap-2 tracking-tight disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {/* 알림 종 아이콘 추가 */}
                                    <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        viewBox="0 0 20 20"
                                        fill="currentColor"
                                        className="w-4 h-4"
                                    >
                                        <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z" />
                                    </svg>
                                    {isSubmitting ? t("comingSoonModal.submitting") : t("comingSoonModal.cta")}
                                </button>
                            )}

                            {/* 🟢 이미 알림을 신청한 경우 안내 메시지 */}
                            {!isLoading && hasNotification && (
                                <div className="w-full py-3.5 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-[15px] font-bold flex items-center justify-center gap-2 tracking-tight border border-emerald-200 dark:border-emerald-800/50">
                                    <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        viewBox="0 0 20 20"
                                        fill="currentColor"
                                        className="w-4 h-4"
                                    >
                                        <path
                                            fillRule="evenodd"
                                            d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                                            clipRule="evenodd"
                                        />
                                    </svg>
                                    {t("comingSoonModal.completed")}
                                </div>
                            )}

                            <button
                                onClick={onClose}
                                className="w-full py-2 text-xs text-gray-400 dark:text-gray-500 font-medium hover:text-gray-600 dark:hover:text-gray-400 transition-colors underline decoration-gray-200 dark:decoration-gray-700 underline-offset-4 cursor-pointer"
                            >
                                {t("common.close")}
                            </button>
                        </div>
                    </>
                )}
                </div>
            </div>
        </div>,
        portalTarget,
    );
}
