"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useState, useEffect, useMemo, useCallback, useDeferredValue, useRef } from "react"; // 🟢 useDeferredValue 추가
import CourseCard from "@/components/CourseCard";
import CourseReportBanner from "@/components/CourseReportBanner";
import { apiFetch, authenticatedFetch } from "@/lib/authClient";
import { CONCEPTS } from "@/constants/onboardingData";
import { isIOS } from "@/lib/platform";

// --- Type Definitions (기존과 100% 동일) ---
type PlaceClosedDay = { day_of_week: number | null; specific_date: Date | string | null; note?: string | null };
type Place = {
    id: number;
    name: string;
    imageUrl?: string;
    latitude?: number;
    longitude?: number;
    opening_hours?: string | null;
    closed_days?: PlaceClosedDay[];
    reservationUrl?: string | null;
};
type CoursePlace = { order_index: number; place: Place | null };
export interface Course {
    id: string;
    title: string;
    description: string;
    duration: string;
    location: string;
    participants: number;
    imageUrl: string;
    concept: string;
    rating: number;
    reviewCount: number;
    viewCount: number;
    createdAt?: string | Date;
    coursePlaces?: CoursePlace[];
    grade?: "FREE" | "BASIC" | "PREMIUM";
    isLocked?: boolean;
}
interface CoursesClientProps {
    initialCourses: Course[];
}

export default function CoursesClient({ initialCourses }: CoursesClientProps) {
    const searchParams = useSearchParams();
    const router = useRouter();
    const conceptParam = searchParams.get("concept");

    const [courses, setCourses] = useState<Course[]>(initialCourses);
    const [sortBy, setSortBy] = useState<"views" | "latest">("views");
    const [activeConcept, setActiveConcept] = useState<string>(conceptParam || "");
    const [isNavigating, setIsNavigating] = useState(false); // 🟢 네비게이션 로딩 상태

    // 🟢 [Optimization 1] 낮은 우선순위 업데이트 처리
    // 필터 변경 시 무거운 렌더링을 뒤로 미뤄 브라우저 멈춤(Violation) 현상을 방지합니다.
    const deferredConcept = useDeferredValue(activeConcept);

    const [favoriteIds, setFavoriteIds] = useState<Set<number>>(new Set());
    const [loadingMore, setLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(initialCourses.length >= 30);
    const [offset, setOffset] = useState(30);
    const loadMoreRef = useRef<HTMLDivElement | null>(null);
    const [couponCount, setCouponCount] = useState<number | null>(null); // 🟢 쿠폰 개수 상태
    const [platform, setPlatform] = useState<'ios' | 'android' | 'web'>('web');

    // 🟢 iOS 플랫폼 감지
    useEffect(() => {
        setPlatform(isIOS() ? 'ios' : 'web');
    }, []);

    useEffect(() => {
        setActiveConcept(conceptParam || "");
        setIsNavigating(false); // 🟢 페이지 로드 완료 시 네비게이션 상태 해제
    }, [conceptParam]);

    // 🟢 사용자 쿠폰 개수 가져오기
    useEffect(() => {
        const fetchCouponCount = async () => {
            try {
                const { data } = await apiFetch<{ couponCount?: number }>("/api/users/profile", {
                    cache: "no-store",
                });
                if (data && typeof data === "object" && "couponCount" in data && data.couponCount !== undefined) {
                    setCouponCount(data.couponCount);
                }
            } catch (error) {
                // 로그인하지 않은 경우 무시
                setCouponCount(null);
            }
        };
        fetchCouponCount();
    }, []);

    // 🟢 [Optimization]: 초기 코스 데이터 설정을 다음 프레임으로 지연
    useEffect(() => {
        // 초기 렌더링은 즉시, 상태 업데이트는 다음 프레임에서
        requestAnimationFrame(() => {
            setCourses(initialCourses);
            setHasMore(initialCourses.length >= 30);
            setOffset(30);
        });
    }, [initialCourses]);

    // [Optimization] 무한 스크롤 로직 (기존 기능 유지)
    const loadMoreCourses = useCallback(async () => {
        if (loadingMore || !hasMore) return;
        setLoadingMore(true);
        try {
            const params = new URLSearchParams();
            params.set("limit", "30");
            params.set("offset", String(offset));
            if (conceptParam) params.set("concept", conceptParam);

            const { data, response } = await apiFetch(`/api/courses?${params.toString()}`, {
                cache: "force-cache",
                next: { revalidate: 180 },
            });

            if (response.ok && data) {
                const coursesArray = Array.isArray(data) ? data : (data as any).courses || [];
                if (coursesArray.length > 0) {
                    setCourses((prev) => {
                        const existingIds = new Set(prev.map((c) => c.id));
                        const newUniqueCourses = coursesArray.filter((c: Course) => !existingIds.has(c.id));
                        return [...prev, ...newUniqueCourses];
                    });
                    setOffset((prev) => prev + 30);
                    setHasMore(coursesArray.length >= 30);
                } else {
                    setHasMore(false);
                }
            } else {
                setHasMore(false);
            }
        } catch (error) {
            setHasMore(false);
        } finally {
            setLoadingMore(false);
        }
    }, [loadingMore, hasMore, offset, conceptParam]);

    // IntersectionObserver 기반 무한 스크롤 (레이아웃 측정/리플로우 최소화)
    useEffect(() => {
        if (!loadMoreRef.current) return;
        const sentinel = loadMoreRef.current;
        let pending = false;

        const observer = new IntersectionObserver(
            (entries) => {
                const entry = entries[0];
                if (!entry || !entry.isIntersecting) return;
                if (pending || loadingMore || !hasMore) return;
                pending = true;
                Promise.resolve(loadMoreCourses()).finally(() => {
                    pending = false;
                });
            },
            { root: null, rootMargin: "400px", threshold: 0 }
        );

        observer.observe(sentinel);
        return () => {
            observer.disconnect();
        };
    }, [loadMoreRef, loadMoreCourses, loadingMore, hasMore]);

    // 🟢 [Optimization 2] 정렬과 필터를 하나의 useMemo로 통합 (중복 루프 제거)
    const visibleCourses = useMemo(() => {
        // 1. 필터링 (성능 최적화: trim과 toLowerCase를 한 번만 수행)
        let filtered = courses;
        if (deferredConcept && deferredConcept.trim()) {
            const target = deferredConcept.trim().toLowerCase();
            filtered = courses.filter((c) => {
                const concept = c.concept || "";
                return concept.trim().toLowerCase() === target;
            });
        }

        // 🟢 iOS: Premium 코스 필터링
        if (platform === 'ios') {
            filtered = filtered.filter((c) => c.grade !== 'PREMIUM');
        }

        // 2. 정렬 (성능 최적화: Date 생성 최소화)
        if (sortBy === "views") {
            return [...filtered].sort((a, b) => (b.viewCount || 0) - (a.viewCount || 0));
        } else {
            // 🟢 최적화: Date 객체 생성 최소화 및 캐싱
            const sorted = [...filtered];
            const dateCache = new Map<string, number>();
            const getTime = (dateStr: string | Date | undefined): number => {
                if (!dateStr) return 0;
                const key = String(dateStr);
                if (!dateCache.has(key)) {
                    dateCache.set(key, new Date(dateStr).getTime());
                }
                return dateCache.get(key) || 0;
            };
            sorted.sort((a: any, b: any) => {
                const ta = getTime(a.createdAt);
                const tb = getTime(b.createdAt);
                return tb !== ta ? tb - ta : Number(b.id) - Number(a.id);
            });
            return sorted;
        }
    }, [courses, sortBy, deferredConcept, platform]);

    const STATIC_CONCEPTS = useMemo(
        () => [
            "가성비",
            "감성데이트",
            "골목투어",
            "공연·전시",
            "데이트",
            "맛집탐방",
            "문화예술",
            "쇼핑",
            "술자리",
            "실내데이트",
            "야경",
            "이색데이트",
            "인생",
            "인생샷",
            "전통문화",
            "종합",
            "체험",
            "카페투어",
            "테마파크",
            "핫플레이스",
            "힐링",
            "힙스터",
        ],
        []
    );

    // 🟢 [Optimization]: 찜 목록 로딩을 200ms 지연하여 초기 렌더링 부하 감소
    useEffect(() => {
        const timer = setTimeout(() => {
            authenticatedFetch<any[]>("/api/users/favorites", { next: { revalidate: 300 } })
                .then((list) => {
                    if (list) {
                        // 다음 프레임에서 상태 업데이트하여 렌더링 부하 분산
                        requestAnimationFrame(() => {
                            const ids = new Set<number>();
                            list.forEach((f: any) => {
                                const id = Number(f?.course?.id ?? f?.course_id ?? f?.courseId ?? f?.id);
                                if (Number.isFinite(id)) ids.add(id);
                            });
                            setFavoriteIds(ids);
                        });
                    }
                })
                .catch(() => {});
        }, 200);

        return () => clearTimeout(timer);
    }, []);

    const toggleFavorite = useCallback(
        async (e: React.MouseEvent, courseId: string | number) => {
            e.stopPropagation();
            const idNum = Number(courseId);
            const liked = favoriteIds.has(idNum);
            try {
                if (!liked) {
                    const success = await authenticatedFetch("/api/users/favorites", {
                        method: "POST",
                        body: JSON.stringify({ courseId: idNum }),
                    });
                    if (success !== null) setFavoriteIds((prev) => new Set(prev).add(idNum));
                    else if (confirm("로그인이 필요합니다.")) router.push("/login");
                } else {
                    const success = await authenticatedFetch(`/api/users/favorites?courseId=${idNum}`, {
                        method: "DELETE",
                    });
                    if (success !== null)
                        setFavoriteIds((prev) => {
                            const s = new Set(prev);
                            s.delete(idNum);
                            return s;
                        });
                }
            } catch {}
        },
        [favoriteIds, router]
    );

    return (
        <div className="min-h-screen bg-[#F8F9FA] dark:bg-[#0f1710]">
            <div className="bg-white dark:bg-[#1a241b] px-5 pt-6 pb-2 sticky top-0 z-30 shadow-[0_1px_2px_rgba(0,0,0,0.03)] dark:shadow-gray-900/20">
                <div className="flex justify-between items-end mb-4">
                    <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight leading-none">완벽한 하루</h1>
                    <div className="flex items-center gap-3 text-sm">
                        <button
                            onClick={() => setSortBy("views")}
                            className={`${
                                sortBy === "views" ? "font-bold text-emerald-600 dark:text-emerald-400" : "font-medium text-gray-400 dark:text-gray-500"
                            } transition-colors`}
                        >
                            인기순
                        </button>
                        <span className="text-gray-200 dark:text-gray-700 text-xs">|</span>
                        <button
                            onClick={() => setSortBy("latest")}
                            className={`${
                                sortBy === "latest" ? "font-bold text-emerald-600 dark:text-emerald-400" : "font-medium text-gray-400 dark:text-gray-500"
                            } transition-colors`}
                        >
                            최신순
                        </button>
                    </div>
                </div>
                <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2 -mx-5 px-5">
                    <button
                        onClick={() => {
                            // 🟢 [Performance]: 다음 프레임에서 실행하여 부드러운 전환
                            requestAnimationFrame(() => {
                                setIsNavigating(true);
                                router.prefetch("/courses");
                                router.push("/courses");
                            });
                        }}
                        disabled={isNavigating}
                        className={`whitespace-nowrap px-3.5 py-1.5 rounded-full text-[13px] font-semibold border transition-all ${
                            activeConcept === ""
                                ? "bg-emerald-600 text-white border-emerald-600"
                                : "bg-white text-gray-500 border-gray-200"
                        } ${isNavigating ? "opacity-50 cursor-wait" : ""}`}
                    >
                        전체
                    </button>
                    {STATIC_CONCEPTS.map((tag) => (
                        <button
                            key={tag}
                            onClick={() => {
                                // 🟢 [Performance]: 다음 프레임에서 실행하여 부드러운 전환
                                requestAnimationFrame(() => {
                                    setIsNavigating(true);
                                    const targetPath =
                                        activeConcept === tag
                                            ? "/courses"
                                            : `/courses?concept=${encodeURIComponent(tag)}`;
                                    // 🟢 prefetch로 미리 로드하여 빠른 전환
                                    router.prefetch(targetPath);
                                    router.push(targetPath);
                                });
                            }}
                            disabled={isNavigating} // 🟢 네비게이션 중 중복 클릭 방지
                            className={`whitespace-nowrap px-3.5 py-1.5 rounded-full text-[13px] font-semibold border transition-all ${
                                activeConcept === tag
                                    ? "bg-emerald-600 text-white border-emerald-600"
                                    : "bg-white text-gray-500 border-gray-200"
                            } ${isNavigating ? "opacity-50 cursor-wait" : ""}`}
                        >
                            {tag}
                        </button>
                    ))}
                </div>
            </div>

            <div className="px-5 py-6 space-y-6">
                {/* 🟢 [Performance]: 네비게이션 로딩 표시 */}
                {isNavigating && (
                    <div className="fixed inset-0 bg-white/80 dark:bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center">
                        <div className="text-center">
                            <div className="inline-block animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-600 mb-3"></div>
                            <p className="text-gray-600 dark:text-gray-300 font-medium">코스를 불러오는 중...</p>
                        </div>
                    </div>
                )}
                {/* 🟢 [Optimization 3] 반복되는 컴포넌트 렌더링 최적화 */}
                {visibleCourses.map((course, i) => {
                    // 🟢 코스 5개마다 제보 유도 배너 삽입
                    const shouldShowBanner = i > 0 && i % 5 === 0;
                    return (
                        <div key={course.id}>
                            {shouldShowBanner && (
                                <div className="mb-6">
                                    <CourseReportBanner />
                                </div>
                            )}
                            <CourseCard
                                course={course}
                                isPriority={i < 4} // 🟢 상위 4개 이미지만 우선 로딩
                                isFavorite={favoriteIds.has(Number(course.id))}
                                onToggleFavorite={toggleFavorite}
                                showNewBadge={true}
                            />
                        </div>
                    );
                })}
                {visibleCourses.length === 0 && (
                    <div className="text-center py-20">
                        <div className="text-5xl mb-4 grayscale opacity-50">🏝️</div>
                        <p className="text-gray-500 dark:text-gray-400 font-medium">조건에 맞는 코스가 없어요.</p>
                    </div>
                )}
                {loadingMore && (
                    <div className="text-center py-8">
                        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
                        <p className="text-gray-500 dark:text-gray-400 text-sm mt-2">불러오는 중...</p>
                    </div>
                )}
                {!hasMore && visibleCourses.length > 0 && (
                    <div className="text-center py-8">
                        <p className="text-gray-400 dark:text-gray-500 text-sm">모든 코스를 불러왔습니다.</p>
                    </div>
                )}
                <div ref={loadMoreRef} aria-hidden="true" className="h-1"></div>
            </div>
        </div>
    );
}
