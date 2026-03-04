"use client";

import { useState, useEffect, useRef, useCallback, memo } from "react";
import { createPortal } from "react-dom";
import { apiFetch } from "@/lib/authClient";
import { useAuth } from "@/context/AuthContext";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import Image from "@/components/ImageFallback";
import PersonalizedSection from "@/components/PersonalizedSection";
import BenefitConsentModal from "@/components/BenefitConsentModal";
import MemoryCTA, { MemoryPreview } from "@/components/MemoryCTA";
import LoginModal from "@/components/LoginModal";
import TapFeedback from "@/components/TapFeedback";
import { X } from "lucide-react";

import { isIOS } from "@/lib/platform";
import TranslatedCourseTitle from "@/components/TranslatedCourseTitle";
import { useLocale } from "@/context/LocaleContext";
import { useAppLayout } from "@/context/AppLayoutContext";
import type { TranslationKeys } from "@/types/i18n";

// 🟢 섹션 메모이제이션 (렌더링 부하 감소)
const MemoizedPersonalizedSection = memo(PersonalizedSection);

// 🟢 [성능] 첫 페인트 후 실행 (LCP 방해 최소화, 계산 정확도 유지)
function runAfterPaint(fn: () => void) {
    if (typeof window === "undefined") return;
    if ("requestIdleCallback" in window) {
        (window as any).requestIdleCallback(fn, { timeout: 120 });
    } else {
        setTimeout(fn, 0);
    }
}

export default function HomeClient() {
    const { user, isAuthenticated, isLoading: isAuthLoading } = useAuth();
    const { t } = useLocale();
    const { containInPhone, modalContainerRef } = useAppLayout();
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
    const [hasMemories, setHasMemories] = useState(false);
    const [latestMemory, setLatestMemory] = useState<MemoryPreview | null>(null);
    const [memories, setMemories] = useState<MemoryPreview[]>([]);
    const [memoriesLoading, setMemoriesLoading] = useState(false);
    // 🟢 추억 모달 상태
    const [selectedMemory, setSelectedMemory] = useState<any | null>(null);
    const [showMemoryModal, setShowMemoryModal] = useState(false);
    const [currentImageIndex, setCurrentImageIndex] = useState(0);
    const memoryScrollRef = useRef<HTMLDivElement>(null);
    const memoryDragRef = useRef<{ isDragging: boolean; startX: number; lastX: number } | null>(null);
    const memoryJustDraggedRef = useRef(false);
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
    const pathname = usePathname();

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
                    setUserName(p?.user?.nickname ?? p?.nickname ?? t("commonFallback.dona"));
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

    // 🟢 모달이 열릴 때 첫 번째 사진으로 스크롤, 닫힐 때 드래그 상태 초기화
    useEffect(() => {
        if (showMemoryModal && memoryScrollRef.current) {
            setCurrentImageIndex(0);
            memoryScrollRef.current.scrollLeft = 0;
        } else {
            memoryDragRef.current = null;
        }
    }, [showMemoryModal]);

    // 🟢 웹: 클릭 후 드래그 방향에 따라 한 장씩 넘기기 (오른쪽 드래그=이전, 왼쪽 드래그=다음)
    const handleMemoryGalleryMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
        if (e.button !== 0) return; // 왼쪽 버튼만
        e.preventDefault();
        memoryDragRef.current = {
            isDragging: true,
            startX: e.clientX,
            lastX: e.clientX,
        };
    }, []);

    useEffect(() => {
        if (!showMemoryModal) return;
        const handleMove = (e: MouseEvent) => {
            const d = memoryDragRef.current;
            if (!d?.isDragging) return;
            d.lastX = e.clientX;
        };
        const handleUp = () => {
            const el = memoryScrollRef.current;
            const d = memoryDragRef.current;
            memoryDragRef.current = null;
            if (!el || !d?.isDragging) return;
            memoryJustDraggedRef.current = true;
            const itemWidth = el.clientWidth;
            const totalItems = Math.round(el.scrollWidth / itemWidth);
            const currentIndex = Math.round(el.scrollLeft / itemWidth);
            const delta = d.startX - d.lastX;
            const threshold = 20;
            let targetIndex = currentIndex;
            // 드래그 왼쪽 = 다음, 드래그 오른쪽 = 이전
            if (delta > threshold) targetIndex = currentIndex + 1;
            else if (delta < -threshold) targetIndex = currentIndex - 1;
            targetIndex = Math.max(0, Math.min(totalItems - 1, targetIndex));
            const targetLeft = targetIndex * itemWidth;
            const startLeft = el.scrollLeft;
            const duration = 280;
            const startTime = performance.now();
            const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;
            const animate = (now: number) => {
                const elapsed = now - startTime;
                const progress = Math.min(elapsed / duration, 1);
                el.scrollLeft = startLeft + (targetLeft - startLeft) * easeOutCubic(progress);
                if (progress < 1) requestAnimationFrame(animate);
            };
            requestAnimationFrame(animate);
        };
        document.addEventListener("mousemove", handleMove, true);
        document.addEventListener("mouseup", handleUp, true);
        return () => {
            document.removeEventListener("mousemove", handleMove, true);
            document.removeEventListener("mouseup", handleUp, true);
        };
    }, [showMemoryModal]);

    // 🟢 앱: 메인 '나만 아는 비밀 기록' 추억 상세(사진) 모달 열림/닫힘 시 네이티브에 전달 → 바닥 광고 숨김/표시
    useEffect(() => {
        if (typeof window === "undefined" || !(window as any).ReactNativeWebView) return;
        (window as any).ReactNativeWebView.postMessage(
            JSON.stringify({ type: showMemoryModal ? "memoryDetailOpen" : "memoryDetailClose" }),
        );
        return () => {
            (window as any).ReactNativeWebView?.postMessage?.(JSON.stringify({ type: "memoryDetailClose" }));
        };
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
                title: story.title || story.region || story.placeName || t("home.memoryFallback"),
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
    }, [isAuthenticated, t]);

    // 🟢 active-course 한 번 조회 후 정규화하여 state 설정
    const fetchActiveCourse = useCallback(async () => {
        try {
            const { data, response } = await apiFetch<{
                courseId: number;
                courseTitle: string;
                hasMemory: boolean;
                title?: string;
                imageUrl?: string | null;
            } | null>("/api/users/active-course", { cache: "no-store" });
            const raw = data as any;
            const valid =
                response.ok &&
                data &&
                typeof data === "object" &&
                Number(raw?.courseId) > 0;
            const normalized = valid && raw ? { ...raw, courseId: Number(raw.courseId) } : null;
            setActiveCourse(normalized);
            if (
                valid &&
                normalized &&
                !normalized.hasMemory &&
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
    }, []);

    // 🟢 activeCourse: 오늘 데이트 진행 중인 코스 - 첫 페인트 후 조회 (메인 체감 속도 개선)
    // 🟢 앱 WebView: 쿠키 지연 시 대비 재시도 항상 등록 (isMobileApp()이 늦게 true여도 재시도 동작)
    useEffect(() => {
        if (!isAuthenticated) {
            setActiveCourse(null);
            return;
        }
        runAfterPaint(fetchActiveCourse);
        const t1 = setTimeout(fetchActiveCourse, 1800);
        const t2 = setTimeout(fetchActiveCourse, 3500);
        const onLoginSuccess = () => setTimeout(fetchActiveCourse, 300);
        window.addEventListener("authLoginSuccess", onLoginSuccess);
        return () => {
            clearTimeout(t1);
            clearTimeout(t2);
            window.removeEventListener("authLoginSuccess", onLoginSuccess);
        };
    }, [isAuthenticated, pathname, fetchActiveCourse]);

    // 🟢 앱에서 onLoadEnd 후 donaAppReady 오면 진행 중 코스 다시 조회 (이어가기 배너)
    useEffect(() => {
        const onReady = () => {
            if (isAuthenticated) fetchActiveCourse();
        };
        window.addEventListener("donaAppReady", onReady);
        return () => window.removeEventListener("donaAppReady", onReady);
    }, [isAuthenticated, fetchActiveCourse]);

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

    // 🟢 개인 추억 데이터 로드 - 첫 페인트 후 조회 (정확도 동일)
    useEffect(() => {
        runAfterPaint(fetchPersonalMemories);
    }, [fetchPersonalMemories]);

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
                            {t("home.memoryReminder.title", { course: activeCourse.courseTitle })}
                        </p>
                        <p className="text-center text-gray-500 dark:text-gray-400 text-sm mb-6">
                            {t("home.memoryReminder.subtitle")}
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowMemoryReminderModal(false)}
                                className="flex-1 py-3 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 font-medium"
                            >
                                {t("home.memoryReminder.later")}
                            </button>
                            <button
                                onClick={() => {
                                    setShowMemoryReminderModal(false);
                                    router.push(`/courses/${activeCourse.courseId}/start`);
                                }}
                                className="flex-1 py-3 rounded-xl bg-[#99c08e] text-white font-bold"
                            >
                                {t("home.memoryReminder.goTo")}
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {showLoginModal && (
                <LoginModal
                    onClose={() => setShowLoginModal(false)}
                    next="/mypage?tab=footprint&view=memories"
                    preset="saveRecord"
                />
            )}

            <main className="">
                {/* 🟢 오늘 데이트 진행 중 배너 - 나만의 추억 저장 완료 시 숨김 */}
                {/* 🟢 나만의 추억 있어도 메인에 이어가기 배너 표시 */}
                {activeCourse && (
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
                                    {t("home.activeCourse.todayDate")}
                                </span>
                                <h3 className="text-base font-semibold text-slate-900 dark:text-white mt-0.5 line-clamp-2 leading-snug">
                                    <TranslatedCourseTitle title={activeCourse.title ?? activeCourse.courseTitle} />
                                </h3>
                                <div className="mt-3 flex items-center justify-between gap-2">
                                    <span className="text-xs text-slate-400 dark:text-slate-500">{t("home.activeCourse.inProgress")}</span>
                                    <TapFeedback>
                                        <button
                                            onClick={() => router.push(`/courses/${activeCourse.courseId}`)}
                                            className="flex items-center gap-1 px-3 py-1.5 bg-[#7FCC9F] hover:bg-[#6bb88a] text-white text-xs font-bold rounded-2xl transition-colors active:scale-95 shrink-0"
                                        >
                                            {t("home.activeCourse.continue")}
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

            {/* 🟢 추억 상세 모달: 웹에서는 폰 내부로 포탈하여 폰 안에서 표시 */}
            {showMemoryModal &&
                selectedMemory &&
                typeof document !== "undefined" &&
                (() => {
                    const posClass = containInPhone ? "absolute" : "fixed";
                    const portalTarget =
                        containInPhone && modalContainerRef?.current ? modalContainerRef.current : document.body;
                    const modalContent = (
                        <div
                            className={`${posClass} inset-0 z-5000 bg-black dark:bg-black flex flex-col animate-in fade-in duration-300`}
                            onClick={() => {
                                if (memoryJustDraggedRef.current) {
                                    memoryJustDraggedRef.current = false;
                                }
                            }}
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
                            className="flex overflow-x-auto snap-x snap-mandatory scrollbar-hide select-none cursor-grab"
                            style={{
                                height: "calc(100vh - 120px)",
                                marginTop: "60px",
                                marginBottom: "60px",
                                WebkitOverflowScrolling: "touch",
                                scrollBehavior: "smooth",
                            }}
                            onMouseDown={handleMemoryGalleryMouseDown}
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
                                                              alt={t("home.memoryPhotoAlt", { n: currentIdx + 1 })}
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
                                                  alt={t("home.memoryPhotoAlt", { n: idx + 1 })}
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
                                const dayKey = `home.dayOfWeek.${date.getDay()}` as TranslationKeys;
                                const dayOfWeek = t(dayKey);
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
                    );
                    return createPortal(modalContent, portalTarget);
                })()}
        </>
    );
}
