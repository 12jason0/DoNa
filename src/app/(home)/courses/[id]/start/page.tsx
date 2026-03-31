"use client";

import React, { Suspense, useEffect, useState, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { useParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import ReviewModal from "@/components/ReviewModal";
import { useAppLayout } from "@/context/AppLayoutContext";
import StoryRecordModal from "@/components/StoryRecordModal";
import TicketPlans from "@/components/TicketPlans";
import LoginModal from "@/components/LoginModal";
import MemorySavedIcon from "@/components/MemorySavedIcon";
import { motion, PanInfo } from "framer-motion";
import { isIOS, isAndroid, isMobileApp } from "@/lib/platform";
import Image from "@/components/ImageFallback";
import { useLocale } from "@/context/LocaleContext";

// --- Types ---
type Place = {
    id: number;
    name?: string;
    imageUrl?: string;
    tips?: string | null;
};

type CoursePlace = {
    order_index: number;
    place: Place;
    movement_guide?: string;
};

type Course = {
    id: string;
    title: string;
    imageUrl?: string;
    region?: string;
    grade?: string;
    coursePlaces: CoursePlace[];
};

// 🟢 GPS 관련 헬퍼 함수 제거됨

// --- Components ---
function LoadingSpinner() {
    return (
        <div className="min-h-screen flex items-center justify-center bg-white">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-gray-900"></div>
        </div>
    );
}

// 🟢 지도 제거: Summone 스타일 디자인으로 변경

function GuidePageInner() {
    const params = useParams();
    const router = useRouter();
    const { t, locale } = useLocale();
    const courseId = params?.id as string;

    const [course, setCourse] = useState<Course | null>(null);
    const [loading, setLoading] = useState(true);
    const [showIntro, setShowIntro] = useState(true);
    // 🟢 3페이지: 인트로 → 0=사진 업로드, 1=태그+텍스트+저장
    const [pageIndex, setPageIndex] = useState(0);
    const [showCongrats, setShowCongrats] = useState(false);
    const [showReview, setShowReview] = useState(false);
    const [userEmail, setUserEmail] = useState<string | null>(null);
    const [userName, setUserName] = useState<string | null>(null);
    const [showSaveSuccessModal, setShowSaveSuccessModal] = useState(false);
    const [personalMemoryCount, setPersonalMemoryCount] = useState<number | null>(null);
    const [savedImageUrl, setSavedImageUrl] = useState<string | null>(null);
    const [userTier, setUserTier] = useState<"FREE" | "BASIC" | "PREMIUM">("FREE");
    const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
    const [showLoginModal, setShowLoginModal] = useState(false);
    const [showPhotoCountModal, setShowPhotoCountModal] = useState(false);
    const [showMemoryLimitModal, setShowMemoryLimitModal] = useState(false);
    const [memoryLimitModalSlideUp, setMemoryLimitModalSlideUp] = useState(false);
    const [memoryLimitMessage, setMemoryLimitMessage] = useState<string>("");
    const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
    const [platform, setPlatform] = useState<"ios" | "android" | "web">("web");
    const [inApp, setInApp] = useState(false);
    const { containInPhone, modalContainerRef } = useAppLayout();

    // 🟢 이미지 슬라이더 상태
    const [currentImageIndex, setCurrentImageIndex] = useState(0);
    const [touchStartX, setTouchStartX] = useState<number | null>(null);
    const [touchEndX, setTouchEndX] = useState<number | null>(null);

    // 🟢 iOS/Android/앱 WebView 감지 (앱에서 하단 여백 적용)
    useEffect(() => {
        setPlatform(isIOS() ? "ios" : isAndroid() ? "android" : "web");
        setInApp(isMobileApp());
    }, []);
    // 🟢 앱에서 onLoadEnd 후 donaAppReady 이벤트로 재반영
    useEffect(() => {
        const onReady = () => setInApp(isMobileApp());
        if (typeof window !== "undefined") {
            window.addEventListener("donaAppReady", onReady);
            return () => window.removeEventListener("donaAppReady", onReady);
        }
    }, []);

    // 🟢 나만의 추억 한도 모달 하단 시트: 열릴 때 slideUp
    useEffect(() => {
        if (!showMemoryLimitModal) return;
        setMemoryLimitModalSlideUp(false);
        const t = requestAnimationFrame(() => {
            requestAnimationFrame(() => setMemoryLimitModalSlideUp(true));
        });
        return () => cancelAnimationFrame(t);
    }, [showMemoryLimitModal]);

    // ✅ 토스트(카드) 최소화 상태 관리
    const [isMinimized, setIsMinimized] = useState(false);

    const [storyRating, setStoryRating] = useState(5);
    // 🟢 #DoNa 항상 맨 앞에
    const [selectedTags, setSelectedTags] = useState<string[]>(["DoNa"]);
    const [uploadingImages, setUploadingImages] = useState(false);
    const [tagInput, setTagInput] = useState("");
    const [descriptionText, setDescriptionText] = useState("");

    // 🟢 한 번에 업로드 (장소별 X)
    const [allPhotos, setAllPhotos] = useState<string[]>([]);
    const suggestedTags = useMemo(
        () =>
            [
                t("courseStart.suggestedTag1"),
                t("courseStart.suggestedTag2"),
                t("courseStart.suggestedTag3"),
                t("courseStart.suggestedTag4"),
                t("courseStart.suggestedTag5"),
                t("courseStart.suggestedTag6"),
                t("courseStart.suggestedTag7"),
                t("courseStart.suggestedTag8"),
                t("courseStart.suggestedTag9"),
            ] as const,
        [t],
    );
    const mainImageInputRef = useRef<HTMLInputElement>(null);

    // 🟢 GPS 도착 체크 및 자동 이동 기능 제거

    const currentPlace = course?.coursePlaces?.[0]?.place;

    // ✅ 드래그 및 토글 핸들러 복구
    const handleDragEnd = (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
        if (info.offset.y > 50) {
            setIsMinimized(true);
        } else if (info.offset.y < -50) {
            setIsMinimized(false);
        }
    };

    const toggleMinimize = () => {
        setIsMinimized((prev) => !prev);
    };

    // 🟢 사용자 정보 가져오기 함수
    const fetchUserInfo = async () => {
        try {
            const { authenticatedFetch } = await import("@/lib/authClient");
            const data = await authenticatedFetch("/api/users/profile");
            if (data) {
                setUserEmail((data as any).email || (data as any).user?.email || null);
                const tier = (data as any).user?.subscriptionTier || (data as any).subscriptionTier || "FREE";
                setUserTier(tier as "FREE" | "BASIC" | "PREMIUM");
                setIsLoggedIn(true);

                // 🟢 유저 이름 가져오기
                const name =
                    (data as any).name ||
                    (data as any).nickname ||
                    (data as any).user?.name ||
                    (data as any).user?.nickname ||
                    null;
                if (name) {
                    setUserName(name);
                } else if ((data as any).email) {
                    // 이름이 없으면 이메일 앞부분 사용
                    const emailPrefix = (data as any).email.split("@")[0];
                    setUserName(emailPrefix);
                }
            } else {
                setIsLoggedIn(false);
                setUserTier("FREE");
                setUserName(null);
            }
        } catch (err) {
            setIsLoggedIn(false);
            setUserTier("FREE");
            setUserName(null);
        }
    };

    // 🟢 사용자 정보 가져오기 - 코스 데이터와 병렬 로딩으로 성능 최적화
    useEffect(() => {
        // 🟢 지연 제거: 코스 로딩과 병렬로 실행
        fetchUserInfo();
    }, []);

    // 🟢 구독 변경 이벤트 리스너 (환불 후 실시간 업데이트)
    useEffect(() => {
        const handleSubscriptionChanged = () => {
            console.log("[GuidePage] 구독 변경 감지 - 사용자 정보 갱신");
            fetchUserInfo();
        };
        window.addEventListener("subscriptionChanged", handleSubscriptionChanged as EventListener);
        return () => window.removeEventListener("subscriptionChanged", handleSubscriptionChanged as EventListener);
    }, []);

    // 🟢 GPS 도착 체크 및 자동 이동 기능 제거됨

    // 🟢 [Performance]: Fetch Course - 캐싱 및 병렬 로딩 최적화
    useEffect(() => {
        if (!courseId) return;

        const fetchCourse = async () => {
            try {
                const { apiFetch } = await import("@/lib/authClient");
                // 🟢 성능 최적화: no-store로 변경하여 최신 데이터 즉시 로드 (캐시 지연 제거)
                const { data, response } = await apiFetch<Course>(`/api/courses/${courseId}/start`, {
                    cache: "no-store", // 🟢 최신 데이터 즉시 로드
                });

                if (!response.ok) {
                    const errorMessage = (data as any)?.error || `HTTP ${response.status}: ${response.statusText}`;
                    throw new Error(errorMessage || "Failed to fetch course");
                }

                if (data) {
                    setCourse(data);
                    setLoading(false); // 🟢 데이터 받으면 즉시 로딩 해제
                } else {
                    throw new Error(t("courseStart.errorCourseNotFound"));
                }
            } catch (error: any) {
                console.error("코스 로딩 오류:", error);
                alert(t("courseStart.errorLoadFailed"));
                router.push("/courses");
            } finally {
                setLoading(false);
            }
        };

        fetchCourse();
    }, [courseId, router, t]);

    // 🟢 GPS 위치 추적 제거됨

    const handleNext = () => {
        if (pageIndex === 0) setPageIndex(1);
    };

    const handlePrev = () => {
        if (pageIndex === 1) setPageIndex(0);
    };

    async function markCompleted() {
        try {
            const { apiFetch } = await import("@/lib/authClient");
            const { data, response } = await apiFetch("/api/users/completions", {
                method: "POST",
                body: JSON.stringify({ courseId: Number(courseId), title: course?.title }),
            });

            if (response.ok && data) {
                // 코스 완료 처리
            }
        } catch {
            // 무시
        }
    }

    const toggleTag = (tag: string) => {
        if (tag === "DoNa") return;
        const userTags = selectedTags.filter((t) => t !== "DoNa");
        const newUserTags = userTags.includes(tag) ? userTags.filter((t) => t !== tag) : [...userTags, tag];
        setSelectedTags(["DoNa", ...newUserTags]);
    };

    const removeTag = (tag: string) => {
        if (tag === "DoNa") return;
        const userTags = selectedTags.filter((t) => t !== "DoNa" && t !== tag);
        setSelectedTags(["DoNa", ...userTags]);
    };

    const handleTagInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter" && tagInput.trim()) {
            e.preventDefault();
            addCustomTag();
        }
    };

    const addCustomTag = () => {
        if (!tagInput.trim()) return;
        const newTag = tagInput.trim().replace(/^#/, "");
        if (!newTag || newTag.length > 10) return;
        const userTags = selectedTags.filter((t) => t !== "DoNa");
        if (userTags.includes(newTag)) return;
        setSelectedTags(["DoNa", ...userTags, newTag]);
        setTagInput("");
    };

    const MAX_PHOTOS = 10;

    const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        const remaining = MAX_PHOTOS - allPhotos.length;
        const filesToUpload = Array.from(files).slice(0, remaining);

        if (filesToUpload.length === 0) {
            alert(t("courseStart.alertMaxPhotos", { max: MAX_PHOTOS }));
            return;
        }

        setUploadingImages(true);
        try {
            filesToUpload.forEach((file) => {
                if (file.size > 50 * 1024 * 1024)
                    throw new Error(t("courseStart.errorFileTooLarge", { name: file.name }));
            });
            const { uploadViaPresign } = await import("@/lib/uploadViaPresign");
            const photoUrls = await uploadViaPresign(filesToUpload, {
                type: "memory",
                courseId: courseId?.toString(),
            });
            if (photoUrls.length > 0) {
                setAllPhotos((prev) => [...prev, ...photoUrls].slice(0, MAX_PHOTOS));
            }
        } catch (err) {
            console.error("이미지 업로드 오류:", err);
            alert(t("courseStart.alertUploadFailed"));
        } finally {
            setUploadingImages(false);
        }
        e.target.value = "";
    };

    const deletePhoto = (index: number) => {
        setAllPhotos((prev) => prev.filter((_, i) => i !== index));
        if (currentImageIndex >= allPhotos.length - 1 && allPhotos.length > 1) {
            setCurrentImageIndex(allPhotos.length - 2);
        } else if (allPhotos.length === 1) {
            setCurrentImageIndex(0);
        }
    };

    // 🟢 이미지 슬라이더 스와이프 핸들러는 렌더링 부분에서 정의

    const handleKakaoShare = async () => {
        try {
            if (!(window as any).Kakao) {
                const script = document.createElement("script");
                script.src = "https://t1.kakaocdn.net/kakao_js_sdk/2.7.2/kakao.min.js";
                script.async = true;
                document.head.appendChild(script);
                await new Promise((resolve, reject) => {
                    script.onload = () => resolve(null);
                    script.onerror = () => reject(new Error("Kakao SDK load failed"));
                });
            }

            const Kakao = (window as any).Kakao;
            if (!Kakao.isInitialized()) {
                const jsKey = process.env.NEXT_PUBLIC_KAKAO_JS_KEY || process.env.NEXT_PUBLIC_KAKAO_JAVASCRIPT_KEY;
                if (jsKey) Kakao.init(jsKey);
            }

            const shareText = t("courseStart.kakaoShareText", {
                title: course?.title || t("courseStart.dateWord"),
            });
            Kakao.Share.sendDefault({
                objectType: "text",
                text: shareText,
                link: {
                    mobileWebUrl: window.location.href,
                    webUrl: window.location.href,
                },
            });
        } catch (err) {
            console.error("카카오톡 공유 실패:", err);
            alert(t("courseStart.alertKakaoFailed"));
        }
    };

    const handleSubmit = async () => {
        if (!isLoggedIn) {
            setShowLoginModal(true);
            return;
        }

        if (!courseId) {
            alert(t("courseStart.alertCourseMissing"));
            return;
        }

        if (allPhotos.length < 1) {
            alert(t("courseStart.alertMinPhotos"));
            return;
        }

        try {
            const allTags = selectedTags;
            const placeData: Record<string, { photos: string[]; tags: string[] }> = {
                "0": { photos: allPhotos, tags: allTags },
            };

            const { authenticatedFetch } = await import("@/lib/authClient");
            const data = await authenticatedFetch<any>("/api/reviews", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    courseId: Number(courseId),
                    rating: storyRating,
                    content: descriptionText || "",
                    imageUrls: allPhotos || [],
                    isPublic: false, // 🟢 개인 추억으로 저장
                    tags: allTags, // 🟢 전체 태그 (하위 호환성)
                    placeData: placeData, // 🟢 장소별 데이터
                }),
            });

            if (data && !(data as any).error) {
                // 🟢 현재 추억 개수 저장
                if ((data as any).personalMemoryCount !== undefined) {
                    setPersonalMemoryCount((data as any).personalMemoryCount);
                }

                // 🟢 저장된 첫 번째 이미지 URL 저장
                const firstImageUrl = allPhotos && allPhotos.length > 0 ? allPhotos[0] : null;
                setSavedImageUrl(firstImageUrl);

                // 🟢 저장 성공 모달 표시
                // 약간의 지연을 두어 상태가 업데이트된 후 모달 표시
                setTimeout(() => {
                    setShowSaveSuccessModal(true);
                }, 0);
            } else {
                alert((data as any)?.error || t("courseStart.alertSaveFailed"));
            }
        } catch (err) {
            console.error("추억 저장 오류:", err);
            const message = err instanceof Error ? err.message : "";
            // 🟢 나만의 추억 한도 초과 시 업그레이드 모달 표시
            if (/MEMORY_LIMIT|업그레이드|한도|upgrade|subscription/i.test(message)) {
                setMemoryLimitMessage(message || t("courseStart.memoryLimitFallback"));
                setShowMemoryLimitModal(true);
            } else {
                alert(message || t("courseStart.alertSaveError"));
            }
        }
    };

    useEffect(() => {
        if (currentImageIndex >= allPhotos.length && allPhotos.length > 0) {
            setCurrentImageIndex(allPhotos.length - 1);
        } else if (allPhotos.length === 0) {
            setCurrentImageIndex(0);
        }
    }, [allPhotos.length, currentImageIndex]);

    // 3. 🔴 모든 Hook 선언이 끝난 후 조건부 리턴 배치
    if (loading || !course || !course.coursePlaces || course.coursePlaces.length === 0) {
        return null;
    }

    const localeTag =
        locale === "ko" ? "ko-KR" : locale === "ja" ? "ja-JP" : locale === "zh" ? "zh-CN" : "en-US";
    const currentDate = new Date().toLocaleDateString(localeTag, { year: "numeric", month: "long", day: "numeric" });
    const formattedDate = new Date()
        .toLocaleDateString(localeTag, { year: "numeric", month: "numeric", day: "numeric" })
        .replace(/\s/g, "");

    // 🟢 이미지 슬라이더 스와이프 핸들러
    const minSwipeDistance = 50;

    const onTouchStart = (e: React.TouchEvent) => {
        setTouchEndX(null);
        setTouchStartX(e.targetTouches[0].clientX);
    };

    const onTouchMove = (e: React.TouchEvent) => {
        setTouchEndX(e.targetTouches[0].clientX);
    };

    const onTouchEnd = () => {
        if (!touchStartX || !touchEndX) return;
        const distance = touchStartX - touchEndX;
        const isLeftSwipe = distance > minSwipeDistance;
        const isRightSwipe = distance < -minSwipeDistance;

        if (isLeftSwipe && currentImageIndex < allPhotos.length - 1) {
            setCurrentImageIndex(currentImageIndex + 1);
        } else if (isRightSwipe && currentImageIndex > 0) {
            setCurrentImageIndex(currentImageIndex - 1);
        }
    };

    // 🟢 인트로 화면
    if (showIntro) {
        return (
            <div
                className="fixed inset-0 z-100 flex flex-col bg-white overflow-hidden overscroll-none cursor-pointer"
                onClick={() => setShowIntro(false)}
            >
                {/* Background - Blurred */}
                <div className="flex-1 relative z-0 bg-gray-50">
                    {course?.imageUrl ? (
                        <div
                            className="absolute inset-0 bg-cover bg-center bg-no-repeat"
                            style={{
                                backgroundImage: `url(${course.imageUrl})`,
                                filter: "blur(20px)",
                                transform: "scale(1.1)",
                            }}
                        />
                    ) : currentPlace?.imageUrl ? (
                        <div
                            className="absolute inset-0 bg-cover bg-center bg-no-repeat"
                            style={{
                                backgroundImage: `url(${currentPlace.imageUrl})`,
                                filter: "blur(20px)",
                                transform: "scale(1.1)",
                            }}
                        />
                    ) : (
                        <div className="absolute inset-0 bg-linear-to-br from-indigo-50 via-purple-50 to-pink-50" />
                    )}
                </div>

                {/* Center Card - Intro (하단 배치, 앱에서 위로 올림) */}
                <div
                    className="absolute left-0 right-0 z-30 flex items-end justify-center px-6"
                    style={{
                        bottom: inApp
                            ? "calc(env(safe-area-inset-bottom, 0px) + 3.5rem)"
                            : platform === "android"
                              ? "calc(env(safe-area-inset-bottom, 0px) + 1.5rem)"
                              : 0,
                        paddingBottom: inApp || platform === "android" ? 0 : "2rem",
                    }}
                >
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3 }}
                        className="bg-white/90 dark:bg-[#1a241b]/90 backdrop-blur-lg rounded-3xl p-8 shadow-2xl max-w-md w-full text-center"
                    >
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                            {userName && course?.region
                                ? t("courseStart.titleUserRegion", { user: userName, region: course.region })
                                : userName
                                  ? t("courseStart.titleUserOnly", { user: userName })
                                  : course?.region
                                    ? t("courseStart.titleRegionOnly", { region: course.region })
                                    : t("courseStart.titleDateFallback")}
                        </h1>
                        <p className="text-lg text-gray-600 dark:text-gray-300 mt-2">❤️ {formattedDate}</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-6">{t("courseStart.touchToStart")}</p>
                    </motion.div>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 z-100 flex flex-col bg-white overflow-hidden overscroll-none">
            {/* 1. Top Bar (Region & Exit) */}
            <div
                className="absolute top-0 left-0 right-0 z-20 px-4 pt-2 pb-2 bg-transparent pointer-events-none"
                style={{ paddingTop: "calc(env(safe-area-inset-top, 0) + 0.5rem)" }}
            >
                <div className="flex items-center justify-end mb-2 pointer-events-auto">
                    <button
                        onClick={() => router.push(`/courses/${courseId}`)}
                        className="w-8 h-8 flex items-center justify-center bg-white/80 dark:bg-[#1a241b]/80 backdrop-blur-sm rounded-full shadow-md text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                    >
                        <span className="symbol-ko-font">✕</span>
                    </button>
                </div>
            </div>
            {/* 2. Background Area - 코스 대표 이미지 (Blur 효과) */}
            <div className="flex-1 relative z-0 bg-gray-50">
                {course?.imageUrl ? (
                    <div
                        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
                        style={{
                            backgroundImage: `url(${course.imageUrl})`,
                            filter: "blur(6px)",
                            transform: "scale(1.1)",
                        }}
                    />
                ) : currentPlace?.imageUrl ? (
                    <div
                        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
                        style={{
                            backgroundImage: `url(${currentPlace.imageUrl})`,
                            filter: "blur(6px)",
                            transform: "scale(1.1)",
                        }}
                    />
                ) : (
                    <div className="absolute inset-0 bg-linear-to-br from-indigo-50 via-purple-50 to-pink-50" />
                )}
            </div>
            {/* 3. Bottom Story Card - 다크 모드 지원 - 고정 (앱에서 하단바 위로) */}
            <div
                className="absolute left-0 right-0 z-30 bg-white dark:bg-[#1a241b] backdrop-blur-lg rounded-t-3xl border border-gray-200 dark:border-gray-700 shadow-[0_-5px_20px_rgba(0,0,0,0.1)]"
                style={{
                    maxHeight: "65vh",
                    minHeight: "50vh",
                    display: "flex",
                    flexDirection: "column",
                    bottom: inApp
                        ? "calc(env(safe-area-inset-bottom, 0px) + 3.5rem)"
                        : platform === "android"
                          ? "calc(env(safe-area-inset-bottom, 0px) + 0.5rem)"
                          : 0,
                }}
            >
                {/* 🟢 스크롤 가능한 콘텐츠 영역 */}
                <div
                    className="flex-1 overflow-y-auto scrollbar-hide"
                    style={{ minHeight: 0, WebkitOverflowScrolling: "touch" }}
                >
                    {/* 🟢 하단 카드 - 코스 이름과 날짜 표시 */}
                    <div className="pt-4 pb-4 px-6">
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
                            {userName && course?.region
                                ? t("courseStart.titleUserRegion", { user: userName, region: course.region })
                                : userName
                                  ? t("courseStart.titleUserOnly", { user: userName })
                                  : course?.region
                                    ? t("courseStart.titleRegionOnly", { region: course.region })
                                    : t("courseStart.titleOurDate")}
                        </h1>
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            <span>{course?.title || t("courseStart.courseFallback")}</span>
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-300 mt-2">❤️ {currentDate}</p>
                    </div>

                    <div
                        className="px-5"
                        style={{
                            paddingBottom: inApp
                                ? "calc(6rem + env(safe-area-inset-bottom, 0px) + 3rem)"
                                : platform === "android"
                                  ? "calc(6rem + env(safe-area-inset-bottom, 0px))"
                                  : "6rem",
                        }}
                    >
                        {/* 페이지 0: 사진 업로드 | 페이지 1: 태그+텍스트+저장 */}
                        {pageIndex === 0 ? (
                            /* 🟢 페이지 0: 사진 업로드 */
                            <>
                                <div className="pb-6">
                                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-200 mb-3">
                                        {t("courseStart.photosSection")}
                                    </label>

                                    {allPhotos.length === 0 ? (
                                        <label className="flex flex-col items-center justify-center w-full h-48 rounded-2xl border-2 border-dashed border-gray-300 dark:border-gray-700 cursor-pointer hover:border-[#99c08e] dark:hover:border-[#99c08e] hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-all">
                                            <input
                                                ref={mainImageInputRef}
                                                type="file"
                                                multiple
                                                accept="image/*"
                                                onChange={handlePhotoUpload}
                                                style={{ display: "none" }}
                                            />
                                            <div className="text-4xl text-gray-400 dark:text-gray-500 mb-2">📷</div>
                                            <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
                                                {t("courseStart.addPhotosHint")}
                                            </p>
                                            <p className="text-xs text-gray-400 dark:text-gray-500">
                                                {t("courseStart.photoLimitsHint")}
                                            </p>
                                            {uploadingImages && (
                                                <div className="mt-2 text-xs text-gray-500">{t("courseStart.uploading")}</div>
                                            )}
                                        </label>
                                    ) : (
                                        <div className="space-y-4">
                                            <div className="relative w-full h-64 rounded-2xl overflow-hidden bg-gray-100 dark:bg-gray-800">
                                                <Image
                                                    src={allPhotos[currentImageIndex] || allPhotos[0]}
                                                    alt=""
                                                    fill
                                                    className="object-cover"
                                                />
                                                <button
                                                    onClick={() =>
                                                        deletePhoto(allPhotos.length > 1 ? currentImageIndex : 0)
                                                    }
                                                    className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/60 text-white flex items-center justify-center"
                                                >
                                                    <span className="symbol-ko-font">✕</span>
                                                </button>
                                                {allPhotos.length < MAX_PHOTOS && (
                                                    <label className="absolute bottom-2 right-2 w-10 h-10 rounded-full bg-white/90 flex items-center justify-center cursor-pointer">
                                                        <input
                                                            ref={mainImageInputRef}
                                                            type="file"
                                                            multiple
                                                            accept="image/*"
                                                            onChange={handlePhotoUpload}
                                                            style={{ display: "none" }}
                                                        />
                                                        <span className="text-xl symbol-ko-font">+</span>
                                                    </label>
                                                )}
                                            </div>
                                            {allPhotos.length > 1 && (
                                                <div className="flex gap-2 overflow-x-auto scrollbar-hide">
                                                    {allPhotos.map((url, idx) => (
                                                        <button
                                                            key={idx}
                                                            onClick={() => setCurrentImageIndex(idx)}
                                                            className={`relative w-16 h-16 shrink-0 rounded-lg overflow-hidden border-2 ${
                                                                idx === currentImageIndex
                                                                    ? "border-[#99c08e]"
                                                                    : "border-transparent"
                                                            }`}
                                                        >
                                                            <Image src={url} alt="" fill className="object-cover" />
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </>
                        ) : (
                            /* 🟢 페이지 1: 태그 + 텍스트 + 저장 */
                            <>
                                {/* 별점 */}
                                <div className="py-6 text-center border-b border-gray-100 dark:border-gray-800 mb-6">
                                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                                        {t("courseStart.ratingPrompt")}
                                    </p>
                                    <div className="flex justify-center gap-2 mb-2">
                                        {[1, 2, 3, 4, 5].map((star) => (
                                            <button
                                                key={star}
                                                onClick={() => setStoryRating(star)}
                                                className="text-3xl transition-all hover:scale-110 active:scale-95"
                                                type="button"
                                            >
                                                <span
                                                    className={
                                                        storyRating >= star
                                                            ? "text-yellow-400 opacity-100"
                                                            : "text-gray-300 dark:text-gray-600 opacity-30"
                                                    }
                                                >
                                                    ⭐
                                                </span>
                                            </button>
                                        ))}
                                    </div>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">
                                        {storyRating === 5 && t("courseStart.rating5")}
                                        {storyRating === 4 && t("courseStart.rating4")}
                                        {storyRating === 3 && t("courseStart.rating3")}
                                        {storyRating === 2 && t("courseStart.rating2")}
                                        {storyRating === 1 && t("courseStart.rating1")}
                                    </p>
                                </div>

                                {/* 텍스트(설명) 입력 */}
                                <div className="pb-4">
                                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-200 mb-2">
                                        {t("courseStart.memoLabel")}
                                    </label>
                                    <textarea
                                        value={descriptionText}
                                        onChange={(e) => setDescriptionText(e.target.value)}
                                        placeholder={t("courseStart.memoPlaceholder")}
                                        rows={3}
                                        className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 dark:bg-[#1a241b] dark:text-white rounded-lg text-sm resize-none outline-none focus:border-[#99c08e]"
                                    />
                                </div>

                                {/* 태그 - #DoNa 맨 앞 고정 */}
                                <div className="pb-6">
                                    {selectedTags.length > 0 && (
                                        <div className="mb-3 flex flex-wrap gap-2">
                                            {selectedTags.map((tag) => (
                                                <div
                                                    key={tag}
                                                    className="inline-flex items-center gap-2 px-3 py-1.5 bg-gray-100 dark:bg-gray-800 rounded-full text-xs font-medium dark:text-gray-200"
                                                >
                                                    #{tag}
                                                    {tag !== "DoNa" && (
                                                        <button
                                                            onClick={() => removeTag(tag)}
                                                            className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 text-sm leading-none m-0 p-0"
                                                        >
                                                            <span className="symbol-ko-font">✕</span>
                                                        </button>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* 🟢 태그 직접 입력 필드 */}
                                    <div className="mb-3 flex gap-2">
                                        <input
                                            type="text"
                                            value={tagInput}
                                            onChange={(e) => setTagInput(e.target.value)}
                                            onKeyDown={handleTagInputKeyDown}
                                            placeholder={t("courseStart.tagInputPlaceholder")}
                                            maxLength={10}
                                            className="flex-1 px-3 py-2 border border-gray-200 dark:border-gray-700 dark:bg-[#1a241b] dark:text-white rounded-lg text-sm outline-none focus:border-[#99c08e] focus:ring-2 focus:ring-[#99c08e]/10 transition-colors"
                                        />
                                        <button
                                            onClick={addCustomTag}
                                            disabled={!tagInput.trim()}
                                            className="px-4 py-2 bg-[#99c08e] text-white rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all whitespace-nowrap flex items-center justify-center"
                                        >
                                            {t("courseStart.addTag")}
                                        </button>
                                    </div>

                                    {/* 제안 태그 */}
                                    <div className="flex flex-wrap gap-2">
                                        {suggestedTags.map((tag) => {
                                            const isSelected = selectedTags.includes(tag);

                                            return (
                                                <button
                                                    key={tag}
                                                    onClick={() => toggleTag(tag)}
                                                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                                                        isSelected
                                                            ? "bg-[#99c08e] text-white border border-[#99c08e]"
                                                            : "bg-white dark:bg-[#1a241b] text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
                                                    }`}
                                                >
                                                    #{tag}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </div>

                {/* 하단 버튼 */}
                <div className="shrink-0 bg-white dark:bg-[#1a241b] border-t border-gray-100 dark:border-gray-800 px-6 py-4 flex gap-3">
                    {pageIndex === 1 ? (
                        <>
                            <button
                                onClick={handlePrev}
                                className="px-6 h-14 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-xl font-bold hover:bg-gray-50 dark:hover:bg-gray-700 transition-all flex items-center justify-center"
                            >
                                {t("courseStart.back")}
                            </button>
                            <button
                                onClick={handleSubmit}
                                className="flex-1 h-14 bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white rounded-xl font-bold hover:bg-gray-200 dark:hover:bg-gray-700 transition-all"
                            >
                                {t("courseStart.save")}
                            </button>
                        </>
                    ) : (
                        <button
                            onClick={handleNext}
                            className="w-full h-14 text-white rounded-xl font-bold shadow-lg hover:shadow-xl hover:opacity-90 active:scale-95 transition-all"
                            style={{ backgroundColor: "#99c08e" }}
                        >
                            {t("courseStart.next")}
                        </button>
                    )}
                </div>
            </div>
            {/* Congrats Modal */}
            {showCongrats && (
                <div className="fixed inset-0 z-5000 bg-black/60 flex items-center justify-center p-5 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white rounded-3xl p-8 w-full max-w-sm text-center shadow-2xl animate-zoom-in">
                        <div className="text-6xl mb-4">🏆</div>
                        <h3 className="text-2xl font-black text-slate-950 mb-2">{t("courseStart.congratsTitle")}</h3>

                        <p className="text-gray-500 mb-8 whitespace-pre-line">{t("courseStart.congratsBody")}</p>
                        <button
                            onClick={handleSubmit}
                            className="w-full py-4 text-white rounded-xl font-bold shadow-lg hover:opacity-90 hover:shadow-xl mb-3 transition-all"
                            style={{ backgroundColor: "#99c08e" }}
                        >
                            {t("courseStart.saveMemory")}
                        </button>
                        <button
                            onClick={() => {
                                router.prefetch("/");
                                router.push("/");
                            }}
                            className="w-full py-4 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200"
                        >
                            {t("courseStart.goHome")}
                        </button>
                    </div>
                </div>
            )}
            <StoryRecordModal
                isOpen={showReview}
                onClose={() => {
                    setShowReview(false);
                    router.push("/courses");
                }}
                courseId={Number(courseId)}
                courseName={course?.title || ""}
            />
            {showSubscriptionModal && course && (
                <TicketPlans
                    courseId={Number(courseId)}
                    courseGrade={(course.grade || "BASIC").toUpperCase() === "PREMIUM" ? "PREMIUM" : "BASIC"}
                    onClose={() => setShowSubscriptionModal(false)}
                />
            )}
            {showLoginModal && <LoginModal onClose={() => setShowLoginModal(false)} />}
            {/* 🟢 사진 개수 부족 모달 */}
            {showPhotoCountModal && (
                <div className="fixed inset-0 z-5000 bg-black/60 flex items-center justify-center p-5 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white dark:bg-[#1a241b] rounded-3xl p-6 pt-8 w-full max-w-sm text-center shadow-2xl animate-zoom-in">
                        {/* 아이콘 영역 */}
                        <div className="w-16 h-16 mx-auto mb-5 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center">
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                fill="none"
                                viewBox="0 0 24 24"
                                strokeWidth={1.8}
                                stroke="currentColor"
                                className="w-8 h-8 text-amber-600 dark:text-amber-400"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
                                />
                            </svg>
                        </div>

                        {/* 제목 및 설명 */}
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-3">{t("courseStart.photoModalTitle")}</h2>
                        <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed mb-6">
                            {t("courseStart.photoModalP1")}
                            <br />
                            {t("courseStart.photoModalP2Before")}
                            <span className="font-bold text-amber-600 dark:text-amber-400">
                                {t("courseStart.photoModalP2Bold")}
                            </span>
                            {t("courseStart.photoModalP2After")}
                            <br />
                            <br />
                            {t("courseStart.photoModalP3", { count: allPhotos.length })}
                        </p>

                        {/* 버튼 */}
                        <button
                            onClick={() => setShowPhotoCountModal(false)}
                            className="w-full py-4 text-white rounded-xl font-bold shadow-lg hover:opacity-90 hover:shadow-xl transition-all"
                            style={{ backgroundColor: "#99c08e" }}
                        >
                            {t("courseStart.confirm")}
                        </button>
                    </div>
                </div>
            )}
            {/* 🟢 나만의 추억 한도 초과 하단 시트 (아래에서 위로 올라옴) - 웹 폰 목업에서는 폰 안으로 */}
            {showMemoryLimitModal &&
                (() => {
                    const posClass = containInPhone && !inApp ? "absolute" : "fixed";
                    const modalContent = (
                        <>
                            <div
                                className={`${posClass} inset-0 z-5000 bg-black/60 backdrop-blur-sm animate-fade-in`}
                                style={containInPhone && !inApp ? { width: "100%", height: "100%" } : undefined}
                                onClick={() => setShowMemoryLimitModal(false)}
                                aria-hidden
                            />
                            <div className={`${posClass} left-0 right-0 bottom-3 z-5001 w-full`}>
                                <div
                                    className="bg-white dark:bg-[#1a241b] rounded-t-2xl border-t border-gray-100 dark:border-gray-800 w-full shadow-2xl transition-transform duration-300 ease-out"
                                    style={{
                                        transform: memoryLimitModalSlideUp ? "translateY(0)" : "translateY(100%)",
                                    }}
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    <div className="p-6 pt-8 pb-[calc(1rem+env(safe-area-inset-bottom))] text-center">
                                        <div className="mb-4 flex justify-center">
                                            <svg
                                                xmlns="http://www.w3.org/2000/svg"
                                                viewBox="0 0 24 24"
                                                fill="currentColor"
                                                className="w-12 h-12 text-gray-600 dark:text-gray-300"
                                            >
                                                <path d="M19 10H20C20.5523 10 21 10.4477 21 11V21C21 21.5523 20.5523 22 20 22H4C3.44772 22 3 21.5523 3 21V11C3 10.4477 3.44772 10 4 10H5V9C5 5.13401 8.13401 2 12 2C15.866 2 19 5.13401 19 9V10ZM5 12V20H19V12H5ZM11 14H13V18H11V14ZM17 10V9C17 6.23858 14.7614 4 12 4C9.23858 4 7 6.23858 7 9V10H17Z" />
                                            </svg>
                                        </div>
                                        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-3">
                                            {t("courseStart.memoryLimitTitle")}
                                        </h2>
                                        <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed mb-6">
                                            {memoryLimitMessage || t("courseStart.memoryLimitUpgradeHint")}
                                        </p>
                                        <div className="flex flex-col gap-3">
                                            <button
                                                onClick={() => {
                                                    setShowMemoryLimitModal(false);
                                                    setShowSubscriptionModal(true);
                                                }}
                                                className="w-full py-4 text-white rounded-xl font-bold text-lg shadow-md hover:shadow-xl transition-all bg-linear-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 scale-100 hover:scale-[1.02] active:scale-95"
                                            >
                                                {t("courseStart.subscriptionUpgrade")}
                                            </button>
                                            <button
                                                onClick={() => setShowMemoryLimitModal(false)}
                                                className="w-full py-3 text-gray-600 dark:text-gray-400 font-medium rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                                            >
                                                {t("courseStart.close")}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </>
                    );
                    const portalTarget =
                        containInPhone && !inApp && modalContainerRef?.current
                            ? modalContainerRef.current
                            : document.body;
                    return createPortal(modalContent, portalTarget);
                })()}
            {/* 🟢 저장 성공 모달 */}
            {showSaveSuccessModal && (
                <div className="fixed inset-0 z-5000 bg-black/60 flex items-center justify-center p-5 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white dark:bg-[#1a241b] rounded-3xl p-6 pt-8 w-full max-w-sm text-center shadow-2xl animate-zoom-in">
                        {/* 폴라로이드 아이콘 */}
                        <MemorySavedIcon imageUrl={savedImageUrl} />

                        {/* 제목 및 설명 */}
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white">{t("courseStart.saveSuccessTitle")}</h2>
                        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400 text-center leading-relaxed mb-6">
                            {t("courseStart.saveSuccessLine1")}
                            <br />
                            {t("courseStart.saveSuccessLine2", { name: userName ?? "" })}
                        </p>

                        <p className="text-gray-600 dark:text-gray-400 mb-8">{t("courseStart.saveSuccessFooter")}</p>
                        <button
                            onClick={() => {
                                setShowSaveSuccessModal(false);
                                router.push("/mypage");
                            }}
                            className="w-full py-4 text-white rounded-xl font-bold shadow-lg hover:opacity-90 hover:shadow-xl mb-3 transition-all"
                            style={{ backgroundColor: "#99c08e" }}
                        >
                            {t("courseStart.confirm")}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

export default function GuidePage() {
    return (
        <Suspense fallback={null}>
            <GuidePageInner />
        </Suspense>
    );
}
