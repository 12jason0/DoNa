// src/app/page.tsx
"use client";

import { useState, useEffect, useRef } from "react";
import { fetchWeekStamps, getLocalTodayKey, postCheckin } from "@/lib/checkinClient";
import { apiFetch } from "@/lib/authClient"; // 🟢 쿠키 기반 API 호출
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "@/components/ImageFallback";
import HeroSlider from "@/components/HeroSlider";
import OnboardingSection from "@/components/OnboardingSection";
import CompletionModal from "@/components/CompletionModal";
import PersonalizedSection from "@/components/PersonalizedSection";
import BenefitConsentModal from "@/components/BenefitConsentModal";

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
    const [loginProvider, setLoginProvider] = useState<"apple" | "kakao" | null>(null);
    const [showLoginModal, setShowLoginModal] = useState(false);
    const [showAdModal, setShowAdModal] = useState(false);
    const [isSignup, setIsSignup] = useState(false);
    const [showLoginRequiredModal, setShowLoginRequiredModal] = useState(false);
    const [showCheckinModal, setShowCheckinModal] = useState(false);
    const [showRewardModal, setShowRewardModal] = useState(false);
    const [showBenefitConsentModal, setShowBenefitConsentModal] = useState(false);
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
                // 🟢 쿠키 기반 인증: 세션 정보 먼저 확인
                const { fetchSession } = await import("@/lib/authClient");
                const session = await fetchSession();

                if (!session.authenticated) {
                    // 🚨 로그인이 안 된 경우 모든 유저 데이터 초기화
                    setUserId(null);
                    setUserName("");
                    setStreak(0);
                    setWeekStamps([false, false, false, false, false, false, false]);
                    setIsOnboardingComplete(false);
                    return; // 더 이상 데이터를 가져오지 않음
                }

                // 로그인이 확인된 경우에만 프로필과 출석 정보 가져오기
                const [profileRes, checkinRes, preferencesRes] = await Promise.all([
                    apiFetch("/api/users/profile", {
                        cache: "force-cache", // 🟢 성능 최적화: 브라우저 캐시 활용
                        next: { revalidate: 300 },
                    }),
                    apiFetch("/api/users/checkins", {
                        cache: "force-cache", // 🟢 성능 최적화: 브라우저 캐시 활용
                        next: { revalidate: 60 },
                    }),
                    apiFetch("/api/users/preferences", {
                        cache: "force-cache", // 🟢 성능 최적화: 브라우저 캐시 활용
                        next: { revalidate: 300 },
                    }),
                ]);
                if (profileRes.response.ok && profileRes.data) {
                    const p = profileRes.data as any;
                    const id =
                        Number(p?.user?.id ?? p?.id ?? p?.userId ?? p?.user_id) &&
                        Number.isFinite(Number(p?.user?.id ?? p?.id ?? p?.userId ?? p?.user_id))
                            ? Number(p?.user?.id ?? p?.id ?? p?.userId ?? p?.user_id)
                            : null;
                    if (id) setUserId(id);
                    // 🟢 애플 로그인 시 username이 제대로 저장되었는지 확인
                    const name = p?.user?.nickname ?? p?.user?.name ?? p?.nickname ?? p?.name ?? p?.username ?? "두나";
                    setUserName(name);
                }
                if (checkinRes.response.ok && checkinRes.data) {
                    const c = checkinRes.data as any;
                    if (Number.isFinite(Number(c?.streak))) setStreak(Number(c.streak));
                }
                if (preferencesRes.response.ok && preferencesRes.data) {
                    const prefs = preferencesRes.data as any;
                    const prefData = prefs?.preferences ?? prefs ?? {};

                    // 서버에 preferences 데이터가 있고 필수 필드가 있으면 온보딩 완료로 간주
                    const hasServerData =
                        prefData &&
                        ((Array.isArray(prefData?.mood) && prefData.mood.length > 0) ||
                            (Array.isArray(prefData?.concept) && prefData.concept.length > 0)) &&
                        typeof prefData?.companion === "string" &&
                        prefData.companion !== "";

                    // localStorage 완료 플래그 확인
                    const doneFlag = localStorage.getItem("onboardingComplete") === "1";

                    // 서버 데이터가 있거나 localStorage 플래그가 있으면 완료
                    setIsOnboardingComplete(hasServerData || doneFlag);
                } else {
                    // API 요청 실패 시 localStorage 플래그만 확인
                    const doneFlag = localStorage.getItem("onboardingComplete") === "1";
                    setIsOnboardingComplete(doneFlag);
                }
            } catch (error) {
                console.error("데이터 로딩 중 오류:", error);
                // 🟢 에러 시에도 안전하게 초기화
                setUserId(null);
                setStreak(0);
                setUserName("");
                setWeekStamps([false, false, false, false, false, false, false]);
            }
        })();
    }, []);

    // 🟢 모바일 성능 최적화: 태그 목록은 지연 로딩 (초기 로딩 후 2초 후)
    useEffect(() => {
        const timer = setTimeout(() => {
            (async () => {
                try {
                    const res = await fetch("/api/course-tags", {
                        cache: "force-cache", // 🟢 캐싱 추가
                        next: { revalidate: 600 },
                    });
                    const data = await res.json().catch(() => ({}));
                    if (data?.success && Array.isArray(data.tags)) setAllTags(data.tags);
                } catch {}
            })();
        }, 2000); // 🟢 2초 지연
        return () => clearTimeout(timer);
    }, []);

    const buildCourseListUrl = () => {
        const params = new URLSearchParams();
        params.set("limit", "15"); // 🟢 성능 최적화: 20 -> 15 (초기 로딩 속도 향상)
        params.set("imagePolicy", "any");
        const qTrim = query.trim();
        if (qTrim) params.set("q", qTrim);
        if (selectedTagIds.length > 0) params.set("tagIds", selectedTagIds.join(","));
        return `/api/courses?${params.toString()}`;
    };

    useEffect(() => {
        const fetchCourses = async () => {
            try {
                // 🟢 쿠키 기반 인증: apiFetch 사용 (쿠키 자동 포함) - 성능 최적화
                const { data, response } = await apiFetch(buildCourseListUrl() as any, {
                    cache: "force-cache", // 🟢 성능 최적화: 브라우저 캐시 활용
                    next: { revalidate: 180 }, // 🟢 성능 최적화: 300초 -> 180초 (3분)
                });
                if (!response.ok) {
                    setCourses([]);
                    return;
                }
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

        // 2. 로그인 성공 (✅ 모달 제거)
        if (loginSuccess === "true") {
            // 🟢 로그인 방식 확인 (애플 또는 카카오) - 모달 표시는 하지 않음
            const provider = urlParams.get("provider") as "apple" | "kakao" | null;
            setLoginProvider(provider);

            // 🚨 수정 포인트: 로그인했으니 로그인 창은 끄고(false), 환영 배너는 표시하지 않음
            // 🟢 애플 로그인 시에는 "로그인 성공!" 모달도 표시하지 않음
            setShowLoginModal(false);
            setShowWelcome(false); // 🟢 모달 표시 안 함

            maybeOpenCheckinModal(); // 출석체크 모달은 유지

            // 🟢 쿠키 기반 인증: authLoginSuccess 이벤트 발생
            window.dispatchEvent(new CustomEvent("authLoginSuccess"));

            // URL 세탁 (기존 유지)
            const newUrl = window.location.pathname;
            window.history.replaceState({}, "", newUrl);
        }

        // 3. 회원가입 성공 (기존 유지)
        if (signupSuccess === "true") {
            // 💡 팁: 만약 회원가입 후 바로 로그인이 된 상태라면 여기도 false로 바꾸는 게 좋습니다.
            // 일단은 기존 코드대로 true(모달 띄움)로 두었습니다.
            setShowLoginModal(true);
            setIsSignup(true);
            // 🟢 쿠키 기반 인증: loginTime은 더 이상 사용하지 않음
            maybeOpenCheckinModal();
            const newUrl = window.location.pathname;
            window.history.replaceState({}, "", newUrl);
        }
    }, []);

    useEffect(() => {
        const handleAuthChange = async () => {
            // 🟢 쿠키 기반 인증: fetchSession으로 확인
            const { fetchSession } = await import("@/lib/authClient");
            const session = await fetchSession();
            if (session.authenticated) {
                setTimeout(() => {
                    maybeOpenCheckinModal();
                }, 500);
            }
        };
        window.addEventListener("authLoginSuccess", handleAuthChange);
        window.addEventListener("authTokenChange", handleAuthChange);
        return () => {
            window.removeEventListener("authLoginSuccess", handleAuthChange);
            window.removeEventListener("authTokenChange", handleAuthChange);
        };
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
            // 🟢 쿠키 기반 인증: fetchSession으로 확인
            const { fetchSession } = await import("@/lib/authClient");
            const session = await fetchSession();
            if (!session.authenticated) return;

            const result = await fetchAndSetWeekStamps();
            if (!result) return;

            const already = Boolean(result.todayChecked);
            setAnimStamps(null);

            if (!already) {
                try {
                    // 🟢 쿠키 기반 인증: apiFetch 사용
                    const { data, response } = await apiFetch("/api/users/checkins", {
                        next: { revalidate: 60 },
                    });
                    if (response.ok && data) {
                        const d = data as any;
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
            // 🟢 쿠키 기반 인증: fetchSession으로 확인
            const { fetchSession } = await import("@/lib/authClient");
            const session = await fetchSession();
            if (!session.authenticated) return;

            // 스플래시가 끝났는지 확인하는 함수
            const checkSplashDone = (): Promise<void> => {
                return new Promise((resolve) => {
                    // 스플래시가 이미 표시된 적이 있으면 즉시 진행
                    const splashShown = sessionStorage.getItem("dona-splash-shown");
                    if (splashShown === "1") {
                        resolve();
                        return;
                    }

                    // 스플래시가 표시 중이면 끝날 때까지 대기
                    // 스플래시는 약 7초 동안 표시되므로, 최대 8초까지 대기
                    let checkCount = 0;
                    const maxChecks = 80; // 8초 (100ms * 80)
                    const checkInterval = setInterval(() => {
                        checkCount++;
                        const isDone = sessionStorage.getItem("dona-splash-shown") === "1";
                        if (isDone || checkCount >= maxChecks) {
                            clearInterval(checkInterval);
                            resolve();
                        }
                    }, 100);
                });
            };

            try {
                // 🟢 쿠키 기반 인증: apiFetch 사용
                const { data, response } = await apiFetch("/api/users/profile", {
                    next: { revalidate: 300 },
                });
                if (response.ok && data) {
                    const userData = data as any;

                    // 스플래시가 끝날 때까지 대기
                    await checkSplashDone();

                    // 홈 페이지가 완전히 로드된 후 추가 대기 (안정성)
                    await new Promise((resolve) => setTimeout(resolve, 500));

                    // 🟢 혜택 동의 모달 체크: 한 번도 안 본 사람에게만 표시
                    if (userData.hasSeenConsentModal === false) {
                        setShowBenefitConsentModal(true);
                    }

                    // 출석체크 모달은 한 번만 열리도록 hasShownCheckinModalRef로 제어
                    if (!hasShownCheckinModalRef.current) {
                        setTimeout(() => {
                            maybeOpenCheckinModal();
                        }, 800);
                    }
                }
            } catch {
                // 에러 발생 시 무시 (로그인하지 않은 상태로 처리)
            }
        };
        initAuth();

        const handleFocus = async () => {
            // 🟢 쿠키 기반 인증: fetchSession으로 확인
            const { fetchSession } = await import("@/lib/authClient");
            const session = await fetchSession();
            if (session.authenticated && !hasShownCheckinModalRef.current) {
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

    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    // HeroSlider용 별도 데이터 로드 및 3일 로테이션 로직 - 최우선 로딩
    // 다른 useEffect보다 먼저 실행되도록 의존성 없이 즉시 실행
    useEffect(() => {
        const fetchHeroData = async () => {
            try {
                // ✅ 최적화: 캐시 사용 + 최소 데이터만 가져오기 (5개만 필요하므로 limit=5)
                // ✅ cache: 'force-cache'로 브라우저 캐시 강제 사용 (가장 빠름)
                // 🟢 쿠키 기반 인증: apiFetch 사용
                const { data, response } = await apiFetch("/api/courses?limit=5&imagePolicy=any&grade=FREE", {
                    cache: "force-cache", // 브라우저 캐시 강제 사용 (가장 빠른 로딩)
                    next: { revalidate: 3600 }, // 1시간 캐시 (서버 캐시)
                });

                if (!response.ok || !data) {
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

                const allCourses = Array.isArray(data) ? data : (data as any).courses || [];

                // FREE 등급 코스만 필터링 (API에서 이미 필터링했지만 이중 체크)
                const freeCourses = allCourses.filter((c: any) => c.grade === "FREE");
                const targetCourses = freeCourses.length > 0 ? freeCourses : allCourses.slice(0, 10);

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
                    for (let i = 0; i < Math.min(5, count); i++) {
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

        // ✅ 즉시 로딩 (지연 제거로 빠른 표시) - 다른 데이터 로딩보다 우선
        fetchHeroData();
    }, []); // 마운트 시 한 번만 실행 (의존성 없음으로 최우선 실행)

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
            // 🟢 쿠키 기반 인증: fetchSession으로 로그인 상태 확인
            const { fetchSession } = await import("@/lib/authClient");
            const session = await fetchSession();
            setIsLoggedInForRecs(session.authenticated);

            // 🟢 성능 최적화: 캐싱 추가
            // 🟢 쿠키 기반 인증: apiFetch 사용
            // 🟢 mode=main 파라미터 추가: 모든 등급의 코스를 반환 (잠금은 프론트엔드에서 처리)
            const { data, response } = await apiFetch("/api/recommendations?limit=6&mode=main", {
                cache: "force-cache", // 브라우저 캐시 사용
                next: { revalidate: 300 }, // 5분 캐시
            });

            if (response.ok && data) {
                if (Array.isArray((data as any)?.recommendations)) {
                    setRecs((data as any).recommendations);
                } else {
                    setRecs([]);
                }
            } else {
                setRecs([]);
            }
        } catch {
            setRecs([]);
        } finally {
            setIsLoadingRecs(false);
        }
    };

    // 🟢 모바일 성능 최적화: 추천 데이터는 지연 로딩 (초기 로딩 후 3초 후)
    useEffect(() => {
        const timer = setTimeout(() => {
            fetchRecommendations();
        }, 3000); // 🟢 3초 지연 (초기 렌더링 완료 후)
        return () => clearTimeout(timer);
    }, []);

    useEffect(() => {
        const handleAuthChange = () => {
            fetchRecommendations();
        };
        const handleLogout = () => {
            // 🟢 로그아웃 시 모든 상태 초기화
            console.log("[Home] 로그아웃 이벤트 수신 - 상태 초기화");
            setCourses([]);
            setHeroCourses([]);
            setRecs([]);
            setUserId(null);
            setUserName("");
            setStreak(0);
            setWeekStamps([false, false, false, false, false, false, false]);
            setAlreadyToday(false);
            setCycleProgress(0);
            setIsOnboardingComplete(false);
            // 추천 데이터는 비로그인 상태로 다시 가져올 필요 없음 (PersonalizedSection에서 처리)
        };
        window.addEventListener("authTokenChange", handleAuthChange as EventListener);
        window.addEventListener("authLogout", handleLogout as EventListener);
        return () => {
            window.removeEventListener("authTokenChange", handleAuthChange as EventListener);
            window.removeEventListener("authLogout", handleLogout as EventListener);
        };
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

    const handleStartOnboarding = async () => {
        // 🟢 쿠키 기반 인증: fetchSession으로 확인
        const { fetchSession } = await import("@/lib/authClient");
        const session = await fetchSession();
        if (!session.authenticated) {
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
            <BenefitConsentModal isOpen={showBenefitConsentModal} onClose={() => setShowBenefitConsentModal(false)} />
            {/* 🟢 애플 로그인 시에는 "로그인 성공!" 모달을 표시하지 않음 */}
            {showLoginModal && loginProvider !== "apple" && (
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
                                                    // 🟢 이미 출석한 경우에도 스트릭 업데이트
                                                    if (typeof (data as any).streak === "number") {
                                                        setStreak((data as any).streak);
                                                    }
                                                    setAlreadyToday(true);
                                                    setIsStamping(false);
                                                    setStampCompleted(true);
                                                    const todayKey = getLocalTodayKey();
                                                    localStorage.setItem("checkinModalDismissedDate", todayKey);
                                                    localStorage.setItem(`checkinButtonPressed_${todayKey}`, "true");
                                                    // 🟢 checkinUpdated 이벤트 dispatch하여 메인 페이지 즉시 반영
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
                                                    return;
                                                }
                                                if (typeof data.weekCount === "number") {
                                                    setCycleProgress((data.weekCount % 7) as number);
                                                }
                                                // 🟢 스트릭 즉시 업데이트 (메인 페이지 반영)
                                                if (typeof (data as any).streak === "number") {
                                                    setStreak((data as any).streak);
                                                }
                                                // 🟢 weekStamps 즉시 업데이트 (메인 페이지 반영)
                                                if (Array.isArray(data.weekStamps)) {
                                                    setWeekStamps(data.weekStamps as boolean[]);
                                                }
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

                                                const targetIdx =
                                                    typeof data.todayIndex === "number" ? data.todayIndex : null;

                                                // 🟢 스트릭 즉시 업데이트 (메인 페이지 반영)
                                                if (typeof (data as any).streak === "number") {
                                                    setStreak((data as any).streak);
                                                }

                                                if (targetIdx === null) {
                                                    if (Array.isArray(data.weekStamps)) {
                                                        setWeekStamps(data.weekStamps as boolean[]);
                                                    }
                                                    setIsStamping(false);
                                                    setStampCompleted(true);
                                                    const todayKey = getLocalTodayKey();
                                                    localStorage.setItem(`checkinButtonPressed_${todayKey}`, "true");
                                                    // 🟢 checkinUpdated 이벤트 dispatch하여 메인 페이지 즉시 반영
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
                                                        // 🟢 최종 weekStamps 업데이트
                                                        if (Array.isArray(data.weekStamps)) {
                                                            setWeekStamps(data.weekStamps as boolean[]);
                                                        }
                                                        // 🟢 스트릭 최종 업데이트 (메인 페이지 반영)
                                                        if (typeof (data as any).streak === "number") {
                                                            setStreak((data as any).streak);
                                                        }
                                                        setAnimStamps(null);
                                                        setIsStamping(false);
                                                        setStampCompleted(true);
                                                        const todayKey = getLocalTodayKey();
                                                        localStorage.setItem(
                                                            `checkinButtonPressed_${todayKey}`,
                                                            "true"
                                                        );
                                                        // 🟢 checkinUpdated 이벤트 dispatch하여 메인 페이지 즉시 반영
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
                                <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-2xl">
                                    🌱
                                </div>
                                <div>
                                    <div className="text-sm text-gray-600">출석 현황</div>
                                    <div className="text-base md:text-lg font-bold text-gray-900">
                                        {/* 💡 userId가 있을 때만 스트릭 표시 */}
                                        {userId
                                            ? streak >= 5
                                                ? `🔥 ${streak}일 연속 출석 중!`
                                                : streak > 0
                                                ? `${streak}일 연속 출석 중`
                                                : "오늘도 새싹 도장 찍어보세요!"
                                            : "로그인하고 도장을 찍어보세요!"}
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={async () => {
                                        try {
                                            const { fetchSession } = await import("@/lib/authClient");
                                            const session = await fetchSession();
                                            if (!session.authenticated) {
                                                router.push("/login");
                                                return;
                                            }
                                            router.push("/mypage?tab=checkins");
                                        } catch (error) {
                                            router.push("/login");
                                        }
                                    }}
                                    className="w-10 h-10 rounded-full bg-white border border-emerald-200 text-emerald-700 hover:bg-emerald-50 cursor-pointer flex items-center justify-center"
                                    title="출석 탭으로 이동"
                                    aria-label="출석 탭으로 이동"
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

    // 🟢 모바일 성능 최적화: 컨셉 카운트는 지연 로딩 (초기 로딩 후 4초 후)
    useEffect(() => {
        const timer = setTimeout(() => {
            const fetchCounts = async () => {
                try {
                    const res = await fetch("/api/courses/concept-counts", {
                        cache: "force-cache", // 🟢 캐싱 추가
                        next: { revalidate: 300 },
                    });
                    if (res.ok) {
                        const data = await res.json();
                        if (data && typeof data === "object") setConceptCountsMap(data);
                    }
                } catch {}
            };
            fetchCounts();
        }, 4000); // 🟢 4초 지연
        return () => clearTimeout(timer);
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
                                    .map((item, idx) => {
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
                                                onClick={() => {
                                                    // 🟢 성능 최적화: prefetch 후 이동
                                                    router.prefetch(
                                                        `/courses?concept=${encodeURIComponent(item.name)}`
                                                    );
                                                    router.push(`/courses?concept=${encodeURIComponent(item.name)}`);
                                                }}
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
                                                                priority={idx < 4} // 🟢 LCP 최적화: 첫 4개만 priority (8개→4개로 축소)
                                                                loading={idx < 4 ? undefined : "lazy"} // 🟢 첫 4개는 eager, 나머지는 lazy
                                                                quality={60} // 🟢 성능 최적화: 작은 아이콘이므로 quality 낮춤
                                                                sizes="80px" // 🟢 고정 크기 명시
                                                                fetchPriority={idx < 4 ? "high" : "auto"} // 🟢 첫 4개만 high priority
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
                            {hotCourses.map((c, idx) => (
                                <Link
                                    key={c.id}
                                    href={`/courses/${c.id}`}
                                    prefetch={true} // 🟢 성능 최적화: prefetch 추가
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
                                                    priority={idx === 0} // 🟢 LCP 최적화: 첫 번째 이미지만 priority (4개→1개로 축소)
                                                    loading={idx === 0 ? undefined : "lazy"} // 🟢 첫 번째만 eager, 나머지는 lazy
                                                    quality={65} // 🟢 성능 최적화: quality 최적화
                                                    sizes="80px" // 🟢 고정 크기 명시
                                                    fetchPriority={idx === 0 ? "high" : "auto"} // 🟢 첫 번째만 high priority
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
                            {newCourses.map((c, idx) => (
                                <Link
                                    key={c.id}
                                    href={`/courses/${c.id}`}
                                    prefetch={true} // 🟢 성능 최적화: prefetch 추가
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
                                                    priority={idx === 0} // 🟢 LCP 최적화: 첫 번째 이미지만 priority (4개→1개로 축소)
                                                    loading={idx === 0 ? undefined : "lazy"} // 🟢 첫 번째만 eager, 나머지는 lazy
                                                    quality={65} // 🟢 성능 최적화: quality 최적화
                                                    sizes="80px" // 🟢 고정 크기 명시
                                                    fetchPriority={idx === 0 ? "high" : "auto"} // 🟢 첫 번째만 high priority
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
