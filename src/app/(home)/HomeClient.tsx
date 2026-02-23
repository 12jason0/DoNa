"use client";

import { useState, useEffect, useRef, useCallback, useMemo, memo } from "react";
import { apiFetch } from "@/lib/authClient";
import { useAuth } from "@/context/AuthContext";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "@/components/ImageFallback";
import PersonalizedSection from "@/components/PersonalizedSection";
import BenefitConsentModal from "@/components/BenefitConsentModal";
import MemoryCTA, { MemoryPreview } from "@/components/MemoryCTA";
import LoginModal from "@/components/LoginModal";
import { LOGIN_MODAL_PRESETS } from "@/constants/loginModalPresets";
import TapFeedback from "@/components/TapFeedback";
import { X } from "lucide-react";

import { isIOS } from "@/lib/platform";
import CourseLoadingOverlay from "@/components/CourseLoadingOverlay";

// 🟢 섹션 메모이제이션 (렌더링 부하 감소)
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

interface HomeClientProps {
    initialCourses: Course[];
}

export default function HomeClient({ initialCourses }: HomeClientProps) {
    const { user, isAuthenticated, isLoading: isAuthLoading } = useAuth();
    const [courses, setCourses] = useState<Course[]>(initialCourses);
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
    const [showBenefitConsentModal, setShowBenefitConsentModal] = useState(false);
    const [userId, setUserId] = useState<number | null>(null);
    const [userName, setUserName] = useState<string>("");
    const [isOnboardingComplete, setIsOnboardingComplete] = useState<boolean>(false);
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
    // 🟢 오늘 데이트 진행 중 (activeCourse)
    const [activeCourse, setActiveCourse] = useState<{
        courseId: number;
        courseTitle: string;
        title?: string;
        imageUrl?: string | null;
        vibe?: string | null;
        walkability?: string | null;
        rating?: number | null;
        hasMemory: boolean;
    } | null>(null);
    const [showMemoryReminderModal, setShowMemoryReminderModal] = useState(false);

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

    // 🟢 [Optimization]: 상태 업데이트를 프레임 단위로 분산 처리하여 롱 태스크 방지
    const loadUserData = useCallback(async () => {
        // 🟢 [로그아웃 체크]: 로그인 상태에서만 데이터 로드
        if (!isAuthenticated) {
            setUserId(null);
            setUserName("");
            setUserTier("FREE");
            return;
        }

        try {
            const [profileRes, preferencesRes] = await Promise.allSettled([
                apiFetch("/api/users/profile", { cache: "no-store" }), // 🟢 프로필은 최신 상태 유지
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
                        (tier === "BASIC" || tier === "PREMIUM" ? tier : "FREE") as "FREE" | "BASIC" | "PREMIUM",
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
                            (Array.isArray(prefsData.regions) && prefsData.regions.length > 0);

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
                            item.createdAt || item.created_at || item.updatedAt || item.updated_at || 0,
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
                excerpt: story.comment || story.content || story.description || story.memo || "",
                tags: Array.isArray(story.tags) ? story.tags : [],
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

    // 🟢 activeCourse: 오늘 데이트 진행 중인 코스
    useEffect(() => {
        if (!isAuthenticated) {
            setActiveCourse(null);
            return;
        }
        (async () => {
            try {
                const { data } = await apiFetch<{
                    courseId: number;
                    courseTitle: string;
                    hasMemory: boolean;
                } | null>("/api/users/active-course", { cache: "no-store" });
                setActiveCourse(data ?? null);

                // 🟢 21시 이후 + 기록 없음 + 오늘 1회만 모달
                if (
                    data &&
                    !data.hasMemory &&
                    typeof window !== "undefined"
                ) {
                    const kstOffset = 9 * 60 * 60 * 1000;
                    const now = new Date();
                    const kstNow = new Date(now.getTime() + kstOffset);
                    const isAfter9 = kstNow.getUTCHours() >= 21;
                    const todayKey = `memoryReminderModal_${kstNow.getUTCFullYear()}-${String(kstNow.getUTCMonth() + 1).padStart(2, "0")}-${String(kstNow.getUTCDate()).padStart(2, "0")}`;
                    const alreadyShown = localStorage.getItem(todayKey) === "1";
                    if (isAfter9 && !alreadyShown) {
                        setShowMemoryReminderModal(true);
                        localStorage.setItem(todayKey, "1");
                    }
                }
            } catch {
                setActiveCourse(null);
            }
        })();
    }, [isAuthenticated]);

    useEffect(() => {
        if (isAuthenticated && user) {
            setUserId(Number(user.id));
        } else {
            requestAnimationFrame(() => {
                setUserId(null);
                setUserName("");
                setIsOnboardingComplete(false);
            });
        }
    }, [isAuthenticated, user, isAuthLoading]);

    useEffect(() => {
        if (!isAuthenticated || !userId) return;
        const timer = setTimeout(loadUserData, 200);
        return () => clearTimeout(timer);
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
    }, [loadUserData]);

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
            } catch {
                // 🟢 에러 시에도 즉시 상태 업데이트
                setCourses([]);
            } finally {
                setIsLoadingCourses(false);
            }
        };
        fetchCourses();
    }, [selectedTagIds, searchNonce, query, initialCourses.length]);

    return (
        <>
            {errorMessage && <div className="mx-4 my-3 bg-red-50 p-4 rounded-xl text-sm">{errorMessage}</div>}
            <BenefitConsentModal isOpen={showBenefitConsentModal} onClose={() => setShowBenefitConsentModal(false)} />
            {/* 🟢 21시 이후 기록 유도 모달 */}
            {showMemoryReminderModal && activeCourse && (
                <div
                    className="fixed inset-0 z-6000 bg-black/50 flex items-center justify-center p-4"
                    onClick={() => setShowMemoryReminderModal(false)}
                >
                    <div
                        className="bg-white dark:bg-[#1a241b] rounded-2xl p-6 max-w-sm w-full shadow-xl"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <p className="text-center text-gray-900 dark:text-white text-base font-medium mb-2">
                            오늘 {activeCourse.courseTitle} 데이트 어땠어요?
                        </p>
                        <p className="text-center text-gray-500 dark:text-gray-400 text-sm mb-6">
                            한 줄만 남겨볼까요?
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowMemoryReminderModal(false)}
                                className="flex-1 py-3 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 font-medium"
                            >
                                나중에
                            </button>
                            <button
                                onClick={() => {
                                    setShowMemoryReminderModal(false);
                                    router.push(`/courses/${activeCourse.courseId}/start`);
                                }}
                                className="flex-1 py-3 rounded-xl bg-[#99c08e] text-white font-bold"
                            >
                                이동하기
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {showLoginModal && (
                <LoginModal
                    onClose={() => setShowLoginModal(false)}
                    next="/mypage?tab=footprint&view=memories"
                    {...LOGIN_MODAL_PRESETS.saveRecord}
                />
            )}
            {/* 🟢 코스 로딩 중 오버레이 */}
            {isLoadingCourses && <CourseLoadingOverlay />}

            <main className="">
                {/* 🟢 오늘 데이트 진행 중 배너 - 나만의 추억 저장 완료 시 숨김 */}
                {activeCourse && !activeCourse.hasMemory && (
                    <div className="mx-4 mt-6 mb-6 p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-all">
                        <div className="flex gap-4">
                            {/* 왼쪽: 이미지 썸네일 */}
                            <div className="relative w-20 h-20 shrink-0 rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-800">
                                {activeCourse.imageUrl ? (
                                    <Image
                                        src={activeCourse.imageUrl}
                                        alt=""
                                        fill
                                        className="object-cover"
                                        sizes="80px"
                                    />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-slate-400 text-2xl">📍</div>
                                )}
                            </div>
                            {/* 오른쪽: 텍스트 + 진행 중 | 이어가기 */}
                            <div className="flex-1 min-w-0 flex flex-col">
                                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                                    오늘의 데이트
                                </span>
                                <h3 className="text-base font-semibold text-slate-900 dark:text-white mt-0.5 line-clamp-2 leading-snug">
                                    {activeCourse.title ?? activeCourse.courseTitle}
                                </h3>
                                <div className="mt-3 flex items-center justify-between gap-2">
                                    <span className="text-xs text-slate-400 dark:text-slate-500">진행 중</span>
                                    <TapFeedback>
                                        <button
                                            onClick={() => router.push(`/courses/${activeCourse.courseId}`)}
                                            className="flex items-center gap-1 px-3 py-1.5 bg-[#7FCC9F] hover:bg-[#6bb88a] text-white text-xs font-bold rounded-2xl transition-colors active:scale-95 shrink-0"
                                        >
                                            이어가기
                                            <span className="text-white">→</span>
                                        </button>
                                    </TapFeedback>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
                {/* 🟢 개인별 추천 섹션 */}
                <MemoizedPersonalizedSection />

                {/* 🟢 HeroSlider, TabbedConcepts → /courses 페이지로 이동 */}

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
            </main>

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
