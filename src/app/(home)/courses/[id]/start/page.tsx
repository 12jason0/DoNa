"use client";

import React, { Suspense, useEffect, useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import ReviewModal from "@/components/ReviewModal";
import { motion, PanInfo } from "framer-motion";

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

// --- Helpers ---
function deg2rad(deg: number) {
    return deg * (Math.PI / 180);
}

function getDistanceFromLatLonInMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
    const R = 6371; // Earth radius in km
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c * 1000; // meters
}

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

    // ✅ 토스트(카드) 최소화 상태 관리
    const [isMinimized, setIsMinimized] = useState(false);

    // 거리 계산 및 도착 여부 체크
    const [distance, setDistance] = useState<number | null>(null);
    const [isArrived, setIsArrived] = useState(false);

    const currentPlace = course?.coursePlaces?.[currentStep]?.place;
    const movementGuide = course?.coursePlaces?.[currentStep]?.movement_guide;
    const totalSteps = course?.coursePlaces?.length || 0;
    const progress = totalSteps > 0 ? ((currentStep + 1) / totalSteps) * 100 : 0;

    // ✅ 드래그 및 토글 핸들러 복구
    const handleDragEnd = (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
        if (info.offset.y > 50) {
            // 아래로 50px 이상 드래그하면 닫기
            setIsMinimized(true);
        } else if (info.offset.y < -50) {
            // 위로 50px 이상 드래그하면 열기
            setIsMinimized(false);
        }
    };

    const toggleMinimize = () => {
        setIsMinimized((prev) => !prev);
    };

    // 거리 업데이트 Effect
    useEffect(() => {
        if (userLocation && currentPlace) {
            const dist = getDistanceFromLatLonInMeters(
                userLocation.lat,
                userLocation.lng,
                currentPlace.latitude,
                currentPlace.longitude
            );
            setDistance(dist);
            // 50m 이내면 도착으로 간주
            setIsArrived(dist <= 50);
        } else {
            setDistance(null);
            setIsArrived(false);
        }
    }, [userLocation, currentPlace]);

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
        if (!isArrived) {
            alert("목적지에 도착해야 다음 단계로 넘어갈 수 있습니다!");
            return;
        }

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
        <div className="fixed inset-0 z-[100] flex flex-col bg-white overflow-hidden overscroll-none">
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
            <motion.div
                initial={{ y: 0 }}
                animate={{ y: isMinimized ? "calc(100% - 50px)" : 0 }}
                onDragEnd={handleDragEnd}
                drag="y"
                dragConstraints={{ top: 0, bottom: 0 }} // 드래그 후 제자리 복귀 (애니메이션은 state로 제어)
                dragElastic={0.2} // 탄성 추가
                transition={{ type: "spring", stiffness: 300, damping: 30 }} // 부드러운 스프링 애니메이션
                className="absolute bottom-0 left-0 right-0 z-30 bg-white rounded-t-3xl shadow-[0_-5px_20px_rgba(0,0,0,0.1)] p-6 pb-8"
            >
                {/* Drag Handle & Toggle Click Area */}
                <div
                    className="w-full h-8 absolute top-0 left-0 flex items-center justify-center cursor-pointer touch-none"
                    onClick={toggleMinimize}
                >
                    <div className="w-12 h-1.5 bg-gray-200 rounded-full" />
                </div>

                {/* Spacer for Handle */}
                <div className="h-6" />

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
                        disabled={!isArrived}
                        className={`h-12 rounded-xl text-sm font-bold shadow-lg flex items-center justify-center gap-2
                            ${
                                isArrived
                                    ? "bg-black text-white hover:bg-gray-800"
                                    : "bg-gray-300 text-gray-500 cursor-not-allowed"
                            }`}
                    >
                        {!isArrived && distance
                            ? `목적지까지 ${Math.round(distance)}m 남음`
                            : currentStep === totalSteps - 1
                            ? "코스 완료 🎉"
                            : "다음 장소로 →"}
                    </button>
                </div>
            </motion.div>

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
