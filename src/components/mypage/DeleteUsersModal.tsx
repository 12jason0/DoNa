"use client";

import React, { useState } from "react";

interface DeleteUsersModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (withdrawalReason?: string) => Promise<void>;
    subscriptionTier?: string;
    subscriptionExpiresAt?: string | null;
}

const WITHDRAWAL_REASONS = [
    "기능이 불편해요",
    "원하는 콘텐츠가 없어요",
    "다른 앱을 사용하게 되었어요",
    "사용 빈도가 낮아요",
    "개인정보 보호가 걱정돼요",
    "기타",
];

export default function DeleteUsersModal({
    isOpen,
    onClose,
    onConfirm,
    subscriptionTier,
    subscriptionExpiresAt,
}: DeleteUsersModalProps) {
    const [isLoading, setIsLoading] = useState(false);
    const [showReasonStep, setShowReasonStep] = useState(false);
    const [selectedReason, setSelectedReason] = useState<string>("");
    const [customReason, setCustomReason] = useState<string>("");
    const [isAgreed, setIsAgreed] = useState(false);

    if (!isOpen) return null;

    const handleConfirm = async () => {
        try {
            if (showReasonStep && !isAgreed) {
                alert("안내사항을 확인하고 동의해주세요.");
                return;
            }

            setIsLoading(true);

            const hasActiveSubscription =
                subscriptionTier &&
                subscriptionTier !== "FREE" &&
                subscriptionExpiresAt &&
                new Date(subscriptionExpiresAt) > new Date();

            if (hasActiveSubscription) {
                if (
                    !window.confirm(
                        "현재 유료 구독 중입니다. 탈퇴 시 환불이 어려울 수 있습니다. 정말 탈퇴하시겠습니까?"
                    )
                ) {
                    setIsLoading(false);
                    return;
                }
            }

            if (!showReasonStep) {
                setShowReasonStep(true);
                setIsLoading(false);
                return;
            }

            const withdrawalReason = selectedReason === "기타" ? customReason : selectedReason;
            await onConfirm(withdrawalReason);
        } catch (error: any) {
            console.error("탈퇴 처리 오류:", error);
            alert(error.message || "탈퇴 처리 중 오류가 발생했습니다.");
        } finally {
            setIsLoading(false);
        }
    };

    const donaGreen = "#00C73C";

    return (
        // [수정] inset-0과 items-center justify-center로 화면 정중앙 배치
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[2000] p-4 sm:p-6">
            {/* [수정] max-h-[90dvh]와 flex-col로 스크롤 가능하게 구성 */}
            <div className="bg-white rounded-[2rem] shadow-2xl overflow-hidden w-full max-w-[400px] flex flex-col max-h-[90dvh] animate-in zoom-in-95 duration-200">
                {/* 상단 장식 바 */}
                <div style={{ backgroundColor: donaGreen }} className="h-2 w-full flex-shrink-0" />

                {/* [수정] overflow-y-auto를 적용한 스크롤 영역 */}
                <div className="p-6 sm:p-8 overflow-y-auto flex-1 custom-scrollbar">
                    <div className="text-center mb-6">
                        <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-4">
                            <span className="text-3xl">🍃</span>
                        </div>
                        <h3 className="text-2xl font-black text-gray-900 tracking-tighter leading-tight">
                            정말 두나를 떠나시나요?
                        </h3>
                    </div>

                    {/* 안내 정보 카드 */}
                    <div className="bg-gray-50 rounded-2xl p-5 mb-6 text-left border border-gray-100 space-y-4">
                        <div className="flex items-start gap-3">
                            <span className="text-lg">⚠️</span>
                            <div>
                                <p className="text-sm font-bold text-gray-800">모든 기록 삭제 및 복구 불가</p>
                                <p className="text-xs text-gray-500 leading-relaxed">
                                    프로필 정보, 찜한 코스, 작성한 리뷰 등 모든 데이터가 즉시 파기됩니다.
                                </p>
                            </div>
                        </div>
                        <div className="flex items-start gap-3">
                            <span className="text-lg">⚖️</span>
                            <div>
                                <p className="text-sm font-bold text-gray-800">법적 데이터 보관 안내</p>
                                <p className="text-xs text-gray-500 leading-relaxed">
                                    관계 법령에 따라 일부 데이터는 법정 보관 기간 동안 보관됩니다.
                                </p>
                                <ul className="text-xs text-gray-500 leading-relaxed mt-1 ml-2 list-disc list-inside">
                                    <li>결제 기록: 전자상거래법에 따라 5년 보관</li>
                                    <li>로그인 기록: 통신비밀보호법에 따라 3개월 보관</li>
                                </ul>
                                <p className="text-xs text-gray-500 leading-relaxed mt-1">
                                    보관 기간 경과 후 자동으로 파기됩니다.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* 2단계: 사유 선택 및 동의 */}
                    {showReasonStep && (
                        <div className="bg-blue-50 rounded-2xl p-5 mb-2 text-left border border-blue-100 animate-in slide-in-from-bottom-2">
                            <p className="text-sm font-bold text-blue-800 mb-3">떠나시는 이유가 궁금해요 💭</p>
                            <div className="space-y-2 mb-4">
                                {WITHDRAWAL_REASONS.map((r) => (
                                    <label key={r} className="flex items-center gap-2 cursor-pointer p-1">
                                        <input
                                            type="radio"
                                            name="reason"
                                            value={r}
                                            checked={selectedReason === r}
                                            onChange={(e) => setSelectedReason(e.target.value)}
                                            className="w-4 h-4 accent-[#00C73C]"
                                        />
                                        <span className="text-xs text-gray-700">{r}</span>
                                    </label>
                                ))}
                            </div>

                            {selectedReason === "기타" && (
                                <textarea
                                    value={customReason}
                                    onChange={(e) => setCustomReason(e.target.value)}
                                    placeholder="이유를 자유롭게 적어주세요..."
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
                                    안내사항을 확인하였으며, 데이터 파기 및 소셜 연동 해제에 동의합니다.
                                </span>
                            </label>
                        </div>
                    )}
                </div>

                {/* 버튼 영역 (하단 고정) */}
                <div className="p-6 pt-2 bg-white flex flex-col gap-3 flex-shrink-0">
                    <button
                        onClick={onClose}
                        disabled={isLoading}
                        style={{ backgroundColor: donaGreen }}
                        className="w-full py-4 rounded-2xl text-white font-bold text-lg shadow-lg hover:brightness-105 active:scale-[0.98] transition-all disabled:opacity-50"
                    >
                        아니요, 더 써볼래요!
                    </button>
                    <button
                        onClick={handleConfirm}
                        disabled={isLoading || (showReasonStep && !isAgreed)}
                        className={`w-full py-2 font-semibold text-sm transition-colors
                            ${showReasonStep ? "text-red-500" : "text-gray-400 hover:text-red-500"}`}
                    >
                        {isLoading
                            ? "처리 중..."
                            : showReasonStep
                            ? "계정 영구 삭제하기"
                            : "모든 혜택 포기하고 탈퇴하기"}
                    </button>
                </div>
            </div>
        </div>
    );
}
