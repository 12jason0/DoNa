"use client";

import React, { Suspense, useEffect, useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import ReviewModal from "@/components/ReviewModal";

// --- Types ---
type Place = {
    id: number;
    name: string;
    address: string;
    latitude: number;
    longitude: number;
    imageUrl?: string;
    notes?: string;
    category?: string;
};

type CoursePlace = {
    order_index: number;
    place: Place;
    // 스토리텔링 데이터 추가 (DB에 있다면)
    movement_guide?: string;
};

type Course = {
    id: string;
    title: string;
    coursePlaces: CoursePlace[];
};

// --- Components ---
function LoadingSpinner() {
    return (
        <div className="min-h-screen flex items-center justify-center bg-white">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-gray-900"></div>
        </div>
    );
}

const NaverMap = dynamic(() => import("@/components/NaverMap"), {
    ssr: false,
    loading: () => (
        <div className="w-full h-full bg-gray-100 flex items-center justify-center text-sm text-gray-400">
            지도 로딩중...
        </div>
    ),
});

function GuidePageInner() {
    const params = useParams();
    const router = useRouter();
    const courseId = params?.id as string;

    const [course, setCourse] = useState<Course | null>(null);
    const [loading, setLoading] = useState(true);
    const [currentStep, setCurrentStep] = useState(0);
    const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
    const [showCongrats, setShowCongrats] = useState(false);
    const [showReview, setShowReview] = useState(false);

    // Fetch Course
    useEffect(() => {
        if (!courseId) return;
        const fetchCourse = async () => {
            try {
                const res = await fetch(`/api/courses/${courseId}`);
                if (!res.ok) throw new Error("Failed");
                const data = await res.json();
                data.coursePlaces.sort((a: CoursePlace, b: CoursePlace) => a.order_index - b.order_index);
                setCourse(data);
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        fetchCourse();
    }, [courseId]);

    // Geolocation
    useEffect(() => {
        if (typeof navigator !== "undefined" && navigator.geolocation) {
            const onOk = (pos: GeolocationPosition) =>
                setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
            const id = navigator.geolocation.watchPosition(onOk, () => setUserLocation(null), {
                enableHighAccuracy: true,
            });
            return () => navigator.geolocation.clearWatch(id);
        }
    }, []);

    const currentPlace = course?.coursePlaces?.[currentStep]?.place;
    const movementGuide = course?.coursePlaces?.[currentStep]?.movement_guide;
    const totalSteps = course?.coursePlaces?.length || 0;
    const progress = totalSteps > 0 ? ((currentStep + 1) / totalSteps) * 100 : 0;

    const mapPlaces = useMemo(() => {
        if (!currentPlace) return [];
        return [
            {
                id: currentPlace.id,
                name: currentPlace.name,
                latitude: currentPlace.latitude,
                longitude: currentPlace.longitude,
                address: currentPlace.address,
                orderIndex: currentStep + 1, // 1부터 시작
            },
        ];
    }, [currentPlace, currentStep]);

    const handleNext = () => {
        if (course && currentStep < course.coursePlaces.length - 1) setCurrentStep((c) => c + 1);
        else {
            markCompleted();
            setShowCongrats(true);
        }
    };

    const handlePrev = () => {
        if (currentStep > 0) setCurrentStep((c) => c - 1);
    };

    async function markCompleted() {
        try {
            const token = localStorage.getItem("authToken");
            await fetch("/api/users/completions", {
                method: "POST",
                headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
                body: JSON.stringify({ courseId: Number(courseId), title: course?.title }),
            });
        } catch {}
    }

    if (loading || !course || !currentPlace) return <LoadingSpinner />;

    return (
        <div className="flex flex-col h-[100dvh] bg-white overflow-hidden relative">
            {/* 1. Top Bar (Progress & Exit) */}
            <div className="absolute top-0 left-0 right-0 z-20 px-4 pt-4 pb-2 bg-gradient-to-b from-white/90 to-transparent pointer-events-none">
                <div className="flex items-center justify-between mb-2 pointer-events-auto">
                    <span className="px-3 py-1 bg-black text-white text-xs font-bold rounded-full shadow-md">
                        Step {currentStep + 1} / {totalSteps}
                    </span>
                    <button
                        onClick={() => router.push(`/courses/${courseId}`)}
                        className="w-8 h-8 flex items-center justify-center bg-white rounded-full shadow-md text-gray-500 hover:text-gray-900"
                    >
                        ✕
                    </button>
                </div>
                {/* Progress Bar */}
                <div className="h-1.5 w-full bg-gray-200 rounded-full overflow-hidden shadow-sm">
                    <div
                        className="h-full bg-indigo-600 transition-all duration-500"
                        style={{ width: `${progress}%` }}
                    />
                </div>
            </div>

            {/* 2. Map Area */}
            <div className="flex-1 relative z-0">
                <NaverMap
                    key={`guide-map-${currentStep}`}
                    places={mapPlaces as any}
                    userLocation={userLocation}
                    selectedPlace={null}
                    onPlaceClick={() => {}}
                    className="w-full h-full"
                    showControls={false}
                    drawPath={Boolean(userLocation)}
                    routeMode="walking"
                    numberedMarkers={true}
                />
            </div>

            {/* 3. Bottom Control Card (Sliding Up) */}
            <div className="absolute bottom-0 left-0 right-0 z-30 bg-white rounded-t-3xl shadow-[0_-5px_20px_rgba(0,0,0,0.1)] p-6 pb-8 animate-slide-up">
                {/* Drag Handle */}
                <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto mb-6" />

                <div className="flex justify-between items-start mb-4">
                    <div>
                        <span className="text-xs font-bold text-indigo-600 mb-1 block">현재 목적지</span>
                        <h2 className="text-2xl font-bold text-gray-900 leading-tight">{currentPlace.name}</h2>
                    </div>
                    {/* Category Icon */}
                    <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center text-xl">
                        📍
                    </div>
                </div>

                <p className="text-sm text-gray-500 mb-6 flex items-center gap-1.5">
                    <span>🗺️</span> {currentPlace.address}
                </p>

                {/* Editor's Note (간단 버전) */}
                {currentPlace.notes && (
                    <div className="bg-indigo-50 rounded-xl p-4 mb-6 border-l-4 border-indigo-500">
                        <p className="text-xs font-bold text-indigo-600 mb-1">TIP</p>
                        <p className="text-sm text-gray-700">{currentPlace.notes}</p>
                    </div>
                )}

                {/* Action Buttons */}
                <div className="grid grid-cols-[1fr_2fr] gap-3">
                    {/* 네이버 지도 길찾기 */}
                    <button
                        onClick={() => {
                            const url = `https://map.naver.com/v5/directions/-/-/${currentPlace.longitude},${
                                currentPlace.latitude
                            },${encodeURIComponent(currentPlace.name)},,WALKING`;
                            window.open(url, "_blank");
                        }}
                        className="h-12 bg-green-50 text-green-700 rounded-xl text-sm font-bold border border-green-200 hover:bg-green-100 flex items-center justify-center gap-1"
                    >
                        <span>🧭 길찾기</span>
                    </button>

                    {/* 다음 단계 버튼 */}
                    <button
                        onClick={handleNext}
                        className="h-12 bg-black text-white rounded-xl text-sm font-bold shadow-lg hover:bg-gray-800 flex items-center justify-center gap-2"
                    >
                        {currentStep === totalSteps - 1 ? "코스 완료 🎉" : "다음 장소로 →"}
                    </button>
                </div>

                {/* 이전 버튼 (작게) */}
                {currentStep > 0 && (
                    <button
                        onClick={handlePrev}
                        className="mt-4 w-full text-xs text-gray-400 font-medium hover:text-gray-600 underline"
                    >
                        이전 장소 다시 보기
                    </button>
                )}
            </div>

            {/* Congrats Modal */}
            {showCongrats && (
                <div className="fixed inset-0 z-[5000] bg-black/60 flex items-center justify-center p-5 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white rounded-3xl p-8 w-full max-w-sm text-center shadow-2xl animate-zoom-in">
                        <div className="text-6xl mb-4">🏆</div>
                        <h3 className="text-2xl font-bold mb-2">코스 정복 완료!</h3>
                        <p className="text-gray-500 mb-8">
                            오늘 데이트는 어떠셨나요?
                            <br />
                            소중한 후기를 남겨주세요.
                        </p>
                        <button
                            onClick={() => {
                                setShowCongrats(false);
                                setShowReview(true);
                            }}
                            className="w-full py-4 bg-indigo-600 text-white rounded-xl font-bold shadow-lg shadow-indigo-200 hover:bg-indigo-700 mb-3"
                        >
                            후기 작성하기
                        </button>
                        <button
                            onClick={() => router.push("/courses")}
                            className="w-full py-4 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200"
                        >
                            홈으로 가기
                        </button>
                    </div>
                </div>
            )}

            <ReviewModal
                isOpen={showReview}
                onClose={() => {
                    setShowReview(false);
                    router.push("/courses");
                }}
                courseId={Number(courseId)}
                courseName={course?.title || ""}
            />
        </div>
    );
}

export default function GuidePage() {
    return (
        <Suspense fallback={<LoadingSpinner />}>
            <GuidePageInner />
        </Suspense>
    );
}
