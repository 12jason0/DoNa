"use client";

import React, { useState, useEffect } from "react";
import Image from "@/components/ImageFallback";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface Course {
    id: string;
    title: string;
    description: string;
    duration: string;
    location: string;
    price: string;
    participants: number;
    imageUrl: string;
    concept: string;
    rating: number;
    reviewCount: number;
    viewCount: number;
    creator?: {
        id: string;
        name: string;
    };
}

interface Review {
    id: string;
    userId: string;
    courseId: string;
    rating: number;
    comment: string;
    createdAt: string;
    imageUrls?: string[];
    user: {
        nickname: string;
        initial: string;
    };
    course: {
        title: string;
        concept: string;
    };
}

const AboutPage = () => {
    const router = useRouter();
    const [courseCount, setCourseCount] = useState<number>(0);
    const [courses, setCourses] = useState<Course[]>([]);
    const [reviews, setReviews] = useState<Review[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentReviewPage, setCurrentReviewPage] = useState(0);
    // 코스 슬라이드 상태
    const [currentCourseIndex, setCurrentCourseIndex] = useState(0);
    const [courseTouchStartX, setCourseTouchStartX] = useState<number | null>(null);
    const [courseDeltaX, setCourseDeltaX] = useState(0);
    const [isCourseDragging, setIsCourseDragging] = useState(false);
    // 리뷰 이미지 미리보기 상태
    const [previewImage, setPreviewImage] = useState<string | null>(null);
    const [previewImages, setPreviewImages] = useState<string[]>([]);
    const [previewImageIndex, setPreviewImageIndex] = useState(0);

    // 페이지 로드 시 스크롤을 맨 위로
    useEffect(() => {
        window.scrollTo(0, 0);
    }, []);

    // 코스 개수는 항상 DB에서 직접 최신값을 가져오도록 별도로 요청
    useEffect(() => {
        const fetchCourseCount = async () => {
            try {
                const res = await fetch("/api/courses/count", { cache: "no-store" });
                if (res.ok) {
                    const data: { count: number } = await res.json();
                    setCourseCount(data.count || 0);
                }
            } catch (e) {
                console.error("Failed to fetch live course count", e);
            }
        };
        fetchCourseCount();
    }, []);

    useEffect(() => {
        const fetchData = async () => {
            try {
                // 캐시된 데이터 확인
                const cachedData = sessionStorage.getItem("aboutPageData");
                const cacheTime = sessionStorage.getItem("aboutPageDataTime");
                const now = Date.now();

                // 5분 이내 캐시된 데이터가 있으면 사용
                if (cachedData && cacheTime && now - parseInt(cacheTime) < 5 * 60 * 1000) {
                    const data = JSON.parse(cachedData);
                    setCourseCount(data.courseCount);
                    setCourses(data.courses);
                    setReviews(data.reviews);
                    setLoading(false);
                    return;
                }

                // 코스 개수, 코스 데이터, 후기 데이터를 병렬로 가져오기
                const [countResponse, coursesResponse, reviewsResponse] = await Promise.all([
                    fetch("/api/courses/count", {
                        cache: "force-cache",
                        next: { revalidate: 300 }, // 5분 캐시
                    }),
                    fetch("/api/courses?limit=3&grade=FREE", {
                        cache: "force-cache",
                        next: { revalidate: 300 },
                    }),
                    fetch("/api/reviews?limit=9", {
                        cache: "force-cache",
                        next: { revalidate: 300 },
                    }),
                ]);

                let countData: { count: number } = { count: 0 };
                let coursesData: any[] = [];
                let reviewsData: any[] = [];

                if (countResponse.ok) {
                    countData = await countResponse.json();
                    setCourseCount(countData.count);
                } else {
                    console.error("Failed to fetch course count");
                    setCourseCount(0);
                }

                if (coursesResponse.ok) {
                    coursesData = await coursesResponse.json();
                    setCourses(coursesData);
                } else {
                    console.error("Failed to fetch courses");
                    setCourses([]);
                }

                if (reviewsResponse.ok) {
                    reviewsData = await reviewsResponse.json();
                    // 9개의 후기를 가져와서 3개씩 3페이지로 나누기
                    setReviews(reviewsData.slice(0, 9));
                } else {
                    console.error("Failed to fetch reviews:", reviewsResponse.status);
                    setReviews([]);
                }

                // 데이터를 캐시에 저장
                const dataToCache = {
                    courseCount: countData.count || 0,
                    courses: coursesData,
                    reviews: reviewsData.slice(0, 9),
                };
                sessionStorage.setItem("aboutPageData", JSON.stringify(dataToCache));
                sessionStorage.setItem("aboutPageDataTime", now.toString());
            } catch (error) {
                console.error("Error fetching data:", error);
                setCourseCount(0);
                setCourses([]);
                setReviews([]);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    // 자동 슬라이드 효과 (후기 하나씩)
    useEffect(() => {
        if (reviews.length > 0) {
            const interval = setInterval(() => {
                setCurrentReviewPage((prev) => (prev + 1) % reviews.length);
            }, 5000);
            return () => clearInterval(interval);
        }
    }, [reviews.length]);
    return (
        <>
            <main className="min-h-screen bg-white pt-10">
                {/* 히어로 섹션 */}
                <section className="pt-10 pb-10 px-4">
                    <div className="max-w-[500px] mx-auto text-center">
                        <div className="mb-6">
                            <span className="text-6xl">📦</span>
                        </div>
                        <h1 className="text-3xl font-bold text-gray-900 mb-4">여행, 이제 직접 안 짜도 돼요</h1>
                        <p className="text-lg font-semibold text-blue-600 mb-3">밀키트처럼 꺼내 먹는 여행 코스, DoNa</p>
                        <p className="text-base text-gray-600 mb-6 max-w-3xl mx-auto">
                            여행 계획하기 귀찮으시죠? DoNa가 여러분을 위한 완벽한 여행 코스를 준비해드립니다. 컨셉과
                            카테고리만 선택하면 바로 출발할 수 있어요!
                        </p>
                        <div className="flex flex-wrap justify-center gap-3">
                            <div className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold">
                                💕 커플
                            </div>
                            <div className="bg-purple-600 text-white px-4 py-2 rounded-lg text-sm font-semibold">
                                👨‍👩‍👧‍👦 가족
                            </div>
                            <div className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-semibold">
                                👥 친구
                            </div>
                            <div className="bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-semibold">
                                ☕ 카페
                            </div>
                            <div className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-semibold">
                                🍽️ 맛집
                            </div>
                            <div className="bg-teal-600 text-white px-4 py-2 rounded-lg text-sm font-semibold">
                                🌿 힐링
                            </div>
                        </div>
                    </div>
                </section>

                {/* 사회적 증거 섹션 */}
                <section className="py-8 px-4 bg-white">
                    <div className="max-w-[500px] mx-auto text-center">
                        <div className="grid grid-cols-1 gap-4">
                            <div className="text-center">
                                <div className="text-2xl font-bold text-blue-600 mb-1">213+</div>
                                <div className="text-gray-600">지금까지 여행을 떠난 사용자</div>
                            </div>
                            <div className="text-center">
                                <div className="text-2xl font-bold text-purple-600 mb-1">4.7★</div>
                                <div className="text-gray-600">평균 사용자 만족도</div>
                            </div>
                            <div className="text-center">
                                <div className="text-2xl font-bold text-green-600 mb-1">
                                    {loading ? "..." : `${courseCount}개`}
                                </div>
                                <div className="text-gray-600">검증된 완벽한 코스</div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* 서비스 설명 섹션 */}
                <section className="py-12 px-4 bg-gray-50">
                    <div className="max-w-[500px] mx-auto">
                        <h2 className="text-xl font-bold text-center text-gray-900 mb-6">
                            이렇게 간단해요! 3단계로 완성되는 여행
                        </h2>
                        <div className="grid grid-cols-1 gap-6">
                            {/* 1단계 */}
                            <div className="text-center p-4 rounded-xl bg-white shadow-lg">
                                <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-3">
                                    <span className="text-xl">1️⃣</span>
                                </div>
                                <h3 className="text-lg font-semibold text-gray-900 mb-2">컨셉 선택</h3>
                                <p className="text-gray-600 text-sm">
                                    커플, 가족, 친구 중에서 누구와 함께 여행할지 선택하세요
                                </p>
                            </div>

                            {/* 2단계 */}
                            <div className="text-center p-4 rounded-xl bg-white shadow-lg">
                                <div className="w-12 h-12 bg-purple-600 rounded-full flex items-center justify-center mx-auto mb-3">
                                    <span className="text-xl">2️⃣</span>
                                </div>
                                <h3 className="text-lg font-semibold text-gray-900 mb-2">AI 코스 추천</h3>
                                <p className="text-gray-600 text-sm">
                                    AI가 여러분의 취향, 현재 날씨, 이동 동선을 분석해서 완벽한 여행 코스를 추천해드려요
                                </p>
                            </div>

                            {/* 3단계 */}
                            <div className="text-center p-4 rounded-xl bg-white shadow-lg">
                                <div className="w-12 h-12 bg-green-600 rounded-full flex items-center justify-center mx-auto mb-3">
                                    <span className="text-xl">3️⃣</span>
                                </div>
                                <h3 className="text-lg font-semibold text-gray-900 mb-2">바로 여행 출발</h3>
                                <p className="text-gray-600 text-sm">
                                    지도에서 코스를 확인하고 바로 여행을 시작하세요!
                                </p>
                            </div>
                        </div>
                    </div>
                </section>

                {/* 예시 코스 미리보기 - 한 장 슬라이드 + 드래그/스와이프 */}
                <section className="py-12 px-4 bg-white select-none">
                    <div className="max-w-[500px] mx-auto">
                        <h2 className="text-xl font-bold text-center text-gray-900 mb-6">
                            이런 코스들이 준비되어 있어요
                        </h2>
                        <div className="relative">
                            <div
                                className="overflow-hidden"
                                onTouchStart={(e) => {
                                    if (e.touches && e.touches.length > 0) {
                                        setCourseTouchStartX(e.touches[0].clientX);
                                        setCourseDeltaX(0);
                                        setIsCourseDragging(true);
                                    }
                                }}
                                onTouchMove={(e) => {
                                    if (courseTouchStartX !== null && e.touches && e.touches.length > 0) {
                                        setCourseDeltaX(e.touches[0].clientX - courseTouchStartX);
                                    }
                                }}
                                onTouchEnd={() => {
                                    const threshold = 40;
                                    if (courses.length > 0) {
                                        if (courseDeltaX > threshold)
                                            setCurrentCourseIndex((p) => (p - 1 + courses.length) % courses.length);
                                        else if (courseDeltaX < -threshold)
                                            setCurrentCourseIndex((p) => (p + 1) % courses.length);
                                    }
                                    setCourseTouchStartX(null);
                                    setCourseDeltaX(0);
                                    setIsCourseDragging(false);
                                }}
                                onMouseDown={(e) => {
                                    setCourseTouchStartX(e.clientX);
                                    setCourseDeltaX(0);
                                    setIsCourseDragging(true);
                                }}
                                onMouseMove={(e) => {
                                    if (isCourseDragging && courseTouchStartX !== null) {
                                        setCourseDeltaX(e.clientX - courseTouchStartX);
                                    }
                                }}
                                onMouseLeave={() => {
                                    if (!isCourseDragging) return;
                                    const threshold = 40;
                                    if (courses.length > 0) {
                                        if (courseDeltaX > threshold)
                                            setCurrentCourseIndex((p) => (p - 1 + courses.length) % courses.length);
                                        else if (courseDeltaX < -threshold)
                                            setCurrentCourseIndex((p) => (p + 1) % courses.length);
                                    }
                                    setCourseTouchStartX(null);
                                    setCourseDeltaX(0);
                                    setIsCourseDragging(false);
                                }}
                                onMouseUp={() => {
                                    if (!isCourseDragging) return;
                                    const threshold = 40;
                                    if (courses.length > 0) {
                                        if (courseDeltaX > threshold)
                                            setCurrentCourseIndex((p) => (p - 1 + courses.length) % courses.length);
                                        else if (courseDeltaX < -threshold)
                                            setCurrentCourseIndex((p) => (p + 1) % courses.length);
                                    }
                                    setCourseTouchStartX(null);
                                    setCourseDeltaX(0);
                                    setIsCourseDragging(false);
                                }}
                            >
                                <div
                                    className="flex transition-transform duration-500 ease-in-out"
                                    style={{ transform: `translateX(-${currentCourseIndex * 100}%)` }}
                                >
                                    {loading ? (
                                        [0, 1, 2].map((i) => (
                                            <div key={i} className="w-full flex-shrink-0">
                                                <div className="bg-white rounded-xl shadow-lg overflow-hidden animate-pulse">
                                                    <div className="h-40 bg-gray-300"></div>
                                                    <div className="p-4">
                                                        <div className="h-6 bg-gray-300 rounded mb-2"></div>
                                                        <div className="h-4 bg-gray-300 rounded mb-3"></div>
                                                        <div className="h-4 bg-gray-300 rounded"></div>
                                                    </div>
                                                </div>
                                            </div>
                                        ))
                                    ) : courses.length > 0 ? (
                                        courses.map((course) => (
                                            <div key={course.id} className="w-full flex-shrink-0">
                                                <div
                                                    className="bg-white rounded-xl shadow-lg overflow-hidden hover:shadow-xl transition-shadow cursor-pointer"
                                                    onClick={() => router.push(`/courses/${course.id}`)}
                                                >
                                                    <div className="h-40 relative">
                                                        <Image
                                                            src={
                                                                course.imageUrl ||
                                                                "https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=400&h=200&fit=crop"
                                                            }
                                                            alt={course.title}
                                                            fill
                                                            className="object-cover"
                                                        />
                                                        <div className="absolute top-3 right-3 bg-red-500 text-white px-3 py-1 rounded-full text-sm font-semibold">
                                                            {course.concept || "코스"}
                                                        </div>
                                                    </div>
                                                    <div className="p-3">
                                                        <div className="flex items-center justify-between mb-2">
                                                            <h3 className="text-base font-bold text-gray-900 truncate flex-1 mr-2">
                                                                {course.title}
                                                            </h3>
                                                            <div className="flex items-center text-sm text-yellow-500">
                                                                <span>⭐</span>
                                                                <span className="ml-1">{course.rating || 4.5}</span>
                                                            </div>
                                                        </div>
                                                        <p className="text-sm text-gray-600 mb-2 line-clamp-2">
                                                            {course.description || "완벽한 여행 코스"}
                                                        </p>
                                                        <div className="flex items-center gap-2 mb-3">
                                                            <div className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full text-xs flex items-center">
                                                                <span className="mr-1">⏰</span>
                                                                <span>{course.duration || "4시간"}</span>
                                                            </div>
                                                            <div className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full text-xs flex items-center">
                                                                <span className="mr-1">📍</span>
                                                                <span>{course.location || "서울"}</span>
                                                            </div>
                                                            {course.price && (
                                                                <div className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full text-xs flex items-center">
                                                                    <span className="mr-1">💰</span>
                                                                    <span>{course.price}</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                        <div className="flex items-center justify-between">
                                                            <div className="flex items-center text-sm text-gray-500">
                                                                <span className="mr-1">👥</span>
                                                                <span>지금 {course.participants || 0}명 진행중</span>
                                                            </div>
                                                            <button className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors">
                                                                코스 시작하기
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="w-full flex-shrink-0 text-center text-gray-500 py-8">
                                            준비된 코스가 없습니다.
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="flex justify-center mt-6 space-x-2">
                                {Array.from({ length: Math.max(courses.length, 1) }).map((_, i) => (
                                    <div
                                        key={i}
                                        className={`w-3 h-3 rounded-full transition-colors ${
                                            currentCourseIndex === i ? "bg-blue-600" : "bg-gray-300"
                                        }`}
                                    />
                                ))}
                            </div>
                        </div>
                    </div>
                </section>

                {/* 사용자 후기 섹션 */}
                <section className="py-12 px-4 bg-gray-50">
                    <div className="max-w-[500px] mx-auto text-black">
                        <h2 className="text-xl font-bold text-center text-gray-900 mb-6">
                            실제 사용자들의 생생한 후기
                        </h2>
                        <div className="relative">
                            {/* 슬라이드 컨테이너 (한 장씩) */}
                            <div className="overflow-hidden">
                                <div
                                    className="flex transition-transform duration-500 ease-in-out"
                                    style={{ transform: `translateX(-${currentReviewPage * 100}%)` }}
                                >
                                    {loading ? (
                                        [0, 1, 2].map((i) => (
                                            <div key={i} className="w-full flex-shrink-0">
                                                <div className="bg-white p-4 rounded-xl shadow-lg animate-pulse">
                                                    <div className="flex items-center mb-3">
                                                        <div className="w-10 h-10 bg-gray-300 rounded-full mr-3"></div>
                                                        <div className="flex-1">
                                                            <div className="h-4 bg-gray-300 rounded mb-2"></div>
                                                            <div className="h-3 bg-gray-300 rounded"></div>
                                                        </div>
                                                    </div>
                                                    <div className="h-4 bg-gray-300 rounded mb-2"></div>
                                                    <div className="h-4 bg-gray-300 rounded"></div>
                                                </div>
                                            </div>
                                        ))
                                    ) : reviews.length > 0 ? (
                                        reviews.map((review) => {
                                            const getColorByConcept = (concept: string) => {
                                                switch ((concept || "").toLowerCase()) {
                                                    case "커플":
                                                    case "couple":
                                                        return { bg: "bg-blue-100", text: "text-blue-600" };
                                                    case "가족":
                                                    case "family":
                                                        return { bg: "bg-purple-100", text: "text-purple-600" };
                                                    case "친구":
                                                    case "friend":
                                                        return { bg: "bg-green-100", text: "text-green-600" };
                                                    default:
                                                        return { bg: "bg-gray-100", text: "text-gray-600" };
                                                }
                                            };
                                            const { bg, text } = getColorByConcept((review as any).course?.concept);
                                            return (
                                                <div key={review.id} className="w-full flex-shrink-0">
                                                    <div className="bg-white p-4 rounded-xl shadow-lg">
                                                        <div className="flex items-center mb-3">
                                                            <div
                                                                className={`${bg} w-10 h-10 rounded-full flex items-center justify-center mr-3`}
                                                            >
                                                                <span className={`font-semibold ${text}`}>
                                                                    {review.user?.initial}
                                                                </span>
                                                            </div>
                                                            <div>
                                                                <div className="font-semibold">
                                                                    {review.user?.nickname}
                                                                </div>
                                                                <div className="text-xs text-gray-500 line-clamp-1">
                                                                    {(review as any).course?.title}
                                                                </div>
                                                            </div>
                                                            <div className="ml-auto text-yellow-400">
                                                                {"⭐".repeat(review.rating || 0)}
                                                            </div>
                                                        </div>
                                                        <p className="text-gray-600 text-sm">"{review.comment}"</p>
                                                        {review.imageUrls && review.imageUrls.length > 0 && (
                                                            <div className="grid grid-cols-3 gap-2 mt-3">
                                                                {review.imageUrls.map((imageUrl, idx) => (
                                                                    <div
                                                                        key={idx}
                                                                        className="relative aspect-square rounded-lg overflow-hidden bg-gray-100 cursor-pointer hover:opacity-90 transition-opacity"
                                                                        onClick={() => {
                                                                            setPreviewImages(review.imageUrls || []);
                                                                            setPreviewImageIndex(idx);
                                                                            setPreviewImage(imageUrl);
                                                                        }}
                                                                    >
                                                                        <Image
                                                                            src={imageUrl}
                                                                            alt={`후기 이미지 ${idx + 1}`}
                                                                            fill
                                                                            className="object-cover"
                                                                            loading="lazy"
                                                                            quality={75}
                                                                            sizes="(max-width: 768px) 33vw, 150px"
                                                                        />
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })
                                    ) : (
                                        <div className="w-full flex-shrink-0 text-center text-gray-500 py-8">
                                            등록된 후기가 없습니다.
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* 페이지 인디케이터 */}
                            <div className="flex justify-center mt-8 space-x-2">
                                {Array.from({ length: Math.max(reviews.length, 1) }).map((_, index) => (
                                    <div
                                        key={index}
                                        className={`w-3 h-3 rounded-full transition-colors ${
                                            currentReviewPage === index ? "bg-blue-600" : "bg-gray-300"
                                        }`}
                                    />
                                ))}
                            </div>
                        </div>
                    </div>
                </section>

                {/* 왜 DoNa인가요? */}
                <section className="py-12 px-4 bg-white">
                    <div className="max-w-[500px] mx-auto">
                        <h2 className="text-2xl font-bold text-center text-gray-900 mb-8">왜 DoNa인가요?</h2>
                        <div className="bg-linear-to-br from-blue-50 to-purple-50 rounded-2xl shadow-lg p-8">
                            <div className="grid grid-cols-1 gap-6 items-center">
                                <div>
                                    <h3 className="text-2xl font-semibold text-gray-900 mb-4">
                                        여행 계획하기 너무 귀찮으시죠?
                                    </h3>
                                    <p className="text-gray-600 mb-4">
                                        "어디 갈까?", "뭐 먹을까?", "길 찾기 어려워..." 이런 고민들, 이제 그만!
                                    </p>
                                    <p className="text-gray-600 mb-4">
                                        DoNa는 여러분이 직접 여행 계획을 짤 필요 없이, 이미 검증된 완벽한 코스를
                                        밀키트처럼 제공해드립니다.
                                    </p>
                                    <p className="text-gray-600">
                                        컨셉과 카테고리만 선택하면 AI가 여러분을 위한 최적의 여행 코스를 만들어드려요!
                                    </p>
                                </div>
                                <div className="text-center">
                                    <div className="w-48 h-48 bg-linear-to-br from-blue-400 to-purple-600 rounded-full mx-auto flex items-center justify-center">
                                        <span className="text-6xl">🎯</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* CTA 섹션 */}
                <section className="py-12 px-4">
                    <div className="max-w-[500px] mx-auto text-center">
                        <h2 className="text-2xl font-bold text-gray-900 mb-6">지금 바로 여행을 시작해보세요!</h2>
                        <p className="text-xl text-gray-600 mb-8">
                            복잡한 계획 없이, 밀키트처럼 간편하게 완벽한 여행을 경험해보세요.
                        </p>
                        <div className="flex flex-col sm:flex-row justify-center space-y-4 sm:space-y-0 sm:space-x-4">
                            <Link
                                href="/personalized-home"
                                className="bg-blue-600 text-white px-8 py-4 rounded-lg font-semibold hover:bg-blue-700 transition-colors text-lg"
                            >
                                🎯 AI 추천 바로 가기
                            </Link>
                            <Link
                                href="/map"
                                className="bg-purple-600 text-white px-8 py-4 rounded-lg font-semibold hover:bg-purple-700 transition-colors text-lg"
                            >
                                🗺️ 지도에서 탐색하기
                            </Link>
                        </div>
                    </div>
                </section>
            </main>

            {/* 이미지 미리보기 모달 */}
            {previewImage && (
                <div
                    className="fixed inset-0 z-[9999] bg-black/90 flex items-center justify-center p-4"
                    onClick={() => {
                        setPreviewImage(null);
                        setPreviewImages([]);
                        setPreviewImageIndex(0);
                    }}
                >
                    <button
                        className="absolute top-4 right-4 text-white bg-black/50 rounded-full p-2 z-10 hover:bg-black/70 transition-colors"
                        onClick={() => {
                            setPreviewImage(null);
                            setPreviewImages([]);
                            setPreviewImageIndex(0);
                        }}
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M6 18L18 6M6 6l12 12"
                            />
                        </svg>
                    </button>
                    {previewImages.length > 1 && (
                        <>
                            <button
                                className="absolute left-4 top-1/2 -translate-y-1/2 text-white bg-black/50 rounded-full p-2 z-10 hover:bg-black/70 transition-colors"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    const prevIndex =
                                        previewImageIndex > 0 ? previewImageIndex - 1 : previewImages.length - 1;
                                    setPreviewImageIndex(prevIndex);
                                    setPreviewImage(previewImages[prevIndex]);
                                }}
                            >
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M15 19l-7-7 7-7"
                                    />
                                </svg>
                            </button>
                            <button
                                className="absolute right-4 top-1/2 -translate-y-1/2 text-white bg-black/50 rounded-full p-2 z-10 hover:bg-black/70 transition-colors"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    const nextIndex =
                                        previewImageIndex < previewImages.length - 1 ? previewImageIndex + 1 : 0;
                                    setPreviewImageIndex(nextIndex);
                                    setPreviewImage(previewImages[nextIndex]);
                                }}
                            >
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M9 5l7 7-7 7"
                                    />
                                </svg>
                            </button>
                            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white text-sm bg-black/50 px-3 py-1 rounded-full z-10">
                                {previewImageIndex + 1} / {previewImages.length}
                            </div>
                        </>
                    )}
                    <div
                        className="relative w-full h-full flex items-center justify-center"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <img
                            src={previewImage}
                            alt="후기 이미지 미리보기"
                            className="max-w-full max-h-full object-contain"
                        />
                    </div>
                </div>
            )}
        </>
    );
};

export default AboutPage;
