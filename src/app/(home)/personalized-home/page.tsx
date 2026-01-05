"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "@/components/ImageFallback";
import { fetchWeekStamps, postCheckin } from "@/lib/checkinClient";
import { apiFetch, authenticatedFetch } from "@/lib/authClient"; // 🟢 쿠키 기반 API 호출
import { getS3StaticUrl } from "@/lib/s3Static";
import TicketPlans from "@/components/TicketPlans";
import LoginModal from "@/components/LoginModal";
import CompletionModal from "@/components/CompletionModal";
import {
    Sparkles,
    MapPin,
    Clock,
    Users,
    Star,
    Ticket,
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
}

type TrendingCourse = {
    id: string | number;
    title: string;
    imageUrl?: string | null;
    location?: string | null;
    duration?: string | null;
    viewCount?: number;
};

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
        text: "총 4개의 간단한 질문을 드려요! 오늘의 목적, 함께하는 사람, 원하는 분위기, 선호 지역을 물어볼 예정이에요. 각 질문은 30초 이내로 답하실 수 있어요 😊",
        options: [{ text: "좋아요, 시작할게요!", value: "start", next: "goal" }],
    },
    {
        id: "goal",
        type: "ai",
        text: "Q1. 오늘의 목적은 무엇인가요? 🎯",
        options: [
            { text: "기념일", value: "기념일", next: "companion_today" },
            { text: "데이트", value: "데이트", next: "companion_today" },
            { text: "썸·소개팅", value: "썸·소개팅", next: "companion_today" },
            { text: "힐링", value: "힐링", next: "companion_today" },
            { text: "특별한 이벤트", value: "특별한 이벤트", next: "companion_today" },
            { text: "사진 잘 나오는 코스", value: "사진 잘 나오는 코스", next: "companion_today" },
            { text: "밤 데이트", value: "밤 데이트", next: "companion_today" },
        ],
    },
    {
        id: "companion_today",
        type: "ai",
        text: "Q2. 오늘 함께하는 사람은 누구인가요? 👥",
        options: [
            { text: "연인", value: "연인", next: "mood_today" },
            { text: "썸 상대", value: "썸 상대", next: "mood_today" },
            { text: "소개팅 상대", value: "소개팅 상대", next: "mood_today" },
            { text: "친구", value: "친구", next: "mood_today" },
            { text: "혼자", value: "혼자", next: "mood_today" },
        ],
    },
    {
        id: "mood_today",
        type: "ai",
        text: "Q3. 오늘 원하는 분위기는 어떤가요? ✨",
        options: [
            { text: "조용한", value: "조용한", next: "region_today" },
            { text: "감성 가득한", value: "감성 가득한", next: "region_today" },
            { text: "트렌디한", value: "트렌디한", next: "region_today" },
            { text: "활동적인", value: "활동적인", next: "region_today" },
            { text: "프리미엄", value: "프리미엄", next: "region_today" },
            { text: "사진 잘 나오는", value: "사진 잘 나오는", next: "region_today" },
            { text: "여유로운", value: "여유로운", next: "region_today" },
        ],
    },
    {
        id: "region_today",
        type: "ai",
        text: "Q4. 오늘의 선호 지역은 어디인가요? 📍",
        options: [
            { text: "성수", value: "성수", next: "payment_prompt" },
            { text: "홍대/연남", value: "홍대/연남", next: "payment_prompt" },
            { text: "을지로", value: "을지로", next: "payment_prompt" },
            { text: "종로/북촌", value: "종로/북촌", next: "payment_prompt" },
            { text: "용산", value: "용산", next: "payment_prompt" },
        ],
    },
    {
        id: "payment_prompt",
        type: "ai",
        text: "좋아요! ✨\n\n지금까지 답변을 분석해보니,\n당신에게 딱 맞는 코스를 최대 2가지로 좁힐 수 있을 것 같아요.\n\nAI 맞춤 코스 추천은\n쿠폰 1개로 이용할 수 있어요 💡\n\n지금 바로 카드를 뽑아볼까요?",
        options: [
            { text: "코스 뽑기 (쿠폰 1개) 🎲", value: "yes", next: "complete" },
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
    const [coupons, setCoupons] = useState(0);
    const [showLogin, setShowLogin] = useState(false);
    const [showPaywall, setShowPaywall] = useState(false);
    const [attendanceModalOpen, setAttendanceModalOpen] = useState(false);
    const [showCompletionModal, setShowCompletionModal] = useState(false);
    const [weekStamps, setWeekStamps] = useState<boolean[]>([false, false, false, false, false, false, false]);
    const [todayIndex, setTodayIndex] = useState<number | null>(null);
    const [todayChecked, setTodayChecked] = useState(false);
    const [weekCount, setWeekCount] = useState(0);
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
    const [netError, setNetError] = useState<string | null>(null);
    const [isUsingCoupon, setIsUsingCoupon] = useState(false);
    const [trending, setTrending] = useState<TrendingCourse[]>([]);
    const [isSelecting, setIsSelecting] = useState(false);
    const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
    const [isUserDataLoading, setIsUserDataLoading] = useState(true); // 🟢 사용자 정보 로딩 상태

    // --- [추가] 게임 효과 및 모달 상태 ---
    const [isAnalyzing, setIsAnalyzing] = useState(false); // 분석 화면 표시 여부
    const [analysisText, setAnalysisText] = useState("취향 분석 중..."); // 분석 멘트
    const [revealedCards, setRevealedCards] = useState<Record<string, boolean>>({}); // 카드 뒤집힘 상태
    const [selectedDetailCourse, setSelectedDetailCourse] = useState<Course | null>(null); // 상세 보기 모달용

    // 모달 및 선택 데이터 상태
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const [pendingCourse, setPendingCourse] = useState<{ id: string; title: string } | null>(null);

    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, isTyping, showChatModal]); // showChatModal 추가

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
                setCoupons((userData as any).couponCount || 0);
                localStorage.setItem("user", JSON.stringify(userData));
            } else {
                // 🟢 response.ok가 false인 경우에도 handleLogout 대신 로그인 상태만 변경 (리다이렉트 방지)
                setIsLoggedIn(false);
                setUserName("");
                setNickname("");
                setProfileImageUrl(null);
                setCoupons(0);
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
                    setCoupons(parsed.couponCount || 0);
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
                    setCoupons(0);
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
            setCoupons(0);
        };

        const handleAuthTokenChange = () => {
            checkLoginStatus();
        };

        // 🟢 쿠폰 개수 업데이트 이벤트 리스너 (결제 완료 후)
        const handleCouponCountUpdated = (event: CustomEvent) => {
            const newCouponCount = event.detail?.couponCount;
            if (typeof newCouponCount === "number") {
                setCoupons(newCouponCount);
                console.log(`[쿠폰 개수 업데이트] ${newCouponCount}개로 갱신됨`);
                // 🟢 이벤트 수신 후 서버에서 최신 데이터 강제로 가져오기
                fetchUserData(true);
            }
        };

        window.addEventListener("authLoginSuccess", handleAuthLoginSuccess);
        window.addEventListener("authLogout", handleAuthLogout);
        window.addEventListener("authTokenChange", handleAuthTokenChange);
        window.addEventListener("couponCountUpdated", handleCouponCountUpdated as EventListener);

        return () => {
            window.removeEventListener("authLoginSuccess", handleAuthLoginSuccess);
            window.removeEventListener("authLogout", handleAuthLogout);
            window.removeEventListener("authTokenChange", handleAuthTokenChange);
            window.removeEventListener("couponCountUpdated", handleCouponCountUpdated as EventListener);
        };
    }, []);

    // 출석 정보 가져오기 (성능 최적화: 로그인 확인 후 지연 로드)
    useEffect(() => {
        if (!isLoggedIn || isUserDataLoading) return;

        // 🟢 [Performance]: 사용자 정보 로딩 완료 후 출석 정보 로드 (지연 로드)
        const timer = setTimeout(() => {
            const fetchCheckins = async () => {
                try {
                    const res = await fetchWeekStamps();
                    if (!res) return;
                    // 🟢 [Performance]: 다음 프레임에서 상태 업데이트
                    requestAnimationFrame(() => {
                        // 서버에서 받은 weekStamps를 그대로 사용 (7일 완료 후 리셋된 상태도 반영)
                        setWeekStamps(res.stamps);
                        setTodayIndex(typeof res.todayIndex === "number" ? res.todayIndex : null);
                        setTodayChecked(Boolean(res.todayChecked));
                        // weekCount 업데이트: 7일 완료 후 다음날에는 0 또는 1로 리셋됨
                        if (typeof res.weekCount === "number") {
                            setWeekCount(res.weekCount);
                        }
                    });
                } catch (error) {
                    console.error("출석 정보 조회 오류:", error);
                }
            };

            fetchCheckins();
        }, 200); // 🟢 200ms 지연으로 초기 렌더링 우선

        return () => clearTimeout(timer);
    }, [isLoggedIn, isUserDataLoading]);

    // 출석 체크
    const doHomeCheckin = async () => {
        try {
            const result = await postCheckin();
            if (result.ok && result.success) {
                await fetchUserData();

                // weekStamps 업데이트: 서버에서 받은 값이 있으면 우선 사용 (7일 완료 후 리셋된 상태도 반영)
                if (Array.isArray(result.weekStamps) && result.weekStamps.length === 7) {
                    setWeekStamps(result.weekStamps);
                } else if (typeof result.todayIndex === "number") {
                    // 서버에서 weekStamps가 없고 todayIndex만 있는 경우, 오늘만 체크된 상태로 업데이트
                    setWeekStamps((prev) => {
                        // weekCount가 0 또는 1이면 새로운 주기 시작이므로 이전 상태 무시하고 리셋
                        if (
                            typeof result.weekCount === "number" &&
                            (result.weekCount === 0 || result.weekCount === 1)
                        ) {
                            return prev.map((v, i) => i === result.todayIndex);
                        }
                        // 기존 주기 중이면 기존 상태 유지하면서 오늘만 체크
                        return prev.map((v, i) => (i === result.todayIndex ? true : v));
                    });
                } else {
                    // todayIndex도 없으면 로컬 계산으로 폴백
                    const now = new Date();
                    const day = now.getDay();
                    const idx = (day + 6) % 7;
                    setWeekStamps((prev) => prev.map((v, i) => (i === idx ? true : v)));
                }

                // todayIndex 업데이트
                if (typeof result.todayIndex === "number" || result.todayIndex === null) {
                    setTodayIndex(result.todayIndex ?? null);
                }

                // weekCount 업데이트: 7일 완료 후 다음날에는 0 또는 1로 리셋될 수 있음
                if (typeof result.weekCount === "number") {
                    setWeekCount(result.weekCount);
                }

                setTodayChecked(true);
                setAttendanceModalOpen(false);

                // 7일 완료 시 CompletionModal 표시
                if (result.awarded) {
                    setShowCompletionModal(true);
                } else {
                    alert("출석 체크 완료!");
                }
            } else {
                alert("출석 체크에 실패했습니다.");
            }
        } catch (error) {
            console.error("출석 체크 API 오류:", error);
            alert("오류가 발생했습니다. 다시 시도해주세요.");
        }
    };

    // 로그아웃
    const handleLogout = () => {
        localStorage.removeItem("authToken");
        localStorage.removeItem("user");
        sessionStorage.removeItem("auth:loggingIn");
        setIsLoggedIn(false);
        setUserName("");
        setNickname("");
        setProfileImageUrl(null);
        setCoupons(0);
        resetConversation();
        window.dispatchEvent(new CustomEvent("authTokenChange"));
        try {
            router.replace("/personalized-home");
        } catch {}
    };

    const resetConversation = () => {
        setMessages([{ type: "ai", text: questionFlow[0].text }]);
        setCurrentQuestion(questionFlow[0]);
        setUserAnswers({});
        setRecommendedCourses([]);
        setShowRecommendations(false);
        setProgress(0);
        setShowUpsell(false);
        setIsGenerating(false);
        setSelectedCourseId(null);
        setIsAnalyzing(false);
        setRevealedCards({});
        setSelectedDetailCourse(null);
        setShowChatModal(false); // 모달 닫기
    };

    // 👇 [수정됨] 대화 시작 시 모달 띄우기
    const startConversation = () => {
        // 비로그인 체크
        if (!isLoggedIn) {
            setShowLogin(true);
            return;
        }

        setShowChatModal(true);
        // 초기화가 필요하면 여기서 resetConversation 로직 일부 수행 가능
        if (messages.length === 0) {
            setMessages([{ type: "ai", text: questionFlow[0].text }]);
        }
        setTimeout(() => {
            messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
        }, 300);
    };

    // 쿠폰 사용 API
    const useCoupon = async (): Promise<boolean> => {
        if (isUsingCoupon) return false;

        setIsUsingCoupon(true);

        try {
            // 🟢 쿠키 기반 인증: authenticatedFetch 사용 (shouldRedirect: false로 설정하여 로그아웃 방지)
            const data = await authenticatedFetch<{ ticketsRemaining?: number; success?: boolean; error?: string }>(
                "/api/ai-recommendation/use-ticket",
                {
                    method: "POST",
                },
                false // 🟢 401 발생 시 자동 로그아웃 및 리다이렉트 방지
            );

            if (data && typeof data.ticketsRemaining === "number") {
                setCoupons(data.ticketsRemaining);
                setIsUsingCoupon(false);
                return true;
            } else {
                setIsUsingCoupon(false);
                // 🟢 ticketsRemaining이 없으면 프로필 API로 최신 값 가져오기
                if (data && data.success) {
                    await fetchUserData();
                    return true;
                }
                // 🟢 401 등의 인증 오류인 경우 로그인 모달 표시
                setShowLogin(true);
                setNetError("로그인이 필요합니다.");
                return false;
            }
        } catch (error) {
            console.error("쿠폰 사용 API 오류:", error);
            setIsUsingCoupon(false);
            setNetError("네트워크 오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
            return false;
        }
    };

    // 쿠폰 환불 API
    const refundCoupon = async (): Promise<void> => {
        try {
            // 🟢 쿠키 기반 인증: authenticatedFetch 사용
            const data = await authenticatedFetch<{ ticketsRemaining?: number; success?: boolean }>(
                "/api/ai-recommendation/refund",
                {
                    method: "POST",
                }
            );

            if (data) {
                // 🟢 [수정]: ticketsRemaining이 있으면 사용, 없으면 fetchUserData로 최신 값 가져오기
                if (typeof data.ticketsRemaining === "number") {
                    setCoupons(data.ticketsRemaining);
                } else {
                    // ticketsRemaining이 없으면 프로필 API로 최신 값 가져오기
                    await fetchUserData();
                }
            } else {
                setNetError("네트워크 오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
            }
        } catch (error) {
            console.error("쿠폰 환불 API 오류:", error);
            // 🟢 에러 발생 시에도 최신 쿠폰 개수 가져오기 시도
            try {
                await fetchUserData();
            } catch (fetchError) {
                console.error("쿠폰 개수 갱신 실패:", fetchError);
            }
            setNetError("네트워크 오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
        }
    };

    // 답변 처리
    const handleAnswer = async (option: QuestionOption) => {
        if (currentQuestion.id === "payment_prompt") {
            if (option.value === "yes") {
                if (!isLoggedIn) {
                    setShowLogin(true);
                    return;
                }
                if (coupons < 1) {
                    setShowPaywall(true);
                    return;
                }
                const couponUsed = await useCoupon();
                if (!couponUsed) return;

                setMessages((prev) => [...prev, { type: "user", text: option.text }]);

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
                }, 800);

                await generateRecommendations(userAnswers);

                clearInterval(textInterval);
                setTimeout(() => {
                    setIsAnalyzing(false);
                    setIsGenerating(false);
                }, 1000);

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
            (rows || []).map((c: any) => ({
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
                // 🟢 matchScore를 score로 매핑 (0.0~1.0 범위, 이미 UX 스케일링 적용됨)
                score: c.matchScore !== undefined && c.matchScore !== null ? Number(c.matchScore) : 0.5,
            }));

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

        const goal = answers.goal || "";
        const companionToday = answers.companion_today || "";
        const moodToday = answers.mood_today || "";
        const regionToday = answers.region_today || "";

        let list: Course[] = [];

        try {
            const token = localStorage.getItem("authToken");
            const params = new URLSearchParams({
                mode: "ai", // 🟢 BASIC 코스 추천을 위한 mode 파라미터
                goal,
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
                if (recommendations && Array.isArray(recommendations)) {
                    list = buildList(recommendations);
                }
            }
        } catch (error) {
            console.error("추천 API 오류:", error);
            hadNetworkError = true;
        }

        if (list.length === 0) {
            let fallbackList = await fetchCourses({
                ...(regionToday ? { region: regionToday } : {}),
            });
            list = fallbackList.slice(0, 2);
        }

        if (list.length === 0) {
            if (hadNetworkError) {
                setNetError("네트워크 오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
            }
            await refundCoupon();
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
                        ? `네트워크 오류로 추천을 가져오지 못했어요. 쿠폰은 복구해드렸습니다. 잠시 후 다시 시도해 주세요.`
                        : `조건에 맞는 코스를 찾지 못했어요. 사용하신 쿠폰은 바로 복구해드렸습니다. 다른 조건으로 다시 시도해볼까요?`,
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

        // 2. 권한 및 자산 검증
        if (!isLoggedIn) {
            setShowLogin(true);
            return;
        }
        if (coupons < 1) {
            setShowConfirmModal(false);
            setShowPaywall(true);
            return;
        }

        setIsSelecting(true);

        try {
            // [Step 1]: 쿠폰 차감 API 호출 (useCoupon 함수 내부 호출)
            const couponSuccess = await useCoupon();
            if (!couponSuccess) {
                alert("쿠폰 차감에 실패했습니다. 잔액을 확인해주세요.");
                setIsSelecting(false);
                return;
            }

            // [Step 2]: 마이페이지 저장 API 호출
            // 🟢 httpOnly Cookie 기반 인증 (보안 강화 지침 준수)
            const saveRes = await authenticatedFetch("/api/users/me/courses", {
                method: "POST",
                body: JSON.stringify({ courseId }),
            });

            if (saveRes !== null) {
                // [Step 3]: 성공 시 상태 업데이트 및 즉시 이동
                setSelectedCourseId(courseId);
                setShowConfirmModal(false);
                setSelectedDetailCourse(null); // 모달이 열려있다면 닫기

                // 🚀 브라우저 히스토리에 남지 않도록 replace 또는 push 사용
                router.push(`/courses/${courseId}`);
            } else {
                // 저장 단계 실패 시 사용자 보호를 위해 쿠폰 환불 처리
                await refundCoupon();
                alert("저장 중 오류가 발생하여 쿠폰이 복구되었습니다.");
            }
        } catch (error) {
            console.error("Critical Selection Error:", error);
            // 🟢 에러 발생 시 쿠폰 환불 시도
            try {
                await refundCoupon();
            } catch (refundError) {
                console.error("쿠폰 환불 실패:", refundError);
            }
            alert("시스템 오류로 인해 처리가 중단되었습니다.");
        } finally {
            setIsSelecting(false);
        }
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
        if (!revealedCards[courseId]) {
            setRevealedCards((prev) => ({ ...prev, [courseId]: true }));
        }
    };

    // --- [NEW] 상세 보기 모달 컴포넌트 ---
    const CourseDetailModal = ({ course, onClose }: { course: Course; onClose: () => void }) => {
        const [detail, setDetail] = useState<any>(null);
        const [loading, setLoading] = useState(true);
        const [placesLoading, setPlacesLoading] = useState(true); // 🟢 장소 정보 별도 로딩 상태

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
            <div className="fixed inset-0 z-70 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                <div className="bg-white dark:bg-[#1a241b] rounded-4xl w-full max-w-md h-[80vh] flex flex-col shadow-2xl relative overflow-hidden">
                    {/* Header */}
                    <div className="p-6 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center bg-white dark:bg-[#1a241b] z-10">
                        <div>
                            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 tracking-wider uppercase mb-1 block">
                                Course Detail
                            </span>
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white leading-tight">
                                {course.title}
                            </h3>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full transition-colors"
                        >
                            <X className="w-5 h-5 text-gray-600 dark:text-gray-300" />
                        </button>
                    </div>

                    {/* Content (Scrollable) */}
                    <div className="flex-1 overflow-y-auto p-6 bg-gray-50/50 dark:bg-[#0f1710]">
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
                    <div className="p-4 bg-white dark:bg-[#1a241b] border-t border-gray-100 dark:border-gray-800">
                        <button
                            onClick={() => handleCourseCommit(course.id, course.title)}
                            disabled={isSelecting || !!selectedCourseId}
                            className={`w-full py-4 rounded-xl font-bold text-lg shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2 ${
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
                                    <CheckCircle className="w-5 h-5" />
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    const FlipCard = ({ course }: { course: Course }) => {
        const isRevealed = revealedCards[course.id];
        const isSelected = selectedCourseId === course.id;

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

        // 🟢 [Logic]: 매칭률 동적 보정 (60% ~ 98% Scaling)
        const displayScore = useMemo(() => {
            // API 점수가 있으면 사용, 없으면 기본값 0.5(50%)를 기준으로 보정
            // 🟢 score는 이미 0.0~1.0 범위이므로, 1.0을 초과하면 1.0으로 제한
            let baseScore = course.score && course.score > 0 ? Number(course.score) : 0.5;

            // 🟢 1.0을 초과하는 값은 1.0으로 제한 (100% 초과 방지)
            if (baseScore > 1.0) {
                baseScore = 1.0;
            }

            // 🟢 API에서 이미 UX 스케일링이 적용된 경우를 고려
            // matchScore가 이미 0.6~0.98 범위일 수 있으므로, 1.0보다 작으면 그대로 사용
            // 1.0이면 다시 스케일링 적용
            let scaledScore: number;
            if (baseScore >= 0.6 && baseScore <= 0.98) {
                // 이미 스케일링된 값으로 보임
                scaledScore = baseScore;
            } else {
                // UX 보정 공식: 0.6(60%) + (원본점수 * 0.38)
                // 예: 0.1(10%) -> 63.8%, 1.0(100%) -> 98%
                scaledScore = 0.6 + baseScore * 0.38;
            }

            // 🟢 최종적으로 100%를 넘지 않도록 제한
            const finalScore = Math.min(scaledScore, 1.0);
            return Math.round(finalScore * 100);
        }, [course.score]);

        if (selectedCourseId && !isSelected) return null;

        return (
            <div
                className={`group h-[440px] w-full cursor-pointer perspective-1000 transition-all duration-500 ${
                    isSelected ? "scale-105" : "hover:-translate-y-2"
                }`}
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

                    {/* 🟢 [Back]: 보정된 매칭 점수가 적용된 상세 정보 */}
                    <div className="absolute w-full h-full backface-hidden rotate-y-180 rounded-4xl bg-white dark:bg-[#1a241b] shadow-2xl overflow-hidden border border-gray-100 dark:border-gray-800 flex flex-col">
                        <div className="p-7 flex flex-col h-full">
                            <div className="flex justify-between items-start mb-4">
                                <span className="inline-flex items-center px-2.5 py-1 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-[11px] font-black rounded-lg border border-emerald-100 dark:border-emerald-800/50">
                                    {nickname}님 취향 저격 {displayScore}%
                                </span>
                                <Sparkles className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
                            </div>

                            <h3 className="text-2xl font-bold mb-3 text-gray-900 dark:text-white leading-tight tracking-tighter">
                                {course.title}
                            </h3>
                            <p className="text-gray-500 dark:text-gray-400 text-[14px] leading-relaxed mb-6 line-clamp-3">
                                {course.description}
                            </p>

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
                                        {course.duration}
                                    </span>
                                </div>
                            </div>

                            <div className="mt-auto flex gap-2.5">
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedDetailCourse(course);
                                    }}
                                    className="flex-1 py-4 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded-2xl font-bold text-sm hover:bg-gray-200 dark:hover:bg-gray-700 transition-all active:scale-95"
                                >
                                    상세보기
                                </button>
                            </div>
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

    // 트렌딩 코스 (TOP 3) - 성능 최적화: 지연 로딩 및 캐싱
    useEffect(() => {
        // 🟢 성능 최적화: 초기 렌더링 후 1초 지연하여 로드
        const timer = setTimeout(() => {
            (async () => {
                try {
                    const sp = new URLSearchParams();
                    sp.set("limit", "20");
                    sp.set("imagePolicy", "any");
                    // 🟢 성능 최적화: 캐싱 활용
                    const res = await fetch(`/api/courses?${sp.toString()}`, {
                        cache: "force-cache",
                        next: { revalidate: 300 }, // 🟢 5분 캐싱
                    });
                    const data = await res.json().catch(() => null);
                    const list: any[] = Array.isArray(data) ? data : Array.isArray(data?.courses) ? data.courses : [];
                    const norm: TrendingCourse[] = list.map((c: any) => ({
                        id: c.id,
                        title: c.title,
                        imageUrl: c.imageUrl,
                        location: c.location,
                        duration: c.duration,
                        viewCount: Number(c.viewCount ?? c.view_count ?? 0),
                    }));
                    norm.sort((a, b) => (b.viewCount || 0) - (a.viewCount || 0));
                    setTrending(norm.slice(0, 3));
                } catch {}
            })();
        }, 1000); // 🟢 1초 지연
        return () => clearTimeout(timer);
    }, []);

    return (
        <div className="min-h-screen bg-linear-to-b from-emerald-50/20 to-white dark:from-gray-900 dark:to-[#0f1710] font-sans ">
            <style>{gameStyles}</style>
            <div className="flex flex-col items-center justify-center p-4 ">
                {showLogin && <LoginModal onClose={() => setShowLogin(false)} next={pathname} />}
                {showPaywall && <TicketPlans onClose={() => setShowPaywall(false)} />}
                {showCompletionModal && (
                    <CompletionModal isOpen={showCompletionModal} onClose={() => setShowCompletionModal(false)} />
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
                                    {isSelecting ? "처리 중..." : "쿠폰 사용 및 결정"}
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
                        {/* 모달 컨테이너 */}
                        <div className="bg-white/95 dark:bg-[#1a241b]/95 backdrop-blur-md w-full h-full md:h-[85vh] md:w-[600px] md:rounded-[2.5rem] shadow-2xl relative flex flex-col overflow-hidden">
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
                            <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 bg-gray-50/50 dark:bg-gray-900/50">
                                {showUpsell && !showRecommendations && (
                                    <div className="p-4 rounded-2xl bg-linear-to-r from-amber-50 to-orange-50 dark:from-amber-900/30 dark:to-orange-900/30 border border-amber-100 dark:border-amber-800/50 text-sm text-amber-900 dark:text-amber-200 shadow-sm">
                                        <div className="font-bold mb-1 flex items-center gap-2">
                                            <Ticket className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                                            AI 추천 {coupons <= 1 ? "1회 남음" : `${coupons}개 남음`}
                                        </div>
                                        <div className="flex justify-between items-center mt-2">
                                            <span className="text-xs opacity-80 dark:opacity-90">
                                                더 많은 추천이 필요하신가요?
                                            </span>
                                            <button
                                                onClick={() => setShowPaywall(true)}
                                                className="px-3 py-1.5 rounded-lg bg-amber-900 text-white text-xs font-bold hover:bg-amber-800 transition-colors"
                                            >
                                                충전하기
                                            </button>
                                        </div>
                                    </div>
                                )}

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
                                    <div className="mt-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                        <div className="flex justify-between items-center mb-4 px-1">
                                            <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                                                🎁 추천 결과
                                            </h3>
                                        </div>

                                        {recommendedCourses.length > 0 ? (
                                            <div className="grid gap-4 pb-10">
                                                {recommendedCourses.map((course) => (
                                                    <FlipCard key={course.id} course={course} />
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="py-10 text-center text-gray-500 dark:text-gray-400 bg-white dark:bg-[#1a241b] rounded-2xl border border-gray-100 dark:border-gray-800">
                                                <p className="mb-4">
                                                    조건에 맞는 코스를 찾지 못했어요.
                                                    <br />
                                                    쿠폰은 복구되었습니다.
                                                </p>
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

                {attendanceModalOpen && (
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                        <div className="bg-white dark:bg-[#1a241b] rounded-2xl max-w-sm w-full p-6 text-center">
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">출석 체크</h3>
                            <p className="text-gray-600 dark:text-gray-400 mb-3">
                                이번 주 진행도:{" "}
                                <span className="font-semibold text-gray-900 dark:text-white">{weekCount}</span>/7
                            </p>
                            <div className="grid grid-cols-7 gap-2 mb-5">
                                {Array.from({ length: 7 }).map((_, i) => {
                                    const checked = Boolean(weekStamps[i]);
                                    const isToday = typeof todayIndex === "number" && todayIndex === i;
                                    return (
                                        <div key={i} className="flex flex-col items-center gap-1">
                                            <span className="text-[10px] text-gray-400 dark:text-gray-500">
                                                {i + 1}
                                            </span>
                                            <span
                                                className={[
                                                    "w-9 h-9 rounded-full flex items-center justify-center text-base font-semibold transition-all",
                                                    checked
                                                        ? "bg-emerald-500 text-white"
                                                        : "bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400",
                                                    isToday ? "ring-2 ring-emerald-400" : "",
                                                ].join(" ")}
                                            >
                                                {checked ? "🌱" : ""}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                            <div className="flex gap-3 justify-center">
                                <button
                                    onClick={() => setAttendanceModalOpen(false)}
                                    className="px-4 py-2 border rounded-lg text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-700"
                                >
                                    나중에
                                </button>
                                <button
                                    onClick={doHomeCheckin}
                                    disabled={todayChecked}
                                    className={`px-4 py-2 rounded-lg text-white ${
                                        todayChecked
                                            ? "bg-gray-300 cursor-not-allowed"
                                            : "bg-emerald-600 hover:bg-emerald-700"
                                    }`}
                                >
                                    {todayChecked ? "오늘은 완료됨" : "출석 체크 하기"}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                <div className="w-full max-w-4xl flex flex-col mb-6">
                    <div className="bg-white/80 dark:bg-[#1a241b] backdrop-blur-md rounded-4xl p-6 shadow-lg border border-white/50 dark:border-gray-800/50 dark:shadow-gray-900/20">
                        <div className="flex justify-between items-start mb-6">
                            <div>
                                <p className="text-gray-500 dark:text-gray-300 text-sm mb-1 font-medium">
                                    오늘도 즐거운 여행 되세요!
                                </p>
                                <h2 className="text-2xl font-bold text-gray-900 dark:text-white leading-tight">
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
                            <div className="flex flex-col items-end gap-2">
                                <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 overflow-hidden relative">
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

                        <div className="flex items-center gap-2 mb-6">
                            {isUserDataLoading ? (
                                <div className="inline-flex items-center gap-1.5 bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-100">
                                    <div className="w-3.5 h-3.5 bg-gray-200 rounded animate-pulse"></div>
                                    <div className="w-16 h-3.5 bg-gray-200 rounded animate-pulse"></div>
                                </div>
                            ) : isLoggedIn ? (
                                <div className="inline-flex items-center gap-1.5 bg-gray-50 dark:bg-emerald-900/30 px-3 py-1.5 rounded-lg border border-gray-100 dark:border-emerald-800/50 text-xs font-bold text-gray-600 dark:text-emerald-400">
                                    <Ticket className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" />
                                    <span>쿠폰 {coupons}개</span>
                                </div>
                            ) : (
                                <button
                                    onClick={() => setShowLogin(true)}
                                    className="inline-flex items-center gap-1.5 bg-emerald-50 dark:bg-emerald-900/30 px-3 py-1.5 rounded-lg border border-emerald-100 dark:border-emerald-800/50 text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition-colors"
                                >
                                    <span>로그인하고 혜택받기</span>
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                <div className="w-full max-w-4xl flex flex-col relative min-h-[600px]">
                    {trending.length > 0 && (
                        <div className="mb-6">
                            <div className="flex items-center justify-between px-1 mb-2">
                                <h3 className="text-sm font-extrabold text-gray-900">요즘 뜨는 코스 TOP 3</h3>
                                <Link href="/nearby" className="text-xs text-gray-500 hover:text-gray-700">
                                    더 보기
                                </Link>
                            </div>
                            <div className="flex gap-3 overflow-x-auto no-scrollbar -mx-1 px-1">
                                {trending.map((t) => (
                                    <Link
                                        key={String(t.id)}
                                        href={`/courses/${t.id}`}
                                        prefetch={true}
                                        className="shrink-0 w-[210px] rounded-xl bg-white border border-gray-100 hover:shadow-sm transition-all"
                                    >
                                        <div className="relative w-full aspect-4/3 rounded-t-xl overflow-hidden bg-gray-100">
                                            <Image
                                                src={t.imageUrl || ""}
                                                alt={t.title}
                                                fill
                                                className="object-cover"
                                                sizes="210px"
                                                quality={70}
                                            />
                                        </div>
                                        <div className="p-3">
                                            <div className="text-[13px] text-gray-500 mb-1 line-clamp-1">
                                                {(t.location || "").toString()} {t.duration ? `· ${t.duration}` : ""}
                                            </div>
                                            <div className="text-sm font-bold text-gray-900 line-clamp-2">
                                                {t.title}
                                            </div>
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        </div>
                    )}

                    <main className="flex-1 overflow-y-auto rounded-3xl relative">
                        {/* 👇 [수정됨] 시작 화면 UI: 고급스러운 AI 컨시어지 스타일 */}
                        <div className="h-full flex flex-col items-center justify-center text-center p-8 bg-white/80 dark:bg-[#1a241b] backdrop-blur-xl rounded-3xl border border-white/60 dark:border-gray-800/50 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-gray-900/30 min-h-[400px]">
                            {/* 1. 아이콘 영역 */}
                            <div className="relative mb-8 group">
                                <div className="absolute inset-0 bg-emerald-200 rounded-4xl blur-2xl opacity-30 group-hover:opacity-50 transition-opacity duration-700"></div>

                                <div className="relative w-28 h-28 bg-linear-to-br from-white to-emerald-50 rounded-[2.5rem] border border-white/80 shadow-2xl flex items-center justify-center transform transition-transform duration-500 hover:scale-105">
                                    <Sparkles className="w-12 h-12 text-emerald-600 drop-shadow-sm" />

                                    <span className="absolute top-6 right-6 flex h-3 w-3">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                                    </span>
                                </div>
                            </div>

                            {/* 2. 타이포그래피 */}
                            <h2 className="text-[26px] font-extrabold text-gray-900 dark:text-white mb-4 tracking-tight leading-snug">
                                AI 두나의 <br />
                                <span className="text-transparent bg-clip-text bg-linear-to-r from-emerald-600 to-teal-600 dark:from-emerald-400 dark:to-teal-400">
                                    프라이빗 코스 설계
                                </span>
                            </h2>
                            <p className="text-gray-500 dark:text-gray-300 text-[15px] leading-relaxed mb-10 max-w-[260px] mx-auto">
                                복잡한 검색은 그만하세요.
                                <br />
                                취향 데이터를 분석해{" "}
                                <span className="font-semibold text-gray-700 dark:text-white">실패 없는 하루</span>
                                를<br />
                                지금 바로 계획해 드립니다.
                            </p>

                            {/* 3. 버튼 */}
                            <button
                                onClick={startConversation} // 모달 오픈 함수 호출
                                className="group relative px-8 py-4 w-full max-w-[280px] bg-gray-900 text-white rounded-2xl font-bold text-[17px] shadow-lg shadow-emerald-900/20 transition-all hover:-translate-y-1 hover:shadow-2xl overflow-hidden"
                            >
                                <div className="absolute inset-0 bg-linear-to-r from-emerald-500 via-teal-500 to-emerald-600 opacity-100 bg-size-[200%_auto] animate-[gradient_3s_ease_infinite]"></div>

                                <div className="relative flex items-center justify-center gap-2">
                                    <span>내 취향 분석 시작하기</span>
                                    <ChevronRight className="w-5 h-5 text-white/90 group-hover:translate-x-1 transition-transform" />
                                </div>
                            </button>

                            <div className="mt-6 flex items-center gap-1.5 opacity-60">
                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                                <p className="text-[11px] text-gray-400 dark:text-gray-500 font-medium tracking-wide uppercase">
                                    Powered by DoNa AI Engine
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
