"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import Image from "next/image"; // 🟢 img 대신 next/image 사용 (하이드레이션 오류 근본 해결)
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import AppInstallQR from "@/components/AppInstallQR";
import DonaSplashFinal from "@/components/DonaSplashFinal";
import { getS3StaticUrl } from "@/lib/s3Static";

export default function LayoutContent({ children }: { children: React.ReactNode }) {
    // ---------------------------------------------------------
    // 1. 모든 Hook은 반드시 최상단에 순서대로 선언 (Rules of Hooks)
    // ---------------------------------------------------------
    const pathname = usePathname();
    const [isQrOpen, setIsQrOpen] = useState(false);
    const [showSplash, setShowSplash] = useState(false);
    const [mounted, setMounted] = useState(false);
    const [contentReady, setContentReady] = useState(false);

    // 경로 변수들
    const isEscapeIntroPage = pathname.startsWith("/escape/intro");
    const isEscapeId = pathname ? /^\/escape\/[^/]+$/.test(pathname) : false;
    const isCourseStart = pathname ? /^\/courses\/[^/]+\/start$/.test(pathname) : false;
    const homepageBgUrl = getS3StaticUrl("homepage.png");

    // 🟢 Effect 1: 마운트 확인 및 세션 체크 (최초 1회)
    useEffect(() => {
        // 🟢 즉시 초록색 배경 설정하여 흰색 화면 방지
        document.body.style.backgroundColor = "#7FCC9F";

        setMounted(true);
        try {
            const already = sessionStorage.getItem("dona-splash-shown");
            if (!already) {
                setShowSplash(true);
            } else {
                // 스플래시가 필요 없으면 즉시 콘텐츠 준비
                setContentReady(true);
            }
        } catch (e) {
            console.error("sessionStorage access error:", e);
            setContentReady(true);
        }
    }, []);

    // 🟢 Effect 2: 바디 클래스 관리 및 배경색 전환
    useEffect(() => {
        if (!mounted) return;

        if (showSplash) {
            document.body.classList.add("splash-active");
            // 스플래시 중에는 초록색 배경 유지
            document.body.style.backgroundColor = "#7FCC9F";
        } else if (contentReady) {
            // 스플래시 종료 후 부드럽게 배경색 전환 (1초 딜레이로 자연스러운 전환)
            const timer = setTimeout(() => {
                document.body.classList.remove("splash-active");
                document.body.style.backgroundColor = "";
            }, 1000); // 스플래시 페이드아웃 완료 후 배경색 전환
            return () => clearTimeout(timer);
        }
    }, [showSplash, mounted, contentReady]);

    // ---------------------------------------------------------
    // 2. 조건부 렌더링 (Hook 선언이 모두 끝난 후 배치)
    // ---------------------------------------------------------

    // 🟢 하이드레이션 오류 방지: 서버와 클라이언트가 동일한 구조를 반환하도록 수정
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

            {!mounted ? (
                // 🟢 서버 렌더링 시: 마운트 전에는 빈 구조만 반환 (하이드레이션 일치)
                <div className="min-h-screen" style={{ backgroundColor: "#7FCC9F" }} />
            ) : (
                <>
                    {showSplash && (
                        <DonaSplashFinal
                            onDone={() => {
                                // 🟢 스플래시 종료 시 콘텐츠를 부드럽게 표시
                                setContentReady(true);
                                setTimeout(() => {
                                    setShowSplash(false);
                                    try {
                                        sessionStorage.setItem("dona-splash-shown", "1");
                                    } catch {}
                                }, 200); // 스플래시 페이드아웃과 동기화
                            }}
                        />
                    )}

                    {(!showSplash || contentReady) && (
                        <div
                            className="min-h-screen homepage-bg-container"
                            style={{
                                backgroundColor: showSplash || !contentReady ? "#7FCC9F" : "var(--background)",
                                transition: "opacity 0.6s ease-in-out, background-color 1s ease-in-out",
                                opacity: contentReady ? 1 : 0,
                            }}
                        >
                            <div className="h-screen lg:max-w-[1180px] lg:mx-auto lg:flex lg:items-stretch lg:gap-6">
                                {/* 데스크톱용 좌측 다운로드 히어로 패널 */}
                                <section className="hidden lg:block relative w-[600px] h-full overflow-y-auto no-scrollbar">
                                    <div className="absolute inset-0 bg-linear-to-r from-black/55 via-black/40 to-transparent" />
                                    <div className="relative min-h-full flex flex-col justify-center">
                                        <div className="px-10 max-w-[520px] text-white space-y-6">
                                            {/* 1. 로고 및 앱 이름 */}
                                            <div className="inline-block">
                                                <div className="w-32 h-32 p-4 flex items-center justify-center">
                                                    {/* 🟢 img 대신 Image 사용 + priority 부여로 하이드레이션 에러 완전 봉쇄 */}
                                                    <Image
                                                        src={getS3StaticUrl("logo/donalogo_512.png")}
                                                        alt="DoNa Logo"
                                                        width={128}
                                                        height={128}
                                                        priority
                                                        className="w-full h-full object-contain"
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
                                                더 이상 똑같은 데이트는 그만. 전문가가 추천하는 테마별 코스로 색다른
                                                하루를 보내거나, 함께하는 모든 순간을 기록하며 세상에 단 하나뿐인 둘만의
                                                이야기를 완성해보세요.
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
                                                        <Image
                                                            src="/images/Download_on_the_App_Store_Badge_KR_RGB_blk_100317.svg"
                                                            alt="App Store"
                                                            width={135}
                                                            height={40}
                                                            className="h-9 lg:h-11 w-auto object-contain"
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
                                                        <Image
                                                            src="/images/GetItOnGooglePlay_Badge_Web_color_Korean.png"
                                                            alt="Google Play"
                                                            width={135}
                                                            height={40}
                                                            className="h-11 lg:h-[52px] w-auto object-contain"
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

                                <div className="relative h-full bg-white dark:bg-[#0f1710] lg:w-[500px] lg:border-l border-gray-100 dark:border-gray-800 flex flex-col">
                                    <div
                                        className={`${
                                            isEscapeIntroPage || isCourseStart ? "hidden" : "block"
                                        } shrink-0`}
                                    >
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
                    )}
                </>
            )}
        </>
    );
}
