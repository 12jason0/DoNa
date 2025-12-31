"use client";

import { useState } from "react";

interface BenefitConsentModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function BenefitConsentModal({ isOpen, onClose }: BenefitConsentModalProps) {
    const [selected, setSelected] = useState<string[]>(["COURSE", "NEW_ESCAPE"]);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const toggleTopic = (topic: string) => {
        setSelected((prev) => (prev.includes(topic) ? prev.filter((t) => t !== topic) : [...prev, topic]));
    };

    const handleConfirm = async () => {
        if (selected.length === 0) {
            alert("받으실 혜택을 하나 이상 선택해주세요!");
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

            if (!response.ok) {
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
        <div className="fixed inset-0 z-9999 flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-[2.5rem] p-8 max-w-[360px] w-full shadow-2xl animate-in zoom-in-95 duration-300">
                <div className="text-center mb-6">
                    <span className="text-4xl">💌</span>
                    <h2 className="text-xl font-extrabold text-gray-900 mt-4 leading-tight tracking-tight">
                        두나의 특별한 혜택,
                        <br />
                        어떤 소식을 드릴까요?
                    </h2>
                </div>

                <div className="space-y-3 mb-8">
                    <button
                        onClick={() => toggleTopic("COURSE")}
                        disabled={isSubmitting}
                        className={`w-full flex items-center justify-between p-4 rounded-2xl border-2 transition-all ${
                            selected.includes("COURSE")
                                ? "border-emerald-500 bg-emerald-50"
                                : "border-gray-100 bg-gray-50 opacity-60"
                        } ${isSubmitting ? "opacity-50 cursor-not-allowed" : "hover:opacity-80 active:scale-[0.98]"}`}
                    >
                        <div className="flex items-center gap-3">
                            <span className="text-xl">📍</span>
                            <div className="text-left">
                                <p className="font-bold text-gray-900 text-sm tracking-tight">새로운 데이트 코스</p>
                                <p className="text-[11px] text-gray-500 leading-relaxed">
                                    취향 저격 코스가 올라오면 알림
                                </p>
                            </div>
                        </div>
                        {selected.includes("COURSE") && (
                            <div className="w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center text-white text-[10px] font-bold">
                                ✓
                            </div>
                        )}
                    </button>

                    <button
                        onClick={() => toggleTopic("NEW_ESCAPE")}
                        disabled={isSubmitting}
                        className={`w-full flex items-center justify-between p-4 rounded-2xl border-2 transition-all ${
                            selected.includes("NEW_ESCAPE")
                                ? "border-emerald-500 bg-emerald-50"
                                : "border-gray-100 bg-gray-50 opacity-60"
                        } ${isSubmitting ? "opacity-50 cursor-not-allowed" : "hover:opacity-80 active:scale-[0.98]"}`}
                    >
                        <div className="flex items-center gap-3">
                            <span className="text-xl">🔑</span>
                            <div className="text-left">
                                <p className="font-bold text-gray-900 text-sm tracking-tight">신규 Escape 오픈</p>
                                <p className="text-[11px] text-gray-500 leading-relaxed">
                                    새로운 실외 방탈출 오픈 즉시 알림
                                </p>
                            </div>
                        </div>
                        {selected.includes("NEW_ESCAPE") && (
                            <div className="w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center text-white text-[10px] font-bold">
                                ✓
                            </div>
                        )}
                    </button>
                </div>

                <div className="space-y-3">
                    <button
                        onClick={handleConfirm}
                        disabled={isSubmitting || selected.length === 0}
                        className="w-full py-4 bg-gray-900 text-white rounded-2xl font-bold text-[16px] shadow-lg active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isSubmitting ? "처리 중..." : "선택한 혜택 소식 받기"}
                    </button>
                    <button
                        onClick={onClose}
                        disabled={isSubmitting}
                        className="w-full text-gray-400 text-[13px] font-medium py-2 hover:text-gray-600 transition-colors disabled:opacity-50"
                    >
                        나중에 할게요
                    </button>
                </div>

                <p className="mt-6 text-[10px] text-gray-300 text-center leading-tight">
                    *혜택 선택 시 서비스 소식 수신을 위한
                    <br />
                    전체 푸시 알림 설정이 함께 활성화됩니다.
                </p>
            </div>
        </div>
    );
}
