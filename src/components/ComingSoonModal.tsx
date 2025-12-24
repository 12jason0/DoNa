"use client";

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";

interface ComingSoonModalProps {
    onClose: () => void;
}

export default function ComingSoonModal({ onClose }: ComingSoonModalProps) {
    const [mounted, setMounted] = useState(false);
    const [hasNotification, setHasNotification] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // 🟢 사용자가 이미 NEW_ESCAPE 알림을 신청했는지 확인
    useEffect(() => {
        const checkNotificationStatus = async () => {
            try {
                // 🟢 쿠키 기반 인증: authenticatedFetch 사용
                const { authenticatedFetch } = await import("@/lib/authClient");
                const data = await authenticatedFetch("/api/users/notifications/interests");
                
                if (!data) {
                    setIsLoading(false);
                    return;
                }

                // 🟢 notification_interests 테이블에서 NEW_ESCAPE 확인
                const interestRes = { ok: true, json: async () => data };
                
                if (interestRes.ok) {
                    const data = await interestRes.json();
                    const hasNewEscape = data?.interests?.some(
                        (item: any) => item.topic === "NEW_ESCAPE"
                    );
                    setHasNotification(hasNewEscape || false);
                }
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
        return () => {
            setMounted(false);
            document.body.style.overflow = "unset";
        };
    }, []);

    const handleNotification = async () => {
        setIsSubmitting(true);
        try {
            const token = localStorage.getItem("authToken");
            if (!token) {
                alert("로그인이 필요합니다.");
                setIsSubmitting(false);
                return;
            }

            // 🟢 NEW_ESCAPE 알림 신청 API 호출
            const res = await fetch("/api/users/notifications/consent", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ topics: ["NEW_ESCAPE"] }),
            });

            if (res.ok) {
                setHasNotification(true);
        alert("오픈 알림이 신청되었습니다! 🔔");
        onClose();
            } else {
                const data = await res.json();
                alert(data.error || "알림 신청에 실패했습니다.");
            }
        } catch (error) {
            console.error("알림 신청 실패:", error);
            alert("알림 신청 중 오류가 발생했습니다.");
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!mounted) return null;

    return createPortal(
        <div
            className="fixed inset-0 bg-black/40 flex items-center justify-center z-[9999] p-4 animate-fade-in"
            onClick={onClose}
        >
            <div
                className="bg-white rounded-xl border border-gray-100 w-full max-w-[300px] p-6 text-center transform transition-all animate-scale-up"
                onClick={(e) => e.stopPropagation()}
            >
                {/* 아이콘 영역: 룰렛 -> 잠금(Lock) 아이콘으로 변경 */}
                <div className="w-16 h-16 mx-auto mb-5 bg-[#7aa06f]/10 rounded-full flex items-center justify-center">
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={1.8}
                        stroke="currentColor"
                        className="w-7 h-7 text-[#7aa06f]"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
                        />
                    </svg>
                </div>

                {/* 텍스트 영역 */}
                <h3 className="text-xl font-bold text-gray-900 mb-2 tracking-tight">오픈 준비 중이에요</h3>
                <p className="text-[15px] text-gray-500 leading-relaxed mb-6 break-keep">
                    새로운 실외 방탈출 코스를
                    <br />
                    열심히 만들고 있어요.
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
                            {isSubmitting ? "처리 중..." : "오픈 알림 받기"}
                    </button>
                    )}

                    {/* 🟢 이미 알림을 신청한 경우 안내 메시지 */}
                    {!isLoading && hasNotification && (
                        <div className="w-full py-3.5 rounded-lg bg-emerald-50 text-emerald-700 text-[15px] font-bold flex items-center justify-center gap-2 tracking-tight border border-emerald-200">
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
                            알림 신청 완료
                        </div>
                    )}

                    <button
                        onClick={onClose}
                        className="w-full py-2 text-xs text-gray-400 font-medium hover:text-gray-600 transition-colors underline decoration-gray-200 underline-offset-4 cursor-pointer"
                    >
                        닫기
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}
