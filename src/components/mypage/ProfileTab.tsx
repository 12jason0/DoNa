"use client";

import React, { useState, useEffect, memo } from "react";
import Image from "next/image";
import Link from "next/link";
import { UserInfo, UserPreferences } from "@/types/user";
import { authenticatedFetch, apiFetch } from "@/lib/authClient"; // 🟢 쿠키 기반 API 호출
import { useLocale } from "@/context/LocaleContext";
import { getS3StaticUrl } from "@/lib/s3Static";
import { isIOS, isMobileApp, isAndroid } from "@/lib/platform";
import DeleteUsersModal from "./DeleteUsersModal";

interface ProfileTabProps {
    userInfo: UserInfo | null;
    userPreferences: UserPreferences | null;
    onEditProfile: () => void;
    onEditPreferences: () => void;
    onOpenPwModal: () => void;
    onLogout: () => void;
}

// 🟢 구독 섹션 (권한: 구독 등급으로 판단)
const MembershipSection = ({ userInfo }: { userInfo: UserInfo | null }) => {
    const { t } = useLocale();
    const displayTier = (userInfo?.subscriptionTier || "FREE").toString().toUpperCase() as "FREE" | "BASIC" | "PREMIUM";

    // 🟢 [Fix]: 만료일이 있고 아직 유효한지 확인
    const hasValidSubscription =
        displayTier !== "FREE" &&
        userInfo?.subscriptionExpiresAt &&
        new Date(userInfo.subscriptionExpiresAt) > new Date();

    return (
        <div className="bg-white dark:bg-[#1a241b] rounded-2xl border border-gray-100 dark:border-transparent p-6 md:p-8 shadow-sm">
            {/* 헤더 섹션 */}
            <div className="flex items-center gap-2 mb-6">
                <div className="w-1.5 h-5 bg-[#7FCC9F] rounded-full" />
                <h3 className="text-xl font-extrabold text-gray-900 dark:text-white tracking-tight">
                    {t("mypage.profileTab.subscriptionTitle")}
                </h3>
            </div>

            <div className="space-y-4">
                {/* 1. 멤버십 섹션 */}
                <div className="bg-white dark:bg-[#1a241b] rounded-2xl border border-gray-100 dark:border-gray-800 p-5 md:p-6 shadow-sm flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center text-2xl shadow-inner">
                            {displayTier === "PREMIUM" ? "👑" : "✨"}
                        </div>
                        <div>
                            <p className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-tighter mb-0.5">
                                My Membership
                            </p>
                            <h4 className="text-base font-bold text-gray-900 dark:text-white">
                                {displayTier === "PREMIUM"
                                    ? t("mypage.profileTab.membershipPremium")
                                    : displayTier === "BASIC"
                                    ? t("mypage.profileTab.membershipBasic")
                                    : t("mypage.profileTab.membershipFree")}
                            </h4>
                            {userInfo?.subscriptionExpiresAt && displayTier !== "FREE" && hasValidSubscription && (
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 font-medium">
                                    ~{" "}
                                    {new Date(userInfo.subscriptionExpiresAt).toLocaleDateString("ko-KR", {
                                        year: "numeric",
                                        month: "long",
                                        day: "numeric",
                                    })}
                                </p>
                            )}
                        </div>
                    </div>

                    <button
                        onClick={() => {
                            if (typeof window !== "undefined") {
                                window.dispatchEvent(new CustomEvent("openTicketPlans"));
                            }
                        }}
                        className={`px-4 py-2 rounded-xl text-xs font-bold transition-all active:scale-95 shadow-sm cursor-pointer ${
                            displayTier === "PREMIUM"
                                ? "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
                                : "bg-emerald-500 hover:bg-emerald-600 text-white"
                        }`}
                    >
                        {displayTier === "PREMIUM" ? t("mypage.profileTab.inUse") : t("mypage.profileTab.upgrade")}
                    </button>
                </div>
            </div>
        </div>
    );
};

const ProfileTab = ({
    userInfo,
    userPreferences,
    onEditProfile,
    onEditPreferences,
    onOpenPwModal,
    onLogout,
}: ProfileTabProps) => {
    const { t } = useLocale();
    // 기본 프로필 이미지
    const DEFAULT_PROFILE_IMG = getS3StaticUrl("profileLogo.png");

    // 🟢 등급 표시: API가 소문자로 올 수 있으므로 대문자로 정규화
    const rawTier = userInfo?.subscriptionTier ?? "FREE";
    const displayTier = (typeof rawTier === "string" ? rawTier.toUpperCase() : "FREE") as "FREE" | "BASIC" | "PREMIUM";

    // 🟢 [강화]: iOS 감지 - 동기적으로 즉시 체크 (첫 렌더링에서 바로 적용)
    const checkIOSDevice = (): boolean => {
        if (typeof window === "undefined") return false;

        const userAgent = navigator.userAgent.toLowerCase();
        const platform = navigator.platform?.toLowerCase() || "";
        const maxTouchPoints = navigator.maxTouchPoints || 0;

        // iPhone, iPad, iPod User Agent 체크
        const isIOSUA = /iphone|ipad|ipod/.test(userAgent);

        // iPadOS 13+ 감지: Macintosh User Agent + 터치 포인트 (5 이상이면 더 확실)
        const isMacLike = /macintosh|mac os x/.test(userAgent);
        const isIPadOS = isMacLike && maxTouchPoints >= 5;

        // Platform 체크
        const isIOSPlatform = /iphone|ipad|ipod/.test(platform);

        return isIOSUA || isIPadOS || isIOSPlatform;
    };

    // 🟢 동기적으로 즉시 체크하여 첫 렌더링에서 바로 적용
    const isIOSDevice = checkIOSDevice();

    // 1. 초기값을 null로 변경 (데이터를 불러오기 전 상태)
    const [notificationEnabled, setNotificationEnabled] = useState<boolean | null>(null);
    const [notificationStatus, setNotificationStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
    const [notificationMessage, setNotificationMessage] = useState<string>("");
    const [showAppRequiredModal, setShowAppRequiredModal] = useState(false);
    const [showWithdrawalModal, setShowWithdrawalModal] = useState(false);
    const [withdrawalLoading, setWithdrawalLoading] = useState(false);

    // 🟢 알림 상태 초기 로드 최적화: 지연 로드 및 캐싱
    useEffect(() => {
        // 🟢 성능 최적화: 알림 상태는 사용자가 알림 설정을 열 때만 로드 (지연 로드)
        // 🟢 초기 로딩 시에는 로드하지 않음으로써 마이페이지 진입 속도 향상
        const fetchNotificationStatus = async () => {
            try {
                const { fetchSession } = await import("@/lib/authClient");
                const session = await fetchSession();
                if (!session.authenticated || !session.user) {
                    setNotificationEnabled(false);
                    return;
                }

                // 🟢 최적화: userInfo prop에서 직접 userId 가져오기 (API 호출 제거)
                let userId: number | null = null;
                if (userInfo) {
                    userId = (userInfo as any)?.id || (userInfo as any)?.user?.id || null;
                }
                if (!userId && session.user) {
                    userId = session.user.id ?? null;
                }

                // 🟢 DB에서 알림 상태 조회 (캐싱 적용)
                // 🟢 [보안] 쿠키 기반 인증: userId를 쿼리 파라미터로 보내지 않음 (서버 세션에서 추출)
                const { data: statusData, response: statusResponse } = await apiFetch<{ subscribed?: boolean }>(
                    `/api/push`,
                    {
                        cache: "force-cache", // 🟢 브라우저 캐시 사용
                        next: { revalidate: 300 }, // 🟢 5분 캐싱
                    }
                );

                if (statusResponse.ok && statusData) {
                    setNotificationEnabled(statusData.subscribed ?? false);
                } else {
                    setNotificationEnabled(false);
                }
            } catch (error) {
                console.error("알림 상태 조회 오류:", error);
                setNotificationEnabled(false);
            }
        };

        // 🟢 성능 최적화: 알림 상태는 지연 로드 (500ms 후)
        // 🟢 사용자가 알림 설정을 보기 전까지는 로드하지 않음
        if (userInfo) {
            const timer = setTimeout(() => {
                fetchNotificationStatus();
            }, 500);
            return () => clearTimeout(timer);
        } else {
            setNotificationEnabled(false);
        }
    }, [userInfo]);

    // 앱 환경 체크 (웹에서는 알림 설정 비활성화)
    const isMobileApp = typeof window !== "undefined" && !!(window as any).ReactNativeWebView;

    // 알림 토글 핸들러 (DB와 연결) - 앱에서만 동작
    const handleNotificationToggle = async () => {
        // 웹에서는 알림 설정 불가 - 모달 표시
        if (!isMobileApp) {
            setShowAppRequiredModal(true);
            return;
        }

        if (notificationEnabled === null) return; // 로딩 중 클릭 방지

        // Optimistic update: 즉시 UI 업데이트
        const newSubscribedState = !notificationEnabled;
        setNotificationEnabled(newSubscribedState);
        setNotificationStatus("loading");
        setNotificationMessage("");

        // Footer 등 다른 컴포넌트에 알림 상태 변경 전파
        if (typeof window !== "undefined") {
            window.dispatchEvent(
                new CustomEvent("notificationUpdated", { detail: { subscribed: newSubscribedState } })
            );
        }

        try {
            // 1. 앱에서 저장한 pushToken 가져오기 (localStorage)
            let expoPushToken = localStorage.getItem("expoPushToken");

            // 1-1. localStorage에 없으면 앱에 요청 (🟢 성능 최적화: 최대 300ms로 단축, 토큰이 오면 즉시 진행)
            if (!expoPushToken && (window as any).ReactNativeWebView) {
                (window as any).ReactNativeWebView.postMessage(JSON.stringify({ type: "requestPushToken" }));
                // 🟢 최적화: 더 짧은 대기 시간으로 빠른 응답 (최대 300ms, 토큰이 오면 즉시 진행)
                await new Promise<void>((resolve) => {
                    let timeout: ReturnType<typeof setTimeout>;
                    const checkInterval: ReturnType<typeof setInterval> = setInterval(() => {
                        const token = localStorage.getItem("expoPushToken");
                        if (token) {
                            clearInterval(checkInterval);
                            clearTimeout(timeout);
                            resolve();
                        }
                    }, 50); // 🟢 50ms마다 체크 (더 빠른 응답)
                    timeout = setTimeout(() => {
                        clearInterval(checkInterval);
                        resolve();
                    }, 300); // 🟢 최대 300ms 대기 (500ms -> 300ms로 단축)
                });
                expoPushToken = localStorage.getItem("expoPushToken");
            }

            // 🟢 [보안] 쿠키 기반 인증: userId를 body에 포함하지 않음 (서버 세션에서 추출)
            // 4. PushToken 서버에 업데이트 (subscribed 상태 토글) - 즉시 실행
            const pushData = await authenticatedFetch("/api/push", {
                method: "POST",
                body: JSON.stringify({
                    pushToken: expoPushToken || "", // 없으면 빈 문자열 (DB에 이미 있을 수 있음)
                    platform: "expo",
                    subscribed: newSubscribedState, // 토글된 상태
                }),
            });

            if (pushData !== null) {
                setNotificationStatus("success");
                setNotificationMessage(newSubscribedState ? t("mypage.profileTab.notificationOnSuccess") : t("mypage.profileTab.notificationOffSuccess"));

                // 🟢 알림을 끌 때 BenefitConsentModal 숨김 설정 제거 (다음 홈페이지 접속 시 모달 표시)
                if (!newSubscribedState && typeof window !== "undefined") {
                    localStorage.removeItem("benefitConsentModalHideUntil");
                }

                // 🟢 성능 최적화: 1.5초 후 메시지 제거 (2초 -> 1.5초로 단축)
                setTimeout(() => {
                    setNotificationMessage("");
                    setNotificationStatus("idle");
                }, 1500);
            } else {
                // 실패 시 원래 상태로 되돌리기
                setNotificationEnabled(!newSubscribedState);
                if (typeof window !== "undefined") {
                    window.dispatchEvent(
                        new CustomEvent("notificationUpdated", { detail: { subscribed: !newSubscribedState } })
                    );
                }
            }
        } catch (error: any) {
            console.error("알림 토글 오류:", error);
            // 실패 시 원래 상태로 되돌리기
            setNotificationEnabled(!newSubscribedState);
            if (typeof window !== "undefined") {
                window.dispatchEvent(
                    new CustomEvent("notificationUpdated", { detail: { subscribed: !newSubscribedState } })
                );
            }
            setNotificationStatus("error");
            setNotificationMessage(error.message || t("mypage.profileTab.notificationError"));
            // 3초 후 에러 메시지 제거
            setTimeout(() => {
                setNotificationMessage("");
                setNotificationStatus("idle");
            }, 3000);
        }
    };

    return (
        <React.Fragment>
            <div className="space-y-6 max-w-4xl mx-auto pb-10">
                {/* ======================================================================
          1. 기본 정보 카드 (Profile Card)
      ====================================================================== */}
                <div className="bg-white dark:bg-[#1a241b] rounded-xl border border-gray-100 dark:border-gray-800 p-6 md:p-8 relative overflow-hidden group">
                    {/* 배경 장식 (은은한 그라데이션) */}
                    <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-50 dark:bg-emerald-900/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 opacity-50 pointer-events-none"></div>

                    <div className="flex items-center justify-between mb-6 relative z-10">
                        <div className="flex items-center gap-2.5">
                            <h3 className="text-xl md:text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight">
                                {t("mypage.tabProfile")}
                            </h3>
                            <span
                                className={`shrink-0 px-3 py-1.5 text-xs md:text-sm font-bold rounded-full whitespace-nowrap border ${
                                    displayTier === "PREMIUM"
                                        ? "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-800/50"
                                        : displayTier === "BASIC"
                                        ? "bg-linear-to-r from-emerald-500 to-teal-500 text-white shadow-sm border-emerald-300"
                                        : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700"
                                }`}
                            >
                                {displayTier === "PREMIUM" ? t("mypage.profileTab.tierPremium") : displayTier === "BASIC" ? t("mypage.profileTab.tierBasic") : t("mypage.profileTab.tierFree")}
                            </span>
                        </div>
                        <button
                            onClick={onEditProfile}
                            className="px-4 py-2 text-sm font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 rounded-lg transition-all flex items-center gap-1.5 tracking-tight"
                        >
                            <span>{t("mypage.profileTab.edit")}</span>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth="2"
                                    d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                                ></path>
                            </svg>
                        </button>
                    </div>

                    {userInfo ? (
                        <div className="flex items-center gap-5 md:gap-7 relative z-10">
                            {/* 프로필 이미지 (테두리에 브랜드 컬러 포인트) */}
                            <div className="relative w-[88px] h-[88px] md:w-[100px] md:h-[100px] rounded-full p-1 bg-linear-to-br from-emerald-100 dark:from-emerald-900/30 to-white dark:to-gray-800 shadow-sm shrink-0">
                                <div className="relative w-full h-full rounded-full overflow-hidden border-2 border-white dark:border-gray-800 bg-gray-50 dark:bg-gray-800">
                                    <Image
                                        src={userInfo.profileImage || DEFAULT_PROFILE_IMG}
                                        loading="eager" // 🟢 프로필 이미지는 우선 로드 (활성 탭이므로)
                                        priority // 🟢 프로필 이미지는 priority 적용
                                        alt={userInfo.name || t("mypage.profileTab.profileAlt")}
                                        fill
                                        className="object-cover"
                                        sizes="(max-width: 768px) 64px, (max-width: 1200px) 128px, 256px"
                                    />
                                </div>
                            </div>

                            {/* 텍스트 정보 */}
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                    <h5 className="text-2xl font-black text-gray-900 dark:text-white truncate tracking-tight">
                                        {userInfo.name}
                                    </h5>
                                </div>
                                <p className="text-gray-500 dark:text-gray-400 text-sm md:text-base mb-4 truncate font-medium">
                                    {userInfo.email}
                                </p>

                                <div className="flex flex-wrap gap-2 text-xs md:text-sm font-semibold">
                                    {userInfo.age && (
                                        <span className="bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 px-3 py-1.5 rounded-lg">
                                            {userInfo.age}세
                                        </span>
                                    )}
                                    {userInfo.mbti && (
                                        <span className="bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-3 py-1.5 rounded-lg border border-amber-100/50 dark:border-amber-800/50">
                                            {userInfo.mbti}
                                        </span>
                                    )}
                                    <span className="bg-gray-5 dark:bg-gray-800 text-gray-400 dark:text-gray-500 px-3 py-1.5 rounded-lg">
                                        {t("mypage.profileTab.joinDate")} {userInfo.joinDate}
                                    </span>
                                </div>
                            </div>
                        </div>
                    ) : (
                        /* 로딩 스켈레톤 */
                        <div className="flex items-center gap-6 animate-pulse">
                            <div className="w-24 h-24 bg-gray-100 dark:bg-gray-800 rounded-full"></div>
                            <div className="flex-1 space-y-3">
                                <div className="h-8 bg-gray-100 dark:bg-gray-800 rounded-lg w-1/3"></div>
                                <div className="h-5 bg-gray-100 dark:bg-gray-800 rounded-lg w-1/2"></div>
                            </div>
                        </div>
                    )}
                </div>

                {/* ======================================================================
          2. 취향 정보 카드 (Preferences)
      ====================================================================== */}
                <div className="bg-white dark:bg-[#1a241b] rounded-xl border border-gray-100 dark:border-gray-800 p-6 md:p-8">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="text-xl md:text-2xl font-extrabold text-gray-900 dark:text-white flex items-center gap-2 tracking-tight">
                            {t("mypage.profileTab.myTravelPreferences")}
                        </h3>
                        <button
                            onClick={onEditPreferences}
                            className="px-5 py-2.5 text-sm font-bold text-white bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 rounded-lg transition-all tracking-tight"
                        >
                            {t("mypage.profileTab.editPreferences")}
                        </button>
                    </div>

                    {userPreferences ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                            {/* 선호 콘셉트 */}
                            {userPreferences.concept && userPreferences.concept.length > 0 && (
                                <div className="bg-gray-50 dark:bg-gray-800/50 p-5 rounded-xl border border-gray-100 dark:border-gray-700 hover:border-emerald-100 dark:hover:border-emerald-800/50 transition-colors group">
                                    <h4 className="text-xs font-bold text-gray-400 dark:text-gray-500 mb-3 uppercase tracking-wider group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                                        선호 콘셉트
                                    </h4>
                                    <div
                                        className="flex flex-nowrap gap-2 overflow-x-auto scrollbar-hide"
                                        style={{ maxWidth: "calc(6 * (80px + 8px))" }}
                                    >
                                        {userPreferences.concept.map((item, idx) => (
                                            <span
                                                key={idx}
                                                className="px-3.5 py-1.5 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 font-bold rounded-lg text-sm whitespace-nowrap shrink-0 border border-emerald-200 dark:border-emerald-800/50"
                                            >
                                                #{item}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* 선호 분위기 */}
                            {userPreferences.mood && userPreferences.mood.length > 0 && (
                                <div className="bg-gray-50 dark:bg-gray-800/50 p-5 rounded-xl border border-gray-100 dark:border-gray-700 hover:border-emerald-100 dark:hover:border-emerald-800/50 transition-colors group">
                                    <h4 className="text-xs font-bold text-gray-400 dark:text-gray-500 mb-3 uppercase tracking-wider group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                                        선호 분위기
                                    </h4>
                                    <div
                                        className="flex flex-nowrap gap-2 overflow-x-auto scrollbar-hide"
                                        style={{ maxWidth: "calc(6 * (80px + 8px))" }}
                                    >
                                        {userPreferences.mood.map((item, idx) => (
                                            <span
                                                key={idx}
                                                className="px-3.5 py-1.5 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 font-bold rounded-lg text-sm whitespace-nowrap shrink-0 border border-orange-200 dark:border-orange-800/50"
                                            >
                                                #{item}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* 선호 지역 */}
                            {userPreferences.regions && userPreferences.regions.length > 0 && (
                                <div className="bg-gray-50 dark:bg-gray-800/50 p-5 rounded-xl border border-gray-100 dark:border-gray-700 hover:border-emerald-100 dark:hover:border-emerald-800/50 transition-colors group">
                                    <h4 className="text-xs font-bold text-gray-400 dark:text-gray-500 mb-3 uppercase tracking-wider group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                                        관심 지역
                                    </h4>
                                    <div
                                        className="flex flex-nowrap gap-2 overflow-x-auto scrollbar-hide"
                                        style={{ maxWidth: "calc(6 * (80px + 8px))" }}
                                    >
                                        {userPreferences.regions.map((item, idx) => (
                                            <span
                                                key={idx}
                                                className="px-3.5 py-1.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 font-bold rounded-lg text-sm whitespace-nowrap shrink-0 border border-blue-200 dark:border-blue-800/50"
                                            >
                                                {item}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="text-center py-12 bg-gray-50 dark:bg-gray-800/50 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700">
                            <p className="text-gray-500 dark:text-gray-400 font-medium mb-4">
                                아직 등록된 취향 정보가 없어요 😢
                            </p>
                            <button
                                onClick={onEditPreferences}
                                className="text-emerald-600 dark:text-emerald-400 font-bold hover:underline hover:text-emerald-700 dark:hover:text-emerald-500 transition-colors"
                            >
                                지금 바로 설정하러 가기 &rarr;
                            </button>
                        </div>
                    )}
                </div>

                {/* ======================================================================
          2-1. 내 구독 / 이용권 카드 (Subscription & Tickets)
      ====================================================================== */}
                <MembershipSection userInfo={userInfo} />

                {/* ======================================================================
          3. 계정 관리 카드 (Account Settings)
      ====================================================================== */}
                <div className="bg-white dark:bg-[#1a241b] rounded-xl border border-gray-100 dark:border-gray-800 p-6 md:p-8">
                    <h3 className="text-xl md:text-2xl font-extrabold text-gray-900 dark:text-white mb-6 flex items-center gap-2 tracking-tight">
                        {t("mypage.profileTab.accountManagement")}
                    </h3>

                    <div className="flex flex-col space-y-3">
                        {/* 비밀번호 변경 버튼 */}
                        <button
                            onClick={onOpenPwModal}
                            className="w-full flex items-center justify-between px-6 py-4.5 rounded-xl bg-white dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700 hover:border-emerald-200 dark:hover:border-emerald-800/50 hover:bg-emerald-50/30 dark:hover:bg-emerald-900/20 transition-all group"
                        >
                            <div className="flex items-center gap-4">
                                <div className="p-2.5 bg-gray-100 dark:bg-gray-700 rounded-lg text-gray-600 dark:text-gray-400 group-hover:bg-white dark:group-hover:bg-gray-700 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                                    🔒
                                </div>
                                <span className="font-bold text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-white">
                                    {t("mypage.profileTab.changePassword")}
                                    </span>
                            </div>
                            <span className="text-gray-300 dark:text-gray-600 group-hover:text-emerald-400 dark:group-hover:text-emerald-500 group-hover:translate-x-1 transition-transform">
                                →
                            </span>
                        </button>

                        {/* 알림 설정 토글 버튼 영역 */}
                        <div>
                            <div className="w-full flex items-center justify-between px-6 py-4.5 rounded-xl bg-white dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700">
                                <div className="flex items-center gap-4">
                                    {/* 1. 아이콘 상자 */}
                                    <div className="relative">
                                        <div
                                            className={`p-2.5 rounded-lg transition-all duration-300 ${
                                                notificationEnabled === true
                                                    ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400"
                                                    : "bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500"
                                            }`}
                                        >
                                            {notificationEnabled === true ? (
                                                <svg
                                                    xmlns="http://www.w3.org/2000/svg"
                                                    width="20"
                                                    height="20"
                                                    viewBox="0 0 24 24"
                                                    fill="none"
                                                    stroke="currentColor"
                                                    strokeWidth="2"
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                    className="w-5 h-5"
                                                >
                                                    <path d="M10.268 21a2 2 0 0 0 3.464 0" />
                                                    <path d="M6 8a6 6 0 0 1 12 0c0 4.499-1.41 5.956-2.74 7.327A1 1 0 0 1 14 17H4a1 1 0 0 1-.74-1.673C4.59 13.956 6 12.499 6 8Z" />
                                                </svg>
                                            ) : (
                                                <svg
                                                    xmlns="http://www.w3.org/2000/svg"
                                                    width="20"
                                                    height="20"
                                                    viewBox="0 0 24 24"
                                                    fill="none"
                                                    stroke="currentColor"
                                                    strokeWidth="2"
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                    className="w-5 h-5"
                                                >
                                                    <path d="M10.268 21a2 2 0 0 0 3.464 0" />
                                                    <path d="M17 17H4a1 1 0 0 1-.74-1.673C4.59 13.956 6 12.499 6 8a6 6 0 0 1 .258-1.742" />
                                                    <path d="m2 2 20 20" />
                                                    <path d="M8.668 3.01A6 6 0 0 1 18 8c0 2.687.77 4.653 1.707 6.05" />
                                                </svg>
                                            )}
                                        </div>

                                        {/* 🔴 빨간 점 (알림이 꺼져 있을 때 왼쪽 위에 표시) - 로딩 중 아닐 때만 */}
                                        {notificationEnabled === false && (
                                            <span className="absolute -top-1 -left-1 flex h-3 w-3">
                                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500 border-2 border-white dark:border-gray-800"></span>
                                            </span>
                                        )}
                                    </div>

                                    <div className="flex flex-col items-start">
                                        <span
                                            className={`font-bold transition-colors duration-300 ${
                                                notificationEnabled === true
                                                    ? "text-gray-800 dark:text-gray-200"
                                                    : "text-gray-400 dark:text-gray-500"
                                            }`}
                                        >
                                            {t("mypage.profileTab.notificationSettings")}
                                        </span>
                                        <span
                                            className={`text-xs font-medium transition-colors duration-300 ${
                                                notificationEnabled === true
                                                    ? "text-emerald-600 dark:text-emerald-400"
                                                    : "text-gray-400 dark:text-gray-500"
                                            }`}
                                        >
                                            {!isMobileApp
                                                ? t("mypage.profileTab.notificationAppOnlyDesc")
                                                : notificationEnabled === null
                                                ? t("mypage.profileTab.notificationLoading")
                                                : notificationStatus === "loading"
                                                ? t("mypage.profileTab.notificationProcessing")
                                                : notificationEnabled === true
                                                ? t("mypage.profileTab.notificationOn")
                                                : t("mypage.profileTab.notificationOff")}
                                        </span>
                                    </div>
                                </div>

                                {/* 2. 토글 스위치 */}
                                {notificationEnabled === null ? (
                                    /* 로딩 시 스켈레톤 토글 */
                                    <div className="h-7 w-12 rounded-full bg-gray-200 dark:bg-gray-700 animate-pulse"></div>
                                ) : (
                                    <button
                                        onClick={handleNotificationToggle}
                                        disabled={notificationStatus === "loading" || !isMobileApp}
                                        className={`relative inline-flex h-7 w-12 shrink-0 rounded-full transition-colors duration-300 ease-in-out focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 ${
                                            !isMobileApp
                                                ? "bg-gray-200 dark:bg-gray-700 cursor-not-allowed opacity-50"
                                                : notificationStatus === "loading"
                                                ? "bg-gray-200 dark:bg-gray-700 cursor-not-allowed opacity-50"
                                                : notificationEnabled
                                                ? "bg-emerald-500 dark:bg-emerald-600 cursor-pointer"
                                                : "bg-gray-200 dark:bg-gray-700 cursor-pointer"
                                        }`}
                                        role="switch"
                                        aria-checked={notificationEnabled}
                                        aria-label={t("mypage.profileTab.notificationSettings")}
                                        title={!isMobileApp ? t("mypage.profileTab.notificationAppOnlyTitle") : ""}
                                    >
                                        <span
                                            className={`absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-white dark:bg-gray-300 shadow-md ring-0 transition-all duration-300 ease-in-out flex items-center justify-center ${
                                                notificationEnabled ? "translate-x-5" : "translate-x-0"
                                            }`}
                                        >
                                            {notificationStatus === "loading" && (
                                                <div className="h-3 w-3 animate-spin rounded-full border-2 border-gray-300 dark:border-gray-600 border-t-emerald-500 dark:border-t-emerald-400" />
                                            )}
                                        </span>
                                    </button>
                                )}
                            </div>

                            {/* 메시지 알림 */}
                            {notificationMessage && (
                                <div
                                    className={`mt-3 px-4 py-2.5 rounded-lg text-sm font-medium animate-in fade-in slide-in-from-top-2 ${
                                        notificationStatus === "success"
                                            ? "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50"
                                            : notificationStatus === "error"
                                            ? "bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800/50"
                                            : "bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400"
                                    }`}
                                >
                                    {notificationMessage}
                                </div>
                            )}
                        </div>
                        <div className="h-px bg-gray-100 dark:bg-gray-700 my-2"></div>

                        {/* ✅ [최종 수정] 설명 없이 깔끔한 '한 줄' 스타일 */}
                        <button
                            onClick={() => window.open("https://pf.kakao.com/_uxnZHn/chat", "_blank")}
                            className="w-full flex items-center justify-between px-6 py-5 bg-white dark:bg-gray-800/50 rounded-xl border border-gray-100 dark:border-gray-700 hover:border-[#FEE500] dark:hover:border-yellow-500/50 hover:bg-yellow-50/10 dark:hover:bg-yellow-900/10 transition-all duration-200 group"
                        >
                            <div className="flex items-center gap-4">
                                {/* 1. 아이콘: 옐로우 포인트로 시선 집중 */}
                                <div className="w-10 h-10 rounded-lg bg-[#FEE500] flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                                    {/* 확성기 아이콘 */}
                                    <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-[#3b1e1e]">
                                        <path d="M21.41 11.58l-9-9C12.05 2.22 11.55 2 11 2H4c-1.1 0-2 .9-2 2v7c0 .55.22 1.05.59 1.42l9 9c.36.36.86.58 1.41.58.55 0 1.05-.22 1.41-.59l7-7c.37-.36.59-.86.59-1.41 0-.55-.23-1.06-.59-1.42zM5.5 7C4.67 7 4 6.33 4 5.5S4.67 4 5.5 4 7 4.67 7 5.5 6.33 7 5.5 7z" />
                                    </svg>
                                </div>

                                {/* 2. 텍스트: 딱 한 줄로 끝내기 */}
                                <span className="flex flex-col font-bold text-gray-800 dark:text-gray-200 text-[16px] group-hover:text-gray-900 dark:group-hover:text-white">
                                    {t("mypage.profileTab.kakaoCta")}{" "}
                                    <span className="text-yellow-600 dark:text-yellow-500">{t("mypage.profileTab.kakaoCtaHighlight")}</span>
                                </span>
                            </div>

                            {/* 3. 화살표 */}
                            <span className="text-gray-300 dark:text-gray-600 group-hover:text-[#FEE500] dark:group-hover:text-yellow-500 group-hover:translate-x-1 transition-transform">
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    strokeWidth={2.5}
                                    stroke="currentColor"
                                    className="w-5 h-5"
                                >
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                                </svg>
                            </span>
                        </button>
                        <div className="h-px bg-gray-100 dark:bg-gray-700 my-2"></div>

                        {/* 로그아웃 버튼 */}
                        <button
                            onClick={onLogout}
                            className="w-full flex items-center justify-between px-6 py-4.5 rounded-xl bg-red-50/50 dark:bg-red-900/20 border border-transparent dark:border-red-900/30 hover:border-red-100 dark:hover:border-red-800/50 hover:bg-red-50 dark:hover:bg-red-900/30 transition-all group"
                        >
                            <div className="flex items-center gap-4">
                                <div className="p-2.5 bg-white dark:bg-gray-800 rounded-xl text-red-400 dark:text-red-500 group-hover:text-red-500 dark:group-hover:text-red-400 shadow-sm">
                                    <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        width="20"
                                        height="20"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        className="w-5 h-5"
                                    >
                                        <path d="m16 17 5-5-5-5" />
                                        <path d="M21 12H9" />
                                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                                    </svg>
                                </div>
                                <span className="font-bold text-red-500 dark:text-red-400 group-hover:text-red-600 dark:group-hover:text-red-300">
                                    {t("mypage.profileTab.logout")}
                                    </span>
                            </div>
                            <span className="text-red-200 dark:text-red-800 group-hover:text-red-400 dark:group-hover:text-red-500 group-hover:translate-x-1 transition-transform">
                                →
                            </span>
                        </button>
                        <div className="h-px bg-gray-100 dark:bg-gray-700 my-2"></div>

                        {/* 탈퇴 버튼 */}
                        <button
                            onClick={() => setShowWithdrawalModal(true)}
                            className="w-full flex items-center justify-between px-6 py-4.5 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all group"
                        >
                            <div className="flex items-center gap-4">
                                <div className="p-2.5 bg-white dark:bg-gray-700 rounded-xl text-gray-500 dark:text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300 shadow-sm">
                                    <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        width="20"
                                        height="20"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        className="w-5 h-5"
                                    >
                                        <path d="M10 11v6" />
                                        <path d="M14 11v6" />
                                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                                        <path d="M3 6h18" />
                                        <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                    </svg>
                                </div>
                                <span className="font-bold text-gray-600 dark:text-gray-400 group-hover:text-gray-700 dark:group-hover:text-gray-300">
                                    {t("mypage.profileTab.withdrawAccount")}
                                </span>
                            </div>
                            <span className="text-gray-300 dark:text-gray-600 group-hover:text-gray-400 dark:group-hover:text-gray-500 group-hover:translate-x-1 transition-transform">
                                →
                            </span>
                        </button>
                    </div>

                    {/* 알림 설정 앱 필요 모달 */}
                    {showAppRequiredModal && (
                        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-2000 animate-in fade-in duration-200 p-4">
                            <div className="bg-white dark:bg-[#1a241b] rounded-xl border border-gray-100 dark:border-gray-800 p-8 w-full max-w-sm transform transition-all animate-in zoom-in-95 duration-200">
                                <div className="text-center mb-6 tracking-tight">
                                    {/* 아이콘 */}
                                    <div className="flex justify-center mb-4">
                                        <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                                            <span className="text-3xl">📱</span>
                                        </div>
                                    </div>
                                    <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2 tracking-tight">
                                        {t("profileAppRequiredModal.title")}
                                    </h3>
                                    <p className="text-gray-500 dark:text-gray-400 font-medium tracking-tight leading-relaxed whitespace-pre-line">
                                        {t("profileAppRequiredModal.desc")}
                                    </p>
                                </div>

                                <div className="flex gap-3">
                                    <button
                                        onClick={() => setShowAppRequiredModal(false)}
                                        className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-700 dark:text-gray-300 font-semibold hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                                    >
                                        {t("profileAppRequiredModal.close")}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* 탈퇴 확인 모달 */}
                    <DeleteUsersModal
                        isOpen={showWithdrawalModal}
                        onClose={() => setShowWithdrawalModal(false)}
                        subscriptionTier={userInfo?.subscriptionTier}
                        subscriptionExpiresAt={userInfo?.subscriptionExpiresAt}
                        onConfirm={async (withdrawalReason?: string) => {
                            try {
                                // 🟢 쿠키 기반 인증: authenticatedFetch 사용
                                const data = await authenticatedFetch<{
                                    error?: string;
                                    hasActiveSubscription?: boolean;
                                    details?: string;
                                }>("/api/users/delete", {
                                    method: "DELETE",
                                    body: JSON.stringify({
                                        withdrawalReason: withdrawalReason || null,
                                    }),
                                });

                                if (data === null) {
                                    // 인증 실패
                                    alert(t("courses.loginRequired"));
                                    return;
                                }

                                // authenticatedFetch는 성공 시 데이터를 반환하므로, null이 아니면 성공
                                // 탈퇴 성공 - 쿠키 기반 로그아웃으로 세션 정리 후 리다이렉트
                                const { logout } = await import("@/lib/authClient");
                                await logout({ skipRedirect: true });

                                if (typeof window !== "undefined") {
                                    window.dispatchEvent(new CustomEvent("authTokenChange"));
                                }

                                alert(t("profile.deleteSuccess"));
                                window.location.href = "/";
                            } catch (error: any) {
                                // 구독 중인 경우 특별 처리
                                if (error.message && error.message.includes("구독")) {
                                    alert(error.message);
                                } else {
                                    alert(t("profile.deleteError"));
                                }
                            }
                        }}
                    />
                    {/* 사업자 정보 */}
                    <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                        <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">{t("mypage.profileTab.businessInfo")}</h4>
                        <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1 leading-relaxed mb-4">
                            <p className="font-semibold text-gray-600 dark:text-gray-400">(주)두나 (DoNa)</p>
                            <p>대표: 오승용 | 사업자등록번호: 166-10-03081</p>
                            <p>통신판매업 신고번호: 제 2025-충남홍성-0193 호</p>
                            <p>주소: 충청남도 홍성군 홍북읍 신대로 33</p>
                            <p>문의: 12jason@donacouse.com</p>
                            <p>고객센터: 010-2481-9824</p>
                        </div>
                        {/* 서비스 소개, 이용 안내, 개인정보처리방침, 이용약관 */}
                        <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                            <Link
                                href="/about"
                                prefetch={true}
                                className="text-xs font-medium text-gray-400 dark:text-gray-500 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors py-1"
                            >
                                {t("mypage.profileTab.footerServiceIntro")}
                            </Link>
                            <Link
                                href="/help"
                                prefetch={true}
                                className="text-xs font-medium text-gray-400 dark:text-gray-500 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors py-1"
                            >
                                {t("mypage.profileTab.footerUsage")}
                            </Link>
                            <Link
                                href="/privacy"
                                prefetch={true}
                                className="text-xs font-medium text-gray-400 dark:text-gray-500 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors py-1"
                            >
                                {t("mypage.profileTab.footerPrivacy")}
                            </Link>
                            <Link
                                href="/terms"
                                prefetch={true}
                                className="text-xs font-medium text-gray-400 dark:text-gray-500 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors py-1"
                            >
                                {t("mypage.profileTab.footerTerms")}
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        </React.Fragment>
    );
};

// 🟢 성능 최적화: React.memo로 불필요한 리렌더링 방지
export default memo(ProfileTab);
