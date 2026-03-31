"use client";

import React, { useState, useEffect, useRef, useCallback, lazy, Suspense } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "@/context/LocaleContext";
import LogoutModal from "@/components/LogoutModal";
import PasswordCheckModal from "@/components/passwordChackModal";
import { getS3StaticUrl } from "@/lib/s3Static";

// 🟢 성능 최적화: 탭 컴포넌트 동적 로딩 (코드 스플리팅)
const ProfileTab = lazy(() => import("@/components/mypage/ProfileTab"));
const FootprintTab = lazy(() => import("@/components/mypage/FootprintTab"));
const RecordsTab = lazy(() => import("@/components/mypage/RecordsTab"));
const ActivityTab = lazy(() => import("@/components/mypage/ActivityTab"));
import TicketPlans from "@/components/TicketPlans";
import HorizontalScrollContainer from "@/components/HorizontalScrollContainer";
import {
    UserInfo,
    UserPreferences,
    Favorite,
    UserBadgeItem,
    UserRewardRow,
    CompletedCourse,
    CasefileItem,
} from "@/types/user";

declare global {
    interface Window {
        Kakao?: any;
    }
}

const MyPage = () => {
    const router = useRouter();
    const { t, isLocaleReady } = useLocale();
    const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
    const [userPreferences, setUserPreferences] = useState<UserPreferences | null>(null);
    const [favorites, setFavorites] = useState<Favorite[]>([]);
    const [savedCourses, setSavedCourses] = useState<any[]>([]);
    const [completed, setCompleted] = useState<CompletedCourse[]>([]);
    const [badges, setBadges] = useState<UserBadgeItem[]>([]);
    const [casefiles, setCasefiles] = useState<CasefileItem[]>([]);
    const [rewards, setRewards] = useState<UserRewardRow[]>([]);
    const [payments, setPayments] = useState<any[]>([]);
    // 🟢 개인 추억 (isPublic: false인 리뷰)
    const [personalStories, setPersonalStories] = useState<any[]>([]);

    const [activeTab, setActiveTab] = useState("profile");

    // 🟢 [Performance]: 탭 변경 시 부드러운 전환을 위한 최적화 및 데이터 지연 로드
    const handleTabChange = useCallback(
        (tab: string) => {
            // 🟢 다음 프레임에서 탭 변경하여 렌더링 부하 분산
            requestAnimationFrame(() => {
                setActiveTab(tab);

                // 🟢 탭 변경 시 필요한 데이터가 없으면 로드
                if (tab === "footprint" && completed.length === 0 && casefiles.length === 0) {
                    Promise.all([fetchCompleted(), fetchCasefiles(), fetchSavedCourses(), fetchPersonalStories()]).catch(() => {});
                } else if (tab === "records" && favorites.length === 0 && savedCourses.length === 0) {
                    Promise.all([fetchFavorites(), fetchSavedCourses(), fetchCompleted(), fetchCasefiles()]).catch(
                        () => {}
                    );
                } else if (tab === "activity" && badges.length === 0 && rewards.length === 0) {
                    Promise.all([fetchBadges(), fetchRewards(), fetchPayments()]).catch(() => {});
                }
            });
        },
        [completed.length, casefiles.length, favorites.length, savedCourses.length, badges.length, rewards.length]
    );
    const [activitySubTab, setActivitySubTab] = useState<"badges" | "rewards" | "payments">("badges");
    const tabsTrackRef = useRef<HTMLDivElement | null>(null);
    const redirectingRef = useRef(false); // 🟢 리다이렉트 중복 방지

    const [loading, setLoading] = useState(true);

    // Modal States
    const [showEditModal, setShowEditModal] = useState(false);
    const [editForm, setEditForm] = useState({ name: "", email: "", mbti: "", age: "", ageRange: "", gender: "" });
    const [editLoading, setEditLoading] = useState(false);
    const [editError, setEditError] = useState("");

    const [showLogoutModal, setShowLogoutModal] = useState(false);
    const [isLoggingOut, setIsLoggingOut] = useState(false); // 🟢 로그아웃 중복 실행 방지

    const [selectedCaseStoryId, setSelectedCaseStoryId] = useState<number | null>(null);
    const [selectedCaseTitle, setSelectedCaseTitle] = useState("");
    const [casePhotoUrls, setCasePhotoUrls] = useState<string[]>([]);
    const [casePhotoLoading, setCasePhotoLoading] = useState(false);
    const [fullImageUrl, setFullImageUrl] = useState<string | null>(null);

    const [selectedBadge, setSelectedBadge] = useState<UserBadgeItem | null>(null);

    // Password Modal State
    const [pwModalOpen, setPwModalOpen] = useState(false);
    const [pwStep, setPwStep] = useState<"verify" | "change">("verify");
    const [pwState, setPwState] = useState({ current: "", next: "", confirm: "" });
    const [pwLoading, setPwLoading] = useState(false);
    const [pwError, setPwError] = useState("");

    // 🟢 TicketPlans 모달 상태
    const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);

    // 🟢 [Fix] 모든 fetch 함수들을 useEffect보다 위로 이동 (TDZ 방지)
    const fetchUserInfo = useCallback(async (): Promise<boolean> => {
        // 🟢 이미 리다이렉트 중이면 중복 실행 방지
        if (redirectingRef.current) return false;

        try {
            // 🟢 쿠키 기반 인증: apiFetch 사용하여 401 처리 방지
            const { apiFetch } = await import("@/lib/authClient");
            
            // 🟢 [Fix]: 로그인/로그아웃 모든 상황에서 강제 갱신 플래그 확인 (로컬/카카오 로그인 통합)
            const forceRefreshTime = typeof window !== "undefined" ? sessionStorage.getItem("auth:forceRefresh") : null;
            const loggingOutTime = typeof window !== "undefined" ? sessionStorage.getItem("auth:loggingOut") : null;
            const now = Date.now();
            
            // 실시간 업데이트가 필요한 경우(결제/환불 등) 캐시 무시
            const shouldForceRefresh = (window as any).__forceRefreshUserInfo;
            
            // 🟢 [Fix]: 로그인 직후 또는 로그아웃 직후 재로그인 시 캐시를 완전히 무시함
            // 로그아웃 후 재로그인 시에도 이전 사용자 데이터가 표시되지 않도록 확실히 캐시 무시
            const timeSinceLogout = loggingOutTime ? (now - parseInt(loggingOutTime, 10)) : Infinity;
            const timeSinceLogin = forceRefreshTime ? (now - parseInt(forceRefreshTime, 10)) : Infinity;
            
            // 로그아웃 직후 60초 이내 또는 로그인 직후 30초 이내라면 캐시 무시
            const shouldIgnoreCache = (
                (forceRefreshTime && timeSinceLogin < 30000) ||
                (loggingOutTime && timeSinceLogout < 60000) || // 🟢 로그아웃 후 60초간 캐시 무시 (재로그인 감지)
                shouldForceRefresh
            );
            
            // 🟢 [Fix]: 로그인 직후 캐시 완전 우회를 위한 캐시 버스팅 파라미터 추가
            let profileUrl = "/api/users/profile";
            if (shouldIgnoreCache) {
                // 캐시 버스팅을 위해 타임스탬프 추가
                const timestamp = Date.now();
                profileUrl = `${profileUrl}?_t=${timestamp}`;
            }
            
            const cacheOption = shouldIgnoreCache
                ? { 
                    cache: "no-store" as const,
                    headers: {
                        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
                        "Pragma": "no-cache",
                        "Expires": "0"
                    }
                }
                : { cache: "force-cache" as const, next: { revalidate: 60 } };
            let { data: raw, response } = await apiFetch<any>(profileUrl, cacheOption);
            
            // 🟢 [Fix]: 데이터를 성공적으로 가져온 후에만 플래그 제거 (무한 no-store 방지)
            // 401 에러가 아닐 때만 플래그 제거하여 다음 요청에서도 캐시 무시
            if (shouldIgnoreCache && typeof window !== "undefined" && response.status === 200 && raw) {
                // 로그인 직후 성공적으로 사용자 정보를 가져왔을 때만 플래그 제거
                sessionStorage.removeItem("auth:forceRefresh");
            }
            // 로그아웃 플래그는 항상 제거 (로그아웃은 한 번만 필요)
            if (loggingOutTime && typeof window !== "undefined") {
                sessionStorage.removeItem("auth:loggingOut");
            }
            // 🟢 플래그 초기화
            if ((window as any).__forceRefreshUserInfo) {
                delete (window as any).__forceRefreshUserInfo;
            }

            // 401 응답인 경우 로그인 페이지로 이동 (authenticatedFetch는 자동으로 logout 호출하므로 apiFetch 사용)
            if (response.status === 401 || !raw) {
                // 🟢 [Fix]: 로그인 직후 쿠키 동기화 시간을 고려하여 일정 시간 동안 401 무시 및 재시도
                const loginSuccessTime = sessionStorage.getItem("login_success_trigger");
                if (loginSuccessTime) {
                    const timeSinceLogin = Date.now() - parseInt(loginSuccessTime, 10);
                    // 🟢 로그인 후 5초 이내에는 401을 무시하고 재시도 (쿠키 동기화 시간 확보)
                    if (timeSinceLogin < 5000) {
                        // 🟢 1초 후 재시도
                        await new Promise((resolve) => setTimeout(resolve, 1000));
                        const retryResult = await apiFetch<any>("/api/users/profile", {
                            cache: "no-store",
                        });
                        if (retryResult.response.status === 200 && retryResult.data) {
                            // 🟢 재시도 성공 시 raw와 response를 재시도 결과로 교체하고 계속 진행
                            raw = retryResult.data;
                            response = retryResult.response;
                        } else {
                            // 🟢 재시도 실패 시 기존 로직으로 진행
                            if (
                                !redirectingRef.current &&
                                typeof window !== "undefined" &&
                                !window.location.pathname.includes("/login")
                            ) {
                                redirectingRef.current = true;
                                router.push("/login");
                            }
                            return false;
                        }
                    } else {
                        // 🟢 5초 이후 401이면 로그인 페이지로 이동
                        if (
                            !redirectingRef.current &&
                            typeof window !== "undefined" &&
                            !window.location.pathname.includes("/login")
                        ) {
                            redirectingRef.current = true;
                            router.push("/login");
                        }
                        return false;
                    }
                } else {
                    // 🟢 login_success_trigger가 없으면 즉시 로그인 페이지로 이동
                    if (
                        !redirectingRef.current &&
                        typeof window !== "undefined" &&
                        !window.location.pathname.includes("/login")
                    ) {
                        redirectingRef.current = true;
                        router.push("/login");
                    }
                    return false;
                }
            }

            // 🟢 authenticatedFetch가 이미 JSON을 파싱해서 반환함
            // 🟢 [Fix]: API 응답 구조 확인
            const src: any = raw ?? {};

            // HTTP URL을 HTTPS로 변환 (Mixed Content 경고 해결)
            const convertToHttps = (url: string | null | undefined): string | null => {
                if (!url || url.trim() === "") return null; // 🟢 [Fix]: 빈 문자열이나 null이면 null 반환
                if (url.startsWith("http://")) {
                    return url.replace(/^http:\/\//, "https://");
                }
                return url;
            };

            // 🟢 카카오 프로필 이미지 URL 추출 (여러 필드명 체크)
            const profileImageUrl =
                src.profileImage ||
                src.profileImageUrl ||
                src.profile_image_url ||
                (src as any)?.user?.profileImage ||
                (src as any)?.user?.profileImageUrl ||
                null; // 🟢 [Fix]: 빈 문자열 대신 null 사용하여 기본 이미지가 표시되도록 함

            // 🟢 subscriptionTier 확인: API 응답의 최상위 레벨과 user 객체 모두 체크
            const tier =
                src.subscriptionTier ||
                src.subscription_tier ||
                (src as any)?.user?.subscriptionTier ||
                (src as any)?.user?.subscription_tier ||
                "FREE";

            // subscriptionExpiresAt 추출 (DB 필드명: subscription_expires_at)
            const subscriptionExpiresAt =
                src.subscriptionExpiresAt ||
                src.subscription_expires_at ||
                (src as any)?.user?.subscriptionExpiresAt ||
                (src as any)?.user?.subscription_expires_at ||
                null;

            // 🟢 기본 프로필 이미지 설정
            const DEFAULT_PROFILE_IMG = getS3StaticUrl("profileLogo.png");
            const convertedProfileImage = convertToHttps(profileImageUrl);
            
            const finalUserInfo: UserInfo = {
                name: src.name || src.username || src.nickname || (src as any)?.user?.name || (src as any)?.user?.username || "",
                email: src.email || src.userEmail || (src as any)?.user?.email || "",
                joinDate: src.joinDate
                    ? new Date(src.joinDate).toLocaleDateString()
                    : src.createdAt
                    ? new Date(src.createdAt).toLocaleDateString()
                    : (src as any)?.user?.createdAt
                    ? new Date((src as any).user.createdAt).toLocaleDateString()
                    : "",
                profileImage: convertedProfileImage || DEFAULT_PROFILE_IMG, // 🟢 프로필 이미지가 없으면 기본 이미지 사용
                mbti: src.mbti ?? (src as any)?.user?.mbti ?? null,
                age: typeof src.age === "number" ? src.age : src.age ? Number(src.age) : (src as any)?.user?.age ?? null,
                ageRange: src.ageRange || src.age_range || (src as any)?.user?.ageRange || (src as any)?.user?.age_range || null,
                gender: src.gender || (src as any)?.user?.gender || null,
                subscriptionTier: tier,
                subscriptionExpiresAt: subscriptionExpiresAt ? new Date(subscriptionExpiresAt).toISOString() : null,
            };

            setUserInfo(finalUserInfo);
            // 🟢 [Performance]: UI를 빠르게 표시하기 위해 즉시 로딩 상태 해제
            setLoading(false);
            return true; // 🟢 성공 시 true 반환하여 다른 fetch 함수들이 실행되도록 함
        } catch (error) {
            console.error(error);
            // 🟢 중복 리다이렉트 방지
            if (
                !redirectingRef.current &&
                typeof window !== "undefined" &&
                !window.location.pathname.includes("/login")
            ) {
                redirectingRef.current = true;
                router.push("/login"); // 🟢 에러 발생 시 로그인 페이지로 이동
            }
            setLoading(false);
            return false;
        }
    }, [router]);

    const fetchBadges = async () => {
        try {
            // 🟢 쿠키 기반 인증: apiFetch 사용 (401 시 자동 로그아웃 방지)
            const { apiFetch } = await import("@/lib/authClient");
            const { data, response } = await apiFetch<any>("/api/users/badges", {
                cache: "force-cache", // 🟢 성능 최적화: 캐싱 활용
                next: { revalidate: 300 }, // 🟢 5분 캐싱
            });
            if (response.status === 401) return; // 401이면 조용히 실패
            if (data) {
                const list = Array.isArray((data as any)?.badges)
                    ? (data as any).badges
                    : Array.isArray(data)
                    ? data
                    : [];
                setBadges(
                    list.map((b: any) => ({
                        id: b.id,
                        name: b.name || b.title || "",
                        image_url: b.image_url || b.icon_url || null,
                        description: b.description ?? null,
                        awarded_at: b.awarded_at || b.createdAt || b.created_at || new Date().toISOString(),
                    }))
                );
            }
        } catch (e) {
            setBadges([]);
        }
    };

    const fetchUserPreferences = async () => {
        try {
            // 🟢 쿠키 기반 인증: apiFetch 사용 (401 시 자동 로그아웃 방지)
            const { apiFetch } = await import("@/lib/authClient");
            const { data: raw, response } = await apiFetch<any>("/api/users/preferences", {
                cache: "force-cache", // 🟢 성능 최적화: 캐싱 활용
                next: { revalidate: 300 }, // 🟢 5분 캐싱
            });
            if (response.status === 401) return; // 401이면 조용히 실패
            if (raw) {
                const prefs: any = (raw as any)?.preferences ?? raw ?? {};
                const hasPreferences =
                    Object.keys(prefs).length > 0 &&
                    ((prefs.concept && Array.isArray(prefs.concept) && prefs.concept.length > 0) ||
                        (prefs.mood && Array.isArray(prefs.mood) && prefs.mood.length > 0) ||
                        (prefs.regions && Array.isArray(prefs.regions) && prefs.regions.length > 0));

                if (hasPreferences) {
                    // 한 글자씩 분리된 항목들을 합치는 함수
                    const mergeSingleChars = (arr: string[]): string[] => {
                        if (!Array.isArray(arr) || arr.length === 0) return [];
                        const result: string[] = [];
                        let currentWord = "";

                        for (let i = 0; i < arr.length; i++) {
                            const item = arr[i];
                            // 한 글자인 경우
                            if (item && item.length === 1) {
                                currentWord += item;
                            } else {
                                // 현재까지 모은 단어가 있으면 추가
                                if (currentWord.length > 0) {
                                    result.push(currentWord);
                                    currentWord = "";
                                }
                                // 현재 항목 추가
                                if (item && item.length > 0) {
                                    result.push(item);
                                }
                            }
                        }
                        // 마지막에 남은 단어 추가
                        if (currentWord.length > 0) {
                            result.push(currentWord);
                        }
                        return result;
                    };

                    setUserPreferences({
                        concept: mergeSingleChars(Array.isArray(prefs.concept) ? prefs.concept : []),
                        mood: mergeSingleChars(Array.isArray(prefs.mood) ? prefs.mood : []),
                        regions: mergeSingleChars(Array.isArray(prefs.regions) ? prefs.regions : []),
                    });
                } else {
                    setUserPreferences(null);
                }
            }
        } catch (e) {}
    };

    const fetchCasefiles = async () => {
        try {
            // 🟢 쿠키 기반 인증: apiFetch 사용 (401 시 자동 로그아웃 방지)
            const { apiFetch } = await import("@/lib/authClient");
            const { data, response } = await apiFetch<any>("/api/users/casefiles", {
                cache: "force-cache", // 🟢 성능 최적화: 캐싱 활용
                next: { revalidate: 300 }, // 🟢 5분 캐싱
            });
            if (response.status === 401) return; // 401이면 조용히 실패
            if (data) {
                const list = Array.isArray((data as any)?.items)
                    ? (data as any).items
                    : Array.isArray(data)
                    ? data
                    : [];
                setCasefiles(
                    list.map((it: any) => ({
                        story_id: it.story_id || it.storyId || it.id,
                        title: it.title,
                        synopsis: it.synopsis || it.description || "",
                        region: it.region ?? null,
                        imageUrl: it.imageUrl || it.image_url || null,
                        completedAt: it.completedAt || it.completed_at || null,
                        badge: it.badge || null,
                        photoCount: it.photoCount || it.photo_count || 0,
                    }))
                );
            } else {
                setCasefiles([]);
            }
        } catch {
            setCasefiles([]);
        }
    };

    const fetchSavedCourses = async () => {
        try {
            // 🟢 쿠키 기반 인증: apiFetch 사용 (401 시 자동 로그아웃 방지)
            const { apiFetch } = await import("@/lib/authClient");
            const { data, response } = await apiFetch<any>("/api/users/me/courses?source=ai_recommendation", {
                cache: "no-store", // 🟢 오늘의 데이트 추천 직후 최신 데이터 반영
            });
            if (response.status === 401) return; // 401이면 조용히 실패
            if (data) {
                setSavedCourses((data as any).savedCourses || []);
            }
        } catch (e) {
            setSavedCourses([]);
        }
    };

    const fetchFavorites = async () => {
        try {
            // 🟢 쿠키 기반 인증: apiFetch 사용 (401 시 자동 로그아웃 방지)
            const { apiFetch } = await import("@/lib/authClient");
            const { data: raw, response } = await apiFetch<any>("/api/users/favorites", {
                cache: "force-cache", // 🟢 성능 최적화: 캐싱 활용
                next: { revalidate: 300 }, // 🟢 5분 캐싱
            });
            if (response.status === 401) return; // 401이면 조용히 실패
            if (raw) {
                const arr = Array.isArray((raw as any)?.favorites)
                    ? (raw as any).favorites
                    : Array.isArray(raw)
                    ? raw
                    : [];
                setFavorites(
                    arr.map((f: any) => ({
                        id: f.id || f.favorite_id || f.course_id,
                        course_id: f.course_id || f.courseId || f.id,
                        course: {
                            id: f.course?.id || f.course_id || f.id,
                            title: f.course?.title || f.title || "",
                            description: f.course?.description || f.description || "",
                            imageUrl: f.course?.imageUrl || f.course?.image_url || f.imageUrl || f.image_url || "",
                            price: f.course?.price || f.price || "",
                            rating: Number(f.course?.rating ?? f.rating ?? 0),
                            concept: f.course?.concept || f.concept || "",
                            grade: f.course?.grade || "FREE",
                        },
                    }))
                );
            } else {
                setFavorites([]);
            }
        } catch (e) {
            setFavorites([]);
        }
    };

    const fetchCompleted = async () => {
        try {
            // 🟢 쿠키 기반 인증: apiFetch 사용 (401 시 자동 로그아웃 방지)
            const { apiFetch } = await import("@/lib/authClient");
            const { data: raw, response } = await apiFetch<any>("/api/users/completions", {
                cache: "no-store", // 🟢 캐시 방지
            });
            if (response.status === 401) return; // 401이면 조용히 실패
            if (raw) {
                // 🟢 API 응답 구조: { courses: [...], escapes: [...] }
                const coursesList = Array.isArray((raw as any)?.courses) ? (raw as any).courses : [];

                setCompleted(
                    coursesList.map((c: any) => {
                        // 코스 이미지가 없으면 첫 번째 장소의 이미지 사용
                        const courseImageUrl =
                            c.course?.imageUrl || c.course?.image_url || c.imageUrl || c.image_url || "";
                        const firstPlaceImageUrl =
                            c.course?.coursePlaces?.[0]?.place?.imageUrl ||
                            c.course?.coursePlaces?.[0]?.place?.image_url ||
                            "";
                        const finalImageUrl = courseImageUrl || firstPlaceImageUrl || "";

                        return {
                            course_id: c.courseId || c.course_id || c.course?.id || c.id,
                            title: c.course?.title || c.title || "",
                            description: c.course?.description || c.description || "",
                            imageUrl: finalImageUrl,
                            rating: Number(c.rating ?? 0),
                            concept: c.course?.concept || c.concept || "",
                            region: c.course?.region || c.region || null,
                            completedAt: c.completedAt || c.completed_at || null,
                        };
                    })
                );
            } else {
                console.error("[MyPage] Failed to fetch completed courses");
                setCompleted([]);
            }
        } catch (error) {
            console.error("[MyPage] Completed courses fetch error:", error);
            setCompleted([]);
        }
    };

    const fetchRewards = async () => {
        try {
            // 🟢 쿠키 기반 인증: apiFetch 사용 (401 시 자동 로그아웃 방지)
            const { apiFetch } = await import("@/lib/authClient");
            const { data, response } = await apiFetch<any>("/api/users/rewards", {
                cache: "force-cache" as const,
                next: { revalidate: 300 },
            });
            if (response.status === 401) return; // 401이면 조용히 실패
            if ((data as any)?.success) setRewards((data as any).rewards || []);
        } catch {}
    };

    const fetchPayments = async () => {
        try {
            // 🟢 쿠키 기반 인증: apiFetch 사용 (401 시 자동 로그아웃 방지)
            const { apiFetch } = await import("@/lib/authClient");
            const { data, response } = await apiFetch<any>("/api/payments/history", {
                cache: "force-cache", // 🟢 성능 최적화: 캐싱 활용
                next: { revalidate: 300 }, // 🟢 5분 캐싱
            });
            if (response.status === 401) return; // 401이면 조용히 실패
            if (data) {
                setPayments((data as any).payments || []);
            }
        } catch {}
    };

    // 🟢 개인 추억 가져오기 (isPublic: false인 리뷰)
    const fetchPersonalStories = async () => {
        try {
            const { apiFetch } = await import("@/lib/authClient");
            const { data, response } = await apiFetch<any>("/api/reviews?userId=me", {
                cache: "no-store", // 🟢 캐시 비활성화하여 최신 데이터 가져오기
                next: { revalidate: 0 },
            });
            if (response.status === 401) return;
            if (data && Array.isArray(data)) {
                // 🟢 isPublic: false인 리뷰만 필터링 (명시적 체크)
                const personalStories = data.filter((review: any) => {
                    const isPublic = review.isPublic;
                    const isPrivate = isPublic === false || isPublic === "false" || isPublic === 0 || String(isPublic).toLowerCase() === "false";
                    return isPrivate;
                });
                setPersonalStories(personalStories);
            } else {
                setPersonalStories([]);
            }
        } catch (error) {
            console.error("[MyPage] Personal memories fetch error:", error);
            setPersonalStories([]);
        }
    };

    // 🟢 Data Fetching Logic (성능 최적화: 우선순위 기반 로딩)
    useEffect(() => {
        // 🟢 URL 파라미터에서 초기 탭 읽기
        let initialTab = "profile";
        try {
            const url = new URL(window.location.href);
            const tab = url.searchParams.get("tab");
            if (tab === "checkins") {
                // 🟢 checkins 탭 제거됨 - activity로 리다이렉트
                initialTab = "activity";
            } else if (["profile", "footprint", "records", "activity"].includes(tab || "")) {
                initialTab = tab || "profile";
            }
            setActiveTab(initialTab);
        } catch {}

        // 🟢 [Fix]: 로그인 직후 또는 로그아웃 직후 재로그인 시 강제로 세션 재확인 및 캐시 무효화
        const forceRefreshOnMount = async () => {
            const forceRefreshTime = typeof window !== "undefined" ? sessionStorage.getItem("auth:forceRefresh") : null;
            const loggingOutTime = typeof window !== "undefined" ? sessionStorage.getItem("auth:loggingOut") : null;
            const now = Date.now();
            
            const timeSinceLogin = forceRefreshTime ? (now - parseInt(forceRefreshTime, 10)) : Infinity;
            const timeSinceLogout = loggingOutTime ? (now - parseInt(loggingOutTime, 10)) : Infinity;
            
            // 로그인 직후 또는 로그아웃 직후 재로그인 시 세션 강제 재확인
            if ((forceRefreshTime && timeSinceLogin < 30000) || (loggingOutTime && timeSinceLogout < 60000)) {
                try {
                    // 🟢 세션 캐시 무효화를 위해 fetchSession 먼저 호출
                    // fetchSession 내부에서 auth:forceRefresh 플래그를 확인하고 캐시를 무효화함
                    const { fetchSession } = await import("@/lib/authClient");
                    await fetchSession();
                    // fetchUserInfo에서 캐시를 무시하도록 플래그가 이미 설정되어 있음
                } catch (error) {
                    console.error("[MyPage] Session revalidation failed:", error);
                }
            }
        };

        // 🟢 [Performance]: 초기 로딩 최적화 - 병렬 처리 및 빠른 UI 표시
        // 🟢 [Fix]: 로그인 직후 또는 로그아웃 직후 재로그인 시에는 세션 재확인을 먼저 완료한 후 데이터 로드 (캐시 무효화 보장)
        const forceRefreshTime = typeof window !== "undefined" ? sessionStorage.getItem("auth:forceRefresh") : null;
        const loggingOutTime = typeof window !== "undefined" ? sessionStorage.getItem("auth:loggingOut") : null;
        const now = Date.now();
        
        const timeSinceLogin = forceRefreshTime ? (now - parseInt(forceRefreshTime, 10)) : Infinity;
        const timeSinceLogout = loggingOutTime ? (now - parseInt(loggingOutTime, 10)) : Infinity;
        
        const isLoginJustAfter = forceRefreshTime && timeSinceLogin < 30000;
        const isAfterLogout = loggingOutTime && timeSinceLogout < 60000;
        
        const loadInitialData = async () => {
            // 🟢 [Fix] 마이페이지 첫 진입 시 항상 최신 프로필 조회 (재로그인 후 이전 유저가 보이는 현상 방지)
            if (typeof window !== "undefined") {
                (window as any).__forceRefreshUserInfo = true;
            }
            // 로그인 직후 또는 로그아웃 직후 재로그인: 세션 재확인
            if (isLoginJustAfter || isAfterLogout) {
                await forceRefreshOnMount();
                await new Promise(resolve => setTimeout(resolve, 100));
            }
            
            // 필수 데이터 병렬 로드
            return Promise.all([
                fetchUserInfo(),
                fetchUserPreferences(), // 프로필 탭에 필요하므로 병렬로 함께 로드
            ]);
        };
        
        loadInitialData().then(([shouldContinue]) => {
            if (shouldContinue) {
                // 🟢 2단계: 초기 탭에 필요한 데이터만 즉시 로드 (나머지는 지연)
                const scheduleDeferredLoad = () => {
                    const priorityData: Promise<any>[] = [];
                    const deferredData: Promise<any>[] = [];

                    // 초기 활성 탭에 필요한 데이터를 우선 로드
                    if (initialTab === "profile") {
                        // 프로필 탭은 이미 로드됨, 나머지 데이터는 지연 로드
                        deferredData.push(
                            fetchFavorites(),
                            fetchSavedCourses(),
                            fetchBadges(),
                            fetchCompleted(),
                            fetchCasefiles(),
                            fetchRewards(),
                            fetchPayments()
                        );
                    } else if (initialTab === "footprint") {
                        priorityData.push(fetchCompleted(), fetchCasefiles(), fetchSavedCourses(), fetchPersonalStories());
                        deferredData.push(
                            fetchFavorites(),
                            fetchBadges(),
                            fetchRewards(),
                            fetchPayments()
                        );
                    } else if (initialTab === "records") {
                        priorityData.push(fetchFavorites(), fetchSavedCourses(), fetchCompleted(), fetchCasefiles());
                        deferredData.push(fetchBadges(), fetchRewards(), fetchPayments());
                    } else if (initialTab === "activity") {
                        priorityData.push(fetchBadges(), fetchRewards(), fetchPayments());
                        deferredData.push(fetchFavorites(), fetchSavedCourses(), fetchCompleted(), fetchCasefiles());
                    } else {
                        // 기본: 모든 데이터를 지연 로드
                        deferredData.push(
                            fetchFavorites(),
                            fetchSavedCourses(),
                            fetchBadges(),
                            fetchCompleted(),
                            fetchCasefiles(),
                            fetchRewards(),
                            fetchPayments()
                        );
                    }

                    // 우선순위 데이터 먼저 로드
                    if (priorityData.length > 0) {
                        Promise.all(priorityData).catch((error) => {
                            console.error("[MyPage] Priority data load failed:", error);
                        });
                    }

                    // 나머지 데이터는 추가 지연 후 로드 (초기 렌더링 후)
                    setTimeout(() => {
                        if (deferredData.length > 0) {
                            Promise.all(deferredData).catch((error) => {
                                console.error("[MyPage] Deferred data load failed:", error);
                            });
                        }
                    }, 100); // 🟢 100ms로 단축하여 더 빠른 로딩
                };

                // 🟢 즉시 실행하여 모든 데이터가 확실히 로드되도록 함
                // 🟢 requestIdleCallback은 브라우저가 idle 상태일 때만 실행되므로,
                // 🟢 timeout을 짧게 설정하거나 바로 실행하도록 변경
                if (typeof window !== "undefined" && "requestIdleCallback" in window) {
                    (window as any).requestIdleCallback(scheduleDeferredLoad, { timeout: 200 });
                } else {
                    // 폴백: 즉시 실행
                    setTimeout(scheduleDeferredLoad, 50);
                }
            }
        }).catch((error) => {
            console.error("[MyPage] Initial data load failed:", error);
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // 🟢 초기 마운트 시에만 실행

    // 🟢 로그아웃 이벤트 리스너 - 로그아웃 시 모든 데이터 초기화 (리다이렉트는 Header나 authClient가 담당)
    useEffect(() => {
        const handleAuthLogout = () => {
            // 1. 🟢 즉시 데이터만 비움 (리다이렉트는 Header나 authClient가 담당)
            setUserInfo(null);
            setUserPreferences(null);
            setFavorites([]);
            setBadges([]);
            setRewards([]);
            setPayments([]);
            setCompleted([]);
            setCasefiles([]);
            setSavedCourses([]);
            setPersonalStories([]);
        };

        window.addEventListener("authLogout", handleAuthLogout as EventListener);
        return () => window.removeEventListener("authLogout", handleAuthLogout as EventListener);
    }, []);

    // 🟢 결제 완료 이벤트 리스너 (구매 내역 즉시 업데이트)
    useEffect(() => {
        const handlePaymentSuccess = () => {
            console.log("[MyPage] Payment success detected - refreshing purchase and user data");
            // 🟢 캐시 무시하여 최신 정보 가져오기
            (window as any).__forceRefreshUserInfo = true;
            Promise.all([
                fetchUserInfo(),
                fetchPayments()
            ]).catch((err) => {
                console.error("[MyPage] Failed to refresh after payment:", err);
            });
        };
        window.addEventListener("paymentSuccess", handlePaymentSuccess as EventListener);
        return () => window.removeEventListener("paymentSuccess", handlePaymentSuccess as EventListener);
    }, [fetchUserInfo]);

    // 🟢 환불 완료 이벤트 리스너 (환불 후 구독/열람권 정보 실시간 업데이트)
    useEffect(() => {
        const handleRefundSuccess = (event: any) => {
            console.log("[MyPage] Refund completed - refreshing user data", event.detail);
            // 🟢 캐시 무시 플래그 설정
            (window as any).__forceRefreshUserInfo = true;
            // 🟢 환불 완료 시 사용자 정보와 구매 내역 모두 갱신 (구독/열람권 정보 실시간 반영)
            Promise.all([
                fetchUserInfo(),
                fetchPayments()
            ]).catch((err) => {
                console.error("[MyPage] Failed to refresh after refund:", err);
            });
        };
        window.addEventListener("refundSuccess", handleRefundSuccess as EventListener);
        return () => window.removeEventListener("refundSuccess", handleRefundSuccess as EventListener);
    }, [fetchUserInfo]);

    // 🟢 구독 변경 이벤트 리스너 (구독 변경 시 즉시 데이터 갱신)
    useEffect(() => {
        const handleSubscriptionChanged = () => {
            console.log("[MyPage] Subscription change detected - refreshing user data");
            // 🟢 캐시 무시 플래그 설정
            (window as any).__forceRefreshUserInfo = true;
            // 🟢 구독 변경 시 사용자 정보 갱신
            fetchUserInfo().catch((err) => {
                console.error("[MyPage] Failed to refresh after subscription change:", err);
            });
        };
        window.addEventListener("subscriptionChanged", handleSubscriptionChanged as EventListener);
        return () => window.removeEventListener("subscriptionChanged", handleSubscriptionChanged as EventListener);
    }, [fetchUserInfo]);

    // 🟢 TicketPlans 모달 열기 이벤트 리스너
    useEffect(() => {
        const handleOpenTicketPlans = () => {
            setShowSubscriptionModal(true);
        };
        window.addEventListener("openTicketPlans", handleOpenTicketPlans as EventListener);
        return () => window.removeEventListener("openTicketPlans", handleOpenTicketPlans as EventListener);
    }, []);

    // 🟢 오늘의 데이트 추천 자동 저장 후 리스트 갱신
    useEffect(() => {
        const handleSavedCoursesChanged = () => {
            fetchSavedCourses().catch(() => {});
        };
        window.addEventListener("savedCoursesChanged", handleSavedCoursesChanged);
        return () => window.removeEventListener("savedCoursesChanged", handleSavedCoursesChanged);
    }, []);

    // ----- Handlers -----

    const handleSelectTab = (id: string, ev: React.MouseEvent<HTMLButtonElement>) => {
        // 🟢 [Performance]: 탭 변경을 다음 프레임으로 지연하여 부드러운 전환
        requestAnimationFrame(() => {
            setActiveTab(id);

            // 🟢 탭 변경 시 필요한 데이터가 없으면 로드
            if (id === "footprint" && (completed.length === 0 || casefiles.length === 0 || savedCourses.length === 0)) {
                Promise.all([fetchCompleted(), fetchCasefiles(), fetchSavedCourses(), fetchPersonalStories()]).catch(() => {});
            } else if (
                id === "records" &&
                (favorites.length === 0 ||
                    savedCourses.length === 0 ||
                    completed.length === 0 ||
                    casefiles.length === 0)
            ) {
                Promise.all([fetchFavorites(), fetchSavedCourses(), fetchCompleted(), fetchCasefiles()]).catch(
                    () => {}
                );
            } else if (
                id === "activity" &&
                (badges.length === 0 || rewards.length === 0 || payments.length === 0)
            ) {
                Promise.all([fetchBadges(), fetchRewards(),  fetchPayments()]).catch(() => {});
            }
        });
        try {
            const container = tabsTrackRef.current;
            const button = ev.currentTarget as HTMLButtonElement;
            if (!container || !button) return;
            const containerRect = container.getBoundingClientRect();
            const buttonRect = button.getBoundingClientRect();
            const currentScrollLeft = container.scrollLeft;
            const deltaToCenter =
                buttonRect.left - containerRect.left - (containerRect.width / 2 - buttonRect.width / 2);
            const target = currentScrollLeft + deltaToCenter;
            container.scrollTo({ left: Math.max(0, target), behavior: "smooth" });
        } catch {}
    };

    const handleLogoutClick = () => setShowLogoutModal(true);
    const handleLogout = async () => {
        // 🟢 [Fix]: 이미 로그아웃 중이면 중복 실행 방지
        if (isLoggingOut) {
            return;
        }

        // 🟢 모달 닫기
        setShowLogoutModal(false);
        setIsLoggingOut(true);

        try {
            // 🟢 쿠키 기반 인증: logout 함수 사용 (스플래시 화면 포함)
            const { logout } = await import("@/lib/authClient");
            await logout();
        } catch (error) {
            console.error("Error during logout handling:", error);
            setIsLoggingOut(false);
            // 에러 발생 시에도 메인으로 이동
            if (typeof window !== "undefined") {
                sessionStorage.removeItem("dona-splash-shown");
                window.location.replace("/");
            }
        }
    };

    const handleEditClick = () => {
        if (userInfo) {
            setEditForm({
                name: userInfo.name || "",
                email: userInfo.email || "",
                mbti: userInfo.mbti || "",
                age: userInfo.age?.toString() || "",
                ageRange: userInfo.ageRange || "",
                gender: userInfo.gender || "",
            });
            setShowEditModal(true);
            setEditError("");
        }
    };

    const handleEditSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setEditLoading(true);
        setEditError("");
        try {
            // 🟢 쿠키 기반 인증: authenticatedFetch 사용
            const { authenticatedFetch } = await import("@/lib/authClient");
            const data = await authenticatedFetch("/api/users/profile", {
                method: "PUT",
                body: JSON.stringify(editForm),
            });
            if (data) {
                setUserInfo({
                    ...userInfo!,
                    name: editForm.name,
                    email: editForm.email,
                    mbti: editForm.mbti || null,
                    age: editForm.age ? parseInt(editForm.age) : null,
                    ageRange: editForm.ageRange || null,
                    gender: editForm.gender || null,
                });
                setShowEditModal(false);
                alert(t("mypage.profileEditSuccess"));
            } else {
                setEditError((data as any)?.error || t("mypage.profileEditFailed"));
            }
        } catch (error) {
            setEditError(t("mypage.profileEditError"));
        } finally {
            setEditLoading(false);
        }
    };

    const handleEditChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setEditForm({ ...editForm, [e.target.name]: e.target.value });
    };

    const removeFavorite = async (courseId: number) => {
        try {
            // 🟢 쿠키 기반 인증: authenticatedFetch 사용
            const { authenticatedFetch } = await import("@/lib/authClient");
            const result = await authenticatedFetch(`/api/users/favorites?courseId=${courseId}`, {
                method: "DELETE",
            });
            if (result !== null) {
                setFavorites((prev) => prev.filter((fav) => fav.course_id !== courseId));
            }
        } catch (error) {
            console.error("Failed to remove favorite:", error);
        }
    };

    const openCaseModal = async (storyId: number, title: string) => {
        setSelectedCaseStoryId(storyId);
        setSelectedCaseTitle(title);
        setCasePhotoUrls([]);
        setCasePhotoLoading(true);
        try {
            // 🟢 쿠키 기반 인증: apiFetch 사용
            const { apiFetch } = await import("@/lib/authClient");
            // 1) 콜라주 확인
            const { data: collageData, response: resCollages } = await apiFetch(`/api/collages?storyId=${storyId}`);
            if (resCollages.ok && collageData) {
                const items: any[] = Array.isArray((collageData as any)?.items) ? (collageData as any).items : [];
                const urls = items.map((it) => String(it?.thumbnailUrl || it?.collageUrl || "")).filter(Boolean);
                if (urls.length > 0) {
                    setCasePhotoUrls(urls);
                    return;
                }
            }
            // 2) 폴백: 제출 사진
            const { data: submissionData, response: res } = await apiFetch(
                `/api/escape/submissions?storyId=${storyId}`
            );
            if (res.ok && submissionData) {
                const data = submissionData;
                const urls = Array.isArray(data) ? data : Array.isArray((data as any)?.urls) ? (data as any).urls : [];
                setCasePhotoUrls(urls);
            }
        } catch {
            setCasePhotoUrls([]);
        } finally {
            setCasePhotoLoading(false);
        }
    };

    // Kakao Share Logic (Modal용)
    const ensureKakaoSdk = async (): Promise<any | null> => {
        if (typeof window === "undefined") return null;
        if (!window.Kakao) {
            await new Promise<void>((resolve, reject) => {
                const script = document.createElement("script");
                script.src = "https://t1.kakaocdn.net/kakao_js_sdk/2.7.2/kakao.min.js";
                script.async = true;
                script.onload = () => resolve();
                script.onerror = () => reject(new Error("Kakao SDK load failed"));
                document.head.appendChild(script);
            });
        }
        const Kakao = window.Kakao;
        try {
            if (Kakao && !Kakao.isInitialized?.()) {
                const jsKey =
                    process.env.NEXT_PUBLIC_KAKAO_JS_KEY ||
                    process.env.NEXT_PUBLIC_KAKAO_JAVASCRIPT_KEY ||
                    process.env.NEXT_PUBLIC_KAKAO_MAP_API_KEY;
                if (!jsKey) return Kakao;
                Kakao.init(jsKey);
            }
        } catch {}
        return Kakao || null;
    };

    const shareBadgeToKakao = async (badge: UserBadgeItem) => {
        try {
            const Kakao = await ensureKakaoSdk();
            // 🟢 [2025-12-28] URL 끝의 슬래시 제거하여 카카오 콘솔 등록값과 정확히 일치시킴
            const link = typeof location !== "undefined" ? location.href.replace(/\/$/, "") : "";
            const imageUrl = badge.image_url || "";
            const bragText = t("mypage.badgeBragText", { name: userInfo?.name || t("commonFallback.me"), badge: badge.name });
            if (Kakao && Kakao.Share) {
                Kakao.Share.sendDefault({
                    objectType: "feed",
                    content: {
                        title: t("mypage.badgeShare"),
                        description: bragText,
                        imageUrl,
                        link: { webUrl: link, mobileWebUrl: link },
                    },
                    buttons: [{ title: t("mypage.badgeViewMore"), link: { webUrl: link, mobileWebUrl: link } }],
                });
                return;
            }
            // Fallback: Web Share API or Clipboard
            const shareText = `${bragText} ${link}`;
            if (navigator.share) {
                await navigator.share({ title: t("mypage.badgeShare"), text: shareText, url: link });
            } else {
                await navigator.clipboard.writeText(shareText);
                alert(t("mypage.linkCopied"));
            }
        } catch {
            alert(t("mypage.shareFailed"));
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-linear-to-br from-blue-50 via-white to-purple-50 dark:from-[#0f1710] dark:via-[#0f1710] dark:to-[#1a241b]">
                <main className="max-w-4xl mx-auto px-4 py-8 pt-24">
                    <div className="text-center">
                        <div className="mb-4 flex items-center justify-center">
                            <svg xmlns="http://www.w3.org/2000/svg" width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-700 dark:text-gray-300">
                                <path d="M5 22h14"/>
                                <path d="M5 2h14"/>
                                <path d="M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22"/>
                                <path d="M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2"/>
                            </svg>
                        </div>
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">{t("mypage.loading")}</h1>
                        <p className="text-gray-600 dark:text-gray-400">{t("mypage.loadingDesc")}</p>
                    </div>
                </main>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-linear-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800 typography-smooth">
            <main className="max-w-4xl mx-auto px-4 py-6 md:py-8 pt-10 ">
                <div className="text-center mb-6 md:mb-8">
                    <h1 className="text-2xl md:text-4xl font-bold text-gray-900 dark:text-white mb-1 md:mb-2 tracking-tight">
                        {t("mypage.pageTitle")}
                    </h1>
                    <p className="text-sm md:text-[17px] text-gray-600 dark:text-gray-400">
                        {t("mypage.pageSubtitle")}
                    </p>
                </div>

                <div className="flex justify-center mb-6 md:mb-8">
                    <HorizontalScrollContainer
                        ref={tabsTrackRef}
                        scrollMode="drag"
                        className="bg-white dark:bg-[#1a241b] rounded-lg border border-gray-100 dark:border-gray-800 p-2 w-full max-w-2xl overflow-x-auto scrollbar-hide"
                    >
                        <div className="flex space-x-2 min-w-max">
                            {[
                                { 
                                    id: "profile", 
                                    label: t("mypage.tabProfile"), 
                                    icon: (
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-6 h-6">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M17.982 18.725A7.488 7.488 0 0 0 12 15.75a7.488 7.488 0 0 0-5.982 2.975m11.963 0a9 9 0 1 0-11.963 0m11.963 0A8.966 8.966 0 0 1 12 21a8.966 8.966 0 0 1-5.982-2.275M15 9.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                                        </svg>
                                    )
                                },
                                { 
                                    id: "footprint", 
                                    label: t("mypage.tabFootprint"), 
                                    icon: (
                                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
                                            <path d="M4 16v-2.38C4 11.5 2.97 10.5 3 8c.03-2.72 1.49-6 4.5-6C9.37 2 10 3.8 10 5.5c0 3.11-2 5.66-2 8.68V16a2 2 0 1 1-4 0Z"/>
                                            <path d="M20 20v-2.38c0-2.12 1.03-3.12 1-5.62-.03-2.72-1.49-6-4.5-6C14.63 6 14 7.8 14 9.5c0 3.11 2 5.66 2 8.68V20a2 2 0 1 0 4 0Z"/>
                                            <path d="M16 17h4"/>
                                            <path d="M4 13h4"/>
                                        </svg>
                                    )
                                },
                                { 
                                    id: "records", 
                                    label: t("mypage.tabRecords"), 
                                    icon: (
                                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
                                            <path d="M16 14v2.2l1.6 1"/>
                                            <path d="M7 20H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H20a2 2 0 0 1 2 2"/>
                                            <circle cx="16" cy="16" r="6"/>
                                        </svg>
                                    )
                                },
                                { id: "activity", label: t("mypage.tabActivity"), icon: (
                                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
                                        <path d="M7.21 15 2.66 7.14a2 2 0 0 1 .13-2.2L4.4 2.8A2 2 0 0 1 6 2h12a2 2 0 0 1 1.6.8l1.6 2.14a2 2 0 0 1 .14 2.2L16.79 15"/>
                                        <path d="M11 12 5.12 2.2"/>
                                        <path d="m13 12 5.88-9.8"/>
                                        <path d="M8 7h8"/>
                                        <circle cx="12" cy="17" r="5"/>
                                        <path d="M12 18v-2h-.5"/>
                                    </svg>
                                ) },
                            ].map((tab) => (
                                <button
                                    key={tab.id}
                                    onClick={(e) => handleSelectTab(tab.id, e)}
                                    aria-selected={activeTab === tab.id}
                                    className={`shrink-0 px-4 md:px-5 py-2.5 md:py-3 rounded-lg font-medium transition-all cursor-pointer text-sm md:text-base flex flex-col items-center gap-1 whitespace-nowrap ${
                                        activeTab === tab.id
                                            ? "bg-blue-600 dark:bg-blue-700 text-white shadow-lg"
                                            : "text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-50 dark:hover:bg-gray-800"
                                    }`}
                                >
                                    {typeof tab.icon === "string" ? (
                                        <span className="text-base md:text-lg">{tab.icon}</span>
                                    ) : (
                                        <span className="w-6 h-6 flex items-center justify-center">{tab.icon}</span>
                                    )}
                                    <span>{tab.label}</span>
                                </button>
                            ))}
                        </div>
                    </HorizontalScrollContainer>
                </div>

                {/* 🟢 성능 최적화: Suspense로 동적 로딩된 컴포넌트 처리. locale 메시지 준비 전에는 스피너만 표시해 zh/ko 섞임 방지 */}
                {activeTab === "profile" && (
                    !isLocaleReady ? (
                        <div className="flex items-center justify-center py-20">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
                        </div>
                    ) : (
                        <Suspense
                            fallback={
                                <div className="flex items-center justify-center py-20">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
                                </div>
                            }
                        >
                            <ProfileTab
                                // 🟢 key를 추가하여 userInfo가 바뀔 때마다 ProfileTab을 새로 그리게 합니다.
                                key={userInfo?.subscriptionTier || "loading"}
                                userInfo={userInfo}
                                userPreferences={userPreferences}
                                onEditProfile={handleEditClick}
                                onEditPreferences={() => router.push("/onboarding?reset=true")}
                                onOpenPwModal={() => {
                                    setPwModalOpen(true);
                                    setPwStep("verify");
                                    setPwState({ current: "", next: "", confirm: "" });
                                    setPwError("");
                                }}
                                onLogout={handleLogoutClick}
                            />
                        </Suspense>
                    )
                )}

                {activeTab === "footprint" && (
                    !isLocaleReady ? (
                        <div className="flex items-center justify-center py-20">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
                        </div>
                    ) : (
                        <Suspense
                            fallback={
                                <div className="flex items-center justify-center py-20">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
                                </div>
                            }
                        >
                            <FootprintTab
                                casefiles={casefiles}
                                completed={completed}
                                aiRecommendations={savedCourses}
                                userName={userInfo?.name || ""}
                                personalStories={personalStories}
                            />
                        </Suspense>
                    )
                )}

                {activeTab === "records" && (
                    !isLocaleReady ? (
                        <div className="flex items-center justify-center py-20">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
                        </div>
                    ) : (
                        <Suspense
                            fallback={
                                <div className="flex items-center justify-center py-20">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
                                </div>
                            }
                        >
                            <RecordsTab
                                favorites={favorites}
                                savedCourses={savedCourses}
                                completed={completed}
                                casefiles={casefiles}
                                onRemoveFavorite={removeFavorite}
                                onOpenCaseModal={openCaseModal}
                                userTier={userInfo?.subscriptionTier}
                            />
                        </Suspense>
                    )
                )}

                {activeTab === "activity" && (
                    !isLocaleReady ? (
                        <div className="flex items-center justify-center py-20">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
                        </div>
                    ) : (
                        <Suspense
                            fallback={
                                <div className="flex items-center justify-center py-20">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
                                </div>
                            }
                        >
                            <ActivityTab
                                badges={badges}
                                rewards={rewards}
                                payments={payments}
                                onSelectBadge={setSelectedBadge}
                                initialSubTab={activitySubTab}
                            />
                        </Suspense>
                    )
                )}
            </main>

            {/* 모달: 전체 화면 이미지 */}
            {fullImageUrl && (
                <div
                    className="fixed inset-0 z-60 bg-black/90 flex items-center justify-center p-4"
                    onClick={() => setFullImageUrl(null)}
                >
                    <button
                        onClick={() => setFullImageUrl(null)}
                        className="absolute top-4 right-4 px-3 py-1.5 rounded-lg bg-white/90 dark:bg-[#1a241b]/90 text-gray-900 dark:text-white hover:bg-white dark:hover:bg-[#1a241b] shadow"
                    >
                        {t("mypage.close")}
                    </button>
                    <img
                        src={fullImageUrl}
                        alt={t("mypage.fullImageAlt")}
                        className="max-h-[90vh] max-w-[96vw] object-contain rounded"
                        onClick={(e) => e.stopPropagation()}
                    />
                </div>
            )}

            {/* 모달: 사건 파일 상세 */}
            {selectedCaseStoryId !== null && (
                <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-[#1a241b] rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden shadow-xl">
                        <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-800">
                            <h3 className="text-lg md:text-xl font-bold text-gray-900 dark:text-white">
                                {selectedCaseTitle}
                            </h3>
                            <button
                                onClick={() => {
                                    setSelectedCaseStoryId(null);
                                    setCasePhotoUrls([]);
                                }}
                                className="px-3 py-1.5 text-sm rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
                            >
                                {t("mypage.close")}
                            </button>
                        </div>
                        <div className="p-4 overflow-y-auto">
                            {casePhotoLoading ? (
                                <div className="py-16 text-center text-gray-600 dark:text-gray-400">{t("mypage.caseModalLoading")}</div>
                            ) : casePhotoUrls.length > 0 ? (
                                <div className="grid grid-cols-1 gap-3 md:gap-4">
                                    {casePhotoUrls.slice(0, 1).map((u, i) => (
                                        <button
                                            key={i}
                                            onClick={() => setFullImageUrl(u)}
                                            className="bg-[#a5743a] dark:bg-gray-800 rounded-lg p-2 shadow-inner text-left"
                                        >
                                            <div className="bg-[#f8f5ef] dark:bg-gray-700 rounded-lg p-2 border-2 border-[#704a23] dark:border-gray-600">
                                                <img
                                                    src={u}
                                                    alt={t("mypage.caseModalPhotoAlt", { n: i + 1 })}
                                                    className="w-full h-full object-cover rounded cursor-zoom-in"
                                                />
                                            </div>
                                            <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                                                {t("mypage.caseModalExpandHint")}
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            ) : (
                                <div className="py-16 text-center text-gray-600 dark:text-gray-400">
                                    {t("mypage.noCasePhotos")}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* 모달: 비밀번호 변경 */}
            {pwModalOpen && pwStep === "verify" && (
                <PasswordCheckModal
                    error={pwError}
                    onClose={() => {
                        setPwModalOpen(false);
                        setPwError("");
                        setPwState({ current: "", next: "", confirm: "" });
                    }}
                    onConfirm={async (password) => {
                        setPwLoading(true);
                        setPwError("");
                        try {
                            // 🟢 쿠키 기반 인증: authenticatedFetch 사용
                            const { authenticatedFetch } = await import("@/lib/authClient");
                            const result = await authenticatedFetch<{ ok?: boolean; error?: string }>(
                                "/api/users/password/verify",
                                {
                                    method: "POST",
                                    body: JSON.stringify({ currentPassword: password }),
                                }
                            );
                            if (!result || !result.ok) {
                                throw new Error(result?.error || t("mypage.pwWrongCurrent"));
                            }
                            // 현재 비밀번호 저장하고 다음 단계로
                            setPwState((s) => ({ ...s, current: password }));
                            setPwStep("change");
                        } catch (err: any) {
                            setPwError(err.message || t("mypage.pwErrorGeneric"));
                        } finally {
                            setPwLoading(false);
                        }
                    }}
                />
            )}
            {pwModalOpen && pwStep === "change" && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white dark:bg-[#1a241b] rounded-2xl shadow-xl p-6 w-[90vw] max-w-md mx-4">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-xl font-bold text-gray-900 dark:text-white">{t("mypage.pwChangeTitle")}</h3>
                            <button
                                className="hover:cursor-pointer text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 text-2xl"
                                onClick={() => {
                                    setPwModalOpen(false);
                                    setPwError("");
                                    setPwState({ current: "", next: "", confirm: "" });
                                    setPwStep("verify");
                                }}
                            >
                                <span className="symbol-ko-font">×</span>
                            </button>
                        </div>
                        {pwError && (
                            <div className="mb-3 rounded border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-900/30 p-2 text-sm text-red-700 dark:text-red-400">
                                {pwError}
                            </div>
                        )}
                        <form
                            onSubmit={async (e) => {
                                e.preventDefault();
                                setPwLoading(true);
                                setPwError("");
                                try {
                                    // 🟢 쿠키 기반 인증: authenticatedFetch 사용
                                    const { authenticatedFetch } = await import("@/lib/authClient");

                                    if (pwState.next.length < 6)
                                        throw new Error(t("mypage.pwMinLength"));
                                    if (pwState.next !== pwState.confirm)
                                        throw new Error(t("mypage.pwMismatch"));

                                    const data = await authenticatedFetch("/api/users/password", {
                                        method: "PUT",
                                        body: JSON.stringify({
                                            currentPassword: pwState.current,
                                            newPassword: pwState.next,
                                        }),
                                    });
                                    if (!data || !(data as any)?.success)
                                        throw new Error((data as any)?.error || t("mypage.pwChangeFailed"));

                                    setPwModalOpen(false);
                                    setPwState({ current: "", next: "", confirm: "" });
                                    setPwStep("verify");
                                    alert(t("mypage.pwChangeSuccess"));
                                    handleLogout();
                                } catch (err: any) {
                                    setPwError(err.message || t("mypage.pwErrorGeneric"));
                                } finally {
                                    setPwLoading(false);
                                }
                            }}
                            className="space-y-4"
                        >
                            <div>
                                <label                                     className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    {t("mypage.pwChangeLabel")}
                                </label>
                                <input
                                    type="password"
                                    value={pwState.next}
                                    onChange={(e) => setPwState((s) => ({ ...s, next: e.target.value }))}
                                    required
                                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-[#0f1710] text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500"
                                    placeholder={t("mypage.pwPlaceholder")}
                                />
                            </div>
                            <div>
                                <label                                     className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    {t("mypage.pwChangeLabelConfirm")}
                                </label>
                                <input
                                    type="password"
                                    value={pwState.confirm}
                                    onChange={(e) => setPwState((s) => ({ ...s, confirm: e.target.value }))}
                                    required
                                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-[#0f1710] text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500"
                                    placeholder={t("mypage.pwPlaceholderConfirm")}
                                />
                            </div>
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setPwModalOpen(false);
                                        setPwError("");
                                        setPwState({ current: "", next: "", confirm: "" });
                                        setPwStep("verify");
                                    }}
                                    className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 bg-white dark:bg-[#1a241b] rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800"
                                >
                                    {t("mypage.cancel")}
                                </button>
                                <button
                                    type="submit"
                                    disabled={pwLoading}
                                    className="flex-1 px-4 py-3 bg-slate-900 text-white rounded-lg disabled:opacity-50 tracking-tight font-bold hover:bg-slate-800 transition-colors"
                                >
                                    {pwLoading ? t("mypage.pwChangeProcessing") : t("mypage.pwChangeButton")}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* 모달: 프로필 수정 */}
            {showEditModal && (
                <div className="fixed inset-0 backdrop-blur-sm flex items-end justify-center z-9999">
                    <div 
                        className="bg-white dark:bg-[#1a241b] rounded-t-3xl border-t border-gray-100 dark:border-gray-800 p-8 w-full max-w-md mx-4 mb-0 scrollbar-hide" 
                        style={{ 
                            marginTop: '20vh',
                            maxHeight: '80vh', 
                            overflowY: 'auto'
                        }}
                    >
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
                                {t("mypage.profileEdit")}
                            </h3>
                            <button
                                onClick={() => setShowEditModal(false)}
                                className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 text-2xl"
                            >
                                <span className="symbol-ko-font">×</span>
                            </button>
                        </div>
                        <form onSubmit={handleEditSubmit} className="space-y-6">
                            {editError && (
                                <div className="p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400 text-sm">
                                    {editError}
                                </div>
                            )}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    {t("mypage.nickname")}
                                </label>
                                <input
                                    type="text"
                                    name="name"
                                    value={editForm.name || ""}
                                    onChange={handleEditChange}
                                    required
                                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-[#0f1710] text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    {t("mypage.email")}
                                </label>
                                <input
                                    type="email"
                                    name="email"
                                    value={editForm.email || ""}
                                    onChange={handleEditChange}
                                    required
                                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-[#0f1710] text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    {t("mypage.mbtiLabel")}
                                </label>
                                <select
                                    name="mbti"
                                    value={editForm.mbti || ""}
                                    onChange={handleEditChange}
                                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-[#0f1710] text-gray-900 dark:text-white"
                                >
                                    <option value="">{t("mypage.mbtiSelect")}</option>
                                    {[
                                        "INTJ",
                                        "INTP",
                                        "ENTJ",
                                        "ENTP",
                                        "INFJ",
                                        "INFP",
                                        "ENFJ",
                                        "ENFP",
                                        "ISTJ",
                                        "ISFJ",
                                        "ESTJ",
                                        "ESFJ",
                                        "ISTP",
                                        "ISFP",
                                        "ESTP",
                                        "ESFP",
                                    ].map((m) => (
                                        <option key={m} value={m}>
                                            {m}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    {t("mypage.age")}
                                </label>
                                <input
                                    type="number"
                                    name="age"
                                    value={editForm.age || ""}
                                    onChange={handleEditChange}
                                    min="1"
                                    max="120"
                                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-[#0f1710] text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    {t("mypage.ageRange")} <span className="text-red-500">*</span>
                                </label>
                                <select
                                    name="ageRange"
                                    value={editForm.ageRange || ""}
                                    onChange={handleEditChange}
                                    required
                                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-[#0f1710] text-gray-900 dark:text-white"
                                >
                                    <option value="">{t("mypage.selectAgeRange")}</option>
                                    <option value="10대">{t("mypage.age10s")}</option>
                                    <option value="20대">{t("mypage.age20s")}</option>
                                    <option value="30대">{t("mypage.age30s")}</option>
                                    <option value="40대">{t("mypage.age40s")}</option>
                                    <option value="50대 이상">{t("mypage.age50s")}</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    {t("mypage.gender")} <span className="text-red-500">*</span>
                                </label>
                                <select
                                    name="gender"
                                    value={editForm.gender || ""}
                                    onChange={handleEditChange}
                                    required
                                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-[#0f1710] text-gray-900 dark:text-white"
                                >
                                    <option value="">{t("mypage.selectGender")}</option>
                                    <option value="M">{t("mypage.genderMale")}</option>
                                    <option value="F">{t("mypage.genderFemale")}</option>
                                </select>
                            </div>
                            <div className="flex space-x-3">
                                <button
                                    type="button"
                                    onClick={() => setShowEditModal(false)}
                                    className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 bg-white dark:bg-[#1a241b] rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800"
                                >
                                    {t("mypage.cancel")}
                                </button>
                                <button
                                    type="submit"
                                    disabled={editLoading}
                                    className="flex-1 px-4 py-3 bg-slate-900 text-white rounded-lg disabled:opacity-50 tracking-tight font-bold hover:bg-slate-800 transition-colors"
                                >
                                    {editLoading ? t("mypage.submitting") : t("mypage.submit")}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* 로그아웃 모달 */}
            {showLogoutModal && <LogoutModal onClose={() => setShowLogoutModal(false)} onConfirm={handleLogout} />}

            {/* 모달: 뱃지 상세 */}
            {selectedBadge && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white dark:bg-[#1a241b] rounded-xl border border-gray-100 dark:border-gray-800 p-6 w-[90vw] max-w-md mx-4">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-xl font-bold text-gray-900 dark:text-white tracking-tight">
                                {selectedBadge.name}
                            </h3>
                            <button
                                className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 text-2xl"
                                onClick={() => setSelectedBadge(null)}
                            >
                                <span className="symbol-ko-font">×</span>
                            </button>
                        </div>
                        <div className="flex flex-col items-center text-center">
                            {selectedBadge.image_url ? (
                                <img
                                    src={selectedBadge.image_url}
                                    alt={selectedBadge.name}
                                    className="w-40 h-40 object-contain mb-3"
                                />
                            ) : (
                                <div className="w-40 h-40 mb-3 rounded-full bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center text-6xl">
                                    🏅
                                </div>
                            )}
                            {selectedBadge.description && (
                                <div className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap mb-3">
                                    {selectedBadge.description}
                                </div>
                            )}
                            <div className="text-xs text-gray-400 dark:text-gray-500 mb-4">
                                {t("mypage.badgeAcquiredDate")}: {new Date(selectedBadge.awarded_at).toLocaleDateString()}
                            </div>
                            <div className="flex gap-2">
                                <button
                                    className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#1a241b] hover:bg-gray-50 dark:hover:bg-gray-800 text-black dark:text-white"
                                    onClick={() => shareBadgeToKakao(selectedBadge)}
                                >
                                    {t("mypage.badgeBrag")}
                                </button>
                                <button
                                    className="px-4 py-2 rounded-lg bg-blue-600 dark:bg-blue-700 text-white hover:bg-blue-700 dark:hover:bg-blue-600"
                                    onClick={() => setSelectedBadge(null)}
                                >
                                    {t("mypage.close")}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* 🟢 TicketPlans 모달 - 즉시 로드 (lazy 제거로 열림 속도 개선) */}
            {showSubscriptionModal && (
                <TicketPlans context="UPGRADE" onClose={() => setShowSubscriptionModal(false)} />
            )}
        </div>
    );
};

export default MyPage;
