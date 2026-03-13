"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback, useRef } from "react";
import { RECOMMENDATION_MESSAGES, UserTagType } from "@/constants/recommendations";
import { CHIP_DEFINITIONS, type ChipId } from "@/constants/chipRules";
import TranslatedCourseTitle from "@/components/TranslatedCourseTitle";
import LoginModal from "@/components/LoginModal";
import { useLocale } from "@/context/LocaleContext";
import HorizontalScrollContainer from "@/components/HorizontalScrollContainer";

interface Course {
    id: number;
    title: string;
    imageUrl: string | null;
    region: string | null;
    tags: any;
    matchScore?: number;
    coursePlaces?: Array<{ place: { imageUrl?: string } }>;
    chips?: ChipId[];
}

const MAIN_REC_CACHE_PREFIX = "dona_main_rec_";

function getKstDateStr(): string {
    const kst = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
    return kst.toISOString().slice(0, 10);
}

function getMainDayType(): "today" | "weekend" {
    const kst = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
    return kst.getDay() === 0 || kst.getDay() === 6 ? "weekend" : "today";
}

function readMainRecommendationCache(key: string): { recommendations: Course[]; hasOnboardingData: boolean; tagType: UserTagType } | null {
    try {
        const raw = typeof sessionStorage !== "undefined" ? sessionStorage.getItem(key) : null;
        if (!raw) return null;
        const parsed = JSON.parse(raw) as { recommendations?: Course[]; hasOnboardingData?: boolean; tagType?: UserTagType };
        if (!Array.isArray(parsed.recommendations) || parsed.recommendations.length === 0) return null;
        return {
            recommendations: parsed.recommendations,
            hasOnboardingData: Boolean(parsed.hasOnboardingData),
            tagType: parsed.tagType ?? "default",
        };
    } catch {
        return null;
    }
}

function saveMainRecommendationCache(
    key: string,
    recommendations: Course[],
    hasOnboardingData: boolean,
    tagType: UserTagType
) {
    try {
        if (typeof sessionStorage !== "undefined" && recommendations.length > 0) {
            sessionStorage.setItem(
                key,
                JSON.stringify({ recommendations, hasOnboardingData, tagType })
            );
        }
    } catch {}
}

export default function PersonalizedSection() {
    const router = useRouter();
    const { t } = useLocale();
    const [courses, setCourses] = useState<Course[]>([]);
    const [loading, setLoading] = useState(true);
    const [userName, setUserName] = useState(() => "");
    const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null); // 🟢 null = 아직 확인 중
    const [hasOnboardingData, setHasOnboardingData] = useState(false); // 온보딩 데이터 보유 여부
    const [currentTagType, setCurrentTagType] = useState<UserTagType>("default");

    const [showMoreModal, setShowMoreModal] = useState(false);
    // 🟢 모달 내 오늘/주말 탭 (today=오늘, weekend=주말)
    const [dayBanner, setDayBanner] = useState<"today" | "weekend">("today");
    const [weekendCourses, setWeekendCourses] = useState<Course[]>([]);
    const [weekendLoading, setWeekendLoading] = useState(false);
    const [showLoginModal, setShowLoginModal] = useState(false);
    // 🟢 모달 드래그로 닫기
    const dragRef = useRef({ startY: 0, currentY: 0 });
    const [modalDragY, setModalDragY] = useState(0);
    // 주말(토·일)엔 dayBanner=weekend 고정. 평일엔 today
    useEffect(() => {
        const kst = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
        setDayBanner(kst.getDay() === 0 || kst.getDay() === 6 ? "weekend" : "today");
    }, []);

    useEffect(() => {
        if (showMoreModal) setModalDragY(0);
    }, [showMoreModal]);

    // 🟢 데이터 가져오기 함수 (오늘 추천 캐시: 2번째 진입 시 즉시 표시 후 백그라운드 갱신)
    const fetchData = useCallback(async () => {
        const { fetchSession, apiFetch } = await import("@/lib/authClient");

        // 1. 세션 확인
        const session = await fetchSession();
        const isUserAuthenticated = session.authenticated && session.user;

        // 2. 로그인 상태 및 이름 설정
        if (isUserAuthenticated && session.user) {
            setIsLoggedIn(true);
            const sessionName = (session.user.name || session.user.nickname || "").trim();
            setUserName(sessionName || t("commonFallback.member"));
        } else {
            setIsLoggedIn(false);
            setUserName(t("commonFallback.member"));
            setHasOnboardingData(false);
        }

        const mainDayType = getMainDayType();
        const kstDateStr = getKstDateStr();
        const userId = session.user?.id != null ? String(session.user.id) : "guest";
        const cacheKey = `${MAIN_REC_CACHE_PREFIX}${kstDateStr}_${mainDayType}_${userId}`;

        // 3. 🟢 오늘 추천 캐시 확인 → 있으면 즉시 표시 후 백그라운드에서 API 호출
        const cached = readMainRecommendationCache(cacheKey);
        if (cached) {
            setCourses(cached.recommendations);
            setHasOnboardingData(cached.hasOnboardingData);
            setCurrentTagType(cached.tagType);
            setLoading(false);
            // 백그라운드에서 최신 데이터로 갱신 (같은 날이면 결과 동일할 가능성 높음)
            apiFetch(`/api/recommendations?limit=3&dayType=${mainDayType}`, {
                cache: isUserAuthenticated ? "no-store" : "force-cache",
                next: { revalidate: isUserAuthenticated ? 0 : 300 },
            })
                .then(({ data, response }) => {
                    if (!response.ok || !data) return;
                    const recommendations = (data as any)?.recommendations || [];
                    if (recommendations.length === 0) return;
                    const apiHasOnboardingData = (data as any)?.hasOnboardingData === true;
                    let hasOnboarding = apiHasOnboardingData;
                    if (isUserAuthenticated && !apiHasOnboardingData) {
                        const hasMatchScore = recommendations.some(
                            (c: any) => c.matchScore !== undefined && c.matchScore !== null
                        );
                        hasOnboarding =
                            hasMatchScore ||
                            (session.user as any)?.hasOnboarding === true ||
                            (session.user as any)?.onboardingComplete === true;
                    }
                    let tagType: UserTagType = isUserAuthenticated ? "default" : "guest";
                    if (isUserAuthenticated && recommendations[0]?.tags) {
                        const topTags = recommendations[0].tags;
                        if (topTags.concept?.includes("힐링") || topTags.mood?.includes("조용한")) tagType = "healing";
                        else if (
                            topTags.concept?.includes("인생샷") ||
                            topTags.mood?.includes("사진") ||
                            topTags.mood?.includes("인스타")
                        )
                            tagType = "photo";
                        else if (topTags.concept?.includes("맛집") || topTags.concept?.includes("먹방")) tagType = "food";
                        else if (topTags.budget === "저렴함" || topTags.concept?.includes("가성비")) tagType = "cost";
                        else if (topTags.mood?.includes("활동적인")) tagType = "activity";
                    }
                    setCourses(recommendations);
                    setHasOnboardingData(hasOnboarding);
                    setCurrentTagType(tagType);
                    saveMainRecommendationCache(cacheKey, recommendations, hasOnboarding, tagType);
                })
                .catch(() => {});
            return;
        }

        // 4. 캐시 없음 → API 호출 후 표시 및 캐시 저장
        try {
            setLoading(true);
            const { data, response } = await apiFetch(`/api/recommendations?limit=3&dayType=${mainDayType}`, {
                cache: isUserAuthenticated ? "no-store" : "force-cache",
                next: { revalidate: isUserAuthenticated ? 0 : 300 },
            });

            if (!response.ok || !data) {
                setCourses([]);
                setHasOnboardingData(false);
                setLoading(false);
                return;
            }

            const recommendations = (data as any)?.recommendations || [];
            const apiHasOnboardingData = (data as any)?.hasOnboardingData === true;

            if (recommendations.length > 0) {
                let hasOnboarding = false;
                if (isUserAuthenticated) {
                    if (apiHasOnboardingData) {
                        hasOnboarding = true;
                    } else {
                        const hasMatchScore = recommendations.some(
                            (c: any) => c.matchScore !== undefined && c.matchScore !== null
                        );
                        hasOnboarding =
                            hasMatchScore ||
                            (session.user as any)?.hasOnboarding === true ||
                            (session.user as any)?.onboardingComplete === true;
                    }
                }
                setCourses(recommendations);
                setHasOnboardingData(hasOnboarding);

                let tagType: UserTagType = isUserAuthenticated ? "default" : "guest";
                if (isUserAuthenticated && recommendations[0]?.tags) {
                    const topTags = recommendations[0].tags;
                    if (topTags.concept?.includes("힐링") || topTags.mood?.includes("조용한")) tagType = "healing";
                    else if (
                        topTags.concept?.includes("인생샷") ||
                        topTags.mood?.includes("사진") ||
                        topTags.mood?.includes("인스타")
                    )
                        tagType = "photo";
                    else if (topTags.concept?.includes("맛집") || topTags.concept?.includes("먹방")) tagType = "food";
                    else if (topTags.budget === "저렴함" || topTags.concept?.includes("가성비")) tagType = "cost";
                    else if (topTags.mood?.includes("활동적인")) tagType = "activity";
                }
                setCurrentTagType(tagType);
                saveMainRecommendationCache(cacheKey, recommendations, hasOnboarding, tagType);
            } else {
                setCourses([]);
                setCurrentTagType(isUserAuthenticated ? "default" : "guest");
            }
        } catch (error) {
            console.error("추천 로딩 실패:", error);
            setCourses([]);
        } finally {
            setLoading(false);
        }
    }, [t]);

    const fetchWeekendData = useCallback(async () => {
        const { fetchSession, apiFetch } = await import("@/lib/authClient");
        const session = await fetchSession();
        if (!session.authenticated || !session.user) return;
        setWeekendLoading(true);
        try {
            const { data, response } = await apiFetch("/api/recommendations?limit=3&dayType=weekend", {
                cache: "no-store",
                next: { revalidate: 0 },
            });
            if (response.ok && data) {
                const recs = (data as any)?.recommendations || [];
                setWeekendCourses(Array.isArray(recs) ? recs : []);
            }
        } catch {
            setWeekendCourses([]);
        } finally {
            setWeekendLoading(false);
        }
    }, []);

    // 🟢 [성능] 첫 페인트 후 추천 API 호출 (LCP 개선, 계산/정확도 동일)
    useEffect(() => {
        const t = setTimeout(fetchData, 0);
        return () => clearTimeout(t);
    }, [fetchData]);

    const isMainWeekend = (() => {
        const kst = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
        return kst.getDay() === 0 || kst.getDay() === 6;
    })();

    // 평일일 때만 주말 탭 클릭 시 weekend 데이터 fetch (주말엔 메인=weekend라 별도 호출 불필요)
    useEffect(() => {
        if (dayBanner === "weekend" && !isMainWeekend && isLoggedIn && weekendCourses.length === 0 && !weekendLoading) {
            fetchWeekendData();
        }
    }, [dayBanner, isMainWeekend, isLoggedIn, weekendCourses.length, weekendLoading, fetchWeekendData]);

    // 🟢 로그인 성공/로그아웃 이벤트 리스너
    useEffect(() => {
        const handleAuthChange = () => {
            // 로그인 성공 시 데이터 다시 가져오기 (새로운 유저 정보로)
            // 🟢 상태 초기화 후 재로드하여 온보딩 데이터 확인
            setHasOnboardingData(false);
            fetchData();
        };

        const handleLogout = () => {
            setCourses([]);
            setWeekendCourses([]);
            setUserName(t("commonFallback.member"));
            setIsLoggedIn(false);
            setCurrentTagType("guest");
            setLoading(false);
            setWeekendLoading(false);
            setHasOnboardingData(false);
        };

        window.addEventListener("authLoginSuccess", handleAuthChange);
        window.addEventListener("authTokenChange", handleAuthChange);
        window.addEventListener("authLogout", handleLogout);

        return () => {
            window.removeEventListener("authLoginSuccess", handleAuthChange);
            window.removeEventListener("authTokenChange", handleAuthChange);
            window.removeEventListener("authLogout", handleLogout);
        };
    }, [fetchData]);

    // 로딩 중이거나 데이터 없으면 아무것도 안 보여줌
    if (!loading && courses.length === 0) return null;

    // 🟢 로그인 상태 확인이 완료되지 않았으면 로딩 중으로 처리
    if (isLoggedIn === null) {
        return (
            <section className="py-8 px-4">
                <div className="mb-6">
                    <div className="h-6 bg-gray-200 rounded animate-pulse w-64 mb-2" />
                    <div className="h-4 bg-gray-200 rounded animate-pulse w-48" />
                </div>
                <HorizontalScrollContainer className="flex overflow-x-auto gap-4 scrollbar-hide pb-4 -mx-4 px-4">
                    {[1, 2, 3].map((n) => (
                        <div key={n} className="shrink-0 w-[200px] aspect-3/4 bg-gray-100 rounded-xl animate-pulse" />
                    ))}
                </HorizontalScrollContainer>
            </section>
        );
    }

    // ✅ 여기서 멘트를 가져옵니다!
    // 비로그인 상태이면 무조건 guest 메시지 사용, 로그인 상태이면 태그 분석 결과 사용
    const content = !isLoggedIn
        ? RECOMMENDATION_MESSAGES["guest"]
        : RECOMMENDATION_MESSAGES[currentTagType] || RECOMMENDATION_MESSAGES["default"];

    return (
        <section className="py-2 px-6">
            {/* 1. 헤더: 오늘의 선택 (18px/700) + 설명(비로그인 시) */}
            <div className="mb-4">
                {loading && isLoggedIn ? (
                    <div className="space-y-2">
                        <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-40" />
                        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-56" />
                    </div>
                ) : (
                    <>
                        <h2 className="text-lg font-bold text-emerald-600 dark:text-emerald-400 animate-fade-in">
                            {t("personalized.todayPick")}
                        </h2>
                        {!isLoggedIn && (
                            <p className="text-[14px] font-normal text-[#7A8E99] dark:text-gray-500 mt-1 animate-fade-in">
                                {t("personalized.loginHint")}
                            </p>
                        )}
                        {isLoggedIn && content.sectionTitle && (
                            <p className="text-[12px] text-gray-400 dark:text-gray-500 font-medium mt-1 animate-fade-in">
                                {content.sectionTitle}
                            </p>
                        )}
                    </>
                )}
            </div>

            {/* 2. 카드: 이미지(220px) → 제목 → 칩 → CTA - 이미지 가로 전체 커버 */}
            <div className="flex flex-col rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.06)] dark:shadow-[0_2px_8px_rgba(0,0,0,0.2)] overflow-hidden w-full bg-white dark:bg-[#1a241b]">
                <div className="flex flex-col">
                    {loading ? (
                        <div className="w-full h-[220px] bg-gray-100 dark:bg-gray-800 rounded-t-2xl animate-pulse shrink-0" />
                    ) : courses.length > 0 ? (
                        <>
                            <div
                                role="button"
                                tabIndex={0}
                                onClick={() => router.push(`/courses/${courses[0].id}`)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") router.push(`/courses/${courses[0].id}`);
                                }}
                                className="block w-full shrink-0 group relative select-none cursor-pointer"
                            >
                                <div className="relative w-full h-[220px] rounded-t-2xl overflow-hidden transition-transform active:scale-[0.98]">
                                    <div className="absolute inset-0 bg-gray-200 dark:bg-gray-800">
                                        {(() => {
                                            const c = courses[0];
                                            const courseImage = c.imageUrl?.trim() || "";
                                            const firstPlaceImage = c.coursePlaces?.[0]?.place?.imageUrl?.trim() || "";
                                            const imageUrl = courseImage || firstPlaceImage;
                                            return imageUrl ? (
                                                <Image
                                                    src={imageUrl}
                                                    fill
                                                    alt={c.title}
                                                    className="object-cover object-center"
                                                    sizes="100vw"
                                                    priority
                                                    loading="eager"
                                                    quality={70}
                                                    fetchPriority="high"
                                                />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">
                                                    No Image
                                                </div>
                                            );
                                        })()}
                                    </div>
                                </div>
                            </div>
                            <div className="p-4 pt-2">
                                {!isLoggedIn && (
                                    <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400 mb-1.5 animate-fade-in">
                                        {t("personalized.howRecommended")}
                                    </p>
                                )}
                                <h3 className="text-lg font-semibold text-gray-900 dark:text-white leading-snug animate-fade-in tracking-tight">
                                    <TranslatedCourseTitle title={courses[0].title} />
                                </h3>
                                {courses[0].chips && courses[0].chips.length > 0 && (
                                    <div className="flex flex-wrap gap-2 mt-2">
                                        {courses[0].chips.map((chipId) => {
                                            const def = CHIP_DEFINITIONS[chipId];
                                            if (!def) return null;
                                            return (
                                                <span
                                                    key={chipId}
                                                    className="inline-flex px-2.5 py-1 rounded-full text-[13px] font-medium bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300"
                                                >
                                                    #{def.label}
                                                </span>
                                            );
                                        })}
                                    </div>
                                )}
                                <button
                                    type="button"
                                    onClick={() => router.push(`/courses/${courses[0].id}`)}
                                    className="mt-4 inline-flex items-center gap-1 px-4 py-2 rounded-full text-[14px] font-semibold bg-emerald-600 hover:bg-emerald-500 text-white active:opacity-90 cursor-pointer transition-colors"
                                >
                                    {t("personalized.viewCourse")}
                                    <span className="inline-block">→</span>
                                </button>
                            </div>
                        </>
                    ) : null}
                </div>
                {!loading && courses.length >= 2 && isLoggedIn === true && (
                    <div className="flex justify-end mt-3">
                        <button
                            type="button"
                            onClick={() => setShowMoreModal(true)}
                            className="text-[14px] font-medium text-emerald-600 dark:text-emerald-400 hover:underline inline-flex items-center gap-1"
                        >
                            {t("personalized.viewMore")}
                            <span className="inline-block">→</span>
                        </button>
                    </div>
                )}
            </div>

            {/* 다른 코스 모달 (하단 시트, 바닥에 붙임, 드래그로 닫기) */}
            {showMoreModal && courses.length >= 2 && (
                <div
                    className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
                    onClick={() => setShowMoreModal(false)}
                    role="presentation"
                >
                    <div
                        className="bg-white dark:bg-[#1a241b] rounded-t-4xl w-full max-w-md h-[80vh] flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-300 transition-transform"
                        onClick={(e) => e.stopPropagation()}
                        style={{ transform: `translateY(${Math.max(0, modalDragY)}px)` }}
                    >
                        <div
                            className="flex justify-center pt-3 pb-1 shrink-0 cursor-grab active:cursor-grabbing touch-manipulation"
                            onTouchStart={(e) => {
                                dragRef.current.startY = e.touches[0].clientY;
                            }}
                            onTouchMove={(e) => {
                                const y = e.touches[0].clientY;
                                const delta = y - dragRef.current.startY;
                                if (delta > 0) {
                                    setModalDragY(delta);
                                }
                            }}
                            onTouchEnd={() => {
                                if (modalDragY > 80) {
                                    setShowMoreModal(false);
                                    setModalDragY(0);
                                } else {
                                    setModalDragY(0);
                                }
                            }}
                        >
                            <div className="w-10 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full" />
                        </div>
                        {/* 평일: 오늘+주말 탭 | 주말: 주말만 (오늘 탭 숨김) */}
                        <div className="flex gap-2 px-4 pb-3">
                            {!isMainWeekend && (
                                <button
                                    type="button"
                                    onClick={() => setDayBanner("today")}
                                    className={`px-4 py-2 rounded-full text-sm font-semibold transition-all ${
                                        dayBanner === "today"
                                            ? "bg-emerald-600 text-white dark:bg-emerald-500"
                                            : "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400"
                                    }`}
                                >
                                    {t("personalized.today")}
                                </button>
                            )}
                            <button
                                type="button"
                                onClick={() => setDayBanner("weekend")}
                                className={`px-4 py-2 rounded-full text-sm font-semibold transition-all ${
                                    dayBanner === "weekend"
                                        ? "bg-emerald-600 text-white dark:bg-emerald-500"
                                        : "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400"
                                }`}
                            >
                                {t("personalized.weekend")}
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto px-4 pb-6 space-y-4 scrollbar-hide">
                            {(() => {
                                // 주말: 메인=weekend면 courses, 평일이면 weekendCourses | 오늘: courses(평일만 노출)
                                const modalData =
                                    dayBanner === "weekend" ? (isMainWeekend ? courses : weekendCourses) : courses;
                                const modalLoading = dayBanner === "weekend" && !isMainWeekend && weekendLoading;
                                const hasMainInList =
                                    (dayBanner === "weekend" && isMainWeekend) ||
                                    (dayBanner === "today" && !isMainWeekend);
                                const displayList = hasMainInList ? modalData.slice(1, 3) : modalData.slice(0, 3);
                                return modalLoading ? (
                                    <div className="flex flex-col items-center justify-center py-12 gap-4">
                                        <div className="h-8 w-8 rounded-full border-2 border-emerald-200 border-t-emerald-500 animate-spin" />
                                        <p className="text-sm text-gray-500">
                                            {dayBanner === "weekend"
                                                ? t("personalized.loadingWeekend")
                                                : t("personalized.loadingToday")}
                                        </p>
                                    </div>
                                ) : displayList.length > 0 ? (
                                    displayList.map((course) => (
                                        <Link
                                            key={course.id}
                                            href={`/courses/${course.id}`}
                                            onClick={() => setShowMoreModal(false)}
                                            className="block"
                                        >
                                            <div className="relative aspect-video rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-800">
                                                {(() => {
                                                    const img =
                                                        course.imageUrl?.trim() ||
                                                        course.coursePlaces?.[0]?.place?.imageUrl?.trim() ||
                                                        "";
                                                    return img ? (
                                                        <Image
                                                            src={img}
                                                            fill
                                                            alt={course.title}
                                                            className="object-cover"
                                                            sizes="(max-width: 480px) 100vw, 400px"
                                                        />
                                                    ) : (
                                                        <div className="absolute inset-0 flex items-center justify-center text-gray-400 text-sm">
                                                            No Image
                                                        </div>
                                                    );
                                                })()}
                                                <div className="absolute inset-0 bg-linear-to-t from-black/70 to-transparent" />
                                                <div className="absolute bottom-3 left-3 right-3 text-white">
                                                    <h4 className="font-bold line-clamp-2">
                                                        <TranslatedCourseTitle title={course.title} />
                                                    </h4>
                                                    {course.region && (
                                                        <span className="text-xs text-gray-300">{course.region}</span>
                                                    )}
                                                    {course.chips && course.chips.length > 0 && (
                                                        <div className="flex flex-wrap gap-1.5 mt-2">
                                                            {course.chips.slice(0, 3).map((chipId) => {
                                                                const def = CHIP_DEFINITIONS[chipId];
                                                                return def ? (
                                                                    <span
                                                                        key={chipId}
                                                                        className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-white/20 text-white backdrop-blur-sm"
                                                                    >
                                                                        #{def.label}
                                                                    </span>
                                                                ) : null;
                                                            })}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </Link>
                                    ))
                                ) : (
                                    <p className="text-center py-12 text-gray-500 text-sm">
                                        {dayBanner === "weekend"
                                            ? t("personalized.loadFailWeekend")
                                            : t("personalized.loadFailToday")}
                                    </p>
                                );
                            })()}
                        </div>
                    </div>
                </div>
            )}
            {showLoginModal && (
                <LoginModal
                    onClose={() => setShowLoginModal(false)}
                    next={`/courses/${courses[0]?.id}`}
                    preset="courseDetail"
                />
            )}
        </section>
    );
}
