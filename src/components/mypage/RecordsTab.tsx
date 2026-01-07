"use client";

import React, { useState, useEffect, memo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import CourseCard from "@/components/CourseCard";
import Image from "@/components/ImageFallback";
import { Favorite, CompletedCourse, CasefileItem } from "@/types/user";

// 🟢 코스 이미지 로더 컴포넌트 (이미지가 없을 때 백그라운드에서 로드)
const CourseImageLoader = ({
    courseId,
    onImageLoaded,
}: {
    courseId: number | string;
    onImageLoaded: (url: string) => void;
}) => {
    const [loadedImageUrl, setLoadedImageUrl] = useState<string | null>(null);

    useEffect(() => {
        const loadImage = async () => {
            try {
                const res = await fetch(`/api/courses/${courseId}`);
                if (res.ok) {
                    const data = await res.json();
                    const imageUrl =
                        data.imageUrl?.trim() ||
                        data.coursePlaces?.[0]?.place?.imageUrl?.trim() ||
                        data.coursePlaces?.[0]?.place?.image_url?.trim() ||
                        "";
                    if (imageUrl) {
                        setLoadedImageUrl(imageUrl);
                        onImageLoaded(imageUrl);
                    }
                }
            } catch (error) {
                console.error("코스 이미지 로드 실패:", error);
            }
        };
        loadImage();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [courseId]); // onImageLoaded는 의존성에서 제외 (무한 루프 방지)

    // 이미지가 로드되면 Image 컴포넌트로 표시
    if (loadedImageUrl) {
        return (
            <Image
                src={loadedImageUrl}
                alt="Course"
                fill
                className="object-cover rounded-none"
                loading="lazy" // 🟢 성능 최적화: lazy loading 적용
                quality={70} // 🟢 성능 최적화: quality 설정
            />
        );
    }

    return (
        <div className="w-full h-full flex items-center justify-center bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500 text-sm">
            이미지 없음
        </div>
    );
};

interface RecordsTabProps {
    favorites: Favorite[];
    savedCourses: any[];
    completed: CompletedCourse[];
    casefiles: CasefileItem[];
    onRemoveFavorite: (id: number) => void;
    onOpenCaseModal: (id: number, title: string) => void;
    userTier?: "FREE" | "BASIC" | "PREMIUM";
}

const RecordsTab = ({
    favorites,
    savedCourses,
    completed,
    casefiles,
    onRemoveFavorite,
    onOpenCaseModal,
    userTier = "FREE",
}: RecordsTabProps) => {
    const router = useRouter();
    const [subTab, setSubTab] = useState<"favorites" | "saved" | "completed" | "casefiles">("favorites");
    // 🟢 각 코스의 이미지 URL을 저장 (코스 ID -> 이미지 URL)
    const [courseImages, setCourseImages] = useState<Record<number | string, string>>({});
    
    // 🟢 iOS 플랫폼 체크
    const [isIOS, setIsIOS] = useState(false);
    useEffect(() => {
        if (typeof window !== "undefined") {
            const userAgent = navigator.userAgent.toLowerCase();
            setIsIOS(/iphone|ipad|ipod/.test(userAgent));
        }
    }, []);

    const subTabs = [
        { id: "favorites" as const, label: "보관함", count: favorites.length },
        { id: "saved" as const, label: "AI 추천", count: savedCourses.length },
        { id: "completed" as const, label: "완료 코스", count: completed.length },
        { id: "casefiles" as const, label: "사건 파일", count: casefiles.length },
    ];

    return (
        <div className="space-y-6">
            {/* 서브 탭 네비게이션 */}
            <div className="bg-white dark:bg-[#1a241b] rounded-xl border border-gray-100 dark:border-gray-800 p-4 overflow-x-auto no-scrollbar">
                <div className="flex space-x-2 min-w-max">
                    {subTabs.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setSubTab(tab.id)}
                            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                                subTab === tab.id
                                    ? "bg-slate-900 dark:bg-blue-700 text-white"
                                    : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
                            }`}
                        >
                            {tab.label} ({tab.count})
                        </button>
                    ))}
                </div>
            </div>

            {/* 보관함 (Favorites) */}
            {subTab === "favorites" && (
                <div className="bg-white dark:bg-[#1a241b] rounded-xl border border-gray-100 dark:border-gray-800 p-6 md:p-8">
                    <h3 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white mb-4 md:mb-6 tracking-tight">
                        내 여행 보관함
                    </h3>
                    {favorites.length > 0 ? (
                        <div className="space-y-6">
                            {favorites.map((favorite) => {
                                const courseGrade = favorite.course.grade || "FREE";
                                let isLocked = false;
                                
                                // 🟢 iOS 출시 기념 이벤트: Basic 코스 무료 제공
                                if (userTier === "PREMIUM") {
                                    isLocked = false;
                                } else if (userTier === "BASIC") {
                                    if (courseGrade === "PREMIUM") isLocked = true;
                                } else {
                                    // 🟢 iOS: Basic 코스는 무료, Premium만 잠금
                                    if (isIOS) {
                                        if (courseGrade === "PREMIUM") isLocked = true;
                                        // Basic 코스는 isLocked = false (무료)
                                    } else {
                                        if (courseGrade === "BASIC" || courseGrade === "PREMIUM") isLocked = true;
                                    }
                                }

                                return (
                                    <CourseCard
                                        key={favorite.id}
                                        course={{
                                            id: String(favorite.course.id),
                                            title: favorite.course.title,
                                            description: favorite.course.description,
                                            imageUrl: favorite.course.imageUrl,
                                            concept: favorite.course.concept,
                                            grade: courseGrade,
                                            isLocked: isLocked,
                                            rating: favorite.course.rating,
                                            reviewCount: 0,
                                            viewCount: 0,
                                        }}
                                        isFavorite={true}
                                        onToggleFavorite={(e) => {
                                            e.stopPropagation();
                                            onRemoveFavorite(favorite.course_id);
                                        }}
                                        showNewBadge={false}
                                    />
                                );
                            })}
                        </div>
                    ) : (
                        <div className="text-center py-8">
                            <div className="text-6xl mb-4">💖</div>
                            <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">찜한 코스가 없어요</h4>
                            <p className="text-gray-600 dark:text-gray-400 mb-4">마음에 드는 코스를 찜해보세요!</p>
                            <button
                                onClick={() => {
                                    router.prefetch("/courses"); // 🟢 성능 최적화: prefetch 추가
                                    router.push("/courses");
                                }}
                                className="px-6 py-3 bg-blue-600 dark:bg-blue-700 text-white rounded-lg font-medium hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors cursor-pointer"
                            >
                                코스 둘러보기
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* AI 추천 (Saved) */}
            {subTab === "saved" && (
                <div className="bg-white dark:bg-[#1a241b] rounded-xl border border-gray-100 dark:border-gray-800 p-6 md:p-8">
                    <h3 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white mb-4 md:mb-6 tracking-tight">
                        AI가 추천해준 나만의 코스
                    </h3>
                    {savedCourses.length > 0 ? (
                        <div className="space-y-6">
                            {savedCourses.map((item) => (
                                <CourseCard
                                    key={item.id}
                                    course={{
                                        id: String(item.course.id),
                                        title: item.course.title,
                                        description: item.course.description,
                                        imageUrl: item.course.imageUrl,
                                        concept: item.course.concept,
                                        region: item.course.region,
                                        grade: "FREE",
                                        isLocked: false,
                                        rating: 0,
                                        reviewCount: 0,
                                        viewCount: 0,
                                    }}
                                    isFavorite={false}
                                    onToggleFavorite={() => {}}
                                    showNewBadge={false}
                                />
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-10">
                            <div className="text-6xl mb-3">✨</div>
                            <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">아직 AI 추천 코스가 없어요</h4>
                            <p className="text-gray-600 dark:text-gray-400 mb-4">나에게 딱 맞는 코스를 추천받아보세요!</p>
                            <button
                                onClick={() => router.push("/personalized-home")}
                                className="px-6 py-3 bg-slate-900 dark:bg-slate-800 text-white rounded-lg font-medium hover:bg-slate-800 dark:hover:bg-slate-700 transition-colors cursor-pointer tracking-tight"
                            >
                                AI 추천 받으러 가기
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* 완료한 코스 (Completed) */}
            {subTab === "completed" && (
                <div className="bg-white dark:bg-[#1a241b] rounded-xl border border-gray-100 dark:border-gray-800 p-6 md:p-8">
                    <div className="flex items-center justify-between mb-4 md:mb-6">
                        <h3 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white tracking-tight">완료한 코스</h3>
                    </div>
                    {completed.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {completed.map((c) => {
                                // 🟢 이미지 URL 결정: 코스 이미지 > 로드된 이미지 > 로더
                                const displayImageUrl = c.imageUrl || courseImages[c.course_id] || "";

                                return (
                                    <Link
                                        key={c.course_id}
                                        href={`/courses/${c.course_id}`}
                                        prefetch={true} // 🟢 성능 최적화: prefetch 추가
                                        className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden hover:border-gray-300 dark:hover:border-gray-600 transition-colors cursor-pointer block"
                                    >
                                        <div className="relative">
                                            <div className="relative h-48">
                                                {displayImageUrl ? (
                                                    <Image
                                                        src={displayImageUrl}
                                                        alt={c.title}
                                                        fill
                                                        className="object-cover rounded-none"
                                                        loading="lazy" // 🟢 성능 최적화: lazy loading 적용
                                                        quality={70} // 🟢 성능 최적화: quality 설정
                                                        onError={async () => {
                                                            // 이미지 로드 실패 시 코스 상세에서 가져오기
                                                            if (!courseImages[c.course_id]) {
                                                                try {
                                                                    const res = await fetch(
                                                                        `/api/courses/${c.course_id}`
                                                                    );
                                                                    if (res.ok) {
                                                                        const data = await res.json();
                                                                        const imageUrl =
                                                                            data.imageUrl?.trim() ||
                                                                            data.coursePlaces?.[0]?.place?.imageUrl?.trim() ||
                                                                            data.coursePlaces?.[0]?.place?.image_url?.trim() ||
                                                                            "";
                                                                        if (imageUrl) {
                                                                            setCourseImages((prev) => ({
                                                                                ...prev,
                                                                                [c.course_id]: imageUrl,
                                                                            }));
                                                                        }
                                                                    }
                                                                } catch (error) {
                                                                    console.error("코스 이미지 로드 실패:", error);
                                                                }
                                                            }
                                                        }}
                                                    />
                                                ) : (
                                                    <CourseImageLoader
                                                        courseId={c.course_id}
                                                        onImageLoaded={(url) => {
                                                            if (url) {
                                                                setCourseImages((prev) => ({
                                                                    ...prev,
                                                                    [c.course_id]: url,
                                                                }));
                                                            }
                                                        }}
                                                    />
                                                )}
                                            </div>
                                            {c.concept && (
                                                <div className="absolute bottom-2 left-2 bg-emerald-500 text-white px-2 py-1 rounded-full text-xs font-medium">
                                                    {c.concept}
                                                </div>
                                            )}
                                        </div>
                                        <div className="p-4 bg-white dark:bg-gray-800/50">
                                            <h4 className="text-base md:text-lg font-semibold text-gray-900 dark:text-white mb-1 line-clamp-2">
                                                {c.title}
                                            </h4>
                                            <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400">
                                                {c.completedAt && (
                                                    <span>{new Date(c.completedAt).toLocaleDateString()}</span>
                                                )}
                                            </div>
                                        </div>
                                    </Link>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="text-center py-10">
                            <div className="text-6xl mb-3">✅</div>
                            <div className="text-lg font-semibold text-gray-900 dark:text-white mb-1">아직 완료한 코스가 없어요</div>
                            <div className="text-gray-600 dark:text-gray-400 mb-4">코스를 완료하면 여기에서 확인할 수 있어요</div>
                            <button
                                onClick={() => router.push("/courses")}
                                className="px-6 py-3 bg-blue-600 dark:bg-blue-700 text-white rounded-lg font-medium hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors cursor-pointer"
                            >
                                코스 둘러보기
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* 사건 파일 (Casefiles) */}
            {subTab === "casefiles" && (
                <div className="bg-white dark:bg-[#1a241b] rounded-xl border border-gray-100 dark:border-gray-800 p-6 md:p-8">
                    <div className="flex items-center justify-between mb-4 md:mb-6">
                        <h3 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white tracking-tight">완료한 사건 파일</h3>
                    </div>
                    {casefiles.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {casefiles.map((f) => (
                                <div
                                    key={f.story_id}
                                    className="group relative rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 transition-colors cursor-pointer"
                                    onClick={() => onOpenCaseModal(f.story_id, f.title)}
                                >
                                    <div className="relative h-60">
                                        {f.imageUrl ? (
                                            <img
                                                src={f.imageUrl}
                                                alt={f.title}
                                                className="w-full h-full object-cover"
                                            />
                                        ) : (
                                            <div className="w-full h-full bg-gray-100 dark:bg-gray-800" />
                                        )}
                                        <div className="absolute inset-0 bg-linear-to-t from-black/70 via-black/20 to-transparent" />
                                        <div className="absolute bottom-0 left-0 right-0 p-4">
                                            <h4 className="text-white font-bold text-lg line-clamp-2">{f.title}</h4>
                                            <div className="mt-1 flex items-center justify-between text-xs text-white/80">
                                                <span>{f.region || ""}</span>
                                                <span>
                                                    {f.completedAt ? new Date(f.completedAt).toLocaleDateString() : ""}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="absolute left-0 top-0 bottom-0 w-2 bg-black/10" />
                                        {f.badge?.name && (
                                            <div className="absolute top-3 right-3 bg-amber-500 text-white px-2 py-1 rounded-full text-xs font-medium">
                                                {f.badge.name}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-10">
                            <div className="text-6xl mb-3">🗂️</div>
                            <div className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                                아직 완료한 사건 파일이 없어요
                            </div>
                            <div className="text-gray-600 dark:text-gray-400">Escape 스토리를 완료하면 여기에서 볼 수 있어요</div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

// 🟢 성능 최적화: React.memo로 불필요한 리렌더링 방지
export default memo(RecordsTab);
