"use client";

import { useState, useEffect, useRef, useCallback, useMemo, memo } from "react";
import { fetchWeekStamps, postCheckin } from "@/lib/checkinClient";
import { apiFetch } from "@/lib/authClient";
import { useAuth } from "@/context/AuthContext";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "@/components/ImageFallback";
import HeroSlider from "@/components/HeroSlider";
import OnboardingSection from "@/components/OnboardingSection";
import CompletionModal from "@/components/CompletionModal";
import PersonalizedSection from "@/components/PersonalizedSection";
import BenefitConsentModal from "@/components/BenefitConsentModal";
import MemoryCTA, { MemoryPreview } from "@/components/MemoryCTA";
import LoginModal from "@/components/LoginModal";
import TapFeedback from "@/components/TapFeedback";
import { X } from "lucide-react";

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
    const [hasMemories, setHasMemories] = useState(false);
    const [latestMemory, setLatestMemory] = useState<MemoryPreview | null>(null);
    const [memories, setMemories] = useState<MemoryPreview[]>([]);
    const [memoriesLoading, setMemoriesLoading] = useState(false);
    // 🟢 추억 모달 상태
    const [selectedMemory, setSelectedMemory] = useState<any | null>(null);
    const [showMemoryModal, setShowMemoryModal] = useState(false);
    const [currentImageIndex, setCurrentImageIndex] = useState(0);
    const memoryScrollRef = useRef<HTMLDivElement>(null);
    const [fullMemoryData, setFullMemoryData] = useState<any[]>([]);
    // 🟢 광고 노출: FREE만 광고 표시, BASIC/PREMIUM은 미표시
    const [userTier, setUserTier] = useState<"FREE" | "BASIC" | "PREMIUM">("FREE");

    const router = useRouter();
    const searchParams = useSearchParams();

    // 🟢 [2026-01-21] 딥링크 폴백 처리: courseId 쿼리 파라미터가 있으면 해당 코스 상세 페이지로 리다이렉트
    useEffect(() => {
        const courseId = searchParams.get("courseId");
        if (courseId) {
            console.log("[HomeClient] 딥링크 폴백: courseId 감지, 코스 상세 페이지로 이동:", courseId);
            // URL에서 courseId 제거하고 코스 상세 페이지로 이동
            router.replace(`/courses/${courseId}`);
        }
    }, [searchParams, router]);

    const hasShownCheckinModalRef = useRef(false);

    // 🟢 [Optimization]: 상태 업데이트를 프레임 단위로 분산 처리하여 롱 태스크 방지
    const loadUserData = useCallback(async () => {
        // 🟢 [로그아웃 체크]: 로그인 상태에서만 데이터 로드
        if (!isAuthenticated) {
            setUserId(null);
            setUserName("");
            setUserTier("FREE");
            setStreak(0);
            setWeekStamps([false, false, false, false, false, false, false]);
            setAlreadyToday(false);
            setIsCheckinLoading(false);
            setShowCheckinModal(false);
            return;
        }

        try {
            const [profileRes, checkinRes, preferencesRes] = await Promise.allSettled([
                apiFetch("/api/users/profile", { cache: "no-store" }), // 🟢 프로필은 최신 상태 유지
                apiFetch("/api/users/checkins", { cache: "force-cache", next: { revalidate: 60 } }),
                // 🟢 수정: 취향 데이터는 설정을 마친 직후 반영되어야 하므로 캐시를 사용하지 않습니다.
                apiFetch("/api/users/preferences", { cache: "no-store" }),
            ]);

            if (profileRes.status === "fulfilled" && profileRes.value.response.ok && profileRes.value.data) {
                requestAnimationFrame(() => {
                    const p = profileRes.value.data as any;
                    setUserName(p?.user?.nickname ?? p?.nickname ?? "두나");
                    const tier = (p?.subscriptionTier ?? p?.subscription_tier ?? p?.user?.subscriptionTier ?? "FREE")
                        .toString()
                        .toUpperCase();
                    setUserTier(
                        (tier === "BASIC" || tier === "PREMIUM" ? tier : "FREE") as "FREE" | "BASIC" | "PREMIUM"
                    );

                    setTimeout(() => {
                        if (p.hasSeenConsentModal === false) {
                            // 🟢 localStorage에서 숨김 시간 확인
                            if (typeof window !== "undefined") {
                                const hideUntil = localStorage.getItem("benefitConsentModalHideUntil");
                                if (hideUntil) {
                                    const hideUntilDate = new Date(hideUntil);
                                    const now = new Date();

                                    // 한국 시간으로 비교
                                    const kstOffset = 9 * 60 * 60 * 1000;
                                    const nowKST = new Date(now.getTime() + kstOffset);
                                    const hideUntilKST = new Date(hideUntilDate.getTime() + kstOffset);

                                    // 아직 숨김 시간이 지나지 않았으면 모달 표시하지 않음
                                    if (nowKST < hideUntilKST) {
                                        return;
                                    } else {
                                        // 시간이 지났으면 localStorage에서 제거
                                        localStorage.removeItem("benefitConsentModalHideUntil");
                                    }
                                }
                            }

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

                        // 🟢 개선된 온보딩 완료 체크 로직
                        // 1. 서버에서 명시적으로 준 완료 플래그 확인
                        // 2. 데이터 배열 중 하나라도 값이 있는지 확인
                        const hasServerData =
                            prefsData.hasOnboarding === true ||
                            prefsData.onboardingComplete === true ||
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
                // 🟢 API 호출 실패 시에도 세션 정보를 한 번 더 확인하여 오작동 방지
                requestAnimationFrame(() => {
                    if (user && ((user as any).hasOnboarding || (user as any).onboardingComplete)) {
                        setIsOnboardingComplete(true);
                    } else {
                        setIsOnboardingComplete(false);
                    }
                });
            }
        } catch (error) {
            console.error("User data loading failed:", error);
        }
    }, [isAuthenticated, user]); // 🟢 user 의존성 추가로 세션 변경 시 대응

    const maybeOpenCheckinModal = useCallback(async () => {
        // 🟢 [로그아웃 체크]: 로그인 상태에서만 출석 모달 열기
        if (!isAuthenticated) return;

        const result = await fetchWeekStamps();
        if (!result) return;
        setWeekStamps(result.stamps);
        setAlreadyToday(result.todayChecked);
        if (typeof result.streak === "number") setStreak(result.streak);
        if (!result.todayChecked && !hasShownCheckinModalRef.current) {
            setShowCheckinModal(true);
            hasShownCheckinModalRef.current = true;
        }
    }, [isAuthenticated]);

    // 🟢 모달이 열릴 때 첫 번째 사진으로 스크롤
    useEffect(() => {
        if (showMemoryModal && memoryScrollRef.current) {
            setCurrentImageIndex(0);
            memoryScrollRef.current.scrollLeft = 0;
        }
    }, [showMemoryModal]);

    // 🟢 개인 추억 데이터 가져오기
    const fetchPersonalMemories = useCallback(async () => {
        if (!isAuthenticated) {
            setHasMemories(false);
            setLatestMemory(null);
            setMemories([]);
            setMemoriesLoading(false);
            return;
        }

        setMemoriesLoading(true);
        try {
            const { data, response } = await apiFetch<any>("/api/reviews?userId=me", {
                cache: "no-store",
                next: { revalidate: 0 },
            });

            if (!response.ok || !Array.isArray(data)) {
                setHasMemories(false);
                setLatestMemory(null);
                setMemories([]);
                return;
            }

            const privateStories = data
                .filter((review: any) => {
                    const isPublic = review.isPublic;
                    return (
                        isPublic === false ||
                        isPublic === "false" ||
                        isPublic === 0 ||
                        String(isPublic).toLowerCase() === "false"
                    );
                })
                .sort((a, b) => {
                    const getTimestamp = (item: any) =>
                        new Date(
                            item.createdAt || item.created_at || item.updatedAt || item.updated_at || 0
                        ).getTime() || 0;
                    return getTimestamp(b) - getTimestamp(a);
                });

            if (privateStories.length === 0) {
                setHasMemories(false);
                setLatestMemory(null);
                setMemories([]);
                return;
            }

            const memoriesList = privateStories.map((story: any) => ({
                id: story.id || null,
                title: story.title || story.region || story.placeName || "나만의 추억",
                courseTitle: story.course?.title || story.courseTitle || null,
                excerpt: story.content || story.description || story.memo || "",
                imageUrl:
                    (Array.isArray(story.imageUrls) && story.imageUrls[0]) ||
                    story.imageUrl ||
                    story.coverImage ||
                    story.course?.imageUrl ||
                    null,
                createdAt: story.createdAt || story.created_at || story.updatedAt || story.updated_at || null,
            }));

            setHasMemories(true);
            setLatestMemory(memoriesList[0]);
            setMemories(memoriesList);
            // 🟢 전체 추억 데이터 저장 (모달에서 사용)
            setFullMemoryData(privateStories);
        } catch (error) {
            console.error("[HomeClient] 개인 추억 조회 실패:", error);
            setHasMemories(false);
            setLatestMemory(null);
            setMemories([]);
        } finally {
            setMemoriesLoading(false);
        }
    }, [isAuthenticated]);

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
                setWeekStamps([false, false, false, false, false, false, false]);
                setAlreadyToday(false);
                setIsCheckinLoading(false);
                setShowCheckinModal(false);
                setIsOnboardingComplete(false);
                setIsCheckinLoading(false);
            });
        }
    }, [isAuthenticated, user, isAuthLoading]);

    useEffect(() => {
        if (!isAuthenticated || !userId) return;
        const timer = setTimeout(loadUserData, 200);
        return () => clearTimeout(timer);
    }, [isAuthenticated, userId, loadUserData]);

    useEffect(() => {
        const handleOpenCheckinModal = () => setShowCheckinModal(true);
        window.addEventListener("openCheckinModal", handleOpenCheckinModal);
        return () => window.removeEventListener("openCheckinModal", handleOpenCheckinModal);
    }, []);

    useEffect(() => {
        if (searchParams.get("openCheckin") === "1" && isAuthenticated) {
            setShowCheckinModal(true);
            router.replace("/", { scroll: false });
        }
    }, [searchParams, isAuthenticated, router]);

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

    // 🟢 개인 추억 데이터 로드
    useEffect(() => {
        fetchPersonalMemories();
    }, [fetchPersonalMemories]);

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
            {showLoginModal && <LoginModal onClose={() => setShowLoginModal(false)} />}
            {/* 🟢 코스 로딩 중 오버레이 */}
            {isLoadingCourses && <CourseLoadingOverlay />}

            <main className="">
                {/* 🟢 HeroSlider를 최우선으로 즉시 렌더링 (LCP 최적화) - 메인과 동시에 표시 */}
                <div className="pt-4">
                    {/* 🟢 heroCourses가 비어있어도 HeroSlider는 렌더링하여 초기 구조 확보 */}
                    <MemoizedHeroSlider items={heroSliderItems} userTier={userTier} />
                </div>

                <MemoizedTabbedConcepts
                    courses={courses}
                    hotCourses={hotCourses}
                    newCourses={newCourses}
                    onConceptClick={() => setIsLoadingCourses(true)}
                />

                <MemoizedPersonalizedSection />

                {/* 🟢 나만의 추억 CTA */}
                <section className="px-4 py-4">
                    <MemoryCTA
                        hasMemories={hasMemories}
                        isAuthenticated={isAuthenticated}
                        latestMemory={latestMemory}
                        memories={memories}
                        isLoading={memoriesLoading}
                        onAction={() => {
                            if (!isAuthenticated) {
                                setShowLoginModal(true);
                                return;
                            }
                            router.push("/mypage?tab=footprint&view=memories");
                        }}
                        onMemoryClick={(memory) => {
                            if (!isAuthenticated) {
                                setShowLoginModal(true);
                                return;
                            }
                            if (memory.id) {
                                // 🟢 페이지 전환 없이 모달로 바로 표시
                                const fullMemory = fullMemoryData.find((story: any) => story.id === memory.id);
                                if (fullMemory) {
                                    setSelectedMemory(fullMemory);
                                    setShowMemoryModal(true);
                                    setCurrentImageIndex(0);
                                }
                            } else {
                                router.push("/mypage?tab=footprint&view=memories");
                            }
                        }}
                    />
                </section>
                {(!isAuthenticated || !isOnboardingComplete) && (
                    <OnboardingSection onStart={() => router.push("/onboarding")} />
                )}
            </main>

            {/* 🟢 [로그아웃 체크]: 로그인 상태에서만 출석 모달 표시 - 아래에서 올라오는 바텀시트 */}
            {showCheckinModal && isAuthenticated && (
                <div
                    className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 dark:bg-black/70 backdrop-blur-sm animate-in fade-in duration-200"
                    onClick={() => setShowCheckinModal(false)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => e.key === "Escape" && setShowCheckinModal(false)}
                    aria-label="출석 체크 모달 닫기"
                >
                    <div
                        className="fixed bottom-0 left-0 right-0 z-51 max-h-[calc(100vh-3rem)] overflow-y-auto rounded-t-2xl bg-white dark:bg-[#1a241b] shadow-2xl p-6 w-full max-w-sm mx-auto text-center"
                        style={{ animation: "slideUp 0.3s ease-out forwards" }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">출석 체크</h3>
                        <p className="text-gray-600 dark:text-gray-400 mb-1">이번 주 출석 현황</p>
                        {streak > 0 && (
                            <p className="flex items-center justify-center gap-1.5 text-sm text-gray-700 dark:text-gray-300 mb-2 font-semibold">
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    width="18"
                                    height="18"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    className="text-orange-500 dark:text-orange-400 shrink-0"
                                >
                                    <path d="M12 3q1 4 4 6.5t3 5.5a1 1 0 0 1-14 0 5 5 0 0 1 1-3 1 1 0 0 0 5 0c0-2-1.5-3-1.5-5q0-2 2.5-4" />
                                </svg>
                                {streak}일 연속 출석 중
                            </p>
                        )}
                        {alreadyToday && (
                            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">오늘 이미 출석했습니다</p>
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
                                                window.dispatchEvent(new Event("checkinUpdated"));

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
                                                : "bg-gray-800 hover:bg-gray-700 dark:bg-gray-600 dark:hover:bg-gray-500"
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
                                    className="hover:cursor-pointer px-6 py-2 rounded-lg bg-gray-800 dark:bg-gray-600 text-white font-semibold hover:bg-gray-700 dark:hover:bg-gray-500"
                                >
                                    확인
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* 🟢 추억 상세 모달*/}
            {showMemoryModal && selectedMemory && (
                <div
                    className="fixed inset-0 z-5000 bg-black dark:bg-black flex flex-col animate-in fade-in duration-300"
                    onClick={() => setShowMemoryModal(false)}
                    style={{
                        paddingTop: "env(safe-area-inset-top, 0)",
                        paddingBottom: "env(safe-area-inset-bottom, 0)",
                    }}
                >
                    {/* 🟢 상단 바 영역 (검은색 배경) */}
                    <div
                        className="absolute top-0 left-0 right-0 bg-black dark:bg-black z-10"
                        style={{
                            height: "env(safe-area-inset-top, 0)",
                        }}
                    />

                    {/* 🟢 하단 네비게이션 바 영역 (안드로이드용) */}
                    <div
                        className="absolute bottom-0 left-0 right-0 bg-black dark:bg-black z-10"
                        style={{
                            height: "env(safe-area-inset-bottom, 0)",
                        }}
                    />

                    {/* 상단 바 영역 - Region, 점 인디케이터, X 버튼 */}
                    <div
                        className="absolute top-0 left-0 right-0 z-30 flex items-center justify-between px-4 bg-black dark:bg-black pt-4 pb-4"
                        style={{
                            top: "env(safe-area-inset-top, 0)",
                        }}
                    >
                        {/* 왼쪽: Region */}
                        {selectedMemory.course?.region && (
                            <div className="px-2 py-1 bg-white/20 backdrop-blur-sm text-white text-xs rounded-full z-20">
                                <span className="text-sm font-medium text-white dark:text-gray-300">
                                    {selectedMemory.course.region}
                                </span>
                            </div>
                        )}

                        {/* 중앙: 점 인디케이터 */}
                        {selectedMemory.imageUrls && selectedMemory.imageUrls.length > 1 ? (
                            <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2 z-20">
                                {selectedMemory.imageUrls.map((_: any, i: number) => (
                                    <div
                                        key={i}
                                        className={`h-1 rounded-full transition-all ${
                                            i === currentImageIndex ? "bg-white w-8" : "bg-white/40 w-1"
                                        }`}
                                    />
                                ))}
                            </div>
                        ) : (
                            <div className="flex-1" />
                        )}

                        {/* 오른쪽: X 버튼 */}
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                setShowMemoryModal(false);
                            }}
                            className="text-white hover:text-white/80 transition-colors p-4 z-20"
                        >
                            <X className="w-6 h-6 stroke-2" />
                        </button>
                    </div>

                    {/* 가로 스크롤 사진 갤러리 */}
                    {selectedMemory.imageUrls && selectedMemory.imageUrls.length > 0 ? (
                        <div
                            ref={memoryScrollRef}
                            className="flex overflow-x-auto snap-x snap-mandatory scrollbar-hide"
                            style={{
                                height: "calc(100vh - 120px)",
                                marginTop: "60px",
                                marginBottom: "60px",
                                WebkitOverflowScrolling: "touch",
                                scrollBehavior: "smooth",
                            }}
                            onScroll={(e) => {
                                const container = e.currentTarget;
                                const scrollLeft = container.scrollLeft;
                                const itemWidth = container.clientWidth;
                                const newIndex = Math.round(scrollLeft / itemWidth);
                                setCurrentImageIndex(newIndex);
                            }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            {selectedMemory.placeData && typeof selectedMemory.placeData === "object"
                                ? (() => {
                                      const placeData = selectedMemory.placeData as Record<
                                          string,
                                          { photos: string[]; tags: string[] }
                                      >;
                                      const stepIndices = Object.keys(placeData).sort((a, b) => Number(a) - Number(b));
                                      let photoIndex = 0;

                                      return stepIndices.flatMap((stepIndex) => {
                                          const stepData = placeData[stepIndex];
                                          const photos = stepData.photos || [];
                                          const tags = stepData.tags || [];

                                          return photos.map((imageUrl: string, photoIdx: number) => {
                                              const currentIdx = photoIndex++;
                                              return (
                                                  <div
                                                      key={`${stepIndex}-${photoIdx}`}
                                                      className="shrink-0 w-full h-full snap-center flex items-center justify-center relative"
                                                      style={{ height: "calc(100vh - 120px)" }}
                                                  >
                                                      <div className="absolute inset-0 bg-black">
                                                          <Image
                                                              src={imageUrl}
                                                              alt={`추억 사진 ${currentIdx + 1}`}
                                                              fill
                                                              className="object-cover"
                                                              sizes="100vw"
                                                              priority={currentIdx < 2}
                                                          />
                                                      </div>
                                                  </div>
                                              );
                                          });
                                      });
                                  })()
                                : selectedMemory.imageUrls.map((imageUrl: string, idx: number) => (
                                      <div
                                          key={idx}
                                          className="shrink-0 w-full h-full snap-center flex items-center justify-center relative"
                                          style={{ height: "calc(100vh - 120px)" }}
                                      >
                                          <div className="absolute inset-0 bg-black">
                                              <Image
                                                  src={imageUrl}
                                                  alt={`추억 사진 ${idx + 1}`}
                                                  fill
                                                  className="object-cover"
                                                  sizes="100vw"
                                                  priority={idx < 2}
                                              />
                                          </div>
                                      </div>
                                  ))}
                        </div>
                    ) : (
                        <div
                            className="flex items-center justify-center bg-black"
                            style={{
                                height: "calc(100vh - 120px)",
                                marginTop: "60px",
                                marginBottom: "60px",
                            }}
                        >
                            <div className="w-full h-full bg-linear-to-br from-gray-800 to-gray-900 flex items-center justify-center">
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    viewBox="0 0 24 24"
                                    fill="currentColor"
                                    className="w-24 h-24 text-pink-500 dark:text-pink-400"
                                >
                                    <path d="M6 4C6 3.44772 6.44772 3 7 3H21C21.5523 3 22 3.44772 22 4V16C22 16.5523 21.5523 17 21 17H18V20C18 20.5523 17.5523 21 17 21H3C2.44772 21 2 20.5523 2 20V8C2 7.44772 2.44772 7 3 7H6V4ZM8 7H17C17.5523 7 18 7.44772 18 8V15H20V5H8V7ZM16 15.7394V9H4V18.6321L11.4911 11.6404L16 15.7394ZM7 13.5C7.82843 13.5 8.5 12.8284 8.5 12C8.5 11.1716 7.82843 10.5 7 10.5C6.17157 10.5 5.5 11.1716 5.5 12C5.5 12.8284 6.17157 13.5 7 13.5Z"></path>
                                </svg>
                            </div>
                        </div>
                    )}

                    {/* 하단 날짜 및 태그 표시 */}
                    <div
                        className="absolute bottom-0 left-0 right-0 z-20 flex flex-col"
                        style={{
                            paddingBottom: "calc(env(safe-area-inset-bottom, 0) + 1.5rem)",
                            paddingLeft: "1.5rem",
                            paddingTop: "2rem",
                            background: "linear-gradient(to top, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0) 100%)",
                        }}
                    >
                        {/* 날짜 */}
                        <div className="text-white text-sm font-medium mb-2">
                            {(() => {
                                const date = new Date(selectedMemory.createdAt);
                                const dayOfWeek = ["일", "월", "화", "수", "목", "금", "토"][date.getDay()];
                                return `${date.getFullYear()}년 ${
                                    date.getMonth() + 1
                                }월 ${date.getDate()}일 (${dayOfWeek})`;
                            })()}
                        </div>

                        {/* 현재 사진에 해당하는 태그 표시 */}
                        {(() => {
                            if (selectedMemory.placeData && typeof selectedMemory.placeData === "object") {
                                const placeData = selectedMemory.placeData as Record<
                                    string,
                                    { photos: string[]; tags: string[] }
                                >;
                                const stepIndices = Object.keys(placeData).sort((a, b) => Number(a) - Number(b));
                                let photoIndex = 0;

                                for (const stepIndex of stepIndices) {
                                    const stepData = placeData[stepIndex];
                                    const photos = stepData.photos || [];
                                    const tags = stepData.tags || [];

                                    if (
                                        currentImageIndex >= photoIndex &&
                                        currentImageIndex < photoIndex + photos.length
                                    ) {
                                        if (tags.length > 0) {
                                            return (
                                                <div className="flex flex-wrap gap-2">
                                                    {tags.map((tag: string, tagIdx: number) => (
                                                        <span
                                                            key={tagIdx}
                                                            className="px-3 py-1 bg-white/20 backdrop-blur-sm text-white text-xs rounded-full"
                                                        >
                                                            #{tag}
                                                        </span>
                                                    ))}
                                                </div>
                                            );
                                        }
                                    }
                                    photoIndex += photos.length;
                                }
                            }
                            return null;
                        })()}
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
        <section className="py-8 px-5">
            {/* 필터 탭: pill 배경 */}
            <div className="flex gap-2 mb-7 overflow-x-auto no-scrollbar">
                {[
                    { key: "concept", label: "전체" },
                    { key: "popular", label: "인기순" },
                    { key: "new", label: "새로운" },
                ].map((tab) => (
                    <TapFeedback key={tab.key}>
                        <button
                            onClick={() => handleTabChange(tab.key as any)}
                            className={`px-4 py-2.5 rounded-full text-sm font-semibold transition-all whitespace-nowrap ${
                                activeTab === tab.key
                                    ? "bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-700/50"
                                    : "bg-gray-50 dark:bg-gray-800/50 text-gray-500 dark:text-gray-400 border border-transparent"
                            }`}
                        >
                            {tab.label}
                        </button>
                    </TapFeedback>
                ))}
            </div>
            <div className="mt-6">
                {activeTab === "concept" ? (
                    isExpanded && conceptItems.length > 8 ? (
                        /* 클릭 시 해당 위치에 가로 스크롤 사라지고 전체 그리드만 표시 */
                        <div className="grid grid-cols-4 gap-y-5 gap-x-1">
                            {conceptItems.map((item: ConceptItem) => {
                                const name = CONCEPTS[item.name as keyof typeof CONCEPTS] || item.name;
                                const targetPath = `/courses?concept=${encodeURIComponent(item.name)}`;
                                return (
                                    <TapFeedback key={item.name}>
                                        <button
                                            onMouseEnter={() => router.prefetch(targetPath)}
                                            onClick={() => {
                                                onConceptClick?.();
                                                router.prefetch(targetPath);
                                                router.push(targetPath);
                                            }}
                                            className="flex flex-col items-center gap-1.5"
                                        >
                                            <div className="w-12 h-12 rounded-full p-1 bg-gray-50 dark:bg-gray-800/60 border border-gray-100 dark:border-gray-700/50">
                                                <Image
                                                    src={CATEGORY_ICONS[name] || item.imageUrl || ""}
                                                    alt={name}
                                                    width={48}
                                                    height={48}
                                                    className="object-contain p-0.5"
                                                    quality={70}
                                                />
                                            </div>
                                            <span className="text-[10px] font-semibold text-gray-600 dark:text-gray-400">
                                                {name}
                                            </span>
                                        </button>
                                    </TapFeedback>
                                );
                            })}
                            <TapFeedback>
                                <button
                                    type="button"
                                    onClick={() => {
                                        handleToggleExpand();
                                        requestAnimationFrame(() => {
                                            const mainEl = document.querySelector("main");
                                            if (mainEl) {
                                                mainEl.scrollTo({ top: 0, behavior: "smooth" });
                                            } else {
                                                window.scrollTo({ top: 0, behavior: "smooth" });
                                            }
                                        });
                                    }}
                                    className="col-span-4 mt-3 py-3 text-sm font-medium text-gray-500 dark:text-gray-400"
                                >
                                    접기 ▲
                                </button>
                            </TapFeedback>
                        </div>
                    ) : (
                        /* 가로 스크롤: 8개 + 맨 마지막 전체 보기(텍스트만, 가운데 정렬) */
                        <div className="flex gap-4 overflow-x-auto no-scrollbar pb-2 items-center">
                            {conceptItems.slice(0, 8).map((item: ConceptItem) => {
                                const name = CONCEPTS[item.name as keyof typeof CONCEPTS] || item.name;
                                const targetPath = `/courses?concept=${encodeURIComponent(item.name)}`;
                                return (
                                    <TapFeedback key={item.name}>
                                        <button
                                            onMouseEnter={() => router.prefetch(targetPath)}
                                            onClick={() => {
                                                onConceptClick?.();
                                                router.prefetch(targetPath);
                                                router.push(targetPath);
                                            }}
                                            className="flex flex-col items-center gap-1.5 shrink-0"
                                        >
                                            <div className="w-12 h-12 rounded-full p-1 bg-gray-50 dark:bg-gray-800/60 border border-gray-100 dark:border-gray-700/50">
                                                <Image
                                                    src={CATEGORY_ICONS[name] || item.imageUrl || ""}
                                                    alt={name}
                                                    width={48}
                                                    height={48}
                                                    className="object-contain p-0.5"
                                                    quality={70}
                                                    priority={conceptItems.indexOf(item) < 8}
                                                />
                                            </div>
                                            <span className="text-[10px] font-semibold text-gray-600 dark:text-gray-400 whitespace-nowrap">
                                                {name}
                                            </span>
                                        </button>
                                    </TapFeedback>
                                );
                            })}
                            {conceptItems.length > 8 && (
                                <TapFeedback>
                                    <button
                                        type="button"
                                        onClick={handleToggleExpand}
                                        className="shrink-0 text-xs font-bold text-gray-600 dark:text-gray-400 whitespace-nowrap py-1 text-center"
                                    >
                                        전체 보기
                                    </button>
                                </TapFeedback>
                            )}
                        </div>
                    )
                ) : (
                    <div className="flex gap-5 overflow-x-auto no-scrollbar pt-7 pb-7">
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
                                <TapFeedback key={c.id}>
                                    <Link
                                        href={`/courses/${c.id}`}
                                        className="flex flex-col items-center gap-2 shrink-0 w-24"
                                        prefetch={true}
                                    >
                                    <div className="relative w-20 h-20 rounded-full p-1 bg-gray-50 dark:bg-gray-800/60 border border-gray-100 dark:border-gray-700/50">
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
                                            <div className="absolute bottom-0 right-0 w-6 h-6 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center border border-gray-200 dark:border-gray-600 text-sm">
                                                🔥
                                            </div>
                                        )}
                                        {activeTab === "new" && (
                                            <div className="absolute top-0 right-0 min-w-[18px] h-[18px] flex items-center justify-center bg-emerald-500 dark:bg-emerald-600 text-white text-[10px] font-bold px-1.5 py-0 rounded-full shadow-md border-2 border-white dark:border-[#1a241b]">
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
                                                    ? "text-orange-400 dark:text-orange-400/90"
                                                    : "text-emerald-600 dark:text-emerald-400"
                                            }`}
                                        >
                                            {activeTab === "popular"
                                                ? `${(c.view_count || 0).toLocaleString()} views`
                                                : "✨ 신규"}
                                        </div>
                                    </div>
                                    </Link>
                                </TapFeedback>
                            ))
                        )}
                    </div>
                )}
            </div>
        </section>
    );
}
