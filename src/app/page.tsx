"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

// 두나 브랜드 컬러 및 에셋 (layout.tsx 참고함)
const BRAND_COLOR = "#7aa06f"; // 두나 그린
const LOGO_URL = "https://stylemap-seoul.s3.ap-northeast-2.amazonaws.com/logo/donalogo_512.png"; // 메타데이터에 있던 로고

// 배경 이미지 (밝고 따뜻한 느낌의 커플 사진 권장)
const bgImage = "/images/poster-bg.jpg";

const LandingPage = () => {
    const router = useRouter();
    const [showOnboarding, setShowOnboarding] = useState(false);

    // 핵심 경로 사전 로드로 전환 속도 향상
    useEffect(() => {
        try {
            router.prefetch("/courses");
            router.prefetch("/nearby");
            router.prefetch("/personalized-home");
            router.prefetch("/onboarding");
            router.prefetch("/login");
        } catch {}
    }, [router]);

    // 온보딩 미완료 상태 감지 (기존 이미지는 유지하고, 배너만 상단에 노출)
    useEffect(() => {
        const checkOnboarding = async () => {
            try {
                const token = localStorage.getItem("authToken");
                let prefs: { concept: string[]; mood: string[]; companion: string } = {
                    concept: [],
                    mood: [],
                    companion: "",
                };
                if (token) {
                    try {
                        const res = await fetch("/api/users/preferences", {
                            method: "GET",
                            headers: { Authorization: `Bearer ${token}` },
                        });
                        if (res.ok) {
                            const data = await res.json();
                            const raw = data?.preferences ?? data;
                            prefs = {
                                concept: Array.isArray(raw?.concept) ? raw.concept : [],
                                mood: Array.isArray(raw?.mood) ? raw.mood : [],
                                companion: typeof raw?.companion === "string" ? raw.companion : "",
                            };
                        }
                    } catch {}
                }
                const s1 = localStorage.getItem("onboardingStep1") === "1";
                const s2 = localStorage.getItem("onboardingStep2") === "1";
                const s3 = localStorage.getItem("onboardingStep3") === "1";

                const step1 = s1 || prefs.mood.length > 0 || prefs.concept.length > 0;
                const step2 = s2; // 2단계는 로컬 플래그로 판별
                const step3 = s3 || (prefs.companion ?? "") !== "";
                const complete = step1 && step2 && step3;
                setShowOnboarding(!complete);
            } catch {
                // ignore
            }
        };
        checkOnboarding();
    }, []);

    const handleStartOnboarding = () => {
        router.push("/onboarding");
    };

    return (
        // **********************************************
        // 1. [수정됨] min-h-screen -> h-screen (스크롤 방지)
        // **********************************************
        <div className="relative h-screen w-full flex flex-col font-sans overflow-hidden bg-white">
            {/* 1. 배경 레이어 (이미지를 흐릿하게 깔아서 분위기만 연출) */}
            <div className="absolute inset-0 z-0">
                <div className="absolute inset-0 bg-white/60 backdrop-blur-xl z-10" />
                <div className="relative w-full h-full">
                    <Image src={bgImage} alt="배경" fill className="object-cover opacity-80" priority />
                </div>
            </div>

            {/* 2. 메인 콘텐츠 (카드 UI 형태) */}
            {/* **********************************************
            // 2. [수정됨] py-10 -> py-4 (수직 패딩 최소화)
            // ********************************************** */}
            <main className="relative z-20 flex-1 flex flex-col justify-center items-center px-5 py-4">
                {/* 미션 카드 컨테이너 */}
                {/* **********************************************
                // 3. [수정됨] 카드 내부 패딩 p-8 -> p-6 (공간 확보)
                // ********************************************** */}
                <div className="w-full max-w-md bg-white/90 backdrop-blur-md rounded-[2.5rem] shadow-2xl border border-white/50 overflow-hidden flex flex-col items-center text-center p-6 animate-fade-in-up">
                    {/* 상단 로고 */}
                    <div className="w-16 h-16 rounded-3xl shadow-md overflow-hidden mb-4 bg-white flex items-center justify-center">
                        <Image src={LOGO_URL} alt="DoNa Logo" width={64} height={64} className="object-cover" />
                    </div>

                    {/* 뱃지 */}
                    <span className="inline-block py-1 px-3 rounded-full bg-[#7aa06f]/10 text-[#7aa06f] text-xs font-bold mb-4 tracking-tight">
                        💌 시크릿 초대장이 도착했습니다
                    </span>

                    {/* 메인 카피 */}
                    <h1 className="text-2xl md:text-3xl font-bold text-gray-800 leading-tight mb-3">
                        매번 똑같은 데이트,
                        <br />
                        <span style={{ color: BRAND_COLOR }}>지겹지 않으세요?</span>
                    </h1>

                    <p className="text-sm text-gray-500 leading-relaxed mb-6 break-keep">
                        우리 커플만을 위한 <br />
                        <span className="text-gray-800 font-semibold">AI 맞춤형 미션 데이트 코스</span>를<br />
                        지금 무료로 받아보세요.
                    </p>

                    {/* 이미지/일러스트 영역 (높이를 줄여 공간 확보) */}
                    <div className="w-full h-32 rounded-lg bg-gray-100 mb-6 relative overflow-hidden shadow-inner">
                        <Image
                            src="https://stylemap-seoul.s3.ap-northeast-2.amazonaws.com/sampleMap.png"
                            alt="코스 미리보기"
                            fill
                            className="object-cover hover:scale-105 transition-transform duration-500"
                        />
                    </div>

                    {/* CTA 버튼 (카카오) */}
                    <a
                        href="https://pf.kakao.com/_uxnZHn" // 👈 실제 링크 수정 필요
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full block"
                    >
                        <button className="w-full bg-[#FEE500] hover:bg-[#FDD835] text-[#3c1e1e] font-bold text-base py-3 rounded-xl shadow-lg hover:shadow-xl transition-all active:scale-98 flex items-center justify-center gap-2">
                            <svg
                                width="24"
                                height="24"
                                viewBox="0 0 24 24"
                                fill="none"
                                xmlns="http://www.w3.org/2000/svg"
                            >
                                <path
                                    fillRule="evenodd"
                                    clipRule="evenodd"
                                    d="M12 3C6.47715 3 2 6.58172 2 11C2 13.4623 3.38071 15.668 5.60757 17.124L4.65327 20.6397C4.52957 21.1067 4.97013 21.5218 5.41224 21.3355L8.95634 19.869C9.92108 20.1826 10.9426 20.3333 12 20.3333C17.5228 20.3333 22 16.7516 22 12.3333C22 7.91505 17.5228 3 12 3Z"
                                    fill="#3c1e1e"
                                />
                            </svg>
                            선착순 무료 코스 받기
                        </button>
                    </a>
                </div>
            </main>

            {/* 3. 푸터 (법적 정보) */}
            {/* **********************************************
            // 4. [수정됨] 푸터 패딩 py-6 -> py-3 (공간 확보)
            // ********************************************** */}
            <footer className="relative z-20 py-3 px-6 text-center text-[9px] text-gray-400 leading-relaxed">
                <div className="max-w-md mx-auto border-t border-gray-200 ">
                    <p className="font-bold text-gray-500 mb-1">(주)두나 (DoNa)</p>
                    <p>
                        대표: 오승용 | 사업자등록번호: 166-10-03081
                        <br />
                        주소: 충청남도 홍성군 홍북읍 신대로 33
                        <br />
                        고객센터: 12jason@naver.com
                    </p>
                </div>
            </footer>
        </div>
    );
};

export default LandingPage;
