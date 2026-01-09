"use client";

import { useState } from "react";
import KakaoChannelModal from "./KakaoChannelModal";

export default function CourseReportBanner() {
    const [showKakaoModal, setShowKakaoModal] = useState(false);

    return (
        <>
            {/* 🟢 제공된 이미지의 시그니처 녹색을 배경으로 적용한 카드 */}
            <div
                // bg-[#74c38a]: 이미지에서 추출한 녹색 코드 적용
                className="group relative overflow-hidden rounded-2xl bg-[#74c38a] p-5 text-white shadow-md hover:shadow-lg transition-all duration-300 cursor-pointer active:scale-[0.98]"
                onClick={() => setShowKakaoModal(true)}
            >
                {/* 배경 패턴: 은은한 빛 반사 효과 추가 */}
                <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/10 blur-2xl" />
                <div className="absolute -bottom-4 -left-4 h-20 w-20 rounded-full bg-white/5 blur-xl" />

                <div className="relative z-10 flex flex-col gap-3">
                    {/* 상단 배지: 반투명 화이트 배경 유지 */}
                    <div className="flex items-center gap-2">
                        <div className="px-2.5 py-1 bg-white/20 backdrop-blur-sm rounded-full border border-white/30">
                            <span className="text-[10px] font-bold text-white uppercase tracking-wider">
                                Spot Wanted
                            </span>
                        </div>
                    </div>

                    {/* 메인 콘텐츠 */}
                    <div className="flex flex-col gap-2.5">
                        <h3 className="text-lg font-black leading-tight tracking-tight">
                            당신만 알고 있는
                            <br />
                            비밀의 장소가 있나요?
                        </h3>
                        {/* 서브 텍스트: 녹색 배경 위에서도 잘 보이도록 조정 */}
                        <p className="text-xs font-medium text-white/90 leading-relaxed">
                            장소를 제보하고 추첨을 통해 쿠폰를 받아보세요 ✨
                        </p>
                    </div>

                    {/* 액션 버튼: 텍스트 색상을 배경색과 맞춰 일체감 부여 */}
                    <button
                        // text-[#74c38a]: 버튼 텍스트 색상을 배경색과 동일하게 설정
                        className="mt-1 w-fit rounded-full bg-white px-5 py-2.5 text-xs font-bold text-[#74c38a] shadow-sm hover:shadow-md transition-all active:scale-95 flex items-center gap-2"
                        onClick={(e) => {
                            e.stopPropagation();
                            setShowKakaoModal(true);
                        }}
                    >
                        <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                            <path d="M12 3C5.373 3 0 6.663 0 11.182C0 14.07 1.83 16.63 4.67 18.11C4.54 18.57 3.82 21.05 3.77 21.23C3.73 21.46 3.98 21.58 4.15 21.46C4.19 21.43 7.84 18.96 8.35 18.63C9.52 18.82 10.74 18.92 12 18.92C18.627 18.92 24 15.257 24 10.738C24 6.219 18.627 3 12 3Z" />
                        </svg>
                        <span>지금 제보하기</span>
                    </button>
                </div>
            </div>

            {showKakaoModal && <KakaoChannelModal onClose={() => setShowKakaoModal(false)} />}
        </>
    );
}
