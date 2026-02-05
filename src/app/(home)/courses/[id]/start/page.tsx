"use client";

import React, { Suspense, useEffect, useState, useMemo, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import ReviewModal from "@/components/ReviewModal";
import StoryRecordModal from "@/components/StoryRecordModal";
import TicketPlans from "@/components/TicketPlans";
import LoginModal from "@/components/LoginModal";
import MemorySavedIcon from "@/components/MemorySavedIcon";
import { motion, PanInfo } from "framer-motion";
import { isIOS } from "@/lib/platform";
import Image from "@/components/ImageFallback";

// --- Types ---
type Place = {
    id: number;
    name?: string;
    imageUrl?: string;
    coaching_tip?: string | null; // 유료 팁
    coaching_tip_free?: string | null; // 무료 팁
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
    const courseId = params?.id as string;

    const [course, setCourse] = useState<Course | null>(null);
    const [loading, setLoading] = useState(true);
    const [showIntro, setShowIntro] = useState(true); // 🟢 인트로 화면 표시 여부
    const [currentStep, setCurrentStep] = useState(0);
    const [showCongrats, setShowCongrats] = useState(false);
    const [showReview, setShowReview] = useState(false);
    const [userEmail, setUserEmail] = useState<string | null>(null);
    const [userName, setUserName] = useState<string | null>(null);
    const [couponAwarded, setCouponAwarded] = useState(false);
    const [couponMessage, setCouponMessage] = useState<string | null>(null);
    const [couponAmount, setCouponAmount] = useState(0);
    const [showSaveSuccessModal, setShowSaveSuccessModal] = useState(false);
    const [personalMemoryCount, setPersonalMemoryCount] = useState<number | null>(null);
    const [savedImageUrl, setSavedImageUrl] = useState<string | null>(null);
    const [userTier, setUserTier] = useState<"FREE" | "BASIC" | "PREMIUM">("FREE");
    const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
    const [showLoginModal, setShowLoginModal] = useState(false);
    const [showPhotoCountModal, setShowPhotoCountModal] = useState(false);
    const [currentPhotoCount, setCurrentPhotoCount] = useState(0);
    const [showMemoryLimitModal, setShowMemoryLimitModal] = useState(false);
    const [memoryLimitModalSlideUp, setMemoryLimitModalSlideUp] = useState(false);
    const [memoryLimitMessage, setMemoryLimitMessage] = useState<string>("");
    const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
    const [platform, setPlatform] = useState<"ios" | "android" | "web">("web");

    // 🟢 이미지 슬라이더 상태
    const [currentImageIndex, setCurrentImageIndex] = useState(0);
    const [touchStartX, setTouchStartX] = useState<number | null>(null);
    const [touchEndX, setTouchEndX] = useState<number | null>(null);

    // 🟢 iOS 플랫폼 감지
    useEffect(() => {
        setPlatform(isIOS() ? "ios" : "web");
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

    // 🟢 Summone 스타일 스토리 기록 상태
    const [storyRating, setStoryRating] = useState(5);
    const [selectedTags, setSelectedTags] = useState<string[]>([]);
    const [uploadingImages, setUploadingImages] = useState(false);
    const [tagInput, setTagInput] = useState("");

    // 🟢 각 장소별로 사진과 글, 태그를 저장하는 상태
    const [stepData, setStepData] = useState<Record<number, { photos: string[]; description: string; tags: string[] }>>(
        {}
    );
    const SUGGESTED_TAGS = ["낭만적인", "감성", "조용한", "인생샷", "숨겨진", "데이트", "사진", "카페", "맛집"];
    const mainImageInputRef = useRef<HTMLInputElement>(null);
    const galleryImageInputRef = useRef<HTMLInputElement>(null);

    // 🟢 GPS 도착 체크 및 자동 이동 기능 제거

    const currentPlace = course?.coursePlaces?.[currentStep]?.place;
    const movementGuide = course?.coursePlaces?.[currentStep]?.movement_guide;
    const totalSteps = course?.coursePlaces?.length || 0;
    const progress = totalSteps > 0 ? ((currentStep + 1) / totalSteps) * 100 : 0;

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
                    throw new Error("코스를 찾을 수 없습니다.");
                }
            } catch (error: any) {
                console.error("코스 로딩 오류:", error);
                const errorMessage = error?.message || "코스를 불러오는 중 오류가 발생했습니다. 다시 시도해주세요.";
                alert(errorMessage);
                router.push("/courses");
            } finally {
                setLoading(false);
            }
        };

        fetchCourse();
    }, [courseId, router]);

    // 🟢 GPS 위치 추적 제거됨

    // 🟢 currentStep 변경 시 해당 step의 태그 불러오기
    useEffect(() => {
        const currentStepData = stepData[currentStep] || { photos: [], description: "", tags: [] };
        setSelectedTags(currentStepData.tags);
    }, [currentStep, stepData]);

    const handleNext = () => {
        // 🟢 현재 step의 태그 저장
        const currentStepData = stepData[currentStep] || { photos: [], description: "", tags: [] };
        setStepData((prev) => ({
            ...prev,
            [currentStep]: {
                ...currentStepData,
                tags: selectedTags, // 🟢 태그 저장
            },
        }));

        // 🟢 GPS 도착 체크 제거: 항상 다음 단계로 이동 가능
        if (course && currentStep < course.coursePlaces.length - 1) {
            setCurrentStep((c) => c + 1);
        } else if (course && currentStep === course.coursePlaces.length - 1) {
            // 🟢 마지막 장소의 데이터를 저장한 후 완료 페이지로 이동
            // setStepData는 비동기이므로, 완료 페이지에서 모든 데이터를 사용할 수 있도록
            // 여기서는 바로 완료 페이지로 이동 (stepData는 이미 위에서 업데이트됨)
            setCurrentStep((c) => c + 1);
        }
    };

    const handlePrev = () => {
        // 🟢 현재 step의 태그 저장
        const currentStepData = stepData[currentStep] || { photos: [], description: "", tags: [] };
        setStepData((prev) => ({
            ...prev,
            [currentStep]: {
                ...currentStepData,
                tags: selectedTags, // 🟢 태그 저장
            },
        }));

        if (currentStep > 0) {
            setCurrentStep((c) => c - 1);
        }
    };

    async function markCompleted() {
        try {
            const { apiFetch } = await import("@/lib/authClient");
            const { data, response } = await apiFetch("/api/users/completions", {
                method: "POST",
                body: JSON.stringify({ courseId: Number(courseId), title: course?.title }),
            });

            if (response.ok && data) {
                if ((data as any).couponAwarded) {
                    setCouponAwarded(true);
                    setCouponMessage((data as any).message || "쿠폰이 지급되었습니다!");
                } else {
                    setCouponAwarded(false);
                    setCouponMessage(null);
                }
            }
        } catch {
            setCouponAwarded(false);
            setCouponMessage(null);
        }
    }

    // 🟢 Summone 스타일 함수들
    const toggleTag = (tag: string) => {
        const newTags = selectedTags.includes(tag) ? selectedTags.filter((t) => t !== tag) : [...selectedTags, tag];
        setSelectedTags(newTags);

        // 🟢 태그 변경 시 stepData에 즉시 저장
        const currentStepData = stepData[currentStep] || { photos: [], description: "", tags: [] };
        setStepData((prev) => ({
            ...prev,
            [currentStep]: {
                ...currentStepData,
                tags: newTags,
            },
        }));
    };

    const removeTag = (tag: string) => {
        const newTags = selectedTags.filter((t) => t !== tag);
        setSelectedTags(newTags);

        // 🟢 태그 제거 시 stepData에 즉시 저장
        const currentStepData = stepData[currentStep] || { photos: [], description: "", tags: [] };
        setStepData((prev) => ({
            ...prev,
            [currentStep]: {
                ...currentStepData,
                tags: newTags,
            },
        }));
    };

    // 🟢 태그 직접 입력 함수
    const handleTagInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter" && tagInput.trim()) {
            e.preventDefault();
            const newTag = tagInput.trim();
            if (!selectedTags.includes(newTag) && newTag.length > 0 && newTag.length <= 10) {
                const newTags = [...selectedTags, newTag];
                setSelectedTags(newTags);
                setTagInput("");

                // 🟢 태그 추가 시 stepData에 즉시 저장
                const currentStepData = stepData[currentStep] || { photos: [], description: "", tags: [] };
                setStepData((prev) => ({
                    ...prev,
                    [currentStep]: {
                        ...currentStepData,
                        tags: newTags,
                    },
                }));
            }
        }
    };

    const addCustomTag = () => {
        if (tagInput.trim()) {
            const newTag = tagInput.trim();
            if (!selectedTags.includes(newTag) && newTag.length > 0 && newTag.length <= 10) {
                const newTags = [...selectedTags, newTag];
                setSelectedTags(newTags);
                setTagInput("");

                // 🟢 태그 추가 시 stepData에 즉시 저장
                const currentStepData = stepData[currentStep] || { photos: [], description: "", tags: [] };
                setStepData((prev) => ({
                    ...prev,
                    [currentStep]: {
                        ...currentStepData,
                        tags: newTags,
                    },
                }));
            }
        }
    };

    const handleMainImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        const currentStepData = stepData[currentStep] || { photos: [], description: "", tags: [] };
        const maxUpload = 3 - currentStepData.photos.length;
        const filesToUpload = Array.from(files).slice(0, maxUpload);

        if (filesToUpload.length === 0) {
            alert("하나의 장소에 최대 3개까지 사진을 업로드할 수 있습니다.");
            return;
        }

        setUploadingImages(true);
        try {
            filesToUpload.forEach((file) => {
                if (file.size > 50 * 1024 * 1024) throw new Error(`${file.name}의 크기가 50MB를 초과합니다.`);
            });
            const { uploadViaPresign } = await import("@/lib/uploadViaPresign");
            const photoUrls = await uploadViaPresign(filesToUpload, {
                type: "memory",
                courseId: courseId?.toString(),
            });
            if (photoUrls.length > 0) {
                const newPhotos = [...currentStepData.photos, ...photoUrls];
                setStepData((prev) => ({
                    ...prev,
                    [currentStep]: { ...currentStepData, photos: newPhotos },
                }));
            }
        } catch (err) {
            console.error("이미지 업로드 오류:", err);
            alert("이미지 업로드에 실패했습니다.");
        } finally {
            setUploadingImages(false);
        }
    };

    const handleGalleryUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        const currentStepData = stepData[currentStep] || { photos: [], description: "", tags: [] };
        const maxUpload = 3 - currentStepData.photos.length;
        const filesToUpload = Array.from(files).slice(0, maxUpload);
        if (filesToUpload.length === 0) {
            alert("하나의 장소에 최대 3개까지 사진을 업로드할 수 있습니다.");
            return;
        }

        setUploadingImages(true);
        try {
            filesToUpload.forEach((file) => {
                if (file.size > 50 * 1024 * 1024) throw new Error(`${file.name}의 크기가 50MB를 초과합니다.`);
            });
            const { uploadViaPresign } = await import("@/lib/uploadViaPresign");
            const photoUrls = await uploadViaPresign(filesToUpload, {
                type: "memory",
                courseId: courseId?.toString(),
            });
            if (photoUrls.length > 0) {
                const maxPhotos = 3 - currentStepData.photos.length;
                const newPhotos = [...currentStepData.photos, ...photoUrls.slice(0, maxPhotos)];
                setStepData((prev) => ({
                    ...prev,
                    [currentStep]: { ...currentStepData, photos: newPhotos },
                }));
            }
        } catch (err) {
            console.error("이미지 업로드 오류:", err);
            alert("이미지 업로드에 실패했습니다.");
        } finally {
            setUploadingImages(false);
        }
    };

    const deletePhoto = (index: number) => {
        const currentStepData = stepData[currentStep] || { photos: [], description: "", tags: [] };
        const newPhotos = currentStepData.photos.filter((_, i) => i !== index);
        setStepData((prev) => ({
            ...prev,
            [currentStep]: { ...currentStepData, photos: newPhotos },
        }));
        // 🟢 삭제 후 인덱스 조정
        if (currentImageIndex >= newPhotos.length && newPhotos.length > 0) {
            setCurrentImageIndex(newPhotos.length - 1);
        } else if (newPhotos.length === 0) {
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

            const shareText = `${course?.title || "데이트"} 후기\n오늘 정말 좋은 하루였어요! 💕`;
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
            alert("카카오톡 공유에 실패했습니다.");
        }
    };

    // 🟢 개인 추억 저장 함수 (isPublic: false)
    const handleSubmit = async () => {
        if (!isLoggedIn) {
            setShowLoginModal(true);
            return;
        }

        if (!courseId) {
            alert("코스 정보를 찾을 수 없습니다.");
            return;
        }

        try {
            // 🟢 완료 페이지가 아닐 때만 현재 step의 데이터 저장
            // 완료 페이지(currentStep === totalSteps)에서는 이미 모든 데이터가 stepData에 저장되어 있음
            const isCompletePageNow = currentStep === totalSteps;
            if (!isCompletePageNow && currentStep < totalSteps) {
                const currentStepData = stepData[currentStep] || { photos: [], description: "", tags: [] };
                setStepData((prev) => ({
                    ...prev,
                    [currentStep]: {
                        photos: currentStepData.photos,
                        description: currentStepData.description,
                        tags: selectedTags,
                    },
                }));
            }

            // 🟢 모든 step의 데이터 합치기 (stepData에서 직접 가져오기)
            // 완료 페이지에서는 stepData에 모든 장소의 데이터가 이미 저장되어 있음
            const allPhotos = Object.values(stepData).flatMap((step) => step.photos);
            const allTags = Array.from(new Set(Object.values(stepData).flatMap((step) => step.tags)));

            // 🟢 placeData 생성: { [stepIndex]: { photos: string[], tags: string[] } }
            const placeData: Record<string, { photos: string[]; tags: string[] }> = {};
            Object.entries(stepData).forEach(([stepIndex, data]) => {
                if (data.photos.length > 0 || data.tags.length > 0) {
                    placeData[stepIndex] = {
                        photos: data.photos,
                        tags: data.tags,
                    };
                }
            });

            // 🟢 stepData가 비어있으면 경고
            if (Object.keys(stepData).length === 0) {
                console.warn("[handleSubmit] stepData가 비어있습니다!");
                alert("저장할 추억 데이터가 없습니다. 각 장소에서 사진이나 태그를 추가해주세요.");
                return;
            }

            // 🟢 나만의 추억은 최소 3장 이상의 사진이 필요
            if (allPhotos.length < 3) {
                setCurrentPhotoCount(allPhotos.length);
                setShowPhotoCountModal(true);
                return;
            }

            const { authenticatedFetch } = await import("@/lib/authClient");
            const data = await authenticatedFetch<any>("/api/reviews", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    courseId: Number(courseId),
                    rating: storyRating,
                    content: "",
                    imageUrls: allPhotos || [],
                    isPublic: false, // 🟢 개인 추억으로 저장
                    tags: allTags, // 🟢 전체 태그 (하위 호환성)
                    placeData: placeData, // 🟢 장소별 데이터
                }),
            });

            if (data && !(data as any).error) {
                // 🟢 쿠폰 지급 확인
                if ((data as any).couponAwarded) {
                    setCouponAwarded(true);
                    setCouponAmount((data as any).couponAmount || 0);
                    setCouponMessage((data as any).message || "쿠폰이 지급되었습니다!");

                    // 🟢 쿠폰 지급 이벤트 발생 (마이페이지 데이터 갱신용)
                    if (typeof window !== "undefined") {
                        window.dispatchEvent(
                            new CustomEvent("couponAwarded", {
                                detail: {
                                    amount: (data as any).couponAmount || 0,
                                    message: (data as any).message || "쿠폰이 지급되었습니다!",
                                },
                            })
                        );
                    }
                } else {
                    setCouponAwarded(false);
                    setCouponMessage(null);
                }

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
                alert((data as any)?.error || "저장에 실패했습니다.");
            }
        } catch (err) {
            console.error("추억 저장 오류:", err);
            const message = err instanceof Error ? err.message : "";
            // 🟢 나만의 추억 한도 초과 시 업그레이드 모달 표시
            if (message.includes("업그레이드") || message.includes("한도") || message.includes("MEMORY_LIMIT")) {
                setMemoryLimitMessage(
                    message || "나만의 추억 저장 한도에 도달했어요. 더 저장하려면 구독을 업그레이드해 주세요."
                );
                setShowMemoryLimitModal(true);
            } else {
                alert(message || "추억 저장 중 오류가 발생했습니다.");
            }
        }
    };

    // 🟢 [Fix]: 모든 Hook은 리턴문보다 위에 있어야 합니다.

    // 1. 필요한 변수들을 Hook보다 위에서 계산 (optional chaining 사용)
    const isLastStep = currentStep === totalSteps - 1;
    const isCompletePage = currentStep === totalSteps;
    const currentStepData = useMemo(
        () => stepData[currentStep] || { photos: [], description: "", tags: [] },
        [currentStep, stepData]
    );

    const allPhotos = useMemo(() => {
        if (!course) return [];
        return isCompletePage ? Object.values(stepData).flatMap((step) => step.photos) : currentStepData.photos;
    }, [isCompletePage, stepData, currentStepData.photos, course]);

    // 2. 이미지 슬라이더 관련 Effect들을 리턴문 위로 이동
    useEffect(() => {
        setCurrentImageIndex(0);
    }, [currentStep]);

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

    // --- 이후 렌더링 로직 시작 ---
    const mainImageUrl = allPhotos[0] || currentPlace?.imageUrl;
    const galleryPhotos = allPhotos.slice(1);
    const currentDate = new Date().toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" });
    const formattedDate = new Date()
        .toLocaleDateString("ko-KR", { year: "numeric", month: "numeric", day: "numeric" })
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

    // 🟢 완료 페이지: 저장하기와 공유하기만 표시
    if (isCompletePage) {
        return (
            <div className="fixed inset-0 z-100 flex flex-col bg-white dark:bg-[#0f1710] overflow-hidden overscroll-none">
                {/* Top Bar */}
                <div className="absolute top-0 left-0 right-0 z-20 px-4 pt-4 pb-2 bg-transparent pointer-events-none">
                    <div className="flex items-center justify-end mb-2 pointer-events-auto">
                        <button
                            onClick={() => router.push(`/courses/${courseId}`)}
                            className="w-8 h-8 flex items-center justify-center bg-white/80 dark:bg-[#1a241b]/80 backdrop-blur-sm rounded-full shadow-md text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                        >
                            ✕
                        </button>
                    </div>
                </div>

                {/* Background */}
                <div className="flex-1 relative z-0 bg-gray-50 dark:bg-[#0f1710]">
                    {course?.imageUrl ? (
                        <div
                            className="absolute inset-0 bg-cover bg-center bg-no-repeat"
                            style={{
                                backgroundImage: `url(${course.imageUrl})`,
                                filter: "blur(6px)",
                                transform: "scale(1.1)",
                            }}
                        />
                    ) : (
                        <div className="absolute inset-0 bg-linear-to-br from-indigo-50 via-purple-50 to-pink-50 dark:from-[#0f1710] dark:via-[#1a241b] dark:to-[#0f1710]" />
                    )}
                </div>

                {/* 완료 페이지 콘텐츠 */}
                <div className="absolute bottom-0 left-0 right-0 z-30 bg-white dark:bg-[#1a241b] backdrop-blur-lg rounded-t-3xl border border-gray-200 dark:border-gray-700 shadow-[0_-5px_20px_rgba(0,0,0,0.1)] px-6 py-8">
                    <div className="text-center mb-6">
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                            추억이 완성되었어요! 💕
                        </h2>
                        <p className="text-sm text-gray-600 dark:text-gray-400">저장해보세요</p>
                    </div>

                    {/* 별점 입력 */}
                    <div className="mb-6">
                        <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 text-center">
                            이 데이트는 어떠셨나요?
                        </p>
                        <div className="flex items-center justify-center gap-2 mb-2">
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
                        <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
                            {storyRating === 5 && "최고였어요! 💕"}
                            {storyRating === 4 && "정말 좋았어요! 😊"}
                            {storyRating === 3 && "보통이었어요 😐"}
                            {storyRating === 2 && "좀 아쉬웠어요 😕"}
                            {storyRating === 1 && "별로였어요... 😢"}
                        </p>
                    </div>

                    {/* 저장하기 버튼 */}
                    <div className="flex gap-3">
                        <button
                            onClick={handlePrev}
                            className="px-6 h-14 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-xl font-bold hover:bg-gray-50 dark:hover:bg-gray-700 transition-all flex items-center justify-center"
                        >
                            ← 뒤로
                        </button>
                        <button
                            onClick={handleSubmit}
                            className="flex-1 h-14 bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white rounded-xl font-bold hover:bg-gray-200 dark:hover:bg-gray-700 transition-all"
                        >
                            저장하기
                        </button>
                    </div>
                </div>
            </div>
        );
    }

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

                {/* Center Card - Intro (하단 배치) */}
                <div className="absolute bottom-0 left-0 right-0 z-30 flex items-end justify-center px-6 pb-8">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3 }}
                        className="bg-white/90 dark:bg-[#1a241b]/90 backdrop-blur-lg rounded-3xl p-8 shadow-2xl max-w-md w-full text-center"
                    >
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                            {userName && course?.region
                                ? `${userName}의 ${course.region} 데이트`
                                : userName
                                ? `${userName}의 ${course?.region || ""} 데이트`
                                : course?.region
                                ? `${course.region} 데이트`
                                : "데이트"}
                        </h1>
                        <p className="text-lg text-gray-600 dark:text-gray-300 mt-2">❤️ {formattedDate}</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-6">화면을 터치하여 시작하기</p>
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
                        ✕
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
            {/* 3. Bottom Story Card - 다크 모드 지원 - 고정 모달 */}
            <div
                className="absolute bottom-0 left-0 right-0 z-30 bg-white dark:bg-[#1a241b] backdrop-blur-lg rounded-t-3xl border border-gray-200 dark:border-gray-700 shadow-[0_-5px_20px_rgba(0,0,0,0.1)]"
                style={{ maxHeight: "65vh", minHeight: "50vh", display: "flex", flexDirection: "column" }}
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
                                ? `${userName}의 ${course.region} 데이트`
                                : userName
                                ? `${userName}의 데이트`
                                : course?.region
                                ? `${course.region} 데이트`
                                : "우리의 데이트"}
                        </h1>
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            {(() => {
                                return currentPlace?.imageUrl ? (
                                    // 🟢 배경 이미지가 현재 장소 사진일 때: 코스명 · 장소명 (한줄 띄어서)
                                    <>
                                        <div>{course?.title || "코스"}</div>
                                        {currentPlace?.name && (
                                            <div className="mt-1">
                                                <span className="mr-2">🎟</span>
                                                <span>{currentPlace.name}</span>
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    // 🟢 배경 이미지가 코스 이미지일 때: 코스명만
                                    <span>{course?.title || "코스"}</span>
                                );
                            })()}
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-300 mt-2">❤️ {currentDate}</p>
                    </div>

                    <div className="px-5 pb-24">
                        {/* Section 2: 별점 평가 - 마지막 장소에서만 표시 */}
                        {currentStep === totalSteps - 1 && (
                            <div className="py-6 text-center border-b border-gray-100 dark:border-gray-800 mb-6">
                                <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                                    이 데이트는 어떠셨나요?
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
                                    {storyRating === 5 && "최고였어요! 💕"}
                                    {storyRating === 4 && "정말 좋았어요! 😊"}
                                    {storyRating === 3 && "보통이었어요 😐"}
                                    {storyRating === 2 && "좀 아쉬웠어요 😕"}
                                    {storyRating === 1 && "별로였어요... 😢"}
                                </p>
                            </div>
                        )}

                        {/* Section 4: 태그 - 마지막 step이 아니면 현재 step의 태그만 표시 */}
                        <div className="pb-6">
                            {(() => {
                                // 🟢 완료 페이지가 아니면 현재 step의 태그만, 완료 페이지면 모든 태그
                                const tagsToShow = isCompletePage
                                    ? Array.from(new Set(Object.values(stepData).flatMap((step) => step.tags)))
                                    : selectedTags;

                                return tagsToShow.length > 0 ? (
                                    <div className="mb-3 flex flex-wrap gap-2">
                                        {tagsToShow.map((tag) => (
                                            <div
                                                key={tag}
                                                className="inline-flex items-center gap-2 px-3 py-1.5 bg-gray-100 dark:bg-gray-800 rounded-full text-xs font-medium dark:text-gray-200"
                                            >
                                                #{tag}
                                                <button
                                                    onClick={() => removeTag(tag)}
                                                    className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 text-sm leading-none m-0 p-0"
                                                >
                                                    ✕
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                ) : null;
                            })()}

                            {/* 🟢 태그 직접 입력 필드 */}
                            <div className="mb-3 flex gap-2">
                                <input
                                    type="text"
                                    value={tagInput}
                                    onChange={(e) => setTagInput(e.target.value)}
                                    onKeyDown={handleTagInputKeyDown}
                                    placeholder="태그 직접 입력 (Enter)"
                                    maxLength={10}
                                    className="flex-1 px-3 py-2 border border-gray-200 dark:border-gray-700 dark:bg-[#1a241b] dark:text-white rounded-lg text-sm outline-none focus:border-[#99c08e] focus:ring-2 focus:ring-[#99c08e]/10 transition-colors"
                                />
                                <button
                                    onClick={addCustomTag}
                                    disabled={!tagInput.trim()}
                                    className="px-4 py-2 bg-[#99c08e] text-white rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all whitespace-nowrap flex items-center justify-center"
                                >
                                    추가
                                </button>
                            </div>

                            {/* 제안 태그 */}
                            <div className="flex flex-wrap gap-2">
                                {SUGGESTED_TAGS.map((tag) => {
                                    // 🟢 완료 페이지가 아니면 현재 step의 태그만 체크
                                    const isSelected = isCompletePage
                                        ? Array.from(
                                              new Set(Object.values(stepData).flatMap((step) => step.tags))
                                          ).includes(tag)
                                        : selectedTags.includes(tag);

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

                        {/* Section 5: 사진 갤러리 - 추억 회상 */}
                        <div className="pb-6">
                            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-200 mb-3">
                                📸 우리의 순간들
                            </label>

                            {/* 메인 이미지 업로드 영역 */}
                            {allPhotos.length === 0 ? (
                                <div className="mb-4">
                                    <label className="flex flex-col items-center justify-center w-full h-48 rounded-2xl border-2 border-dashed border-gray-300 dark:border-gray-700 cursor-pointer hover:border-[#99c08e] dark:hover:border-[#99c08e] hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-all">
                                        <input
                                            ref={mainImageInputRef}
                                            type="file"
                                            multiple
                                            accept="image/*"
                                            onChange={handleMainImageUpload}
                                            style={{ display: "none" }}
                                        />
                                        <div className="text-4xl text-gray-400 dark:text-gray-500 mb-2">📷</div>
                                        <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
                                            첫 번째 추억 사진을 추가해주세요
                                        </p>
                                        <p className="text-xs text-gray-400 dark:text-gray-500">
                                            최대 3개까지 업로드 가능
                                        </p>
                                        {uploadingImages && (
                                            <div className="mt-2 text-xs text-gray-500">업로드 중...</div>
                                        )}
                                    </label>
                                </div>
                            ) : (
                                <div className="mb-4 relative">
                                    {/* 진행 상태 점들 - 사진 컨테이너 위에 배치 */}
                                    {allPhotos.length > 1 && (
                                        <div
                                            className="absolute left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 -top-10"
                                            style={{ top: "calc(env(safe-area-inset-top, 0) + 1rem)" }}
                                        >
                                            {allPhotos.map((_, idx) => (
                                                <div
                                                    key={idx}
                                                    className={`h-1 rounded-full transition-all ${
                                                        idx === currentImageIndex ? "bg-white w-8" : "bg-white/40 w-1"
                                                    }`}
                                                />
                                            ))}
                                        </div>
                                    )}
                                    <div
                                        className="relative w-full h-64 md:h-80 rounded-2xl overflow-hidden bg-gray-100 dark:bg-gray-800"
                                        onTouchStart={onTouchStart}
                                        onTouchMove={onTouchMove}
                                        onTouchEnd={onTouchEnd}
                                    >
                                        <Image
                                            src={allPhotos[currentImageIndex] || allPhotos[0]}
                                            alt="Main photo"
                                            fill
                                            className="object-cover"
                                        />
                                        <button
                                            onClick={() => {
                                                const photoIndexToDelete = allPhotos.length > 1 ? currentImageIndex : 0;
                                                deletePhoto(photoIndexToDelete);
                                            }}
                                            className="absolute top-2 right-3 w-8 h-8 rounded-full bg-black/60 text-white text-sm flex items-center justify-center hover:bg-black/80 transition-colors z-10"
                                        >
                                            ✕
                                        </button>
                                        {allPhotos.length < 3 && (
                                            <label className="absolute bottom-2 right-2 w-10 h-10 rounded-full bg-white/90 dark:bg-gray-800/90 flex items-center justify-center cursor-pointer hover:bg-white dark:hover:bg-gray-800 shadow-lg transition-all z-10">
                                                <input
                                                    ref={mainImageInputRef}
                                                    type="file"
                                                    multiple
                                                    accept="image/*"
                                                    onChange={handleMainImageUpload}
                                                    style={{ display: "none" }}
                                                />
                                                <span className="text-xl text-gray-600 dark:text-gray-300">+</span>
                                            </label>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* 추가 사진 갤러리 (2번째 사진부터) */}
                            {(galleryPhotos.length > 0 || allPhotos.length > 0) && (
                                <div className="flex gap-2.5 overflow-x-auto pb-2 scrollbar-hide -webkit-overflow-scrolling-touch">
                                    {galleryPhotos.map((url, idx) => (
                                        <div
                                            key={idx}
                                            className="relative w-20 h-20 shrink-0 rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-800"
                                        >
                                            <Image src={url} alt={`Photo ${idx + 2}`} fill className="object-cover" />
                                            <button
                                                onClick={() => deletePhoto(idx + 1)}
                                                className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/50 text-white text-xs flex items-center justify-center hover:bg-black/70 transition-colors"
                                            >
                                                ✕
                                            </button>
                                        </div>
                                    ))}
                                    {allPhotos.length < 10 && (
                                        <label className="w-20 h-20 shrink-0 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-700 flex items-center justify-center cursor-pointer hover:border-[#99c08e] dark:hover:border-[#99c08e] transition-colors">
                                            <input
                                                ref={galleryImageInputRef}
                                                type="file"
                                                multiple
                                                accept="image/*"
                                                onChange={handleGalleryUpload}
                                                style={{ display: "none" }}
                                            />
                                            <span className="text-2xl text-gray-400 dark:text-gray-500">+</span>
                                        </label>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* 🟢 길찾기 버튼 제거됨 */}
                    </div>
                </div>

                {/* 하단 버튼 */}
                <div className="shrink-0 bg-white dark:bg-[#1a241b] border-t border-gray-100 dark:border-gray-800 px-6 py-4 flex gap-3">
                    {currentStep === totalSteps - 1 ? (
                        <>
                            <button
                                onClick={handlePrev}
                                className="px-6 h-14 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-xl font-bold hover:bg-gray-50 dark:hover:bg-gray-700 transition-all flex items-center justify-center"
                            >
                                ← 이전
                            </button>
                            <button
                                onClick={handleSubmit}
                                className="flex-1 h-14 bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white rounded-xl font-bold hover:bg-gray-200 dark:hover:bg-gray-700 transition-all"
                            >
                                저장하기
                            </button>
                        </>
                    ) : (
                        <>
                            {currentStep > 0 && (
                                <button
                                    onClick={handlePrev}
                                    className="h-14 px-6 border-2 border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white rounded-xl font-bold hover:bg-gray-50 dark:hover:bg-gray-800 transition-all"
                                >
                                    ← 이전
                                </button>
                            )}
                            <button
                                onClick={handleNext}
                                className={`${
                                    currentStep > 0 ? "flex-1" : "w-full"
                                } h-14 text-white rounded-xl font-bold shadow-lg hover:shadow-xl hover:opacity-90 active:scale-95 transition-all`}
                                style={{ backgroundColor: "#99c08e" }}
                            >
                                다음
                            </button>
                        </>
                    )}
                </div>
            </div>
            {/* Congrats Modal */}
            {showCongrats && (
                <div className="fixed inset-0 z-5000 bg-black/60 flex items-center justify-center p-5 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white rounded-3xl p-8 w-full max-w-sm text-center shadow-2xl animate-zoom-in">
                        <div className="text-6xl mb-4">🏆</div>
                        <h3 className="text-2xl font-black text-slate-950 mb-2">코스 정복 완료!</h3>

                        {couponAwarded && couponMessage && (
                            <div className="mb-4 p-4 bg-linear-to-r from-yellow-50 to-amber-50 border-2 border-yellow-200 rounded-xl">
                                <div className="flex items-center justify-center gap-2 mb-2">
                                    <span className="text-2xl">🎁</span>
                                    <p className="text-sm font-bold text-amber-700">쿠폰 지급 완료!</p>
                                </div>
                                <p className="text-xs text-amber-600 font-medium">{couponMessage}</p>
                            </div>
                        )}

                        {!couponAwarded && (
                            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-xl">
                                <p className="text-xs text-blue-600 font-medium">
                                    💡 코스 5개 완료 시 쿠폰 1개를 받을 수 있어요!
                                </p>
                            </div>
                        )}

                        <p className="text-gray-500 mb-8">
                            오늘 데이트는 어떠셨나요?
                            <br />
                            소중한 후기를 남겨주세요.
                        </p>
                        <button
                            onClick={handleSubmit}
                            className="w-full py-4 text-white rounded-xl font-bold shadow-lg hover:opacity-90 hover:shadow-xl mb-3 transition-all"
                            style={{ backgroundColor: "#99c08e" }}
                        >
                            추억 저장하기
                        </button>
                        <button
                            onClick={() => {
                                router.prefetch("/");
                                router.push("/");
                            }}
                            className="w-full py-4 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200"
                        >
                            홈으로 가기
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
            {showSubscriptionModal && <TicketPlans onClose={() => setShowSubscriptionModal(false)} />}
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
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-3">사진이 부족해요</h2>
                        <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed mb-6">
                            나만의 추억을 저장하려면
                            <br />
                            최소 <span className="font-bold text-amber-600 dark:text-amber-400">3장 이상</span>의 사진이
                            필요합니다.
                            <br />
                            <br />
                            현재 <span className="font-bold">{currentPhotoCount}장</span>의 사진이 있습니다.
                        </p>

                        {/* 버튼 */}
                        <button
                            onClick={() => setShowPhotoCountModal(false)}
                            className="w-full py-4 text-white rounded-xl font-bold shadow-lg hover:opacity-90 hover:shadow-xl transition-all"
                            style={{ backgroundColor: "#99c08e" }}
                        >
                            확인
                        </button>
                    </div>
                </div>
            )}
            {/* 🟢 나만의 추억 한도 초과 하단 시트 (아래에서 위로 올라옴) */}
            {showMemoryLimitModal && (
                <>
                    <div
                        className="fixed inset-0 z-5000 bg-black/60 backdrop-blur-sm animate-fade-in"
                        onClick={() => setShowMemoryLimitModal(false)}
                        aria-hidden
                    />
                    <div className="fixed left-0 right-0 bottom-0 z-5001 w-full">
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
                                    둘만의 추억 창고가 가득 찼어요
                                </h2>
                                <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed mb-6">
                                    {memoryLimitMessage || "더 저장하려면 구독을 업그레이드해 주세요."}
                                </p>
                                <div className="flex flex-col gap-3">
                                    <button
                                        onClick={() => {
                                            setShowMemoryLimitModal(false);
                                            setShowSubscriptionModal(true);
                                        }}
                                        className="w-full py-4 text-white rounded-xl font-bold text-lg shadow-md hover:shadow-xl transition-all bg-linear-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 scale-100 hover:scale-[1.02] active:scale-95"
                                    >
                                        구독 업그레이드
                                    </button>
                                    <button
                                        onClick={() => setShowMemoryLimitModal(false)}
                                        className="w-full py-3 text-gray-600 dark:text-gray-400 font-medium rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                                    >
                                        닫기
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </>
            )}
            {/* 🟢 저장 성공 모달 */}
            {showSaveSuccessModal && (
                <div className="fixed inset-0 z-5000 bg-black/60 flex items-center justify-center p-5 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white dark:bg-[#1a241b] rounded-3xl p-6 pt-8 w-full max-w-sm text-center shadow-2xl animate-zoom-in">
                        {/* 폴라로이드 아이콘 */}
                        <MemorySavedIcon imageUrl={savedImageUrl} />

                        {/* 제목 및 설명 */}
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white">추억이 저장되었습니다!</h2>
                        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400 text-center leading-relaxed mb-6">
                            오늘의 소중한 한 장이
                            <br />
                            DoNa의 '{userName} 스토리'에 남았어요.
                        </p>

                        {couponAwarded && couponMessage && (
                            <div className="mb-4 p-4 bg-linear-to-r from-yellow-50 to-amber-50 dark:from-yellow-900/20 dark:to-amber-900/20 border-2 border-yellow-200 dark:border-yellow-800 rounded-xl">
                                <div className="flex items-center justify-center gap-2 mb-2">
                                    <span className="text-2xl">🎁</span>
                                    <p className="text-sm font-bold text-amber-700 dark:text-amber-400">
                                        쿠폰 {couponAmount}개 지급 완료!
                                    </p>
                                </div>
                                <p className="text-xs text-amber-600 dark:text-amber-300 font-medium">
                                    {couponMessage}
                                </p>
                            </div>
                        )}

                        {!couponAwarded && personalMemoryCount !== null && personalMemoryCount < 10 && (
                            <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl">
                                <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                                    💡 추억 {10 - personalMemoryCount}개를 더 완료하면 쿠폰 2개를 드려요!
                                </p>
                            </div>
                        )}

                        <p className="text-gray-600 dark:text-gray-400 mb-8">소중한 추억이 잘 저장되었어요!</p>
                        <button
                            onClick={() => {
                                setShowSaveSuccessModal(false);
                                router.push("/mypage");
                            }}
                            className="w-full py-4 text-white rounded-xl font-bold shadow-lg hover:opacity-90 hover:shadow-xl mb-3 transition-all"
                            style={{ backgroundColor: "#99c08e" }}
                        >
                            확인
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
