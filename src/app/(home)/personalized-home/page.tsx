"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "@/components/ImageFallback";
import { apiFetch, authenticatedFetch } from "@/lib/authClient"; // 🟢 쿠키 기반 API 호출
import { getS3StaticUrl } from "@/lib/s3Static";
import TicketPlans from "@/components/TicketPlans";
import LoginModal from "@/components/LoginModal";
import { LOGIN_MODAL_PRESETS } from "@/constants/loginModalPresets";
import OnboardingBottomSheet from "@/components/OnboardingBottomSheet";
import CourseLockOverlay from "@/components/CourseLockOverlay";
import TapFeedback from "@/components/TapFeedback";
import { isIOS, isAndroid } from "@/lib/platform";
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
    coursePlaces?: { place?: { imageUrl?: string } }[];
    matchReason?: string;
}

// 질문 시나리오
const questionFlow: Question[] = [
    {
        id: "greeting",
        type: "ai",
        text: "안녕하세요! 🌟 오늘 당신에게 딱 맞는 코스를 찾기 위해 간단한 질문 몇 개만 답해주세요.",
        options: [
            { text: "네, 시작할게요! ", value: "start", next: "goal" },
            { text: "어떤 질문들인지 궁금해요", value: "preview", next: "preview" },
        ],
    },
    {
        id: "preview",
        type: "ai",
        text: "총 4개의 간단한 질문을 드려요! 오늘 데이트 모드, 함께하는 사람, 분위기, 지역을 물어볼 예정이에요 😊",
        options: [{ text: "좋아요, 시작할게요!", value: "start", next: "goal" }],
    },
    {
        id: "goal",
        type: "ai",
        text: "Q1. 오늘 데이트는? 🎯",
        options: [
            { text: "기념일이에요 🙂", value: "기념일", next: "goal_detail" },
            { text: "무난한 날이에요", value: "무난", next: "companion_today" },
            { text: "감성적인 날이에요", value: "감성", next: "companion_today" },
            { text: "활동적인 날이에요", value: "활동", next: "companion_today" },
        ],
    },
    {
        id: "goal_detail",
        type: "ai",
        text: "어떤 기념일이에요? 💝",
        options: [
            { text: "100일", value: "100일", next: "companion_today" },
            { text: "생일", value: "생일", next: "companion_today" },
            { text: "연말", value: "연말", next: "companion_today" },
        ],
    },
    {
        id: "companion_today",
        type: "ai",
        text: "Q2. 누구랑 가요? 👥",
        options: [
            { text: "연인", value: "연인", next: "mood_today" },
            { text: "썸", value: "썸 상대", next: "mood_today" },
            { text: "소개팅", value: "소개팅 상대", next: "mood_today" },
            { text: "친구", value: "친구", next: "mood_today" },
            { text: "혼자", value: "혼자", next: "mood_today" },
        ],
    },
    {
        id: "mood_today",
        type: "ai",
        text: "Q3. 분위기는? ✨",
        options: [
            { text: "조용", value: "조용한", next: "region_today" },
            { text: "감성", value: "감성 가득한", next: "region_today" },
            { text: "트렌디", value: "트렌디한", next: "region_today" },
            { text: "활동적", value: "활동적인", next: "region_today" },
        ],
    },
    {
        id: "region_today",
        type: "ai",
        text: "Q4. 오늘은 어느 동네에서 놀까요? 📍",
        options: [
            { text: "문래·영등포", value: "문래·영등포", next: "payment_prompt" },
            { text: "합정·용산", value: "합정·용산", next: "payment_prompt" },
            { text: "안국·서촌", value: "안국·서촌", next: "payment_prompt" },
            { text: "을지로", value: "을지로", next: "payment_prompt" },
            { text: "여의도", value: "여의도", next: "payment_prompt" },
        ],
    },
    {
        id: "payment_prompt",
        type: "ai",
        text: "좋아요! ✨\n\n지금까지 답변을 분석해보니,\n당신에게 딱 맞는 코스를 최대 2가지로 좁힐 수 있을 것 같아요.\n\n오늘의 데이트 추천은\n하루에 1번 무료로 이용할 수 있어요 💡\n\n지금 바로 카드를 뽑아볼까요?",
        options: [
            { text: "코스 뽑기 🎲", value: "yes", next: "complete" },
            { text: "나중에 할게요", value: "no", next: "greeting" },
        ],
    },
];

const AIRecommender = () => {
    const router = useRouter();
    const pathname = usePathname();

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
    const [analysisText, setAnalysisText] = useState("취향 분석 중..."); // 분석 멘트
    const [revealedCards, setRevealedCards] = useState<Record<string, boolean>>({}); // 카드 뒤집힘 상태
    const [selectedDetailCourse, setSelectedDetailCourse] = useState<Course | null>(null); // 상세 보기 모달용

    // 모달 및 선택 데이터 상태
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const [showAlreadyUsedModal, setShowAlreadyUsedModal] = useState(false);
    const [showOnboardingSheet, setShowOnboardingSheet] = useState(false);
    const [pendingCourse, setPendingCourse] = useState<{ id: string; title: string; grade?: string } | null>(null);

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
                    "사용자";

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
                    const nick = parsed.nickname || parsed.name || parsed.email?.split("@")[0] || "사용자";
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
        setSelectedDetailCourse(null);
        setShowChatModal(false); // 모달 닫기
    };

    // 👇 [수정됨] 대화 시작 시 사용 횟수 체크 → 3회차+ 온보딩 미완 시 바텀시트 표시
    const startConversation = async () => {
        // 비로그인 체크
        if (!isLoggedIn) {
            setShowLogin(true);
            return;
        }

        // 🟢 3회차 진입(usageCount >= 2) & 온보딩 미완 → 온보딩 바텀시트
        try {
            const data = await authenticatedFetch<{ usageCount?: number; hasOnboardingData?: boolean }>(
                "/api/ai-recommendation/usage-count",
                { method: "GET" },
                false,
            );
            const usageCount = data?.usageCount ?? 0;
            const hasOnboardingData = data?.hasOnboardingData === true;
            if (usageCount >= 2 && !hasOnboardingData) {
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
                // 🟢 [주석처리] 일일 제한 확인 (하루 1회만 사용 가능) - 일시 비활성화
                // try {
                //     const data = await authenticatedFetch<{ canUse?: boolean; error?: string }>(
                //         "/api/ai-recommendation/check-daily",
                //         { method: "POST" },
                //         false,
                //     );
                //     if (!data?.canUse) {
                //         alert(data?.error || "오늘 이미 사용하셨습니다. 내일 다시 시도해주세요.");
                //         return;
                //     }
                // } catch {
                //     setNetError("처리 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
                //     return;
                // }

                setMessages((prev) => [...prev, { type: "user", text: option.text }]);

                // 🟢 즉시 추천 결과 표시 (분석 화면 최소화)
                setIsTyping(false);
                setIsGenerating(true);
                setIsAnalyzing(true);
                setShowRecommendations(true);

                const texts = [
                    "사용자 취향 데이터 스캔 중...",
                    `"${userAnswers["region_today"]}" 핫플레이스 탐색 중...`,
                    "날씨 및 분위기 점수 계산 중...",
                    `"${userAnswers["companion_today"]}"과(와) 함께하기 좋은 곳 필터링...`,
                    "최적의 동선 시뮬레이션 돌리는 중...",
                    "✨ 황금 코스 발견! ✨",
                ];

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

            if (res.ok && data) {
                const recommendations = (data as any)?.recommendations;
                const upsell = (data as any)?.upsellFor;
                const userTier = (data as any)?.userTier || "FREE";
                if (recommendations && Array.isArray(recommendations)) {
                    list = buildList(recommendations);
                    // 🟢 등급에 맞는 추천 코스 자동 저장 (오늘의 데이트 추천 탭용)
                    const tierMatching = list.filter((c: Course) => (c.grade || "FREE") === userTier);
                    const doSave = async (course: Course) => {
                        const opts = {
                            method: "POST" as const,
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ courseId: course.id, source: "ai_recommendation" }),
                            cache: "no-store" as RequestCache,
                        };
                        const { response } = await apiFetch("/api/users/me/courses", opts);
                        if (response.ok) {
                            window.dispatchEvent(new CustomEvent("savedCoursesChanged"));
                            return true;
                        }
                        return false;
                    };
                    for (const course of tierMatching) {
                        try {
                            let ok = await doSave(course);
                            if (!ok) {
                                await new Promise((r) => setTimeout(r, 500));
                                ok = await doSave(course);
                            }
                            if (!ok) console.warn("오늘의 데이트 추천 자동 저장 실패:", course.id);
                        } catch (e) {
                            console.error("오늘의 데이트 추천 자동 저장 실패:", course.id, e);
                        }
                    }
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
                setNetError("네트워크 오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
            }
        }

        setRecommendedCourses(list);

        setMessages((prev) => [
            ...prev,
            {
                type: "ai",
                text:
                    list.length > 0
                        ? `짜잔! 🎉 ${nickname}님을 위한 시크릿 코스를 찾았습니다.\n카드를 터치해서 확인해보세요!`
                        : hadNetworkError
                          ? `네트워크 오류로 추천을 가져오지 못했어요. 잠시 후 다시 시도해 주세요.`
                          : `조건에 맞는 코스를 찾지 못했어요. 다른 조건으로 다시 시도해볼까요?`,
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
        setSelectedDetailCourse(null);
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
                        setSelectedDetailCourse(null);
                        router.push(`/courses/${courseId}`);
                    } else {
                        alert("저장 중 오류가 발생했습니다.");
                    }
                } catch (error) {
                    console.error("저장 오류:", error);
                    alert("저장 중 오류가 발생했습니다.");
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
        setSelectedDetailCourse(null); // 상세 모달 닫기 (결제 모달만 표시)
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

    const handleFlipCard = (courseId: string, course: Course) => {
        if (!revealedCards[courseId]) {
            setRevealedCards((prev) => ({ ...prev, [courseId]: true }));
            // 잠금 해제된 코스: 카드 뒤집을 때 바로 상세 모달 표시 (상세보기 클릭 생략)
            const to = { FREE: 0, BASIC: 1, PREMIUM: 2 };
            const grade = course.grade || "FREE";
            if ((to[grade] ?? 0) <= (to[userTier] ?? 0)) setSelectedDetailCourse(course);
        }
    };

    // --- [NEW] 상세 보기 모달 컴포넌트 ---
    const CourseDetailModal = ({ course, onClose }: { course: Course; onClose: () => void }) => {
        const [detail, setDetail] = useState<any>(null);
        const [loading, setLoading] = useState(true);
        const [placesLoading, setPlacesLoading] = useState(true); // 🟢 장소 정보 별도 로딩 상태
        const [dragY, setDragY] = useState(0);
        const dragStartYRef = useRef(0);
        const dragYRef = useRef(0);
        const pointerIdRef = useRef<number | null>(null);

        useEffect(() => {
            dragYRef.current = dragY;
        }, [dragY]);

        const handlePointerDown = useCallback(
            (e: React.PointerEvent) => {
                dragStartYRef.current = e.clientY;
                pointerIdRef.current = e.pointerId;
                (e.target as HTMLElement).setPointerCapture(e.pointerId);
                const onMove = (ev: PointerEvent) => {
                    const dy = Math.max(0, ev.clientY - dragStartYRef.current);
                    dragYRef.current = dy;
                    setDragY(dy);
                };
                const onUp = () => {
                    try {
                        (e.target as HTMLElement).releasePointerCapture(pointerIdRef.current!);
                    } catch (_) {}
                    pointerIdRef.current = null;
                    window.removeEventListener("pointermove", onMove);
                    window.removeEventListener("pointerup", onUp);
                    window.removeEventListener("pointercancel", onUp);
                    if (dragYRef.current > 80) onClose();
                    setDragY(0);
                };
                window.addEventListener("pointermove", onMove);
                window.addEventListener("pointerup", onUp);
                window.addEventListener("pointercancel", onUp);
            },
            [onClose],
        );

        useEffect(() => {
            const fetchCourseDetail = async () => {
                try {
                    setLoading(true);
                    setPlacesLoading(true);

                    // 🟢 [Optimization]: apiFetch 사용하여 캐싱 활용
                    const { apiFetch } = await import("@/lib/authClient");
                    const { data, response: res } = await apiFetch<any>(`/api/courses/${course.id}`, {
                        cache: "force-cache", // 🟢 캐싱으로 성능 향상
                        next: { revalidate: 300 }, // 🟢 5분간 캐시 유지
                    });

                    if (res.ok && data) {
                        // 🟢 [Performance]: 즉시 표시 (지연 제거)
                        setDetail(data);
                        setLoading(false);
                        setPlacesLoading(false); // 🟢 장소 정보도 즉시 표시
                    } else {
                        // 🟢 에러 응답 처리
                        console.error("코스 상세 조회 실패:", res.status);
                        setDetail(null); // 에러 시 detail을 null로 설정
                        setLoading(false);
                        setPlacesLoading(false);
                    }
                } catch (error) {
                    console.error("코스 상세 조회 실패:", error);
                    setDetail(null); // 에러 시 detail을 null로 설정
                    setLoading(false);
                    setPlacesLoading(false);
                }
            };
            fetchCourseDetail();
        }, [course.id]);

        return (
            <div
                className="fixed inset-0 z-70 flex items-end justify-center p-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200 cursor-pointer"
                onClick={onClose}
                role="presentation"
            >
                <div
                    className="bg-white dark:bg-[#1a241b] rounded-t-4xl w-full max-w-md max-h-[85vh] flex flex-col shadow-2xl relative overflow-hidden cursor-default"
                    style={
                        {
                            animation: "slideUp 0.35s ease-out forwards",
                            transform: `translateY(${dragY}px)`,
                        } as React.CSSProperties
                    }
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* 드래그 핸들 (드래그하여 내리기) */}
                    <div
                        onPointerDown={handlePointerDown}
                        className="flex justify-center pt-3 pb-1 shrink-0 cursor-grab active:cursor-grabbing touch-manipulation"
                    >
                        <div className="w-10 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full" />
                    </div>
                    {/* Header */}
                    <div className="p-4 pt-2 pb-6 border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-[#1a241b] z-10 shrink-0">
                        <div>
                            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 tracking-wider uppercase mb-1 block">
                                Course Detail
                            </span>
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white leading-tight">
                                {course.title}
                            </h3>
                        </div>
                    </div>

                    {/* Content (Scrollable) */}
                    <div className="flex-1 overflow-y-auto p-6 bg-gray-50/50 dark:bg-[#0f1710] scrollbar-hide">
                        {/* Summary Card */}
                        <div className="bg-white dark:bg-[#1a241b] p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 mb-6">
                            <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
                                {course.description}
                            </p>
                            <div className="flex gap-3 mt-4 text-xs font-medium text-gray-500 dark:text-gray-400">
                                <div className="flex items-center">
                                    <MapPin className="w-3.5 h-3.5 mr-1 text-emerald-600 dark:text-emerald-400" />
                                    {course.location}
                                </div>
                                <div className="flex items-center">
                                    <Clock className="w-3.5 h-3.5 mr-1 text-emerald-600 dark:text-emerald-400" />
                                    {course.duration}
                                </div>
                            </div>
                        </div>

                        {/* Timeline */}
                        <div className="relative pl-4 space-y-8 before:absolute before:left-[19px] before:top-2 before:bottom-2 before:w-[2px] before:bg-linear-to-b before:from-emerald-200 before:to-gray-200 dark:before:from-emerald-800/50 dark:before:to-gray-700">
                            {loading ? (
                                <div className="flex items-center justify-center py-10">
                                    <div className="w-8 h-8 border-4 border-emerald-200 dark:border-emerald-900 border-t-emerald-500 dark:border-t-emerald-400 rounded-full animate-spin"></div>
                                </div>
                            ) : placesLoading ? (
                                // 🟢 [Optimization]: 장소 정보 로딩 중 스켈레톤 UI
                                Array.from({ length: detail?.coursePlaces?.length || 3 }).map((_, index) => (
                                    <div key={`skeleton-${index}`} className="relative flex items-start">
                                        <div className="absolute left-0 w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-800 animate-pulse z-10"></div>
                                        <div className="ml-14 flex-1 bg-white dark:bg-[#1a241b] p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-800">
                                            <div className="h-3 w-20 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mb-2"></div>
                                            <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mb-2"></div>
                                            <div className="h-3 w-full bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                                        </div>
                                    </div>
                                ))
                            ) : detail?.coursePlaces?.length > 0 ? (
                                detail.coursePlaces.map((cp: any, index: number) => (
                                    <div key={cp.id} className="relative flex items-start group">
                                        <div className="absolute left-0 w-10 h-10 rounded-full bg-white dark:bg-[#1a241b] border-4 border-emerald-100 dark:border-emerald-800/50 flex items-center justify-center shadow-sm z-10 group-hover:border-emerald-200 dark:group-hover:border-emerald-700 transition-colors">
                                            {index === 0 ? (
                                                <Store className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                                            ) : index === detail.coursePlaces.length - 1 ? (
                                                <Star className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                                            ) : (
                                                <Bot className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                                            )}
                                        </div>
                                        <div className="ml-14 flex-1 bg-white dark:bg-[#1a241b] p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-800 hover:shadow-md transition-all">
                                            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 mb-1 block">
                                                {cp.place?.category || `${index + 1}번째 장소`}
                                            </span>
                                            <h4 className="text-base font-bold text-gray-900 dark:text-white mb-1">
                                                {cp.place?.name || "장소 정보 없음"}
                                            </h4>
                                            <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2">
                                                {cp.description || cp.place?.description || ""}
                                            </p>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="text-center py-10 text-gray-500 dark:text-gray-400 text-sm">
                                    상세 장소 정보가 없습니다.
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Footer Action */}
                    <div className="p-4 bg-white dark:bg-[#1a241b] border-t border-gray-100 dark:border-gray-800 flex justify-end">
                        <TapFeedback className="block w-[85%] sm:w-[90%]">
                            <button
                                onClick={() => handleCourseCommit(course.id, course.title)}
                                disabled={isSelecting || !!selectedCourseId}
                                className={`w-full py-2.5 rounded-xl font-bold text-sm shadow-lg transition-all flex items-center justify-center gap-2 ${
                                    selectedCourseId || isSelecting
                                        ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                                        : "bg-gray-900 text-white hover:bg-gray-800"
                                }`}
                            >
                                {selectedCourseId || isSelecting ? (
                                    isSelecting ? (
                                        "처리 중..."
                                    ) : (
                                        "이미 선택된 코스입니다"
                                    )
                                ) : (
                                    <>
                                        <span>이 코스로 결정하기</span>
                                        <CheckCircle className="w-4 h-4 shrink-0" />
                                    </>
                                )}
                            </button>
                        </TapFeedback>
                    </div>
                </div>
            </div>
        );
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
                onClick={() => !isSelected && handleFlipCard(course.id, course)}
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
                                    <span className="text-emerald-400">{nickname}님</span>을 위한 <br />
                                    <span className="text-transparent bg-clip-text bg-linear-to-r from-emerald-300 to-teal-300">
                                        맞춤 코스 설계안
                                    </span>
                                </h3>
                            </div>

                            <div className="mt-10">
                                <div className="inline-block px-4 py-2 rounded-full bg-white/5 border border-white/10 backdrop-blur-md">
                                    <p className="text-gray-400 text-xs font-medium">터치하여 봉인 해제 🔓</p>
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
                                      setPendingCourse({
                                          id: course.id,
                                          title: course.title,
                                          grade: courseGrade,
                                      });
                                      setShowPaywall(true);
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
                                                setPendingCourse({
                                                    id: course.id,
                                                    title: course.title,
                                                    grade: courseGrade,
                                                });
                                                setShowPaywall(true);
                                            }}
                                            className="w-full py-4 bg-emerald-600 dark:bg-emerald-700 text-white rounded-2xl font-bold text-sm hover:bg-emerald-700 dark:hover:bg-emerald-600 transition-all"
                                        >
                                            {courseGrade === "BASIC"
                                                ? "✨ 베이직 코스 바로 보기"
                                                : "✨ 프리미엄 코스 바로 보기"}
                                        </button>
                                    </TapFeedback>
                                </>
                            ) : (
                                <>
                                    <div className="flex justify-between items-start mb-4">
                                        <span className="inline-flex items-center px-2.5 py-1 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-[11px] font-black rounded-lg border border-emerald-100 dark:border-emerald-800/50">
                                            {nickname}님 취향 저격
                                        </span>
                                        <Sparkles className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
                                    </div>
                                    <h3 className="text-2xl font-bold mb-3 text-gray-900 dark:text-white leading-tight tracking-tighter">
                                        {course.title}
                                    </h3>
                                    <p className="text-gray-500 dark:text-gray-400 text-[14px] leading-relaxed mb-3 line-clamp-3">
                                        {course.description}
                                    </p>
                                    {course.matchReason && (
                                        <p className="text-emerald-600 dark:text-emerald-400 text-[13px] font-medium mb-4">
                                            {course.matchReason}
                                        </p>
                                    )}
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
                                                {course.duration || "-"}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="mt-auto flex gap-2.5">
                                        <TapFeedback className="flex-1 min-w-0">
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setSelectedDetailCourse(course);
                                                }}
                                                className="w-full py-4 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded-2xl font-bold text-sm hover:bg-gray-200 dark:hover:bg-gray-700 transition-all"
                                            >
                                                상세보기
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
                    <LoginModal
                        onClose={() => setShowLogin(false)}
                        next="/personalized-home"
                        {...LOGIN_MODAL_PRESETS.recommendation}
                    />
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
                                    오늘 사용 완료했어요
                                </h3>
                                <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed px-2">
                                    오늘의 데이트 추천은 하루에 1번만 이용할 수 있어요.
                                    <br />
                                    내일 다시 시도해주세요!
                                </p>
                            </div>
                            <div className="border-t border-gray-100 dark:border-gray-800 p-4">
                                <button
                                    onClick={() => setShowAlreadyUsedModal(false)}
                                    className="w-full py-4 bg-gray-900 dark:bg-gray-800 text-white rounded-2xl font-bold hover:bg-gray-800 dark:hover:bg-gray-700 transition-all"
                                >
                                    확인
                                </button>
                            </div>
                        </div>
                    </div>
                )}
                {/* 🟢 [IN-APP PURCHASE]: 모바일 앱에서만 표시 (TicketPlans 컴포넌트 내부에서도 체크) */}
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
                                    취소
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
                                    {isSelecting ? "처리 중..." : "저장하기"}
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
                            <h3 className="text-2xl font-black text-gray-900 dark:text-white mb-3">코스 선택 완료!</h3>
                            <p className="text-gray-500 text-[15px] mb-8 leading-relaxed">
                                성공적으로 저장되었습니다.
                                <br />
                                지금 바로 상세 코스를 확인해보세요.
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
                                    상세 코스 보러가기
                                </button>
                                <button
                                    onClick={() => {
                                        setShowSuccessModal(false);
                                        setPendingCourse(null);
                                    }}
                                    className="w-full py-3 text-gray-400 font-bold text-sm hover:text-gray-600 transition-colors"
                                >
                                    닫기
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* 👇 [추가됨] 상세 정보 모달 */}
                {selectedDetailCourse && (
                    <CourseDetailModal course={selectedDetailCourse} onClose={() => setSelectedDetailCourse(null)} />
                )}

                {/* 👇 [추가됨] 대화창 모달 */}
                {showChatModal && (
                    <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
                        {/* 모달 컨테이너 — Android: safe-area 위·아래 여백 */}
                        <div
                            className={`bg-white/95 dark:bg-[#1a241b]/95 backdrop-blur-md w-full h-full md:h-[85vh] md:w-[600px] md:rounded-[2.5rem] shadow-2xl relative flex flex-col overflow-hidden ${
                                isAndroid() ? "pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]" : ""
                            }`}
                        >
                            {/* 헤더 */}
                            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800 bg-white/80 dark:bg-[#1a241b]/80">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
                                        <Bot className="w-6 h-6 text-emerald-600" />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-gray-900 dark:text-white">AI 두나</h3>
                                        <p className="text-xs text-emerald-600 font-medium flex items-center">
                                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5 animate-pulse"></span>
                                            실시간 분석 중
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
                                        <div className="flex justify-between items-center mb-4 px-1">
                                            <div>
                                                <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                                                    🎁 추천 결과
                                                </h3>
                                                <p className="text-sm font-medium text-gray-600 dark:text-gray-300 mt-1">
                                                    {hasLongTermPreferences
                                                        ? "회원님 취향을 반영했어요"
                                                        : "오늘 상황 기준 추천이에요"}
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
                                                <p className="mb-4">조건에 맞는 코스를 찾지 못했어요.</p>
                                                <button
                                                    onClick={handleResetAndRecommend}
                                                    className="px-5 py-2.5 bg-gray-900 text-white rounded-xl text-sm font-bold"
                                                >
                                                    다시 시도하기
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
                                    오늘 어떤 하루를 보내실 건가요?
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
                                            <span className="dark:text-white">안녕하세요,</span> <br />
                                            <span className="text-emerald-600 dark:text-emerald-400">
                                                {nickname || "사용자"}님
                                            </span>{" "}
                                            👋
                                        </>
                                    ) : (
                                        <>
                                            <span className="dark:text-white">로그인이</span> <br />
                                            <span className="text-emerald-600 dark:text-emerald-400">필요해요</span> 👋
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
                                            alt="프로필"
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
                                        <span>로그인하고 혜택받기</span>
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
                                    오늘의 데이트 코스 설계
                                </span>
                            </h2>
                            <p className="text-gray-500 dark:text-gray-300 text-[14px] leading-relaxed mb-6 max-w-[260px] mx-auto">
                                고민은 줄이고, 실패 없는 코스로
                            </p>

                            {/* 3. 버튼 */}
                            <TapFeedback className="block w-full max-w-[280px] mx-auto">
                                <button
                                    onClick={startConversation}
                                    className="group relative px-6 py-3 w-full bg-gray-900 text-white rounded-xl font-bold text-[15px] shadow-lg shadow-emerald-900/20 transition-all hover:-translate-y-1 hover:shadow-2xl overflow-hidden"
                                >
                                    <div className="absolute inset-0 bg-linear-to-r from-emerald-500 via-teal-500 to-emerald-600 opacity-100 bg-size-[200%_auto] animate-[gradient_3s_ease_infinite]"></div>

                                    <div className="relative flex items-center justify-center gap-2">
                                        <span>오늘의 코스 추천받기</span>
                                        <ChevronRight className="w-5 h-5 text-white/90 group-hover:translate-x-1 transition-transform" />
                                    </div>
                                </button>
                            </TapFeedback>

                            <div className="mt-4 flex items-center gap-1.5 opacity-60">
                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                                <p className="text-[11px] text-gray-400 dark:text-gray-500 font-medium tracking-wide uppercase">
                                    하루에 한 번 무료로 추천해드려요
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
