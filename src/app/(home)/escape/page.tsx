"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "@/components/ImageFallback";
import LoginModal from "@/components/LoginModal";

// --- [설정] 한글 변환 맵 ---
const CATEGORY_MAP: Record<string, string> = {
    footsteps: "발자취",
    history: "역사",
    time: "시간",
    person: "인물",
    location: "장소",
    cafe: "카페",
    restaurant: "식당",
    lunch: "점심",
    dinner: "저녁",
    sights: "명소",
    complex: "복합문화",
    culture: "문화",
    store: "상점",
};

// --- 타입 정의 ---
type Badge = { id: number; name: string; description: string; image_url?: string };
type Story = {
    id: number;
    title: string;
    synopsis: string;
    imageUrl?: string | null;
    region?: string;
    estimated_duration_min?: number;
    price?: string;
    reward_badge_id?: number | null;
    is_active: boolean;
    level?: number | string;
    created_at?: string;
    updated_at?: string;
};
type StoryChapter = {
    id: number;
    story_id: number;
    chapter_number: number;
    title: string;
    placeOptions?: any[];
    location_name?: string;
    address?: string;
    latitude?: number | null;
    longitude?: number | null;
    story_text?: string;
    mission_type?: "quiz" | "photo" | "location" | "none";
    mission_payload?: any;
    puzzle_text?: string;
};
type UserStoryProgress = {
    story_id: number;
    current_chapter: number;
    status: "not_started" | "in_progress" | "completed";
    started_at?: number | null;
    completed_at?: number | null;
};
type ProgressMap = Record<string, UserStoryProgress>;

// --- LocalStorage 헬퍼 ---
const STORAGE_KEY = "escape_progress_v1";
function readProgress(): ProgressMap {
    if (typeof window === "undefined") return {};
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? (JSON.parse(raw) as ProgressMap) : {};
    } catch {
        return {};
    }
}
function writeProgress(map: ProgressMap) {
    if (typeof window === "undefined") return;
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
    } catch {}
}

// --- 훅 ---
function useEscapeGame() {
    const router = useRouter();
    const [stories, setStories] = useState<Story[]>([]);
    const [chapters, setChapters] = useState<Record<number, StoryChapter[]>>({});
    const [badges, setBadges] = useState<Badge[]>([]);
    const [progressMap, setProgressMap] = useState<ProgressMap>({});
    const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
    const [toast, setToast] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [showLoginModal, setShowLoginModal] = useState<boolean>(false);

    useEffect(() => {
        setProgressMap(readProgress());
        const fetchInitialData = async () => {
            setIsLoading(true);
            try {
                const res = await fetch("/api/escape/stories?nocache=1", { cache: "no-store" });
                if (!res.ok) throw new Error("API response was not ok");
                const data = await res.json();
                const storyData = Array.isArray(data) ? data : Array.isArray(data?.stories) ? data.stories : [];
                const badgeData: Badge[] = [];
                storyData.forEach((s: any) => {
                    if (s.badge) badgeData.push(s.badge);
                });
                setStories(storyData);
                setBadges(badgeData);
            } catch (e) {
                console.error("Failed to load stories", e);
                setToast("스토리 정보를 불러오는데 실패했습니다.");
            } finally {
                setIsLoading(false);
            }
        };
        fetchInitialData();
    }, []);

    useEffect(() => {
        // 🟢 쿠키 기반 인증: fetchSession 사용
        const checkAuth = async () => {
            const { fetchSession } = await import("@/lib/authClient");
            const session = await fetchSession();
            setIsLoggedIn(session.authenticated);
        };
        checkAuth();
        
        const handleAuthChange = async () => {
            const { fetchSession } = await import("@/lib/authClient");
            const session = await fetchSession();
            setIsLoggedIn(session.authenticated);
        };
        window.addEventListener("authLoginSuccess", handleAuthChange);
        window.addEventListener("authTokenChange", handleAuthChange);
        return () => {
            window.removeEventListener("authLoginSuccess", handleAuthChange);
            window.removeEventListener("authTokenChange", handleAuthChange);
        };
    }, []);

    useEffect(() => {
        if (!toast) return;
        const timer = setTimeout(() => setToast(null), 2000);
        return () => clearTimeout(timer);
    }, [toast]);

    const fetchChaptersForStory = useCallback(
        async (storyId: number) => {
            if (chapters[storyId]) return chapters[storyId];
            try {
                const res = await fetch(`/api/escape/chapters?storyId=${storyId}`);
                const data = await res.json();
                const sortedChapters = Array.isArray(data)
                    ? data.sort((a, b) => a.chapter_number - b.chapter_number)
                    : [];
                setChapters((prev) => ({ ...prev, [storyId]: sortedChapters }));
                return sortedChapters;
            } catch (e) {
                console.error("Failed to load chapters", e);
                return [];
            }
        },
        [chapters]
    );

    const handleStartStory = async (storyId: number) => {
        // 🟢 쿠키 기반 인증: fetchSession으로 확인
        const { fetchSession } = await import("@/lib/authClient");
        const session = await fetchSession();
        if (!session.authenticated && !isLoggedIn) {
            setShowLoginModal(true);
            return;
        }
        const existingProgress = progressMap[String(storyId)];
        if (!existingProgress || existingProgress.status === "not_started") {
            const newProgress: UserStoryProgress = {
                story_id: storyId,
                current_chapter: 1,
                status: "in_progress",
                started_at: Date.now(),
            };
            const nextMap = { ...progressMap, [String(storyId)]: newProgress };
            setProgressMap(nextMap);
            writeProgress(nextMap);
        }
        router.push(`/escape/intro?id=${storyId}`);
    };

    return {
        stories,
        badges,
        chapters,
        progressMap,
        isLoggedIn,
        isLoading,
        toast,
        showLoginModal,
        setShowLoginModal,
        fetchChaptersForStory,
        handleStartStory,
        setToast,
    };
}

// --- UI: StoryCard ---
const StoryCard = React.memo(
    ({ story, badge, progress, onStart, onResume, onDetails, isFirst }: any) => {
        const imageSrc = story.imageUrl || badge?.image_url || "";
        const isCompleted = progress?.status === "completed";
        const isInProgress = progress?.status === "in_progress";
        const isPopular = /종로|익선동|1919|Jongro|Jongno/i.test(`${story.title} ${story.region || ""}`);

        const getDifficultyStars = (level?: number | string) => {
            let lv = 0;
            if (level !== undefined && level !== null) {
                const parsed = parseInt(
                    String(level).replace(/[０-９]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0)),
                    10
                );
                if (!isNaN(parsed) && parsed > 0) lv = Math.min(5, parsed);
            }
            return Array.from({ length: 5 }).map((_, i) => (
                <svg
                    key={i}
                    className={`w-4 h-4 ${i < lv ? "text-yellow-400" : "text-gray-300"}`}
                    viewBox="0 0 20 20"
                    fill="currentColor"
                >
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.802 2.035a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.802-2.035a1 1 0 00-1.175 0l-2.802 2.035c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81H7.03a1 1 0 00.95-.69l1.07-3.292z" />
                </svg>
            ));
        };

        return (
            <div
                className="group flex flex-col gap-4 border rounded-xl transition-shadow bg-white hover:border-gray-300"
                onClick={() => onDetails(story.id)}
            >
                <div className="relative h-40 rounded-xl overflow-hidden">
                    {isPopular && (
                        <div className="absolute top-2 left-2 z-10">
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-bold bg-amber-500 text-white shadow">
                                <span>🔥</span> 인기
                            </span>
                        </div>
                    )}
                    <Image
                        src={imageSrc || ""}
                        alt={story.title}
                        fill
                        priority={isFirst}
                        sizes="100vw"
                        className="object-cover"
                    />
                </div>
                <div className="pt-1 pr-4 pb-4 pl-4">
                    <div className="mb-2 flex items-center justify-between">
                        <div>
                            {story.region && (
                                <span className="inline-block bg-blue-600 text-white text-xs px-3 py-1 rounded-full font-medium">
                                    #{story.region}
                                </span>
                            )}
                        </div>
                        <div className="flex items-center gap-1" title={`난이도 ${story.level || 0}/5`}>
                            {getDifficultyStars(story.level)}
                        </div>
                    </div>
                    <div className="mb-2">
                        <h3 className="text-xl font-bold text-gray-900">{story.title}</h3>
                    </div>
                    <p className="text-gray-600 mb-4 line-clamp-2">{story.synopsis}</p>
                    {badge && (
                        <div className="text-xs text-amber-700 mb-4 bg-amber-50 px-2 py-1 rounded-md inline-block">
                            🏅 보상 배지: {badge.name}
                        </div>
                    )}
                    <div className="flex items-center justify-end gap-3">
                        {isCompleted ? (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onDetails(story.id);
                                }}
                                className="px-4 py-2 rounded-full text-sm font-semibold bg-gray-200 text-gray-700 hover:bg-gray-300"
                            >
                                완료 (상세)
                            </button>
                        ) : isInProgress ? (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onResume(story.id);
                                }}
                                className="px-4 py-2 rounded-full text-sm font-semibold btn-primary"
                            >
                                이어하기
                            </button>
                        ) : (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onStart(story.id);
                                }}
                                className="px-4 py-2 rounded-full text-sm font-semibold btn-primary"
                            >
                                시작하기
                            </button>
                        )}
                    </div>
                </div>
            </div>
        );
    },
    (prev: any, next: any) => {
        return (
            prev.story?.id === next.story?.id &&
            prev.story?.title === next.story?.title &&
            prev.story?.imageUrl === next.story?.imageUrl &&
            prev.progress?.status === next.progress?.status &&
            prev.progress?.current_chapter === next.progress?.current_chapter &&
            prev.badge?.id === next.badge?.id &&
            prev.isFirst === next.isFirst
        );
    }
);

// --- DetailsModal: 화면 정중앙 팝업 스타일 ---
const DetailsModal = ({ story, chapters, isOpen, onClose, onStart }: any) => {
    if (!isOpen || !story) return null;

    // 렌더링 로직을 JSX 밖으로 분리하여 오류 방지
    const renderChapters = () => {
        if (!chapters || chapters.length === 0) {
            return <li className="text-sm text-gray-500 text-center py-4">챕터 정보를 불러오는 중...</li>;
        }

        return chapters.map((c: any) => {
            // 1) 장소/테마 데이터
            const place = c.placeOptions?.[0];
            const rawKey = (place?.theme || place?.category || place?.type || "").trim().toLowerCase();

            // 2) 표시용 텍스트 (한글 매핑 우선)
            const mapped = rawKey ? CATEGORY_MAP[rawKey] || place?.theme || place?.category || place?.type || "" : "";

            // 3) 메인 텍스트: theme(또는 fallback) 있으면 사용, 없으면 챕터 제목
            const mainDisplay = mapped || c.title;

            // 4) 오른쪽 뱃지: theme/카테고리/타입에서 파생된 동일 텍스트
            const badgeLabel = mapped || null;

            return (
                <li
                    key={c.id}
                    className="text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800/50 rounded-lg px-4 py-3 flex items-center justify-between"
                >
                    <div className="flex items-center gap-2 overflow-hidden">
                        <span className="font-bold text-gray-900 dark:text-white whitespace-nowrap">Chapter {c.chapter_number}</span>
                        <span className="truncate dark:text-gray-400">{mainDisplay}</span>
                    </div>
                    {badgeLabel && (
                        <span className="ml-2 shrink-0 text-[11px] font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-2 py-1 rounded border border-blue-100 dark:border-blue-800/50">
                            {badgeLabel}
                        </span>
                    )}
                </li>
            );
        });
    };

    return (
        <div
            className="fixed inset-0 z-50 bg-black/50 dark:bg-black/70 flex items-center justify-center p-4"
            onClick={onClose}
            role="dialog"
            aria-modal="true"
        >
            <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

            <div
                className="w-full max-w-[450px] bg-white dark:bg-[#1a241b] rounded-xl border border-gray-100 dark:border-gray-800 overflow-hidden relative"
                style={{ animation: "slideUp 0.3s ease-out forwards" }}
                onClick={(e) => e.stopPropagation()}
            >
                <div className="p-6 max-h-[80vh] overflow-y-auto">
                    <div className="relative w-full h-48 rounded-xl overflow-hidden mb-4 bg-gray-100 dark:bg-gray-800">
                        <Image
                            src={story.imageUrl || ""}
                            alt={story.title}
                            fill
                            className="object-cover"
                            sizes="100vw"
                        />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{story.title}</h2>
                    <p className="text-gray-700 dark:text-gray-400 mt-2 text-sm leading-relaxed">{story.synopsis}</p>

                    <div className="mt-6">
                        <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-3">챕터 목록</h3>
                        <ul className="space-y-2">{renderChapters()}</ul>
                    </div>

                    <div className="mt-6 flex justify-end gap-3">
                        <button
                            onClick={onClose}
                            className="px-5 py-3 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                        >
                            닫기
                        </button>
                        <button
                            onClick={() => onStart(story.id)}
                            className="px-5 py-3 text-sm font-bold text-white bg-blue-600 dark:bg-blue-700 rounded-xl hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors shadow-md"
                        >
                            시작하기
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

// --- 메인 페이지 ---
export default function EscapePage() {
    const { stories, badges, chapters, progressMap, isLoading, showLoginModal, setShowLoginModal, fetchChaptersForStory, handleStartStory } =
        useEscapeGame();
    const [activeModalStoryId, setActiveModalStoryId] = useState<number | null>(null);

    // 배지 맵 캐시(O(1) 조회)
    const badgeById = React.useMemo(() => {
        const m = new Map<number, any>();
        for (const b of badges) m.set(b.id, b);
        return m;
    }, [badges]);

    const handleOpenDetails = (storyId: number) => {
        fetchChaptersForStory(storyId);
        setActiveModalStoryId(storyId);
    };

    const handleCloseModal = () => setActiveModalStoryId(null);
    const handleResumeStory = (storyId: number) => handleStartStory(storyId);

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const startId = params.get("startId");
        if (startId && stories.length > 0) {
            const storyId = parseInt(startId, 10);
            if (stories.some((s) => s.id === storyId)) {
                handleStartStory(storyId);
                const newUrl = window.location.pathname;
                window.history.replaceState({ ...window.history.state, as: newUrl, url: newUrl }, "", newUrl);
            }
        }
    }, [stories, handleStartStory]);

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="bg-white shadow-sm">
                <div className="max-w-[400px] mx-auto px-4 py-5">
                    <h1 className="text-2xl font-bold text-gray-900 tracking-tight">커플 미션 게임</h1>
                    <p className="text-gray-600 mt-2">도심을 누비며 챕터를 완료하고 배지를 획득하세요!</p>
                </div>
            </div>

            <section className="max-w-[500px] mx-auto px-4 py-8">
                <div className="grid grid-cols-1 gap-6">
                    {isLoading
                        ? [...Array(3)].map((_, i) => (
                              <div key={i} className="bg-white rounded-xl border border-gray-100 animate-pulse h-60" />
                          ))
                        : stories.map((story, index) => (
                              <StoryCard
                                  key={story.id}
                                  story={story}
                                  badge={badgeById.get((story.reward_badge_id as number) || -1)}
                                  progress={progressMap[String(story.id)]}
                                  onStart={handleStartStory}
                                  onResume={handleResumeStory}
                                  onDetails={handleOpenDetails}
                                  isFirst={index < 2}
                              />
                          ))}
                </div>
            </section>

            <DetailsModal
                isOpen={!!activeModalStoryId}
                onClose={handleCloseModal}
                story={stories.find((s) => s.id === activeModalStoryId) || null}
                chapters={chapters[activeModalStoryId!] || []}
                onStart={handleStartStory}
            />
            {showLoginModal && (
                <LoginModal
                    onClose={() => setShowLoginModal(false)}
                    next={`/escape`}
                />
            )}
            <div className="md:hidden h-20" />
        </div>
    );
}
