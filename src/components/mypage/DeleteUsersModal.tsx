"use client";

import React, { useState } from "react";

interface DeleteUsersModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => Promise<void>;
}

export default function DeleteUsersModal({ isOpen, onClose, onConfirm }: DeleteUsersModalProps) {
    const [isLoading, setIsLoading] = useState(false);

    if (!isOpen) return null;

    const handleConfirm = async () => {
        try {
            setIsLoading(true);
            await onConfirm();
        } catch (error) {
            console.error("탈퇴 처리 오류:", error);
        } finally {
            setIsLoading(false);
        }
    };

    // 시그니처 녹색: #00C73C (임의 설정, 실제 브랜드 컬러 코드로 변경 가능)
    const donaGreen = "#00C73C";

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[2000] animate-in fade-in duration-300 p-4">
            <div className="bg-white rounded-[2rem] shadow-2xl overflow-hidden w-full max-w-[360px] transform transition-all animate-in zoom-in-95 duration-300">
                {/* 상단 장식 바: 브랜드 컬러 강조 */}
                <div style={{ backgroundColor: donaGreen }} className="h-2 w-full" />

                <div className="p-8">
                    <div className="text-center">
                        {/* 아이콘: 더 부드러운 느낌의 원형 디자인 */}
                        <div className="flex justify-center mb-6">
                            <div className="w-20 h-20 rounded-full bg-green-50 flex items-center justify-center animate-pulse">
                                <span className="text-4xl">🍃</span>
                            </div>
                        </div>

                        <h3 className="text-2xl font-black text-gray-900 mb-2 tracking-tighter">
                            정말 두나를 떠나시나요?
                        </h3>
                        <p className="text-gray-500 text-sm mb-8 font-medium">
                            회원님과 함께한 소중한 기록들이 사라져요.
                        </p>

                        {/* 통합 경고 카드: 상업적인 깔끔한 디자인 */}
                        <div className="bg-gray-50 rounded-2xl p-5 mb-8 text-left border border-gray-100">
                            <div className="flex items-start gap-3 mb-3">
                                <span className="text-lg">⚠️</span>
                                <div>
                                    <p className="text-sm font-bold text-gray-800">모든 기록 삭제</p>
                                    <p className="text-xs text-gray-500 leading-relaxed">
                                        이용 기록 및 개인정보가 즉시 삭제되며 복구가 불가능합니다.
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-start gap-3">
                                <span className="text-lg">🎁</span>
                                <div>
                                    <p className="text-sm font-bold text-gray-800">혜택 및 쿠폰 소멸</p>
                                    <p className="text-xs text-gray-500 leading-relaxed">
                                        보유 중인 모든 쿠폰과 리워드가 즉시 사라집니다.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-col gap-3">
                        {/* 취소 버튼: 브랜드 컬러(녹색)를 사용하여 잔존 유도 (가장 강조) */}
                        <button
                            onClick={onClose}
                            disabled={isLoading}
                            style={{ backgroundColor: donaGreen }}
                            className="w-full py-4 rounded-2xl text-white font-bold text-lg shadow-lg shadow-green-100 hover:brightness-105 active:scale-[0.98] transition-all disabled:opacity-50"
                        >
                            아니요, 더 써볼래요!
                        </button>

                        {/* 탈퇴 버튼: 눈에 덜 띄는 텍스트 형태나 연한 배경색으로 배치 */}
                        <button
                            onClick={handleConfirm}
                            disabled={isLoading}
                            className="w-full py-3 text-gray-400 font-semibold text-sm hover:text-red-500 transition-colors disabled:opacity-50"
                        >
                            {isLoading ? "처리 중..." : "모든 혜택 포기하고 탈퇴하기"}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
