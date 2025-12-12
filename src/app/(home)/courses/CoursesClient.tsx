"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import Image from "@/components/ImageFallback";
// ✅ [필수] 한글 변환을 위해 CONCEPTS 가져오기
import { CONCEPTS } from "@/constants/onboardingData";

// --- Type Definitions ---
type PlaceClosedDay = {
    day_of_week: number | null;
    specific_date: Date | string | null;
    note?: string | null;
};

type Place = {
    id: number;
    name: string;
    imageUrl?: string;
    latitude?: number;
    longitude?: number;
    opening_hours?: string | null;
    closed_days?: PlaceClosedDay[];
};

type CoursePlace = {
    order_index: number;
    place: Place | null;
};

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
}

interface CoursesClientProps {
    initialCourses: Course[];
}

export default function CoursesClient({ initialCourses }: CoursesClientProps) {
    const searchParams = useSearchParams();
    const router = useRouter();
    const conceptParam = searchParams.get("concept");

    // Initialize state
    const [courses, setCourses] = useState<Course[]>(initialCourses);
    const [sortBy, setSortBy] = useState<"views" | "latest">("views");
    const [activeConcept, setActiveConcept] = useState<string>(conceptParam || "");
    const [favoriteIds, setFavoriteIds] = useState<Set<number>>(new Set());

    useEffect(() => {
        if (conceptParam) {
            setActiveConcept(conceptParam);
        } else {
            setActiveConcept("");
        }
    }, [conceptParam]);

    useEffect(() => {
        setCourses(initialCourses);
    }, [initialCourses]);

    // --- Sorting Logic ---
    const sortedCourses = useMemo(() => {
        const list = [...courses];
        if (sortBy === "views") {
            list.sort((a, b) => (b.viewCount || 0) - (a.viewCount || 0));
        } else {
            list.sort((a: any, b: any) => {
                const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
                const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
                if (tb !== ta) return tb - ta;
                return Number(b.id) - Number(a.id);
            });
        }
        return list;
    }, [courses, sortBy]);

    const STATIC_CONCEPTS: string[] = useMemo(
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

    // --- Filtering Logic ---
    const visibleCourses = useMemo(() => {
        if (!activeConcept) return sortedCourses;
        const target = activeConcept.trim().toLowerCase();
        return sortedCourses.filter(
            (c) =>
                String(c.concept || "")
                    .trim()
                    .toLowerCase() === target
        );
    }, [sortedCourses, activeConcept]);

    // --- Favorites Logic ---
    useEffect(() => {
        try {
            const token = localStorage.getItem("authToken");
            if (!token) return;
            fetch("/api/users/favorites", {
                headers: { Authorization: `Bearer ${token}` },
                cache: "no-store",
            })
                .then((res) => (res.ok ? res.json() : []))
                .then((list: any[]) => {
                    const ids = new Set<number>();
                    (list || []).forEach((f: any) => {
                        const id = Number(f?.course?.id ?? f?.course_id ?? f?.courseId ?? f?.id);
                        if (Number.isFinite(id)) ids.add(id);
                    });
                    setFavoriteIds(ids);
                })
                .catch(() => {});
        } catch {}
    }, []);

    const toggleFavorite = async (e: React.MouseEvent, courseId: string | number) => {
        e.stopPropagation();
        const idNum = Number(courseId);
        const token = localStorage.getItem("authToken");
        if (!token) {
            if (confirm("로그인이 필요합니다.")) router.push("/login");
            return;
        }
        const liked = favoriteIds.has(idNum);
        try {
            if (!liked) {
                const res = await fetch("/api/users/favorites", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify({ courseId: idNum }),
                });
                if (res.ok) {
                    setFavoriteIds((prev) => {
                        const s = new Set(prev);
                        s.add(idNum);
                        return s;
                    });
                }
            } else {
                const res = await fetch(`/api/users/favorites?courseId=${idNum}`, {
                    method: "DELETE",
                    headers: { Authorization: `Bearer ${token}` },
                });
                if (res.ok) {
                    setFavoriteIds((prev) => {
                        const s = new Set(prev);
                        s.delete(idNum);
                        return s;
                    });
                }
            }
        } catch {}
    };

    return (
        <div className="min-h-screen bg-[#F8F9FA]">
            {/* Header */}
            <div className="bg-white px-5 pt-6 pb-2 sticky top-0 z-20 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
                <div className="flex justify-between items-end mb-4">
                    <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight leading-none">완벽한 하루</h1>
                    <div className="flex items-center gap-3 text-sm">
                        <button
                            onClick={() => setSortBy("views")}
                            className={`${
                                sortBy === "views" ? "font-bold text-emerald-600" : "font-medium text-gray-400"
                            } transition-colors`}
                        >
                            인기순
                        </button>
                        <span className="text-gray-200 text-xs">|</span>
                        <button
                            onClick={() => setSortBy("latest")}
                            className={`${
                                sortBy === "latest" ? "font-bold text-emerald-600" : "font-medium text-gray-400"
                            } transition-colors`}
                        >
                            최신순
                        </button>
                    </div>
                </div>

                {/* Concept Chips */}
                <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2 -mx-5 px-5">
                    <button
                        onClick={() => {
                            router.push("/courses");
                        }}
                        className={`whitespace-nowrap px-3.5 py-1.5 rounded-full text-[13px] font-semibold transition-all border ${
                            activeConcept === ""
                                ? "bg-emerald-600 text-white border-emerald-600"
                                : "bg-white text-gray-500 border-gray-200 hover:border-emerald-600 hover:text-emerald-600"
                        }`}
                    >
                        전체
                    </button>

                    {STATIC_CONCEPTS.map((tag) => (
                        <button
                            key={tag}
                            onClick={() => {
                                if (activeConcept === tag) {
                                    router.push("/courses");
                                } else {
                                    router.push(`/courses?concept=${encodeURIComponent(tag)}`);
                                }
                            }}
                            className={`whitespace-nowrap px-3.5 py-1.5 rounded-full text-[13px] font-semibold transition-all border ${
                                activeConcept === tag
                                    ? "bg-emerald-600 text-white border-emerald-600"
                                    : "bg-white text-gray-500 border-gray-200 hover:border-emerald-600 hover:text-emerald-600"
                            }`}
                        >
                            {tag}
                        </button>
                    ))}
                </div>
            </div>

            {/* List Area */}
            <div className="px-5 py-6 space-y-6">
                {visibleCourses.map((course, i) => {
                    // ✅ [수정됨] 문법 오류 해결: map 함수 내부에서 변수 선언 시 { } 사용 및 return 추가
                    const displayConcept = CONCEPTS[course.concept as keyof typeof CONCEPTS] || course.concept;

                    return (
                        <div key={course.id} className="group relative w-full mb-8">
                            <Link
                                href={`/courses/${course.id}`}
                                className="absolute inset-0 z-10"
                                onClick={() => {
                                    try {
                                        fetch(`/api/courses/${course.id}/view`, {
                                            method: "POST",
                                            keepalive: true,
                                        }).catch(() => {});
                                    } catch {}
                                }}
                            />

                            {/* Image */}
                            <div className="relative w-full h-64 overflow-hidden rounded-xl bg-gray-100 mb-3 shadow-sm">
                                <Image
                                    src={course.imageUrl || ""}
                                    alt={course.title}
                                    fill
                                    className="object-cover group-hover:scale-105 transition-transform duration-500"
                                    priority={i < 2}
                                    sizes="(max-width: 768px) 100vw, 500px"
                                    quality={70}
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent" />

                                <div className="absolute top-3 left-3 flex flex-wrap gap-1.5 pointer-events-none">
                                    <span className="px-2 py-1 rounded-lg text-[10px] font-bold text-white bg-black/40 backdrop-blur-md">
                                        {displayConcept}
                                    </span>
                                    {course.reviewCount === 0 && (
                                        <span className="px-2 py-1 rounded-lg text-[10px] font-bold text-white bg-[#7aa06f] shadow-sm">
                                            NEW
                                        </span>
                                    )}
                                </div>

                                <button
                                    onClick={(e) => toggleFavorite(e, course.id)}
                                    className="absolute top-3 right-3 z-10 flex items-center justify-center w-11 h-11 rounded-full bg-black/40 backdrop-blur-md hover:bg-black/50 transition-all active:scale-90 shadow-sm"
                                >
                                    <svg
                                        className={`w-7 h-7 drop-shadow-sm transition-colors ${
                                            favoriteIds.has(Number(course.id))
                                                ? "text-red-500 fill-red-500"
                                                : "text-white"
                                        }`}
                                        fill={favoriteIds.has(Number(course.id)) ? "currentColor" : "none"}
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                        strokeWidth={2}
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                                        />
                                    </svg>
                                </button>
                            </div>

                            {/* Info */}
                            <div className="px-1 pt-1">
                                <div className="flex flex-wrap gap-2 mb-3">
                                    <span className="inline-block px-2 py-1 bg-gray-100 rounded-md text-[13px] font-bold text-gray-700">
                                        #{course.location}
                                    </span>
                                    <span className="inline-block px-2 py-1 bg-gray-100 rounded-md text-[13px] font-bold text-gray-700">
                                        #{course.duration}
                                    </span>
                                </div>

                                <h3 className="text-lg font-bold text-gray-900 leading-snug line-clamp-2 mb-2">
                                    {course.title}
                                </h3>

                                <div className="text-xs font-medium">
                                    {(() => {
                                        const views = Number(course.viewCount || 0);
                                        const formatCount = (n: number) => {
                                            if (n >= 10000) return `${(n / 10000).toFixed(n % 10000 ? 1 : 0)}만`;
                                            if (n >= 1000) return `${(n / 1000).toFixed(n % 1000 ? 1 : 0)}천`;
                                            return `${n}`;
                                        };

                                        if (views >= 1000) {
                                            return (
                                                <span className="text-orange-600 font-bold">
                                                    👀 {formatCount(views)}명이 보는 중
                                                </span>
                                            );
                                        }
                                        if (course.reviewCount > 0) {
                                            return (
                                                <span className="text-gray-700">
                                                    ★ {course.rating} ({course.reviewCount})
                                                </span>
                                            );
                                        }
                                        return null;
                                    })()}
                                </div>
                            </div>
                        </div>
                    );
                })}

                {visibleCourses.length === 0 && (
                    <div className="text-center py-20">
                        <div className="text-5xl mb-4 grayscale opacity-50">🏝️</div>
                        <p className="text-gray-500 font-medium">조건에 맞는 코스가 없어요.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
