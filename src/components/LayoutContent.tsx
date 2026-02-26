"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import { createPortal } from "react-dom";
import Image from "next/image"; // 🟢 img 대신 next/image 사용 (하이드레이션 오류 근본 해결)
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import SideMenuDrawer from "@/components/SideMenuDrawer";
import AppInstallQR from "@/components/AppInstallQR";
import DonaSplashFinal from "@/components/DonaSplashFinal";
import { getS3StaticUrl } from "@/lib/s3Static";
import { isMobileApp } from "@/lib/platform";
import { useAuth } from "@/context/AuthContext";
import AdSlot from "@/components/AdSlot";

export default function LayoutContent({ children }: { children: React.ReactNode }) {
    // ---------------------------------------------------------
    // 1. 모든 Hook은 반드시 최상단에 순서대로 선언 (Rules of Hooks)
    // ---------------------------------------------------------
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const router = useRouter();
    const { isAuthenticated } = useAuth();
    const [isQrOpen, setIsQrOpen] = useState(false);
    const [sideMenuOpen, setSideMenuOpen] = useState(false);
    const [riseDone, setRiseDone] = useState(false); // 올라오는 애니메이션 끝난 뒤에만 + → 마이페이지 아이콘으로 전환
    const [drawerAnchorBottom, setDrawerAnchorBottom] = useState(0);
    const plusButtonRef = useRef<HTMLButtonElement>(null);
    const riseDoneTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    // 🟢 Hydration 일치: 서버·클라이언트 모두 false로 시작. 스플래시 여부는 useEffect에서 sessionStorage 확인 후 설정
    const [showSplash, setShowSplash] = useState(false);
    const [mounted, setMounted] = useState(false);
    const [contentReady, setContentReady] = useState(false);

    // 🟢 앱 환경 감지: 서버/클라이언트 첫 렌더를 같게 해서 hydration mismatch 방지. 실제 값은 useEffect에서 설정
    const [isApp, setIsApp] = useState(false);

    // 경로 변수들
    const isEscapeIntroPage = pathname.startsWith("/escape/intro");
    const isEscapeId = pathname ? /^\/escape\/[^/]+$/.test(pathname) : false;
    const isCourseStart = pathname ? /^\/courses\/[^/]+\/start$/.test(pathname) : false;
    const isCourseDetail = pathname ? /^\/courses\/[^/]+$/.test(pathname) : false; // 🟢 코스 상세 페이지
    const isMapPage = pathname === "/map" || pathname.startsWith("/map/");
    const isShopPage = pathname.startsWith("/shop"); // 🟢 [PHYSICAL PRODUCT]: 두나샵 페이지는 스플래시 제외
    const homepageBgUrl = getS3StaticUrl("homepage.png");

    // 🟢 웹 하단 광고: 앱과 동일 조건 (/, /mypage만. personalized-home, courses, nearby, view=memories 제외)
    const shouldShowWebAd =
        !pathname.startsWith("/personalized-home") &&
        !pathname.startsWith("/nearby") &&
        !pathname.startsWith("/courses") &&
        (pathname === "/" || (pathname === "/mypage" && searchParams?.get("view") !== "memories"));

    // 🟢 앱 하단 [AdMob] 배너 표시 시 footer·+버튼을 배너 높이만큼 올려서 광고에 가리지 않게
    const shouldShowAppBanner =
        isApp &&
        !pathname.startsWith("/personalized-home") &&
        !pathname.startsWith("/nearby") &&
        !pathname.startsWith("/courses") &&
        (pathname === "/" || (pathname === "/mypage" && searchParams?.get("view") !== "memories"));

    // 🟢 앱 환경 재확인
    useEffect(() => {
        const appCheck = isMobileApp();
        if (appCheck !== isApp) setIsApp(appCheck);
    }, [isApp]);

    // 🟢 [AdMob]: 앱 WebView에 현재 경로+쿼리 전달 (클라이언트 라우팅 시 광고 표시 여부 판단용)
    useEffect(() => {
        if (typeof window === "undefined" || !isMobileApp() || !(window as any).ReactNativeWebView) return;
        const search = searchParams?.toString() ?? "";
        const fullPath = (pathname || "/") + (search ? `?${search}` : "");
        (window as any).ReactNativeWebView.postMessage(JSON.stringify({ type: "pathChange", path: fullPath }));
    }, [pathname, searchParams]);

    // riseDone 타이머 언마운트 시 정리
    useEffect(() => {
        return () => {
            if (riseDoneTimeoutRef.current) {
                clearTimeout(riseDoneTimeoutRef.current);
                riseDoneTimeoutRef.current = null;
            }
        };
    }, []);

    // 🟢 서버 스플래시 제거 (첫 HTML에 그려진 #server-splash를 클라이언트에서 제거)
    const removeServerSplash = () => {
        if (typeof document === "undefined") return;
        const el = document.getElementById("server-splash");
        if (el?.parentNode) el.parentNode.removeChild(el);
    };

    // 🟢 Effect 1: 마운트 후 초기 설정, 스플래시 여부(sessionStorage) 및 샵 페이지 체크
    useEffect(() => {
        setMounted(true);
        // 🟢 즉시 초록색 배경 설정하여 흰색 화면 방지
        document.body.style.backgroundColor = "#7FCC9F";

        // 🟢 [PHYSICAL PRODUCT]: 두나샵 페이지는 스플래시 표시하지 않음
        if (isShopPage) {
            setShowSplash(false);
            setContentReady(true);
            removeServerSplash();
            return;
        }

        // 🟢 클라이언트에서만: 첫 방문이면 스플래시 표시, 아니면 콘텐츠 바로 표시
        // 🟢 dona-splash-started: 리마운트 시 스플래시 재시작 방지 (한 번이라도 시작했으면 재진입 시 스킵)
        try {
            const already =
                typeof window !== "undefined" &&
                (sessionStorage.getItem("dona-splash-shown") || sessionStorage.getItem("login-after-splash"));
            const splashStarted = typeof window !== "undefined" && sessionStorage.getItem("dona-splash-started");
            if (!already && !splashStarted) {
                if (typeof window !== "undefined") sessionStorage.setItem("dona-splash-started", "1");
                setShowSplash(true);
            } else {
                setContentReady(true);
                removeServerSplash();
            }
        } catch {
            setContentReady(true);
            removeServerSplash();
        }
    }, [isShopPage]);

    // 🟢 [2026-01-21] 로그인 성공 시 스플래시 중단 및 콘텐츠 표시
    useEffect(() => {
        const handleAuthLoginSuccess = () => {
            // 🟢 [수정]: 로그인 후에는 스플래시를 즉시 중단하고 콘텐츠 표시
            try {
                // 로그인 후 스플래시 플래그 설정 (재시작 방지)
                sessionStorage.setItem("dona-splash-shown", "true");
                sessionStorage.setItem("login-after-splash", "true");

                // 🟢 스플래시가 표시 중이면 즉시 숨기기
                if (showSplash) {
                    setShowSplash(false);
                }

                // 🟢 콘텐츠를 즉시 준비 상태로 전환 (스플래시 무시)
                setContentReady(true);
            } catch (e) {
                console.error("로그인 후 처리 오류:", e);
                // 에러가 나도 콘텐츠는 준비 상태로
                setContentReady(true);
                setShowSplash(false);
            }
        };

        window.addEventListener("authLoginSuccess", handleAuthLoginSuccess);
        return () => {
            window.removeEventListener("authLoginSuccess", handleAuthLoginSuccess);
        };
    }, [showSplash]);

    // 🟢 contentReady가 true가 되면 서버 스플래시 제거 (재방문·스플래시 완료 시). showSplash일 때는 제거하지 않음 → 서버 스플래시 위에 DonaSplashFinal 오버레이만 그려서 한 번만 보이게 함
    useEffect(() => {
        if (!contentReady) return;
        removeServerSplash();
    }, [contentReady]);

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

            {/* 🟢 LCP 개선: 메인 콘텐츠는 항상 DOM에 렌더 (히어로 이미지 즉시 로드). 스플래시는 오버레이만 표시 */}
            {showSplash && !isShopPage && (
                <DonaSplashFinal
                    overlayOnly
                    onDone={() => {
                        try {
                            sessionStorage.setItem("dona-splash-shown", "1");
                        } catch {}
                        setContentReady(true);
                        setShowSplash(false);
                    }}
                />
            )}

            {/* 🟢 메인 콘텐츠 항상 렌더 (스플래시 중에도 DOM에 있어 이미지 로드 → LCP 2.5초 이내 목표) */}
            <div
                className="min-h-screen homepage-bg-container"
                style={{
                    backgroundColor: showSplash && !contentReady ? "#7FCC9F" : "transparent",
                    transition: "opacity 0.6s ease-in-out, background-color 1s ease-in-out",
                }}
            >
                <div
                    className={`h-screen ${
                        !mounted
                            ? "lg:max-w-[1180px] lg:mx-auto lg:flex lg:items-stretch lg:gap-6"
                            : !isApp
                              ? "lg:max-w-[1180px] lg:mx-auto lg:flex lg:items-stretch lg:gap-6"
                              : ""
                    }`}
                >
                    {/* 🟢 웹 브라우저에서만 히어로 패널 표시 (앱 환경에서는 숨김) */}
                    {!isApp && (
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
                                        더 이상 똑같은 데이트는 그만. 전문가가 추천하는 테마별 코스로 색다른 하루를
                                        보내거나, 함께하는 모든 순간을 기록하며 세상에 단 하나뿐인 둘만의 이야기를
                                        완성해보세요.
                                    </p>

                                    {/* 5. 앱 다운로드 버튼 */}
                                    <div className="flex items-center gap-4 pt-2">
                                        <a
                                            href="https://apps.apple.com/kr/app/dona/id6756777886"
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
                                            href="https://play.google.com/store/apps/details?id=kr.io.dona.dona"
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
                    )}

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

                    <div
                        className={`relative h-full flex flex-col ${!isApp ? "bg-white dark:bg-[#0f1710]" : "bg-transparent"} ${
                            !mounted
                                ? "lg:w-[500px] lg:border-l border-gray-100 dark:border-gray-800"
                                : !isApp
                                  ? "lg:w-[500px] lg:border-l border-gray-100 dark:border-gray-800"
                                  : "w-full"
                        } lg:pb-0`}
                    >
                        <div
                            className={`shrink-0 bg-white dark:bg-[#0f1710] ${
                                isEscapeIntroPage || isCourseStart || isMapPage ? "hidden" : "block"
                            }`}
                        >
                            <Header />
                        </div>
                        <main className="flex-1 overflow-y-auto overscroll-contain no-scrollbar scrollbar-hide bg-white dark:bg-[#0f1710]">
                            <div className={`min-h-full ${!isMapPage ? "pb-22 lg:pb-0" : ""}`}>{children}</div>
                        </main>
                        <div
                            className={`shrink-0 bg-transparent ${
                                isEscapeId || isCourseStart || isCourseDetail ? "hidden" : "block"
                            } fixed ${!mounted ? "bottom-2" : isApp ? (shouldShowAppBanner ? "bottom-14" : "bottom-0") : shouldShowWebAd ? "bottom-0" : "bottom-2"} left-0 right-0 z-40 lg:static lg:z-auto flex flex-col`}
                        >
                            {/* 버튼만 공중에 떠 있게 만드는 플로팅 구조 (지도 페이지에선 숨김). 웹(lg)에서는 앱 패널 오른쪽에 배치 */}
                            {!isMapPage && (
                                <>
                                    {/* 드로어 닫혀 있을 때: 인라인 버튼 (클릭 시 위치 계산용 ref) */}
                                    {!sideMenuOpen && (
                                        <div
                                            className={`fixed ${!mounted ? "bottom-31" : isApp ? (shouldShowAppBanner ? "bottom-20" : "bottom-16") : shouldShowWebAd ? "bottom-48" : "bottom-24"} right-6 z-50 pointer-events-none flex items-center gap-2.5 lg:absolute lg:right-6 ${!isApp && shouldShowWebAd ? "lg:bottom-36" : "lg:bottom-22"}`}
                                        >
                                            <button
                                                ref={plusButtonRef}
                                                type="button"
                                                onClick={() => {
                                                    if (plusButtonRef.current) {
                                                        const rect = plusButtonRef.current.getBoundingClientRect();
                                                        setDrawerAnchorBottom(
                                                            typeof window !== "undefined"
                                                                ? window.innerHeight - rect.top
                                                                : 0,
                                                        );
                                                    }
                                                    setRiseDone(false);
                                                    setSideMenuOpen(true);
                                                    if (riseDoneTimeoutRef.current)
                                                        clearTimeout(riseDoneTimeoutRef.current);
                                                    riseDoneTimeoutRef.current = setTimeout(() => {
                                                        setRiseDone(true);
                                                        riseDoneTimeoutRef.current = null;
                                                    }, 400);
                                                }}
                                                aria-label="메뉴 열기"
                                                className="w-12 h-12 rounded-full text-white shadow-[0_8px_30px_rgb(0,0,0,0.2)] border-2 border-white/50 dark:border-[#1a241b]/50 flex items-center justify-center transition-all duration-200 ease-out pointer-events-auto hover:scale-110 active:scale-95 bg-[#7FCC9F] hover:bg-[#6bb88a] text-3xl font-light"
                                            >
                                                +
                                            </button>
                                        </div>
                                    )}
                                    {/* 드로어 열렸을 때: body 포탈로 버튼을 최상단에 렌더 → "마이페이지/로그인"이 흐림 위에 보이게 */}
                                    {sideMenuOpen &&
                                        typeof document !== "undefined" &&
                                        createPortal(
                                            <div
                                                className={`fixed ${!mounted ? "bottom-22" : isApp ? (shouldShowAppBanner ? "bottom-24" : "bottom-16") : shouldShowWebAd ? "bottom-48" : "bottom-24"} right-6 z-2010 pointer-events-none flex items-center gap-2.5`}
                                                style={{ position: "fixed" }}
                                            >
                                                {riseDone && (
                                                    <span className="text-sm font-medium text-gray-800 dark:text-gray-200 whitespace-nowrap drop-shadow-md bg-white/90 dark:bg-black/50 px-2 py-1 rounded-md">
                                                        {isAuthenticated ? "마이페이지" : "로그인"}
                                                    </span>
                                                )}
                                                <button
                                                    type="button"
                                                    onPointerDown={() => {
                                                        if (isAuthenticated) router.prefetch("/mypage");
                                                    }}
                                                    onClick={() => {
                                                        if (riseDoneTimeoutRef.current) {
                                                            clearTimeout(riseDoneTimeoutRef.current);
                                                            riseDoneTimeoutRef.current = null;
                                                        }
                                                        setSideMenuOpen(false);
                                                        setRiseDone(false);
                                                        router.push(isAuthenticated ? "/mypage" : "/login");
                                                    }}
                                                    aria-label={isAuthenticated ? "마이페이지로 이동" : "로그인"}
                                                    className="w-12 h-12 rounded-full text-white shadow-[0_8px_30px_rgb(0,0,0,0.25)] border-2 border-white flex items-center justify-center transition-all duration-200 ease-out pointer-events-auto hover:scale-110 active:scale-95 bg-[#1a3a2e] hover:bg-[#234a3a]"
                                                >
                                                    {isAuthenticated ? (
                                                        <svg
                                                            className="h-6 w-6 text-[#99c08e]"
                                                            fill="none"
                                                            stroke="currentColor"
                                                            viewBox="0 0 24 24"
                                                        >
                                                            <path
                                                                strokeLinecap="round"
                                                                strokeLinejoin="round"
                                                                strokeWidth={2}
                                                                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                                                            />
                                                        </svg>
                                                    ) : (
                                                        <svg
                                                            className="h-6 w-6 text-[#99c08e]"
                                                            fill="none"
                                                            stroke="currentColor"
                                                            viewBox="0 0 24 24"
                                                        >
                                                            <path
                                                                strokeLinecap="round"
                                                                strokeLinejoin="round"
                                                                strokeWidth={2}
                                                                d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"
                                                            />
                                                        </svg>
                                                    )}
                                                </button>
                                            </div>,
                                            document.body,
                                        )}
                                </>
                            )}
                            <Footer isApp={isApp} />
                            {/* 🟢 웹 전용: 푸터와 광고를 한 하단 바로 묶어 바닥에 붙임 (lg에서는 흐름 유지) */}
                            {!isApp && shouldShowWebAd && (
                                <div className="w-full flex justify-center rounded-none shrink-0">
                                    <AdSlot
                                        slotId={process.env.NEXT_PUBLIC_ADSENSE_BOTTOM_SLOT_ID || ""}
                                        format="auto"
                                        rounded={false}
                                        className="w-[320px] h-[50px] min-h-[50px] mx-auto rounded-none"
                                    />
                                </div>
                            )}
                            <SideMenuDrawer
                                isOpen={sideMenuOpen}
                                onClose={() => {
                                    if (riseDoneTimeoutRef.current) {
                                        clearTimeout(riseDoneTimeoutRef.current);
                                        riseDoneTimeoutRef.current = null;
                                    }
                                    setSideMenuOpen(false);
                                    setRiseDone(false);
                                }}
                                anchorBottom={drawerAnchorBottom}
                            />
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
