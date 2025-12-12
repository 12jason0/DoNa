"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/Header";
import Image from "@/components/ImageFallback";

// --- 수정된 부분: 데이터 타입 정의 ---
// API 응답 데이터 구조에 맞게 타입을 명확하게 수정했습니다.

interface UserInfo {
    name: string;
    email: string;
    joinDate: string;
    profileImage: string;
    mbti?: string | null;
    age?: number | null;
}

interface UserPreferences {
    concept: string[]; // 감성·힐링, 활동적·체험, 카페/브런치, 인생샷·사진, 맛집 탐방, 쇼핑, 야경·밤 산책, 이색 데이트
    companion: string; // 연인, 썸, 소개팅, 친구, 혼자
    mood: string[]; // 조용한, 트렌디한, 프리미엄, 활기찬, 깔끔한, 감성적, 빈티지
    regions: string[]; // 성수, 한남, 홍대, 강남, 서초, 여의도, 종로/북촌, 잠실, 신촌, 가로수길 등
}

interface Booking {
    id: string;
    courseTitle: string;
    date: string;
    status: string;
    price: string;
    participants: number;
}

// 1. Course의 타입을 먼저 정의합니다.
interface CourseInfoForFavorite {
    id: number;
    title: string;
    description: string;
    imageUrl: string;
    price: string;
    rating: number;
    concept: string;
}

// 2. Favorite 타입이 CourseInfoForFavorite를 포함하도록 수정합니다.
interface Favorite {
    id: number; // 찜(favorite)의 고유 ID
    course_id: number; // 강좌의 ID
    course: CourseInfoForFavorite; // 중첩된 강좌 정보
}

interface UserBadgeItem {
    id: number;
    name: string;
    image_url?: string | null;
    description?: string | null;
    awarded_at: string;
}

interface UserRewardRow {
    id: number;
    type: string;
    amount: number;
    unit: string;
    createdAt: string;
}

interface UserCheckinRow {
    id: number;
    date: string;
    rewarded: boolean;
    createdAt: string;
}

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
    const [completed, setCompleted] = useState<
        Array<{
            course_id: number;
            title: string;
            description: string;
            imageUrl: string;
            rating: number;
            concept: string;
            completedAt?: string | null;
        }>
    >([]);
    const [badges, setBadges] = useState<UserBadgeItem[]>([]);
    const [activeTab, setActiveTab] = useState("profile");
    const tabsTrackRef = useRef<HTMLDivElement | null>(null);
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
    const [casefiles, setCasefiles] = useState<
        Array<{
            story_id: number;
            title: string;
            synopsis: string;
            region?: string | null;
            imageUrl?: string | null;
            completedAt?: string | null;
            badge?: { id: number; name: string; image_url?: string | null } | null;
            photoCount?: number;
        }>
    >([]);
    const [loading, setLoading] = useState(true);
    const [showEditModal, setShowEditModal] = useState(false);
    const [editForm, setEditForm] = useState({
        name: "",
        email: "",
        mbti: "",
        age: "",
    });
    const [editLoading, setEditLoading] = useState(false);
    const [editError, setEditError] = useState("");
    const [showLogoutModal, setShowLogoutModal] = useState(false);
    const [selectedCaseStoryId, setSelectedCaseStoryId] = useState<number | null>(null);
    const [selectedCaseTitle, setSelectedCaseTitle] = useState("");
    const [casePhotoUrls, setCasePhotoUrls] = useState<string[]>([]);
    const [fullImageUrl, setFullImageUrl] = useState<string | null>(null);
    const [casePhotoLoading, setCasePhotoLoading] = useState(false);
    const [rewards, setRewards] = useState<UserRewardRow[]>([]);
    const [checkins, setCheckins] = useState<UserCheckinRow[]>([]);
    const [currentMonth, setCurrentMonth] = useState<Date>(() => {
        const d = new Date();
        return new Date(d.getFullYear(), d.getMonth(), 1);
    });
    // Removed: showCheckinModal state for MyPage attendance modal
    // 비밀번호 변경 모달 상태
    const [pwModalOpen, setPwModalOpen] = useState(false);
    const [pwStep, setPwStep] = useState<"verify" | "change">("verify");
    const [pwState, setPwState] = useState<{ current: string; next: string; confirm: string }>({
        current: "",
        next: "",
        confirm: "",
    });
    const [pwLoading, setPwLoading] = useState(false);
    const [pwError, setPwError] = useState("");

    useEffect(() => {
        fetchUserInfo();
        fetchUserPreferences();
        fetchFavorites();
        fetchBadges();
        fetchCompleted();
        fetchCasefiles();
        fetchRewards();
        fetchCheckins();

        // Removed: MyPage auto-open attendance modal

        try {
            const url = new URL(window.location.href);
            const tab = url.searchParams.get("tab");
            if (["profile", "preferences", "favorites", "completed", "badges", "checkins"].includes(tab || "")) {
                setActiveTab(tab || "profile");
            }
        } catch {}
    }, []);

    const fetchUserInfo = async () => {
        try {
            const token = localStorage.getItem("authToken");
            if (!token) {
                router.push("/login");
                return;
            }

            const response = await fetch("/api/users/profile", {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });

            if (response.ok) {
                const raw = await response.json();
                const src: any = raw?.user ?? raw ?? {};
                const name = src.name || src.username || src.nickname || "";
                const email = src.email || src.userEmail || "";
                const created = src.joinDate || src.createdAt || src.created_at || null;
                const profileImage = src.profileImage || src.profileImageUrl || src.profile_image_url || "";
                const mapped: UserInfo = {
                    name,
                    email,
                    joinDate: created ? new Date(created).toLocaleDateString() : "",
                    profileImage,
                    mbti: src.mbti ?? null,
                    age: typeof src.age === "number" ? src.age : src.age ? Number(src.age) : null,
                };
                setUserInfo(mapped);
            } else {
                console.error("Failed to fetch user info");
            }
        } catch (error) {
            console.error("Failed to fetch user info:", error);
        } finally {
            setLoading(false);
        }
    };

    // 출석 업데이트 전역 이벤트 수신 → 즉시 갱신
    useEffect(() => {
        const onCheckinUpdated = () => {
            fetchCheckins();
        };
        window.addEventListener("checkinUpdated", onCheckinUpdated as EventListener);
        return () => window.removeEventListener("checkinUpdated", onCheckinUpdated as EventListener);
    }, []);

    const fetchBadges = async () => {
        try {
            const token = localStorage.getItem("authToken");
            if (!token) return;

            const res = await fetch("/api/users/badges", {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });

            if (!res.ok) {
                console.error("Failed to fetch badges, status:", res.status);
                setBadges([]);
                return;
            }
            const data = await res.json();
            const list = Array.isArray(data?.badges) ? data.badges : Array.isArray(data) ? data : [];
            setBadges(
                list.map((b: any) => ({
                    id: b.id,
                    name: b.name || b.title || "",
                    image_url: b.image_url || b.icon_url || null,
                    description: b.description ?? null,
                    awarded_at: b.awarded_at || b.createdAt || b.created_at || new Date().toISOString(),
                }))
            );
        } catch (error) {
            console.error("Error fetching badges:", error);
            setBadges([]);
        }
    };

    const fetchUserPreferences = async () => {
        try {
            const token = localStorage.getItem("authToken");
            if (!token) return;

            const response = await fetch("/api/users/preferences", {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });
            if (response.ok) {
                const raw = await response.json();
                // API 응답 구조: { preferences: {...} } 또는 직접 preferences 객체
                const prefs: any = raw?.preferences ?? raw ?? {};
                // preferences가 비어있지 않은지 확인 (새로운 구조 기준)
                const hasPreferences =
                    Object.keys(prefs).length > 0 &&
                    ((prefs.concept && Array.isArray(prefs.concept) && prefs.concept.length > 0) ||
                        prefs.companion ||
                        (prefs.mood && Array.isArray(prefs.mood) && prefs.mood.length > 0) ||
                        (prefs.regions && Array.isArray(prefs.regions) && prefs.regions.length > 0));

                if (hasPreferences) {
                    setUserPreferences({
                        concept: Array.isArray(prefs.concept) ? prefs.concept : [],
                        companion: prefs.companion || "",
                        mood: Array.isArray(prefs.mood) ? prefs.mood : [],
                        regions: Array.isArray(prefs.regions) ? prefs.regions : [],
                    });
                } else {
                    setUserPreferences(null);
                }
            }
        } catch (error) {
            console.error("Failed to fetch user preferences:", error);
        }
    };

    const fetchCasefiles = async () => {
        try {
            const token = localStorage.getItem("authToken");
            if (!token) return;
            const res = await fetch("/api/users/casefiles", {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (res.ok) {
                const data = await res.json();
                const list = Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : [];
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

    const openCaseModal = async (storyId: number, title: string) => {
        setSelectedCaseStoryId(storyId);
        setSelectedCaseTitle(title);
        setCasePhotoUrls([]);
        setCasePhotoLoading(true);
        try {
            const token = localStorage.getItem("authToken");
            // 1) 콜라주가 있으면 우선 표시
            const resCollages = await fetch(`/api/collages?storyId=${storyId}`, {
                headers: token ? { Authorization: `Bearer ${token}` } : undefined,
            });
            if (resCollages.ok) {
                const data = await resCollages.json();
                const items: any[] = Array.isArray((data as any)?.items) ? (data as any).items : [];
                const urls = items.map((it) => String(it?.thumbnailUrl || it?.collageUrl || "")).filter(Boolean);
                if (urls.length > 0) {
                    setCasePhotoUrls(urls);
                    return;
                }
            }

            // 2) 폴백: 미션 제출 사진을 표시
            const res = await fetch(`/api/escape/submissions?storyId=${storyId}`, {
                headers: token ? { Authorization: `Bearer ${token}` } : undefined,
            });
            if (res.ok) {
                const data = await res.json();
                const urls = Array.isArray(data) ? data : Array.isArray((data as any)?.urls) ? (data as any).urls : [];
                setCasePhotoUrls(urls);
            } else {
                setCasePhotoUrls([]);
            }
        } catch {
            setCasePhotoUrls([]);
        } finally {
            setCasePhotoLoading(false);
        }
    };

    const fetchFavorites = async () => {
        try {
            const token = localStorage.getItem("authToken");
            if (!token) return;

            const response = await fetch("/api/users/favorites", {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });

            if (response.ok) {
                const raw = await response.json();
                const arr = Array.isArray(raw?.favorites) ? raw.favorites : Array.isArray(raw) ? raw : [];
                const normalized: Favorite[] = arr.map((f: any) => ({
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
                    },
                }));
                setFavorites(normalized);
            } else {
                console.log("찜 목록 조회 실패, 빈 배열로 설정");
                setFavorites([]);
            }
        } catch (error) {
            console.error("Failed to fetch favorites:", error);
            setFavorites([]);
        }
    };

    const fetchCompleted = async () => {
        try {
            const token = localStorage.getItem("authToken");
            if (!token) return;
            const res = await fetch("/api/users/completions", {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (res.ok) {
                const raw = await res.json();
                const list = Array.isArray(raw?.items) ? raw.items : Array.isArray(raw) ? raw : [];
                setCompleted(
                    list.map((c: any) => ({
                        course_id: c.course_id || c.courseId || c.id,
                        title: c.title,
                        description: c.description || "",
                        imageUrl: c.imageUrl || c.image_url || "",
                        rating: Number(c.rating ?? 0),
                        concept: c.concept || "",
                        completedAt: c.completedAt || c.completed_at || null,
                    }))
                );
            } else {
                setCompleted([]);
            }
        } catch (e) {
            setCompleted([]);
        }
    };

    const fetchRewards = async () => {
        try {
            const token = localStorage.getItem("authToken");
            if (!token) return;
            const res = await fetch("/api/users/rewards", { headers: { Authorization: `Bearer ${token}` } });
            const data = await res.json();
            if (res.ok && data?.success) setRewards(data.rewards || []);
        } catch {}
    };

    const fetchCheckins = async () => {
        try {
            const token = localStorage.getItem("authToken");
            if (!token) return;
            const res = await fetch("/api/users/checkins", {
                headers: { Authorization: `Bearer ${token}` },
                cache: "no-store",
                credentials: "include",
            });
            const data = await res.json();
            if (res.ok && data?.success) setCheckins(data.checkins || []);
        } catch {}
    };

    // Removed: doCheckin function and modal-specific logic

    const removeFavorite = async (courseId: number) => {
        try {
            const token = localStorage.getItem("authToken");
            if (!token) return;

            const response = await fetch(`/api/users/favorites?courseId=${courseId}`, {
                method: "DELETE",
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });

            if (response.ok) {
                setFavorites((prev) => prev.filter((fav) => fav.course_id !== courseId));
            } else {
                console.error("Failed to remove favorite");
            }
        } catch (error) {
            console.error("Failed to remove favorite:", error);
        }
    };

    const handleLogoutClick = () => {
        setShowLogoutModal(true);
    };

    const handleLogout = () => {
        localStorage.removeItem("authToken");
        window.dispatchEvent(new Event("authTokenChange"));
        setShowLogoutModal(false);
        router.push("/");
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
            const token = localStorage.getItem("authToken");
            if (!token) return;

            const response = await fetch("/api/users/profile", {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify(editForm),
            });

            const data = await response.json();

            if (response.ok) {
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
                setEditError(data.error || "프로필 수정에 실패했습니다.");
            }
        } catch (error) {
            console.error("프로필 수정 오류:", error);
            setEditError("프로필 수정 중 오류가 발생했습니다.");
        } finally {
            setEditLoading(false);
        }
    };

    const handleEditChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setEditForm({
            ...editForm,
            [e.target.name]: e.target.value,
        });
    };

    const renderProfileTab = () => (
        <div className="space-y-6">
            <div className="bg-white rounded-2xl shadow-lg p-6 md:p-8">
                <h3 className="text-xl md:text-2xl font-bold text-gray-900 mb-4 md:mb-6">프로필 정보</h3>
                {userInfo ? (
                    <div className="flex items-center space-x-4 md:space-x-6">
                        <div className="relative w-16 h-16 md:w-20 md:h-20 rounded-full overflow-hidden bg-gray-100">
                            <Image
                                src={
                                    userInfo.profileImage ||
                                    "https://stylemap-seoul.s3.ap-northeast-2.amazonaws.com/profileLogo.png"
                                }
                                alt={userInfo.name || "프로필"}
                                fill
                                className="object-cover"
                                priority={false}
                            />
                        </div>
                        <div className="flex-1">
                            <h4 className="text-lg md:text-xl font-bold text-gray-900 mb-1 md:mb-2">{userInfo.name}</h4>
                            <p className="text-gray-600 mb-1 text-sm md:text-base">{userInfo.email}</p>
                            <div className="flex items-center space-x-3 md:space-x-4 text-xs md:text-sm text-gray-500">
                                <span>가입일: {userInfo.joinDate}</span>
                            </div>
                            <div className="flex items-center space-x-3 md:space-x-4 text-xs md:text-sm text-gray-500">
                                {userInfo.age && <span>나이: {userInfo.age}세</span>}
                            </div>
                        </div>
                        <button
                            onClick={handleEditClick}
                            className="px-3 md:px-4 py-2 text-blue-600 hover:text-blue-800 text-sm font-semibold cursor-pointer border border-blue-200 rounded-lg"
                        >
                            수정
                        </button>
                    </div>
                ) : (
                    <div className="text-center py-8">
                        <div className="text-5xl md:text-6xl mb-3 md:mb-4">👤</div>
                        <h4 className="text-base md:text-lg font-semibold text-gray-900 mb-2">
                            프로필 정보를 불러오는 중...
                        </h4>
                    </div>
                )}
            </div>
            <div className="bg-white rounded-2xl shadow-lg p-6 md:p-8">
                <h3 className="text-xl md:text-2xl font-bold text-gray-900 mb-4 md:mb-6">계정 관리</h3>
                <div className="space-y-4">
                    <button
                        onClick={() => {
                            setPwModalOpen(true);
                            setPwStep("verify");
                            setPwState({ current: "", next: "", confirm: "" });
                            setPwError("");
                        }}
                        className="w-full text-left px-3 md:px-4 py-2.5 md:py-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors cursor-pointer text-sm md:text-base"
                    >
                        <div className="flex items-center justify-between">
                            <span className="font-medium text-gray-900">비밀번호 변경</span>
                            <span className="text-gray-400">→</span>
                        </div>
                    </button>
                    <button className="w-full text-left px-3 md:px-4 py-2.5 md:py-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors cursor-pointer text-sm md:text-base">
                        <div className="flex items-center justify-between">
                            <span className="font-medium text-gray-900">알림 설정</span>
                            <span className="text-gray-400">→</span>
                        </div>
                    </button>
                    <button
                        onClick={handleLogoutClick}
                        className="w-full text-left px-3 md:px-4 py-2.5 md:py-3 rounded-lg border border-red-200 hover:bg-red-50 transition-colors cursor-pointer text-sm md:text-base"
                    >
                        <div className="flex items-center justify-between">
                            <span className="font-medium text-red-600">로그아웃</span>
                            <span className="text-red-400">→</span>
                        </div>
                    </button>
                </div>
            </div>
        </div>
    );

    const renderPreferencesTab = () => (
        <div className="space-y-6">
            <div className="bg-white rounded-2xl shadow-lg p-6 md:p-8">
                <div className="flex items-center justify-between mb-4 md:mb-6">
                    <h3 className="text-xl md:text-2xl font-bold text-gray-900">내 선호도</h3>
                    <button
                        onClick={() => router.push("/onboarding")}
                        className="px-3 md:px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors cursor-pointer"
                    >
                        수정하기
                    </button>
                </div>
                {userInfo?.mbti && (
                    <div className="mb-4">
                        <span className="px-2.5 md:px-3 py-1 bg-amber-100 text-amber-800 rounded-full text-xs md:text-sm font-semibold">
                            MBTI: {userInfo.mbti}
                        </span>
                    </div>
                )}
                {userPreferences ? (
                    <div className="grid grid-cols-2 gap-4 md:gap-6">
                        {userPreferences.companion && (
                            <div>
                                <h4 className="text-base md:text-lg font-semibold text-gray-900 mb-2 md:mb-3">
                                    여행 동반자
                                </h4>
                                <span className="px-2.5 md:px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs md:text-sm">
                                    {userPreferences.companion}
                                </span>
                            </div>
                        )}
                        {userPreferences.concept && userPreferences.concept.length > 0 && (
                            <div>
                                <h4 className="text-base md:text-lg font-semibold text-gray-900 mb-2 md:mb-3">
                                    선호 콘셉트
                                </h4>
                                <div className="flex flex-wrap gap-2">
                                    {userPreferences.concept.map((c, idx) => (
                                        <span
                                            key={idx}
                                            className="px-2.5 md:px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-xs md:text-sm"
                                        >
                                            {c}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}
                        {userPreferences.mood && userPreferences.mood.length > 0 && (
                            <div>
                                <h4 className="text-base md:text-lg font-semibold text-gray-900 mb-2 md:mb-3">
                                    선호 분위기
                                </h4>
                                <div className="flex flex-wrap gap-2">
                                    {userPreferences.mood.map((m, idx) => (
                                        <span
                                            key={idx}
                                            className="px-2.5 md:px-3 py-1 bg-pink-100 text-pink-700 rounded-full text-xs md:text-sm"
                                        >
                                            {m}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}
                        {userPreferences.regions && userPreferences.regions.length > 0 && (
                            <div>
                                <h4 className="text-base md:text-lg font-semibold text-gray-900 mb-2 md:mb-3">
                                    선호 지역
                                </h4>
                                <div className="flex flex-wrap gap-2">
                                    {userPreferences.regions.map((r, idx) => (
                                        <span
                                            key={idx}
                                            className="px-2.5 md:px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs md:text-sm"
                                        >
                                            {r}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="text-center py-8">
                        <div className="text-6xl mb-4">🎯</div>
                        <h4 className="text-lg font-semibold text-gray-900 mb-2">선호도가 설정되지 않았어요</h4>
                        <p className="text-gray-600 mb-4">선호도를 설정하면 더 정확한 추천을 받을 수 있어요</p>
                        <button
                            onClick={() => router.push("/onboarding")}
                            className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors cursor-pointer"
                        >
                            선호도 설정하기
                        </button>
                    </div>
                )}
            </div>
        </div>
    );

    // --- 수정된 부분: renderFavoritesTab ---
    // API 응답 구조에 맞춰 favorite.course.title 처럼 중첩된 객체에 접근하도록 수정했습니다.
    const renderFavoritesTab = () => (
        <div className="space-y-6">
            <div className="bg-white rounded-2xl shadow-lg p-6 md:p-8">
                <h3 className="text-xl md:text-2xl font-bold text-gray-900 mb-4 md:mb-6">내 여행 보관함</h3>

                {favorites.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6">
                        {favorites.map((favorite) => (
                            <div
                                key={favorite.id}
                                className="border border-gray-200 rounded-xl overflow-hidden hover:shadow-lg transition-shadow cursor-pointer"
                                onClick={() => router.push(`/courses/${favorite.course_id}`)}
                            >
                                <div className="relative">
                                    <div className="relative h-48">
                                        <Image
                                            src={favorite.course.imageUrl || ""}
                                            alt={favorite.course.title}
                                            fill
                                            className="object-cover rounded-none"
                                            priority={false}
                                        />
                                    </div>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            removeFavorite(favorite.course_id);
                                        }}
                                        className="absolute top-2 right-2 w-8 h-8 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors"
                                    >
                                        ×
                                    </button>
                                    <div className="absolute bottom-2 left-2 bg-blue-500 text-white px-2 py-1 rounded-full text-xs font-medium">
                                        {favorite.course.concept}
                                    </div>
                                </div>
                                <div className="p-4">
                                    <h4 className="text-base md:text-lg font-semibold text-gray-900 mb-2 line-clamp-2">
                                        {favorite.course.title}
                                    </h4>
                                    <p className="text-gray-600 text-xs md:text-sm mb-3 line-clamp-2">
                                        {favorite.course.description}
                                    </p>
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-1">
                                            <span className="text-yellow-400">★</span>
                                            <span className="text-xs md:text-sm font-medium text-gray-900">
                                                {favorite.course.rating}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-8">
                        <div className="text-6xl mb-4">💖</div>
                        <h4 className="text-lg font-semibold text-gray-900 mb-2">찜한 코스가 없어요</h4>
                        <p className="text-gray-600 mb-4">마음에 드는 코스를 찜해보세요!</p>
                        <button
                            onClick={() => router.push("/courses")}
                            className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors cursor-pointer"
                        >
                            코스 둘러보기
                        </button>
                    </div>
                )}
            </div>
        </div>
    );

    const [selectedBadge, setSelectedBadge] = useState<UserBadgeItem | null>(null);

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
                    (process.env.NEXT_PUBLIC_KAKAO_JS_KEY as string | undefined) ||
                    (process.env.NEXT_PUBLIC_KAKAO_JAVASCRIPT_KEY as string | undefined) ||
                    (process.env.NEXT_PUBLIC_KAKAO_MAP_API_KEY as string | undefined);
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
            const shareText = `${bragText} ${link}`;
            if (navigator.share) {
                try {
                    if (imageUrl) {
                        const res = await fetch(imageUrl, { mode: "cors" }).catch(() => null as any);
                        if (res && res.ok) {
                            const blob = await res.blob();
                            const file = new File([blob], "badge.jpg", { type: blob.type || "image/jpeg" });
                            const can = (navigator as any).canShare?.({ files: [file] });
                            if (can) {
                                await (navigator as any).share({
                                    title: "배지 자랑하기",
                                    text: shareText,
                                    files: [file],
                                });
                                return;
                            }
                        }
                    }
                    await navigator.share({ title: "배지 자랑하기", text: shareText, url: link });
                    return;
                } catch {}
            } else {
                await navigator.clipboard.writeText(shareText);
                alert("링크가 클립보드에 복사되었습니다.");
            }
        } catch {
            const shareText = `${userInfo?.name || "저"}는 '${badge.name}' 배지를 획득했어요! ${
                typeof location !== "undefined" ? location.href : ""
            }`;
            await navigator.clipboard.writeText(shareText);
            alert("링크가 클립보드에 복사되었습니다.");
        }
    };

    const renderBadgesTab = () => (
        <div className="space-y-6">
            <div className="bg-white rounded-2xl shadow-lg p-6 md:p-8">
                <div className="flex items-center justify-between mb-4 md:mb-6">
                    <h3 className="text-xl md:text-2xl font-bold text-gray-900">내 뱃지</h3>
                </div>
                {badges.length > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-2 gap-6">
                        {badges.map((b) => (
                            <div
                                key={b.id}
                                className="border border-gray-200 rounded-xl p-4 flex flex-col items-center text-center bg-white hover:shadow-md transition-shadow cursor-pointer"
                                onClick={() => setSelectedBadge(b)}
                            >
                                {b.image_url ? (
                                    <div className="w-20 h-20 mb-3 rounded-full bg-gray-200 overflow-hidden flex items-center justify-center">
                                        <img
                                            src={b.image_url}
                                            alt={b.name}
                                            className="w-full h-full object-contain"
                                            onError={(e) => {
                                                e.currentTarget.style.display = "none";
                                            }}
                                        />
                                    </div>
                                ) : (
                                    <div className="w-20 h-20 mb-3 rounded-full bg-yellow-100 flex items-center justify-center text-3xl">
                                        🏅
                                    </div>
                                )}
                                <div className="text-sm font-semibold text-gray-900 mb-1">{b.name}</div>
                                {b.description && (
                                    <div className="text-xs text-gray-600 line-clamp-2 mb-1">{b.description}</div>
                                )}
                                <div className="text-[11px] text-gray-400">
                                    {new Date(b.awarded_at).toLocaleDateString()}
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-10">
                        <div className="text-6xl mb-3">🏅</div>
                        <div className="text-lg font-semibold text-gray-900 mb-1">아직 획득한 뱃지가 없어요</div>
                        <div className="text-gray-600">스토리를 완료하고 배지를 모아보세요!</div>
                    </div>
                )}
            </div>
        </div>
    );

    function renderRewardsTab() {
        return (
            <div className="space-y-6">
                <div className="bg-white rounded-2xl shadow-lg p-6 md:p-8">
                    <div className="flex items-center justify-between mb-4 md:mb-6">
                        <h3 className="text-xl md:text-2xl font-bold text-gray-900">보상 지급 내역</h3>
                    </div>
                    {rewards.length > 0 ? (
                        <div className="divide-y">
                            {rewards.map((r) => (
                                <div key={r.id} className="py-3 flex items-center justify-between">
                                    <div className="text-gray-800">
                                        <div className="font-semibold">
                                            {(() => {
                                                // 보상 유형 한글 라벨 매핑
                                                const type = String(r.type || "").toLowerCase();
                                                if (type === "checkin") return "7일 연속 출석 완료";
                                                if (type === "escape_place_clear") return "미션 장소 클리어 보상";
                                                if (type === "signup") return "회원가입 보상";
                                                if (type === "ad_watch") return "광고 시청 보상";
                                                if (type === "purchase") return "구매 보상";
                                                if (type === "event") return "이벤트 보상";
                                                return r.type;
                                            })()}
                                        </div>
                                        <div className="text-xs text-gray-500">
                                            {new Date(r.createdAt).toLocaleString()}
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        {(() => {
                                            const unit = String(r.unit || "").toLowerCase();
                                            const unitKo =
                                                unit === "coupon"
                                                    ? "쿠폰"
                                                    : unit === "coin"
                                                    ? "코인"
                                                    : unit === "water"
                                                    ? "물"
                                                    : r.unit;
                                            return (
                                                <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 font-bold text-sm md:text-base border border-emerald-200">
                                                    <span className="leading-none">+{r.amount}</span>
                                                    <span className="leading-none">
                                                        {unit === "coupon" ? "coupon" : unitKo}
                                                    </span>
                                                </div>
                                            );
                                        })()}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center text-gray-600 py-10">보상 내역이 없습니다.</div>
                    )}
                </div>
            </div>
        );
    }

    // KST 기준 날짜 키 생성 (yyyy-mm-dd)
    const getDateKeyKST = (date: Date): string => {
        const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
        const ms = date.getTime() + KST_OFFSET_MS;
        const k = new Date(ms);
        const y = k.getUTCFullYear();
        const m = String(k.getUTCMonth() + 1).padStart(2, "0");
        const d = String(k.getUTCDate()).padStart(2, "0");
        return `${y}-${m}-${d}`;
    };

    const monthLabel = (d: Date) => `${d.getFullYear()}. ${String(d.getMonth() + 1).padStart(2, "0")}`;

    const goPrevMonth = () => {
        setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
    };
    const goNextMonth = () => {
        setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
    };

    function renderCheckinsTab() {
        const year = currentMonth.getFullYear();
        const month = currentMonth.getMonth(); // 0-based
        const firstDay = new Date(year, month, 1);
        const firstDow = firstDay.getDay(); // 0=Sun
        const daysInMonth = new Date(year, month + 1, 0).getDate();

        // 이번 달에 해당하는 체크인 day set
        const checkinDaySet = new Set<string>(
            checkins.map((c) => {
                const d = new Date(c.date);
                return getDateKeyKST(d);
            })
        );
        const targetMonthKeyPrefix = `${year}-${String(month + 1).padStart(2, "0")}-`;

        const days: Array<{ day: number | null; key: string | null; stamped: boolean }> = [];
        for (let i = 0; i < firstDow; i++) {
            days.push({ day: null, key: null, stamped: false });
        }
        for (let d = 1; d <= daysInMonth; d++) {
            const key = `${targetMonthKeyPrefix}${String(d).padStart(2, "0")}`;
            const stamped = checkinDaySet.has(key);
            days.push({ day: d, key, stamped });
        }

        return (
            <div className="space-y-6">
                <div className="bg-white rounded-2xl shadow-lg p-6 md:p-8">
                    <div className="flex items-center justify-between mb-4 md:mb-6">
                        <h3 className="text-xl md:text-2xl font-bold text-gray-900">출석 기록</h3>
                    </div>
                    <div className="mb-4 flex items-center justify-between">
                        <button
                            onClick={goPrevMonth}
                            className="px-3 py-1.5 rounded-lg border text-gray-400 cursor-pointer"
                        >
                            ← 이전
                        </button>
                        <div className="font-semibold text-gray-900">{monthLabel(currentMonth)}</div>
                        <button
                            onClick={goNextMonth}
                            className="px-3 py-1.5 rounded-lg border text-gray-400 cursor-pointer"
                        >
                            다음 →
                        </button>
                    </div>

                    <div className="grid grid-cols-7 gap-2 text-center text-xs md:text-sm text-gray-600 mb-2">
                        {["일", "월", "화", "수", "목", "금", "토"].map((w) => (
                            <div key={w} className="py-1 font-medium">
                                {w}
                            </div>
                        ))}
                    </div>
                    <div className="grid grid-cols-7 gap-2">
                        {days.map((cell, idx) => {
                            if (cell.day === null) return <div key={`pad-${idx}`} className="h-10 md:h-12" />;
                            const isToday =
                                getDateKeyKST(new Date()) ===
                                `${targetMonthKeyPrefix}${String(cell.day).padStart(2, "0")}`;
                            return (
                                <div
                                    key={cell.key || idx}
                                    className={`h-10 md:h-12 rounded-lg flex items-center justify-center ${
                                        cell.stamped
                                            ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                                            : "bg-white border-gray-200 text-gray-700"
                                    } ${isToday ? "ring-2 ring-blue-400" : ""}`}
                                    title={cell.key || ""}
                                >
                                    {cell.stamped ? (
                                        <span className="text-base md:text-lg">🌱</span>
                                    ) : (
                                        <span className="opacity-70">{cell.day}</span>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        );
    }

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
                    <div className="bg-white rounded-xl shadow-lg p-2 overflow-x-auto no-scrollbar" ref={tabsTrackRef}>
                        <div className="flex space-x-2 min-w-max">
                            {[
                                { id: "profile", label: "프로필", icon: "👤" },
                                { id: "preferences", label: "선호도", icon: "🎯" },
                                { id: "favorites", label: "보관함", icon: "💖" },
                                { id: "completed", label: "완료", icon: "✅" },
                                { id: "casefiles", label: "사건 파일", icon: "🗂️" },
                                { id: "badges", label: "뱃지", icon: "🏅" },
                                { id: "rewards", label: "보상 내역", icon: "🎁" },
                                { id: "checkins", label: "출석 기록", icon: "📅" },
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

                {activeTab === "profile" && renderProfileTab()}
                {activeTab === "preferences" && renderPreferencesTab()}
                {activeTab === "favorites" && renderFavoritesTab()}
                {activeTab === "badges" && renderBadgesTab()}
                {activeTab === "completed" && (
                    <div className="space-y-6">
                        <div className="bg-white rounded-2xl shadow-lg p-6 md:p-8">
                            <div className="flex items-center justify-between mb-4 md:mb-6">
                                <h3 className="text-xl md:text-2xl font-bold text-gray-900">완료한 코스</h3>
                            </div>
                            {completed.length > 0 ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {completed.map((c) => (
                                        <div
                                            key={c.course_id}
                                            className="border border-gray-200 rounded-xl overflow-hidden hover:shadow-lg transition-shadow cursor-pointer"
                                            onClick={() => router.push(`/courses/${c.course_id}`)}
                                        >
                                            <div className="relative">
                                                <div className="relative h-48">
                                                    <Image
                                                        src={c.imageUrl || ""}
                                                        alt={c.title}
                                                        fill
                                                        className="object-cover rounded-none"
                                                    />
                                                </div>
                                                {c.concept && (
                                                    <div className="absolute bottom-2 left-2 bg-emerald-500 text-white px-2 py-1 rounded-full text-xs font-medium">
                                                        {c.concept}
                                                    </div>
                                                )}
                                            </div>
                                            <div className="p-4">
                                                <h4 className="text-base md:text-lg font-semibold text-gray-900 mb-1 line-clamp-2">
                                                    {c.title}
                                                </h4>
                                                <div className="flex items-center justify-between text-xs text-gray-600">
                                                    <div className="flex items-center gap-1">
                                                        <span className="text-yellow-400">★</span>
                                                        <span className="font-medium">{c.rating}</span>
                                                    </div>
                                                    {c.completedAt && (
                                                        <span>{new Date(c.completedAt).toLocaleDateString()}</span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-10">
                                    <div className="text-6xl mb-3">✅</div>
                                    <div className="text-lg font-semibold text-gray-900 mb-1">
                                        아직 완료한 코스가 없어요
                                    </div>
                                    <div className="text-gray-600 mb-4">코스를 완료하면 여기에서 확인할 수 있어요</div>
                                    <button
                                        onClick={() => router.push("/courses")}
                                        className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors cursor-pointer"
                                    >
                                        코스 둘러보기
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                )}
                {activeTab === "casefiles" && (
                    <div className="space-y-6">
                        <div className="bg-white rounded-2xl shadow-lg p-6 md:p-8">
                            <div className="flex items-center justify-between mb-4 md:mb-6">
                                <h3 className="text-xl md:text-2xl font-bold text-gray-900">완료한 사건 파일</h3>
                            </div>
                            {casefiles.length > 0 ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {casefiles.map((f) => (
                                        <div
                                            key={f.story_id}
                                            className="group relative rounded-2xl overflow-hidden border border-gray-200 shadow-sm hover:shadow-lg transition-all cursor-pointer"
                                            onClick={() => openCaseModal(f.story_id, f.title)}
                                        >
                                            <div className="relative h-60">
                                                {f.imageUrl ? (
                                                    <img
                                                        src={f.imageUrl}
                                                        alt={f.title}
                                                        className="w-full h-full object-cover"
                                                    />
                                                ) : (
                                                    <div className="w-full h-full bg-gray-100" />
                                                )}
                                                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                                                <div className="absolute bottom-0 left-0 right-0 p-4">
                                                    <h4 className="text-white font-bold text-lg line-clamp-2">
                                                        {f.title}
                                                    </h4>
                                                    <div className="mt-1 flex items-center justify-between text-xs text-white/80">
                                                        <span>{f.region || ""}</span>
                                                        <span>
                                                            {f.completedAt
                                                                ? new Date(f.completedAt).toLocaleDateString()
                                                                : ""}
                                                        </span>
                                                    </div>
                                                </div>
                                                <div className="absolute left-0 top-0 bottom-0 w-2 bg-black/10" />
                                                {f.badge?.name && (
                                                    <div className="absolute top-3 right-3 bg-amber-500 text-white px-2 py-1 rounded-full text-xs font-medium">
                                                        {f.badge.name}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-10">
                                    <div className="text-6xl mb-3">🗂️</div>
                                    <div className="text-lg font-semibold text-gray-900 mb-1">
                                        아직 완료한 사건 파일이 없어요
                                    </div>
                                    <div className="text-gray-600">Escape 스토리를 완료하면 여기에서 볼 수 있어요</div>
                                </div>
                            )}
                        </div>
                    </div>
                )}
                {activeTab === "rewards" && renderRewardsTab()}
                {activeTab === "checkins" && renderCheckinsTab()}
                {/* 전체 화면 이미지 뷰어 */}
                {fullImageUrl && (
                    <div
                        className="fixed inset-0 z-[60] bg-black/90 flex items-center justify-center p-4"
                        role="dialog"
                        aria-modal="true"
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
                {selectedCaseStoryId !== null && (
                    <div
                        className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
                        role="dialog"
                        aria-modal="true"
                    >
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
                                                className="bg-[#a5743a] rounded-xl p-2 shadow-inner text-left"
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
            </main>

            {pwModalOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-2xl shadow-xl p-6 w-[90vw] max-w-md mx-4">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-xl font-bold text-gray-900">
                                {pwStep === "verify" ? "현재 비밀번호 확인" : "새 비밀번호 설정"}
                            </h3>
                            <button
                                className="hover:cursor-pointer text-gray-400 hover:text-gray-600 text-2xl"
                                onClick={() => setPwModalOpen(false)}
                            >
                                ×
                            </button>
                        </div>
                        {pwError && (
                            <div className="mb-3 rounded border border-red-300 bg-red-50 p-2 text-sm text-red-700">
                                {pwError}
                            </div>
                        )}
                        {pwStep === "verify" ? (
                            <form
                                onSubmit={async (e) => {
                                    e.preventDefault();
                                    setPwLoading(true);
                                    setPwError("");
                                    try {
                                        const token = localStorage.getItem("authToken");
                                        if (!token) {
                                            setPwError("로그인이 필요합니다.");
                                            setPwLoading(false);
                                            return;
                                        }
                                        const res = await fetch("/api/users/password/verify", {
                                            method: "POST",
                                            headers: {
                                                "Content-Type": "application/json",
                                                Authorization: `Bearer ${token}`,
                                            },
                                            body: JSON.stringify({ currentPassword: pwState.current }),
                                        });
                                        const data = await res.json().catch(() => ({}));
                                        if (!res.ok || !data?.ok) {
                                            setPwError(data?.error || "현재 비밀번호가 올바르지 않습니다.");
                                            setPwLoading(false);
                                            return;
                                        }
                                        setPwStep("change");
                                    } catch (err) {
                                        setPwError("확인 중 오류가 발생했습니다.");
                                    } finally {
                                        setPwLoading(false);
                                    }
                                }}
                                className="space-y-4"
                            >
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        현재 비밀번호
                                    </label>
                                    <input
                                        type="password"
                                        value={pwState.current}
                                        onChange={(e) => setPwState((s) => ({ ...s, current: e.target.value }))}
                                        required
                                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        placeholder="현재 비밀번호"
                                    />
                                </div>
                                <button
                                    type="submit"
                                    disabled={pwLoading}
                                    className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                                >
                                    {pwLoading ? "확인 중..." : "다음"}
                                </button>
                            </form>
                        ) : (
                            <form
                                onSubmit={async (e) => {
                                    e.preventDefault();
                                    setPwLoading(true);
                                    setPwError("");
                                    if (pwState.next.length < 6) {
                                        setPwError("새 비밀번호는 최소 6자 이상이어야 합니다.");
                                        setPwLoading(false);
                                        return;
                                    }
                                    if (pwState.next !== pwState.confirm) {
                                        setPwError("새 비밀번호가 일치하지 않습니다.");
                                        setPwLoading(false);
                                        return;
                                    }
                                    try {
                                        const token = localStorage.getItem("authToken");
                                        if (!token) {
                                            setPwError("로그인이 필요합니다.");
                                            setPwLoading(false);
                                            return;
                                        }
                                        const res = await fetch("/api/users/password", {
                                            method: "PUT",
                                            headers: {
                                                "Content-Type": "application/json",
                                                Authorization: `Bearer ${token}`,
                                            },
                                            body: JSON.stringify({
                                                currentPassword: pwState.current,
                                                newPassword: pwState.next,
                                            }),
                                        });
                                        const data = await res.json().catch(() => ({}));
                                        if (!res.ok || !data?.success) {
                                            setPwError(data?.error || "비밀번호 변경에 실패했습니다.");
                                            setPwLoading(false);
                                            return;
                                        }
                                        setPwModalOpen(false);
                                        alert("비밀번호가 변경되었습니다. 다시 로그인해 주세요.");
                                        localStorage.removeItem("authToken");
                                        window.dispatchEvent(new Event("authTokenChange"));
                                        router.push("/login");
                                    } catch (err) {
                                        setPwError("변경 중 오류가 발생했습니다.");
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
                                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        placeholder="새 비밀번호 (6자 이상)"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        새 비밀번호 확인
                                    </label>
                                    <input
                                        type="password"
                                        value={pwState.confirm}
                                        onChange={(e) => setPwState((s) => ({ ...s, confirm: e.target.value }))}
                                        required
                                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        placeholder="새 비밀번호 확인"
                                    />
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setPwModalOpen(false)}
                                        className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors cursor-pointer"
                                    >
                                        취소
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={pwLoading}
                                        className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                                    >
                                        {pwLoading ? "변경 중..." : "변경하기"}
                                    </button>
                                </div>
                            </form>
                        )}
                    </div>
                </div>
            )}

            {showEditModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full mx-4">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-2xl font-bold text-gray-900">프로필 수정</h3>
                            <button
                                onClick={() => setShowEditModal(false)}
                                className="text-gray-400 hover:text-gray-600 text-2xl cursor-pointer"
                            >
                                ×
                            </button>
                        </div>

                        <form onSubmit={handleEditSubmit} className="space-y-6">
                            {editError && (
                                <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                                    <p className="text-red-600 text-sm">{editError}</p>
                                </div>
                            )}

                            <div>
                                <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                                    닉네임
                                </label>
                                <input
                                    type="text"
                                    id="name"
                                    name="name"
                                    value={editForm.name || ""}
                                    onChange={handleEditChange}
                                    required
                                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-500"
                                    placeholder="닉네임을 입력하세요"
                                />
                            </div>

                            <div>
                                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                                    이메일
                                </label>
                                <input
                                    type="email"
                                    id="email"
                                    name="email"
                                    value={editForm.email || ""}
                                    onChange={handleEditChange}
                                    required
                                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-500"
                                    placeholder="이메일을 입력하세요"
                                />
                            </div>

                            <div>
                                <label htmlFor="mbti" className="block text-sm font-medium text-gray-700 mb-2">
                                    MBTI
                                </label>
                                <select
                                    id="mbti"
                                    name="mbti"
                                    value={editForm.mbti || ""}
                                    onChange={handleEditChange}
                                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-500"
                                >
                                    <option value="">MBTI를 선택하세요</option>
                                    <option value="INTJ">INTJ</option>
                                    <option value="INTP">INTP</option>
                                    <option value="ENTJ">ENTJ</option>
                                    <option value="ENTP">ENTP</option>
                                    <option value="INFJ">INFJ</option>
                                    <option value="INFP">INFP</option>
                                    <option value="ENFJ">ENFJ</option>
                                    <option value="ENFP">ENFP</option>
                                    <option value="ISTJ">ISTJ</option>
                                    <option value="ISFJ">ISFJ</option>
                                    <option value="ESTJ">ESTJ</option>
                                    <option value="ESFJ">ESFJ</option>
                                    <option value="ISTP">ISTP</option>
                                    <option value="ISFP">ISFP</option>
                                    <option value="ESTP">ESTP</option>
                                    <option value="ESFP">ESFP</option>
                                </select>
                            </div>

                            <div>
                                <label htmlFor="age" className="block text-sm font-medium text-gray-700 mb-2">
                                    나이
                                </label>
                                <input
                                    type="number"
                                    id="age"
                                    name="age"
                                    value={editForm.age || ""}
                                    onChange={handleEditChange}
                                    min="1"
                                    max="120"
                                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-500"
                                    placeholder="나이를 입력하세요"
                                />
                            </div>

                            <div className="flex space-x-3">
                                <button
                                    type="button"
                                    onClick={() => setShowEditModal(false)}
                                    className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors cursor-pointer"
                                >
                                    취소
                                </button>
                                <button
                                    type="submit"
                                    disabled={editLoading}
                                    className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                                >
                                    {editLoading ? "수정 중..." : "수정하기"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {selectedBadge && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-2xl shadow-xl p-6 w-[90vw] max-w-md mx-4">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-xl font-bold text-gray-900">{selectedBadge.name}</h3>
                            <button
                                className="hover:cursor-pointer text-gray-400 hover:text-gray-600 text-2xl"
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
                                    className="hover:cursor-pointer px-4 py-2 rounded-lg border bg-white hover:bg-gray-50 text-black    "
                                    onClick={() => selectedBadge && shareBadgeToKakao(selectedBadge)}
                                >
                                    자랑하기
                                </button>
                                <button
                                    className="hover:cursor-pointer px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
                                    onClick={() => {
                                        setSelectedBadge(null);
                                    }}
                                >
                                    닫기
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {showLogoutModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full mx-4">
                        <div className="text-center">
                            <div className="text-6xl mb-4">🚪</div>
                            <h3 className="text-2xl font-bold text-gray-900 mb-4">로그아웃</h3>
                            <p className="text-gray-600 mb-8">정말 로그아웃 하시겠습니까?</p>

                            <div className="flex space-x-3">
                                <button
                                    onClick={() => setShowLogoutModal(false)}
                                    className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors cursor-pointer"
                                >
                                    취소
                                </button>
                                <button
                                    onClick={handleLogout}
                                    className="flex-1 px-4 py-3 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors cursor-pointer"
                                >
                                    로그아웃
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
