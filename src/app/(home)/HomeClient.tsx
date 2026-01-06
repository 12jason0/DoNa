"use client";

import { useState, useEffect, useRef, useCallback, useMemo, memo } from "react";
import { fetchWeekStamps, postCheckin } from "@/lib/checkinClient";
import { apiFetch } from "@/lib/authClient";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "@/components/ImageFallback";
import HeroSlider from "@/components/HeroSlider";
import OnboardingSection from "@/components/OnboardingSection";
import CompletionModal from "@/components/CompletionModal";
import PersonalizedSection from "@/components/PersonalizedSection";
import BenefitConsentModal from "@/components/BenefitConsentModal";

import { CATEGORY_ICONS, CONCEPTS } from "@/constants/onboardingData";
import { isIOS } from "@/lib/platform";
import CourseLoadingOverlay from "@/components/CourseLoadingOverlay";

// 🟢 모든 테마 목록 (STATIC_CONCEPTS와 동일하게 22개)
const ALL_CONCEPTS = [
    "가성비",
    "감성데이트",
    "골목투어",
    "공연·전시",
    "맛집탐방",
    "문화예술",
    "쇼핑",
    "술자리",
    "실내데이트",
    "야경",
    "이색데이트",
    "인생샷",
    "전통문화",
    "기타",
    "체험",
    "카페투어",
    "테마파크",
    "핫플레이스",
    "힐링",
    "힙스터",
];

// 🟢 섹션 메모이제이션 (렌더링 부하 감소)
const MemoizedHeroSlider = memo(HeroSlider);
const MemoizedTabbedConcepts = memo(TabbedConcepts);
const MemoizedPersonalizedSection = memo(PersonalizedSection);

type Course = {
    id: string;
    title: string;
    description: string;
    duration: string;
    location: string;
    price: string;
    imageUrl: string;
    concept: string;
    rating: number;
    region?: string;
    reviewCount: number;
    participants: number;
    view_count: number;
    viewCount?: number;
    tags?: string[];
    grade?: "FREE" | "BASIC" | "PREMIUM";
    createdAt?: string;
};

// 🟢 타입 정의 (에러 7006 해결용)
interface ConceptItem {
    name: string;
    count: number;
    imageUrl?: string;
}

interface HomeClientProps {
    initialCourses: Course[];
    initialHeroCourses: Course[];
    initialHotCourses: Course[];
    initialNewCourses: Course[];
}

export default function HomeClient({
    initialCourses,
    initialHeroCourses,
    initialHotCourses,
    initialNewCourses,
}: HomeClientProps) {
    const { user, isAuthenticated, isLoading: isAuthLoading } = useAuth();
    const [courses, setCourses] = useState<Course[]>(initialCourses);
    const [heroCourses, setHeroCourses] = useState<Course[]>(initialHeroCourses);
    const [hotCourses, setHotCourses] = useState<Course[]>(initialHotCourses);
    const [newCourses, setNewCourses] = useState<Course[]>(initialNewCourses);
    const [allTags, setAllTags] = useState<Array<{ id: number; name: string }>>([]);
    const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);
    const [query, setQuery] = useState("");
    const [searchNonce, setSearchNonce] = useState(0);
    const [showWelcome, setShowWelcome] = useState(false);
    const [loginProvider, setLoginProvider] = useState<"apple" | "kakao" | null>(null);
    const [showLoginModal, setShowLoginModal] = useState(false);
    const [showAdModal, setShowAdModal] = useState(false);
    const [isSignup, setIsSignup] = useState(false);
    const [platform, setPlatform] = useState<"ios" | "android" | "web">("web");

    // 🟢 iOS 플랫폼 감지
    useEffect(() => {
        setPlatform(isIOS() ? "ios" : "web");
    }, []);
    const [showLoginRequiredModal, setShowLoginRequiredModal] = useState(false);
    const [showCheckinModal, setShowCheckinModal] = useState(false);
    const [showRewardModal, setShowRewardModal] = useState(false);
    const [showBenefitConsentModal, setShowBenefitConsentModal] = useState(false);
    const [weekStamps, setWeekStamps] = useState<boolean[]>([false, false, false, false, false, false, false]);
    const [isStamping, setIsStamping] = useState(false);
    const [stampCompleted, setStampCompleted] = useState(false);
    const [alreadyToday, setAlreadyToday] = useState(false);
    const [animStamps, setAnimStamps] = useState<boolean[] | null>(null);
    const [streak, setStreak] = useState<number>(0);
    const [userId, setUserId] = useState<number | null>(null);
    const [userName, setUserName] = useState<string>("");
    const [isOnboardingComplete, setIsOnboardingComplete] = useState<boolean>(false);
    const [isCheckinLoading, setIsCheckinLoading] = useState<boolean>(true);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [isLoadingCourses, setIsLoadingCourses] = useState<boolean>(false);

    const router = useRouter();
    const hasShownCheckinModalRef = useRef(false);
    const checkinSectionRef = useRef<HTMLDivElement>(null);

    // 🟢 [Optimization]: 상태 업데이트를 프레임 단위로 분산 처리하여 롱 태스크 방지
    const loadUserData = useCallback(async () => {
        try {
            const [profileRes, checkinRes, preferencesRes] = await Promise.allSettled([
                apiFetch("/api/users/profile", { cache: "force-cache", next: { revalidate: 300 } }),
                apiFetch("/api/users/checkins", { cache: "force-cache", next: { revalidate: 60 } }),
                apiFetch("/api/users/preferences", { cache: "force-cache", next: { revalidate: 300 } }),
            ]);

            if (profileRes.status === "fulfilled" && profileRes.value.response.ok && profileRes.value.data) {
                requestAnimationFrame(() => {
                    const p = profileRes.value.data as any;
                    setUserName(p?.user?.nickname ?? p?.nickname ?? "두나");

                    setTimeout(() => {
                        if (p.hasSeenConsentModal === false) {
                            requestAnimationFrame(() => {
                                setShowBenefitConsentModal(true);
                            });
                        }
                    }, 300);
                });
            }

            if (checkinRes.status === "fulfilled" && checkinRes.value.response.ok && checkinRes.value.data) {
                requestAnimationFrame(() => {
                    requestAnimationFrame(() => {
                        const c = checkinRes.value.data as any;
                        if (c && typeof c.streak === "number") setStreak(c.streak);
                        if (Array.isArray(c.weekStamps)) {
                            setWeekStamps(c.weekStamps);
                        }
                        if (typeof c.todayChecked === "boolean") {
                            setAlreadyToday(c.todayChecked);
                        }
                        setIsCheckinLoading(false);
                    });
                });
            } else {
                setIsCheckinLoading(false);
            }

            if (
                preferencesRes.status === "fulfilled" &&
                preferencesRes.value.response.ok &&
                preferencesRes.value.data
            ) {
                setTimeout(() => {
                    requestAnimationFrame(() => {
                        const prefs = preferencesRes.value.data as any;
                        const prefsData = prefs?.preferences || prefs || {};
                        const hasServerData =
                            (Array.isArray(prefsData.mood) && prefsData.mood.length > 0) ||
                            (Array.isArray(prefsData.concept) && prefsData.concept.length > 0) ||
                            (Array.isArray(prefsData.regions) && prefsData.regions.length > 0) ||
                            (typeof prefsData.companion === "string" && prefsData.companion.trim() !== "");
                        setIsOnboardingComplete(hasServerData || localStorage.getItem("onboardingComplete") === "1");
                    });
                }, 150);
            } else if (
                preferencesRes.status === "rejected" ||
                !preferencesRes.value?.response.ok ||
                !preferencesRes.value?.data
            ) {
                requestAnimationFrame(() => {
                    setIsOnboardingComplete(false);
                });
            }
        } catch (error) {
            console.error("User data loading failed:", error);
        }
    }, []);

    const maybeOpenCheckinModal = useCallback(async () => {
        const result = await fetchWeekStamps();
        if (!result) return;
        setWeekStamps(result.stamps);
        setAlreadyToday(result.todayChecked);
        if (typeof result.streak === "number") setStreak(result.streak);
        if (!result.todayChecked && !hasShownCheckinModalRef.current) {
            setShowCheckinModal(true);
            hasShownCheckinModalRef.current = true;
        }
    }, []);

    useEffect(() => {
        if (isAuthLoading) {
            setIsCheckinLoading(true);
            return;
        }

        if (isAuthenticated && user) {
            setUserId(Number(user.id));
            setIsCheckinLoading(true);
        } else {
            requestAnimationFrame(() => {
                setUserId(null);
                setUserName("");
                setStreak(0);
                setIsOnboardingComplete(false);
                setIsCheckinLoading(false);
            });
        }
    }, [isAuthenticated, user, isAuthLoading]);

    useEffect(() => {
        if (!isAuthenticated || !userId) return;

        let observer: IntersectionObserver | null = null;
        let hasLoaded = false;

        const loadData = () => {
            if (!hasLoaded) {
                hasLoaded = true;
                loadUserData();
            }
        };

        const timer = setTimeout(() => {
            if (!checkinSectionRef.current) {
                loadData();
                return;
            }

            const rect = checkinSectionRef.current.getBoundingClientRect();
            const isVisible = rect.top < window.innerHeight + 300 && rect.bottom > -300;

            if (isVisible) {
                loadData();
                return;
            }

            observer = new IntersectionObserver(
                (entries) => {
                    for (const entry of entries) {
                        if (entry.isIntersecting) {
                            loadData();
                            if (observer) {
                                observer.disconnect();
                            }
                            break;
                        }
                    }
                },
                { rootMargin: "300px" }
            );

            observer.observe(checkinSectionRef.current);
        }, 200);

        return () => {
            clearTimeout(timer);
            if (observer) observer.disconnect();
        };
    }, [isAuthenticated, userId, loadUserData]);

    useEffect(() => {
        const handleAuthLoginSuccess = () => {
            setTimeout(() => {
                requestAnimationFrame(() => {
                    const checkAuth = async () => {
                        try {
                            const { fetchSession } = await import("@/lib/authClient");
                            const session = await fetchSession();
                            if (session.authenticated && session.user) {
                                setUserId(Number(session.user.id));
                                loadUserData();
                                maybeOpenCheckinModal();
                            }
                        } catch (error) {
                            console.error("로그인 후 인증 확인 실패:", error);
                        }
                    };
                    checkAuth();
                });
            }, 600);
        };

        window.addEventListener("authLoginSuccess", handleAuthLoginSuccess);
        return () => {
            window.removeEventListener("authLoginSuccess", handleAuthLoginSuccess);
        };
    }, [loadUserData, maybeOpenCheckinModal]);

    useEffect(() => {
        if (!isAuthenticated || hasShownCheckinModalRef.current || isAuthLoading) return;

        // 🟢 [Fix]: 스플래시 화면이 끝난 후에 출석 모달 표시
        const checkSplashAndShowModal = () => {
            // 스플래시가 이미 표시되었는지 확인
            const splashShown = sessionStorage.getItem("dona-splash-shown");
            if (splashShown) {
                // 스플래시가 이미 끝났으면 즉시 표시
                requestAnimationFrame(() => {
                    maybeOpenCheckinModal();
                });
            } else {
                // 스플래시가 아직 표시 중이면 스플래시 종료를 기다림 (최대 7초)
                const checkInterval = setInterval(() => {
                    const splashDone = sessionStorage.getItem("dona-splash-shown");
                    if (splashDone) {
                        clearInterval(checkInterval);
                        requestAnimationFrame(() => {
                            maybeOpenCheckinModal();
                        });
                    }
                }, 100);

                // 7초 후에는 강제로 표시 (스플래시 최대 시간 6초 + 여유 1초)
                setTimeout(() => {
                    clearInterval(checkInterval);
                    requestAnimationFrame(() => {
                        maybeOpenCheckinModal();
                    });
                }, 7000);
            }
        };

        checkSplashAndShowModal();
    }, [isAuthenticated, isAuthLoading, maybeOpenCheckinModal]);

    // 🟢 메인 코스 리스트 (테마별용) - 검색/필터 변경 시에만 업데이트
    useEffect(() => {
        // 🟢 [Optimization] 초기 데이터가 존재하고 사용자의 추가 액션(검색, 태그 선택)이 없다면 API 호출 차단
        if (initialCourses.length > 0 && !query.trim() && selectedTagIds.length === 0) {
            return;
        }

        const fetchCourses = async () => {
            setIsLoadingCourses(true);
            try {
                const params = new URLSearchParams({ limit: "30", imagePolicy: "any" });
                if (query.trim()) params.set("q", query.trim());
                if (selectedTagIds.length > 0) params.set("tagIds", selectedTagIds.join(","));

                const { data } = await apiFetch(`/api/courses?${params.toString()}`, {
                    cache: "force-cache",
                    next: { revalidate: 180 },
                });
                const courseList = Array.isArray((data as any)?.data) ? (data as any).data : [];
                // 🟢 즉시 상태 업데이트 (requestAnimationFrame 제거로 지연 방지)
                setCourses(courseList);
                // 🟢 heroCourses가 비어있을 때만 업데이트 (초기 데이터 보존)
                setHeroCourses((prev) => (prev.length > 0 ? prev : courseList.slice(0, 5)));
            } catch {
                // 🟢 에러 시에도 즉시 상태 업데이트
                setCourses([]);
            } finally {
                setIsLoadingCourses(false);
            }
        };
        fetchCourses();
    }, [selectedTagIds, searchNonce, query, initialCourses.length]);

    // 🟢 HeroSlider 아이템 메모이제이션 (리플로우 최소화)
    const heroSliderItems = useMemo(() => {
        return heroCourses.map((c) => ({
            id: String(c.id),
            title: c.title,
            imageUrl: c.imageUrl || "",
            location: c.location || c.region || "",
            concept: CONCEPTS[c.concept as keyof typeof CONCEPTS] || c.concept,
            tags: c.tags || [],
        }));
    }, [heroCourses, platform]);

    return (
        <>
            {errorMessage && <div className="mx-4 my-3 bg-red-50 p-4 rounded-xl text-sm">{errorMessage}</div>}
            <CompletionModal isOpen={showRewardModal} onClose={() => setShowRewardModal(false)} />
            <BenefitConsentModal isOpen={showBenefitConsentModal} onClose={() => setShowBenefitConsentModal(false)} />
            {/* 🟢 코스 로딩 중 오버레이 */}
            {isLoadingCourses && <CourseLoadingOverlay />}

            <main className="pb-10">
                {/* 🟢 HeroSlider를 최우선으로 즉시 렌더링 (LCP 최적화) - 메인과 동시에 표시 */}
                <div className="pt-4">
                    {/* 🟢 heroCourses가 비어있어도 HeroSlider는 렌더링하여 초기 구조 확보 */}
                    <MemoizedHeroSlider items={heroSliderItems} />
                </div>

                <MemoizedTabbedConcepts
                    courses={courses}
                    hotCourses={hotCourses}
                    newCourses={newCourses}
                    onConceptClick={() => setIsLoadingCourses(true)}
                />

                <section className="py-6 px-4" ref={checkinSectionRef}>
                    <div className="bg-linear-to-r from-emerald-50 to-green-50 dark:from-emerald-900/20 dark:to-green-900/20 border border-emerald-100 dark:border-emerald-800/30 rounded-2xl p-4 flex items-center justify-between">
                        <div className="flex items-center gap-3 flex-1">
                            <div className="w-10 h-10 rounded-full bg-white dark:bg-[#1a241b] flex items-center justify-center text-2xl shrink-0">
                                🌱
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="text-sm text-gray-600 dark:text-gray-400 font-medium">출석 현황</div>
                                {isCheckinLoading && isAuthenticated ? (
                                    <div className="mt-1 space-y-1">
                                        <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-32"></div>
                                    </div>
                                ) : (
                                    <div className="text-base font-bold text-gray-900 dark:text-white">
                                        {userId
                                            ? streak >= 5
                                                ? `🔥 ${streak}일 연속!`
                                                : `${streak}일 연속 출석 중`
                                            : "로그인하고 도장을 찍어보세요!"}
                                    </div>
                                )}
                            </div>
                        </div>
                        <button
                            onClick={() => router.push(userId ? "/mypage?tab=checkins" : "/login")}
                            className="w-10 h-10 bg-white dark:bg-[#1a241b] border border-emerald-200 dark:border-emerald-800/50 rounded-full flex items-center justify-center shadow-sm shrink-0"
                        >
                            🔔
                        </button>
                    </div>
                </section>

                <MemoizedPersonalizedSection />
                {(!isAuthenticated || !isOnboardingComplete) && (
                    <OnboardingSection onStart={() => router.push("/onboarding")} />
                )}
            </main>

            {showCheckinModal && (
                <div className="fixed inset-0 bg-black/60 dark:bg-black/80 flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-[#1a241b] rounded-2xl p-6 w-full max-w-sm text-center">
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">출석 체크</h3>
                        <p className="text-gray-600 dark:text-gray-400 mb-1">이번 주 출석 현황</p>
                        {streak > 0 && (
                            <p className="text-sm text-emerald-700 dark:text-emerald-400 mb-2 font-semibold">
                                🔥 {streak}일 연속 출석 중
                            </p>
                        )}
                        {alreadyToday && (
                            <p className="text-sm text-green-600 dark:text-green-400 mb-3">오늘 이미 출석했습니다</p>
                        )}

                        <div className="grid grid-cols-7 gap-2 mb-4">
                            {new Array(7).fill(0).map((_, i) => {
                                const stamped = (weekStamps[i] || (!!animStamps && !!animStamps[i])) as boolean;
                                const pulse = !!animStamps && !!animStamps[i];
                                return (
                                    <div key={i} className="flex flex-col items-center gap-1">
                                        <span
                                            className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-transform duration-150 ${
                                                stamped
                                                    ? "bg-linear-to-br from-lime-400 to-green-500 text-white"
                                                    : "bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400"
                                            } ${pulse ? "scale-110" : ""}`}
                                        >
                                            {stamped ? "🌱" : String(i + 1)}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>

                        <div className="flex gap-3 justify-center">
                            {!stampCompleted && !alreadyToday ? (
                                <>
                                    <button
                                        onClick={() => setShowCheckinModal(false)}
                                        className="px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                                    >
                                        나중에
                                    </button>
                                    <button
                                        onClick={async () => {
                                            if (isStamping) return;
                                            setIsStamping(true);
                                            try {
                                                const data = await postCheckin();
                                                if (!data.ok) {
                                                    setIsStamping(false);
                                                    return;
                                                }
                                                if (typeof data.streak === "number") {
                                                    setStreak(data.streak);
                                                }
                                                if (Array.isArray(data.weekStamps)) {
                                                    setWeekStamps(data.weekStamps);
                                                }
                                                setAlreadyToday(true);
                                                setStampCompleted(true);
                                                setIsStamping(false);

                                                // 7일 완료 시 CompletionModal 표시
                                                if (data.awarded) {
                                                    setShowRewardModal(true);
                                                }
                                            } catch {
                                                setIsStamping(false);
                                            }
                                        }}
                                        className={`px-4 py-2 rounded-lg text-white font-semibold ${
                                            isStamping
                                                ? "bg-gray-400"
                                                : "bg-linear-to-r from-lime-400 to-green-500 hover:from-lime-500 hover:to-green-600"
                                        }`}
                                    >
                                        {isStamping ? "도장 찍는 중..." : "출석 체크 하기"}
                                    </button>
                                </>
                            ) : (
                                <button
                                    onClick={() => {
                                        setShowCheckinModal(false);
                                        setAnimStamps(null);
                                        setStampCompleted(false);
                                    }}
                                    className="hover:cursor-pointer px-6 py-2 rounded-lg bg-linear-to-r from-green-500 to-emerald-500 text-white font-semibold hover:from-green-600 hover:to-emerald-600"
                                >
                                    확인
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

function TabbedConcepts({
    courses,
    hotCourses,
    newCourses,
    onConceptClick,
}: {
    courses: Course[];
    hotCourses: Course[];
    newCourses: Course[];
    onConceptClick?: () => void;
}) {
    const router = useRouter();
    const [activeTab, setActiveTab] = useState<"concept" | "popular" | "new">("concept");
    const [isExpanded, setIsExpanded] = useState(false);

    const handleTabChange = useCallback((tab: "concept" | "popular" | "new") => {
        setActiveTab(tab);
        setIsExpanded(false);
    }, []);

    const handleToggleExpand = useCallback(() => {
        setIsExpanded((prev) => !prev);
    }, []);

    const activeTabCourses = useMemo(() => {
        if (activeTab === "popular") return hotCourses.slice(0, 8);
        if (activeTab === "new") return newCourses.slice(0, 8);
        return [];
    }, [activeTab, hotCourses, newCourses]);

    // 🟢 정렬 안정화: ID 기반 정렬로 서버/클라이언트 일치 보장
    const conceptItems = useMemo<ConceptItem[]>(() => {
        const counts = courses.reduce<Record<string, { count: number; imageUrl?: string }>>((acc, c) => {
            const key = c.concept || "기타";
            if (!acc[key]) acc[key] = { count: 0, imageUrl: c.imageUrl };
            acc[key].count += 1;
            return acc;
        }, {});

        const allItems = ALL_CONCEPTS.map((conceptName) => {
            const existing = counts[conceptName];
            return {
                name: conceptName,
                count: existing?.count || 0,
                imageUrl: existing?.imageUrl,
            };
        });

        // 🟢 정렬 안정화: 카운트 우선, 그 다음 ID 기반 정렬 (localeCompare 제거)
        return allItems.sort((a, b) => {
            if (b.count !== a.count) return b.count - a.count;
            // ID 기반 정렬: 이름의 해시값을 사용하여 서버/클라이언트 일치 보장
            const hashA = a.name.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
            const hashB = b.name.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
            return hashA - hashB;
        });
    }, [courses]);

    return (
        <section className="py-6 px-5">
            <div className="flex gap-2 mb-6 overflow-x-auto no-scrollbar">
                {[
                    { key: "concept", label: "테마별" },
                    { key: "popular", label: "인기별" },
                    { key: "new", label: "새로운" },
                ].map((tab) => (
                    <button
                        key={tab.key}
                        onClick={() => handleTabChange(tab.key as any)}
                        className={`px-5 py-2 rounded-full text-sm font-bold transition-all ${
                            activeTab === tab.key
                                ? "bg-gray-900 dark:bg-gray-700 text-white shadow-lg scale-105 border-0 dark:border-0"
                                : "bg-white dark:bg-[#1a241b] text-gray-400 dark:text-gray-400 border border-gray-100 dark:border-0"
                        }`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>
            <div className="mt-4">
                {activeTab === "concept" ? (
                    <div className="grid grid-cols-4 gap-y-6 gap-x-2">
                        {conceptItems.slice(0, isExpanded ? undefined : 8).map((item: ConceptItem) => {
                            const name = CONCEPTS[item.name as keyof typeof CONCEPTS] || item.name;
                            const targetPath = `/courses?concept=${encodeURIComponent(item.name)}`;
                            return (
                                <button
                                    key={item.name}
                                    onMouseEnter={() => {
                                        router.prefetch(targetPath);
                                    }}
                                    onClick={() => {
                                        // 🟢 [Performance]: 즉시 네비게이션하여 빠른 반응
                                        onConceptClick?.();
                                        router.prefetch(targetPath);
                                        router.push(targetPath);
                                    }}
                                    className="flex flex-col items-center gap-2"
                                >
                                    <div className="w-16 h-16 rounded-full p-1 bg-white dark:bg-[#1a241b] border border-gray-100 dark:border-gray-700 shadow-md">
                                        <Image
                                            src={CATEGORY_ICONS[name] || item.imageUrl || ""}
                                            alt={name}
                                            width={64}
                                            height={64}
                                            className="object-contain p-1"
                                            quality={70}
                                            priority={conceptItems.indexOf(item) < 8}
                                        />
                                    </div>
                                    <span className="text-[10px] font-bold text-gray-700 dark:text-gray-300">
                                        {name}
                                    </span>
                                </button>
                            );
                        })}
                        {conceptItems.length > 8 && (
                            <button
                                onClick={handleToggleExpand}
                                className="col-span-4 mt-4 py-3 text-sm font-bold text-gray-400 dark:text-gray-300 bg-gray-50 dark:bg-[#1a241b] rounded-xl"
                            >
                                {isExpanded ? "접기 ▲" : "테마 더보기 ▼"}
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="flex gap-4 overflow-x-auto no-scrollbar pb-6">
                        {/* 🟢 인기별/새로운 탭: 데이터가 없을 때 메시지 표시 */}
                        {activeTabCourses.length === 0 ? (
                            <div className="w-full py-12 text-center text-gray-400 dark:text-gray-500">
                                <p className="text-sm font-medium">
                                    {activeTab === "popular"
                                        ? "인기 코스가 아직 없습니다"
                                        : "새로운 코스가 아직 없습니다"}
                                </p>
                            </div>
                        ) : (
                            activeTabCourses.map((c) => (
                                <Link
                                    key={c.id}
                                    href={`/courses/${c.id}`}
                                    className="flex flex-col items-center gap-2 shrink-0 w-24"
                                    prefetch={true}
                                >
                                    <div className="relative w-20 h-20 rounded-full p-1 bg-white dark:bg-[#1a241b] border border-gray-100 dark:border-transparent shadow-md">
                                        <div className="w-full h-full rounded-full overflow-hidden relative">
                                            <Image
                                                src={c.imageUrl || ""}
                                                alt={c.title}
                                                width={80}
                                                height={80}
                                                className="object-cover w-full h-full"
                                                quality={75}
                                                sizes="80px"
                                                priority={activeTabCourses.indexOf(c) < 4}
                                            />
                                        </div>
                                        {activeTab === "popular" && (
                                            <div className="absolute -bottom-1 -right-1 w-7 h-7 bg-white dark:bg-[#1a241b] rounded-full flex items-center justify-center border border-orange-100 dark:border-transparent shadow-md text-sm">
                                                🔥
                                            </div>
                                        )}
                                        {activeTab === "new" && (
                                            <div className="absolute -top-1 -right-1 bg-emerald-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full shadow-md border-2 border-white dark:border-[#1a241b]">
                                                N
                                            </div>
                                        )}
                                    </div>
                                    <div className="text-center w-full">
                                        <div className="text-[10px] font-extrabold text-gray-800 dark:text-gray-300 truncate px-1">
                                            {c.title}
                                        </div>
                                        <div
                                            className={`text-[9px] font-bold mt-0.5 ${
                                                activeTab === "popular"
                                                    ? "text-orange-500 dark:text-orange-400"
                                                    : "text-emerald-600 dark:text-emerald-400"
                                            }`}
                                        >
                                            {activeTab === "popular"
                                                ? `${(c.view_count || 0).toLocaleString()} views`
                                                : "✨ 신규"}
                                        </div>
                                    </div>
                                </Link>
                            ))
                        )}
                    </div>
                )}
            </div>
        </section>
    );
}
