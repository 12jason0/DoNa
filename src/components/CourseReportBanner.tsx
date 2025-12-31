"use client";

import { useState } from "react";
import KakaoChannelModal from "./KakaoChannelModal";

export default function CourseReportBanner() {
    const [showKakaoModal, setShowKakaoModal] = useState(false);

    // 🟢 2030 감성을 자극하는 고감도 감성 사진 (Unsplash)
    const bannerImageUrl = "https://images.unsplash.com/photo-1554118811-1e0d58224f24?q=80&w=1200&auto=format&fit=crop";

    return (
        <>
            <div className="group cursor-pointer mb-8" onClick={() => setShowKakaoModal(true)}>
                {/* 1. 이미지 섹션: 실제 코스 카드와 완벽히 동일한 프레임 유지 */}
                <div className="relative w-full aspect-4/3 rounded-[24px] overflow-hidden bg-gray-200 shadow-sm border border-gray-100">
                    <img
                        src={bannerImageUrl}
                        alt="Join us"
                        className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                    />

                    {/* 세련된 다크 오버레이 (가독성 확보) */}
                    <div className="absolute inset-0 bg-black/30 group-hover:bg-black/40 transition-colors" />

                    {/* 카드 중앙 텍스트: 잡지 레이아웃 스타일 */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6">
                        <span className="text-white/80 text-[10px] tracking-[0.2em] font-bold mb-2 uppercase">
                            Exclusive Invitation
                        </span>
                        <h2 className="text-white text-xl md:text-2xl font-black leading-tight drop-shadow-sm">
                            당신만 알고 있는
                            <br />
                            비밀의 장소가 있나요?
                        </h2>
                        <div className="mt-4 w-8 h-px bg-white/50" />
                    </div>

                    {/* 왼쪽 상단 배지: 'Spot Wanted' */}
                    <div className="absolute top-4 left-4">
                        <div className="px-2.5 py-1 bg-black/20 backdrop-blur-md rounded-full border border-white/30">
                            <span className="text-[10px] font-bold text-white uppercase tracking-wider">
                                Spot Wanted
                            </span>
                        </div>
                    </div>
                </div>

                {/* 2. 하단 정보 섹션: 버튼 중심이 아닌 '메시지' 중심으로 구성 */}
                <div className="mt-3 px-1">
                    <div className="flex justify-between items-end">
                        <div className="flex-1">
                            <h3 className="text-[17px] font-black text-gray-900 tracking-tight leading-tight">
                                장소를 제보하고 <span className="text-emerald-600">무료 코스</span>를 열어보세요
                            </h3>
                            <p className="text-[13px] text-gray-500 mt-1 font-medium">
                                선정된 장소는 '두나'의 공식 코스로 등록됩니다 ✨
                            </p>
                        </div>

                        {/* 🟢 카카오 버튼: 블랙 톤으로 세련되게 변경 (저작권 준수) */}
                        <button className="shrink-0 h-11 px-4 bg-gray-900 text-white rounded-full flex items-center gap-2 hover:bg-black transition-all active:scale-95 shadow-lg">
                            <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                                <path d="M12 3C5.373 3 0 6.663 0 11.182C0 14.07 1.83 16.63 4.67 18.11C4.54 18.57 3.82 21.05 3.77 21.23C3.73 21.46 3.98 21.58 4.15 21.46C4.19 21.43 7.84 18.96 8.35 18.63C9.52 18.82 10.74 18.92 12 18.92C18.627 18.92 24 15.257 24 10.738C24 6.219 18.627 3 12 3Z" />
                            </svg>
                            <span className="text-[13px] font-bold">제보하기</span>
                        </button>
                    </div>
                </div>
            </div>

            {showKakaoModal && <KakaoChannelModal onClose={() => setShowKakaoModal(false)} />}
        </>
    );
}
