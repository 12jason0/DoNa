"use client";

import { useState, useEffect, useRef, useCallback, useMemo, memo } from "react"; // 🟢 useMemo 임포트 추가 (에러 2304 해결)
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

export default function Home() {
    const { user, isAuthenticated, isLoading: isAuthLoading } = useAuth();
    const [courses, setCourses] = useState<Course[]>([]);
    const [heroCourses, setHeroCourses] = useState<Course[]>([]);
    const [hotCourses, setHotCourses] = useState<Course[]>([]);
    const [newCourses, setNewCourses] = useState<Course[]>([]);
    const [allTags, setAllTags] = useState<Array<{ id: number; name: string }>>([]);
    const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);
    const [query, setQuery] = useState("");
    const [searchNonce, setSearchNonce] = useState(0);
    const [showWelcome, setShowWelcome] = useState(false);
    const [loginProvider, setLoginProvider] = useState<"apple" | "kakao" | null>(null);
    const [showLoginModal, setShowLoginModal] = useState(false);
    const [showAdModal, setShowAdModal] = useState(false);
    const [isSignup, setIsSignup] = useState(false);
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
    const [isCheckinLoading, setIsCheckinLoading] = useState<boolean>(true); // 🟢 출석 현황 로딩 상태
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

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

            // 🟢 업데이트를 프레임 단위로 나누어 메인 스레드 점유 방지 (더 세밀하게 분산)
            if (profileRes.status === "fulfilled" && profileRes.value.response.ok && profileRes.value.data) {
                requestAnimationFrame(() => {
                    const p = profileRes.value.data as any;
                    setUserName(p?.user?.nickname ?? p?.nickname ?? "두나");

                    // 혜택 모달은 프로필 업데이트 300ms 뒤에 체크 (더 늦춤)
                    setTimeout(() => {
                        if (p.hasSeenConsentModal === false) {
                            requestAnimationFrame(() => {
                                setShowBenefitConsentModal(true);
                            });
                        }
                    }, 300);
                });
            }

            // 🟢 출석 정보 업데이트: response.ok 확인 추가 (로컬 로그인 지원)
            if (checkinRes.status === "fulfilled" && checkinRes.value.response.ok && checkinRes.value.data) {
                requestAnimationFrame(() => {
                    requestAnimationFrame(() => {
                        const c = checkinRes.value.data as any;
                        if (c && typeof c.streak === "number") setStreak(c.streak);
                        // 🟢 출석 정보도 함께 업데이트
                        if (Array.isArray(c.weekStamps)) {
                            setWeekStamps(c.weekStamps);
                        }
                        if (typeof c.todayChecked === "boolean") {
                            setAlreadyToday(c.todayChecked);
                        }
                        setIsCheckinLoading(false); // 🟢 로딩 완료
                    });
                });
            } else {
                // 🟢 API 호출 실패 시에도 로딩 상태 해제
                setIsCheckinLoading(false);
            }

            // 🟢 온보딩 완료 여부 확인: response.ok 확인 추가 (로컬 로그인 지원)
            if (preferencesRes.status === "fulfilled" && preferencesRes.value.response.ok && preferencesRes.value.data) {
                setTimeout(() => {
                    requestAnimationFrame(() => {
                        const prefs = preferencesRes.value.data as any;
                        // 🟢 preferences 객체에서 mood, concept, regions 중 하나라도 데이터가 있으면 온보딩 완료로 간주
                        const prefsData = prefs?.preferences || prefs || {};
                        const hasServerData =
                            (Array.isArray(prefsData.mood) && prefsData.mood.length > 0) ||
                            (Array.isArray(prefsData.concept) && prefsData.concept.length > 0) ||
                            (Array.isArray(prefsData.regions) && prefsData.regions.length > 0) ||
                            (typeof prefsData.companion === "string" && prefsData.companion.trim() !== "");
                        setIsOnboardingComplete(hasServerData || localStorage.getItem("onboardingComplete") === "1");
                    });
                }, 150);
            } else if (preferencesRes.status === "rejected" || !preferencesRes.value?.response.ok || !preferencesRes.value?.data) {
                // 🟢 API 호출 실패 시 비로그인 상태로 간주하여 온보딩 섹션 표시
                requestAnimationFrame(() => {
                    setIsOnboardingComplete(false);
                });
            }
        } catch (error) {
            console.error("User data loading failed:", error);
        }
    }, []);

    // 🟢 [Optimization]: 출석체크 모달 열기 함수 (useCallback으로 최적화)
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

    // 🟢 [Phase 2]: 사용자 데이터 로드 (지연 로드 - 메인 코스 로드와 분리)
    useEffect(() => {
        if (isAuthLoading) {
            setIsCheckinLoading(true); // 🟢 인증 로딩 중일 때는 출석 현황도 로딩 중
            return;
        }

                if (isAuthenticated && user) {
                    setUserId(Number(user.id));
            // 🟢 출석 데이터는 Intersection Observer로 지연 로드
            setIsCheckinLoading(true); // 초기에는 로딩 중으로 표시
                } else {
                    // 🟢 여러 상태 업데이트를 배치로 처리
                    requestAnimationFrame(() => {
                        setUserId(null);
                        setUserName("");
                        setStreak(0);
                        setIsOnboardingComplete(false);
                        setIsCheckinLoading(false); // 🟢 비로그인 상태도 로딩 완료
                    });
                }
    }, [isAuthenticated, user, isAuthLoading]);

    // 🟢 출석 섹션 지연 로드 (Intersection Observer 사용)
    useEffect(() => {
        if (!isAuthenticated || !userId) return;

        let observer: IntersectionObserver | null = null;
        let hasLoaded = false; // 중복 로드 방지

        const loadData = () => {
            if (!hasLoaded) {
                hasLoaded = true;
                loadUserData();
            }
        };

        const timer = setTimeout(() => {
            if (!checkinSectionRef.current) {
                // 🟢 ref가 준비되지 않았으면 바로 로드
                loadData();
                return;
            }

            // 🟢 요소가 이미 화면에 보이는지 즉시 확인
            const rect = checkinSectionRef.current.getBoundingClientRect();
            const isVisible = rect.top < window.innerHeight + 300 && rect.bottom > -300;
            
            if (isVisible) {
                // 🟢 이미 보이면 바로 로드
                loadData();
                return;
            }

            // 🟢 보이지 않으면 Intersection Observer 사용
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
        }, 200); // 🟢 200ms 지연으로 HeroSlider 우선 로드

        return () => {
            clearTimeout(timer);
            if (observer) observer.disconnect();
        };
    }, [isAuthenticated, userId, loadUserData]);

    // 🟢 로그인 성공 시 출석 현황 업데이트 (400ms 지연)
    useEffect(() => {
        const handleAuthLoginSuccess = () => {
            // 🟢 useAuth 상태 업데이트를 기다리기 위해 더 긴 지연 시간 사용
            setTimeout(() => {
                requestAnimationFrame(() => {
                    // 🟢 useAuth 훅이 상태를 업데이트할 시간을 주기 위해 다시 확인
                    const checkAuth = async () => {
                        try {
                            const { fetchSession } = await import("@/lib/authClient");
                            const session = await fetchSession();
                            if (session.authenticated && session.user) {
                                setUserId(Number(session.user.id));
                                // 🟢 사용자 데이터 로드 (프로필, 출석 정보 포함)
                                loadUserData();
                                // 🟢 출석체크 모달도 함께 업데이트
                                maybeOpenCheckinModal();
                            }
                        } catch (error) {
                            console.error("로그인 후 인증 확인 실패:", error);
                        }
                    };
                    checkAuth();
                });
            }, 600); // 🟢 400ms -> 600ms로 증가하여 useAuth 상태 업데이트 대기
        };

        window.addEventListener("authLoginSuccess", handleAuthLoginSuccess);
        return () => {
            window.removeEventListener("authLoginSuccess", handleAuthLoginSuccess);
        };
    }, [loadUserData, maybeOpenCheckinModal]);

    // 🟢 [Phase 3]: 무거운 모달 로직 (800ms 지연)
    useEffect(() => {
        if (!isAuthenticated || hasShownCheckinModalRef.current || isAuthLoading) return;

        const modalTimer = setTimeout(() => {
            // 800ms 뒤에 브라우저가 한가할 때 출석체크 모달 실행
            requestAnimationFrame(() => {
                maybeOpenCheckinModal();
            });
        }, 800);

        return () => clearTimeout(modalTimer);
    }, [isAuthenticated, isAuthLoading, maybeOpenCheckinModal]);

    // 🟢 [Phase 1]: 시각적 최우선 순위 - Hero 데이터 (즉시 실행, 최적화)
    // Hero 데이터만 먼저 로드하여 LCP 속도 확보
    useEffect(() => {
        const fetchHeroData = async () => {
            try {
                const { data } = await apiFetch("/api/courses?limit=10&imagePolicy=any&grade=FREE", {
                    cache: "force-cache",
                    next: { revalidate: 7200 },
                });
                const list = Array.isArray((data as any)?.data) ? (data as any).data : [];
                const threeDayEpoch = Math.floor(Date.now() / 259200000);
                if (list.length > 0) {
                    const count = list.length;
                    const selected: any[] = [];
                    const startIndex = threeDayEpoch % count;
                    for (let i = 0; i < Math.min(5, count); i++) selected.push(list[(startIndex + i) % count]);
                    // 🟢 [Performance]: requestAnimationFrame 제거하여 즉시 렌더링 (HeroSlider 빠른 표시)
                        setHeroCourses(selected);
                }
            } catch (error) {
                // 에러는 조용히 처리 (사용자 경험 방해 최소화)
            }
        };
        fetchHeroData();
    }, []);

    // 🟢 메인 코스 리스트 (테마별용) - Phase 1-2: 100ms 지연 (Hero 로드 후)
    useEffect(() => {
        const fetchCourses = async () => {
            try {
                const params = new URLSearchParams({ limit: "30", imagePolicy: "any" });
                if (query.trim()) params.set("q", query.trim());
                if (selectedTagIds.length > 0) params.set("tagIds", selectedTagIds.join(","));

                const { data } = await apiFetch(`/api/courses?${params.toString()}`, {
                    cache: "force-cache",
                    next: { revalidate: 180 },
                });
                const courseList = Array.isArray((data as any)?.data) ? (data as any).data : [];
                // 🟢 상태 업데이트를 배치 처리로 분산
                requestAnimationFrame(() => {
                    setCourses(courseList);
                    setHeroCourses((prev) => (prev.length > 0 ? prev : courseList.slice(0, 5)));
                });
            } catch {
                requestAnimationFrame(() => {
                    setCourses([]);
                });
            }
        };
        // 🟢 100ms 지연하여 Hero 데이터 로딩과 분리
        const timer = setTimeout(fetchCourses, 100);
        return () => clearTimeout(timer);
    }, [selectedTagIds, searchNonce, query]);

    // 🟢 인기별/신규 코스 - Phase 2: 400ms, 500ms 순차 지연 (메인 로딩 후에)
    useEffect(() => {
        const fetchHotCourses = async () => {
            try {
                const { data } = await apiFetch("/api/courses?limit=30&imagePolicy=any", {
                    cache: "force-cache",
                    next: { revalidate: 300 },
                });
                const courseList = Array.isArray((data as any)?.data) ? (data as any).data : [];
                const sorted = [...courseList]
                    .sort((a: any, b: any) => (b.view_count || b.viewCount || 0) - (a.view_count || a.viewCount || 0))
                    .slice(0, 8);
                // 🟢 상태 업데이트를 다음 프레임으로 분산
                requestAnimationFrame(() => {
                    setHotCourses(sorted);
                });
            } catch (error) {
                console.error("Hot courses load failed", error);
            }
        };

        const fetchNewCourses = async () => {
            try {
                const { data } = await apiFetch("/api/courses?limit=30&imagePolicy=any", {
                    cache: "force-cache",
                    next: { revalidate: 300 },
                });
                const courseList = Array.isArray((data as any)?.data) ? (data as any).data : [];
                const sorted = [...courseList]
                    .sort((a: any, b: any) => {
                        const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
                        const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
                        return tb - ta;
                    })
                    .slice(0, 8);
                // 🟢 상태 업데이트를 다음 프레임으로 분산
                requestAnimationFrame(() => {
                    setNewCourses(sorted);
                });
            } catch (error) {
                console.error("New courses load failed", error);
            }
        };

        // 🟢 순차적으로 실행하여 부하 분산 (400ms, 500ms)
        const timer1 = setTimeout(fetchHotCourses, 400);
        const timer2 = setTimeout(fetchNewCourses, 500);

        return () => {
            clearTimeout(timer1);
            clearTimeout(timer2);
        };
    }, []);

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
    }, [heroCourses]);

    return (
        <>
            {errorMessage && <div className="mx-4 my-3 bg-red-50 p-4 rounded-xl text-sm">{errorMessage}</div>}
            <CompletionModal isOpen={showRewardModal} onClose={() => setShowRewardModal(false)} />
            <BenefitConsentModal isOpen={showBenefitConsentModal} onClose={() => setShowBenefitConsentModal(false)} />

            <main className="pb-10">
                {heroCourses.length > 0 && (
                    <div className="pt-4">
                        <MemoizedHeroSlider items={heroSliderItems} />
                    </div>
                )}

                <MemoizedTabbedConcepts courses={courses} hotCourses={hotCourses} newCourses={newCourses} />

                <section className="py-6 px-4" ref={checkinSectionRef}>
                    <div className="bg-linear-to-r from-emerald-50 to-green-50 border border-emerald-100 rounded-2xl p-4 flex items-center justify-between">
                        <div className="flex items-center gap-3 flex-1">
                            <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-2xl flex-shrink-0">
                                🌱
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="text-sm text-gray-600 font-medium">출석 현황</div>
                                {isCheckinLoading && isAuthenticated ? (
                                    // 🟢 스켈레톤 UI (로딩 중)
                                    <div className="mt-1 space-y-1">
                                        <div className="h-5 bg-gray-200 rounded animate-pulse w-32"></div>
                                    </div>
                                ) : (
                                    <div className="text-base font-bold text-gray-900">
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
                            className="w-10 h-10 bg-white border border-emerald-200 rounded-full flex items-center justify-center shadow-sm flex-shrink-0"
                        >
                            🔔
                        </button>
                    </div>
                </section>

                <MemoizedPersonalizedSection />
                {/* 🟢 온보딩 섹션: 비로그인 상태이거나 로그인 후 user_preferences에 데이터가 없으면 표시 */}
                {(!isAuthenticated || !isOnboardingComplete) && (
                    <OnboardingSection onStart={() => router.push("/onboarding")} />
                )}
            </main>

            {showCheckinModal && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl p-6 w-full max-w-sm text-center">
                        <h3 className="text-lg font-bold text-gray-900 mb-2">출석 체크</h3>
                        <p className="text-gray-600 mb-1">이번 주 출석 현황</p>
                        {streak > 0 && (
                            <p className="text-sm text-emerald-700 mb-2 font-semibold">🔥 {streak}일 연속 출석 중</p>
                        )}
                        {alreadyToday && <p className="text-sm text-green-600 mb-3">오늘 이미 출석했습니다</p>}

                        {/* 7일 출석 도장 그리드 */}
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
                                                    : "bg-gray-200 text-gray-600"
                                            } ${pulse ? "scale-110" : ""}`}
                                        >
                                            {stamped ? "🌱" : String(i + 1)}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>

                        {/* 하단 버튼 영역 */}
                        <div className="flex gap-3 justify-center">
                            {!stampCompleted && !alreadyToday ? (
                                <>
                                    <button
                                        onClick={() => setShowCheckinModal(false)}
                                        className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
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
                                                // 🟢 출석 체크 성공 시 즉시 메인 출석 현황 업데이트
                                                if (typeof data.streak === "number") {
                                                    setStreak(data.streak);
                                                }
                                                if (Array.isArray(data.weekStamps)) {
                                                    setWeekStamps(data.weekStamps);
                                                }
                                                // 오늘 출석 완료 상태 업데이트
                                                setAlreadyToday(true);

                                                // 애니메이션 효과 후 완료 처리
                                                setStampCompleted(true);
                                                setIsStamping(false);
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
}: {
    courses: Course[];
    hotCourses: Course[];
    newCourses: Course[];
}) {
    const router = useRouter();
    const [activeTab, setActiveTab] = useState<"concept" | "popular" | "new">("concept");
    const [isExpanded, setIsExpanded] = useState(false);

    // 🟢 탭 변경 핸들러 메모이제이션 (리플로우 최소화)
    const handleTabChange = useCallback((tab: "concept" | "popular" | "new") => {
        setActiveTab(tab);
        setIsExpanded(false);
    }, []);

    const handleToggleExpand = useCallback(() => {
        setIsExpanded((prev) => !prev);
    }, []);

    // 🟢 활성 탭별 코스 리스트 메모이제이션 (리플로우 최소화)
    const activeTabCourses = useMemo(() => {
        if (activeTab === "popular") return hotCourses.slice(0, 8);
        if (activeTab === "new") return newCourses.slice(0, 8);
        return [];
    }, [activeTab, hotCourses, newCourses]);

    // 🟢 모든 테마 표시 (22개 모두, 코스가 없어도 표시)
    const conceptItems = useMemo<ConceptItem[]>(() => {
        // 실제 코스에서 concept 추출
        const counts = courses.reduce<Record<string, { count: number; imageUrl?: string }>>((acc, c) => {
            const key = c.concept || "기타";
            if (!acc[key]) acc[key] = { count: 0, imageUrl: c.imageUrl };
            acc[key].count += 1;
            return acc;
        }, {});

        // 모든 정의된 테마를 포함 (코스가 없어도 표시)
        const allItems = ALL_CONCEPTS.map((conceptName) => {
            const existing = counts[conceptName];
            return {
                name: conceptName,
                count: existing?.count || 0,
                imageUrl: existing?.imageUrl,
            };
        });

        // 카운트가 있는 것부터 정렬, 그 다음 알파벳 순
        return allItems.sort((a, b) => {
            if (b.count !== a.count) return b.count - a.count;
            return a.name.localeCompare(b.name, "ko");
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
                        className={`px-5 py-2 rounded-full text-sm font-bold border transition-all ${
                            activeTab === tab.key
                                ? "bg-gray-900 text-white shadow-lg scale-105"
                                : "bg-white text-gray-400 border-gray-100"
                        }`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>
            <div className="mt-4">
                {activeTab === "concept" ? (
                    <div className="grid grid-cols-4 gap-y-6 gap-x-2">
                        {/* 🟢 [Optimization] 에러 해결: item 매개변수에 ConceptItem 타입 명시 (7006 해결) */}
                        {conceptItems.slice(0, isExpanded ? undefined : 8).map((item: ConceptItem) => {
                            const name = CONCEPTS[item.name as keyof typeof CONCEPTS] || item.name;
                            const targetPath = `/courses?concept=${encodeURIComponent(item.name)}`;
                            return (
                                <button
                                    key={item.name}
                                    onMouseEnter={() => {
                                        // 🟢 [Performance]: 마우스 hover 시 prefetch로 미리 로드
                                        router.prefetch(targetPath);
                                    }}
                                    onClick={() => {
                                        // 🟢 [Performance]: 클릭 시 즉시 prefetch 후 push
                                        router.prefetch(targetPath);
                                        router.push(targetPath);
                                    }}
                                    className="flex flex-col items-center gap-2"
                                >
                                    <div className="w-16 h-16 rounded-full p-1 bg-white border border-gray-100 shadow-md">
                                        <Image
                                            src={CATEGORY_ICONS[name] || item.imageUrl || ""}
                                            alt={name}
                                            width={64}
                                            height={64}
                                            className="object-contain p-1"
                                            loading="lazy"
                                            quality={70}
                                        />
                                    </div>
                                    <span className="text-[10px] font-bold text-gray-700">{name}</span>
                                </button>
                            );
                        })}
                        {conceptItems.length > 8 && (
                            <button
                                onClick={handleToggleExpand}
                                className="col-span-4 mt-4 py-3 text-sm font-bold text-gray-400 bg-gray-50 rounded-xl"
                            >
                                {isExpanded ? "접기 ▲" : "테마 더보기 ▼"}
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="flex gap-4 overflow-x-auto no-scrollbar pb-6">
                        {activeTabCourses.map((c) => (
                            <Link
                                key={c.id}
                                href={`/courses/${c.id}`}
                                className="flex flex-col items-center gap-2 shrink-0 w-24"
                                prefetch={false}
                            >
                                <div className="relative w-20 h-20 rounded-full p-1 bg-white border border-gray-100 shadow-md">
                                    <div className="w-full h-full rounded-full overflow-hidden relative">
                                        <Image
                                            src={c.imageUrl || ""}
                                            alt={c.title}
                                            width={80}
                                            height={80}
                                            className="object-cover w-full h-full"
                                            loading="lazy"
                                            quality={75}
                                            sizes="80px"
                                        />
                                    </div>
                                    {activeTab === "popular" && (
                                        <div className="absolute -bottom-1 -right-1 w-7 h-7 bg-white rounded-full flex items-center justify-center border border-orange-100 shadow-md text-sm">
                                            🔥
                                        </div>
                                    )}
                                    {activeTab === "new" && (
                                        <div className="absolute -top-1 -right-1 bg-emerald-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full shadow-md border-2 border-white">
                                            N
                                        </div>
                                    )}
                                </div>
                                <div className="text-center w-full">
                                    <div className="text-[10px] font-extrabold text-gray-800 truncate px-1">
                                        {c.title}
                                    </div>
                                    <div
                                        className={`text-[9px] font-bold mt-0.5 ${
                                            activeTab === "popular" ? "text-orange-500" : "text-emerald-600"
                                        }`}
                                    >
                                        {activeTab === "popular"
                                            ? `${(c.view_count || 0).toLocaleString()} views`
                                            : "✨ 신규"}
                                    </div>
                                </div>
                            </Link>
                        ))}
                    </div>
                )}
            </div>
        </section>
    );
}
