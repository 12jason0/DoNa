"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback, useRef } from "react";
import { RECOMMENDATION_MESSAGES, UserTagType } from "@/constants/recommendations";
import { CHIP_DEFINITIONS, type ChipId } from "@/constants/chipRules";
import { LOGIN_MODAL_PRESETS } from "@/constants/loginModalPresets";
import LoginModal from "@/components/LoginModal";

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

export default function PersonalizedSection() {
    const router = useRouter();
    const [courses, setCourses] = useState<Course[]>([]);
    const [loading, setLoading] = useState(true);
    const [userName, setUserName] = useState("회원");
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

    // 🟢 데이터 가져오기 함수 (성능 최적화: 프로필 API 호출 제거, 캐싱 개선)
    const fetchData = useCallback(async () => {
        try {
            setLoading(true);
            const { fetchSession, apiFetch } = await import("@/lib/authClient");

            // 1. 세션 확인
            const session = await fetchSession();
            const isUserAuthenticated = session.authenticated && session.user;

            // 2. 로그인 상태 및 이름 설정 (세션에서만 추출 - 프로필 API 호출 제거)
            if (isUserAuthenticated && session.user) {
                setIsLoggedIn(true);
                // 🟢 세션에서 이름 추출 (프로필 API 호출 없이)
                const sessionName = (session.user.name || session.user.nickname || "").trim();
                setUserName(sessionName || "회원");
            } else {
                setIsLoggedIn(false);
                setUserName("회원");
                setHasOnboardingData(false);
            }

            // 3. 추천 API 호출 - 메인은 오늘 요일로 dayType 자동 분기 (토/일→주말, 월~금→오늘)
            const kst = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
            const mainDayType = kst.getDay() === 0 || kst.getDay() === 6 ? "weekend" : "today";

            const { data, response } = await apiFetch(
                `/api/recommendations?limit=3&dayType=${mainDayType}`,
                {
                // 🟢 로그인 사용자: 짧은 캐싱 (최근 상호작용 반영을 위해)
                // 🟢 비로그인 사용자: 긴 캐싱 (인기순 정렬이므로 동일 결과)
                cache: isUserAuthenticated ? "no-store" : "force-cache", // 🟢 로그인 사용자: no-store로 최신 데이터 가져오기
                next: { revalidate: isUserAuthenticated ? 0 : 300 }, // 로그인: 0초 (즉시 갱신), 비로그인: 5분
            });

            if (!response.ok || !data) {
                setCourses([]);
                setHasOnboardingData(false);
                setLoading(false);
                return;
            }

            const recommendations = (data as any)?.recommendations || [];
            // 🟢 API에서 직접 반환한 hasOnboardingData 사용 (서버에서 정확히 계산된 값)
            const apiHasOnboardingData = (data as any)?.hasOnboardingData === true;

            if (recommendations.length > 0) {
                setCourses(recommendations);

                // 🟢 API에서 반환한 hasOnboardingData 우선 사용
                if (isUserAuthenticated) {
                    if (apiHasOnboardingData) {
                        setHasOnboardingData(true);
                    } else {
                        // 🟢 API에서 반환하지 않은 경우 fallback: matchScore 확인
                        const hasMatchScore = recommendations.some(
                            (c: any) => c.matchScore !== undefined && c.matchScore !== null,
                        );
                        if (hasMatchScore) {
                            setHasOnboardingData(true);
                        } else {
                            // 🟢 [Security] localStorage 의존도 제거: 서버 세션(쿠키) 기반으로 온보딩 정보 확인
                            const onboardingFromSession =
                                (session.user as any)?.hasOnboarding === true ||
                                (session.user as any)?.onboardingComplete === true;
                            setHasOnboardingData(onboardingFromSession);
                        }
                    }
                } else {
                    setHasOnboardingData(false);
                }

                // 🟢 태그 분석 로직 (로그인 상태에 따라)
                if (isUserAuthenticated) {
                    // 멘트 결정 로직 (1등 코스 태그 분석)
                    const topCourse = recommendations[0];
                    const topTags = topCourse.tags;

                    if (topTags) {
                        if (topTags.concept?.includes("힐링") || topTags.mood?.includes("조용한")) {
                            setCurrentTagType("healing");
                        } else if (
                            topTags.concept?.includes("인생샷") ||
                            topTags.mood?.includes("사진") ||
                            topTags.mood?.includes("인스타")
                        ) {
                            setCurrentTagType("photo");
                        } else if (topTags.concept?.includes("맛집") || topTags.concept?.includes("먹방")) {
                            setCurrentTagType("food");
                        } else if (topTags.budget === "저렴함" || topTags.concept?.includes("가성비")) {
                            setCurrentTagType("cost");
                        } else if (topTags.mood?.includes("활동적인")) {
                            setCurrentTagType("activity");
                        } else {
                            setCurrentTagType("default");
                        }
                    } else {
                        setCurrentTagType("default");
                    }
                } else {
                    setCurrentTagType("guest");
                }
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
    }, []); // 의존성 없음 (setState 함수들은 안정적)

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

    useEffect(() => {
        fetchData();
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
            setUserName("회원");
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
                <div className="flex overflow-x-auto gap-4 scrollbar-hide pb-4 -mx-4 px-4">
                    {[1, 2, 3].map((n) => (
                        <div key={n} className="shrink-0 w-[200px] aspect-3/4 bg-gray-100 rounded-xl animate-pulse" />
                    ))}
                </div>
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
                            {isLoggedIn ? "오늘의 선택" : "오늘의 선택"}
                        </h2>
                        {!isLoggedIn && (
                            <p className="text-[14px] font-normal text-[#7A8E99] dark:text-gray-500 mt-1 animate-fade-in">
                                로그인하면 내 취향 기준으로 추천돼요
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
                                onClick={() => {
                                    if (!isLoggedIn) {
                                        setShowLoginModal(true);
                                        return;
                                    }
                                    router.push(`/courses/${courses[0].id}`);
                                }}
                                onKeyDown={(e) => {
                                    if (e.key !== "Enter") return;
                                    if (!isLoggedIn) {
                                        setShowLoginModal(true);
                                        return;
                                    }
                                    router.push(`/courses/${courses[0].id}`);
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
                                        이런 방식으로 추천돼요
                                    </p>
                                )}
                                <h3 className="text-lg font-semibold text-gray-900 dark:text-white leading-snug animate-fade-in tracking-tight">
                                    {courses[0].title}
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
                                    onClick={() => {
                                        if (!isLoggedIn) {
                                            setShowLoginModal(true);
                                            return;
                                        }
                                        router.push(`/courses/${courses[0].id}`);
                                    }}
                                    className="mt-4 inline-flex items-center gap-1 text-[14px] font-semibold text-emerald-600 dark:text-emerald-400 hover:underline active:opacity-80 cursor-pointer"
                                >
                                    코스 구경하기
                                    <span className="inline-block">→</span>
                                </button>
                            </div>
                        </>
                    ) : null}
                </div>
                {!loading && courses.length >= 2 && isLoggedIn && (
                    <div className="flex justify-end mt-3">
                        <button
                            type="button"
                            onClick={() => setShowMoreModal(true)}
                            className="text-[14px] font-medium text-emerald-600 dark:text-emerald-400 hover:underline inline-flex items-center gap-1"
                        >
                            다른 선택도 함께 볼래요
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
                                    오늘
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
                                주말
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto px-4 pb-6 space-y-4 scrollbar-hide">
                            {(() => {
                                // 주말: 메인=weekend면 courses, 평일이면 weekendCourses | 오늘: courses(평일만 노출)
                                const modalData =
                                    dayBanner === "weekend"
                                        ? isMainWeekend
                                            ? courses
                                            : weekendCourses
                                        : courses;
                                const modalLoading =
                                    dayBanner === "weekend" && !isMainWeekend && weekendLoading;
                                const hasMainInList =
                                    (dayBanner === "weekend" && isMainWeekend) ||
                                    (dayBanner === "today" && !isMainWeekend);
                                const displayList = hasMainInList ? modalData.slice(1, 3) : modalData.slice(0, 3);
                                return modalLoading ? (
                                    <div className="flex flex-col items-center justify-center py-12 gap-4">
                                        <div className="h-8 w-8 rounded-full border-2 border-emerald-200 border-t-emerald-500 animate-spin" />
                                        <p className="text-sm text-gray-500">
                                            {dayBanner === "weekend" ? "주말 추천 준비 중..." : "오늘 추천 준비 중..."}
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
                                                    <h4 className="font-bold line-clamp-2">{course.title}</h4>
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
                                            ? "주말 추천을 불러올 수 없어요"
                                            : "오늘 추천을 불러올 수 없어요"}
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
                    {...LOGIN_MODAL_PRESETS.courseDetail}
                />
            )}
        </section>
    );
}
