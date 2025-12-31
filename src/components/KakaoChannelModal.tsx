"use client";

import { useRouter } from "next/navigation";
import { X, ChevronRight } from "lucide-react"; // lucide-react 아이콘 사용 (없으면 heroicons 등 대체 가능)
import Image from "next/image";

interface KakaoChannelModalProps {
    onClose: () => void;
}

export default function KakaoChannelModal({ onClose }: KakaoChannelModalProps) {
    const router = useRouter();

    const handleKakaoChannel = () => {
        window.open("https://pf.kakao.com/_uxnZHn/chat", "_blank");
        onClose();
    };

    return (
        <div className="fixed inset-0 z-100 flex items-center justify-center p-4">
            {/* 배경: 진중한 느낌의 어두운 오버레이 */}
            <div
                className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-in fade-in duration-300"
                onClick={onClose}
            />

            {/* 모달 본문: 넓고 시원한 레이아웃, 단단한 쉐입 */}
            <div className="relative w-full max-w-[380px] bg-white rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-2 duration-300 z-10 flex flex-col">
                {/* 1. 상단 이미지 영역 (Commercial Vibe) */}
                {/* 실제 이미지가 있다면 src에 경로를 넣어주세요. 없으면 은은한 패턴 배경이 나옵니다. */}
                <div className="relative h-48 w-full bg-slate-100 flex items-center justify-center overflow-hidden">
                    {/* (옵션) 실제 이미지 사용 시 주석 해제 */}
                    {/* <Image src="/images/event-bg.jpg" alt="이벤트" fill className="object-cover" /> */}

                    {/* 이미지가 없을 때를 대비한 모던한 그래픽 패턴 */}
                    <div className="absolute inset-0 bg-linear-to-br from-emerald-500/10 to-teal-500/5" />
                    <div className="text-center z-10">
                        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white shadow-sm mb-3">
                            <span className="text-3xl">☕️</span>
                        </div>
                        <p className="text-xs font-bold text-emerald-600 tracking-wider uppercase">Event Promotion</p>
                    </div>

                    {/* 닫기 버튼 (이미지 위에 오버레이) */}
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 p-2 bg-white/50 hover:bg-white rounded-full transition-colors backdrop-blur-md"
                    >
                        <X className="w-5 h-5 text-gray-700" />
                    </button>
                </div>

                {/* 2. 컨텐츠 영역: 깔끔하고 직관적인 정보 전달 */}
                <div className="p-7 flex flex-col items-center text-center">
                    <h2 className="text-2xl font-bold text-gray-900 mb-2 leading-tight">
                        숨겨진 맛집 제보하고
                        <br />
                        <span className="text-emerald-600">스타벅스 커피</span> 받기
                    </h2>

                    <p className="text-[15px] text-gray-500 leading-relaxed mb-8 max-w-[280px]">
                        나만 아는 데이트 장소를 공유해주세요.
                        <br />
                        매주 추첨을 통해 선물을 드립니다.
                    </p>

                    {/* 3. 액션 버튼: Flat하고 단단한 디자인 (Solid UI) */}
                    <button
                        onClick={handleKakaoChannel}
                        className="w-full py-4 px-4 bg-[#FAE100] hover:bg-[#FCE620] text-[#371D1E] rounded-xl font-bold text-[16px] flex items-center justify-center gap-2 transition-all active:scale-[0.99]"
                    >
                        {/* 카카오 심볼 (SVG) */}
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 3c-4.97 0-9 3.185-9 7.115 0 2.557 1.707 4.8 4.27 6.054-.188.702-.682 2.545-.78 2.94-.122.49.178.483.376.351.155-.103 2.48-1.7 3.48-2.378.525.076 1.065.115 1.614.115 4.97 0 9-3.185 9-7.115S16.97 3 12 3z" />
                        </svg>
                        <span>카카오톡으로 제보하기</span>
                    </button>

                    {/* 보조 버튼: 텍스트 링크 스타일 */}
                    <button
                        onClick={onClose}
                        className="mt-4 text-sm text-gray-400 hover:text-gray-600 underline decoration-1 underline-offset-4 transition-colors"
                    >
                        다음에 참여할게요
                    </button>
                </div>
            </div>
        </div>
    );
}
