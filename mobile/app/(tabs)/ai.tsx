/**
 * AI 추천 화면
 * 웹 src/app/(home)/personalized-home/page.tsx 기반
 * — 랜딩 히어로 + 채팅 전체화면 모달
 */
import React, { useState, useRef, useEffect } from "react";
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Image,
    Modal,
    Animated,
    Pressable,
    Dimensions,
    InteractionManager,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { api, ApiError } from "../../src/lib/api";
import { resolveImageUrl } from "../../src/lib/imageUrl";
import { useAuth } from "../../src/hooks/useAuth";
import AppHeaderWithModals from "../../src/components/AppHeaderWithModals";
import { useThemeColors } from "../../src/hooks/useThemeColors";
import TicketPlansSheet from "../../src/components/TicketPlansSheet";
import type { Course } from "../../src/types/api";

// ─── 한도 초과 바텀시트 ────────────────────────────────────────────────────────

type LimitCtx = { tier: "FREE" | "BASIC" | "PREMIUM"; limit: number | null; used: number };

function LimitExceededSheet({
    visible,
    ctx,
    onClose,
    onUpgrade,
}: {
    visible: boolean;
    ctx: LimitCtx | null;
    onClose: () => void;
    onUpgrade: () => void;
}) {
    const t = useThemeColors();
    const insets = useSafeAreaInsets();
    const slideAnim = useRef(new Animated.Value(400)).current;

    useEffect(() => {
        if (visible) {
            Animated.spring(slideAnim, {
                toValue: 0,
                useNativeDriver: true,
                tension: 65,
                friction: 11,
            }).start();
        } else {
            slideAnim.setValue(400);
        }
    }, [visible]);

    if (!visible || !ctx) return null;

    const isBasic = ctx.tier === "BASIC";
    const title = isBasic ? "오늘 5번 모두 사용했어요" : "오늘의 추천을 이미 사용했어요";
    const desc = isBasic
        ? "베이직은 하루 5번까지 가능해요.\n프리미엄으로 업그레이드하면 무제한이에요."
        : "무료는 하루 1번만 가능해요.\n베이직으로 업그레이드하면 하루 5번까지 이용할 수 있어요.";
    const btnLabel = isBasic ? "프리미엄으로 업그레이드 (무제한)" : "베이직으로 업그레이드 (하루 5번)";

    return (
        <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
            <Pressable style={ls.backdrop} onPress={onClose} />
            <Animated.View
                style={[
                    ls.sheet,
                    { backgroundColor: t.card, paddingBottom: insets.bottom + 16 },
                    { transform: [{ translateY: slideAnim }] },
                ]}
            >
                {/* 핸들바 */}
                <View style={ls.handle} />

                {/* 아이콘 */}
                <View style={ls.iconWrap}>
                    <Text style={{ fontSize: 36 }}>⏰</Text>
                </View>

                {/* 텍스트 */}
                <Text style={[ls.title, { color: t.text }]}>{title}</Text>
                <Text style={[ls.desc, { color: t.textMuted }]}>{desc}</Text>

                {/* 버튼 */}
                <TouchableOpacity
                    style={ls.upgradeBtn}
                    onPress={() => { onClose(); onUpgrade(); }}
                    activeOpacity={0.88}
                >
                    <Text style={ls.upgradeBtnText}>{btnLabel}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={ls.closeBtn} onPress={onClose} activeOpacity={0.7}>
                    <Text style={[ls.closeBtnText, { color: t.textMuted }]}>닫기</Text>
                </TouchableOpacity>
            </Animated.View>
        </Modal>
    );
}

const ls = StyleSheet.create({
    backdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: "rgba(0,0,0,0.55)",
    },
    sheet: {
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        paddingHorizontal: 24,
        paddingTop: 12,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.15,
        shadowRadius: 20,
        elevation: 20,
    },
    handle: {
        width: 40,
        height: 4,
        borderRadius: 2,
        backgroundColor: "#d1d5db",
        alignSelf: "center",
        marginBottom: 20,
    },
    iconWrap: {
        alignSelf: "center",
        width: 64,
        height: 64,
        borderRadius: 20,
        backgroundColor: "#fef3c7",
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 16,
    },
    title: {
        fontSize: 20,
        fontWeight: "800",
        textAlign: "center",
        marginBottom: 10,
        letterSpacing: -0.3,
    },
    desc: {
        fontSize: 14,
        textAlign: "center",
        lineHeight: 22,
        marginBottom: 28,
    },
    upgradeBtn: {
        backgroundColor: "#059669",
        borderRadius: 16,
        paddingVertical: 16,
        alignItems: "center",
        marginBottom: 10,
    },
    upgradeBtnText: {
        color: "#fff",
        fontSize: 15,
        fontWeight: "700",
    },
    closeBtn: {
        paddingVertical: 12,
        alignItems: "center",
    },
    closeBtnText: {
        fontSize: 14,
        fontWeight: "600",
    },
});

const DONA_LOGO = "https://d13xx6k6chk2in.cloudfront.net/logo/donalogo_512.png";
const DEFAULT_PROFILE = "https://d13xx6k6chk2in.cloudfront.net/profileLogo.png";

// ─── 질문 플로우 ──────────────────────────────────────────────────────────────

type Option = { text: string; value: string; next: string };
type Question = { id: string; text: string; options: Option[] };

const FLOW: Question[] = [
    {
        id: "greeting",
        text: "안녕하세요! 오늘도 두나와 함께 특별한 데이트를 만들어볼까요? 🌿",
        options: [
            { text: "✨ 코스 추천받기", value: "start", next: "purpose_today" },
            { text: "👀 코스 미리보기", value: "preview", next: "preview" },
        ],
    },
    {
        id: "preview",
        text: "어떤 분위기의 코스를 원하세요? 먼저 목적을 알려주세요 😊",
        options: [{ text: "코스 추천 시작하기 →", value: "start", next: "purpose_today" }],
    },
    {
        id: "purpose_today",
        text: "오늘 데이트의 목적은 무엇인가요?",
        options: [
            { text: "🎉 기념일", value: "기념일", next: "goal_detail" },
            { text: "😊 무난한 데이트", value: "무난", next: "companion_today" },
            { text: "🌙 감성적인 데이트", value: "감성", next: "companion_today" },
            { text: "🏃 활동적인 데이트", value: "활동", next: "companion_today" },
            { text: "✨ 트렌디한 데이트", value: "트렌디", next: "companion_today" },
        ],
    },
    {
        id: "goal_detail",
        text: "어떤 기념일인가요?",
        options: [
            { text: "💑 100일·연애기념일", value: "100일", next: "companion_today" },
            { text: "🎂 생일", value: "생일", next: "companion_today" },
            { text: "🎄 연말·특별한 날", value: "연말", next: "companion_today" },
        ],
    },
    {
        id: "companion_today",
        text: "누구와 함께하나요?",
        options: [
            { text: "💑 연인", value: "연인", next: "region_today" },
            { text: "💌 썸 상대", value: "썸 상대", next: "region_today" },
            { text: "🤝 소개팅 상대", value: "소개팅 상대", next: "region_today" },
            { text: "👯 친구", value: "친구", next: "region_today" },
            { text: "🚶 혼자", value: "혼자", next: "region_today" },
        ],
    },
    {
        id: "region_today",
        text: "어느 지역이 좋으세요?",
        options: [
            { text: "🏭 문래·영등포", value: "문래·영등포", next: "complete" },
            { text: "🌉 합정·용산", value: "합정·용산", next: "complete" },
            { text: "🏛️ 안국·서촌", value: "안국·서촌", next: "complete" },
            { text: "🏙️ 을지로", value: "을지로", next: "complete" },
            { text: "🌸 여의도", value: "여의도", next: "complete" },
        ],
    },
];

type Message = { type: "ai" | "user"; text: string };
type Answers = Record<string, string>;

const ANALYSIS_TEXTS = ["취향 분석 중...", "최적의 코스 탐색 중...", "코스를 조합하는 중...", "거의 다 됐어요!"];

// ─── 취향분석 오버레이 (웹 UI 동일) ────────────────────────────────────────────

function AnalysisOverlay({ text }: { text: string }) {
    const spinOuter = useRef(new Animated.Value(0)).current;
    const spinInner = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        const animOuter = Animated.loop(
            Animated.timing(spinOuter, {
                toValue: 1,
                duration: 3000,
                useNativeDriver: true,
            }),
        );
        const animInner = Animated.loop(
            Animated.timing(spinInner, {
                toValue: 1,
                duration: 2000,
                useNativeDriver: true,
            }),
        );
        animOuter.start();
        animInner.start();
        return () => {
            animOuter.stop();
            animInner.stop();
        };
    }, []);

    const rotateOuter = spinOuter.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });
    const rotateInner = spinInner.interpolate({ inputRange: [0, 1], outputRange: ["360deg", "0deg"] });

    return (
        <View style={s.overlay}>
            <View style={s.overlayInner}>
                <View style={s.overlayRingWrap}>
                    <Animated.View style={[s.overlayRingOuter, { transform: [{ rotate: rotateOuter }] }]} />
                    <Animated.View style={[s.overlayRingInner, { transform: [{ rotate: rotateInner }] }]} />
                    <View style={s.overlayIconWrap}>
                        <Ionicons name="flash" size={40} color="#34d399" />
                    </View>
                </View>
                <Text style={s.overlayTitle}>{text}</Text>
                <View style={s.overlayBar}>
                    <View style={s.overlayBarFill} />
                </View>
            </View>
        </View>
    );
}

// ─── 결과 카드 (웹 플립 스타일) ─────────────────────────────────────────────────

function parseMatchReasonChips(raw: string): string[] {
    const colonIdx = raw.indexOf(":");
    const value = colonIdx >= 0 ? raw.slice(colonIdx + 1).trim() : raw;
    if (!value) return [];
    return value
        .split(/\s*·\s*/)
        .map((s) => s.trim())
        .filter(Boolean);
}

function getMatchBadge(matchScore: number | null | undefined): {
    text: string;
    tone: "strong" | "good" | "soft" | "neutral";
} {
    if (matchScore == null) return { text: "오늘의 추천", tone: "neutral" };
    if (matchScore >= 0.9) return { text: "완벽히 맞아요", tone: "strong" };
    if (matchScore >= 0.75) return { text: "잘 맞아요", tone: "good" };
    if (matchScore >= 0.6) return { text: "좋아요", tone: "soft" };
    return { text: "추천", tone: "neutral" };
}

function ResultCard({
    course,
    nickname,
    isRevealed,
    onReveal,
    onDetail,
    onSelect,
}: {
    course: Course;
    nickname: string;
    isRevealed: boolean;
    onReveal: () => void;
    onDetail: (c: Course) => void;
    onSelect: (c: Course) => void;
}) {
    const t = useThemeColors();

    if (!isRevealed) {
        return (
            <TouchableOpacity style={s.flipCardFront} activeOpacity={0.95} onPress={onReveal}>
                <View style={s.flipFrontGlow} />
                <View style={s.flipFrontContent}>
                    <View style={s.flipFrontIconWrap}>
                        <View style={s.flipFrontIconGlow} />
                        <View style={s.flipFrontIcon}>
                            <Ionicons name="sparkles" size={48} color="#fff" />
                        </View>
                    </View>
                    <Text style={s.flipFrontLabel}>AI Analysis Result</Text>
                    <Text style={s.flipFrontTitle}>
                        {nickname || "게스트"}님만을 위한{"\n"}
                        <Text style={s.flipFrontTitleAccent}>맞춤 코스</Text>
                    </Text>
                    <View style={s.flipFrontHint}>
                        <Text style={s.flipFrontHintText}>터치해서 열어보기</Text>
                    </View>
                </View>
                <View style={s.flipFrontBottomLine} />
            </TouchableOpacity>
        );
    }

    const badge = getMatchBadge(course.matchScore);
    const chips = course.matchReason ? parseMatchReasonChips(course.matchReason) : [];
    const badgeStyle =
        badge.tone === "strong" || badge.tone === "good"
            ? {
                  bg: t.isDark ? "rgba(6,78,59,0.3)" : "#ecfdf5",
                  text: t.isDark ? "#6ee7b7" : "#047857",
                  border: t.isDark ? "rgba(52,211,153,0.3)" : "#a7f3d0",
              }
            : {
                  bg: t.isDark ? "#1f2937" : "#f9fafb",
                  text: t.isDark ? "#d1d5db" : "#374151",
                  border: t.isDark ? "#374151" : "#e5e7eb",
              };

    return (
        <View style={[s.resultCard, { backgroundColor: t.card, borderColor: t.border }]}>
            <View style={s.resultBody}>
                {/* 배지 + 스파클 */}
                <View
                    style={{
                        flexDirection: "row",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: 12,
                    }}
                >
                    <View style={[s.matchBadgeNew, { backgroundColor: badgeStyle.bg, borderColor: badgeStyle.border }]}>
                        <Text style={[s.matchBadgeText, { color: badgeStyle.text }]}>{badge.text}</Text>
                    </View>
                    <Ionicons name="sparkles" size={16} color={t.isDark ? "#34d399" : "#059669"} />
                </View>

                {/* 제목 */}
                <Text style={[s.resultTitle, { color: t.text }]} numberOfLines={2}>
                    {course.title}
                </Text>

                {/* 설명 */}
                {course.description ? (
                    <Text style={[s.resultDesc, { color: t.textMuted }]} numberOfLines={2}>
                        {course.description}
                    </Text>
                ) : null}

                {/* matchReason 칩 */}
                {chips.length > 0 ? (
                    <View style={s.matchChips}>
                        {chips.map((chip, i) => (
                            <View
                                key={i}
                                style={[
                                    s.matchChip,
                                    {
                                        borderColor: t.isDark ? "rgba(52,211,153,0.3)" : "#a7f3d0",
                                        backgroundColor: t.isDark ? "rgba(6,78,59,0.3)" : "#ecfdf5",
                                    },
                                ]}
                            >
                                <Text style={[s.matchChipText, { color: t.isDark ? "#6ee7b7" : "#047857" }]}>
                                    {chip}
                                </Text>
                            </View>
                        ))}
                    </View>
                ) : null}

                {/* 위치·소요시간 그리드 */}
                <View style={s.resultMetaGrid}>
                    {(course.location ?? course.region) ? (
                        <View style={[s.resultMetaBox, { backgroundColor: t.isDark ? "#1f2937" : "#f9fafb" }]}>
                            <Ionicons name="location" size={14} color={t.isDark ? "#34d399" : "#059669"} />
                            <Text
                                style={[s.resultMetaBoxText, { color: t.isDark ? "#d1d5db" : "#374151" }]}
                                numberOfLines={1}
                            >
                                {course.location ?? course.region}
                            </Text>
                        </View>
                    ) : null}
                    <View style={[s.resultMetaBox, { backgroundColor: t.isDark ? "#1f2937" : "#f9fafb" }]}>
                        <Ionicons name="time-outline" size={14} color={t.isDark ? "#34d399" : "#059669"} />
                        <Text style={[s.resultMetaBoxText, { color: t.isDark ? "#d1d5db" : "#374151" }]}>
                            {course.duration ?? "약 4~5시간"}
                        </Text>
                    </View>
                </View>

                {/* 버튼 2개 */}
                <View style={{ flexDirection: "row", gap: 8 }}>
                    <TouchableOpacity
                        style={[s.resultBtnSecondary, { backgroundColor: t.isDark ? "#1f2937" : "#f3f4f6", flex: 1 }]}
                        onPress={() => onDetail(course)}
                        activeOpacity={0.8}
                    >
                        <Text style={[s.resultBtnSecondaryText, { color: t.isDark ? "#d1d5db" : "#374151" }]}>
                            상세 보기
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[s.resultBtn, { flex: 1 }]}
                        onPress={() => onSelect(course)}
                        activeOpacity={0.85}
                    >
                        <Text style={s.resultBtnText}>선택하기 →</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    );
}

// ─── 채팅 모달 ────────────────────────────────────────────────────────────────

function ChatModal({ visible, onClose, onLimitExceeded, user }: {
    visible: boolean;
    onClose: () => void;
    onLimitExceeded: (ctx: LimitCtx) => void;
    user: any;
}) {
    const t = useThemeColors();
    const insets = useSafeAreaInsets();
    const scrollRef = useRef<ScrollView>(null);
    const nickname = (user as any)?.nickname || (user as any)?.name || "게스트";

    const [messages, setMessages] = useState<Message[]>([]);
    const [currentQ, setCurrentQ] = useState<Question>(FLOW[0]);
    const [answers, setAnswers] = useState<Answers>({});
    const [isTyping, setIsTyping] = useState(false);
    const [isComplete, setIsComplete] = useState(false);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [analysisText, setAnalysisText] = useState(ANALYSIS_TEXTS[0]);
    const [courses, setCourses] = useState<Course[]>([]);
    const [progress, setProgress] = useState(0);
    const [revealedCards, setRevealedCards] = useState<Record<string, boolean>>({});
    const [detailCourse, setDetailCourse] = useState<Course | null>(null);
    const [confirmCourse, setConfirmCourse] = useState<Course | null>(null);
    const [feedbackCourseId, setFeedbackCourseId] = useState<number | null>(null);
    const [isSelecting, setIsSelecting] = useState(false);

    // 분석 텍스트 순환
    useEffect(() => {
        if (!isAnalyzing) return;
        let i = 0;
        setAnalysisText(ANALYSIS_TEXTS[0]);
        const timer = setInterval(() => {
            i = (i + 1) % ANALYSIS_TEXTS.length;
            setAnalysisText(ANALYSIS_TEXTS[i]);
        }, 1000);
        return () => clearInterval(timer);
    }, [isAnalyzing]);

    // 모달 열릴 때 초기화
    useEffect(() => {
        if (!visible) return;
        setMessages([]);
        setAnswers({});
        setIsComplete(false);
        setCourses([]);
        setRevealedCards({});
        setCurrentQ(FLOW[0]);
        setProgress(0);
        setDetailCourse(null);
        setConfirmCourse(null);
        setFeedbackCourseId(null);
        setTimeout(() => addAiMsg(FLOW[0].text), 200);
    }, [visible]);

    function addAiMsg(text: string) {
        setIsTyping(true);
        setTimeout(() => {
            setMessages((prev) => [...prev, { type: "ai", text }]);
            setIsTyping(false);
            scrollToEnd();
        }, 600);
    }

    function scrollToEnd() {
        setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    }

    async function handleOption(option: Option) {
        setMessages((prev) => [...prev, { type: "user", text: option.text }]);
        const newAnswers = { ...answers, [currentQ.id]: option.value };
        setAnswers(newAnswers);
        scrollToEnd();

        const keys = ["purpose_today", "goal_detail", "companion_today", "region_today"];
        const answered = Object.keys(newAnswers).filter((k) => keys.includes(k)).length;
        setProgress(Math.min(100, Math.round((answered / 4) * 100)));

        if (option.next === "complete") {
            if (!user) {
                setTimeout(() => {
                    setMessages((prev) => [
                        ...prev,
                        {
                            type: "ai",
                            text: "코스 추천을 보려면 로그인이 필요해요 🔐\n마이페이지에서 로그인해주세요!",
                        },
                    ]);
                    scrollToEnd();
                }, 600);
                return;
            }

            setIsAnalyzing(true);
            let fetchedCourses: Course[] = [];
            try {
                // 1순위: /api/recommendations (모든 답변 전달 → AI 매칭)
                const recParams = new URLSearchParams({
                    mode: "ai",
                    goal: newAnswers.purpose_today ?? "",
                    goal_detail: newAnswers.goal_detail ?? "",
                    companion_today: newAnswers.companion_today ?? "",
                    region_today: newAnswers.region_today ?? "",
                    limit: "6",
                    strict: "true",
                });
                try {
                    const recResult = await api.get<any>(`/api/recommendations?${recParams.toString()}`);
                    const recommendations = recResult?.recommendations;
                    if (Array.isArray(recommendations) && recommendations.length > 0) {
                        fetchedCourses = recommendations;
                    }
                } catch (e) {
                    if (e instanceof ApiError && e.status === 429) {
                        const data = e.data as any;
                        setIsAnalyzing(false);
                        onClose();
                        InteractionManager.runAfterInteractions(() => {
                            onLimitExceeded({
                                tier: data?.tier ?? "FREE",
                                limit: data?.limit ?? null,
                                used: data?.used ?? 0,
                            });
                        });
                        return;
                    }
                }

                // 폴백: 추천 결과 없으면 지역 필터로
                if (fetchedCourses.length === 0) {
                    const fallbackParams = new URLSearchParams({
                        region: newAnswers.region_today ?? "",
                        limit: "6",
                        imagePolicy: "any",
                    });
                    const fallback = await api.get<any>(`/api/courses?${fallbackParams.toString()}`);
                    const arr = Array.isArray(fallback) ? fallback : Array.isArray(fallback?.data) ? fallback.data : [];
                    fetchedCourses = arr;
                }

                setCourses(fetchedCourses);
            } catch {
                setCourses([]);
            } finally {
                setIsAnalyzing(false);
                setIsComplete(true);
                setProgress(100);
                if (fetchedCourses.length > 0) {
                    addAiMsg(
                        `${newAnswers.region_today ?? ""} 지역의 ${newAnswers.purpose_today ?? ""} 코스를 찾았어요! 🎉`,
                    );
                } else {
                    addAiMsg("조건에 맞는 코스를 찾지 못했어요. 다른 조건으로 다시 시도해볼까요? 😢");
                }
            }
        } else {
            const nextQ = FLOW.find((q) => q.id === option.next);
            if (nextQ) {
                setCurrentQ(nextQ);
                addAiMsg(nextQ.text);
            }
        }
    }

    function handleReset() {
        setMessages([]);
        setAnswers({});
        setIsComplete(false);
        setCourses([]);
        setRevealedCards({});
        setCurrentQ(FLOW[0]);
        setProgress(0);
        addAiMsg(FLOW[0].text);
    }

    return (
        <Modal visible={visible} animationType="fade" transparent={false} onRequestClose={onClose} statusBarTranslucent>
            <View style={[s.chatModal, { backgroundColor: t.bg, paddingTop: insets.top }]}>
                {/* 채팅 헤더 */}
                <View style={[s.chatHeader, { backgroundColor: t.card, borderBottomColor: t.border }]}>
                    <View style={s.chatHeaderLeft}>
                        <Image source={{ uri: DONA_LOGO }} style={s.botAvatar} resizeMode="cover" />
                        <View>
                            <Text style={[s.botName, { color: t.text }]}>AI DoNa</Text>
                            <View style={s.liveRow}>
                                <View style={s.liveDot} />
                                <Text style={s.liveText}>분석 중</Text>
                            </View>
                        </View>
                    </View>
                    <TouchableOpacity onPress={onClose} style={[s.closeBtn, { backgroundColor: t.surface }]}>
                        <Ionicons name="close" size={20} color={t.textMuted} />
                    </TouchableOpacity>
                </View>

                {/* 진행바 */}
                {!isComplete && (
                    <View style={[s.progressBar, { backgroundColor: t.border }]}>
                        <View style={[s.progressFill, { width: `${progress}%` as any }]} />
                    </View>
                )}

                {/* 채팅 영역 */}
                <ScrollView
                    ref={scrollRef}
                    style={s.chat}
                    contentContainerStyle={[s.chatContent, { paddingBottom: insets.bottom + 16 }]}
                    showsVerticalScrollIndicator={false}
                >
                    {messages.map((msg, i) => (
                        <View key={i} style={[s.msgRow, msg.type === "user" ? s.msgRowUser : s.msgRowAi]}>
                            {msg.type === "ai" && (
                                <Image source={{ uri: DONA_LOGO }} style={s.botAvatarSm} resizeMode="cover" />
                            )}
                            <View
                                style={[
                                    s.bubble,
                                    msg.type === "user"
                                        ? s.bubbleUser
                                        : [s.bubbleAi, { backgroundColor: t.card, borderColor: t.border }],
                                ]}
                            >
                                <Text
                                    style={[
                                        s.bubbleText,
                                        msg.type === "user" ? s.bubbleTextUser : [s.bubbleTextAi, { color: t.text }],
                                    ]}
                                >
                                    {msg.text}
                                </Text>
                            </View>
                        </View>
                    ))}

                    {isTyping && (
                        <View style={[s.msgRow, s.msgRowAi]}>
                            <Image source={{ uri: DONA_LOGO }} style={s.botAvatarSm} resizeMode="cover" />
                            <View style={[s.bubble, s.bubbleAi, { backgroundColor: t.card, borderColor: t.border }]}>
                                <Text style={[s.bubbleText, s.bubbleTextAi, { color: t.text, letterSpacing: 4 }]}>
                                    • • •
                                </Text>
                            </View>
                        </View>
                    )}

                    {isComplete && courses.length > 0 && (
                        <View style={s.results}>
                            <Text style={[s.resultsTitle, { color: t.text }]}>추천 코스 {courses.length}개 🎉</Text>
                            {courses.map((c) => (
                                <ResultCard
                                    key={c.id}
                                    course={c}
                                    nickname={nickname}
                                    isRevealed={!!revealedCards[String(c.id)]}
                                    onReveal={() => setRevealedCards((prev) => ({ ...prev, [String(c.id)]: true }))}
                                    onDetail={(course) => setDetailCourse(course)}
                                    onSelect={(course) => setConfirmCourse(course)}
                                />
                            ))}
                        </View>
                    )}

                    {isComplete && courses.length === 0 && (
                        <View style={s.empty}>
                            <Text style={{ fontSize: 48 }}>🗺️</Text>
                            <Text style={[s.emptyText, { color: t.textMuted }]}>
                                해당 조건에 맞는 코스를 찾지 못했어요.
                            </Text>
                            <TouchableOpacity style={s.retryBtn} onPress={handleReset}>
                                <Text style={s.retryText}>다시 추천받기</Text>
                            </TouchableOpacity>
                        </View>
                    )}
                </ScrollView>

                {/* 답변 옵션 */}
                {!isComplete && !isTyping && !isAnalyzing && (
                    <View
                        style={[
                            s.optionsWrap,
                            { backgroundColor: t.card, borderTopColor: t.border, paddingBottom: insets.bottom + 12 },
                        ]}
                    >
                        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.optionsContent}>
                            <View style={s.optionsGrid}>
                                {currentQ.options.map((opt, i) => (
                                    <TouchableOpacity
                                        key={i}
                                        style={[
                                            s.optBtn,
                                            { backgroundColor: t.card, borderColor: t.border },
                                            opt.value === "start" && s.optBtnPrimary,
                                        ]}
                                        onPress={() => handleOption(opt)}
                                        activeOpacity={0.82}
                                    >
                                        <Text
                                            style={[
                                                s.optText,
                                                { color: t.text },
                                                opt.value === "start" && s.optTextPrimary,
                                            ]}
                                        >
                                            {opt.text}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </ScrollView>
                    </View>
                )}

                {/* 완료 후 버튼 */}
                {isComplete && (
                    <View
                        style={[
                            s.doneBar,
                            { backgroundColor: t.card, borderTopColor: t.border, paddingBottom: insets.bottom + 12 },
                        ]}
                    >
                        <TouchableOpacity style={s.doneBtn} onPress={handleReset} activeOpacity={0.85}>
                            <Ionicons name="refresh" size={16} color="#fff" />
                            <Text style={s.doneBtnText}>다른 코스 추천받기</Text>
                        </TouchableOpacity>
                    </View>
                )}

                {/* 분석 오버레이 (웹 UI 동일) */}
                {isAnalyzing && <AnalysisOverlay text={analysisText} />}
            </View>

            {/* ─── 상세 보기 바텀시트 ─────────────────────────────────── */}
            <Modal
                visible={!!detailCourse}
                transparent
                animationType="slide"
                onRequestClose={() => setDetailCourse(null)}
            >
                <View style={s.modalOverlay}>
                    <Pressable style={StyleSheet.absoluteFillObject} onPress={() => setDetailCourse(null)} />
                    {detailCourse && (
                        <View style={[s.detailSheet, { backgroundColor: t.card }]}>
                            {/* 핸들 */}
                            <View style={s.sheetHandle} />
                            <ScrollView
                                showsVerticalScrollIndicator={false}
                                contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
                            >
                                {/* 헤더 */}
                                <View
                                    style={{
                                        flexDirection: "row",
                                        alignItems: "flex-start",
                                        justifyContent: "space-between",
                                        gap: 12,
                                        marginBottom: 8,
                                        paddingHorizontal: 20,
                                        paddingTop: 4,
                                    }}
                                >
                                    <Text style={[s.detailTitle, { color: t.text, flex: 1 }]} numberOfLines={2}>
                                        {detailCourse.title}
                                    </Text>
                                    <TouchableOpacity
                                        onPress={() => setDetailCourse(null)}
                                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                    >
                                        <Ionicons name="close" size={22} color={t.textMuted} />
                                    </TouchableOpacity>
                                </View>

                                {/* matchReason 칩 */}
                                {detailCourse.matchReason
                                    ? (() => {
                                          const chips = parseMatchReasonChips(detailCourse.matchReason!);
                                          if (!chips.length) return null;
                                          return (
                                              <View
                                                  style={{
                                                      flexDirection: "row",
                                                      flexWrap: "wrap",
                                                      gap: 5,
                                                      paddingHorizontal: 20,
                                                      marginBottom: 10,
                                                  }}
                                              >
                                                  {chips.map((chip, i) => (
                                                      <View
                                                          key={i}
                                                          style={[
                                                              s.matchChip,
                                                              {
                                                                  borderColor: t.isDark
                                                                      ? "rgba(52,211,153,0.3)"
                                                                      : "#a7f3d0",
                                                                  backgroundColor: t.isDark
                                                                      ? "rgba(6,78,59,0.3)"
                                                                      : "#ecfdf5",
                                                              },
                                                          ]}
                                                      >
                                                          <Text
                                                              style={[
                                                                  s.matchChipText,
                                                                  { color: t.isDark ? "#6ee7b7" : "#047857" },
                                                              ]}
                                                          >
                                                              {chip}
                                                          </Text>
                                                      </View>
                                                  ))}
                                              </View>
                                          );
                                      })()
                                    : null}

                                {/* 설명 한 줄 */}
                                {detailCourse.description ? (
                                    <View
                                        style={{
                                            flexDirection: "row",
                                            alignItems: "center",
                                            gap: 6,
                                            paddingHorizontal: 20,
                                            marginBottom: 14,
                                        }}
                                    >
                                        <Ionicons name="leaf-outline" size={14} color="#059669" />
                                        <Text style={[{ fontSize: 13, color: t.textMuted, flex: 1 }]} numberOfLines={2}>
                                            {detailCourse.description.split(/[.\n]/)[0]?.trim()}
                                        </Text>
                                    </View>
                                ) : null}

                                {/* 위치·시간·도보 바 */}
                                <View
                                    style={[
                                        s.detailMetaBar,
                                        { backgroundColor: t.isDark ? "#1f2937" : "#f3f4f6", marginHorizontal: 20 },
                                    ]}
                                >
                                    <Ionicons name="location" size={15} color="#059669" />
                                    <Text
                                        style={[s.detailMetaBarText, { color: t.isDark ? "#d1d5db" : "#374151" }]}
                                        numberOfLines={1}
                                    >
                                        {detailCourse.location ?? "-"}
                                    </Text>
                                    <Ionicons name="chevron-forward" size={13} color={t.textMuted} />
                                    <Ionicons name="time-outline" size={15} color="#059669" />
                                    <Text style={[s.detailMetaBarText, { color: t.isDark ? "#d1d5db" : "#374151" }]}>
                                        {detailCourse.duration ?? "약 4~5시간"}
                                    </Text>
                                    <Ionicons name="chevron-forward" size={13} color={t.textMuted} />
                                    <Ionicons name="walk-outline" size={15} color="#059669" />
                                    <Text style={[s.detailMetaBarText, { color: t.isDark ? "#d1d5db" : "#374151" }]}>
                                        도보 중심
                                    </Text>
                                </View>

                                {/* 장소 리스트 */}
                                {detailCourse.coursePlaces && detailCourse.coursePlaces.length > 0 && (
                                    <View style={{ marginTop: 16, paddingHorizontal: 20, gap: 8 }}>
                                        {[...detailCourse.coursePlaces]
                                            .sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0))
                                            .map((cp, idx) => (
                                                <View
                                                    key={cp.place?.id ?? idx}
                                                    style={[
                                                        s.placeRow,
                                                        {
                                                            backgroundColor: t.isDark ? "#1f2937" : "#f9fafb",
                                                            borderColor: t.border,
                                                        },
                                                    ]}
                                                >
                                                    <View style={s.placeNum}>
                                                        <Text style={s.placeNumText}>{idx + 1}</Text>
                                                    </View>
                                                    <View style={{ flex: 1, minWidth: 0 }}>
                                                        <Text
                                                            style={[{ fontSize: 14, fontWeight: "600", color: t.text }]}
                                                            numberOfLines={1}
                                                        >
                                                            {cp.place?.name ?? "장소"}
                                                        </Text>
                                                        <Text
                                                            style={[{ fontSize: 11, color: t.textMuted, marginTop: 2 }]}
                                                            numberOfLines={1}
                                                        >
                                                            {cp.place?.category
                                                                ? `${cp.place.category} · ${idx + 1}번째 스팟`
                                                                : `${idx + 1}번째 스팟`}
                                                        </Text>
                                                    </View>
                                                    {cp.place?.imageUrl ? (
                                                        <Image
                                                            source={{ uri: resolveImageUrl(cp.place.imageUrl) ?? "" }}
                                                            style={s.placeThumb}
                                                        />
                                                    ) : (
                                                        <View
                                                            style={[
                                                                s.placeThumb,
                                                                { backgroundColor: t.isDark ? "#374151" : "#e5e7eb" },
                                                            ]}
                                                        />
                                                    )}
                                                </View>
                                            ))}
                                    </View>
                                )}
                            </ScrollView>

                            {/* CTA */}
                            <View
                                style={[
                                    s.detailCta,
                                    {
                                        paddingBottom: insets.bottom + 12,
                                        borderTopColor: t.border,
                                        backgroundColor: t.card,
                                    },
                                ]}
                            >
                                <TouchableOpacity
                                    style={s.detailCtaBtn}
                                    activeOpacity={0.88}
                                    onPress={() => {
                                        setDetailCourse(null);
                                        setConfirmCourse(detailCourse);
                                    }}
                                >
                                    <Text style={s.detailCtaBtnText}>코스 시작하기</Text>
                                    <Ionicons name="chevron-forward" size={18} color="#fff" />
                                </TouchableOpacity>
                            </View>
                        </View>
                    )}
                </View>
            </Modal>

            {/* ─── 선택 확인 모달 ────────────────────────────────────── */}
            <Modal
                visible={!!confirmCourse}
                transparent
                animationType="fade"
                onRequestClose={() => setConfirmCourse(null)}
            >
                <View style={s.centeredOverlay}>
                    <Pressable style={StyleSheet.absoluteFillObject} onPress={() => setConfirmCourse(null)} />
                    {confirmCourse && (
                        <View style={[s.confirmBox, { backgroundColor: t.card }]}>
                            <View style={s.confirmIcon}>
                                <Ionicons name="navigate" size={28} color="#059669" />
                            </View>
                            <Text style={[s.confirmTitle, { color: t.text }]}>이 코스로 결정할까요?</Text>
                            <Text style={[s.confirmDesc, { color: t.textMuted }]}>
                                <Text style={{ color: "#059669", fontWeight: "700" }}>"{confirmCourse.title}"</Text>
                                {"\n"}
                                선택하신 코스는 마이페이지에 보관됩니다.
                            </Text>
                            <View style={[s.confirmBtns, { borderTopColor: t.border }]}>
                                <TouchableOpacity style={s.confirmCancel} onPress={() => setConfirmCourse(null)}>
                                    <Text style={[s.confirmCancelText, { color: t.textMuted }]}>취소</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[s.confirmOk, isSelecting && { opacity: 0.5 }]}
                                    disabled={isSelecting}
                                    onPress={async () => {
                                        if (!confirmCourse || isSelecting) return;
                                        setIsSelecting(true);
                                        try {
                                            await api.post("/api/users/me/courses", {
                                                courseId: String(confirmCourse.id),
                                                source: "ai_recommendation",
                                            });
                                        } catch {}
                                        setIsSelecting(false);
                                        setFeedbackCourseId(confirmCourse.id);
                                        setConfirmCourse(null);
                                    }}
                                >
                                    <Text style={s.confirmOkText}>{isSelecting ? "저장 중..." : "저장하기"}</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    )}
                </View>
            </Modal>

            {/* ─── 피드백 모달 ───────────────────────────────────────── */}
            <Modal
                visible={!!feedbackCourseId}
                transparent
                animationType="fade"
                onRequestClose={() => setFeedbackCourseId(null)}
            >
                <View style={s.centeredOverlay}>
                    <View style={[s.feedbackBox, { backgroundColor: t.card }]}>
                        <Text style={[s.feedbackTitle, { color: t.text }]}>이 추천 어땠나요?</Text>
                        {[
                            { label: "마음에 들어요", value: "GOOD", emoji: "👍" },
                            { label: "보통이에요", value: "OK", emoji: "😐" },
                            { label: "별로예요", value: "BAD", emoji: "👎" },
                        ].map((opt) => (
                            <TouchableOpacity
                                key={opt.value}
                                style={[s.feedbackBtn, { backgroundColor: t.isDark ? "#1f2937" : "#f3f4f6" }]}
                                activeOpacity={0.8}
                                onPress={() => {
                                    const courseId = feedbackCourseId!;
                                    api.post("/api/feedback", {
                                        courseId: String(courseId),
                                        rating: opt.value,
                                        context: "AI_RECOMMENDATION",
                                    }).catch(() => {});
                                    setFeedbackCourseId(null);
                                    onClose();
                                    InteractionManager.runAfterInteractions(() => {
                                        router.push(`/courses/${courseId}` as any);
                                    });
                                }}
                            >
                                <Text style={{ fontSize: 20 }}>{opt.emoji}</Text>
                                <Text style={[s.feedbackBtnText, { color: t.isDark ? "#d1d5db" : "#374151" }]}>
                                    {opt.label}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>
            </Modal>
        </Modal>
    );
}

// ─── 메인 화면 (랜딩 히어로) ──────────────────────────────────────────────────

export default function AiScreen() {
    const t = useThemeColors();
    const { user } = useAuth();
    const [chatOpen, setChatOpen] = useState(false);
    const [showLimitSheet, setShowLimitSheet] = useState(false);
    const [limitCtx, setLimitCtx] = useState<LimitCtx | null>(null);
    const [showTicketSheet, setShowTicketSheet] = useState(false);

    // 탭 진입 시 자동 precheck
    useEffect(() => {
        if (!user) return;
        api.get<{
            canUse: boolean;
            tier: "FREE" | "BASIC" | "PREMIUM";
            limit: number | null;
            used: number;
        }>("/api/recommendations/precheck").then((pre) => {
            if (pre?.canUse === false) {
                setLimitCtx({ tier: pre.tier, limit: pre.limit, used: pre.used });
                setShowLimitSheet(true);
            }
        }).catch(() => {});
    }, [user?.id]);

    async function handleOpenChat() {
        if (!user) {
            setChatOpen(true);
            return;
        }
        try {
            const pre = await api.get<{
                canUse: boolean;
                tier: "FREE" | "BASIC" | "PREMIUM";
                limit: number | null;
                used: number;
            }>("/api/recommendations/precheck");
            if (pre?.canUse === false) {
                setLimitCtx({ tier: pre.tier, limit: pre.limit, used: pre.used });
                setShowLimitSheet(true);
                return;
            }
        } catch {}
        setChatOpen(true);
    }

    const nickname = (user as any)?.nickname || (user as any)?.name || "게스트";

    return (
        <SafeAreaView style={[s.root, { backgroundColor: t.bg }]} edges={["top"]}>
            <AppHeaderWithModals />

            <ScrollView contentContainerStyle={s.landingContent} showsVerticalScrollIndicator={false}>
                {/* 유저 프로필 카드 */}
                <View style={[s.profileCard, { backgroundColor: t.card, borderColor: t.border }]}>
                    <View style={s.profileCardLeft}>
                        <Text style={[s.profileCardHint, { color: t.textMuted }]}>오늘 어떤 하루를?</Text>
                        <Text style={[s.profileCardGreeting, { color: t.text }]}>
                            {user ? (
                                <>
                                    안녕하세요{"\n"}
                                    <Text style={s.profileCardName}>{nickname}님</Text> 👋
                                </>
                            ) : (
                                <>
                                    로그인하고{"\n"}
                                    <Text style={s.profileCardName}>맞춤 추천</Text> 받기 👋
                                </>
                            )}
                        </Text>
                        {!user && (
                            <TouchableOpacity
                                style={s.loginHintBtn}
                                onPress={() => router.push("/(auth)/login" as any)}
                                activeOpacity={0.85}
                            >
                                <Text style={s.loginHintText}>✨ 로그인 시 개인 맞춤 추천 제공</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                    <Image
                        source={{ uri: resolveImageUrl(user?.profileImage) || DEFAULT_PROFILE }}
                        style={s.profileAvatar}
                        resizeMode="cover"
                    />
                </View>

                {/* 히어로 카드 */}
                <View style={[s.heroCard, { backgroundColor: t.card, borderColor: t.border }]}>
                    {/* 아이콘 */}
                    <View style={s.heroIconWrap}>
                        <View style={s.heroIconBox}>
                            <Ionicons name="sparkles" size={40} color="#059669" />
                            <View style={s.heroPingDot}>
                                <View style={s.heroPingInner} />
                            </View>
                        </View>
                    </View>

                    {/* 타이포그래피 */}
                    <Text style={s.heroTitle}>
                        <Text style={s.heroTitleGreen}>AI DoNa</Text>가{"\n"}오늘의 코스를 추천해드릴게요
                    </Text>
                    <Text style={[s.heroSubtitle, { color: t.textMuted }]}>
                        몇 가지 질문에 답하면{"\n"}취향에 딱 맞는 데이트 코스를 찾아드려요
                    </Text>

                    {/* CTA 버튼 */}
                    <TouchableOpacity style={s.ctaBtn} onPress={handleOpenChat} activeOpacity={0.88}>
                        <Text style={s.ctaBtnText}>데이트 코스 추천받기</Text>
                        <Ionicons name="chevron-forward" size={18} color="#fff" />
                    </TouchableOpacity>

                    <View style={s.heroHintRow}>
                        <View style={s.heroHintDot} />
                        <Text style={[s.heroHintText, { color: t.textMuted }]}>AI 분석 · 무료 제공</Text>
                    </View>
                </View>
            </ScrollView>

            <ChatModal
                visible={chatOpen}
                onClose={() => setChatOpen(false)}
                onLimitExceeded={(ctx) => { setLimitCtx(ctx); setShowLimitSheet(true); }}
                user={user}
            />
            <LimitExceededSheet
                visible={showLimitSheet}
                ctx={limitCtx}
                onClose={() => setShowLimitSheet(false)}
                onUpgrade={() => setShowTicketSheet(true)}
            />
            <TicketPlansSheet
                visible={showTicketSheet}
                onClose={() => setShowTicketSheet(false)}
                context="UPGRADE"
            />
        </SafeAreaView>
    );
}

// ─── 스타일 ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
    root: { flex: 1 },
    landingContent: { padding: 20, paddingBottom: 140, gap: 16 },

    // 유저 프로필 카드
    profileCard: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        padding: 16,
        borderRadius: 20,
        borderWidth: 1,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
    },
    profileCardLeft: { flex: 1, gap: 4 },
    profileCardHint: { fontSize: 11, fontWeight: "600", letterSpacing: 0.2 },
    profileCardGreeting: { fontSize: 17, fontWeight: "800", lineHeight: 24, letterSpacing: -0.3 },
    profileCardName: { color: "#059669", fontWeight: "800" },
    loginHintBtn: {
        marginTop: 6,
        alignSelf: "flex-start",
        backgroundColor: "#ecfdf5",
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: "#a7f3d0",
    },
    loginHintText: { fontSize: 11, fontWeight: "700", color: "#047857" },
    profileAvatar: {
        width: 44,
        height: 44,
        borderRadius: 22,
        overflow: "hidden",
        marginLeft: 12,
    },

    // 히어로 카드
    heroCard: {
        padding: 28,
        borderRadius: 28,
        borderWidth: 1,
        alignItems: "center",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.06,
        shadowRadius: 16,
        elevation: 4,
    },
    heroIconWrap: { marginBottom: 20 },
    heroIconBox: {
        width: 80,
        height: 80,
        borderRadius: 28,
        backgroundColor: "#ecfdf5",
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 1,
        borderColor: "#a7f3d0",
    },
    heroPingDot: {
        position: "absolute",
        top: 8,
        right: 8,
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: "#10b981",
    },
    heroPingInner: {
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: "#10b981",
    },
    heroTitle: {
        fontSize: 22,
        fontWeight: "800",
        textAlign: "center",
        lineHeight: 30,
        letterSpacing: -0.5,
        color: "#111827",
        marginBottom: 10,
    },
    heroTitleGreen: { color: "#059669" },
    heroSubtitle: {
        fontSize: 14,
        textAlign: "center",
        lineHeight: 22,
        marginBottom: 24,
    },
    ctaBtn: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        backgroundColor: "#059669",
        paddingHorizontal: 24,
        paddingVertical: 14,
        borderRadius: 16,
        width: "100%",
        justifyContent: "center",
        shadowColor: "#059669",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
    },
    ctaBtnText: { fontSize: 16, fontWeight: "700", color: "#fff", letterSpacing: -0.3 },
    heroHintRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 12 },
    heroHintDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#10b981" },
    heroHintText: { fontSize: 11, fontWeight: "600" },

    // 배지
    badgesRow: { flexDirection: "row", gap: 8 },
    badge: {
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 5,
        paddingVertical: 10,
        paddingHorizontal: 8,
        borderRadius: 12,
        borderWidth: 1,
    },
    badgeText: { fontSize: 11, fontWeight: "600" },

    // 채팅 모달
    chatModal: { flex: 1 },
    chatHeader: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    chatHeaderLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
    botAvatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
        overflow: "hidden",
    },
    botName: { fontSize: 15, fontWeight: "700" },
    liveRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 1 },
    liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#10b981" },
    liveText: { fontSize: 11, color: "#059669", fontWeight: "600" },
    closeBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: "center",
        justifyContent: "center",
    },

    // 진행바
    progressBar: { height: 3 },
    progressFill: { height: 3, backgroundColor: "#10b981" },

    // 채팅 영역
    chat: { flex: 1, backgroundColor: "rgba(249,250,251,0.5)" },
    chatContent: { padding: 16, gap: 16 },

    // 메시지
    msgRow: { flexDirection: "row", alignItems: "flex-end", gap: 8 },
    msgRowAi: { justifyContent: "flex-start" },
    msgRowUser: { justifyContent: "flex-end" },
    botAvatarSm: {
        width: 28,
        height: 28,
        borderRadius: 14,
        overflow: "hidden",
        flexShrink: 0,
    },
    bubble: { maxWidth: "78%", paddingHorizontal: 16, paddingVertical: 12, borderRadius: 20 },
    bubbleAi: {
        borderWidth: 1,
        borderBottomLeftRadius: 4,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 2,
        elevation: 1,
    },
    bubbleUser: { backgroundColor: "#111827", borderBottomRightRadius: 4 },
    bubbleText: { fontSize: 15, lineHeight: 22 },
    bubbleTextAi: {},
    bubbleTextUser: { color: "#fff" },

    // 결과
    results: { gap: 12 },
    resultsTitle: { fontSize: 17, fontWeight: "700", letterSpacing: -0.3, marginTop: 8 },
    resultCard: {
        borderRadius: 20,
        overflow: "hidden",
        borderWidth: 1,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
        elevation: 3,
    },
    resultBody: { padding: 22 },
    matchBadgeNew: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 8,
        borderWidth: 1,
    },
    matchBadgeText: { fontSize: 11, fontWeight: "800" },
    resultTitle: { fontSize: 20, fontWeight: "700", letterSpacing: -0.5, marginBottom: 8 },
    resultDesc: { fontSize: 13, lineHeight: 19, marginBottom: 10 },
    matchChips: { flexDirection: "row", flexWrap: "wrap", gap: 5, marginBottom: 14 },
    matchChip: {
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 999,
        borderWidth: 1,
    },
    matchChipText: { fontSize: 11, fontWeight: "600" },
    resultMetaGrid: { flexDirection: "row", gap: 10, marginBottom: 20 },
    resultMetaBox: {
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        paddingHorizontal: 10,
        paddingVertical: 10,
        borderRadius: 12,
    },
    resultMetaBoxText: { fontSize: 12, fontWeight: "700", flex: 1 },
    resultBtn: {
        backgroundColor: "#059669",
        paddingVertical: 14,
        borderRadius: 16,
        alignItems: "center",
    },
    resultBtnText: { fontSize: 14, fontWeight: "700", color: "#fff" },
    resultBtnSecondary: { paddingVertical: 14, borderRadius: 16, alignItems: "center" },
    resultBtnSecondaryText: { fontSize: 14, fontWeight: "700" },

    // 상세 바텀시트
    modalOverlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.6)" },
    detailSheet: {
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        maxHeight: Dimensions.get("window").height * 0.9,
        overflow: "hidden",
    },
    sheetHandle: {
        width: 36,
        height: 4,
        borderRadius: 2,
        backgroundColor: "#d1d5db",
        alignSelf: "center",
        marginTop: 10,
        marginBottom: 14,
    },
    detailTitle: { fontSize: 18, fontWeight: "700", letterSpacing: -0.3 },
    detailMetaBar: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        paddingHorizontal: 14,
        paddingVertical: 12,
        borderRadius: 14,
        marginTop: 4,
    },
    detailMetaBarText: { fontSize: 12, fontWeight: "600", flexShrink: 1 },
    placeRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderRadius: 14, borderWidth: 1 },
    placeNum: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: "#059669",
        alignItems: "center",
        justifyContent: "center",
    },
    placeNumText: { fontSize: 12, fontWeight: "700", color: "#fff" },
    placeThumb: { width: 52, height: 52, borderRadius: 10 },
    detailCta: { padding: 16, borderTopWidth: 1 },
    detailCtaBtn: {
        backgroundColor: "#059669",
        borderRadius: 18,
        paddingVertical: 16,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
    },
    detailCtaBtnText: { fontSize: 15, fontWeight: "700", color: "#fff" },

    // 선택 확인 모달
    centeredOverlay: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "rgba(0,0,0,0.6)",
        padding: 24,
    },
    confirmBox: { width: "100%", borderRadius: 28, overflow: "hidden" },
    confirmIcon: {
        width: 60,
        height: 60,
        borderRadius: 16,
        backgroundColor: "#ecfdf5",
        alignItems: "center",
        justifyContent: "center",
        alignSelf: "center",
        marginTop: 32,
        marginBottom: 16,
    },
    confirmTitle: { fontSize: 20, fontWeight: "800", textAlign: "center", paddingHorizontal: 24 },
    confirmDesc: {
        fontSize: 14,
        textAlign: "center",
        lineHeight: 21,
        paddingHorizontal: 24,
        marginTop: 8,
        marginBottom: 24,
    },
    confirmBtns: { flexDirection: "row", borderTopWidth: 1 },
    confirmCancel: { flex: 1, paddingVertical: 20, alignItems: "center" },
    confirmCancelText: { fontSize: 15, fontWeight: "600" },
    confirmOk: { flex: 1, paddingVertical: 20, alignItems: "center", backgroundColor: "#059669" },
    confirmOkText: { fontSize: 15, fontWeight: "700", color: "#fff" },

    // 피드백 모달
    feedbackBox: { width: "100%", borderRadius: 28, padding: 28 },
    feedbackTitle: { fontSize: 20, fontWeight: "800", textAlign: "center", marginBottom: 20 },
    feedbackBtn: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderRadius: 16,
        marginBottom: 10,
    },
    feedbackBtnText: { fontSize: 15, fontWeight: "600" },

    // 빈 결과
    empty: { alignItems: "center", paddingVertical: 40, gap: 12 },
    emptyText: { fontSize: 14, textAlign: "center" },
    retryBtn: { backgroundColor: "#059669", paddingHorizontal: 20, paddingVertical: 10, borderRadius: 999 },
    retryText: { fontSize: 13, fontWeight: "700", color: "#fff" },

    // 옵션 영역
    optionsWrap: { borderTopWidth: StyleSheet.hairlineWidth, maxHeight: 220 },
    optionsContent: { padding: 12 },
    optionsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "center" },
    optBtn: { paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12, borderWidth: 1 },
    optBtnPrimary: { backgroundColor: "#059669", borderColor: "#059669" },
    optText: { fontSize: 14, fontWeight: "600" },
    optTextPrimary: { color: "#fff" },

    // 완료 바
    doneBar: { padding: 16, borderTopWidth: StyleSheet.hairlineWidth },
    doneBtn: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        backgroundColor: "#059669",
        borderRadius: 16,
        paddingVertical: 14,
    },
    doneBtnText: { fontSize: 15, fontWeight: "700", color: "#fff" },

    // 분석 오버레이 (웹 UI 동일: 회전 링 + Zap 아이콘)
    overlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: "rgba(17,24,39,0.95)",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 99,
    },
    overlayInner: { alignItems: "center", gap: 24 },
    overlayRingWrap: {
        width: 128,
        height: 128,
        alignItems: "center",
        justifyContent: "center",
    },
    overlayRingOuter: {
        position: "absolute",
        width: 128,
        height: 128,
        borderRadius: 64,
        borderWidth: 2,
        borderColor: "rgba(52,211,153,0.3)",
    },
    overlayRingInner: {
        position: "absolute",
        width: 104,
        height: 104,
        borderRadius: 52,
        borderWidth: 2,
        borderColor: "rgba(52,211,153,0.5)",
    },
    overlayIconWrap: {
        width: 80,
        height: 80,
        borderRadius: 40,
        alignItems: "center",
        justifyContent: "center",
    },
    overlayTitle: { fontSize: 20, fontWeight: "700", color: "#fff" },
    overlayBar: { width: 160, height: 4, backgroundColor: "#374151", borderRadius: 2, overflow: "hidden" },
    overlayBarFill: { height: 4, width: "100%", backgroundColor: "#10b981" },

    // 플립 카드 앞면 (웹 UI 동일)
    flipCardFront: {
        borderRadius: 20,
        overflow: "hidden",
        minHeight: 280,
        backgroundColor: "#1a1a1a",
        borderWidth: 3,
        borderColor: "rgba(16,185,129,0.3)",
    },
    flipFrontGlow: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: "rgba(16,185,129,0.08)",
    },
    flipFrontContent: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
    },
    flipFrontIconWrap: {
        position: "relative",
        width: 96,
        height: 96,
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 20,
    },
    flipFrontIconGlow: {
        position: "absolute",
        width: 96,
        height: 96,
        borderRadius: 48,
        backgroundColor: "#10b981",
        opacity: 0.2,
    },
    flipFrontIcon: {
        width: 96,
        height: 96,
        borderRadius: 48,
        backgroundColor: "#14b8a6",
        alignItems: "center",
        justifyContent: "center",
    },
    flipFrontLabel: {
        fontSize: 10,
        fontWeight: "900",
        letterSpacing: 3,
        color: "#34d399",
        marginBottom: 8,
    },
    flipFrontTitle: {
        fontSize: 22,
        fontWeight: "800",
        color: "#fff",
        textAlign: "center",
        lineHeight: 28,
        marginBottom: 20,
    },
    flipFrontTitleAccent: {
        color: "#6ee7b7",
    },
    flipFrontHint: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 999,
        backgroundColor: "rgba(255,255,255,0.05)",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.1)",
    },
    flipFrontHintText: {
        fontSize: 12,
        fontWeight: "600",
        color: "#9ca3af",
    },
    flipFrontBottomLine: {
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        height: 6,
        backgroundColor: "rgba(16,185,129,0.4)",
    },
});
