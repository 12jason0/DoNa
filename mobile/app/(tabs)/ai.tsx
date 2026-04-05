/**
 * AI 추천 화면
 * 웹 src/app/(home)/personalized-home/page.tsx 기반
 * — 랜딩 히어로 + 채팅 전체화면 모달
 */
import React, { useState, useRef, useEffect, useMemo } from "react";
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
import type { Course } from "../../src/types/api";
import { useLocale } from "../../src/lib/useLocale";
import { useModal, type LimitCtx } from "../../src/lib/modalContext";
import { pickCourseTitle, pickCourseDescription } from "../../src/lib/courseLocalized";

type TI18n = (key: string, params?: Record<string, string | number>) => string;

type FlowOption = { text: string; value: string; next: string };
type Question = { id: string; text: string; options: FlowOption[] };

const ANALYSIS_KEY_CYCLE = [
    "mobileAnalysis1",
    "mobileAnalysis2",
    "mobileAnalysis3",
    "mobileAnalysis4",
] as const;

function buildChatFlow(i18n: TI18n): Question[] {
    const T = (k: string) => i18n(`personalizedHome.${k}`);
    return [
        {
            id: "greeting",
            text: T("mobileChatGreeting"),
            options: [
                { text: `✨ ${T("heroCta")}`, value: "start", next: "purpose_today" },
                { text: `👀 ${T("qGreetingPreview")}`, value: "preview", next: "preview" },
            ],
        },
        {
            id: "preview",
            text: i18n("authPage.signup.previewPurposeLead"),
            options: [{ text: i18n("authPage.signup.previewStartCta"), value: "start", next: "purpose_today" }],
        },
        {
            id: "purpose_today",
            text: T("qPurpose"),
            options: [
                { text: `🎉 ${T("qGoalAnniversary")}`, value: "기념일", next: "goal_detail" },
                { text: `😊 ${T("qGoalNormal")}`, value: "무난", next: "companion_today" },
                { text: `🌙 ${T("qGoalEmotional")}`, value: "감성", next: "companion_today" },
                { text: `🏃 ${T("qGoalActive")}`, value: "활동", next: "companion_today" },
                { text: `✨ ${T("qPurposeTrendy")}`, value: "트렌디", next: "companion_today" },
            ],
        },
        {
            id: "goal_detail",
            text: T("qGoalDetail"),
            options: [
                { text: `💑 ${T("qGoalDetail100")}`, value: "100일", next: "companion_today" },
                { text: `🎂 ${T("qGoalDetailBirthday")}`, value: "생일", next: "companion_today" },
                { text: `🎄 ${T("qGoalDetailYearEnd")}`, value: "연말", next: "companion_today" },
            ],
        },
        {
            id: "companion_today",
            text: T("mobileChatWho"),
            options: [
                { text: `💑 ${T("qCompanionLover")}`, value: "연인", next: "region_today" },
                { text: `💌 ${T("mobileCompanionSomeLabel")}`, value: "썸 상대", next: "region_today" },
                { text: `🤝 ${T("mobileCompanionBlindLabel")}`, value: "소개팅 상대", next: "region_today" },
                { text: `👯 ${T("qCompanionFriend")}`, value: "친구", next: "region_today" },
                { text: `🚶 ${T("qCompanionAlone")}`, value: "혼자", next: "region_today" },
            ],
        },
        {
            id: "region_today",
            text: T("mobileChatWhere"),
            options: [
                { text: `🏭 ${T("qRegionMulla")}`, value: "문래·영등포", next: "complete" },
                { text: `🌉 ${T("qRegionHapjeong")}`, value: "합정·용산", next: "complete" },
                { text: `🏛️ ${T("qRegionAnguk")}`, value: "안국·서촌", next: "complete" },
                { text: `🏙️ ${T("qRegionEuljiro")}`, value: "을지로", next: "complete" },
                { text: `🌸 ${T("qRegionYeouido")}`, value: "여의도", next: "complete" },
            ],
        },
    ];
}


const DONA_LOGO = "https://d13xx6k6chk2in.cloudfront.net/logo/donalogo_512.png";
const DEFAULT_PROFILE = "https://d13xx6k6chk2in.cloudfront.net/profileLogo.png";

type Message = { type: "ai" | "user"; text: string };
type Answers = Record<string, string>;

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

function getMatchBadge(
    i18n: TI18n,
    matchScore: number | null | undefined,
): {
    text: string;
    tone: "strong" | "good" | "soft" | "neutral";
} {
    const T = (k: string) => i18n(`personalizedHome.${k}`);
    if (matchScore == null) return { text: T("mobileMatchNeutral"), tone: "neutral" };
    if (matchScore >= 0.9) return { text: T("mobileMatchPerfect"), tone: "strong" };
    if (matchScore >= 0.75) return { text: T("mobileMatchGood"), tone: "good" };
    if (matchScore >= 0.6) return { text: T("mobileMatchSoft"), tone: "soft" };
    return { text: T("mobileMatchShort"), tone: "neutral" };
}

function ResultCard({
    course,
    nickname,
    isRevealed,
    onReveal,
    onDetail,
    onSelect,
    i18n,
}: {
    course: Course;
    nickname: string;
    isRevealed: boolean;
    onReveal: () => void;
    onDetail: (c: Course) => void;
    onSelect: (c: Course) => void;
    i18n: TI18n;
}) {
    const t = useThemeColors();
    const { locale } = useLocale();
    const T = (k: string, p?: Record<string, string | number>) => i18n(`personalizedHome.${k}`, p);

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
                    <Text style={s.flipFrontLabel}>{T("mobileFlipAiLabel")}</Text>
                    <Text style={s.flipFrontTitle}>
                        {T("cardForNickname", { nickname: nickname || T("mobileGuest") })}
                        {"\n"}
                        <Text style={s.flipFrontTitleAccent}>{T("cardCustomCourse")}</Text>
                    </Text>
                    <View style={s.flipFrontHint}>
                        <Text style={s.flipFrontHintText}>{T("mobileTouchOpen")}</Text>
                    </View>
                </View>
                <View style={s.flipFrontBottomLine} />
            </TouchableOpacity>
        );
    }

    const badge = getMatchBadge(i18n, course.matchScore);
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
                    {pickCourseTitle(course, locale)}
                </Text>

                {/* 설명 */}
                {course.description ? (
                    <Text style={[s.resultDesc, { color: t.textMuted }]} numberOfLines={2}>
                        {pickCourseDescription(course, locale) || course.description}
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
                            {course.duration ?? T("mobileDurationApprox")}
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
                            {T("mobileDetailView")}
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[s.resultBtn, { flex: 1 }]}
                        onPress={() => onSelect(course)}
                        activeOpacity={0.85}
                    >
                        <Text style={s.resultBtnText}>{T("mobileSelectArrow")}</Text>
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
    const { t: i18n, locale } = useLocale();
    const flow = useMemo(() => buildChatFlow(i18n), [i18n, locale]);
    const insets = useSafeAreaInsets();
    const scrollRef = useRef<ScrollView>(null);
    const nickname =
        (user as any)?.nickname || (user as any)?.name || i18n("personalizedHome.mobileGuest");

    const [messages, setMessages] = useState<Message[]>([]);
    const [currentQ, setCurrentQ] = useState<Question>(() => flow[0]);
    const [answers, setAnswers] = useState<Answers>({});
    const [isTyping, setIsTyping] = useState(false);
    const [isComplete, setIsComplete] = useState(false);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [analysisText, setAnalysisText] = useState(() =>
        i18n(`personalizedHome.${ANALYSIS_KEY_CYCLE[0]}`),
    );
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
        setAnalysisText(i18n(`personalizedHome.${ANALYSIS_KEY_CYCLE[0]}`));
        const timer = setInterval(() => {
            i = (i + 1) % ANALYSIS_KEY_CYCLE.length;
            setAnalysisText(i18n(`personalizedHome.${ANALYSIS_KEY_CYCLE[i]}`));
        }, 1000);
        return () => clearInterval(timer);
    }, [isAnalyzing, i18n]);

    // 모달 열릴 때 초기화
    useEffect(() => {
        if (!visible) return;
        setMessages([]);
        setAnswers({});
        setIsComplete(false);
        setCourses([]);
        setRevealedCards({});
        setCurrentQ(flow[0]);
        setProgress(0);
        setDetailCourse(null);
        setConfirmCourse(null);
        setFeedbackCourseId(null);
        setTimeout(() => addAiMsg(flow[0].text), 200);
    }, [visible, flow]);

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

    async function handleOption(option: FlowOption) {
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
                            text: i18n("personalizedHome.mobileChatLoginBlock"),
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
                        i18n("personalizedHome.mobileChatFoundTpl", {
                            region: newAnswers.region_today ?? "",
                            goal: newAnswers.purpose_today ?? "",
                        }),
                    );
                } else {
                    addAiMsg(i18n("personalizedHome.resultNoMatch"));
                }
            }
        } else {
            const nextQ = flow.find((q) => q.id === option.next);
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
        setCurrentQ(flow[0]);
        setProgress(0);
        addAiMsg(flow[0].text);
    }

    return (
        <Modal visible={visible} animationType="fade" transparent={false} onRequestClose={onClose} statusBarTranslucent>
            <View style={[s.chatModal, { backgroundColor: t.bg, paddingTop: insets.top }]}>
                {/* 채팅 헤더 */}
                <View style={[s.chatHeader, { backgroundColor: t.card, borderBottomColor: t.border }]}>
                    <View style={s.chatHeaderLeft}>
                        <Image source={{ uri: DONA_LOGO }} style={s.botAvatar} resizeMode="cover" />
                        <View>
                            <Text style={[s.botName, { color: t.text }]}>{i18n("personalizedHome.aiDoNa")}</Text>
                            <View style={s.liveRow}>
                                <View style={s.liveDot} />
                                <Text style={s.liveText}>{i18n("personalizedHome.analyzingLive")}</Text>
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
                            <Text style={[s.resultsTitle, { color: t.text }]}>
                                {i18n("personalizedHome.mobileResultsCount", { count: courses.length })}
                            </Text>
                            {courses.map((c) => (
                                <ResultCard
                                    key={c.id}
                                    course={c}
                                    nickname={nickname}
                                    isRevealed={!!revealedCards[String(c.id)]}
                                    onReveal={() => setRevealedCards((prev) => ({ ...prev, [String(c.id)]: true }))}
                                    onDetail={(course) => setDetailCourse(course)}
                                    onSelect={(course) => setConfirmCourse(course)}
                                    i18n={i18n}
                                />
                            ))}
                        </View>
                    )}

                    {isComplete && courses.length === 0 && (
                        <View style={s.empty}>
                            <Text style={{ fontSize: 48 }}>🗺️</Text>
                            <Text style={[s.emptyText, { color: t.textMuted }]}>
                                {i18n("personalizedHome.noCourses")}
                            </Text>
                            <TouchableOpacity style={s.retryBtn} onPress={handleReset}>
                                <Text style={s.retryText}>{i18n("personalizedHome.retryBtn")}</Text>
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
                            <Text style={s.doneBtnText}>{i18n("personalizedHome.mobileRecommendAgain")}</Text>
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
                                        {detailCourse.duration ?? i18n("personalizedHome.mobileDurationApprox")}
                                    </Text>
                                    <Ionicons name="chevron-forward" size={13} color={t.textMuted} />
                                    <Ionicons name="walk-outline" size={15} color="#059669" />
                                    <Text style={[s.detailMetaBarText, { color: t.isDark ? "#d1d5db" : "#374151" }]}>
                                        {i18n("personalizedHome.walkingCentered")}
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
                                                            style={[{ fontSize: 14, fontWeight: "500", color: t.text }]}
                                                            numberOfLines={1}
                                                        >
                                                            {cp.place?.name ?? i18n("personalizedHome.placeFallback")}
                                                        </Text>
                                                        <Text
                                                            style={[{ fontSize: 11, color: t.textMuted, marginTop: 2 }]}
                                                            numberOfLines={1}
                                                        >
                                                            {cp.place?.category
                                                                ? `${cp.place.category} · ${i18n("personalizedHome.spotNth", { n: idx + 1 })}`
                                                                : i18n("personalizedHome.spotNth", { n: idx + 1 })}
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
                                    <Text style={s.detailCtaBtnText}>{i18n("personalizedHome.courseStart")}</Text>
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
                            <Text style={[s.confirmTitle, { color: t.text }]}>{i18n("personalizedHome.confirmModalTitle")}</Text>
                            <Text style={[s.confirmDesc, { color: t.textMuted }]}>
                                <Text style={{ color: "#059669", fontWeight: "500" }}>"{confirmCourse.title}"</Text>
                                {"\n"}
                                {i18n("personalizedHome.confirmModalSaved")}
                            </Text>
                            <View style={[s.confirmBtns, { borderTopColor: t.border }]}>
                                <TouchableOpacity style={s.confirmCancel} onPress={() => setConfirmCourse(null)}>
                                    <Text style={[s.confirmCancelText, { color: t.textMuted }]}>{i18n("common.cancel")}</Text>
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
                                    <Text style={s.confirmOkText}>
                                        {isSelecting ? i18n("personalizedHome.saving") : i18n("personalizedHome.saveBtn")}
                                    </Text>
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
                        <Text style={[s.feedbackTitle, { color: t.text }]}>{i18n("personalizedHome.feedbackTitle")}</Text>
                        {[
                            { label: i18n("personalizedHome.feedbackGood"), value: "GOOD", emoji: "👍" },
                            { label: i18n("personalizedHome.feedbackOk"), value: "OK", emoji: "😐" },
                            { label: i18n("personalizedHome.feedbackBad"), value: "BAD", emoji: "👎" },
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
    const { t: i18n } = useLocale();
    const { user } = useAuth();
    const [chatOpen, setChatOpen] = useState(false);
    const { openModal } = useModal();

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
                openModal("limitExceeded", { ctx: { tier: pre.tier, limit: pre.limit, used: pre.used }, onUpgrade: () => openModal("ticket", { context: "UPGRADE" }) });
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
                openModal("limitExceeded", { ctx: { tier: pre.tier, limit: pre.limit, used: pre.used }, onUpgrade: () => openModal("ticket", { context: "UPGRADE" }) });
                return;
            }
        } catch {}
        setChatOpen(true);
    }

    const nickname =
        (user as any)?.nickname || (user as any)?.name || i18n("personalizedHome.mobileGuest");

    return (
        <SafeAreaView style={[s.root, { backgroundColor: t.bg }]} edges={["top"]}>
            <AppHeaderWithModals />

            <ScrollView contentContainerStyle={s.landingContent} showsVerticalScrollIndicator={false}>
                {/* 유저 프로필 카드 */}
                <View style={[s.profileCard, { backgroundColor: t.card, borderColor: t.border }]}>
                    <View style={s.profileCardLeft}>
                        <Text style={[s.profileCardHint, { color: t.textMuted }]}>
                            {i18n("personalizedHome.whatKindOfDay")}
                        </Text>
                        <Text style={[s.profileCardGreeting, { color: t.text }]}>
                            {user ? (
                                <>
                                    {(() => {
                                        const raw = i18n("personalizedHome.mobileHelloLogged", { nickname });
                                        const idx = raw.indexOf(nickname);
                                        if (idx < 0) return <>{raw}</>;
                                        return (
                                            <>
                                                {raw.slice(0, idx)}
                                                <Text style={s.profileCardName}>{nickname}</Text>
                                                {raw.slice(idx + nickname.length)}
                                            </>
                                        );
                                    })()}
                                </>
                            ) : (
                                i18n("personalizedHome.mobileProfileGuestLine")
                            )}
                        </Text>
                        {!user && (
                            <TouchableOpacity
                                style={s.loginHintBtn}
                                onPress={() => router.push("/(auth)/login" as any)}
                                activeOpacity={0.85}
                            >
                                <Text style={s.loginHintText}>{i18n("personalizedHome.mobileLoginHintChip")}</Text>
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
                        {(() => {
                            const lines = i18n("personalizedHome.mobileHeroBlurb").split("\n");
                            return (
                                <>
                                    <Text style={s.heroTitleGreen}>{lines[0]}</Text>
                                    {lines[1] ? (
                                        <>
                                            {"\n"}
                                            {lines.slice(1).join("\n")}
                                        </>
                                    ) : null}
                                </>
                            );
                        })()}
                    </Text>
                    <Text style={[s.heroSubtitle, { color: t.textMuted }]}>
                        {i18n("personalizedHome.heroSubtitle")}
                    </Text>

                    {/* CTA 버튼 */}
                    <TouchableOpacity style={s.ctaBtn} onPress={handleOpenChat} activeOpacity={0.88}>
                        <Text style={s.ctaBtnText}>{i18n("personalizedHome.heroCta")}</Text>
                        <Ionicons name="chevron-forward" size={18} color="#fff" />
                    </TouchableOpacity>

                    <View style={s.heroHintRow}>
                        <View style={s.heroHintDot} />
                        <Text style={[s.heroHintText, { color: t.textMuted }]}>
                            {i18n("personalizedHome.mobileHeroFooter")}
                        </Text>
                    </View>
                </View>
            </ScrollView>

            <ChatModal
                visible={chatOpen}
                onClose={() => setChatOpen(false)}
                onLimitExceeded={(ctx) => openModal("limitExceeded", { ctx, onUpgrade: () => openModal("ticket", { context: "UPGRADE" }) })}
                user={user}
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
    profileCardHint: { fontSize: 11, fontWeight: "500", letterSpacing: 0.2 },
    profileCardGreeting: { fontSize: 17, fontWeight: "600", lineHeight: 24, letterSpacing: -0.3 },
    profileCardName: { color: "#059669", fontWeight: "600" },
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
    loginHintText: { fontSize: 11, fontWeight: "500", color: "#047857" },
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
        fontWeight: "600",
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
    ctaBtnText: { fontSize: 16, fontWeight: "500", color: "#fff", letterSpacing: -0.3 },
    heroHintRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 12 },
    heroHintDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#10b981" },
    heroHintText: { fontSize: 11, fontWeight: "500" },

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
    badgeText: { fontSize: 11, fontWeight: "500" },

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
    botName: { fontSize: 15, fontWeight: "500" },
    liveRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 1 },
    liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#10b981" },
    liveText: { fontSize: 11, color: "#059669", fontWeight: "500" },
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
    resultsTitle: { fontSize: 17, fontWeight: "500", letterSpacing: -0.3, marginTop: 8 },
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
    matchBadgeText: { fontSize: 11, fontWeight: "600" },
    resultTitle: { fontSize: 20, fontWeight: "500", letterSpacing: -0.5, marginBottom: 8 },
    resultDesc: { fontSize: 13, lineHeight: 19, marginBottom: 10 },
    matchChips: { flexDirection: "row", flexWrap: "wrap", gap: 5, marginBottom: 14 },
    matchChip: {
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 999,
        borderWidth: 1,
    },
    matchChipText: { fontSize: 11, fontWeight: "500" },
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
    resultMetaBoxText: { fontSize: 12, fontWeight: "500", flex: 1 },
    resultBtn: {
        backgroundColor: "#059669",
        paddingVertical: 14,
        borderRadius: 16,
        alignItems: "center",
    },
    resultBtnText: { fontSize: 14, fontWeight: "500", color: "#fff" },
    resultBtnSecondary: { paddingVertical: 14, borderRadius: 16, alignItems: "center" },
    resultBtnSecondaryText: { fontSize: 14, fontWeight: "500" },

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
    detailTitle: { fontSize: 18, fontWeight: "500", letterSpacing: -0.3 },
    detailMetaBar: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        paddingHorizontal: 14,
        paddingVertical: 12,
        borderRadius: 14,
        marginTop: 4,
    },
    detailMetaBarText: { fontSize: 12, fontWeight: "500", flexShrink: 1 },
    placeRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderRadius: 14, borderWidth: 1 },
    placeNum: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: "#059669",
        alignItems: "center",
        justifyContent: "center",
    },
    placeNumText: { fontSize: 12, fontWeight: "500", color: "#fff" },
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
    detailCtaBtnText: { fontSize: 15, fontWeight: "500", color: "#fff" },

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
    confirmTitle: { fontSize: 20, fontWeight: "600", textAlign: "center", paddingHorizontal: 24 },
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
    confirmCancelText: { fontSize: 15, fontWeight: "500" },
    confirmOk: { flex: 1, paddingVertical: 20, alignItems: "center", backgroundColor: "#059669" },
    confirmOkText: { fontSize: 15, fontWeight: "500", color: "#fff" },

    // 피드백 모달
    feedbackBox: { width: "100%", borderRadius: 28, padding: 28 },
    feedbackTitle: { fontSize: 20, fontWeight: "600", textAlign: "center", marginBottom: 20 },
    feedbackBtn: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderRadius: 16,
        marginBottom: 10,
    },
    feedbackBtnText: { fontSize: 15, fontWeight: "500" },

    // 빈 결과
    empty: { alignItems: "center", paddingVertical: 40, gap: 12 },
    emptyText: { fontSize: 14, textAlign: "center" },
    retryBtn: { backgroundColor: "#059669", paddingHorizontal: 20, paddingVertical: 10, borderRadius: 999 },
    retryText: { fontSize: 13, fontWeight: "500", color: "#fff" },

    // 옵션 영역
    optionsWrap: { borderTopWidth: StyleSheet.hairlineWidth, maxHeight: 220 },
    optionsContent: { padding: 12 },
    optionsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "center" },
    optBtn: { paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12, borderWidth: 1 },
    optBtnPrimary: { backgroundColor: "#059669", borderColor: "#059669" },
    optText: { fontSize: 14, fontWeight: "500" },
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
    doneBtnText: { fontSize: 15, fontWeight: "500", color: "#fff" },

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
    overlayTitle: { fontSize: 20, fontWeight: "500", color: "#fff" },
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
        fontWeight: "700",
        letterSpacing: 3,
        color: "#34d399",
        marginBottom: 8,
    },
    flipFrontTitle: {
        fontSize: 22,
        fontWeight: "600",
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
        fontWeight: "500",
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
