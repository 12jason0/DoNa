"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import ProfileTab from "@/components/mypage/ProfileTab";
import FootprintTab from "@/components/mypage/FootprintTab";
import RecordsTab from "@/components/mypage/RecordsTab";
import ActivityTab from "@/components/mypage/ActivityTab";
import LogoutModal from "@/components/LogoutModal";
import PasswordCheckModal from "@/components/passwordChackModal";
import {
    UserInfo,
    UserPreferences,
    Favorite,
    UserBadgeItem,
    UserRewardRow,
    UserCheckinRow,
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
    const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
    const [userPreferences, setUserPreferences] = useState<UserPreferences | null>(null);
    const [favorites, setFavorites] = useState<Favorite[]>([]);
    const [savedCourses, setSavedCourses] = useState<any[]>([]);
    const [completed, setCompleted] = useState<CompletedCourse[]>([]);
    const [badges, setBadges] = useState<UserBadgeItem[]>([]);
    const [casefiles, setCasefiles] = useState<CasefileItem[]>([]);
    const [rewards, setRewards] = useState<UserRewardRow[]>([]);
    const [checkins, setCheckins] = useState<UserCheckinRow[]>([]);
    const [payments, setPayments] = useState<any[]>([]);

    const [activeTab, setActiveTab] = useState("profile");
    const tabsTrackRef = useRef<HTMLDivElement | null>(null);

    const [loading, setLoading] = useState(true);

    // Modal States
    const [showEditModal, setShowEditModal] = useState(false);
    const [editForm, setEditForm] = useState({ name: "", email: "", mbti: "", age: "" });
    const [editLoading, setEditLoading] = useState(false);
    const [editError, setEditError] = useState("");

    const [showLogoutModal, setShowLogoutModal] = useState(false);

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

    // ----- Data Fetching Logic (기존 유지) -----
    useEffect(() => {
        // 🟢 fetchUserInfo가 먼저 실행되어 인증 상태를 확인한 후, 성공하면 나머지 데이터 로드
        // fetchUserInfo에서 401이면 router.push("/login")을 하므로 다른 fetch는 실행되지 않음
        fetchUserInfo().then((shouldContinue) => {
            // fetchUserInfo가 성공한 경우에만 나머지 데이터 로드
            if (shouldContinue) {
                fetchUserPreferences();
                fetchFavorites();
                fetchSavedCourses();
                fetchBadges();
                fetchCompleted();
                fetchCasefiles();
                fetchRewards();
                fetchCheckins();
                fetchPayments();
            }
        });

        try {
            const url = new URL(window.location.href);
            const tab = url.searchParams.get("tab");
            if (["profile", "footprint", "records", "activity"].includes(tab || "")) {
                setActiveTab(tab || "profile");
            }
        } catch {}
    }, []);

    // Event Listener for Checkin
    useEffect(() => {
        const onCheckinUpdated = () => fetchCheckins();
        window.addEventListener("checkinUpdated", onCheckinUpdated as EventListener);
        return () => window.removeEventListener("checkinUpdated", onCheckinUpdated as EventListener);
    }, []);

    const fetchUserInfo = async (): Promise<boolean> => {
        try {
            // 🟢 쿠키 기반 인증: apiFetch 사용하여 401 처리 방지
            const { apiFetch } = await import("@/lib/authClient");
            const { data: raw, response } = await apiFetch<any>("/api/users/profile", {
                cache: "no-store", // 🟢 서버 캐시 방지 추가
            });

            // 401 응답인 경우 로그인 페이지로 이동 (authenticatedFetch는 자동으로 logout 호출하므로 apiFetch 사용)
            if (response.status === 401 || !raw) {
                router.push("/login");
                return false; // 🟢 다른 fetch 함수들이 실행되지 않도록 false 반환
            }

            // 🟢 authenticatedFetch가 이미 JSON을 파싱해서 반환함
            // 🟢 디버깅 로그: 여기서 BASIC이 찍히는지 확인
            console.log("[MyPage] 서버 원본 응답:", raw);

            const src: any = (raw as any)?.user ?? raw ?? {};

            // HTTP URL을 HTTPS로 변환 (Mixed Content 경고 해결)
            const convertToHttps = (url: string | null | undefined): string => {
                if (!url) return "";
                if (url.startsWith("http://")) {
                    return url.replace(/^http:\/\//, "https://");
                }
                return url;
            };

            const profileImageUrl = src.profileImage || src.profileImageUrl || src.profile_image_url || "";

            // 🟢 subscriptionTier 확인: DB의 subscription_tier와 코드의 subscriptionTier 모두 체크
            const tier =
                src.subscription_tier ||
                src.subscriptionTier ||
                (raw as any)?.subscription_tier ||
                (raw as any)?.subscriptionTier ||
                "FREE";
            console.log("[MyPage] API 응답 subscriptionTier:", tier, "src:", src, "raw:", raw);
            console.log(
                "[MyPage] 필드명 확인 - subscription_tier:",
                src.subscription_tier,
                "subscriptionTier:",
                src.subscriptionTier
            );
            console.log("[MyPage] 최종 등급 값 (setUserInfo에 전달):", tier);

            // subscriptionExpiresAt 추출 (DB 필드명: subscription_expires_at)
            const subscriptionExpiresAt =
                src.subscriptionExpiresAt ||
                src.subscription_expires_at ||
                (raw as any)?.subscriptionExpiresAt ||
                (raw as any)?.subscription_expires_at ||
                null;

            const finalUserInfo = {
                name: src.name || src.username || src.nickname || "",
                email: src.email || src.userEmail || "",
                joinDate: src.joinDate
                    ? new Date(src.joinDate).toLocaleDateString()
                    : src.createdAt
                    ? new Date(src.createdAt).toLocaleDateString()
                    : "",
                profileImage: convertToHttps(profileImageUrl),
                mbti: src.mbti ?? null,
                age: typeof src.age === "number" ? src.age : src.age ? Number(src.age) : null,
                subscriptionTier: tier, // 🟢 확정된 등급 삽입
                subscriptionExpiresAt: subscriptionExpiresAt ? new Date(subscriptionExpiresAt).toISOString() : null, // ISO 문자열로 변환
            };
            console.log("[MyPage] setUserInfo 호출 전 최종 userInfo 객체:", finalUserInfo);
            setUserInfo(finalUserInfo);
            return true; // 🟢 성공 시 true 반환하여 다른 fetch 함수들이 실행되도록 함
        } catch (error) {
            console.error(error);
            router.push("/login"); // 🟢 에러 발생 시 로그인 페이지로 이동
            return false;
        } finally {
            setLoading(false);
        }
    };

    const fetchBadges = async () => {
        try {
            // 🟢 쿠키 기반 인증: apiFetch 사용 (401 시 자동 로그아웃 방지)
            const { apiFetch } = await import("@/lib/authClient");
            const { data, response } = await apiFetch<any>("/api/users/badges");
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
            const { data: raw, response } = await apiFetch<any>("/api/users/preferences");
            if (response.status === 401) return; // 401이면 조용히 실패
            if (raw) {
                const prefs: any = (raw as any)?.preferences ?? raw ?? {};
                const hasPreferences =
                    Object.keys(prefs).length > 0 &&
                    ((prefs.concept && Array.isArray(prefs.concept) && prefs.concept.length > 0) ||
                        prefs.companion ||
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
                        companion: prefs.companion || "",
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
            const { data, response } = await apiFetch<any>("/api/users/casefiles");
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
            const { data, response } = await apiFetch<any>("/api/users/me/courses");
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
            const { data: raw, response } = await apiFetch<any>("/api/users/favorites");
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
                console.log("[MyPage] 완료 코스 데이터:", coursesList);

                setCompleted(
                    coursesList.map((c: any) => ({
                        course_id: c.courseId || c.course_id || c.course?.id || c.id,
                        title: c.course?.title || c.title || "",
                        description: c.course?.description || c.description || "",
                        imageUrl: c.course?.imageUrl || c.course?.image_url || c.imageUrl || c.image_url || "",
                        rating: Number(c.rating ?? 0),
                        concept: c.course?.concept || c.concept || "",
                        completedAt: c.completedAt || c.completed_at || null,
                    }))
                );
            } else {
                console.error("[MyPage] 완료 코스 조회 실패");
                setCompleted([]);
            }
        } catch (error) {
            console.error("[MyPage] 완료 코스 조회 오류:", error);
            setCompleted([]);
        }
    };

    const fetchRewards = async () => {
        try {
            // 🟢 쿠키 기반 인증: apiFetch 사용 (401 시 자동 로그아웃 방지)
            const { apiFetch } = await import("@/lib/authClient");
            const { data, response } = await apiFetch<any>("/api/users/rewards");
            if (response.status === 401) return; // 401이면 조용히 실패
            if ((data as any)?.success) setRewards((data as any).rewards || []);
        } catch {}
    };

    const fetchCheckins = async () => {
        try {
            // 🟢 쿠키 기반 인증: apiFetch 사용 (401 시 자동 로그아웃 방지)
            const { apiFetch } = await import("@/lib/authClient");
            const { data, response } = await apiFetch<any>("/api/users/checkins", {
                cache: "no-store",
            });
            if (response.status === 401) return; // 401이면 조용히 실패
            if ((data as any)?.success) setCheckins((data as any).checkins || []);
        } catch {}
    };

    const fetchPayments = async () => {
        try {
            // 🟢 쿠키 기반 인증: apiFetch 사용 (401 시 자동 로그아웃 방지)
            const { apiFetch } = await import("@/lib/authClient");
            const { data, response } = await apiFetch<any>("/api/payments/history");
            if (response.status === 401) return; // 401이면 조용히 실패
            if (data) {
                setPayments((data as any).payments || []);
            }
        } catch {}
    };

    // ----- Handlers -----

    const handleSelectTab = (id: string, ev: React.MouseEvent<HTMLButtonElement>) => {
        setActiveTab(id);
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
        // 🟢 모달 닫기
        setShowLogoutModal(false);

        try {
            // 🟢 쿠키 기반 인증: logout 함수 사용 (스플래시 화면 포함)
            const { logout } = await import("@/lib/authClient");
            await logout();
        } catch (error) {
            console.error("로그아웃 처리 중 오류 발생:", error);
            // 에러 발생 시에도 메인으로 이동
            if (typeof window !== "undefined") {
                sessionStorage.removeItem("dona-splash-shown");
                window.location.href = "/";
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
                });
                setShowEditModal(false);
                alert("프로필이 성공적으로 수정되었습니다.");
            } else {
                setEditError((data as any)?.error || "프로필 수정에 실패했습니다.");
            }
        } catch (error) {
            setEditError("프로필 수정 중 오류가 발생했습니다.");
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
            const link = typeof location !== "undefined" ? location.href : "";
            const imageUrl = badge.image_url || "";
            const bragText = `${userInfo?.name || "저"}는 '${badge.name}' 배지를 획득했어요! DoNa에서 함께 도전해요 ✨`;
            if (Kakao && Kakao.Share) {
                Kakao.Share.sendDefault({
                    objectType: "feed",
                    content: {
                        title: "배지 자랑하기",
                        description: bragText,
                        imageUrl,
                        link: { webUrl: link, mobileWebUrl: link },
                    },
                    buttons: [{ title: "자세히 보기", link: { webUrl: link, mobileWebUrl: link } }],
                });
                return;
            }
            // Fallback: Web Share API or Clipboard
            const shareText = `${bragText} ${link}`;
            if (navigator.share) {
                await navigator.share({ title: "배지 자랑하기", text: shareText, url: link });
            } else {
                await navigator.clipboard.writeText(shareText);
                alert("링크가 클립보드에 복사되었습니다.");
            }
        } catch {
            alert("공유하기에 실패했습니다.");
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
                <main className="max-w-4xl mx-auto px-4 py-8 pt-24">
                    <div className="text-center">
                        <div className="text-6xl mb-4">⏳</div>
                        <h1 className="text-2xl font-bold text-gray-900 mb-2">로딩 중...</h1>
                        <p className="text-gray-600">마이페이지 정보를 불러오고 있습니다</p>
                    </div>
                </main>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 typography-smooth">
            <main className="max-w-4xl mx-auto px-4 py-6 md:py-8 pt-10 ">
                <div className="text-center mb-6 md:mb-8">
                    <h1 className="text-2xl md:text-4xl font-bold text-gray-900 mb-1 md:mb-2 tracking-tight">
                        마이페이지
                    </h1>
                    <p className="text-sm md:text-[17px] text-gray-600">내 정보와 활동을 관리해보세요</p>
                </div>

                <div className="flex justify-center mb-6 md:mb-8">
                    <div
                        className="bg-white rounded-lg border border-gray-100 p-2 overflow-x-auto no-scrollbar"
                        ref={tabsTrackRef}
                    >
                        <div className="flex space-x-2 min-w-max">
                            {[
                                { id: "profile", label: "내 정보", icon: "👤" },
                                { id: "footprint", label: "발자취", icon: "👣" },
                                { id: "records", label: "여행 기록", icon: "🗂️" },
                                { id: "activity", label: "활동 내역", icon: "🏅" },
                            ].map((tab) => (
                                <button
                                    key={tab.id}
                                    onClick={(e) => handleSelectTab(tab.id, e)}
                                    aria-selected={activeTab === tab.id}
                                    className={`min-w-[88px] md:min-w-[110px] px-3 md:px-4 py-2.5 md:py-3 rounded-lg font-medium transition-all cursor-pointer text-sm md:text-base flex flex-col items-center gap-1 whitespace-nowrap ${
                                        activeTab === tab.id
                                            ? "bg-blue-600 text-white shadow-lg"
                                            : "text-gray-700 hover:text-blue-600 hover:bg-gray-50"
                                    }`}
                                >
                                    <span className="text-base md:text-lg">{tab.icon}</span>
                                    <span>{tab.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {activeTab === "profile" && (
                    <ProfileTab
                        // 🟢 key를 추가하여 userInfo가 바뀔 때마다 ProfileTab을 새로 그리게 합니다.
                        key={userInfo?.subscriptionTier || "loading"}
                        userInfo={userInfo}
                        userPreferences={userPreferences}
                        onEditProfile={handleEditClick}
                        onEditPreferences={() => router.push("/onboarding")}
                        onOpenPwModal={() => {
                            setPwModalOpen(true);
                            setPwStep("verify");
                            setPwState({ current: "", next: "", confirm: "" });
                            setPwError("");
                        }}
                        onLogout={handleLogoutClick}
                    />
                )}

                {activeTab === "footprint" && <FootprintTab casefiles={casefiles} completed={completed} />}

                {activeTab === "records" && (
                    <RecordsTab
                        favorites={favorites}
                        savedCourses={savedCourses}
                        completed={completed}
                        casefiles={casefiles}
                        onRemoveFavorite={removeFavorite}
                        onOpenCaseModal={openCaseModal}
                        userTier={userInfo?.subscriptionTier}
                    />
                )}

                {activeTab === "activity" && (
                    <ActivityTab
                        badges={badges}
                        rewards={rewards}
                        checkins={checkins}
                        payments={payments}
                        onSelectBadge={setSelectedBadge}
                    />
                )}
            </main>

            {/* 모달: 전체 화면 이미지 */}
            {fullImageUrl && (
                <div
                    className="fixed inset-0 z-[60] bg-black/90 flex items-center justify-center p-4"
                    onClick={() => setFullImageUrl(null)}
                >
                    <button
                        onClick={() => setFullImageUrl(null)}
                        className="absolute top-4 right-4 px-3 py-1.5 rounded-lg bg-white/90 text-gray-900 hover:bg-white shadow"
                    >
                        닫기
                    </button>
                    <img
                        src={fullImageUrl}
                        alt="full"
                        className="max-h-[90vh] max-w-[96vw] object-contain rounded"
                        onClick={(e) => e.stopPropagation()}
                    />
                </div>
            )}

            {/* 모달: 사건 파일 상세 */}
            {selectedCaseStoryId !== null && (
                <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden shadow-xl">
                        <div className="flex items-center justify-between p-4 border-b">
                            <h3 className="text-lg md:text-xl font-bold text-gray-900">{selectedCaseTitle}</h3>
                            <button
                                onClick={() => {
                                    setSelectedCaseStoryId(null);
                                    setCasePhotoUrls([]);
                                }}
                                className="px-3 py-1.5 text-sm rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200"
                            >
                                닫기
                            </button>
                        </div>
                        <div className="p-4 overflow-y-auto">
                            {casePhotoLoading ? (
                                <div className="py-16 text-center text-gray-600">불러오는 중...</div>
                            ) : casePhotoUrls.length > 0 ? (
                                <div className="grid grid-cols-1 gap-3 md:gap-4">
                                    {casePhotoUrls.slice(0, 1).map((u, i) => (
                                        <button
                                            key={i}
                                            onClick={() => setFullImageUrl(u)}
                                            className="bg-[#a5743a] rounded-lg p-2 shadow-inner text-left"
                                        >
                                            <div className="bg-[#f8f5ef] rounded-lg p-2 border-2 border-[#704a23]">
                                                <img
                                                    src={u}
                                                    alt={`upload-${i}`}
                                                    className="w-full h-full object-cover rounded cursor-zoom-in"
                                                />
                                            </div>
                                            <div className="mt-2 text-xs text-gray-500">
                                                클릭하면 전체 화면으로 확대됩니다
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            ) : (
                                <div className="py-16 text-center text-gray-600">업로드된 사진이 없습니다.</div>
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
                                throw new Error(result?.error || "현재 비밀번호가 올바르지 않습니다.");
                            }
                            // 현재 비밀번호 저장하고 다음 단계로
                            setPwState((s) => ({ ...s, current: password }));
                            setPwStep("change");
                        } catch (err: any) {
                            setPwError(err.message || "오류가 발생했습니다.");
                        } finally {
                            setPwLoading(false);
                        }
                    }}
                />
            )}
            {pwModalOpen && pwStep === "change" && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-2xl shadow-xl p-6 w-[90vw] max-w-md mx-4">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-xl font-bold text-gray-900">새 비밀번호 설정</h3>
                            <button
                                className="hover:cursor-pointer text-gray-400 hover:text-gray-600 text-2xl"
                                onClick={() => {
                                    setPwModalOpen(false);
                                    setPwError("");
                                    setPwState({ current: "", next: "", confirm: "" });
                                    setPwStep("verify");
                                }}
                            >
                                ×
                            </button>
                        </div>
                        {pwError && (
                            <div className="mb-3 rounded border border-red-300 bg-red-50 p-2 text-sm text-red-700">
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
                                        throw new Error("새 비밀번호는 최소 6자 이상이어야 합니다.");
                                    if (pwState.next !== pwState.confirm)
                                        throw new Error("새 비밀번호가 일치하지 않습니다.");

                                    const data = await authenticatedFetch("/api/users/password", {
                                        method: "PUT",
                                        body: JSON.stringify({
                                            currentPassword: pwState.current,
                                            newPassword: pwState.next,
                                        }),
                                    });
                                    if (!data || !(data as any)?.success)
                                        throw new Error((data as any)?.error || "변경 실패");

                                    setPwModalOpen(false);
                                    setPwState({ current: "", next: "", confirm: "" });
                                    setPwStep("verify");
                                    alert("비밀번호가 변경되었습니다. 다시 로그인해 주세요.");
                                    handleLogout();
                                } catch (err: any) {
                                    setPwError(err.message || "오류가 발생했습니다.");
                                } finally {
                                    setPwLoading(false);
                                }
                            }}
                            className="space-y-4"
                        >
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">새 비밀번호</label>
                                <input
                                    type="password"
                                    value={pwState.next}
                                    onChange={(e) => setPwState((s) => ({ ...s, next: e.target.value }))}
                                    required
                                    className="w-full px-4 py-3 border border-gray-300 rounded-lg"
                                    placeholder="새 비밀번호 (6자 이상)"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">새 비밀번호 확인</label>
                                <input
                                    type="password"
                                    value={pwState.confirm}
                                    onChange={(e) => setPwState((s) => ({ ...s, confirm: e.target.value }))}
                                    required
                                    className="w-full px-4 py-3 border border-gray-300 rounded-lg"
                                    placeholder="새 비밀번호 확인"
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
                                    className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg"
                                >
                                    취소
                                </button>
                                <button
                                    type="submit"
                                    disabled={pwLoading}
                                    className="flex-1 px-4 py-3 bg-slate-900 text-white rounded-lg disabled:opacity-50 tracking-tight font-bold hover:bg-slate-800 transition-colors"
                                >
                                    {pwLoading ? "처리 중..." : "변경하기"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* 모달: 프로필 수정 */}
            {showEditModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl border border-gray-100 p-8 max-w-md w-full mx-4">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-2xl font-bold text-gray-900 tracking-tight">프로필 수정</h3>
                            <button
                                onClick={() => setShowEditModal(false)}
                                className="text-gray-400 hover:text-gray-600 text-2xl"
                            >
                                ×
                            </button>
                        </div>
                        <form onSubmit={handleEditSubmit} className="space-y-6">
                            {editError && (
                                <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
                                    {editError}
                                </div>
                            )}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">닉네임</label>
                                <input
                                    type="text"
                                    name="name"
                                    value={editForm.name || ""}
                                    onChange={handleEditChange}
                                    required
                                    className="w-full px-4 py-3 border border-gray-300 rounded-lg text-gray-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">이메일</label>
                                <input
                                    type="email"
                                    name="email"
                                    value={editForm.email || ""}
                                    onChange={handleEditChange}
                                    required
                                    className="w-full px-4 py-3 border border-gray-300 rounded-lg text-gray-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">MBTI</label>
                                <select
                                    name="mbti"
                                    value={editForm.mbti || ""}
                                    onChange={handleEditChange}
                                    className="w-full px-4 py-3 border border-gray-300 rounded-lg text-gray-500"
                                >
                                    <option value="">MBTI를 선택하세요</option>
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
                                <label className="block text-sm font-medium text-gray-700 mb-2">나이</label>
                                <input
                                    type="number"
                                    name="age"
                                    value={editForm.age || ""}
                                    onChange={handleEditChange}
                                    min="1"
                                    max="120"
                                    className="w-full px-4 py-3 border border-gray-300 rounded-lg text-gray-500"
                                />
                            </div>
                            <div className="flex space-x-3">
                                <button
                                    type="button"
                                    onClick={() => setShowEditModal(false)}
                                    className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg"
                                >
                                    취소
                                </button>
                                <button
                                    type="submit"
                                    disabled={editLoading}
                                    className="flex-1 px-4 py-3 bg-slate-900 text-white rounded-lg disabled:opacity-50 tracking-tight font-bold hover:bg-slate-800 transition-colors"
                                >
                                    {editLoading ? "수정 중..." : "수정하기"}
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
                    <div className="bg-white rounded-xl border border-gray-100 p-6 w-[90vw] max-w-md mx-4">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-xl font-bold text-gray-900 tracking-tight">{selectedBadge.name}</h3>
                            <button
                                className="text-gray-400 hover:text-gray-600 text-2xl"
                                onClick={() => setSelectedBadge(null)}
                            >
                                ×
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
                                <div className="w-40 h-40 mb-3 rounded-full bg-yellow-100 flex items-center justify-center text-6xl">
                                    🏅
                                </div>
                            )}
                            {selectedBadge.description && (
                                <div className="text-sm text-gray-700 whitespace-pre-wrap mb-3">
                                    {selectedBadge.description}
                                </div>
                            )}
                            <div className="text-xs text-gray-400 mb-4">
                                획득일: {new Date(selectedBadge.awarded_at).toLocaleDateString()}
                            </div>
                            <div className="flex gap-2">
                                <button
                                    className="px-4 py-2 rounded-lg border bg-white hover:bg-gray-50 text-black"
                                    onClick={() => shareBadgeToKakao(selectedBadge)}
                                >
                                    자랑하기
                                </button>
                                <button
                                    className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
                                    onClick={() => setSelectedBadge(null)}
                                >
                                    닫기
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MyPage;
