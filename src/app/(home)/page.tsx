// src/app/page.tsx
"use client";

import { useState, useEffect, useRef } from "react";
import { fetchWeekStamps, getLocalTodayKey, postCheckin } from "@/lib/checkinClient";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "@/components/ImageFallback";
import HeroSlider from "@/components/HeroSlider";
import OnboardingSection from "@/components/OnboardingSection";
import CompletionModal from "@/components/CompletionModal";
import PersonalizedSection from "@/components/PersonalizedSection";

// [변경] 기존 onboardingData에서 필요한 데이터만 가져옵니다.
import { CATEGORY_ICONS, CONCEPTS } from "@/constants/onboardingData";

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
};

export default function Home() {
    const [courses, setCourses] = useState<Course[]>([]);
    const [heroCourses, setHeroCourses] = useState<Course[]>([]);
    const [allTags, setAllTags] = useState<Array<{ id: number; name: string }>>([]);
    const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);
    const [query, setQuery] = useState("");
    const [searchNonce, setSearchNonce] = useState(0);
    const [, setLoading] = useState(true);
    const [showWelcome, setShowWelcome] = useState(false);
    const [showLoginModal, setShowLoginModal] = useState(false);
    const [showAdModal, setShowAdModal] = useState(false);
    const [isSignup, setIsSignup] = useState(false);
    const [showLoginRequiredModal, setShowLoginRequiredModal] = useState(false);
    const [showCheckinModal, setShowCheckinModal] = useState(false);
    const [showRewardModal, setShowRewardModal] = useState(false);
    const [weekStamps, setWeekStamps] = useState<boolean[]>([false, false, false, false, false, false, false]);
    const [animStamps, setAnimStamps] = useState<boolean[] | null>(null);
    const [isStamping, setIsStamping] = useState(false);
    const [stampCompleted, setStampCompleted] = useState(false);
    const [alreadyToday, setAlreadyToday] = useState(false);
    const [cycleProgress, setCycleProgress] = useState(0);
    const [streak, setStreak] = useState<number>(0);
    const [userId, setUserId] = useState<number | null>(null);
    const [userName, setUserName] = useState<string>("");
    const [isOnboardingComplete, setIsOnboardingComplete] = useState<boolean>(false);

    const router = useRouter();
    const hasShownCheckinModalRef = useRef(false);

    useEffect(() => {
        window.scrollTo(0, 0);
    }, []);

    // 출석 스트릭 및 userId 조회, 선호도 확인
    useEffect(() => {
        (async () => {
            try {
                const token = localStorage.getItem("authToken");
                if (!token) return;

                const [profileRes, checkinRes, preferencesRes] = await Promise.all([
                    fetch("/api/users/profile", { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" }),
                    fetch("/api/users/checkins", { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" }),
                    fetch("/api/users/preferences", {
                        headers: { Authorization: `Bearer ${token}` },
                        cache: "no-store",
                    }),
                ]);
                if (profileRes.ok) {
                    const p = await profileRes.json().catch(() => ({}));
                    const id =
                        Number(p?.user?.id ?? p?.id ?? p?.userId ?? p?.user_id) &&
                        Number.isFinite(Number(p?.user?.id ?? p?.id ?? p?.userId ?? p?.user_id))
                            ? Number(p?.user?.id ?? p?.id ?? p?.userId ?? p?.user_id)
                            : null;
                    if (id) setUserId(id);
                    const name = p?.user?.nickname ?? p?.nickname ?? "두나";
                    setUserName(name);
                }
                if (checkinRes.ok) {
                    const c = await checkinRes.json().catch(() => ({}));
                    if (Number.isFinite(Number(c?.streak))) setStreak(Number(c.streak));
                }
                if (preferencesRes.ok) {
                    const prefs = await preferencesRes.json().catch(() => ({}));
                    const prefData = prefs?.preferences ?? prefs ?? {};
                    const s1 = localStorage.getItem("onboardingStep1") === "1";
                    const s2 = localStorage.getItem("onboardingStep2") === "1";
                    const s3 = localStorage.getItem("onboardingStep3") === "1";
                    const doneFlag = localStorage.getItem("onboardingComplete") === "1";
                    const step1 =
                        s1 ||
                        (Array.isArray(prefData?.mood) && prefData.mood.length > 0) ||
                        (Array.isArray(prefData?.concept) && prefData.concept.length > 0);
                    const step2 = s2;
                    const step3 = s3 || (typeof prefData?.companion === "string" && prefData.companion !== "");
                    setIsOnboardingComplete(doneFlag || (step1 && step2 && step3));
                }
            } catch {}
        })();
    }, []);

    const sendAttendancePush = async () => {
        try {
            if (!userId) {
                setErrorMessage("사용자 정보를 불러오지 못했습니다. 다시 시도해 주세요.");
                return;
            }
            await fetch("/api/push/send", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    userId,
                    title: "출석 체크 알림",
                    body: "오늘도 새싹 도장 찍고 보상 받아가세요!",
                    data: { screen: "mypage", tab: "checkins" },
                }),
            });
        } catch {
            setErrorMessage("알림 전송에 실패했습니다.");
        }
    };

    // 태그 목록 불러오기
    useEffect(() => {
        const idle = (cb: () => void) =>
            "requestIdleCallback" in window
                ? (window as any).requestIdleCallback(cb, { timeout: 1200 })
                : setTimeout(cb, 1);
        idle(() => {
            (async () => {
                try {
                    const res = await fetch("/api/course-tags", { cache: "no-store" });
                    const data = await res.json().catch(() => ({}));
                    if (data?.success && Array.isArray(data.tags)) setAllTags(data.tags);
                } catch {}
            })();
        });
    }, []);

    const buildCourseListUrl = () => {
        const params = new URLSearchParams();
        params.set("limit", "30");
        params.set("imagePolicy", "any");
        const qTrim = query.trim();
        if (qTrim) params.set("q", qTrim);
        if (selectedTagIds.length > 0) params.set("tagIds", selectedTagIds.join(","));
        return `/api/courses?${params.toString()}`;
    };

    useEffect(() => {
        const fetchCourses = async () => {
            try {
                const response = await fetch(buildCourseListUrl() as any, {
                    cache: "force-cache",
                    next: { revalidate: 300 },
                });
                if (!response.ok) {
                    setCourses([]);
                    return;
                }
                const data = await response.json().catch(() => null);
                setCourses(
                    Array.isArray(data) ? data : Array.isArray((data as any)?.courses) ? (data as any).courses : []
                );
            } catch {
                setCourses([]);
            } finally {
                setLoading(false);
            }
        };
        fetchCourses();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedTagIds.join(","), searchNonce]);

    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const welcome = urlParams.get("welcome");
        const loginSuccess = urlParams.get("login_success");
        const signupSuccess = urlParams.get("signup_success");

        // 1. 단순 웰컴 메시지 (기존 유지)
        if (welcome === "true") {
            setShowWelcome(true);
            const newUrl = window.location.pathname;
            window.history.replaceState({}, "", newUrl);
            setTimeout(() => setShowWelcome(false), 3000);
        }

        // 2. 로그인 성공 (✅ 여기를 수정했습니다)
        if (loginSuccess === "true") {
            // 🚨 수정 포인트: 로그인했으니 로그인 창은 끄고(false), 환영 배너를 켭니다(true)
            setShowLoginModal(false);
            setShowWelcome(true);

            maybeOpenCheckinModal(); // 출석체크 모달은 유지

            // 토큰 이벤트 발생 (기존 유지)
            const token = localStorage.getItem("authToken");
            if (token) {
                window.dispatchEvent(new CustomEvent("authTokenChange", { detail: { token } }));
            } else {
                window.dispatchEvent(new CustomEvent("authTokenChange"));
            }

            // URL 세탁 (기존 유지)
            const newUrl = window.location.pathname;
            window.history.replaceState({}, "", newUrl);

            // ✨ 추가: 3초 뒤에 환영 배너 자동으로 끄기
            setTimeout(() => setShowWelcome(false), 3000);
        }

        // 3. 회원가입 성공 (기존 유지)
        if (signupSuccess === "true") {
            // 💡 팁: 만약 회원가입 후 바로 로그인이 된 상태라면 여기도 false로 바꾸는 게 좋습니다.
            // 일단은 기존 코드대로 true(모달 띄움)로 두었습니다.
            setShowLoginModal(true);
            setIsSignup(true);
            localStorage.setItem("loginTime", Date.now().toString());
            maybeOpenCheckinModal();
            const newUrl = window.location.pathname;
            window.history.replaceState({}, "", newUrl);
        }
    }, []);

    useEffect(() => {
        const handleAuthChange = (event: Event) => {
            const customEvent = event as CustomEvent;
            const token = customEvent.detail?.token || localStorage.getItem("authToken");
            if (token) {
                setTimeout(() => {
                    maybeOpenCheckinModal();
                }, 500);
            }
        };
        window.addEventListener("authTokenChange", handleAuthChange as EventListener);
        return () => window.removeEventListener("authTokenChange", handleAuthChange as EventListener);
    }, []);

    const fetchAndSetWeekStamps = async (): Promise<{
        stamps: boolean[];
        todayChecked: boolean;
        todayIndex?: number | null;
        streak?: number;
        weekCount?: number;
    } | null> => {
        const result = await fetchWeekStamps();
        if (!result) return null;
        const { stamps, todayChecked } = result as any;
        setWeekStamps(stamps);
        setCycleProgress((stamps.filter(Boolean).length % 7) as number);
        setAlreadyToday(todayChecked);
        if (typeof (result as any).streak === "number") setStreak(Number((result as any).streak));
        return result as any;
    };

    const maybeOpenCheckinModal = async () => {
        try {
            const token = localStorage.getItem("authToken");
            if (!token) return;

            const result = await fetchAndSetWeekStamps();
            if (!result) return;

            const already = Boolean(result.todayChecked);
            setAnimStamps(null);

            if (!already) {
                try {
                    const token2 = localStorage.getItem("authToken");
                    const res = await fetch("/api/users/checkins", {
                        headers: token2 ? { Authorization: `Bearer ${token2}` } : {},
                        cache: "no-store",
                    });
                    if (res.ok) {
                        const d = await res.json().catch(() => ({}));
                        if (Number.isFinite(Number(d?.streak))) {
                            setStreak(Number(d.streak));
                        }
                    }
                } catch {}

                try {
                    const expected = Math.min(7, Number(result?.streak || 0));
                    const tIdx = typeof result?.todayIndex === "number" ? (result?.todayIndex as number) : null;
                    if (expected > 0 && tIdx !== null) {
                        const currentTrue = (result?.stamps || []).filter(Boolean).length;
                        if (currentTrue < expected) {
                            if (tIdx === 0) {
                                const pre = new Array(7).fill(false);
                                for (let i = 0; i < Math.min(7, expected); i++) pre[i] = true;
                                setWeekStamps(pre);
                            } else {
                                const pre = (result?.stamps || new Array(7).fill(false)).slice(0, 7);
                                const start = Math.max(0, tIdx - expected);
                                const end = Math.max(-1, tIdx - 1);
                                for (let i = start; i <= end; i++) pre[i] = true;
                                setWeekStamps(pre);
                            }
                        }
                    } else if (expected > 0) {
                        const currentTrue = (result?.stamps || []).filter(Boolean).length;
                        if (currentTrue < expected) {
                            const fillCount = Math.max(0, Math.min(6, expected - 1));
                            const pre = new Array(7).fill(false);
                            for (let i = 0; i < fillCount; i++) pre[i] = true;
                            setWeekStamps(pre);
                        }
                    }
                } catch {}
                setStampCompleted(false);
                setShowCheckinModal(true);
                hasShownCheckinModalRef.current = true;
            }
        } catch (e) {
            console.error("출석체크 모달 오픈 실패:", e);
        }
    };

    useEffect(() => {
        const initAuth = async () => {
            const token = localStorage.getItem("authToken");
            if (!token) return;
            try {
                const res = await fetch("/api/users/profile", {
                    credentials: "include",
                    headers: { Authorization: `Bearer ${token}` },
                });
                if (res.ok) {
                    setTimeout(() => {
                        maybeOpenCheckinModal();
                    }, 800);
                } else if (res.status === 401) {
                    localStorage.removeItem("authToken");
                }
            } catch {
                localStorage.removeItem("authToken");
            }
        };
        initAuth();

        const handleFocus = () => {
            const token = localStorage.getItem("authToken");
            if (token) {
                setTimeout(() => {
                    maybeOpenCheckinModal();
                }, 300);
            }
        };
        window.addEventListener("focus", handleFocus);
        return () => {
            window.removeEventListener("focus", handleFocus);
        };
    }, []);

    useEffect(() => {
        const token = localStorage.getItem("authToken");
        if (token) {
            maybeOpenCheckinModal();
        }
    }, []);

    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    // HeroSlider용 별도 데이터 로드 및 3일 로테이션 로직
    useEffect(() => {
        const fetchHeroData = async () => {
            try {
                // FREE 코스를 충분히 확보하기 위해 limit=100으로 별도 요청
                const res = await fetch("/api/courses?limit=100&imagePolicy=any");
                if (!res.ok) {
                    console.error("Hero data fetch failed:", res.status);
                    // courses 상태에서 데이터 가져오기 시도
                    if (courses.length > 0) {
                        const processed = courses.slice(0, 5).map((c: any) => ({
                            ...c,
                            imageUrl: c.imageUrl || c.coursePlaces?.[0]?.place?.imageUrl || "",
                        }));
                        setHeroCourses(processed);
                    }
                    return;
                }

                const data = await res.json();
                const allCourses = Array.isArray(data) ? data : data.courses || [];

                // 1. FREE 등급 코스만 필터링
                const freeCourses = allCourses.filter((c: any) => c.grade === "FREE");
                // FREE가 없으면 전체 사용
                const targetCourses = freeCourses.length > 0 ? freeCourses : allCourses;

                // 이미지 폴백 처리
                const processed = targetCourses.map((c: any) => ({
                    ...c,
                    imageUrl: c.imageUrl || c.coursePlaces?.[0]?.place?.imageUrl || "",
                }));

                // 2. 3일 주기 인덱스 계산
                const threeDayEpoch = Math.floor(Date.now() / 259200000);

                // 3. 로테이션 및 선택 (5개)
                const count = processed.length;
                const selected: Course[] = [];
                if (count > 0) {
                    const startIndex = threeDayEpoch % count;
                    for (let i = 0; i < 5; i++) {
                        selected.push(processed[(startIndex + i) % count]);
                    }
                }
                setHeroCourses(selected);
            } catch (error) {
                console.error("Hero data fetch error:", error);
                // 에러 발생 시 courses 상태에서 데이터 가져오기 시도
                if (courses.length > 0) {
                    const processed = courses.slice(0, 5).map((c: any) => ({
                        ...c,
                        imageUrl: c.imageUrl || c.coursePlaces?.[0]?.place?.imageUrl || "",
                    }));
                    setHeroCourses(processed);
                }
            }
        };

        fetchHeroData();
    }, []); // 마운트 시 한 번만 실행 (courses 상태와 무관하게 동작)

    const topCourses = courses.slice(0, 5);
    const hotCourses = courses
        .slice()
        .sort(
            (a, b) =>
                ((b.view_count ?? (b as any).viewCount ?? 0) as number) -
                ((a.view_count ?? (a as any).viewCount ?? 0) as number)
        )
        .slice(0, 8);
    const newCourses = courses
        .slice()
        .sort((a, b) => {
            const ad = (a as any).createdAt ? new Date((a as any).createdAt).getTime() : 0;
            const bd = (b as any).createdAt ? new Date((b as any).createdAt).getTime() : 0;
            return bd - ad;
        })
        .slice(0, 8);

    const [recs, setRecs] = useState<any[]>([]);
    const [isLoadingRecs, setIsLoadingRecs] = useState(true);
    const [isLoggedInForRecs, setIsLoggedInForRecs] = useState(false);

    const fetchRecommendations = async () => {
        try {
            setIsLoadingRecs(true);
            const token = localStorage.getItem("authToken");
            setIsLoggedInForRecs(!!token);
            const res = await fetch("/api/recommendations", {
                cache: "no-store",
                headers: token ? { Authorization: `Bearer ${token}` } : {},
            });
            const data = await res.json().catch(() => ({}));
            if (Array.isArray(data?.recommendations)) {
                setRecs(data.recommendations);
            } else {
                setRecs([]);
            }
        } catch {
            setRecs([]);
        } finally {
            setIsLoadingRecs(false);
        }
    };

    useEffect(() => {
        const idle = (cb: () => void) =>
            "requestIdleCallback" in window
                ? (window as any).requestIdleCallback(cb, { timeout: 1200 })
                : setTimeout(cb, 1);
        idle(() => {
            fetchRecommendations();
        });
    }, []);

    useEffect(() => {
        const handleAuthChange = () => {
            fetchRecommendations();
        };
        window.addEventListener("authTokenChange", handleAuthChange as EventListener);
        return () => window.removeEventListener("authTokenChange", handleAuthChange as EventListener);
    }, []);

    useEffect(() => {
        const onCheckinUpdated = (e: Event) => {
            const d = (e as CustomEvent).detail || {};
            if (Array.isArray(d.weekStamps)) setWeekStamps(d.weekStamps as boolean[]);
            if (typeof d.streak === "number") setStreak(Number(d.streak));
            if (d.todayChecked) setAlreadyToday(true);
        };
        window.addEventListener("checkinUpdated", onCheckinUpdated as EventListener);
        return () => window.removeEventListener("checkinUpdated", onCheckinUpdated as EventListener);
    }, []);

    useEffect(() => {
        try {
            (window as any).previewCheckinToast = () => {
                setShowRewardModal(true);
            };
            const params = new URLSearchParams(window.location.search);
            if (params.get("toast") === "checkin7") {
                setShowRewardModal(true);
                const clean = window.location.pathname;
                window.history.replaceState({}, "", clean);
            }
        } catch {}
    }, []);

    const handleStartOnboarding = () => {
        if (!localStorage.getItem("authToken")) {
            setShowLoginRequiredModal(true);
            return;
        }
        router.push("/onboarding");
    };

    return (
        <>
            {errorMessage && (
                <div className="mx-4 my-3 rounded-xl bg-red-50 border border-red-200 text-red-800 p-4">
                    <div className="flex items-start gap-2">
                        <span>⚠️</span>
                        <div className="flex-1 text-sm">{errorMessage}</div>
                        <button
                            onClick={() => setErrorMessage(null)}
                            className="text-red-700/70 hover:text-red-900"
                            aria-label="닫기"
                        >
                            ✕
                        </button>
                    </div>
                </div>
            )}
            {successMessage && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl p-6 w-full max-w-sm text-center">
                        <div className="text-5xl mb-2">🎉</div>
                        <h3 className="text-lg font-bold text-gray-900 mb-2">축하합니다!</h3>
                        <p className="text-gray-700 mb-4">{successMessage}</p>
                        <div className="flex justify-center">
                            <button
                                onClick={() => setSuccessMessage(null)}
                                className="hover:cursor-pointer px-6 py-2 rounded-lg bg-gradient-to-r from-green-500 to-emerald-500 text-white font-semibold hover:from-green-600 hover:to-emerald-600"
                            >
                                확인
                            </button>
                        </div>
                    </div>
                </div>
            )}
            <CompletionModal isOpen={showRewardModal} onClose={() => setShowRewardModal(false)} />
            {showWelcome && (
                <div className="fixed top-20 left-1/2 transform -translate-x-1/2 z-50 bg-gradient-to-r from-green-500 to-emerald-500 text-white px-6 py-3 rounded-lg shadow-lg animate-fade-in hover:cursor-pointer">
                    <div className="flex items-center space-x-2">
                        <span className="text-xl">🌿</span>
                        <span className="font-semibold">카카오 로그인에 성공했습니다!</span>
                    </div>
                </div>
            )}
            {showLoginModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-2xl p-8 max-w-md mx-4 text-center animate-fade-in relative">
                        <button
                            onClick={() => setShowLoginModal(false)}
                            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
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
                        <div className="text-6xl mb-4">🌿</div>
                        <h2 className="text-2xl font-bold text-gray-900 mb-2">로그인 성공!</h2>
                        <p className="text-gray-600 mb-4">두나에 오신 것을 환영합니다</p>
                        <div className="flex items-center justify-center space-x-2 text-green-600">
                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                <path
                                    fillRule="evenodd"
                                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                                    clipRule="evenodd"
                                />
                            </svg>
                            <span className="font-semibold">환영합니다!</span>
                        </div>
                        <button
                            onClick={() => {
                                setShowLoginModal(false);
                                window.dispatchEvent(new CustomEvent("authTokenChange"));
                                if (isSignup) {
                                    setShowAdModal(true);
                                }
                                maybeOpenCheckinModal();
                            }}
                            className="mt-6 bg-gradient-to-r from-green-500 to-emerald-500 text-white px-6 py-2.5 rounded-lg font-semibold hover:from-green-600 hover:to-emerald-600 transition-all hover:cursor-pointer"
                        >
                            확인
                        </button>
                    </div>
                </div>
            )}
            {showAdModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 ">
                    <div className="bg-white rounded-2xl p-6 max-w-md mx-4 text-center animate-fade-in relative">
                        <button
                            onClick={() => setShowAdModal(false)}
                            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors hover:cursor-pointer"
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
                        <div className="text-4xl mb-4">🌳</div>
                        <h2 className="text-xl font-bold text-gray-900 mb-2">AI 추천 티켓 지급!</h2>
                        <p className="text-gray-600 mb-4">새로 가입하신 고객님을 위한 특별한 혜택</p>
                        <div className="bg-gradient-to-r from-green-500 to-emerald-500 text-white p-4 rounded-lg mb-4">
                            <div className="text-2xl font-bold mb-1">AI 추천 티켓 1회</div>
                            <div className="text-sm opacity-90">개인 맞춤 코스 추천을 받아보세요!</div>
                        </div>
                        <button
                            onClick={() => setShowAdModal(false)}
                            className="bg-gradient-to-r from-green-500 to-emerald-500 text-white px-6 py-2.5 rounded-lg font-semibold hover:from-green-600 hover:to-emerald-600 transition-all hover:cursor-pointer w-full"
                        >
                            확인
                        </button>
                    </div>
                </div>
            )}
            {showLoginRequiredModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-2xl p-6 max-w-md mx-4 text-center animate-fade-in relative">
                        <button
                            onClick={() => setShowLoginRequiredModal(false)}
                            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors hover:cursor-pointer"
                            aria-label="닫기"
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
                        <div className="text-4xl mb-3">🔐</div>
                        <h2 className="text-xl font-bold text-gray-900 mb-2">로그인이 필요합니다</h2>
                        <p className="text-gray-600 mb-5">내 취향을 설정하려면 먼저 로그인해 주세요.</p>
                        <div className="flex gap-3 justify-center">
                            <button
                                onClick={() => setShowLoginRequiredModal(false)}
                                className="hover:cursor-pointer px-5 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium transition-colors"
                            >
                                취소
                            </button>
                            <button
                                onClick={() => {
                                    setShowLoginRequiredModal(false);
                                    router.push("/login?redirect=/onboarding");
                                }}
                                className="hover:cursor-pointer bg-gradient-to-r from-green-500 to-emerald-500 text-white px-5 py-2.5 rounded-lg font-semibold hover:from-green-600 hover:to-emerald-600 transition-all"
                            >
                                로그인하기
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {showCheckinModal && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl p-6 w-full max-w-sm text-center">
                        <h3 className="text-lg font-bold text-gray-900 mb-2">출석 체크</h3>
                        <p className="text-gray-600 mb-1">이번 주 출석 현황</p>
                        {streak > 0 && (
                            <p className="text-sm text-emerald-700 mb-2 font-semibold">🔥 {streak}일 연속 출석 중</p>
                        )}
                        {alreadyToday && <p className="text-sm text-green-600 mb-3">오늘 이미 출석했습니다</p>}
                        <div className="grid grid-cols-7 gap-2 mb-4">
                            {new Array(7).fill(0).map((_, i) => {
                                const stamped = (weekStamps[i] || (!!animStamps && !!animStamps[i])) as boolean;
                                const pulse = !!animStamps && !!animStamps[i];
                                return (
                                    <div key={i} className="flex flex-col items-center gap-1">
                                        <span
                                            className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-transform duration-150 ${
                                                stamped
                                                    ? "bg-gradient-to-br from-lime-400 to-green-500 text-white"
                                                    : "bg-gray-200 text-gray-600"
                                            } ${pulse ? "scale-110" : ""}`}
                                        >
                                            {stamped ? "🌱" : String(i + 1)}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                        <div className="flex gap-3 justify-center">
                            {!stampCompleted && !alreadyToday ? (
                                <>
                                    <button
                                        onClick={() => {
                                            setShowCheckinModal(false);
                                        }}
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
                                                if (data.alreadyChecked) {
                                                    if (Array.isArray(data.weekStamps))
                                                        setWeekStamps(data.weekStamps as boolean[]);
                                                    if (typeof data.weekCount === "number")
                                                        setCycleProgress(((data.weekCount as number) % 7) as number);
                                                    setAlreadyToday(true);
                                                    setIsStamping(false);
                                                    setStampCompleted(true);
                                                    const todayKey = getLocalTodayKey();
                                                    localStorage.setItem("checkinModalDismissedDate", todayKey);
                                                    localStorage.setItem(`checkinButtonPressed_${todayKey}`, "true");
                                                    return;
                                                }
                                                if (typeof data.weekCount === "number") {
                                                    setCycleProgress((data.weekCount % 7) as number);
                                                }
                                                if (typeof (data as any).streak === "number") {
                                                    setStreak((data as any).streak);
                                                    try {
                                                        window.dispatchEvent(
                                                            new CustomEvent("checkinUpdated", {
                                                                detail: {
                                                                    streak: (data as any).streak,
                                                                    weekStamps: data.weekStamps,
                                                                    todayChecked: false,
                                                                },
                                                            })
                                                        );
                                                    } catch {}
                                                }

                                                const targetIdx =
                                                    typeof data.todayIndex === "number" ? data.todayIndex : null;

                                                if (targetIdx === null) {
                                                    if (Array.isArray(data.weekStamps)) {
                                                        setWeekStamps(data.weekStamps as boolean[]);
                                                    }
                                                    setIsStamping(false);
                                                    setStampCompleted(true);
                                                    const todayKey = getLocalTodayKey();
                                                    localStorage.setItem(`checkinButtonPressed_${todayKey}`, "true");
                                                    try {
                                                        window.dispatchEvent(
                                                            new CustomEvent("checkinUpdated", {
                                                                detail: {
                                                                    streak: (data as any).streak,
                                                                    weekStamps: data.weekStamps,
                                                                    todayChecked: true,
                                                                },
                                                            })
                                                        );
                                                    } catch {}
                                                    if (data.awarded) {
                                                        setShowRewardModal(true);
                                                    }
                                                    return;
                                                }

                                                if (Array.isArray(data.weekStamps)) {
                                                    const serverStamps = (data.weekStamps as boolean[]).slice(0, 7);
                                                    if (targetIdx >= 0 && targetIdx < serverStamps.length) {
                                                        const preStamps = serverStamps.slice();
                                                        preStamps[targetIdx] = false;
                                                        setWeekStamps(preStamps);
                                                    } else {
                                                        setWeekStamps(serverStamps);
                                                    }
                                                }

                                                setAnimStamps([false, false, false, false, false, false, false]);
                                                setTimeout(() => {
                                                    setAnimStamps((_) => {
                                                        const next = [false, false, false, false, false, false, false];
                                                        next[targetIdx] = true;
                                                        return next;
                                                    });
                                                    setTimeout(() => {
                                                        if (Array.isArray(data.weekStamps)) {
                                                            setWeekStamps(data.weekStamps as boolean[]);
                                                        }
                                                        setAnimStamps(null);
                                                        setIsStamping(false);
                                                        setStampCompleted(true);
                                                        const todayKey = getLocalTodayKey();
                                                        localStorage.setItem(
                                                            `checkinButtonPressed_${todayKey}`,
                                                            "true"
                                                        );
                                                        try {
                                                            window.dispatchEvent(
                                                                new CustomEvent("checkinUpdated", {
                                                                    detail: {
                                                                        streak: (data as any).streak,
                                                                        weekStamps: data.weekStamps,
                                                                        todayChecked: true,
                                                                    },
                                                                })
                                                            );
                                                        } catch {}
                                                        if (data.awarded) {
                                                            setShowRewardModal(true);
                                                        }
                                                    }, 800);
                                                }, 50);
                                            } catch {
                                                setIsStamping(false);
                                            }
                                        }}
                                        className={`px-4 py-2 rounded-lg text-white font-semibold ${
                                            isStamping
                                                ? "bg-gray-400"
                                                : "bg-gradient-to-r from-lime-400 to-green-500 hover:from-lime-500 hover:to-green-600"
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
                                    className="hover:cursor-pointer px-6 py-2 rounded-lg bg-gradient-to-r from-green-500 to-emerald-500 text-white font-semibold hover:from-green-600 hover:to-emerald-600"
                                >
                                    확인
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            <>
                {heroCourses.length > 0 && (
                    <div className="pt-4">
                        <HeroSlider
                            items={heroCourses.map((c) => {
                                const displayConcept = CONCEPTS[c.concept as keyof typeof CONCEPTS] || c.concept;

                                // 3. 명시적으로 return을 해줍니다.
                                return {
                                    id: String(c.id),
                                    title: c.title,
                                    imageUrl: c.imageUrl,
                                    location: c.location || c.region || "",
                                    concept: displayConcept,
                                    tags: c.tags || [],
                                };
                            })}
                        />
                    </div>
                )}

                {/* 탭 메뉴 (개선된 TabbedConcepts) */}
                <TabbedConcepts courses={courses} hotCourses={hotCourses} newCourses={newCourses} />

                {/* 출석 위젯 */}
                <section className="py-6">
                    <div className="max-w-7xl mx-auto px-4">
                        <div className="bg-gradient-to-r from-emerald-50 to-green-50 border border-emerald-100 rounded-2xl px-4 py-3 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <button
                                    aria-label="출석 탭으로 이동"
                                    onClick={async () => {
                                        const todayKey = getLocalTodayKey();
                                        const checkinButtonPressed =
                                            localStorage.getItem(`checkinButtonPressed_${todayKey}`) === "true";
                                        const shownDate = localStorage.getItem("checkinModalShownDate");
                                        const result = await fetchAndSetWeekStamps();
                                        const already = Boolean(result?.todayChecked);

                                        if (checkinButtonPressed) {
                                            router.push("/mypage?tab=checkins");
                                            return;
                                        }

                                        if (shownDate === todayKey && showCheckinModal === false) {
                                            router.push("/mypage?tab=checkins");
                                            return;
                                        }

                                        if (!already || (already && !checkinButtonPressed)) {
                                            setShowCheckinModal(true);
                                            hasShownCheckinModalRef.current = true;
                                            localStorage.setItem("checkinModalShownDate", todayKey);
                                        } else {
                                            router.push("/mypage?tab=checkins");
                                        }
                                    }}
                                    className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-2xl hover:shadow cursor-pointer"
                                    title="출석 탭으로 이동"
                                >
                                    🌱
                                </button>
                                <div>
                                    <div className="text-sm text-gray-600">출석 현황</div>
                                    <div className="text-base md:text-lg font-bold text-gray-900">
                                        {streak >= 5
                                            ? `🔥 ${streak}일 연속 출석 중!`
                                            : streak > 0
                                            ? `${streak}일 연속 출석 중`
                                            : "오늘도 새싹 도장 찍어보세요!"}
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={sendAttendancePush}
                                    className="w-10 h-10 rounded-full bg-white border border-emerald-200 text-emerald-700 hover:bg-emerald-50 cursor-pointer flex items-center justify-center"
                                    title="출석 알림 푸시 보내기"
                                    aria-label="출석 알림 푸시"
                                >
                                    🔔
                                </button>
                            </div>
                        </div>
                    </div>
                </section>

                <PersonalizedSection />

                {!isOnboardingComplete && <OnboardingSection onStart={handleStartOnboarding} />}
            </>
        </>
    );
}

// --------------------------------------------------------
// [TabbedConcepts] : onboardingData 재사용 버전
// --------------------------------------------------------
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
    const [conceptCountsMap, setConceptCountsMap] = useState<Record<string, number>>({});

    // [New State] Controls the "Show More" toggle for the Concept tab
    const [isExpanded, setIsExpanded] = useState(false);

    useEffect(() => {
        const fetchCounts = async () => {
            try {
                const res = await fetch("/api/courses/concept-counts");
                if (res.ok) {
                    const data = await res.json();
                    if (data && typeof data === "object") setConceptCountsMap(data);
                }
            } catch {}
        };
        fetchCounts();
    }, []);

    const representativeImageByConcept = courses.reduce((acc, c) => {
        const key = c.concept || "기타";
        if (!acc[key] && c.imageUrl) acc[key] = c.imageUrl;
        return acc;
    }, {} as Record<string, string | undefined>);

    const conceptItems = (
        Object.keys(conceptCountsMap).length
            ? Object.entries(conceptCountsMap).map(([name, count]) => ({
                  name,
                  count,
                  imageUrl: representativeImageByConcept[name],
              }))
            : Object.entries(
                  courses.reduce<Record<string, { count: number; imageUrl?: string }>>((acc, c) => {
                      const key = c.concept || "기타";
                      if (!acc[key]) acc[key] = { count: 0, imageUrl: c.imageUrl };
                      acc[key].count += 1;
                      return acc;
                  }, {})
              ).map(([name, v]) => ({ name, count: v.count, imageUrl: v.imageUrl }))
    ).sort((a, b) => b.count - a.count);

    // Scroll logic
    const trackRef = useRef<HTMLDivElement | null>(null);
    const isDownRef = useRef(false);
    const startXRef = useRef(0);
    const scrollLeftRef = useRef(0);

    const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!trackRef.current) return;
        isDownRef.current = true;
        startXRef.current = e.pageX;
        scrollLeftRef.current = trackRef.current.scrollLeft;
        trackRef.current.classList.add("cursor-grabbing");
    };

    const handleMouseLeave = () => {
        if (!trackRef.current) return;
        isDownRef.current = false;
        trackRef.current.classList.remove("cursor-grabbing");
    };

    const handleMouseUp = () => {
        if (!trackRef.current) return;
        isDownRef.current = false;
        trackRef.current.classList.remove("cursor-grabbing");
    };

    const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!isDownRef.current || !trackRef.current) return;
        e.preventDefault();
        const dx = e.pageX - startXRef.current;
        trackRef.current.scrollLeft = scrollLeftRef.current - dx;
    };

    const formatViewCount = (num: number) => {
        if (num >= 1000) {
            return (num / 1000).toFixed(1) + "k";
        }
        return num.toLocaleString();
    };

    return (
        <section className="py-6">
            <div className="max-w-7xl mx-auto px-5">
                {/* Tab Buttons */}
                <div className="flex gap-2 mb-6 overflow-x-auto scrollbar-hide pb-1">
                    {[
                        { key: "concept", label: "테마별" },
                        { key: "popular", label: "인기별" },
                        { key: "new", label: "새로운" },
                    ].map((tab) => (
                        <button
                            key={tab.key}
                            onClick={() => {
                                setActiveTab(tab.key as any);
                                if (tab.key === "concept") setIsExpanded(false);
                            }}
                            className={`px-4 py-2 rounded-full text-sm font-bold transition-all whitespace-nowrap border ${
                                activeTab === tab.key
                                    ? "bg-gray-900 text-white border-gray-900 shadow-md transform scale-105"
                                    : "bg-white text-gray-500 border-gray-100 hover:bg-gray-50"
                            }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Content Area */}
                <div className="mt-4 px-1">
                    {/* A. Concept Tab: Grid Layout + Expand/Collapse */}
                    {activeTab === "concept" && (
                        <div className="flex flex-col">
                            {/* Grid Layout: 4 columns */}
                            <div className="grid grid-cols-4 gap-y-6 gap-x-2">
                                {conceptItems
                                    // Logic: Show only 8 items if not expanded
                                    .slice(0, isExpanded ? undefined : 8)
                                    .map((item) => {
                                        // 1. item.name이 영어(키)인지 한글(값)인지 판단하여 한글 라벨(koreanName)을 찾습니다.
                                        // 예: "EXHIBITION" -> "공연·전시" / "전시" -> "전시"
                                        const rawName = item.name;
                                        const koreanName = CONCEPTS[rawName as keyof typeof CONCEPTS] || rawName;

                                        // 2. 한글 라벨을 사용하여 S3 아이콘을 찾습니다.
                                        // CATEGORY_ICONS의 키는 한글 값(예: "공연·전시")으로 되어 있습니다.
                                        const targetImage =
                                            CATEGORY_ICONS[koreanName] || // 1순위: 한글 키로 조회
                                            CATEGORY_ICONS[rawName] || // 2순위: 혹시 몰라 원본 키로 조회
                                            item.imageUrl; // 3순위: API 이미지

                                        return (
                                            <button
                                                key={item.name}
                                                onClick={() =>
                                                    router.push(`/courses?concept=${encodeURIComponent(item.name)}`)
                                                }
                                                className="flex flex-col items-center gap-2 group"
                                            >
                                                {/* Icon Container: Increased to w-20 (80px) */}
                                                <div className="relative w-20 h-20 rounded-full p-1 bg-white border border-gray-100 shadow-md group-hover:border-emerald-400 group-hover:shadow-lg group-hover:-translate-y-1 transition-all duration-300">
                                                    <div className="w-full h-full rounded-full overflow-hidden relative bg-gray-50 flex items-center justify-center">
                                                        {targetImage ? (
                                                            <Image
                                                                src={targetImage}
                                                                alt={koreanName}
                                                                width={80}
                                                                height={80}
                                                                className="object-contain w-full h-full transform scale-110 group-hover:scale-125 transition-transform duration-500 p-1"
                                                            />
                                                        ) : (
                                                            <div className="w-full h-full bg-emerald-50 flex items-center justify-center text-emerald-300">
                                                                <span className="text-[24px]">🌱</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                                {/* Text Area */}
                                                <div className="text-center w-full">
                                                    {/* 한글 라벨(koreanName)을 출력 */}
                                                    <div className="text-xs font-extrabold text-gray-800 whitespace-nowrap tracking-tight mt-1 group-hover:text-emerald-600 transition-colors">
                                                        {koreanName}
                                                    </div>
                                                    <div className="text-[10px] text-gray-400 font-bold mt-0.5">
                                                        {item.count}개
                                                    </div>
                                                </div>
                                            </button>
                                        );
                                    })}
                            </div>

                            {/* Show More / Show Less Button */}
                            {conceptItems.length > 8 && (
                                <button
                                    onClick={() => setIsExpanded(!isExpanded)}
                                    className="w-full mt-6 py-3 flex items-center justify-center gap-1 text-sm font-bold text-gray-500 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors"
                                >
                                    {isExpanded ? (
                                        <>
                                            접기 <span className="text-xs">▲</span>
                                        </>
                                    ) : (
                                        <>
                                            더보기 <span className="text-xs">▼</span>
                                        </>
                                    )}
                                </button>
                            )}
                        </div>
                    )}

                    {/* B. Popular Tab: Horizontal Scroll + Increased Size */}
                    {activeTab === "popular" && (
                        <div
                            className="flex gap-4 overflow-x-auto pb-6 pt-2 scrollbar-hide select-none cursor-grab active:cursor-grabbing px-1"
                            ref={trackRef}
                            onMouseDown={handleMouseDown}
                            onMouseLeave={handleMouseLeave}
                            onMouseUp={handleMouseUp}
                            onMouseMove={handleMouseMove}
                        >
                            {hotCourses.map((c) => (
                                <Link
                                    key={c.id}
                                    href={`/courses/${c.id}`}
                                    // Increased width to w-24 (96px) to allow text to breathe
                                    className="flex flex-col items-center gap-2 group shrink-0 w-24"
                                    draggable={false}
                                >
                                    {/* Increased Icon Size: w-20 (80px) */}
                                    <div className="relative w-20 h-20 rounded-full p-1 bg-white border border-gray-100 shadow-md group-hover:border-orange-400 transition-all duration-300">
                                        <div className="w-full h-full rounded-full overflow-hidden relative bg-gray-50 flex items-center justify-center">
                                            {c.imageUrl ? (
                                                <Image
                                                    src={c.imageUrl}
                                                    alt={c.title}
                                                    width={80}
                                                    height={80}
                                                    className="object-cover w-full h-full transform group-hover:scale-110 transition-transform duration-500"
                                                />
                                            ) : (
                                                <div className="w-full h-full bg-gray-200" />
                                            )}
                                        </div>
                                        {/* Badge */}
                                        <div className="absolute -bottom-1 -right-1 bg-white rounded-full w-8 h-8 flex items-center justify-center border border-orange-100 shadow-md text-[16px] z-10">
                                            🔥
                                        </div>
                                    </div>
                                    <div className="text-center w-full">
                                        <div className="text-xs font-extrabold text-gray-800 whitespace-nowrap overflow-hidden text-ellipsis px-1 tracking-tight mt-1">
                                            {c.title}
                                        </div>
                                        <div className="text-[10px] text-orange-500 font-bold mt-0.5">
                                            {formatViewCount(c.view_count ?? 0)} views
                                        </div>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    )}

                    {/* C. New Tab: Horizontal Scroll + Increased Size */}
                    {activeTab === "new" && (
                        <div
                            className="flex gap-4 overflow-x-auto pb-6 pt-2 scrollbar-hide select-none cursor-grab active:cursor-grabbing px-1"
                            ref={trackRef}
                            onMouseDown={handleMouseDown}
                            onMouseLeave={handleMouseLeave}
                            onMouseUp={handleMouseUp}
                            onMouseMove={handleMouseMove}
                        >
                            {newCourses.map((c) => (
                                <Link
                                    key={c.id}
                                    href={`/courses/${c.id}`}
                                    // Increased width to w-24 (96px)
                                    className="flex flex-col items-center gap-2 group shrink-0 w-24"
                                    draggable={false}
                                >
                                    {/* Increased Icon Size: w-20 (80px) */}
                                    <div className="relative w-20 h-20 rounded-full p-1 bg-white border border-gray-100 shadow-md group-hover:border-emerald-400 transition-all duration-300">
                                        <div className="w-full h-full rounded-full overflow-hidden relative bg-gray-50 flex items-center justify-center">
                                            {c.imageUrl ? (
                                                <Image
                                                    src={c.imageUrl}
                                                    alt={c.title}
                                                    width={80}
                                                    height={80}
                                                    className="object-cover w-full h-full transform group-hover:scale-110 transition-transform duration-500"
                                                />
                                            ) : (
                                                <div className="w-full h-full bg-gray-200" />
                                            )}
                                        </div>
                                        {/* Badge */}
                                        <div className="absolute top-0 right-0 bg-emerald-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full border-2 border-white shadow-sm z-10 transform translate-x-1 -translate-y-1">
                                            N
                                        </div>
                                    </div>
                                    <div className="text-center w-full">
                                        <div className="text-xs font-extrabold text-gray-800 whitespace-nowrap overflow-hidden text-ellipsis px-1 tracking-tight mt-1">
                                            {c.title}
                                        </div>
                                        <div className="text-[10px] text-emerald-600 font-bold mt-0.5">✨ 신규</div>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </section>
    );
}
