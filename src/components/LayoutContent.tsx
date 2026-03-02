"use client";

import { createPortal } from "react-dom";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import { motion } from "framer-motion";
import Image from "next/image"; // 🟢 img 대신 next/image 사용 (하이드레이션 오류 근본 해결)
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import SideMenuDrawer from "@/components/SideMenuDrawer";
import AppInstallQR from "@/components/AppInstallQR";
import DonaSplashFinal from "@/components/DonaSplashFinal";
import { getS3StaticUrl } from "@/lib/s3Static";
import { isMobileApp, isAndroid } from "@/lib/platform";
import { useAuth } from "@/context/AuthContext";
import { useLocale } from "@/context/LocaleContext";
import AdSlot from "@/components/AdSlot";
import { AppLayoutProvider } from "@/context/AppLayoutContext";

// 🟢 웹 히어로 패널 플로팅 아이콘 (커피, 클래퍼보드, 하트, 와인)
const CoffeeIcon = ({ className }: { className?: string }) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
    >
        <path d="M17 8h1a4 4 0 1 1 0 8h-1" />
        <path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z" />
        <line x1="6" x2="6" y1="2" y2="4" />
        <line x1="10" x2="10" y1="2" y2="4" />
        <line x1="14" x2="14" y1="2" y2="4" />
    </svg>
);
const ClapperboardIcon = ({ className }: { className?: string }) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
    >
        <path d="M20.2 6 3 11l-.9-2.4L19.3 3z" />
        <path d="m9.7 7.3 2-5.4" />
        <path d="m15.6 5 2-5.4" />
        <path d="M4 11V21h16V11z" />
    </svg>
);
const HeartIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" stroke="none" className={className}>
        <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
    </svg>
);
const WineIcon = ({ className }: { className?: string }) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
    >
        <path d="M8 22h8" />
        <path d="M12 15v7" />
        <path d="M12 15a7.5 7.5 0 0 0 7.5-7.5V3h-15v4.5A7.5 7.5 0 0 0 12 15z" />
        <path d="M4.5 8h15" />
    </svg>
);

const FLOATING_ICONS: Array<{
    id: number;
    Icon: React.ComponentType<{ className?: string }>;
    wrapperSize: string;
    iconSize: string;
    top: string;
    left?: string;
    right?: string;
    color: string;
}> = [
    {
        id: 1,
        Icon: CoffeeIcon,
        wrapperSize: "w-16 h-16",
        iconSize: "w-7 h-7",
        top: "15%",
        left: "8%",
        color: "text-amber-800",
    },
    {
        id: 2,
        Icon: ClapperboardIcon,
        wrapperSize: "w-14 h-14",
        iconSize: "w-6 h-6",
        top: "65%",
        left: "45%",
        color: "text-slate-700",
    },
    {
        id: 3,
        Icon: HeartIcon,
        wrapperSize: "w-12 h-12",
        iconSize: "w-5 h-5",
        top: "20%",
        right: "10%",
        color: "text-rose-500",
    },
    {
        id: 4,
        Icon: WineIcon,
        wrapperSize: "w-16 h-16",
        iconSize: "w-7 h-7",
        top: "75%",
        right: "8%",
        color: "text-red-900",
    },
];

export default function LayoutContent({ children }: { children: React.ReactNode }) {
    // ---------------------------------------------------------
    // 1. 모든 Hook은 반드시 최상단에 순서대로 선언 (Rules of Hooks)
    // ---------------------------------------------------------
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const router = useRouter();
    const { isAuthenticated } = useAuth();
    const { t } = useLocale();
    const [isQrOpen, setIsQrOpen] = useState(false);
    const [businessInfoOpen, setBusinessInfoOpen] = useState(false);
    const [sideMenuOpen, setSideMenuOpen] = useState(false);
    const [riseDone, setRiseDone] = useState(false); // 올라오는 애니메이션 끝난 뒤에만 + → 마이페이지 아이콘으로 전환
    const [drawerAnchorBottom, setDrawerAnchorBottom] = useState(0);
    const plusButtonRef = useRef<HTMLButtonElement>(null);
    const riseDoneTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const modalContainerRef = useRef<HTMLDivElement>(null);
    // 🟢 Hydration 일치: 서버·클라이언트 모두 false로 시작. 스플래시 여부는 useEffect에서 sessionStorage 확인 후 설정
    const [showSplash, setShowSplash] = useState(false);
    const [mounted, setMounted] = useState(false);
    const [contentReady, setContentReady] = useState(false);

    // 🟢 앱 환경 감지: 서버/클라이언트 첫 렌더를 같게 해서 hydration mismatch 방지. 실제 값은 useEffect에서 설정
    const [isApp, setIsApp] = useState(false);
    // 🟢 Android: 하단 네비(뒤로가기/홈)보다 5(20px) 위로 올림
    const [isAndroidClient, setIsAndroidClient] = useState(false);
    // 🟢 웹 광고 실제 표시 여부: AdSlot onHide(노필) 시 false, 페이지 이동 시 초기화
    const [webAdVisible, setWebAdVisible] = useState(true);
    const [isLgOrUp, setIsLgOrUp] = useState(false); // lg 이상에서 광고 하단 위치 스타일 제외

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

    // 🟢 Android 클라이언트 감지 (하단 네비 위 여백용)
    useEffect(() => {
        setIsAndroidClient(isAndroid());
    }, []);

    // 🟢 웹 광고 표시 페이지로 이동 시 webAdVisible 초기화 (AdSlot 새로 마운트)
    useEffect(() => {
        if (shouldShowWebAd) setWebAdVisible(true);
    }, [shouldShowWebAd]);

    // 🟢 lg(1024px) 이상에서 하단 광고 bottom 스타일 비적용 (lg에서 AdSlot 숨김과 일치)
    useEffect(() => {
        const mq = window.matchMedia("(min-width: 1024px)");
        const handler = () => setIsLgOrUp(mq.matches);
        handler();
        mq.addEventListener("change", handler);
        return () => mq.removeEventListener("change", handler);
    }, []);

    // 🟢 [AdMob]: 앱 WebView에 현재 경로+쿼리 전달 (ReactNativeWebView 있으면 전송 - isMobileApp()보다 먼저 설정될 수 있음)
    useEffect(() => {
        if (typeof window === "undefined" || !(window as any).ReactNativeWebView) return;
        const search = searchParams?.toString() ?? "";
        const fullPath = (pathname || "/") + (search ? `?${search}` : "");
        (window as any).ReactNativeWebView.postMessage(JSON.stringify({ type: "pathChange", path: fullPath }));
        const t = setTimeout(() => {
            (window as any).ReactNativeWebView?.postMessage?.(JSON.stringify({ type: "pathChange", path: fullPath }));
        }, 150);
        return () => clearTimeout(t);
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
                .web-landing-bg {
                    background: linear-gradient(115deg, #FCFAF5 0%, #FCFAF5 42%, #F4D8D1 42%, #F4D8D1 62%, #D0E8E1 62%, #D0E8E1 100%);
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
            <AppLayoutProvider value={{ containInPhone: !isApp, modalContainerRef }}>
                <div
                    className={`min-h-screen homepage-bg-container ${!isApp ? "web-landing-bg" : ""}`}
                    style={{
                        backgroundColor: showSplash && !contentReady ? "#7FCC9F" : "transparent",
                        transition: "opacity 0.6s ease-in-out, background-color 1s ease-in-out",
                    }}
                >
                    <div
                        className={`h-screen ${
                            !mounted
                                ? "lg:max-w-[1180px] lg:mx-auto lg:flex lg:flex-row lg:items-stretch lg:gap-6"
                                : !isApp
                                  ? "lg:max-w-[1180px] lg:mx-auto lg:flex lg:flex-row lg:items-stretch lg:gap-6"
                                  : ""
                        }`}
                    >
                        {/* 🟢 웹 브라우저에서만 히어로 패널 표시 (앱 환경에서는 숨김) - 밝은 그라데이션 랜딩 */}
                        {!isApp && (
                            <section className="hidden lg:block relative w-[600px] h-full overflow-y-auto shrink-0 bg-transparent no-scrollbar scrollbar-hide">
                                {/* 플로팅 아이콘 (Framer Motion) */}
                                {FLOATING_ICONS.map((item, index) => {
                                    const IconComponent = item.Icon;
                                    return (
                                        <motion.div
                                            key={item.id}
                                            className={`absolute z-0 pointer-events-none ${item.wrapperSize}`}
                                            style={{
                                                top: item.top,
                                                left: item.left,
                                                right: item.right,
                                            }}
                                            animate={{ y: [0, -12, 0] }}
                                            transition={{
                                                duration: 4 + index * 0.5,
                                                repeat: Infinity,
                                                repeatType: "reverse",
                                                ease: "easeInOut",
                                            }}
                                        >
                                            <div
                                                className={`flex items-center justify-center rounded-full bg-white/70 shadow-lg backdrop-blur-md border border-white/40 w-full h-full ${item.color}`}
                                            >
                                                <IconComponent className={item.iconSize} />
                                            </div>
                                        </motion.div>
                                    );
                                })}
                                <div className="relative z-10 flex flex-col pt-24 pb-12">
                                    <div className="px-10 max-w-[520px] text-gray-900 space-y-6">
                                        {/* 1. 로고 및 앱 이름 */}
                                        <div className="inline-block">
                                            <div className="w-32 h-32 p-4 flex items-center justify-center">
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
                                        <h2 className="text-4xl font-extrabold leading-tight tracking-tight text-gray-900">
                                            앱에서 더 많은 코스를 만나보세요!
                                        </h2>

                                        {/* 3. 부가 설명 */}
                                        <div className="text-xl font-bold text-gray-800">
                                            특별한 데이트 코스 추천부터 함께 채워나가는 스토리까지.
                                        </div>

                                        {/* 4. 앱 다운로드 버튼 */}
                                        <div className="space-y-5">
                                            <div className="flex items-center gap-4">
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
                                                    <span className="inline-flex items-center justify-center bg-transparent rounded-md">
                                                        <Image
                                                            src="/images/GetItOnGooglePlay_Badge_Web_color_Korean.png"
                                                            alt="Google Play"
                                                            width={200}
                                                            height={60}
                                                            className="h-14 lg:h-[72px] w-auto object-contain"
                                                        />
                                                    </span>
                                                </a>
                                            </div>
                                            {/* iOS·안드로이드 QR 코드 */}
                                            <div className="flex items-center gap-5">
                                                <div className="flex flex-col items-center gap-1">
                                                    <img
                                                        src={`https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent("https://apps.apple.com/kr/app/dona/id6756777886")}`}
                                                        alt="App Store QR"
                                                        className="w-[72px] h-[72px] object-contain rounded-lg border border-gray-200 bg-white p-0.5"
                                                    />
                                                    <span className="text-[10px] font-medium text-gray-600">iOS</span>
                                                </div>
                                                <div className="flex flex-col items-center gap-1">
                                                    <img
                                                        src={`https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent("https://play.google.com/store/apps/details?id=kr.io.dona.dona")}`}
                                                        alt="Google Play QR"
                                                        className="w-[72px] h-[72px] object-contain rounded-lg border border-gray-200 bg-white p-0.5"
                                                    />
                                                    <span className="text-[10px] font-medium text-gray-600">
                                                        Android
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* 5. 사업자 정보 (아코디언 - 아래로 펼쳐짐) */}
                                        <div className="pt-8 border-t border-gray-200 flex flex-col">
                                            <button
                                                type="button"
                                                onClick={() => setBusinessInfoOpen((o) => !o)}
                                                className="w-full flex items-center justify-between py-2 text-left hover:opacity-80 transition-opacity"
                                                aria-expanded={businessInfoOpen}
                                            >
                                                <h3 className="text-lg font-bold text-gray-900">사업자 정보</h3>
                                                <svg
                                                    className={`w-5 h-5 text-gray-600 transition-transform duration-200 ${businessInfoOpen ? "rotate-180" : ""}`}
                                                    fill="none"
                                                    stroke="currentColor"
                                                    viewBox="0 0 24 24"
                                                >
                                                    <path
                                                        strokeLinecap="round"
                                                        strokeLinejoin="round"
                                                        strokeWidth={2}
                                                        d="M19 9l-7 7-7-7"
                                                    />
                                                </svg>
                                            </button>
                                            <div
                                                className={`grid grid-cols-1 gap-1.5 text-[13px] text-gray-600 overflow-hidden transition-[max-height,opacity] duration-200 ease-out ${
                                                    businessInfoOpen
                                                        ? "max-h-[280px] opacity-100 mt-0"
                                                        : "max-h-0 opacity-0"
                                                }`}
                                            >
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
                                                    <strong>주소:</strong> 충청남도 홍성군 홍북읍 신대로 33
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
                            ref={modalContainerRef}
                            className={`relative h-full flex flex-col overflow-hidden ${!isApp ? "bg-white dark:bg-[#0f1710]" : "bg-transparent"} ${
                                !mounted
                                    ? "lg:w-[360px] lg:max-h-[85vh] lg:h-[85vh] lg:rounded-[3rem] lg:border-[9px] lg:border-gray-300 dark:lg:border-gray-700 lg:shadow-[0_30px_90px_rgba(0,0,0,0.2)] lg:ml-12 lg:mt-8"
                                    : !isApp
                                      ? "lg:w-[360px] lg:max-h-[85vh] lg:h-[85vh] lg:rounded-[3rem] lg:border-[9px] lg:border-gray-300 dark:lg:border-gray-700 lg:shadow-[0_30px_90px_rgba(0,0,0,0.2)] lg:ml-12 lg:mt-8"
                                      : "w-full"
                            } lg:pb-0`}
                        >
                            {/* 웹 전용: 폰 상단 원형 노치 + 세이프 영역 (화면이 노치 아래에서만 표시) */}
                            {!isApp && (
                                <div className="hidden lg:block absolute top-0 left-1/2 -translate-x-1/2 z-50 w-full max-w-[280px] px-8 pt-2">
                                    <div className="w-5 h-5 mx-auto rounded-full bg-gray-900 dark:bg-gray-950" />
                                </div>
                            )}
                            <div
                                className={`shrink-0 bg-white dark:bg-[#0f1710] ${
                                    isEscapeIntroPage || isCourseStart || isMapPage ? "hidden" : "block"
                                } ${!isApp ? "lg:pt-10" : ""}`}
                            >
                                <Header />
                            </div>
                            <main
                                className={`flex-1 overflow-y-auto overscroll-contain no-scrollbar scrollbar-hide bg-white dark:bg-[#0f1710] ${
                                    !isApp && (isEscapeIntroPage || isCourseStart || isMapPage) ? "lg:pt-12" : ""
                                }`}
                            >
                                <div className={`min-h-full ${!isMapPage ? "pb-22 lg:pb-0" : ""}`}>{children}</div>
                            </main>
                            {/* 🟢 Footer + +버튼: 앱에서는 하나의 컨테이너에 묶어 gap으로 간격 보장, 함께 올라갔다 내려감 */}
                            <div
                                className={`shrink-0 bg-transparent ${
                                    isEscapeId || isCourseStart || isCourseDetail ? "hidden" : "block"
                                } fixed ${
                                    !mounted
                                        ? "bottom-2"
                                        : isApp
                                          ? shouldShowAppBanner
                                              ? ""
                                              : "bottom-5"
                                          : shouldShowWebAd && webAdVisible && !isLgOrUp
                                            ? ""
                                            : "bottom-5"
                                } left-0 right-0 z-40 lg:relative lg:z-auto flex flex-col items-end gap-3 transition-[bottom] duration-300 ease-in-out`}
                                style={
                                    mounted && isApp && shouldShowAppBanner
                                        ? {
                                              bottom: isAndroidClient
                                                  ? "calc(64px + 20px + env(safe-area-inset-bottom, 0px))"
                                                  : "calc(64px + env(safe-area-inset-bottom, 0px))",
                                          }
                                        : mounted && isApp && isAndroidClient
                                          ? { bottom: "calc(1.25rem + 20px + env(safe-area-inset-bottom, 0px))" }
                                          : mounted && !isApp && shouldShowWebAd && webAdVisible && !isLgOrUp
                                            ? { bottom: "calc(80px + 1.25rem)" }
                                            : undefined
                                }
                            >
                                {/* +버튼: Footer 위에 flex로 배치 */}
                                {!isMapPage && !sideMenuOpen && (
                                    <div className="flex flex-col items-end gap-2.5 pointer-events-none pr-4 z-50 lg:absolute lg:right-4 lg:bottom-24 lg:pr-0">
                                        <div className="flex flex-col items-end gap-2.5 pointer-events-auto">
                                            <button
                                                ref={plusButtonRef}
                                                type="button"
                                                onClick={() => {
                                                    if (plusButtonRef.current && typeof window !== "undefined") {
                                                        const rect = plusButtonRef.current.getBoundingClientRect();
                                                        // 웹 폰 목업: 폰 컨테이너 기준 bottom (메뉴가 +버튼 바로 위에 오도록)
                                                        const anchor =
                                                            !isApp && modalContainerRef?.current
                                                                ? modalContainerRef.current.getBoundingClientRect()
                                                                      .bottom - rect.top
                                                                : window.innerHeight - rect.top;
                                                        setDrawerAnchorBottom(anchor);
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
                                                aria-label={t("nav.openMenu")}
                                                className="w-12 h-12 rounded-full text-white shadow-[0_8px_30px_rgb(0,0,0,0.2)] border-2 border-white/50 dark:border-[#1a241b]/50 flex items-center justify-center transition-all duration-200 ease-out hover:scale-110 active:scale-95 bg-[#7FCC9F] hover:bg-[#6bb88a] text-3xl font-light"
                                            >
                                                +
                                            </button>
                                        </div>
                                    </div>
                                )}
                                {/* 🟢 로그인/마이페이지 버튼: 사이드 메뉴 열렸을 때 createPortal로 body에 렌더 → 오버레이(z-9999) 위에 표시 */}
                                {!isMapPage &&
                                    sideMenuOpen &&
                                    typeof document !== "undefined" &&
                                    createPortal(
                                        <div
                                            className={`${!isApp ? "absolute" : "fixed"} right-4 z-100001 pointer-events-none flex items-center gap-2.5 ${
                                                !mounted
                                                    ? "bottom-24"
                                                    : isApp
                                                      ? shouldShowAppBanner
                                                          ? ""
                                                          : "bottom-20"
                                                      : shouldShowWebAd && webAdVisible && !isLgOrUp
                                                        ? ""
                                                        : "bottom-24"
                                            } lg:right-4 lg:bottom-24`}
                                            style={
                                                mounted && isApp && shouldShowAppBanner
                                                    ? {
                                                          bottom: isAndroidClient
                                                              ? "calc(140px + 20px + env(safe-area-inset-bottom, 0px))"
                                                              : "calc(140px + env(safe-area-inset-bottom, 0px))",
                                                      }
                                                    : mounted && isApp && isAndroidClient
                                                      ? {
                                                            bottom: "calc(5rem + 20px + env(safe-area-inset-bottom, 0px))",
                                                        }
                                                      : mounted &&
                                                          !isApp &&
                                                          shouldShowWebAd &&
                                                          webAdVisible &&
                                                          !isLgOrUp
                                                        ? { bottom: "calc(80px + 1.25rem + 5rem)" }
                                                        : undefined
                                            }
                                        >
                                            <div className="flex flex-row items-center gap-2.5 pointer-events-auto">
                                                {riseDone && (
                                                    <span className="text-sm font-medium text-gray-800 dark:text-gray-200 whitespace-nowrap">
                                                        {isAuthenticated ? t("nav.myPage") : t("nav.login")}
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
                                                    aria-label={isAuthenticated ? t("nav.goToMyPage") : t("nav.login")}
                                                    className="w-12 h-12 rounded-full text-white shadow-md border border-gray-200/60 flex items-center justify-center transition-all duration-200 ease-out hover:scale-110 active:scale-95 bg-gray-800 hover:bg-gray-700 dark:bg-gray-700 dark:hover:bg-gray-600"
                                                >
                                                    {isAuthenticated ? (
                                                        <svg
                                                            className="h-6 w-6"
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
                                                            className="h-6 w-6"
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
                                            </div>
                                        </div>,
                                        !isApp && modalContainerRef?.current
                                            ? modalContainerRef.current
                                            : document.body,
                                    )}
                                {!isMapPage && <Footer isApp={isApp} plusButton={null} />}
                            </div>
                            {/* 🟢 웹 전용: 광고를 화면 맨 아래 고정, 푸터·+버튼은 광고 위로 분리 (겹침 방지) */}
                            {!isApp && shouldShowWebAd && (
                                <div className="fixed bottom-0 left-0 right-0 z-30 lg:hidden">
                                    <AdSlot
                                        slotId={process.env.NEXT_PUBLIC_ADSENSE_BOTTOM_SLOT_ID || "3129678170"}
                                        format="fluid"
                                        layoutKey="-hi-7+2w-11-86"
                                        rounded={false}
                                        className="w-full min-h-[80px] mx-auto rounded-none"
                                        onHide={() => setWebAdVisible(false)}
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
                                containInPhone={!isApp}
                            />
                        </div>
                    </div>
                </div>
            </AppLayoutProvider>
        </>
    );
}
