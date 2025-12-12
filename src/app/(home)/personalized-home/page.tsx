"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import Image from "@/components/ImageFallback";
import { fetchWeekStamps, postCheckin } from "@/lib/checkinClient";
// 👇 새로 만든 예쁜 모달 import 확인
import TicketPlans from "@/components/TicketPlans";
import {
    Sparkles,
    MapPin,
    Clock,
    Users,
    Star,
    Ticket,
    CheckCircle,
    XCircle,
    User,
    MessageCircle,
    RefreshCw,
    ChevronRight,
    Crown, // Crown 아이콘 import 추가
} from "lucide-react";

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
        text: "좋아요! ✨\n\n지금까지 답변을 분석해보니,\n당신에게 딱 맞는 코스를 최대 2가지로 좁힐 수 있을 것 같아요.\n\nAI 맞춤 코스 추천은\n쿠폰 1개로 이용할 수 있어요 💡\n\n계속해서 추천 받아볼까요?",
        options: [
            { text: "네, 추천 받을게요! 🎉", value: "yes", next: "complete" },
            { text: "나중에 할게요", value: "no", next: "greeting" },
        ],
    },
];

const AIRecommender = () => {
    // 상태 관리
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [userName, setUserName] = useState("");
    const [nickname, setNickname] = useState("");
    const [profileImageUrl, setProfileImageUrl] = useState<string | null>(null);
    const [coupons, setCoupons] = useState(0);
    const [showLogin, setShowLogin] = useState(false);
    const [showPaywall, setShowPaywall] = useState(false);
    const [attendanceModalOpen, setAttendanceModalOpen] = useState(false);
    const [weekStamps, setWeekStamps] = useState<boolean[]>([false, false, false, false, false, false, false]);
    const [todayIndex, setTodayIndex] = useState<number | null>(null);
    const [todayChecked, setTodayChecked] = useState(false);
    const [weekCount, setWeekCount] = useState(0);

    const [messages, setMessages] = useState<Message[]>([]);
    const [currentQuestion, setCurrentQuestion] = useState<Question>(questionFlow[0]);
    const [userAnswers, setUserAnswers] = useState<Record<string, string>>({});
    const [recommendedCourses, setRecommendedCourses] = useState<Course[]>([]);
    const [isTyping, setIsTyping] = useState(false);
    const [showRecommendations, setShowRecommendations] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [conversationStarted, setConversationStarted] = useState(false);
    const [progress, setProgress] = useState(0);
    const [showUpsell, setShowUpsell] = useState(false);
    const [netError, setNetError] = useState<string | null>(null);
    const [isUsingCoupon, setIsUsingCoupon] = useState(false); // 쿠폰 차감 중복 방지

    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, isTyping]);

    // 유저 정보 가져오기
    const fetchUserData = async () => {
        const token = localStorage.getItem("authToken");
        if (!token) {
            setIsLoggedIn(false);
            setUserName("");
            setNickname("");
            setProfileImageUrl(null);
            setCoupons(0);
            return;
        }

        try {
            const res = await fetch("/api/users/profile", {
                headers: { Authorization: `Bearer ${token}` },
                cache: "no-store",
            });

            if (res.ok) {
                const userData = await res.json();
                setIsLoggedIn(true);
                const nick = userData.nickname || userData.name || userData.email?.split("@")[0] || "사용자";
                setUserName(nick);
                setNickname(nick);
                setProfileImageUrl(userData.profileImage || userData.user?.profileImage || null);
                setCoupons(userData.couponCount || 0);
                localStorage.setItem("user", JSON.stringify(userData));
            } else {
                handleLogout();
            }
        } catch (error) {
            console.error("사용자 정보 조회 오류:", error);
            setIsLoggedIn(false);
        }
    };

    // 로그인 상태 확인
    useEffect(() => {
        const checkLoginStatus = () => {
            const token = localStorage.getItem("authToken");
            if (token) {
                fetchUserData();
            } else {
                setIsLoggedIn(false);
                setUserName("");
                setNickname("");
                setProfileImageUrl(null);
                setCoupons(0);
            }
        };

        checkLoginStatus();

        const handleStorageChange = (e: StorageEvent) => {
            if (e.key === "authToken" || e.key === "user") {
                checkLoginStatus();
            }
        };

        const handleCustomStorageChange = () => {
            checkLoginStatus();
        };

        window.addEventListener("storage", handleStorageChange);
        window.addEventListener("authTokenChange", handleCustomStorageChange);

        return () => {
            window.removeEventListener("storage", handleStorageChange);
            window.removeEventListener("authTokenChange", handleCustomStorageChange);
        };
    }, []);

    // 출석 정보 가져오기
    useEffect(() => {
        if (!isLoggedIn) return;
        const fetchCheckins = async () => {
            try {
                const res = await fetchWeekStamps();
                if (!res) return;
                setWeekStamps(res.stamps);
                setTodayIndex(typeof res.todayIndex === "number" ? res.todayIndex : null);
                setTodayChecked(Boolean(res.todayChecked));
                if (typeof res.weekCount === "number") setWeekCount(res.weekCount);
            } catch (error) {
                console.error("출석 정보 조회 오류:", error);
            }
        };

        fetchCheckins();
    }, [isLoggedIn]);

    // 출석 체크
    const doHomeCheckin = async () => {
        try {
            const result = await postCheckin();
            if (result.ok && result.success) {
                await fetchUserData();
                if (Array.isArray(result.weekStamps) && result.weekStamps.length === 7) {
                    setWeekStamps(result.weekStamps);
                } else if (typeof result.todayIndex === "number") {
                    setWeekStamps((prev) => prev.map((v, i) => (i === result.todayIndex ? true : v)));
                } else {
                    const now = new Date();
                    const day = now.getDay();
                    const idx = (day + 6) % 7;
                    setWeekStamps((prev) => prev.map((v, i) => (i === idx ? true : v)));
                }
                if (typeof result.todayIndex === "number" || result.todayIndex === null) {
                    setTodayIndex(result.todayIndex ?? null);
                }
                setTodayChecked(true);
                if (typeof result.weekCount === "number") setWeekCount(result.weekCount);
                setAttendanceModalOpen(false);

                if (result.awarded) {
                    alert(`출석 7회 달성! 쿠폰 ${result.rewardAmount || 1}개가 지급되었습니다.`);
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
        setConversationStarted(false);
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
    };

    const startConversation = () => {
        if (!conversationStarted) {
            setMessages([{ type: "ai", text: currentQuestion.text }]);
            setConversationStarted(true);
        }
        setTimeout(() => {
            messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
        }, 100);
    };

    // 쿠폰 사용 API
    const useCoupon = async (): Promise<boolean> => {
        if (isUsingCoupon) return false;

        const token = localStorage.getItem("authToken");
        if (!token) {
            setShowLogin(true);
            return false;
        }

        setIsUsingCoupon(true);

        try {
            const response = await fetch("/api/ai-recommendation/use-ticket", {
                method: "POST",
                headers: { Authorization: `Bearer ${token}` },
            });

            if (response.ok) {
                const data = await response.json();
                setCoupons(data.ticketsRemaining);
                setIsUsingCoupon(false);
                return true;
            } else {
                const errorData = await response.json();
                setIsUsingCoupon(false);
                if (response.status === 400) {
                    setShowPaywall(true);
                } else {
                    alert(errorData.message || "쿠폰 사용 오류");
                    setNetError("네트워크 오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
                }
                return false;
            }
        } catch (error) {
            console.error("쿠폰 사용 API 오류:", error);
            setIsUsingCoupon(false);
            alert("네트워크 오류");
            setNetError("네트워크 오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
            return false;
        }
    };

    // 쿠폰 환불 API
    const refundCoupon = async (): Promise<void> => {
        const token = localStorage.getItem("authToken");
        if (!token) return;

        try {
            const response = await fetch("/api/ai-recommendation/refund", {
                method: "POST",
                headers: { Authorization: `Bearer ${token}` },
            });

            if (response.ok) {
                const data = await response.json();
                setCoupons(data.ticketsRemaining);
            } else {
                setNetError("네트워크 오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
            }
        } catch (error) {
            console.error("쿠폰 환불 API 오류:", error);
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
                setIsTyping(true);
                setIsGenerating(true);
                setShowRecommendations(true);

                setTimeout(async () => {
                    setIsTyping(false);
                    await generateRecommendations(userAnswers);
                    setIsGenerating(false);
                }, 600);
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

    // 추천 생성
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
                score: c.viewCount || c.view_count || 0,
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
                goal,
                companion_today: companionToday,
                mood_today: moodToday,
                region_today: regionToday,
                limit: "2",
                strict: "true", // 🚩 쿠폰 사용 시 지역 강제 필터링 적용
            }).toString();

            const res = await fetch(`/api/recommendations?${params}`, {
                headers: token ? { Authorization: `Bearer ${token}` } : {},
                cache: "no-store",
            });

            if (res.ok) {
                const data = await res.json();
                if (data.recommendations && Array.isArray(data.recommendations)) {
                    list = buildList(data.recommendations);
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
        setShowRecommendations(true);

        setMessages((prev) => [
            ...prev,
            {
                type: "ai",
                text:
                    list.length > 0
                        ? `완벽해요! 🎉 ${nickname}님의 취향을 분석해 ${
                              list.length === 1 ? "1가지" : "2가지"
                          } 코스를 찾았어요!`
                        : hadNetworkError
                        ? `네트워크 오류로 추천을 가져오지 못했어요. 쿠폰은 복구해드렸습니다. 잠시 후 다시 시도해 주세요.`
                        : `조건에 맞는 코스를 찾지 못했어요. 사용하신 쿠폰은 바로 복구해드렸습니다. 다른 조건으로 다시 시도해볼까요?`,
            },
        ]);
    };

    const handleResetAndRecommend = async () => {
        resetConversation();
    };

    const [loginNavigating, setLoginNavigating] = useState(false);
    const [authLoading, setAuthLoading] = useState(false);

    const LoginModal = () => (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-[28px] max-w-md w-full p-7 relative shadow-2xl">
                <button
                    onClick={() => setShowLogin(false)}
                    aria-label="닫기"
                    className="absolute top-4 right-4 w-9 h-9 rounded-full bg-gray-100 text-gray-500 hover:text-gray-700 hover:bg-gray-200 transition-colors flex items-center justify-center active:scale-95"
                >
                    x
                </button>

                <div className="text-center mb-5">
                    <div className="w-20 h-20 rounded-full bg-emerald-500/90 mx-auto mb-4 flex items-center justify-center shadow-md">
                        <User className="w-9 h-9 text-white" />
                    </div>
                    <h2 className="text-[22px] font-extrabold text-gray-900 mb-1">로그인하고 AI 추천받기</h2>
                    <p className="text-gray-600 text-sm">로그인하면 무료 쿠폰 2개를 드려요! 🎁</p>
                </div>

                <button
                    onClick={() => {
                        if (loginNavigating) return;
                        setLoginNavigating(true);
                        try {
                            sessionStorage.setItem("auth:loggingIn", "1");
                            setAuthLoading(true);
                            const next = pathname || "/personalized-home";
                            router.push(`/login?next=${encodeURIComponent(next)}`);
                        } catch {
                            window.location.href = "/login";
                        }
                    }}
                    disabled={loginNavigating}
                    className={`w-full py-3.5 rounded-xl text-white font-extrabold shadow-sm transition-colors active:scale-95 ${
                        loginNavigating ? "bg-emerald-400 cursor-not-allowed" : "bg-emerald-600 hover:bg-emerald-700"
                    }`}
                >
                    {loginNavigating ? "이동 중..." : "로그인 하러 가기"}
                </button>

                <div className="mt-6 p-5 rounded-xl bg-emerald-50">
                    <h4 className="font-extrabold text-emerald-700 mb-2 text-sm">로그인 혜택</h4>
                    <ul className="text-[13px] text-emerald-700 space-y-2">
                        <li className="flex items-center">
                            <CheckCircle className="w-4 h-4 mr-2 text-emerald-500" /> AI 추천 무료 쿠폰 2개
                        </li>
                        <li className="flex items-center">
                            <CheckCircle className="w-4 h-4 mr-2 text-emerald-500" /> 개인 맞춤 추천 서비스
                        </li>
                        <li className="flex items-center">
                            <CheckCircle className="w-4 h-4 mr-2 text-emerald-500" /> 코스 예약 할인 혜택
                        </li>
                    </ul>
                </div>
            </div>
        </div>
    );

    const CourseCard = ({ course }: { course: Course }) => (
        <a
            href={`/courses/${course.id}`}
            className="block bg-white rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.05)] overflow-hidden transform hover:-translate-y-2 transition-transform duration-300 border border-gray-100"
        >
            <div className="p-6 flex flex-col h-full">
                {/* 1. 타이틀 */}
                <h3 className="text-xl font-bold mb-3 text-gray-900 leading-snug">{course.title}</h3>

                {/* 2. 설명 */}
                <p
                    className="text-gray-600 text-sm mb-6 leading-relaxed"
                    style={{
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                    }}
                >
                    {course.description}
                </p>

                {/* 3. 구분선 */}
                <div className="border-t border-gray-100 w-full mb-5"></div>

                {/* 4. 상세 정보 (녹색 테마 적용) */}
                <div className="space-y-3 mb-6">
                    <div className="flex items-center text-sm text-gray-700">
                        {/* 아이콘 컬러를 녹색(green-500 혹은 emerald-500)으로 변경 */}
                        <MapPin className="w-4 h-4 mr-3 text-emerald-500 shrink-0" />
                        <span>{course.location}</span>
                    </div>

                    {course.duration && (
                        <div className="flex items-center text-sm text-gray-700">
                            <Clock className="w-4 h-4 mr-3 text-emerald-500 shrink-0" />
                            <span>{course.duration}</span>
                        </div>
                    )}

                    <div className="flex items-center text-sm text-gray-700">
                        <Users className="w-4 h-4 mr-3 text-emerald-500 shrink-0" />
                        <span>{course.participants}명 참여</span>
                    </div>

                    <div className="flex items-center text-sm text-gray-700">
                        {/* 별점은 노란색 유지하되 조금 더 부드럽게 */}
                        <Star className="w-4 h-4 mr-3 text-yellow-400 shrink-0 fill-yellow-400" />
                        <span className="font-bold mr-1">{course.rating}</span>
                        <span className="text-gray-400">({course.reviewCount}개 리뷰)</span>
                    </div>
                </div>

                {/* 5. 하단 버튼 (두나 시그니처 그린 적용) */}
                <div className="mt-auto flex justify-end">
                    <span className="px-6 py-2.5 bg-emerald-500 text-white rounded-lg font-bold text-sm hover:bg-emerald-600 hover:shadow-lg transition-all cursor-pointer">
                        자세히 보기
                    </span>
                </div>
            </div>
        </a>
    );

    const router = useRouter();
    const pathname = usePathname();

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

    // 트렌딩 코스 (TOP 3)
    const [trending, setTrending] = useState<TrendingCourse[]>([]);
    useEffect(() => {
        (async () => {
            try {
                const sp = new URLSearchParams();
                sp.set("limit", "20");
                sp.set("nocache", "1");
                sp.set("imagePolicy", "any");
                const res = await fetch(`/api/courses?${sp.toString()}`, { cache: "no-store" });
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
    }, []);

    return (
        <div className="min-h-screen bg-gradient-to-b from-emerald-50/20 to-white font-sans ">
            <div className="flex flex-col items-center justify-center p-4 ">
                {showLogin && <LoginModal />}
                {/* 👇 [수정됨] 외부 컴포넌트 사용 */}
                {showPaywall && <TicketPlans onClose={() => setShowPaywall(false)} />}

                {attendanceModalOpen && (
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                        <div className="bg-white rounded-2xl max-w-sm w-full p-6 text-center">
                            <h3 className="text-lg font-bold text-gray-900 mb-2">출석 체크</h3>
                            <p className="text-gray-600 mb-3">
                                이번 주 진행도: <span className="font-semibold text-gray-900">{weekCount}</span>/7
                            </p>
                            <div className="grid grid-cols-7 gap-2 mb-5">
                                {Array.from({ length: 7 }).map((_, i) => {
                                    const checked = Boolean(weekStamps[i]);
                                    const isToday = typeof todayIndex === "number" && todayIndex === i;
                                    return (
                                        <div key={i} className="flex flex-col items-center gap-1">
                                            <span className="text-[10px] text-gray-400">{i + 1}</span>
                                            <span
                                                className={[
                                                    "w-9 h-9 rounded-full flex items-center justify-center text-base font-semibold transition-all",
                                                    checked ? "bg-emerald-500 text-white" : "bg-gray-200 text-gray-600",
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
                                    className="px-4 py-2 border rounded-lg text-gray-700"
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
                    <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-gray-100">
                        <div className="flex justify-between items-start mb-6">
                            <div>
                                <p className="text-gray-500 text-sm mb-1 font-medium">오늘도 즐거운 여행 되세요!</p>
                                <h2 className="text-2xl font-bold text-gray-900 leading-tight">
                                    {isLoggedIn ? (
                                        <>
                                            안녕하세요, <br />
                                            <span className="text-emerald-600">{nickname}님</span> 👋
                                        </>
                                    ) : (
                                        <>
                                            로그인이 <br />
                                            <span className="text-emerald-600">필요해요</span> 👋
                                        </>
                                    )}
                                </h2>
                            </div>
                            <div className="flex flex-col items-end gap-2">
                                <div className="w-12 h-12 rounded-full bg-gray-100 border border-gray-200 overflow-hidden relative">
                                    <img
                                        src={
                                            profileImageUrl ||
                                            "https://stylemap-seoul.s3.ap-northeast-2.amazonaws.com/profileLogo.png"
                                        }
                                        alt="프로필"
                                        className="w-full h-full object-cover"
                                    />
                                </div>
                                {isLoggedIn && (
                                    <button
                                        onClick={handleLogout}
                                        className="text-xs text-gray-400 underline hover:text-gray-600"
                                    >
                                        로그아웃
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="flex items-center gap-2 mb-6">
                            {isLoggedIn ? (
                                <div className="inline-flex items-center gap-1.5 bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-100 text-xs font-bold text-gray-600">
                                    <Ticket className="w-3.5 h-3.5 text-emerald-500" />
                                    <span>쿠폰 {coupons}개</span>
                                </div>
                            ) : (
                                <button
                                    onClick={() => setShowLogin(true)}
                                    className="inline-flex items-center gap-1.5 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-100 text-xs font-bold text-emerald-600 hover:bg-emerald-100 transition-colors"
                                >
                                    <span>로그인하고 혜택받기</span>
                                </button>
                            )}
                        </div>

                        <div
                            onClick={startConversation}
                            className="bg-emerald-50 rounded-2xl p-5 flex items-center justify-between cursor-pointer hover:bg-emerald-100 transition-colors group"
                        >
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-sm text-xl group-hover:scale-110 transition-transform">
                                    🤖
                                </div>
                                <div>
                                    <div className="flex items-center gap-1.5 mb-0.5">
                                        <h3 className="font-bold text-gray-900 text-[15px]">두나의 AI 코스 추천</h3>
                                        <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                                    </div>
                                    <p className="text-xs text-emerald-700 font-medium">
                                        만족도 <span className="font-bold text-emerald-600">98.7%</span> 코스 보기
                                    </p>
                                </div>
                            </div>
                            <div className="text-gray-400 group-hover:translate-x-1 transition-transform">
                                <ChevronRight className="w-5 h-5" />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="w-full max-w-4xl flex flex-col">
                    {!conversationStarted && trending.length > 0 && (
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
                                        className="shrink-0 w-[210px] rounded-xl bg-white border border-gray-100 hover:shadow-sm transition-all"
                                    >
                                        <div className="relative w-full aspect-[4/3] rounded-t-xl overflow-hidden bg-gray-100">
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

                    <main className="flex-1 overflow-y-auto rounded-3xl">
                        {conversationStarted && !showRecommendations && (
                            <div className="sticky top-0 z-10 p-3">
                                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-500"
                                        style={{ width: `${progress}%` }}
                                    />
                                </div>
                                <div className="mt-2 flex items-center justify-center gap-2 text-xs text-gray-600">
                                    {[0, 25, 50, 75, 100].map((v) => (
                                        <span
                                            key={v}
                                            className={`inline-block w-2 h-2 rounded-full ${
                                                progress >= v ? "bg-purple-600" : "bg-gray-300"
                                            }`}
                                        />
                                    ))}
                                    <span className="ml-2">{progress}%</span>
                                </div>
                            </div>
                        )}
                        {!conversationStarted && (
                            <div className="h-full flex flex-col items-center justify-center text-center p-6 bg-white/10 rounded-3xl border border-white/10">
                                <button
                                    onClick={startConversation}
                                    className="cursor-pointer px-7 py-3 bg-emerald-500 text-white rounded-xl font-bold text-base shadow-sm hover:bg-emerald-600 transition-all transform active:scale-95 flex items-center mx-auto"
                                >
                                    <MessageCircle className="w-5 h-5 mr-2.5 text-white/90" />
                                    AI 추천 시작하기
                                </button>
                                <p className="text-gray-600 mt-4">몇 가지 질문에 답하면</p>
                                <p className="text-gray-600">완벽한 코스를 찾아드려요!</p>
                            </div>
                        )}

                        {conversationStarted && (
                            <div className="bg-white/95 rounded-3xl shadow-xl p-4 sm:p-6 h-full flex flex-col max-h-[600px]">
                                {showUpsell && !showRecommendations && (
                                    <div className="mb-3 p-3 rounded-xl bg-gradient-to-r from-amber-50 to-pink-50 border border-amber-200 text-[13px] text-gray-800">
                                        <div className="font-semibold mb-1">
                                            🔑 AI 추천 {coupons <= 1 ? "1회 남음" : `${coupons}개 남음`}
                                        </div>
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span>프리미엄으로 업그레이드하면 무제한 추천!</span>
                                            <button
                                                onClick={() => setShowPaywall(true)}
                                                className="px-2 py-1 rounded-lg bg-black text-white text-xs cursor-pointer"
                                            >
                                                업그레이드
                                            </button>
                                        </div>
                                    </div>
                                )}
                                <div className="flex-grow overflow-y-auto pr-2 space-y-6">
                                    {messages.map((message, index) => (
                                        <div
                                            key={index}
                                            className={`flex items-end gap-2 ${
                                                message.type === "user" ? "justify-end" : "justify-start"
                                            }`}
                                        >
                                            {message.type === "ai" && (
                                                <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0">
                                                    <img
                                                        src="https://stylemap-seoul.s3.ap-northeast-2.amazonaws.com/logo/donalogo_512.png"
                                                        alt="DoNa"
                                                        className="w-full h-full object-cover"
                                                    />
                                                </div>
                                            )}
                                            <div
                                                className={`max-w-sm px-5 py-3 rounded-2xl ${
                                                    message.type === "user"
                                                        ? "bg-[#2A3B5F] text-white shadow-lg rounded-br-none"
                                                        : "bg-gray-100 text-gray-800 rounded-bl-none"
                                                }`}
                                            >
                                                {message.text}
                                            </div>
                                        </div>
                                    ))}

                                    {isTyping && (
                                        <div className="flex items-end gap-2 justify-start">
                                            <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0">
                                                <img
                                                    src="https://stylemap-seoul.s3.ap-northeast-2.amazonaws.com/logo/donalogo_512.png"
                                                    alt="DoNa"
                                                    className="w-full h-full object-cover"
                                                />
                                            </div>
                                            <div className="bg-emerald-50 border border-emerald-100 px-5 py-4 rounded-2xl rounded-bl-none">
                                                <div className="flex space-x-1.5">
                                                    <div className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce"></div>
                                                    <div
                                                        className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce"
                                                        style={{ animationDelay: "150ms" }}
                                                    ></div>
                                                    <div
                                                        className="w-2 h-2 bg-emerald-600 rounded-full animate-bounce"
                                                        style={{ animationDelay: "300ms" }}
                                                    ></div>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                    <div ref={messagesEndRef} />
                                </div>

                                {!isTyping && !showRecommendations && currentQuestion.options && (
                                    <div className="flex-shrink-0 border-t border-emerald-100 mt-4 pt-4">
                                        <div className="flex flex-wrap gap-3">
                                            {currentQuestion.options.map((option, index) => (
                                                <button
                                                    key={index}
                                                    onClick={() => handleAnswer(option)}
                                                    className="cursor-pointer px-5 py-2.5 bg-emerald-50 border-2 border-emerald-200 text-emerald-700 rounded-full font-semibold hover:bg-emerald-100 hover:border-emerald-300 transition-all active:scale-95"
                                                >
                                                    {option.text}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {showRecommendations && (
                            <div className="overflow-y-auto h-full text-black">
                                {isGenerating ? (
                                    <div className="py-16 text-center text-gray-600">맞춤 코스를 생성 중입니다...</div>
                                ) : recommendedCourses.length > 0 ? (
                                    <>
                                        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6 p-2">
                                            {recommendedCourses.map((course) => (
                                                <CourseCard key={course.id} course={course} />
                                            ))}
                                        </div>
                                        <div className="text-center pb-6">
                                            <button
                                                onClick={handleResetAndRecommend}
                                                className="cursor-pointer px-6 py-3 bg-white border-2 border-[#2A3B5F] text-[#1E2A44] rounded-2xl font-bold text-base hover:bg-white transition-all transform hover:scale-105 active:scale-95 flex items-center mx-auto"
                                            >
                                                <RefreshCw className="w-5 h-5 mr-2" />
                                                다른 추천 받기
                                            </button>
                                        </div>
                                    </>
                                ) : (
                                    <div className="py-16 text-center text-gray-700">
                                        조건에 맞는 코스를 찾지 못했어요. 사용하신 쿠폰은 복구되었습니다.
                                        <div className="mt-4">
                                            <button
                                                onClick={resetConversation}
                                                className="cursor-pointer px-6 py-3 bg-white border-2 border-[#2A3B5F] text-[#1E2A44] rounded-2xl font-bold text-base"
                                            >
                                                다른 조건으로 다시 시도
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </main>
                </div>
            </div>
            <div className="md:hidden h-20"></div>
        </div>
    );
};

export default AIRecommender;
