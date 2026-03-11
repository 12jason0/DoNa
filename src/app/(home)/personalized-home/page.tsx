"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useLocale } from "@/context/LocaleContext";
import Image from "@/components/ImageFallback";
import { apiFetch, authenticatedFetch } from "@/lib/authClient"; // 🟢 쿠키 기반 API 호출
import { getS3StaticUrl } from "@/lib/s3Static";
import TicketPlans from "@/components/TicketPlans";
import LoginModal from "@/components/LoginModal";
import OnboardingBottomSheet from "@/components/OnboardingBottomSheet";
import CourseLockOverlay from "@/components/CourseLockOverlay";
import TapFeedback from "@/components/TapFeedback";
import { isIOS } from "@/lib/platform";
import {
    Sparkles,
    MapPin,
    Clock,
    Users,
    Star,
    CheckCircle,
    MessageCircle,
    RefreshCw,
    ChevronRight,
    Search,
    Zap,
    Gift,
    Bot,
    X,
    Navigation,
    Store,
    Lock,
    Leaf,
    Footprints,
} from "lucide-react";

// --- [스타일 추가] 카드 뒤집기 및 애니메이션 효과 ---
const gameStyles = `
  .perspective-1000 { perspective: 1000px; }
  .transform-style-3d { transform-style: preserve-3d; }
  .backface-hidden { backface-visibility: hidden; }
  .rotate-y-180 { transform: rotateY(180deg); }
  
  @keyframes radar-spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
  .animate-radar { animation: radar-spin 2s linear infinite; }
  
  @keyframes pulse-fast {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.8; transform: scale(0.95); }
  }
  .animate-pulse-fast { animation: pulse-fast 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite; }

  /* 스크롤바 숨기기 (깔끔한 UI를 위해) */
  .no-scrollbar::-webkit-scrollbar {
      display: none;
  }
  .no-scrollbar {
      -ms-overflow-style: none;
      scrollbar-width: none;
  }
`;

// 타입 정의
interface QuestionOption {
    text: string;
    value: string;
    next: string;
}

interface Question {
    id: string;
    type: string;
    text: string;
    options?: QuestionOption[];
}

interface Message {
    type: "ai" | "user";
    text: string;
}

interface Course {
    id: string;
    title: string;
    description: string;
    duration: string;
    location: string;
    price?: string;
    tags: string[];
    rating: number;
    reviewCount: number;
    participants: number;
    highlights: string[];
    score?: number;
    grade?: "FREE" | "BASIC" | "PREMIUM";
    imageUrl?: string;
    coursePlaces?: {
        order_index?: number;
        place?: {
            id?: number;
            name?: string;
            imageUrl?: string;
            category?: string;
            address?: string;
        };
    }[];
    matchScore?: number | null;
    matchReason?: string;
}

// 질문 시나리오 (t 함수로 번역 적용)
const getQuestionFlow = (t: ReturnType<typeof useLocale>["t"]): Question[] => [
    {
        id: "greeting",
        type: "ai",
        text: t("personalizedHome.qGreeting"),
        options: [
            { text: t("personalizedHome.qGreetingStart"), value: "start", next: "goal" },
            { text: t("personalizedHome.qGreetingPreview"), value: "preview", next: "preview" },
        ],
    },
    {
        id: "preview",
        type: "ai", 
        text: t("personalizedHome.qPreview"),
        options: [{ text: t("personalizedHome.qPreviewStart"), value: "start", next: "goal" }],
    },
    {
        id: "goal",
        type: "ai",
        text: t("personalizedHome.qGoal"),
        options: [
            { text: t("personalizedHome.qGoalAnniversary"), value: "기념일", next: "goal_detail" },
            { text: t("personalizedHome.qGoalNormal"), value: "무난", next: "companion_today" },
            { text: t("personalizedHome.qGoalEmotional"), value: "감성", next: "companion_today" },
            { text: t("personalizedHome.qGoalActive"), value: "활동", next: "companion_today" },
        ],
    },
    {
        id: "goal_detail",
        type: "ai",
        text: t("personalizedHome.qGoalDetail"),
        options: [
            { text: t("personalizedHome.qGoalDetail100"), value: "100일", next: "mood_today" },
            { text: t("personalizedHome.qGoalDetailBirthday"), value: "생일", next: "mood_today" },
            { text: t("personalizedHome.qGoalDetailYearEnd"), value: "연말", next: "mood_today" },
        ],
    },
    {
        id: "companion_today",
        type: "ai",
        text: t("personalizedHome.qCompanion"),
        options: [
            { text: t("personalizedHome.qCompanionLover"), value: "연인", next: "mood_today" },
            { text: t("personalizedHome.qCompanionSome"), value: "썸 상대", next: "mood_today" },
            { text: t("personalizedHome.qCompanionBlind"), value: "소개팅 상대", next: "mood_today" },
            { text: t("personalizedHome.qCompanionFriend"), value: "친구", next: "mood_today" },
            { text: t("personalizedHome.qCompanionAlone"), value: "혼자", next: "mood_today" },
        ],
    },
    {
        id: "mood_today",
        type: "ai",
        text: t("personalizedHome.qMood"),
        options: [
            { text: t("personalizedHome.qMoodQuiet"), value: "조용한", next: "region_today" },
            { text: t("personalizedHome.qMoodEmotional"), value: "감성 가득한", next: "region_today" },
            { text: t("personalizedHome.qMoodTrendy"), value: "트렌디한", next: "region_today" },
            { text: t("personalizedHome.qMoodActive"), value: "활동적인", next: "region_today" },
        ],
    },
    {
        id: "region_today",
        type: "ai",
        text: t("personalizedHome.qRegion"),
        options: [
            { text: t("personalizedHome.qRegionMulla"), value: "문래·영등포", next: "payment_prompt" },
            { text: t("personalizedHome.qRegionHapjeong"), value: "합정·용산", next: "payment_prompt" },
            { text: t("personalizedHome.qRegionAnguk"), value: "안국·서촌", next: "payment_prompt" },
            { text: t("personalizedHome.qRegionEuljiro"), value: "을지로", next: "payment_prompt" },
            { text: t("personalizedHome.qRegionYeouido"), value: "여의도", next: "payment_prompt" },
        ],
    },
    {
        id: "payment_prompt",
        type: "ai",
        text: t("personalizedHome.qPayment"),
        options: [
            { text: t("personalizedHome.qPaymentDraw"), value: "yes", next: "complete" },
            { text: t("personalizedHome.qPaymentLater"), value: "no", next: "greeting" },
        ],
    },
];

const AIRecommender = () => {
    const router = useRouter();
    const pathname = usePathname();
    const { t } = useLocale();
    const questionFlow = useMemo(() => getQuestionFlow(t), [t]);

    // 상태 관리
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [userName, setUserName] = useState("");
    const [nickname, setNickname] = useState("");
    const [profileImageUrl, setProfileImageUrl] = useState<string | null>(null);
    const [showLogin, setShowLogin] = useState(false);
    const [showPaywall, setShowPaywall] = useState(false);
    const [loginNavigating, setLoginNavigating] = useState(false);
    const [authLoading, setAuthLoading] = useState(false);

    const [messages, setMessages] = useState<Message[]>([]);
    const [currentQuestion, setCurrentQuestion] = useState<Question>(questionFlow[0]);
    const [userAnswers, setUserAnswers] = useState<Record<string, string>>({});
    const [recommendedCourses, setRecommendedCourses] = useState<Course[]>([]);
    const [isTyping, setIsTyping] = useState(false);
    const [showRecommendations, setShowRecommendations] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);

    // 👇 conversationStarted 대신 showChatModal 사용
    const [showChatModal, setShowChatModal] = useState(false);

    const [progress, setProgress] = useState(0);
    const [showUpsell, setShowUpsell] = useState(false);
    const [upsellFor, setUpsellFor] = useState<"BASIC" | "PREMIUM" | null>(null);
    const [userTier, setUserTier] = useState<"FREE" | "BASIC" | "PREMIUM">("FREE");
    const [hasLongTermPreferences, setHasLongTermPreferences] = useState(false);
    const [netError, setNetError] = useState<string | null>(null);
    const [isSelecting, setIsSelecting] = useState(false);
    const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
    const [isUserDataLoading, setIsUserDataLoading] = useState(true); // 🟢 사용자 정보 로딩 상태
    const [platform, setPlatform] = useState<"ios" | "android" | "web">("web"); // 🟢 플랫폼 감지

    // --- [추가] 게임 효과 및 모달 상태 ---
    const [isAnalyzing, setIsAnalyzing] = useState(false); // 분석 화면 표시 여부
    const [analysisText, setAnalysisText] = useState(""); // 분석 멘트 (초기값은 useEffect에서 t()로 설정)
    const [revealedCards, setRevealedCards] = useState<Record<string, boolean>>({}); // 카드 뒤집힘 상태

    // 모달 및 선택 데이터 상태
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const [showAlreadyUsedModal, setShowAlreadyUsedModal] = useState(false);
    const [showUpgradeModal, setShowUpgradeModal] = useState(false);
    /** 한도 초과 모달용: tier별 문구 표시 (AiRecommendationUsage 기준) */
    const [limitExceededContext, setLimitExceededContext] = useState<{
        tier: "FREE" | "BASIC" | "PREMIUM";
        limit: number | null;
        used: number;
    } | null>(null);
    const [showOnboardingSheet, setShowOnboardingSheet] = useState(false);
    const [pendingCourse, setPendingCourse] = useState<{ id: string; title: string; grade?: string } | null>(null);
    /** 카드에서 '{t("personalizedHome.viewDetail")}' 클릭 시 뜨는 상세 모달 (여기서 '코스 시작하기' 시 저장 → 피드백 모달) */
    const [detailModalCourse, setDetailModalCourse] = useState<Course | null>(null);
    /** 피드백 모달: 코스 선택 후 만족도 질문 */
    const [showFeedbackModal, setShowFeedbackModal] = useState(false);
    const [feedbackTarget, setFeedbackTarget] = useState<{
        courseId: string;
        matchScore?: number | null;
        matchReason?: string;
        todayContext?: Record<string, unknown>;
    } | null>(null);

    // 🟢 iOS 플랫폼 감지
    useEffect(() => {
        setPlatform(isIOS() ? "ios" : "web");
    }, []);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const recommendationResultsRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, isTyping, showChatModal]); // showChatModal 추가

    // 🟢 추천 결과가 뜰 때 "🎁 추천 결과" + 상단 문구가 보이도록 스크롤
    useEffect(() => {
        if (showRecommendations && !isAnalyzing && recommendationResultsRef.current) {
            const timer = setTimeout(() => {
                recommendationResultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
            }, 100);
            return () => clearTimeout(timer);
        }
    }, [showRecommendations, isAnalyzing]);

    // 유저 정보 가져오기 (성능 최적화: 캐싱 추가 및 즉시 표시)
    const fetchUserData = async (forceRefresh = false) => {
        try {
            // 🟢 쿠키 기반 인증: apiFetch 사용하여 캐싱 활용
            const { apiFetch } = await import("@/lib/authClient");
            const { data: userData, response } = await apiFetch<any>("/api/users/profile", {
                cache: forceRefresh ? "no-store" : "force-cache", // 🟢 강제 갱신 시 캐시 무시
                next: forceRefresh ? { revalidate: 0 } : { revalidate: 60 }, // 🟢 강제 갱신 시 즉시 재검증
            });

            if (response.ok && userData) {
                const nick =
                    (userData as any).nickname ||
                    (userData as any).name ||
                    (userData as any).email?.split("@")[0] ||
                    t("personalizedHome.userFallback");

                // HTTP URL을 HTTPS로 변환 (Mixed Content 경고 해결)
                const convertToHttps = (url: string | null | undefined): string | null => {
                    if (!url) return null;
                    if (url.startsWith("http://")) {
                        return url.replace(/^http:\/\//, "https://");
                    }
                    return url;
                };

                const profileImage = (userData as any).profileImage || (userData as any).user?.profileImage || null;

                // 🟢 [Performance]: 즉시 상태 업데이트 (requestAnimationFrame 제거)
                setIsLoggedIn(true);
                setUserName(nick);
                setNickname(nick);
                setProfileImageUrl(convertToHttps(profileImage));
                localStorage.setItem("user", JSON.stringify(userData));
            } else {
                // 🟢 response.ok가 false인 경우에도 handleLogout 대신 로그인 상태만 변경 (리다이렉트 방지)
                setIsLoggedIn(false);
                setUserName("");
                setNickname("");
                setProfileImageUrl(null);
            }
            setIsUserDataLoading(false);
        } catch (error) {
            console.error("사용자 정보 조회 오류:", error);
            // 🟢 에러 발생 시 localStorage 정리
            localStorage.removeItem("authToken");
            localStorage.removeItem("user");
            localStorage.removeItem("loginTime");
            setIsLoggedIn(false);
            setIsUserDataLoading(false);
        }
    };

    // 🟢 로그인 상태 확인 (쿠키 기반 인증) - 성능 최적화
    useEffect(() => {
        const checkLoginStatus = async () => {
            // 🟢 [Performance]: localStorage에서 캐시된 사용자 정보 즉시 표시 (동기적으로)
            const cachedUser = localStorage.getItem("user");
            if (cachedUser) {
                try {
                    const parsed = JSON.parse(cachedUser);
                    const nick =
                        parsed.nickname ||
                        parsed.name ||
                        parsed.email?.split("@")[0] ||
                        t("personalizedHome.userFallback");
                    // 🟢 [Performance]: 즉시 표시 (requestAnimationFrame 제거로 지연 없음)
                    setUserName(nick);
                    setNickname(nick);
                    setProfileImageUrl(parsed.profileImage || parsed.profileImageUrl || null);
                    setIsLoggedIn(true);
                    setIsUserDataLoading(false); // 🟢 캐시가 있으면 즉시 로딩 완료로 표시
                } catch {}
            }

            try {
                // 🟢 [Performance]: fetchSession만 먼저 확인 (가볍게)
                const { fetchSession } = await import("@/lib/authClient");
                const session = await fetchSession();

                if (session.authenticated && session.user) {
                    setIsLoggedIn(true);
                    // 🟢 [Performance]: 캐시가 없을 때만 로딩 상태 유지, 있으면 백그라운드에서 업데이트
                    if (!cachedUser) {
                        setIsUserDataLoading(true);
                    }
                    // 🟢 [Performance]: 백그라운드에서 사용자 정보 업데이트 (비동기)
                    fetchUserData();
                } else {
                    // 🟢 로그인되지 않은 경우 localStorage 정리 (이전 데이터 제거)
                    localStorage.removeItem("authToken");
                    localStorage.removeItem("user");
                    localStorage.removeItem("loginTime");
                    setIsLoggedIn(false);
                    setUserName("");
                    setNickname("");
                    setProfileImageUrl(null);
                    setIsUserDataLoading(false);
                }
            } catch (error) {
                console.error("로그인 상태 확인 실패:", error);
                // 🟢 에러 발생 시에도 localStorage 정리
                localStorage.removeItem("authToken");
                localStorage.removeItem("user");
                localStorage.removeItem("loginTime");
                setIsLoggedIn(false);
                setIsUserDataLoading(false);
            }
        };

        checkLoginStatus();

        // 🟢 쿠키 기반 인증 이벤트 리스너
        const handleAuthLoginSuccess = () => {
            checkLoginStatus();
        };

        const handleAuthLogout = () => {
            // 🟢 로그아웃 시 localStorage 정리 (이전 데이터 제거)
            localStorage.removeItem("authToken");
            localStorage.removeItem("user");
            localStorage.removeItem("loginTime");
            setIsLoggedIn(false);
            setUserName("");
            setNickname("");
            setProfileImageUrl(null);
        };

        const handleAuthTokenChange = () => {
            checkLoginStatus();
        };

        window.addEventListener("authLoginSuccess", handleAuthLoginSuccess);
        window.addEventListener("authLogout", handleAuthLogout);
        window.addEventListener("authTokenChange", handleAuthTokenChange);

        return () => {
            window.removeEventListener("authLoginSuccess", handleAuthLoginSuccess);
            window.removeEventListener("authLogout", handleAuthLogout);
            window.removeEventListener("authTokenChange", handleAuthTokenChange);
        };
    }, []);

    // 로그아웃
    const handleLogout = async () => {
        try {
            // 🟢 [Fix]: authClient의 logout 함수 사용하여 일관된 로그아웃 처리
            const { logout } = await import("@/lib/authClient");
            await logout();
            // 🟢 로그아웃 후 상태 초기화
            setIsLoggedIn(false);
            setUserName("");
            setNickname("");
            setProfileImageUrl(null);
            resetConversation();
        } catch (error) {
            console.error("로그아웃 실패:", error);
            // 🟢 에러 발생 시에도 상태 초기화
            setIsLoggedIn(false);
            setUserName("");
            setNickname("");
            setProfileImageUrl(null);
            resetConversation();
            // 🟢 강제로 홈으로 이동
            try {
                router.replace("/");
            } catch {}
        }
    };

    const resetConversation = () => {
        setMessages([{ type: "ai", text: questionFlow[0].text }]);
        setCurrentQuestion(questionFlow[0]);
        setUserAnswers({});
        setRecommendedCourses([]);
        setShowRecommendations(false);
        setProgress(0);
        setShowUpsell(false);
        setUpsellFor(null);
        setIsGenerating(false);
        setSelectedCourseId(null);
        setIsAnalyzing(false);
        setRevealedCards({});
        setShowChatModal(false); // 모달 닫기
    };

    // 👇 [수정됨] 대화 시작 시 사용 횟수 체크 → 2회차+ 온보딩 미완 시 바텀시트 표시
    const startConversation = async () => {
        // 비로그인 체크
        if (!isLoggedIn) {
            setShowLogin(true);
            return;
        }

        // 🟢 [단일 소스] precheck: AiRecommendationUsage 기준, 초과 시 채팅 안 열고 바로 모달
        try {
            const pre = await authenticatedFetch<{
                canUse: boolean;
                limit: number | null;
                used: number;
                remaining: number | null;
                tier: "FREE" | "BASIC" | "PREMIUM";
            }>("/api/recommendations/precheck", { method: "GET", cache: "no-store" }, false);

            if (pre?.canUse === false) {
                setLimitExceededContext({ tier: pre.tier, limit: pre.limit, used: pre.used });
                setShowAlreadyUsedModal(true);
                return;
            }
        } catch {
            setNetError(t("personalizedHome.netError"));
            return;
        }

        // 🟢 2회차 진입(usageCount >= 1) & 온보딩 미완 → 온보딩 바텀시트
        try {
            const data = await authenticatedFetch<{ usageCount?: number; hasOnboardingData?: boolean }>(
                "/api/ai-recommendation/usage-count",
                { method: "GET" },
                false,
            );
            const usageCount = data?.usageCount ?? 0;
            const hasOnboardingData = data?.hasOnboardingData === true;
            if (usageCount >= 1 && !hasOnboardingData) {
                setShowOnboardingSheet(true);
                return;
            }
        } catch {
            // API 실패 시 기존 대화 모달로 진행
        }

        setShowChatModal(true);
        if (messages.length === 0) {
            setMessages([{ type: "ai", text: questionFlow[0].text }]);
        }
        setTimeout(() => {
            messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
        }, 300);
    };

    // 답변 처리
    const handleAnswer = async (option: QuestionOption) => {
        if (currentQuestion.id === "payment_prompt") {
            if (option.value === "yes") {
                if (!isLoggedIn) {
                    setShowLogin(true);
                    return;
                }
                // 🟢 [단일 소스] 일일 제한은 /api/recommendations 429로만 처리 (precheck에서 이미 통과)

                setMessages((prev) => [...prev, { type: "user", text: option.text }]);

                // 🟢 즉시 추천 결과 표시 (분석 화면 최소화)
                setIsTyping(false);
                setIsGenerating(true);
                setIsAnalyzing(true);
                setShowRecommendations(true);

                const texts = [
                    t("personalizedHome.analysisScanning"),
                    t("personalizedHome.analysisExploring", { region: userAnswers["region_today"] || "" }),
                    t("personalizedHome.analysisWeather"),
                    t("personalizedHome.analysisFiltering", { companion: userAnswers["companion_today"] || "" }),
                    t("personalizedHome.analysisSimulating"),
                    t("personalizedHome.analysisFound"),
                ];

                setAnalysisText(texts[0]);
                let textIdx = 0;
                const textInterval = setInterval(() => {
                    setAnalysisText(texts[textIdx]);
                    textIdx = (textIdx + 1) % texts.length;
                }, 400); // 🟢 800ms -> 400ms로 단축하여 빠른 전환

                // 🟢 추천 생성 (비동기로 실행하되 즉시 결과 표시)
                generateRecommendations(userAnswers).then(() => {
                    clearInterval(textInterval);
                    // 🟢 추천 생성 완료 시 즉시 분석 화면 닫기
                    setIsAnalyzing(false);
                    setIsGenerating(false);
                });

                return;
            } else if (option.value === "no") {
                resetConversation();
                return;
            }
        }

        setMessages((prev) => [...prev, { type: "user", text: option.text }]);
        const newAnswers = { ...userAnswers, [currentQuestion.id]: option.value };
        // 기념일(100일/생일/연말) 선택 시 "누구랑 가요" 자동 연인
        if (currentQuestion.id === "goal_detail") {
            newAnswers["companion_today"] = "연인";
        }
        setUserAnswers(newAnswers);
        setIsTyping(true);

        setTimeout(async () => {
            setIsTyping(false);
            const progressKeys = ["goal", "companion_today", "mood_today", "region_today"];
            const answered = Object.keys(newAnswers).filter((k) => progressKeys.includes(k)).length;
            const totalSteps = 4;
            const pct = Math.min(100, Math.round((answered / totalSteps) * 100));
            setProgress(pct);

            if (option.next === "complete") return;

            const nextQuestion = questionFlow.find((q) => q.id === option.next);
            if (nextQuestion) {
                setCurrentQuestion(nextQuestion);
                setMessages((prev) => [...prev, { type: "ai", text: nextQuestion.text }]);
            }
        }, 600);
    };

    const generateRecommendations = async (answers: Record<string, string>) => {
        let hadNetworkError = false;
        const buildList = (rows: any[]): Course[] =>
            (rows || []).map((c: any) => {
                const firstPlaceImage = c.coursePlaces?.[0]?.place?.imageUrl;
                const imageUrl = c.imageUrl?.trim() || firstPlaceImage?.trim() || "";
                return {
                    id: String(c.id),
                    title: c.title,
                    description: c.description || "",
                    duration: c.duration || "",
                    location: c.location || c.region || "",
                    price: c.price || "",
                    tags: [],
                    rating: Number(c.rating) || 0,
                    reviewCount: c.reviewCount || 0,
                    participants: c.participants || 0,
                    highlights: c.highlights || [],
                    score: c.matchScore !== undefined && c.matchScore !== null ? Number(c.matchScore) : 0.5,
                    grade: c.grade === "BASIC" || c.grade === "PREMIUM" ? c.grade : "FREE",
                    imageUrl: imageUrl || undefined,
                    coursePlaces: c.coursePlaces,
                    matchScore: c.matchScore ?? null,
                    matchReason: typeof c.matchReason === "string" ? c.matchReason : undefined,
                };
            });

        const fetchCourses = async (query: Record<string, string>) => {
            try {
                const params = new URLSearchParams({ limit: "100", imagePolicy: "any", ...query }).toString();
                const res = await fetch(`/api/courses?${params}`, { cache: "no-store" });
                if (!res.ok) {
                    hadNetworkError = true;
                    return [] as Course[];
                }
                const data = await res.json().catch(() => {
                    hadNetworkError = true;
                    return [];
                });
                if (!Array.isArray(data)) return [] as Course[];
                return buildList(data);
            } catch {
                hadNetworkError = true;
                return [] as Course[];
            }
        };

        const goalValue = answers.goal || "";
        const goalDetailFromUser = answers.goal_detail || "";
        const companionToday = answers.companion_today || "";
        const moodToday = answers.mood_today || "";
        const regionToday = answers.region_today || "";

        // goal → API용 goal + goal_detail (기념일 선택 시 2차 질문에서 goal_detail 저장)
        let goal: string;
        let goalDetail: string;
        if (goalValue === "기념일") {
            goal = "ANNIVERSARY";
            goalDetail = goalDetailFromUser; // 100일, 생일, 연말
        } else {
            const GOAL_MAP: Record<string, { goal: string; goalDetail: string }> = {
                무난: { goal: "DATE", goalDetail: "" },
                감성: { goal: "DATE", goalDetail: "" },
                활동: { goal: "DATE", goalDetail: "" },
                일상: { goal: "DATE", goalDetail: "" },
                // 하위 호환
                "100일": { goal: "ANNIVERSARY", goalDetail: "100일" },
                생일: { goal: "ANNIVERSARY", goalDetail: "생일" },
                연말: { goal: "ANNIVERSARY", goalDetail: "연말" },
            };
            const mapped = GOAL_MAP[goalValue];
            goal = mapped?.goal ?? goalValue;
            goalDetail = mapped?.goalDetail ?? "";
        }

        let list: Course[] = [];

        try {
            const token = localStorage.getItem("authToken");
            const params = new URLSearchParams({
                mode: "ai",
                goal,
                goal_detail: goalDetail,
                companion_today: companionToday,
                mood_today: moodToday,
                region_today: regionToday,
                limit: "2",
                strict: "true",
            }).toString();

            // 🟢 쿠키 기반 인증: apiFetch 사용
            const { data, response: res } = await apiFetch(`/api/recommendations?${params}`, {
                cache: "no-store",
            });

            if (res.status === 429) {
                const body = (data as { tier?: string; limit?: number; used?: number }) || {};
                setLimitExceededContext({
                    tier: (body.tier as "FREE" | "BASIC" | "PREMIUM") || "FREE",
                    limit: body.limit ?? 1,
                    used: body.used ?? 1,
                });
                setShowChatModal(false);
                setShowAlreadyUsedModal(true);
                setIsAnalyzing(false);
                setIsGenerating(false);
                return;
            }

            if (res.ok && data) {
                const recommendations = (data as any)?.recommendations;
                const upsell = (data as any)?.upsellFor;
                const userTier = (data as any)?.userTier || "FREE";
                if (recommendations && Array.isArray(recommendations)) {
                    list = buildList(recommendations);
                    // 🟢 자동 저장 제거: 저장은 '코스 시작하기' 클릭 시에만 수행
                }
                setUpsellFor(upsell === "BASIC" || upsell === "PREMIUM" ? upsell : null);
                setUserTier(((data as any)?.userTier || "FREE") as "FREE" | "BASIC" | "PREMIUM");
                setHasLongTermPreferences((data as any)?.hasLongTermPreferences === true);
            } else {
                setUpsellFor(null);
            }
        } catch (error) {
            console.error("추천 API 오류:", error);
            hadNetworkError = true;
        }

        if (list.length === 0) {
            setUpsellFor(null);
            let fallbackList = await fetchCourses({
                ...(regionToday ? { region: regionToday } : {}),
            });
            list = fallbackList.slice(0, 2);
        }

        if (list.length === 0) {
            if (hadNetworkError) {
                setNetError(t("personalizedHome.netErrorFetch"));
            }
        }

        setRecommendedCourses(list);

        setMessages((prev) => [
            ...prev,
            {
                type: "ai",
                text:
                    list.length > 0
                        ? t("personalizedHome.resultMessage", { nickname })
                        : hadNetworkError
                          ? t("personalizedHome.resultNetError")
                          : t("personalizedHome.resultNoMatch"),
            },
        ]);
    };

    const handleResetAndRecommend = async () => {
        // 기존 대화 내용을 초기화하고 다시 첫 질문으로
        setMessages([{ type: "ai", text: questionFlow[0].text }]);
        setCurrentQuestion(questionFlow[0]);
        setUserAnswers({});
        setRecommendedCourses([]);
        setShowRecommendations(false);
        setProgress(0);
        setShowUpsell(false);
        setUpsellFor(null);
        setIsGenerating(false);
        setSelectedCourseId(null);
        setIsAnalyzing(false);
        setRevealedCards({});
    };

    // 🟢 [Logic]: 모든 기능을 하나로 묶은 원스톱 핸들러 (선언적 액션)
    const handleCourseCommit = async (courseId: string, courseTitle: string) => {
        // 1. 초기 상태 검증
        if (isSelecting || !courseId) return;

        // 🟢 즉시 "처리 중" 상태로 변경
        setIsSelecting(true);

        // 2. 권한 및 자산 검증
        if (!isLoggedIn) {
            setIsSelecting(false);
            setShowLogin(true);
            return;
        }

        // 🟢 열람권으로 구매한 코스인지 확인 (이미 접근 권한이 있는 코스는 열람권 사용 불필요)
        let courseDataRes: { isLocked?: boolean; grade?: string } | undefined;
        try {
            const { data } = await apiFetch<{ isLocked?: boolean; grade?: string } | null>(`/api/courses/${courseId}`);
            courseDataRes = data ?? undefined;
            // 🟢 코스가 잠금 해제되어 있으면 (열람권으로 구매했거나 무료 코스) 바로 저장하고 이동
            if (data && data.isLocked === false) {
                try {
                    const saveRes = await authenticatedFetch("/api/users/me/courses", {
                        method: "POST",
                        body: JSON.stringify({ courseId, source: "ai_recommendation" }),
                    });

                    if (saveRes !== null) {
                        setSelectedCourseId(courseId);
                        setShowConfirmModal(false);
                        router.push(`/courses/${courseId}`);
                    } else {
                        alert(t("personalizedHome.saveError"));
                    }
                } catch (error) {
                    console.error("저장 오류:", error);
                    alert(t("personalizedHome.saveError"));
                } finally {
                    setIsSelecting(false);
                }
                return;
            }
        } catch (error) {
            console.error("코스 정보 조회 오류:", error);
            // 에러 발생 시 기존 로직 계속 진행
        }

        // 🟢 코스가 잠겨있으면 결제 모달 표시 (courseGrade 전달용 pendingCourse 갱신)
        setIsSelecting(false);
        setShowConfirmModal(false);
        setPendingCourse((prev) => {
            const grade = courseDataRes?.grade || "BASIC";
            return prev ? { ...prev, grade } : { id: courseId, title: "", grade };
        });
        setShowPaywall(true);
        return;
    };

    // 1. '선택하기' 버튼 클릭 시 실행 (확인 모달만 띄움)
    const handleSelectCourse = (courseId: string, courseTitle: string) => {
        if (isSelecting || selectedCourseId) return;

        const token = localStorage.getItem("authToken");
        if (!token) {
            setShowLogin(true);
            return;
        }

        // 🟢 confirm 대신 데이터 저장 후 모달 오픈
        setPendingCourse({ id: courseId, title: courseTitle });
        setShowConfirmModal(true);
    };

    const handleFlipCard = (courseId: string) => {
        if (!revealedCards[courseId]) setRevealedCards((prev) => ({ ...prev, [courseId]: true }));
        // 카드만 뒤집고, 이동은 상세 모달에서 '이 코스로 하기' 클릭 시에만 수행
    };

    function parseMatchReasonChips(raw: string): string[] {
        const colonIdx = raw.indexOf(":");
        const value = colonIdx >= 0 ? raw.slice(colonIdx + 1).trim() : raw;
        if (!value) return [];
        return value
            .split(/\s*·\s*/)
            .map((s) => s.trim())
            .filter(Boolean);
    }

    const getMatchBadge = (matchScore: number | null | undefined, hasPrefs: boolean) => {
        if (!hasPrefs || matchScore == null)
            return { text: t("personalizedHome.matchToday"), tone: "neutral" as const };
        if (matchScore >= 0.9) return { text: t("personalizedHome.matchPerfect"), tone: "strong" as const };
        if (matchScore >= 0.75) return { text: t("personalizedHome.matchGood"), tone: "good" as const };
        if (matchScore >= 0.6) return { text: t("personalizedHome.matchOk"), tone: "soft" as const };
        return { text: t("personalizedHome.matchToday"), tone: "neutral" as const };
    };

    const tierOrder = { FREE: 0, BASIC: 1, PREMIUM: 2 };
    const FlipCard = ({ course }: { course: Course }) => {
        const isRevealed = revealedCards[course.id];
        const isSelected = selectedCourseId === course.id;
        const courseGrade = course.grade || "FREE";
        const isLocked = (tierOrder[courseGrade] ?? 0) > (tierOrder[userTier] ?? 0);

        // 🟢 [Performance]: 카드에 마우스를 올렸을 때 코스 상세 정보 prefetch
        const handleMouseEnter = async () => {
            if (!isRevealed) return; // 카드가 뒤집혀있을 때만 prefetch
            try {
                const { apiFetch } = await import("@/lib/authClient");
                await apiFetch(`/api/courses/${course.id}`, {
                    cache: "force-cache",
                    next: { revalidate: 300 },
                });
            } catch {} // 에러는 무시 (백그라운드 prefetch)
        };

        if (selectedCourseId && !isSelected) return null;

        return (
            <div
                className={`group h-[440px] w-full cursor-pointer perspective-1000 transition-all duration-500 relative ${
                    isRevealed ? "z-30" : "z-20"
                } ${isSelected ? "scale-105" : "hover:-translate-y-2"}`}
                onClick={() => !isSelected && handleFlipCard(course.id)}
                onMouseEnter={handleMouseEnter}
            >
                <div
                    className={`relative w-full h-full transition-all duration-1000 transform-style-3d ${
                        isRevealed ? "rotate-y-180" : ""
                    }`}
                >
                    {/* 🟢 [Front]: 커스텀 닉네임이 적용된 설계안 디자인 */}
                    <div className="absolute w-full h-full backface-hidden rounded-4xl shadow-2xl bg-[#1a1a1a] flex flex-col items-center justify-center border-[3px] border-emerald-500/30 overflow-hidden">
                        <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_center,var(--tw-gradient-stops))] from-emerald-500 via-transparent to-transparent"></div>
                        <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10"></div>

                        <div className="z-10 text-center px-8">
                            <div className="relative w-24 h-24 mx-auto mb-6">
                                <div className="absolute inset-0 bg-emerald-500 rounded-full blur-xl opacity-20 animate-pulse"></div>
                                <div className="relative w-full h-full bg-linear-to-br from-emerald-400 to-teal-600 rounded-full flex items-center justify-center shadow-lg">
                                    <Bot className="w-12 h-12 text-white" />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <span className="text-emerald-400 text-[10px] font-black tracking-[0.3em] uppercase">
                                    AI Analysis Result
                                </span>
                                <h3 className="text-white text-2xl font-black tracking-tight leading-tight">
                                    {/* 닉네임 반영 커스텀 문구 */}
                                    {t("personalizedHome.cardForNickname", { nickname })} <br />
                                    <span className="text-transparent bg-clip-text bg-linear-to-r from-emerald-300 to-teal-300">
                                        {t("personalizedHome.cardCustomCourse")}
                                    </span>
                                </h3>
                            </div>

                            <div className="mt-10">
                                <div className="inline-block px-4 py-2 rounded-full bg-white/5 border border-white/10 backdrop-blur-md">
                                    <p className="text-gray-400 text-xs font-medium">
                                        {t("personalizedHome.cardTouchUnlock")}
                                    </p>
                                </div>
                            </div>
                        </div>
                        <div className="absolute bottom-0 left-0 w-full h-1.5 bg-linear-to-r from-transparent via-emerald-500 to-transparent opacity-50"></div>
                    </div>

                    {/* 🟢 [Back]: 잠금 해제 = 이전 디자인 / 잠금 = /courses 스타일(이미지+오버레이) */}
                    <div
                        className={`absolute w-full h-full backface-hidden rotate-y-180 rounded-4xl bg-white dark:bg-[#1a241b] shadow-2xl overflow-hidden border border-gray-100 dark:border-gray-800 flex flex-col z-30 ${
                            isLocked ? "cursor-pointer" : ""
                        }`}
                        onClick={
                            isLocked
                                ? (e) => {
                                      e.stopPropagation();
                                      if (!isLoggedIn) {
                                          setShowLogin(true);
                                      } else {
                                          setPendingCourse({
                                              id: course.id,
                                              title: course.title,
                                              grade: courseGrade,
                                          });
                                          setShowPaywall(true);
                                      }
                                  }
                                : undefined
                        }
                    >
                        {/* 잠금 코스만: /courses 페이지처럼 이미지 + CourseLockOverlay */}
                        {isLocked && (
                            <div className="relative w-full aspect-4/3 shrink-0 overflow-hidden bg-gray-100 dark:bg-gray-800">
                                {(() => {
                                    const displayImageUrl =
                                        course.imageUrl?.trim() ||
                                        course.coursePlaces?.[0]?.place?.imageUrl?.trim() ||
                                        "";
                                    return displayImageUrl ? (
                                        <Image
                                            src={displayImageUrl}
                                            alt={course.title}
                                            fill
                                            className="object-cover blur-sm saturate-50"
                                            sizes="(max-width: 480px) 100vw, 400px"
                                        />
                                    ) : (
                                        <div className="absolute inset-0 bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                                            <span className="text-gray-400 dark:text-gray-500 text-sm font-medium">
                                                DoNa
                                            </span>
                                        </div>
                                    );
                                })()}
                                <CourseLockOverlay grade={courseGrade} nickname={nickname} />
                            </div>
                        )}
                        <div className="p-7 flex flex-col flex-1 min-h-0 overflow-hidden">
                            {isLocked ? (
                                <>
                                    <div className="flex-1 flex flex-col justify-center items-center text-center">
                                        <h3 className="text-xl font-bold text-gray-900 dark:text-white leading-tight tracking-tighter mb-4 line-clamp-2">
                                            {course.title}
                                        </h3>
                                    </div>
                                    <TapFeedback className="w-full mt-auto">
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                if (!isLoggedIn) {
                                                    setShowLogin(true);
                                                } else {
                                                    setPendingCourse({
                                                        id: course.id,
                                                        title: course.title,
                                                        grade: courseGrade,
                                                    });
                                                    setShowPaywall(true);
                                                }
                                            }}
                                            className="w-full py-4 bg-emerald-600 dark:bg-emerald-700 text-white rounded-2xl font-bold text-sm hover:bg-emerald-700 dark:hover:bg-emerald-600 transition-all"
                                        >
                                            {courseGrade === "BASIC"
                                                ? t("personalizedHome.lockedBasic")
                                                : t("personalizedHome.lockedPremium")}
                                        </button>
                                    </TapFeedback>
                                </>
                            ) : (
                                <>
                                    {(() => {
                                        const badge = getMatchBadge(course.matchScore ?? null, hasLongTermPreferences);
                                        return (
                                            <div className="flex justify-between items-start mb-4">
                                                <span
                                                    className={[
                                                        "inline-flex items-center px-2.5 py-1 text-[11px] font-black rounded-lg border",
                                                        badge.tone === "strong" &&
                                                            "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-700/50",
                                                        badge.tone === "good" &&
                                                            "bg-emerald-50/70 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 border-emerald-200/60 dark:border-emerald-700/40",
                                                        (badge.tone === "soft" || badge.tone === "neutral") &&
                                                            "bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700",
                                                    ]
                                                        .filter(Boolean)
                                                        .join(" ")}
                                                >
                                                    {badge.text}
                                                </span>
                                                <Sparkles className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
                                            </div>
                                        );
                                    })()}
                                    <h3 className="text-2xl font-bold mb-3 text-gray-900 dark:text-white leading-tight tracking-tighter">
                                        {course.title}
                                    </h3>
                                    <p className="text-gray-500 dark:text-gray-400 text-[14px] leading-relaxed mb-3 line-clamp-2">
                                        {course.description}
                                    </p>
                                    {course.matchReason &&
                                        (() => {
                                            const chips = parseMatchReasonChips(course.matchReason);
                                            if (chips.length === 0) return null;
                                            return (
                                                <div className="flex flex-wrap gap-1.5 mb-4">
                                                    {chips.map((chip, i) => (
                                                        <span
                                                            key={i}
                                                            className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-700/50"
                                                        >
                                                            {chip}
                                                        </span>
                                                    ))}
                                                </div>
                                            );
                                        })()}
                                    <div className="grid grid-cols-2 gap-3 mb-8">
                                        <div className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-gray-800 rounded-2xl">
                                            <MapPin className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
                                            <span className="text-xs font-bold text-gray-700 dark:text-gray-300 truncate">
                                                {course.location}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-gray-800 rounded-2xl">
                                            <Clock className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
                                            <span className="text-xs font-bold text-gray-700 dark:text-gray-300">
                                                {course.duration
                                                    ? course.duration
                                                    : t("personalizedHome.defaultDuration")}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="mt-auto flex gap-2.5">
                                        <TapFeedback className="flex-1 min-w-0">
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setDetailModalCourse(course);
                                                }}
                                                className="w-full py-4 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded-2xl font-bold text-sm hover:bg-gray-200 dark:hover:bg-gray-700 transition-all"
                                            >
                                                {t("personalizedHome.viewDetail")}
                                            </button>
                                        </TapFeedback>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    const searchParams = useSearchParams();

    // 🟢 결제 성공 후 URL 파라미터 확인하여 데이터 강제 갱신
    useEffect(() => {
        const paymentSuccess = searchParams.get("paymentSuccess");
        if (paymentSuccess === "true") {
            console.log("[결제 성공 감지] 데이터 갱신 및 캐시 무효화 시작");

            // 1. 서버 데이터 강제 호출 (캐시 무시) - 비동기 처리
            fetchUserData(true).then(() => {
                // 2. Next.js 라우터 캐시 강제 새로고침 (클라이언트 캐시 무효화 필수)
                // 🔴 이 부분이 빠지면 이전 페이지 데이터가 보일 수 있습니다.
                router.refresh();
            });

            // 3. URL 파라미터 제거 (깔끔한 URL 유지)
            router.replace(pathname);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchParams]);

    useEffect(() => {
        try {
            router.prefetch && router.prefetch("/login");
        } catch {}
    }, [router]);

    useEffect(() => {
        const inProgress = sessionStorage.getItem("auth:loggingIn") === "1";
        const token = typeof window !== "undefined" ? localStorage.getItem("authToken") : null;
        if (inProgress && !token) setAuthLoading(true);

        let intervalId: any;
        if (inProgress) {
            intervalId = setInterval(() => {
                const t = localStorage.getItem("authToken");
                if (t) {
                    setAuthLoading(false);
                    sessionStorage.removeItem("auth:loggingIn");
                    clearInterval(intervalId);
                }
            }, 500);
            setTimeout(() => {
                if (intervalId) clearInterval(intervalId);
            }, 120000);
        }

        return () => {
            if (intervalId) clearInterval(intervalId);
        };
    }, []);

    return (
        <div
            className={`min-h-screen bg-linear-to-b from-emerald-50/20 to-white dark:from-gray-900 dark:to-[#0f1710] font-sans ${!showChatModal ? "overflow-hidden h-screen" : ""}`}
        >
            <style>{gameStyles}</style>
            <div className="flex flex-col items-center justify-center p-4 ">
                {showLogin && (
                    <LoginModal onClose={() => setShowLogin(false)} next="/personalized-home" preset="recommendation" />
                )}
                {showOnboardingSheet && (
                    <OnboardingBottomSheet
                        isOpen={showOnboardingSheet}
                        onClose={() => setShowOnboardingSheet(false)}
                        onboardingUrl="/onboarding?returnTo=/personalized-home"
                    />
                )}
                {/* 🟢 오늘의 데이트 추천 일일 사용 완료 모달 */}
                {showAlreadyUsedModal && (
                    <div className="fixed inset-0 z-100 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-200">
                        <div className="bg-white dark:bg-[#1a241b] rounded-4xl w-full max-w-sm overflow-hidden shadow-2xl border border-white/20 dark:border-gray-800/50 animate-in zoom-in-95 duration-300">
                            <div className="p-8 text-center">
                                <div className="w-16 h-16 bg-amber-50 dark:bg-amber-900/30 rounded-2xl flex items-center justify-center mx-auto mb-5">
                                    <CheckCircle className="w-8 h-8 text-amber-600 dark:text-amber-400" />
                                </div>
                                <h3 className="text-xl font-extrabold text-gray-900 dark:text-white mb-2">
                                    {limitExceededContext?.tier === "BASIC"
                                        ? t("personalizedHome.alreadyUsedBasic")
                                        : t("personalizedHome.alreadyUsedFree")}
                                </h3>
                                <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed px-2">
                                    {limitExceededContext?.tier === "BASIC"
                                        ? t("personalizedHome.basicLimit")
                                        : t("personalizedHome.freeLimit")}
                                    <br />
                                    {limitExceededContext?.tier === "BASIC"
                                        ? t("personalizedHome.basicUpgradeHint")
                                        : t("personalizedHome.freeUpgradeHint")}
                                </p>
                            </div>
                            <div className="border-t border-gray-100 dark:border-gray-800 p-4 flex flex-col gap-2">
                                <button
                                    onClick={() => {
                                        setShowAlreadyUsedModal(false);
                                        setLimitExceededContext(null);
                                        setShowUpgradeModal(true);
                                    }}
                                    className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-bold transition-all"
                                >
                                    {limitExceededContext?.tier === "BASIC"
                                        ? t("personalizedHome.upgradeToPremium")
                                        : t("personalizedHome.upgradeToBasic")}
                                </button>
                                <button
                                    onClick={() => {
                                        setShowAlreadyUsedModal(false);
                                        setLimitExceededContext(null);
                                    }}
                                    className="w-full py-3 text-gray-600 dark:text-gray-400 font-medium rounded-2xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                                >
                                    {t("common.confirm")}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
                {/* 🟢 [IN-APP PURCHASE]: 구독 업그레이드 모달 (한도 초과 시) */}
                {showUpgradeModal && <TicketPlans onClose={() => setShowUpgradeModal(false)} />}
                {/* 🟢 [IN-APP PURCHASE]: 코스 결제 모달 */}
                {showPaywall && pendingCourse && (
                    <TicketPlans
                        courseId={Number(pendingCourse.id)}
                        courseGrade={(pendingCourse.grade || "BASIC").toUpperCase() === "PREMIUM" ? "PREMIUM" : "BASIC"}
                        onClose={() => setShowPaywall(false)}
                    />
                )}

                {/* 🟢 1단계: 선택 확인 모달 */}
                {showConfirmModal && pendingCourse && (
                    <div className="fixed inset-0 z-100 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-200">
                        <div className="bg-white dark:bg-[#1a241b] rounded-4xl w-full max-w-sm overflow-hidden shadow-2xl border border-white/20 dark:border-gray-800/50 animate-in zoom-in-95 duration-300">
                            <div className="p-8 text-center">
                                <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto mb-5">
                                    <Navigation className="w-8 h-8 text-emerald-600" />
                                </div>
                                <h3 className="text-xl font-extrabold text-gray-900 dark:text-white mb-2">
                                    이 코스로 결정할까요?
                                </h3>
                                <p className="text-gray-500 text-sm leading-relaxed px-2">
                                    <span className="text-emerald-600 font-bold">"{pendingCourse.title}"</span>
                                    <br />
                                    선택하신 코스는 마이페이지에 보관됩니다.
                                </p>
                            </div>
                            <div className="flex border-t border-gray-100">
                                <button
                                    onClick={() => {
                                        setShowConfirmModal(false);
                                        setPendingCourse(null);
                                    }}
                                    disabled={isSelecting}
                                    className="flex-1 py-5 text-gray-400 font-bold hover:bg-gray-50 transition-colors disabled:opacity-50"
                                >
                                    {t("common.cancel")}
                                </button>
                                <button
                                    onClick={() => {
                                        if (pendingCourse) {
                                            handleCourseCommit(pendingCourse.id, pendingCourse.title);
                                        }
                                    }}
                                    disabled={isSelecting || !pendingCourse}
                                    className="flex-1 py-5 bg-emerald-600 text-white font-bold hover:bg-emerald-700 transition-colors active:brightness-90 disabled:opacity-50"
                                >
                                    {isSelecting ? t("personalizedHome.saving") : t("personalizedHome.saveBtn")}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* 🟢 2단계: 성공 알림 모달 */}
                {showSuccessModal && pendingCourse && (
                    <div className="fixed inset-0 z-101 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl animate-in fade-in duration-300">
                        <div className="bg-white dark:bg-[#1a241b] rounded-[2.5rem] w-full max-w-sm p-8 shadow-2xl border border-white/20 dark:border-gray-800/50 text-center animate-in slide-in-from-bottom-8 duration-500">
                            <div className="w-20 h-20 bg-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg shadow-emerald-200">
                                <CheckCircle className="w-10 h-10 text-white" />
                            </div>
                            <h3 className="text-2xl font-black text-gray-900 dark:text-white mb-3">
                                {t("personalizedHome.successTitle")}
                            </h3>
                            <p className="text-gray-500 text-[15px] mb-8 leading-relaxed">
                                {t("personalizedHome.successSaved")}
                                <br />
                                {t("personalizedHome.successViewDetail")}
                            </p>
                            <div className="space-y-3">
                                <button
                                    onClick={() => {
                                        setShowSuccessModal(false);
                                        setPendingCourse(null);
                                        router.push(`/courses/${pendingCourse.id}`);
                                    }}
                                    className="w-full py-4 bg-gray-900 text-white rounded-2xl font-bold text-lg hover:bg-black transition-all active:scale-95 shadow-xl"
                                >
                                    {t("personalizedHome.viewCourseDetail")}
                                </button>
                                <button
                                    onClick={() => {
                                        setShowSuccessModal(false);
                                        setPendingCourse(null);
                                    }}
                                    className="w-full py-3 text-gray-400 font-bold text-sm hover:text-gray-600 transition-colors"
                                >
                                    {t("common.close")}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* 🟢 카드 {t("personalizedHome.viewDetail")} 모달: 아래에서 올라오는 바텀시트, 하단·좌우 고정 */}
                {detailModalCourse && (
                    <div className="fixed inset-0 z-99 flex items-end justify-center bg-black/70 backdrop-blur-md animate-in fade-in duration-200">
                        <div className="bg-white dark:bg-[#1a241b] rounded-t-3xl w-full max-h-[90vh] overflow-hidden shadow-2xl border border-white/20 dark:border-gray-800/50 animate-in slide-in-from-bottom duration-300 flex flex-col">
                            <div className="p-6 overflow-y-auto scrollbar-hide flex-1 min-h-0">
                                {/* 헤더: 제목 + X */}
                                <div className="flex items-start justify-between gap-3 mb-2">
                                    <h3 className="text-lg font-bold text-gray-900 dark:text-white flex-1 line-clamp-2 pt-0.5">
                                        {detailModalCourse.title}
                                    </h3>
                                    <button
                                        onClick={() => setDetailModalCourse(null)}
                                        className="p-2 -m-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-full transition-colors shrink-0"
                                        aria-label={t("personalizedHome.closeAria")}
                                    >
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>
                                {/* 매칭 근거 칩 + 부제목 */}
                                {detailModalCourse.matchReason &&
                                    (() => {
                                        const chips = parseMatchReasonChips(detailModalCourse.matchReason);
                                        if (chips.length === 0) return null;
                                        return (
                                            <div className="flex flex-wrap gap-1.5 mb-3">
                                                {chips.map((chip, i) => (
                                                    <span
                                                        key={i}
                                                        className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-700/50"
                                                    >
                                                        {chip}
                                                    </span>
                                                ))}
                                            </div>
                                        );
                                    })()}
                                <p className="text-gray-500 dark:text-gray-400 text-sm flex items-center gap-1.5 mb-4">
                                    <Leaf className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                                    {detailModalCourse.description
                                        ? detailModalCourse.description.split(/[.\n]/)[0]?.trim() ||
                                          t("personalizedHome.defaultDesc")
                                        : t("personalizedHome.defaultDesc")}
                                </p>
                                {/* 요약 바: 위치 > 소요시간 > 도보 중심 (회색 둥근 바) */}
                                <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-gray-100 dark:bg-gray-800/80 border border-gray-100 dark:border-gray-700 mb-5">
                                    <MapPin className="w-4 h-4 text-emerald-500 shrink-0" />
                                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate min-w-0">
                                        {detailModalCourse.location || "-"}
                                    </span>
                                    <ChevronRight className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                                    <Clock className="w-4 h-4 text-emerald-500 shrink-0" />
                                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">
                                        {detailModalCourse.duration
                                            ? detailModalCourse.duration
                                            : t("personalizedHome.defaultDuration")}
                                    </span>
                                    <ChevronRight className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                                    <Footprints className="w-4 h-4 text-emerald-500 shrink-0" />
                                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">
                                        {t("personalizedHome.walkingCentered")}
                                    </span>
                                </div>
                                {/* 스팟 카드 리스트: 번호 + 이름/설명 + 오른쪽 썸네일 */}
                                {detailModalCourse.coursePlaces && detailModalCourse.coursePlaces.length > 0 && (
                                    <div className="space-y-2 mb-5 max-h-64 overflow-y-auto scrollbar-hide">
                                        {[...detailModalCourse.coursePlaces]
                                            .sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0))
                                            .map((cp, idx) => (
                                                <div
                                                    key={cp.place?.id ?? idx}
                                                    className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-800/80 border border-gray-100 dark:border-gray-700"
                                                >
                                                    <span className="w-7 h-7 rounded-full bg-emerald-500 border-2 border-white dark:border-gray-800 text-white text-xs font-bold flex items-center justify-center shrink-0 shadow-sm">
                                                        {idx + 1}
                                                    </span>
                                                    <div className="min-w-0 flex-1">
                                                        <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                                                            {cp.place?.name || t("personalizedHome.placeFallback")}
                                                        </p>
                                                        <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-1">
                                                            {cp.place?.category
                                                                ? `${cp.place.category} · ${t("personalizedHome.spotNth", { n: String(idx + 1) })}`
                                                                : t("personalizedHome.spotNth", { n: String(idx + 1) })}
                                                        </p>
                                                    </div>
                                                    {cp.place?.imageUrl ? (
                                                        <div className="relative w-14 h-14 rounded-lg overflow-hidden shrink-0 bg-gray-200 dark:bg-gray-700">
                                                            <Image
                                                                src={cp.place.imageUrl}
                                                                alt=""
                                                                fill
                                                                className="object-cover"
                                                                sizes="56px"
                                                            />
                                                        </div>
                                                    ) : (
                                                        <div className="w-14 h-14 rounded-lg bg-gray-200 dark:bg-gray-700 shrink-0" />
                                                    )}
                                                </div>
                                            ))}
                                    </div>
                                )}
                            </div>
                            {/* 하단 CTA: 코스 시작하기 → (잠금이면 paywall, 아니면 저장 → 피드백 모달) */}
                            <div className="p-4 pt-0 shrink-0">
                                <TapFeedback className="block">
                                    <button
                                        onClick={async () => {
                                            const id = detailModalCourse.id;
                                            const courseGrade = (detailModalCourse.grade || "FREE").toUpperCase();
                                            const currentTier = (userTier || "FREE").toUpperCase();
                                            const isLocked =
                                                (tierOrder[courseGrade as keyof typeof tierOrder] ?? 0) >
                                                (tierOrder[currentTier as keyof typeof tierOrder] ?? 0);

                                            if (isLocked) {
                                                setDetailModalCourse(null);
                                                setPendingCourse({
                                                    id,
                                                    title: detailModalCourse.title,
                                                    grade: courseGrade,
                                                });
                                                setShowPaywall(true);
                                                return;
                                            }

                                            // 잠금 해제: 저장 후 피드백 모달
                                            try {
                                                await authenticatedFetch("/api/users/me/courses", {
                                                    method: "POST",
                                                    body: JSON.stringify({
                                                        courseId: id,
                                                        source: "ai_recommendation",
                                                    }),
                                                });
                                            } catch {
                                                // 저장 실패해도 피드백 모달은 표시
                                            }
                                            setDetailModalCourse(null);
                                            setFeedbackTarget({
                                                courseId: id,
                                                matchScore: detailModalCourse.matchScore ?? undefined,
                                                matchReason: detailModalCourse.matchReason,
                                                todayContext: userAnswers,
                                            });
                                            setShowFeedbackModal(true);
                                        }}
                                        className="w-full py-3.5 rounded-2xl bg-linear-to-b from-emerald-600 to-emerald-400 hover:from-emerald-700 hover:to-emerald-500 text-white font-bold text-sm transition-all active:scale-[0.98] flex items-center justify-center gap-2 shadow-md"
                                    >
                                        {t("personalizedHome.courseStart")}
                                        <ChevronRight className="w-5 h-5 text-white/90" />
                                    </button>
                                </TapFeedback>
                            </div>
                        </div>
                    </div>
                )}

                {/* 🟢 피드백 모달: 이 추천 어땠나요? */}
                {showFeedbackModal && feedbackTarget && (
                    <div className="fixed inset-0 z-100 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-200">
                        <div className="bg-white dark:bg-[#1a241b] rounded-4xl w-full max-w-sm overflow-hidden shadow-2xl border border-white/20 dark:border-gray-800/50 animate-in zoom-in-95 duration-300">
                            <div className="p-8 text-center">
                                <h3 className="text-xl font-extrabold text-gray-900 dark:text-white mb-6">
                                    {t("personalizedHome.feedbackTitle")}
                                </h3>
                                <div className="flex flex-col gap-3">
                                    {[
                                        { label: t("personalizedHome.feedbackGood"), value: "GOOD", emoji: "👍" },
                                        { label: t("personalizedHome.feedbackOk"), value: "OK", emoji: "😐" },
                                        { label: t("personalizedHome.feedbackBad"), value: "BAD", emoji: "👎" },
                                    ].map((opt) => (
                                        <TapFeedback key={opt.value} className="block">
                                            <button
                                                onClick={() => {
                                                    const courseId = feedbackTarget.courseId;
                                                    setShowFeedbackModal(false);
                                                    setFeedbackTarget(null);
                                                    router.push(`/courses/${courseId}`);

                                                    fetch("/api/feedback", {
                                                        method: "POST",
                                                        headers: { "Content-Type": "application/json" },
                                                        credentials: "include",
                                                        body: JSON.stringify({
                                                            courseId,
                                                            rating: opt.value,
                                                            context: "AI_RECOMMENDATION",
                                                            matchScore: feedbackTarget.matchScore,
                                                            matchReason: feedbackTarget.matchReason,
                                                            todayContext: feedbackTarget.todayContext,
                                                        }),
                                                        keepalive: true,
                                                    }).catch(() => {});
                                                }}
                                                className="w-full py-3.5 rounded-2xl bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 font-bold text-sm hover:bg-gray-200 dark:hover:bg-gray-700 transition-all flex items-center justify-center gap-2"
                                            >
                                                <span>{opt.emoji}</span>
                                                {opt.label}
                                            </button>
                                        </TapFeedback>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* 👇 [추가됨] 대화창 모달 */}
                {showChatModal && (
                    <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
                        {/* 모달 컨테이너 */}
                        <div className="bg-white/95 dark:bg-[#1a241b]/95 backdrop-blur-md w-full h-full md:h-[85vh] md:w-[600px] md:rounded-[2.5rem] shadow-2xl relative flex flex-col overflow-hidden">
                            {/* 헤더 */}
                            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800 bg-white/80 dark:bg-[#1a241b]/80">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
                                        <Bot className="w-6 h-6 text-emerald-600" />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-gray-900 dark:text-white">
                                            {t("personalizedHome.aiDoNa")}
                                        </h3>
                                        <p className="text-xs text-emerald-600 font-medium flex items-center">
                                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5 animate-pulse"></span>
                                            {t("personalizedHome.analyzingLive")}
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => resetConversation()}
                                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
                                >
                                    <X className="w-6 h-6 text-gray-500 dark:text-gray-400" />
                                </button>
                            </div>

                            {/* 프로그레스 바 */}
                            {!showRecommendations && (
                                <div className="h-1 bg-gray-100 dark:bg-gray-800 w-full">
                                    <div
                                        className="h-full bg-linear-to-r from-emerald-400 to-teal-500 transition-all duration-500"
                                        style={{ width: `${progress}%` }}
                                    />
                                </div>
                            )}

                            {/* 채팅 영역 (스크롤 가능) */}
                            <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 bg-gray-50/50 dark:bg-gray-900/50 relative z-20 scrollbar-hide">
                                {messages.map((message, index) => (
                                    <div
                                        key={index}
                                        className={`flex items-end gap-3 ${
                                            message.type === "user" ? "justify-end" : "justify-start"
                                        }`}
                                    >
                                        {message.type === "ai" && (
                                            <div className="w-8 h-8 rounded-full overflow-hidden shrink-0 border border-gray-100 dark:border-gray-700 bg-white dark:bg-[#1a241b] p-0.5">
                                                <img
                                                    src={getS3StaticUrl("logo/donalogo_512.png")}
                                                    alt="DoNa"
                                                    className="w-full h-full object-cover rounded-full"
                                                />
                                            </div>
                                        )}
                                        <div
                                            className={`max-w-[80%] px-5 py-3.5 rounded-2xl shadow-sm text-[15px] leading-relaxed ${
                                                message.type === "user"
                                                    ? "bg-linear-to-br from-gray-900 to-gray-800 text-white rounded-br-sm"
                                                    : "bg-white dark:bg-[#1a241b] border border-gray-100 dark:border-gray-800 text-gray-800 dark:text-gray-200 rounded-bl-sm"
                                            }`}
                                        >
                                            {message.text.split("\n").map((line, i) => (
                                                <span key={i}>
                                                    {line}
                                                    <br />
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                ))}

                                {isTyping && (
                                    <div className="flex items-center gap-2 text-gray-400 dark:text-gray-500 text-sm ml-12 animate-pulse">
                                        <span className="w-1.5 h-1.5 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce"></span>
                                        <span className="w-1.5 h-1.5 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce delay-100"></span>
                                        <span className="w-1.5 h-1.5 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce delay-200"></span>
                                    </div>
                                )}
                                <div ref={messagesEndRef} />

                                {/* 결과 표시 영역 (채팅창 내부) */}
                                {showRecommendations && !isAnalyzing && (
                                    <div
                                        ref={recommendationResultsRef}
                                        className="mt-6 animate-in fade-in slide-in-from-bottom-4 duration-500 relative z-20"
                                    >
                                        <div className="flex items-center justify-between mb-4 px-1">
                                            <div>
                                                <h3 className="text-lg font-extrabold text-gray-900 dark:text-white tracking-tight">
                                                    {t("personalizedHome.resultTitle")}
                                                </h3>
                                                <p className="text-sm font-medium text-gray-600 dark:text-gray-300 mt-1">
                                                    {hasLongTermPreferences
                                                        ? t("personalizedHome.resultByTaste")
                                                        : t("personalizedHome.resultByToday")}
                                                </p>
                                            </div>
                                        </div>

                                        {recommendedCourses.length > 0 ? (
                                            <>
                                                <div className="grid gap-4 relative z-20">
                                                    {recommendedCourses.map((course) => (
                                                        <FlipCard key={course.id} course={course} />
                                                    ))}
                                                </div>
                                                <div className="h-20" />
                                            </>
                                        ) : (
                                            <div className="py-10 text-center text-gray-500 dark:text-gray-400 bg-white dark:bg-[#1a241b] rounded-2xl border border-gray-100 dark:border-gray-800">
                                                <p className="mb-4">{t("personalizedHome.noCourses")}</p>
                                                <button
                                                    onClick={handleResetAndRecommend}
                                                    className="px-5 py-2.5 bg-gray-900 text-white rounded-xl text-sm font-bold"
                                                >
                                                    {t("personalizedHome.retryBtn")}
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* 답변 선택 영역 (하단 고정) */}
                            {!isTyping && !showRecommendations && currentQuestion.options && (
                                <div className="p-4 md:p-6 bg-white dark:bg-[#1a241b] border-t border-gray-100 dark:border-gray-800">
                                    <div className="flex flex-wrap gap-2.5 justify-center">
                                        {currentQuestion.options.map((option, index) => (
                                            <button
                                                key={index}
                                                onClick={() => handleAnswer(option)}
                                                className={`px-5 py-3 rounded-xl font-bold text-sm transition-all active:scale-95 shadow-sm border ${
                                                    option.value === "yes"
                                                        ? "bg-linear-to-r from-emerald-600 to-teal-600 text-white border-transparent shadow-emerald-200 hover:shadow-md"
                                                        : "bg-white dark:bg-[#1a241b] border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-600"
                                                }`}
                                            >
                                                {option.text}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* 분석 로딩 화면 (모달 내부 오버레이) */}
                            {isAnalyzing && (
                                <div className="absolute inset-0 z-50 bg-gray-900/95 backdrop-blur-sm flex flex-col items-center justify-center text-white">
                                    <div className="relative w-32 h-32 mb-6">
                                        <div className="absolute inset-0 border-2 border-emerald-500/30 rounded-full animate-[spin_3s_linear_infinite]"></div>
                                        <div className="absolute inset-2 border-2 border-emerald-400/50 rounded-full animate-[spin_2s_linear_infinite_reverse]"></div>
                                        <div className="absolute inset-0 flex items-center justify-center">
                                            <Zap className="w-10 h-10 text-emerald-400 animate-pulse" />
                                        </div>
                                    </div>
                                    <h3 className="text-xl font-bold mb-2 animate-pulse">{analysisText}</h3>
                                    <div className="w-40 h-1 bg-gray-700 rounded-full overflow-hidden mt-4">
                                        <div
                                            className="h-full bg-emerald-500 animate-[width_1.5s_ease-in-out_infinite]"
                                            style={{ width: "100%" }}
                                        ></div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                <div className="w-full max-w-4xl flex flex-col mb-4">
                    <div className="bg-white/80 dark:bg-[#1a241b] backdrop-blur-md rounded-2xl p-4 shadow-lg border border-white/50 dark:border-gray-800/50 dark:shadow-gray-900/20">
                        <div className="flex justify-between items-center">
                            <div>
                                <p className="text-gray-500 dark:text-gray-300 text-xs mb-0.5 font-medium">
                                    {t("personalizedHome.whatKindOfDay")}
                                </p>
                                <h2 className="text-lg font-bold text-gray-900 dark:text-white leading-tight">
                                    {isUserDataLoading ? (
                                        <>
                                            <span className="inline-block w-32 h-7 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></span>
                                            <br />
                                            <span className="inline-block w-24 h-7 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mt-1"></span>
                                        </>
                                    ) : isLoggedIn ? (
                                        <>
                                            <span className="dark:text-white">{t("personalizedHome.helloUser")}</span>{" "}
                                            <br />
                                            <span className="text-emerald-600 dark:text-emerald-400">
                                                {nickname || t("personalizedHome.userFallback")}님
                                            </span>{" "}
                                            👋
                                        </>
                                    ) : (
                                        <>
                                            <span className="dark:text-white">
                                                {t("personalizedHome.loginRequired")}
                                            </span>{" "}
                                            <br />
                                            <span className="text-emerald-600 dark:text-emerald-400">
                                                {t("personalizedHome.loginRequiredHighlight")}
                                            </span>{" "}
                                            👋
                                        </>
                                    )}
                                </h2>
                            </div>
                            <div className="shrink-0">
                                <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 overflow-hidden relative">
                                    {isUserDataLoading ? (
                                        <div className="w-full h-full bg-gray-200 dark:bg-gray-700 animate-pulse"></div>
                                    ) : (
                                        <img
                                            src={profileImageUrl || getS3StaticUrl("profileLogo.png")}
                                            alt={t("personalizedHome.profileAlt")}
                                            className="w-full h-full object-cover"
                                        />
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-2 mt-2 min-h-[28px]">
                            {isUserDataLoading ? (
                                <div className="inline-flex items-center gap-1.5 bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-100">
                                    <div className="w-3.5 h-3.5 bg-gray-200 rounded animate-pulse"></div>
                                    <div className="w-16 h-3.5 bg-gray-200 rounded animate-pulse"></div>
                                </div>
                            ) : isLoggedIn ? null : (
                                <TapFeedback>
                                    <button
                                        onClick={() => setShowLogin(true)}
                                        className="inline-flex items-center gap-1.5 bg-emerald-50 dark:bg-emerald-900/30 px-3 py-1.5 rounded-lg border border-emerald-100 dark:border-emerald-800/50 text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition-colors"
                                    >
                                        <span>{t("personalizedHome.loginBenefit")}</span>
                                    </button>
                                </TapFeedback>
                            )}
                        </div>
                    </div>
                </div>

                <div className="w-full max-w-4xl flex flex-col relative min-h-[600px]">
                    <main className="flex-1 overflow-y-auto rounded-3xl relative scrollbar-hide">
                        {/* 👇 [수정됨] 시작 화면 UI: 고급스러운 AI 컨시어지 스타일 */}
                        <div className="h-full flex flex-col items-center justify-center text-center p-6 bg-white/80 dark:bg-[#1a241b] backdrop-blur-xl rounded-3xl border border-white/60 dark:border-gray-800/50 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-gray-900/30 min-h-[320px]">
                            {/* 1. 아이콘 영역 */}
                            <div className="relative mb-5 group">
                                <div className="absolute inset-0 bg-emerald-200 rounded-[3px] blur-2xl opacity-30 group-hover:opacity-50 transition-opacity duration-700"></div>

                                <div className="relative w-20 h-20 bg-linear-to-br from-white to-emerald-50 rounded-[1.75rem] border border-white/80 shadow-2xl flex items-center justify-center transform transition-transform duration-500 hover:scale-105">
                                    <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        width="48"
                                        height="48"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        className="w-10 h-10 text-emerald-600 drop-shadow-sm"
                                    >
                                        <path d="M12 6V2H8" />
                                        <path d="M15 11v2" />
                                        <path d="M2 12h2" />
                                        <path d="M20 12h2" />
                                        <path d="M20 16a2 2 0 0 1-2 2H8.828a2 2 0 0 0-1.414.586l-2.202 2.202A.71.71 0 0 1 4 20.286V8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2z" />
                                        <path d="M9 11v2" />
                                    </svg>

                                    <span className="absolute top-4 right-4 flex h-2.5 w-2.5">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                                    </span>
                                </div>
                            </div>

                            {/* 2. 타이포그래피 */}
                            <h2 className="text-[22px] font-extrabold text-gray-900 dark:text-white mb-2 tracking-tight leading-snug">
                                <span className="text-transparent bg-clip-text bg-linear-to-r from-emerald-600 to-teal-600 dark:from-emerald-400 dark:to-teal-400">
                                    {t("personalizedHome.heroTitle")}
                                </span>
                            </h2>
                            <p className="text-gray-500 dark:text-gray-300 text-[14px] leading-relaxed mb-6 max-w-[260px] mx-auto">
                                {t("personalizedHome.heroSubtitle")}
                            </p>

                            {/* 3. 버튼 */}
                            <TapFeedback className="block w-full max-w-[280px] mx-auto">
                                <button
                                    onClick={startConversation}
                                    className="group relative px-6 py-3 w-full bg-gray-900 text-white rounded-xl font-bold text-[15px] shadow-lg shadow-emerald-900/20 transition-all hover:-translate-y-1 hover:shadow-2xl overflow-hidden"
                                >
                                    <div className="absolute inset-0 bg-linear-to-r from-emerald-500 via-teal-500 to-emerald-600 opacity-100 bg-size-[200%_auto] animate-[gradient_3s_ease_infinite]"></div>

                                    <div className="relative flex items-center justify-center gap-2">
                                        <span>{t("personalizedHome.heroCta")}</span>
                                        <ChevronRight className="w-5 h-5 text-white/90 group-hover:translate-x-1 transition-transform" />
                                    </div>
                                </button>
                            </TapFeedback>

                            <div className="mt-4 flex items-center gap-1.5 opacity-60">
                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                                <p className="text-[11px] text-gray-400 dark:text-gray-500 font-medium tracking-wide uppercase">
                                    {t("personalizedHome.heroHint")}
                                </p>
                            </div>
                        </div>
                    </main>
                </div>
            </div>
            <div className="md:hidden h-20"></div>
        </div>
    );
};

export default AIRecommender;
