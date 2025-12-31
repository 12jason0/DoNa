// src/components/LayoutContent.tsx

"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import AppInstallQR from "@/components/AppInstallQR";
import DonaSplashFinal from "@/components/DonaSplashFinal";
import { getS3StaticUrl } from "@/lib/s3Static";

export default function LayoutContent({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const isEscapeIntroPage = pathname.startsWith("/escape/intro");
    const isEscapeId = pathname ? /^\/escape\/[^/]+$/.test(pathname) : false;
    const isCourseStart = pathname ? /^\/courses\/[^/]+\/start$/.test(pathname) : false;
    const [isQrOpen, setIsQrOpen] = useState(false);
    const [showSplash, setShowSplash] = useState(false);

    useEffect(() => {
        try {
            const key = "dona-splash-shown";
            const already = typeof window !== "undefined" ? sessionStorage.getItem(key) : "1";
            if (!already) setShowSplash(true);
        } catch {}
    }, []);

    const homepageBgUrl = getS3StaticUrl("homepage.png");

    return (
        <>
            <style>{`
                .homepage-bg-container {
                    background-image: none;
                }
                @media (min-width: 600px) {
                    .homepage-bg-container {
                        background-image: url('${homepageBgUrl}');
                        background-size: cover;
                        background-position: center;
                    }
                }
            `}</style>
            <div className="min-h-screen bg-white homepage-bg-container">
                <div className="h-screen min-[600px]:max-w-[1180px] min-[600px]:mx-auto min-[600px]:flex min-[600px]:items-stretch min-[600px]:gap-6">
                    {showSplash && (
                        <DonaSplashFinal
                            onDone={() => {
                                setShowSplash(false);
                                try {
                                    sessionStorage.setItem("dona-splash-shown", "1");
                                } catch {}
                            }}
                        />
                    )}
                    {/* 데스크톱용 좌측 다운로드 히어로 패널 */}
                    <section className="hidden min-[600px]:block relative w-[600px] h-full overflow-y-auto no-scrollbar">
                        <div className="absolute inset-0 bg-linear-to-r from-black/55 via-black/40 to-transparent" />
                        <div className="relative min-h-full flex flex-col justify-center">
                            <div className="px-10 max-w-[520px] text-white space-y-6">
                                {/* 1. 로고 및 앱 이름 */}
                                <div className="inline-block">
                                    <div className="w-32 h-32 p-4 flex items-center justify-center">
                                        <img
                                            src={getS3StaticUrl("logo/donalogo_512.png")}
                                            alt="DoNa Logo"
                                            className="w-full h-full object-contain"
                                            loading="lazy"
                                            decoding="async"
                                        />
                                    </div>
                                </div>

                                {/* 2. 메인 슬로건 */}
                                <h2 className="text-4xl font-extrabold leading-tight drop-shadow tracking-tight">
                                    우리의 데이트가 한 편의 이야기가 되다
                                </h2>

                                {/* 3. 부가 설명 */}
                                <div className="text-xl font-bold text-white/95">
                                    특별한 데이트 코스 추천부터 함께 채워나가는 스토리까지.
                                </div>

                                {/* 4. 상세 설명 */}
                                <p className="text-white/85 leading-relaxed text-sm">
                                    더 이상 똑같은 데이트는 그만. 전문가가 추천하는 테마별 코스로 색다른 하루를
                                    보내거나, 함께하는 모든 순간을 기록하며 세상에 단 하나뿐인 둘만의 이야기를
                                    완성해보세요.
                                </p>

                                {/* 5. 앱 다운로드 버튼 */}
                                <div className="flex items-center gap-4 pt-2">
                                    <a
                                        href="https://apps.apple.com/kr/app"
                                        target="_blank"
                                        rel="noreferrer"
                                        aria-label="App Store"
                                    >
                                        <span className="inline-flex items-center justify-center text-black shadow-md rounded-md">
                                            <img
                                                src="/images/Download_on_the_App_Store_Badge_KR_RGB_blk_100317.svg"
                                                alt="App Store"
                                                className="h-9 min-[600px]:h-11 w-auto object-contain"
                                            />
                                        </span>
                                    </a>
                                    <a
                                        href="https://play.google.com/store/apps"
                                        target="_blank"
                                        rel="noreferrer"
                                        aria-label="Google Play"
                                    >
                                        <span className="inline-flex items-center justify-center text-black shadow-md rounded-md">
                                            <img
                                                src="/images/GetItOnGooglePlay_Badge_Web_color_Korean.png"
                                                alt="Google Play"
                                                className="h-11 min-[600px]:h-[52px] w-auto object-contain"
                                            />
                                        </span>
                                    </a>
                                    <div
                                        onClick={() => setIsQrOpen(true)}
                                        className="ml-2 px-3 py-4 rounded-lg bg-white/15 border border-white/25 text-xs hover:bg-white/25 transition-colors cursor-pointer"
                                    >
                                        QR 코드
                                    </div>
                                </div>

                                {/* 6. 사업자 정보 (토스 심사용 - 데스크탑 히어로 하단 배치) */}
                                <div className="mt-12 pt-8 border-t border-white/20 space-y-2 opacity-80">
                                    <h3 className="text-lg font-bold mb-3 text-white">사업자 정보</h3>
                                    <div className="grid grid-cols-1 gap-1.5 text-[13px] text-white/90">
                                        <p>
                                            <strong>상호:</strong> (주)두나 (DoNa)
                                        </p>
                                        <p>
                                            <strong>대표자명:</strong> 오승용
                                        </p>
                                        <p>
                                            <strong>사업자등록번호:</strong> 166-10-03081
                                        </p>
                                        <p>
                                            <strong>통신판매업 신고번호:</strong> 제 2025-충남홍성-0193 호
                                        </p>
                                        <p>
                                            <strong>고객센터:</strong> 12jason@donacourse.com
                                        </p>
                                        <p>
                                            <strong>유선번호:</strong> 010-2271-9824
                                        </p>
                                        <p>
                                            <strong>주소 : </strong> 충청남도 홍성군 홍북읍 신대로 33
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </section>

                    {isQrOpen && (
                        <div
                            className="fixed inset-0 z-100 bg-black/60 backdrop-blur-sm"
                            onClick={() => setIsQrOpen(false)}
                        >
                            <div className="absolute inset-0 flex items-center justify-center p-4">
                                <div onClick={(e) => e.stopPropagation()}>
                                    <AppInstallQR onClose={() => setIsQrOpen(false)} />
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="relative h-full bg-white min-[600px]:w-[500px] min-[600px]:border-l border-gray-100 flex flex-col">
                        <div className={`${isEscapeIntroPage || isCourseStart ? "hidden" : "block"} shrink-0`}>
                            <Header />
                        </div>
                        <main className="flex-1 overflow-y-auto overscroll-contain no-scrollbar scrollbar-hide">
                            {children}
                        </main>
                        <div className={`${isEscapeId || isCourseStart ? "hidden" : "block"} shrink-0`}>
                            <Footer />
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
