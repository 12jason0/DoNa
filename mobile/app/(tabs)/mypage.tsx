/**
 * 마이페이지 화면 — 웹 mypage 탭 구조 완전 구현
 *  - 프로필: 사용자 정보·수정·로그아웃·카카오 채널·탈퇴
 *  - 발자취: 활동 캘린더 + 나만의 추억 갤러리
 *  - 기록: 찜하기 / AI추천저장 / 완료코스 / 케이스파일
 *  - 활동: 뱃지 / 보상내역 / 결제내역
 */
import React, { useState, useMemo, useEffect, useCallback } from "react";
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    TextInput,
    ActivityIndicator,
    Modal,
    Alert,
    RefreshControl,
    Image,
    Linking,
    Dimensions,
    Platform,
    Switch,
    Pressable,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { router, useLocalSearchParams, useFocusEffect } from "expo-router";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import Purchases from "react-native-purchases";
import { Ionicons } from "@expo/vector-icons";

import { Colors, FontSize, Spacing, BorderRadius, Shadow } from "../../src/constants/theme";
import { api, endpoints } from "../../src/lib/api";
import { fetchMyPrivateStories } from "../../src/lib/personalStories";
import { useAuth, AUTH_QUERY_KEY, logout } from "../../src/hooks/useAuth";
import { useThemeColors } from "../../src/hooks/useThemeColors";
import { useLocale } from "../../src/lib/useLocale";
import { resolveImageUrl } from "../../src/lib/imageUrl";
import { KAKAO_CHANNEL_CHAT_URL } from "../../src/config";
import PageLoadingOverlay from "../../src/components/PageLoadingOverlay";
import AppHeaderWithModals from "../../src/components/AppHeaderWithModals";
import { MODAL_ANDROID_PROPS } from "../../src/constants/modalAndroidProps";
import NativeLegalModal, { type NativeLegalPage } from "../../src/components/NativeLegalModal";
import TicketPlansSheet from "../../src/components/TicketPlansSheet";
import MemoryDetailModal, { type MemoryDetailStory } from "../../src/components/MemoryDetailModal";
import type { UserProfile, SubscriptionTier } from "../../src/types/api";

const SW = Dimensions.get("window").width;

// ─── 타입 ─────────────────────────────────────────────────────────────────────

interface Favorite {
    id: number;
    courseId?: number;
    course: {
        id: number;
        title: string;
        imageUrl?: string | null;
        grade: string;
        region?: string | null;
        rating?: number | null;
        concept?: string | null;
    };
}

interface CompletedCourse {
    id: number;
    courseId: number;
    completedAt: string;
    course: {
        id: number;
        title: string;
        imageUrl?: string | null;
        grade: string;
        region?: string | null;
        concept?: string | null;
    };
}

interface CasefileItem {
    id: number;
    title?: string;
    region?: string;
    completedAt?: string;
    imageUrl?: string | null;
    badge?: { name: string; image_url?: string | null } | null;
}

interface Badge {
    id: number;
    name: string;
    description?: string | null;
    image_url?: string | null;
    awarded_at: string;
}

interface RewardRow {
    id: number;
    type: string;
    amount: number;
    createdAt: string;
}

interface PaymentHistory {
    id: string;
    orderName: string;
    amount: number;
    status: string;
    approvedAt: string;
    method?: string | null;
}

interface PersonalStory {
    id: number;
    courseId?: number;
    content?: string;
    rating?: number;
    imageUrls?: string[];
    tags?: string[];
    createdAt: string;
    course?: { id: number; title: string; imageUrl?: string | null; region?: string | null };
    placeData?: Record<string, { photos?: string[]; tags?: string[] }>;
}

interface UserPreferences {
    concept: string[];
    mood: string[];
    regions: string[];
}

// ─── 상수 ─────────────────────────────────────────────────────────────────────

const TABS = [
    { id: "profile", label: "프로필", icon: "person-outline" as const },
    { id: "footprint", label: "발자취", icon: "footsteps-outline" as const },
    { id: "records", label: "기록", icon: "bookmark-outline" as const },
    { id: "activity", label: "활동", icon: "trophy-outline" as const },
] as const;

type TabId = (typeof TABS)[number]["id"];

const DAY_NAMES = ["일", "월", "화", "수", "목", "금", "토"];
/** 원 크기: tabContent(16×2) + calCard(14×2) 제외한 너비 기준 */
const CAL_CIRCLE = Math.min(Math.floor((SW - 60) / 7) - 4, 44);

/** GET /api/users/me/courses 응답: 배열 또는 { savedCourses } */
function parseSavedCoursesResponse(d: unknown): any[] {
    if (Array.isArray(d)) return d;
    if (d && typeof d === "object" && Array.isArray((d as { savedCourses?: unknown }).savedCourses)) {
        return (d as { savedCourses: any[] }).savedCourses;
    }
    return [];
}

type AiCalendarSlot = {
    courseId: number;
    imageUrl: string | null | undefined;
    title?: string | null;
    description?: string | null;
    region?: string | null;
    concept?: string | null;
};

type DateCoursePreviewRow = {
    course: {
        id: number;
        title?: string | null;
        description?: string | null;
        imageUrl?: string | null;
        region?: string | null;
        concept?: string | null;
    };
    isAI: boolean;
};

const REWARD_LABELS: Record<string, string> = {
    checkin: "7일 체크인 보상",
    escape_place_clear: "미션 클리어 보상",
    signup: "회원가입 보너스",
    ad_watch: "광고 시청 보상",
    purchase: "구매 보상",
    event: "이벤트 보상",
    personal_memory_milestone: "추억 10개 달성 보상",
    course_completion_milestone: "코스 완료 보상",
};

function gradeBg(g: string) {
    if (g === "PREMIUM") return "#fef3c7";
    if (g === "BASIC") return "#dbeafe";
    return "#dcfce7";
}
function gradeColor(g: string) {
    if (g === "PREMIUM") return "#d97706";
    if (g === "BASIC") return "#1d4ed8";
    return "#15803d";
}

// ─── 공통: 서브탭 바 ──────────────────────────────────────────────────────────

function SubTabBar<T extends string>({
    tabs,
    active,
    onSelect,
    t,
}: {
    tabs: { id: T; label: string; count?: number }[];
    active: T;
    onSelect: (id: T) => void;
    t: ReturnType<typeof useThemeColors>;
}) {
    return (
        <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={[s.subTabBar, { backgroundColor: t.isDark ? "#1f2937" : "#f3f4f6", borderColor: "transparent" }]}
            contentContainerStyle={s.subTabBarContent}
        >
            {tabs.map((tab) => (
                <TouchableOpacity
                    key={tab.id}
                    onPress={() => onSelect(tab.id)}
                    style={[
                        s.subTabBtn,
                        { backgroundColor: active === tab.id ? "#0f172a" : t.isDark ? "#374151" : "#e5e7eb" },
                    ]}
                >
                    <Text style={[s.subTabText, { color: active === tab.id ? "#fff" : t.textMuted }]}>
                        {tab.label}
                        {tab.count !== undefined ? ` (${tab.count})` : ""}
                    </Text>
                </TouchableOpacity>
            ))}
        </ScrollView>
    );
}

// ─── 공통: 코스 카드 ──────────────────────────────────────────────────────────

function CourseListCard({
    title,
    imageUrl,
    grade,
    concept,
    region,
    date,
    onPress,
    onRemove,
    t,
}: {
    title: string;
    imageUrl?: string | null;
    grade?: string;
    concept?: string | null;
    region?: string | null;
    date?: string;
    onPress?: () => void;
    onRemove?: () => void;
    t: ReturnType<typeof useThemeColors>;
}) {
    const uri = resolveImageUrl(imageUrl);
    const g = (grade ?? "FREE").toUpperCase();
    return (
        <TouchableOpacity
            style={[s.courseCardVertical, { backgroundColor: t.card, borderColor: t.border }]}
            onPress={onPress}
            activeOpacity={0.88}
        >
            <View style={s.courseCardImgWrap}>
                {uri ? (
                    <Image source={{ uri }} style={s.courseCardImgFull} resizeMode="cover" />
                ) : (
                    <View
                        style={[
                            s.courseCardImgFull,
                            { backgroundColor: t.surface, alignItems: "center", justifyContent: "center" },
                        ]}
                    >
                        <Text style={{ fontSize: 28 }}>📍</Text>
                    </View>
                )}
                <View style={s.courseCardBadgeRow} pointerEvents="box-none">
                    <View style={[s.courseCardGradePill, { backgroundColor: gradeBg(g) }]}>
                        <Text style={[s.courseCardGradePillText, { color: gradeColor(g) }]}>{g}</Text>
                    </View>
                    {concept ? (
                        <View style={s.courseCardConceptPill}>
                            <Text style={s.courseCardConceptPillText}>#{concept}</Text>
                        </View>
                    ) : null}
                </View>
                {onRemove ? (
                    <TouchableOpacity
                        style={s.courseCardHeartBtn}
                        onPress={onRemove}
                        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                    >
                        <Ionicons name="heart" size={18} color="#ef4444" />
                    </TouchableOpacity>
                ) : null}
            </View>
            <View style={s.courseCardBodyBelow}>
                <Text style={[s.courseCardTitleBelow, { color: t.text }]} numberOfLines={2}>
                    {title}
                </Text>
                {region ? <Text style={[s.courseCardSubBelow, { color: t.textMuted }]}>📍 {region}</Text> : null}
                {date ? (
                    <Text style={[s.courseCardDateBelow, { color: t.textMuted }]}>
                        {new Date(date).toLocaleDateString("ko-KR")}
                    </Text>
                ) : null}
            </View>
        </TouchableOpacity>
    );
}

// ─── 공통: 빈 상태 ────────────────────────────────────────────────────────────

function EmptyState({
    emoji,
    title,
    sub,
    ctaLabel,
    onCta,
    t,
}: {
    emoji: string;
    title: string;
    sub: string;
    ctaLabel?: string;
    onCta?: () => void;
    t: ReturnType<typeof useThemeColors>;
}) {
    return (
        <View style={s.emptyState}>
            <Text style={s.emptyEmoji}>{emoji}</Text>
            <Text style={[s.emptyTitle, { color: t.text }]}>{title}</Text>
            <Text style={[s.emptySub, { color: t.textMuted }]}>{sub}</Text>
            {ctaLabel && onCta ? (
                <TouchableOpacity style={s.emptyCTA} onPress={onCta}>
                    <Text style={s.emptyCTAText}>{ctaLabel}</Text>
                </TouchableOpacity>
            ) : null}
        </View>
    );
}

// ─── 프로필 탭 ────────────────────────────────────────────────────────────────

function ProfileTab({ profile, tier, refetch }: { profile: UserProfile; tier: SubscriptionTier; refetch: () => void }) {
    const t = useThemeColors();
    const { t: i18n } = useLocale();
    const queryClient = useQueryClient();
    const insets = useSafeAreaInsets();
    const [editVisible, setEditVisible] = useState(false);
    const [form, setForm] = useState({
        nickname: profile.nickname ?? "",
        mbti: profile.mbti ?? "",
        ageRange: profile.ageRange ?? "",
        gender: profile.gender ?? "",
    });
    const [editError, setEditError] = useState("");
    const [notifEnabled, setNotifEnabled] = useState<boolean | null>(null);
    const [notifLoading, setNotifLoading] = useState(false);
    const [shopSheetVisible, setShopSheetVisible] = useState(false);
    const [logoutModalVisible, setLogoutModalVisible] = useState(false);
    const [withdrawalModalVisible, setWithdrawalModalVisible] = useState(false);
    const [withdrawalReasonStep, setWithdrawalReasonStep] = useState(false);
    const [withdrawalReason, setWithdrawalReason] = useState("");
    const [withdrawalEtcReason, setWithdrawalEtcReason] = useState("");
    const [withdrawalAgree, setWithdrawalAgree] = useState(false);
    const [legalPage, setLegalPage] = useState<NativeLegalPage | null>(null);

    // 취향 정보 조회
    const { data: prefs } = useQuery<UserPreferences | null>({
        queryKey: ["users", "preferences"],
        queryFn: async () => {
            const d = await api.get<any>(endpoints.preferences).catch(() => null);
            if (!d) return null;
            const raw = d?.preferences ?? d ?? {};
            const merge = (arr: string[]): string[] => {
                if (!Array.isArray(arr) || !arr.length) return [];
                const result: string[] = [];
                let word = "";
                for (const item of arr) {
                    if (item?.length === 1) {
                        word += item;
                    } else {
                        if (word) {
                            result.push(word);
                            word = "";
                        }
                        if (item) result.push(item);
                    }
                }
                if (word) result.push(word);
                return result;
            };
            const concept = merge(Array.isArray(raw.concept) ? raw.concept : []);
            const mood = merge(Array.isArray(raw.mood) ? raw.mood : []);
            const regions = merge(Array.isArray(raw.regions) ? raw.regions : []);
            if (!concept.length && !mood.length && !regions.length) return null;
            return { concept, mood, regions };
        },
        staleTime: 5 * 60 * 1000,
    });

    // 알림 상태 로드
    useEffect(() => {
        api.get<any>(endpoints.push)
            .then((d) => setNotifEnabled(d?.subscribed ?? false))
            .catch(() => setNotifEnabled(false));
    }, []);

    async function handleNotifToggle() {
        if (notifEnabled === null || notifLoading) return;
        const newVal = !notifEnabled;
        setNotifEnabled(newVal);
        setNotifLoading(true);
        try {
            let pushToken: string | null = null;
            try {
                const Notif = await import("expo-notifications");
                const { status } = await Notif.getPermissionsAsync();
                if (status === "granted") {
                    const t = await Notif.getExpoPushTokenAsync();
                    pushToken = t.data;
                }
            } catch {}
            await api.post(endpoints.push, { pushToken: pushToken ?? "", platform: "expo", subscribed: newVal });
        } catch {
            setNotifEnabled(!newVal);
        } finally {
            setNotifLoading(false);
        }
    }

    const editMutation = useMutation({
        mutationFn: (data: typeof form) => api.patch("/api/users/profile", data),
        onSuccess: () => {
            setEditVisible(false);
            refetch();
        },
        onError: (e: any) => setEditError(e.message || "수정 실패"),
    });

    const deleteMutation = useMutation({
        mutationFn: (reason: string) => api.post("/api/users/withdrawal", { reason }),
        onSuccess: async () => {
            try {
                await Purchases.logOut();
            } catch {}
            await logout(queryClient);
            router.replace("/(auth)/login");
        },
        onError: (e: any) => Alert.alert("오류", e.message || "탈퇴 처리 중 오류가 발생했습니다."),
    });

    async function handleLogoutConfirm() {
        setLogoutModalVisible(false);
        try {
            const isAnon = await Purchases.isAnonymous();
            if (!isAnon) await Purchases.logOut();
        } catch {}
        await logout(queryClient);
        router.replace("/(auth)/login");
    }

    function handleLogout() {
        setLogoutModalVisible(true);
    }

    function handleWithdrawal() {
        setWithdrawalReasonStep(false);
        setWithdrawalReason("");
        setWithdrawalEtcReason("");
        setWithdrawalAgree(false);
        setWithdrawalModalVisible(true);
    }

    function handleWithdrawalClose() {
        if (deleteMutation.isPending) return;
        setWithdrawalModalVisible(false);
    }

    function handleWithdrawalNextOrSubmit() {
        if (!withdrawalReasonStep) {
            setWithdrawalReasonStep(true);
            return;
        }
        if (!withdrawalReason) {
            Alert.alert("안내", "탈퇴 사유를 선택해주세요.");
            return;
        }
        if (withdrawalReason === "reason5" && !withdrawalEtcReason.trim()) {
            Alert.alert("안내", "기타 사유를 입력해주세요.");
            return;
        }
        if (!withdrawalAgree) {
            Alert.alert("안내", "안내사항을 확인하고 동의해 주세요.");
            return;
        }
        const reason = withdrawalReason === "reason5" ? withdrawalEtcReason.trim() : withdrawalReason;
        deleteMutation.mutate(reason);
    }

    const profileImageUri = resolveImageUrl(profile.profileImage);
    const nickname = profile.nickname ?? profile.name ?? "두나 회원";

    const tierCfg = {
        FREE: {
            bg: "#f0fdf4",
            border: "#bbf7d0",
            emoji: "✨",
            tierLabel: "FREE",
            desc: "기본 플랜 • 무료",
            cta: "업그레이드",
            ctaBg: "#059669",
            ctaColor: "#fff",
        },
        BASIC: {
            bg: "#ecfdf5",
            border: "#6ee7b7",
            emoji: "✨",
            tierLabel: "BASIC",
            desc: "BASIC 플랜",
            cta: "플랜 관리",
            ctaBg: "#059669",
            ctaColor: "#fff",
        },
        PREMIUM: {
            bg: "#fffbeb",
            border: "#fde68a",
            emoji: "👑",
            tierLabel: "PREMIUM",
            desc: "PREMIUM 플랜 • 모든 기능 이용",
            cta: "이용 중",
            ctaBg: "#f3f4f6",
            ctaColor: "#6b7280",
        },
    };
    const tc = tierCfg[tier] ?? tierCfg.FREE;

    const tierBadgeCfg = {
        FREE: { bg: "#f3f4f6", color: "#6b7280", border: "#e5e7eb" },
        BASIC: { bg: "#059669", color: "#fff", border: "#059669" },
        PREMIUM: { bg: "#f3e8ff", color: "#7c3aed", border: "#ddd6fe" },
    };
    const tb = tierBadgeCfg[tier] ?? tierBadgeCfg.FREE;

    const MBTI_LIST = ["INTJ","INTP","ENTJ","ENTP","INFJ","INFP","ENFJ","ENFP","ISTJ","ISFJ","ESTJ","ESFJ","ISTP","ISFP","ESTP","ESFP"] as const;
    const AGE_RANGES = ["10대","20대","30대","40대","50대 이상"] as const;
    const GENDERS = [{ label: "남성", value: "M" }, { label: "여성", value: "F" }] as const;

    return (
        <ScrollView style={s.tabScroll} contentContainerStyle={s.tabContent} showsVerticalScrollIndicator={false}>
            {/* ── 1. 프로필 카드 ── */}
            <View style={[s.profileCard, { backgroundColor: t.card, borderColor: t.border }]}>
                {/* 헤더 */}
                <View style={s.profileCardHeader}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                        <Text style={[s.cardTitle, { color: t.text }]}>프로필</Text>
                        <View style={[s.tierBadge, { backgroundColor: tb.bg, borderColor: tb.border }]}>
                            <Text style={[s.tierBadgeText, { color: tb.color }]}>{tier}</Text>
                        </View>
                    </View>
                    <TouchableOpacity
                        style={s.editProfileBtn}
                        onPress={() => {
                            setForm({
                                nickname: profile.nickname ?? "",
                                mbti: profile.mbti ?? "",
                                ageRange: profile.ageRange ?? "",
                                gender: profile.gender ?? "",
                            });
                            setEditError("");
                            setEditVisible(true);
                        }}
                    >
                        <Ionicons name="create-outline" size={13} color="#059669" />
                        <Text style={s.editProfileBtnText}>수정</Text>
                    </TouchableOpacity>
                </View>

                {/* 이미지 + 정보 가로 배치 */}
                <View style={s.profileRow}>
                    <View style={s.avatarRing}>
                        <View style={s.avatarInner}>
                            {profileImageUri ? (
                                <Image source={{ uri: profileImageUri }} style={s.avatarImg} />
                            ) : (
                                <Text style={s.avatarInitial}>{nickname.charAt(0)}</Text>
                            )}
                        </View>
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={[s.profileName, { color: t.text }]}>{nickname}</Text>
                        <Text style={[s.profileEmail, { color: t.textMuted }]} numberOfLines={1}>
                            {profile.email}
                        </Text>
                        <View style={s.profileTagsRow}>
                            {!!profile.ageRange && (
                                <View style={[s.tagChip, { backgroundColor: t.surface }]}>
                                    <Text style={[s.tagChipText, { color: t.textMuted }]}>{profile.ageRange}</Text>
                                </View>
                            )}
                            {!!profile.mbti && (
                                <View style={s.tagChipAmber}>
                                    <Text style={s.tagChipAmberText}>{profile.mbti}</Text>
                                </View>
                            )}
                            {!!profile.createdAt && (
                                <View style={[s.tagChip, { backgroundColor: t.surface }]}>
                                    <Text style={[s.tagChipText, { color: t.textMuted }]}>
                                        가입{" "}
                                        {new Date(profile.createdAt).toLocaleDateString("ko-KR", {
                                            year: "numeric",
                                            month: "short",
                                        })}
                                    </Text>
                                </View>
                            )}
                        </View>
                    </View>
                </View>
            </View>

            {/* ── 2. 취향 정보 ── */}
            <View style={[s.card, { backgroundColor: t.card, borderColor: t.border }]}>
                <View style={s.cardHeaderRow}>
                    <Text style={[s.cardTitle, { color: t.text }]}>내 여행 취향</Text>
                    <TouchableOpacity style={s.darkBtn} onPress={() => router.push("/(auth)/onboarding" as any)}>
                        <Text style={s.darkBtnText}>{prefs ? "수정" : "설정하기"}</Text>
                    </TouchableOpacity>
                </View>
                {prefs ? (
                    <View style={{ gap: 10 }}>
                        {(prefs.concept?.length ?? 0) > 0 && (
                            <View style={[s.prefSection, { backgroundColor: t.surface, borderColor: t.border }]}>
                                <Text style={s.prefLabel}>선호 콘셉트</Text>
                                <View style={s.prefChipRow}>
                                    {prefs.concept.map((item, i) => (
                                        <View key={i} style={s.chipEmerald}>
                                            <Text style={s.chipEmeraldText}>#{item}</Text>
                                        </View>
                                    ))}
                                </View>
                            </View>
                        )}
                        {(prefs.mood?.length ?? 0) > 0 && (
                            <View style={[s.prefSection, { backgroundColor: t.surface, borderColor: t.border }]}>
                                <Text style={s.prefLabel}>선호 분위기</Text>
                                <View style={s.prefChipRow}>
                                    {prefs.mood.map((item, i) => (
                                        <View key={i} style={s.chipOrange}>
                                            <Text style={s.chipOrangeText}>#{item}</Text>
                                        </View>
                                    ))}
                                </View>
                            </View>
                        )}
                        {(prefs.regions?.length ?? 0) > 0 && (
                            <View style={[s.prefSection, { backgroundColor: t.surface, borderColor: t.border }]}>
                                <Text style={s.prefLabel}>관심 지역</Text>
                                <View style={s.prefChipRow}>
                                    {prefs.regions.map((item, i) => (
                                        <View key={i} style={s.chipBlue}>
                                            <Text style={s.chipBlueText}>{item}</Text>
                                        </View>
                                    ))}
                                </View>
                            </View>
                        )}
                    </View>
                ) : (
                    <EmptyState
                        emoji="✨"
                        title="아직 등록된 취향 정보가 없어요"
                        sub="나만의 여행 취향을 설정해보세요"
                        ctaLabel="지금 설정하러 가기"
                        onCta={() => router.push("/(auth)/onboarding" as any)}
                        t={t}
                    />
                )}
            </View>

            {/* ── 3. 멤버십 ── */}
            <View style={[s.memberCard, { backgroundColor: t.card, borderColor: t.border }]}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 16 }}>
                    <View style={{ width: 6, height: 20, backgroundColor: "#7FCC9F", borderRadius: 3 }} />
                    <Text style={[s.cardTitleDark, { color: t.text }]}>내 구독 플랜</Text>
                </View>
                <View style={[s.memberInner, { backgroundColor: t.card, borderColor: t.border }]}>
                    <View style={s.memberLeft}>
                        <View
                            style={[s.memberIconWrap, { backgroundColor: tier === "PREMIUM" ? "#fffbeb" : "#f0fdf4" }]}
                        >
                            <Text style={{ fontSize: 22 }}>{tc.emoji}</Text>
                        </View>
                        <View>
                            <Text style={s.memberSubLabel}>My Membership</Text>
                            <Text style={[s.memberTierText, { color: t.text }]}>
                                {tier === "PREMIUM" ? "프리미엄 플랜" : tier === "BASIC" ? "베이직 플랜" : "무료 플랜"}
                            </Text>
                            {(() => {
                                const expiresAt = profile?.subscriptionExpiresAt ?? profile?.subscription_expires_at;
                                const isValid = tier !== "FREE" && expiresAt && new Date(expiresAt) > new Date();
                                if (!isValid) return null;
                                return (
                                    <Text style={[s.memberDescText, { color: t.textMuted }]}>
                                        {"~ " +
                                            new Date(expiresAt!).toLocaleDateString("ko-KR", {
                                                year: "numeric",
                                                month: "long",
                                                day: "numeric",
                                            })}
                                    </Text>
                                );
                            })()}
                        </View>
                    </View>
                    <TouchableOpacity
                        style={[s.memberBtn, { backgroundColor: tier === "PREMIUM" ? "#f3f4f6" : "#059669" }]}
                        onPress={() => setShopSheetVisible(true)}
                    >
                        <Text style={[s.memberBtnText, { color: tier === "PREMIUM" ? "#6b7280" : "#fff" }]}>
                            {tier === "PREMIUM" ? "이용 중" : "업그레이드"}
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>

            {/* ── 4. 계정 관리 ── */}
            <View style={[s.card, { backgroundColor: t.card, borderColor: t.border }]}>
                <Text style={[s.cardTitle, { color: t.text, marginBottom: 4 }]}>계정 관리</Text>

                {/* 알림 설정 */}
                <View style={[s.settingRow, { borderBottomColor: t.border }]}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                        <View
                            style={[
                                s.settingIconBox,
                                notifEnabled ? s.settingIconBoxOn : { backgroundColor: t.surface },
                            ]}
                        >
                            <Ionicons
                                name={notifEnabled ? "notifications" : "notifications-outline"}
                                size={18}
                                color={notifEnabled ? "#059669" : t.textMuted}
                            />
                        </View>
                        <Text style={[s.settingRowText, { color: t.text }]}>알림 설정</Text>
                    </View>
                    <Switch
                        value={notifEnabled === true}
                        onValueChange={handleNotifToggle}
                        disabled={notifEnabled === null || notifLoading}
                        trackColor={{ false: "#d1d5db", true: "#6ee7b7" }}
                        thumbColor={notifEnabled ? "#059669" : "#f3f4f6"}
                    />
                </View>

                {/* 카카오 채널 */}
                <TouchableOpacity
                    style={[s.settingRow, { borderBottomColor: t.border }]}
                    onPress={() => Linking.openURL(KAKAO_CHANNEL_CHAT_URL)}
                >
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                        <View style={[s.settingIconBox, { backgroundColor: t.surface }]}>
                            <Text style={{ fontSize: 18 }}>💬</Text>
                        </View>
                        <Text style={[s.settingRowText, { color: t.text }]}>카카오 채널 문의</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={t.textMuted} />
                </TouchableOpacity>

                {/* 로그아웃 */}
                <TouchableOpacity style={[s.settingRow, { borderBottomWidth: 0 }]} onPress={handleLogout}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                        <View style={[s.settingIconBox, { backgroundColor: "#fef2f2" }]}>
                            <Ionicons name="log-out-outline" size={18} color="#ef4444" />
                        </View>
                        <Text style={[s.settingRowText, { color: "#ef4444" }]}>로그아웃</Text>
                    </View>
                </TouchableOpacity>
            </View>

            {/* 회원 탈퇴 */}
            <TouchableOpacity style={s.withdrawalBtn} onPress={handleWithdrawal}>
                <Text style={s.withdrawalBtnText}>회원 탈퇴</Text>
            </TouchableOpacity>

            {/* 로그아웃 하단 시트 */}
            <Modal
                visible={logoutModalVisible}
                transparent
                animationType="fade"
                onRequestClose={() => setLogoutModalVisible(false)}
                {...MODAL_ANDROID_PROPS}
            >
                <Pressable style={s.actionSheetDim} onPress={() => setLogoutModalVisible(false)}>
                    <Pressable style={s.actionSheetWrap} onPress={(e) => e.stopPropagation()}>
                        <View style={[s.logoutSheet, { backgroundColor: t.isDark ? "#1a241b" : "#fff", borderTopColor: t.isDark ? "#1f2937" : "#f3f4f6", paddingBottom: Math.max(insets.bottom, 24) }]}>
                            {/* 아이콘 */}
                            <View style={s.logoutIconWrap}>
                                <Ionicons name="log-out-outline" size={52} color={t.isDark ? "#6b7280" : "#9ca3af"} />
                            </View>
                            {/* 텍스트 */}
                            <Text style={[s.logoutTitle, { color: t.text }]}>{i18n("logoutModal.title")}</Text>
                            <Text style={[s.logoutSubtitle, { color: t.textMuted }]}>{i18n("logoutModal.subtitle")}</Text>
                            {/* 버튼 행 */}
                            <View style={s.logoutBtnRow}>
                                <TouchableOpacity style={[s.logoutBtnGray, { backgroundColor: t.isDark ? "#374151" : "#f3f4f6" }]} onPress={() => setLogoutModalVisible(false)} activeOpacity={0.8}>
                                    <Text style={[s.logoutBtnGrayText, { color: t.isDark ? "#d1d5db" : "#374151" }]}>{i18n("logoutModal.stay")}</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={[s.logoutBtnDark, { backgroundColor: t.isDark ? "#1e293b" : "#0f172a" }]} onPress={handleLogoutConfirm} activeOpacity={0.85}>
                                    <Text style={s.logoutBtnDarkText}>{i18n("logoutModal.logout")}</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </Pressable>
                </Pressable>
            </Modal>

            {/* 회원 탈퇴 — 바텀 시트 */}
            <Modal
                visible={withdrawalModalVisible}
                transparent
                animationType="slide"
                onRequestClose={handleWithdrawalClose}
                {...MODAL_ANDROID_PROPS}
            >
                <Pressable style={s.withdrawDim} onPress={handleWithdrawalClose}>
                    <Pressable style={[s.withdrawSheet, { backgroundColor: t.isDark ? "#1a241b" : "#fff" }]} onPress={(e) => e.stopPropagation()}>
                        {/* 드래그 핸들 */}
                        <View style={s.withdrawHandle} />

                        {/* 스크롤 콘텐츠 */}
                        <ScrollView style={{ maxHeight: 480 }} contentContainerStyle={s.withdrawScrollContent} showsVerticalScrollIndicator={false}>
                            {/* 🍃 아이콘 원 */}
                            <View style={s.withdrawEmojiCircle}>
                                <Text style={{ fontSize: 28 }}>🍃</Text>
                            </View>
                            <Text style={[s.withdrawDialogTitle, { color: t.text }]}>{i18n("deleteUsersModal.title")}</Text>

                            {/* 경고 카드 */}
                            <View style={[s.withdrawWarnCard, { backgroundColor: t.isDark ? "#1e2d1f" : "#f9fafb", borderColor: t.isDark ? "#374151" : "#f3f4f6" }]}>
                                <View style={s.withdrawWarnRow}>
                                    <Text style={s.withdrawWarnIcon}>⚠️</Text>
                                    <View style={{ flex: 1 }}>
                                        <Text style={[s.withdrawWarnTitle, { color: t.text }]}>{i18n("deleteUsersModal.warn1Title")}</Text>
                                        <Text style={[s.withdrawWarnDesc, { color: t.textMuted }]}>{i18n("deleteUsersModal.warn1Desc")}</Text>
                                    </View>
                                </View>
                                <View style={[s.withdrawWarnRow, { marginTop: 12 }]}>
                                    <Text style={s.withdrawWarnIcon}>⚖️</Text>
                                    <View style={{ flex: 1 }}>
                                        <Text style={[s.withdrawWarnTitle, { color: t.text }]}>{i18n("deleteUsersModal.warn2Title")}</Text>
                                        <Text style={[s.withdrawWarnDesc, { color: t.textMuted }]}>{i18n("deleteUsersModal.warn2Desc")}</Text>
                                        <Text style={[s.withdrawWarnDesc, { color: t.textMuted }]}>• {i18n("deleteUsersModal.warn2Li1")}</Text>
                                        <Text style={[s.withdrawWarnDesc, { color: t.textMuted }]}>• {i18n("deleteUsersModal.warn2Li2")}</Text>
                                        <Text style={[s.withdrawWarnDesc, { color: t.textMuted, marginTop: 2 }]}>{i18n("deleteUsersModal.warn2Footer")}</Text>
                                    </View>
                                </View>
                            </View>

                            {/* 사유 선택 단계 */}
                            {withdrawalReasonStep && (
                                <View style={[s.withdrawReasonCard, { backgroundColor: t.isDark ? "#1e2d3f" : "#eff6ff", borderColor: t.isDark ? "#1e3a5f" : "#bfdbfe" }]}>
                                    <Text style={[s.withdrawReasonTitle, { color: t.isDark ? "#93c5fd" : "#1e40af" }]}>{i18n("deleteUsersModal.reasonTitle")}</Text>
                                    {(["reason0","reason1","reason2","reason3","reason4","reason5"] as const).map((key) => (
                                        <TouchableOpacity key={key} style={s.reasonRow} onPress={() => setWithdrawalReason(key)} activeOpacity={0.8}>
                                            <View style={[s.reasonRadioOuter, withdrawalReason === key && s.reasonRadioOuterOn]}>
                                                {withdrawalReason === key && <View style={s.reasonRadioInner} />}
                                            </View>
                                            <Text style={[s.reasonRowText, { color: t.text }]}>{i18n(`deleteUsersModal.${key}`)}</Text>
                                        </TouchableOpacity>
                                    ))}
                                    {withdrawalReason === "reason5" && (
                                        <TextInput
                                            style={[s.withdrawEtcInput, { backgroundColor: t.card, borderColor: t.isDark ? "#1e3a5f" : "#bfdbfe", color: t.text }]}
                                            placeholder={i18n("deleteUsersModal.reasonOtherPlaceholder")}
                                            placeholderTextColor={t.textSubtle}
                                            value={withdrawalEtcReason}
                                            onChangeText={setWithdrawalEtcReason}
                                            multiline
                                        />
                                    )}
                                    <TouchableOpacity style={[s.reasonAgreeRow, { borderTopColor: t.isDark ? "#1e3a5f" : "#bfdbfe" }]} onPress={() => setWithdrawalAgree((v) => !v)} activeOpacity={0.8}>
                                        <View style={[s.reasonCheckBox, withdrawalAgree && s.reasonCheckBoxOn]}>
                                            {withdrawalAgree && <Ionicons name="checkmark" size={12} color="#fff" />}
                                        </View>
                                        <Text style={[s.reasonAgreeText, { color: t.textMuted }]}>{i18n("deleteUsersModal.agreeLabel")}</Text>
                                    </TouchableOpacity>
                                </View>
                            )}
                        </ScrollView>

                        {/* 버튼 영역 (하단 고정) */}
                        <View style={[s.withdrawDialogBtns, { paddingBottom: Math.max(insets.bottom, Platform.OS === "android" ? 16 : 8) }]}>
                            <TouchableOpacity style={s.withdrawStayBtn} onPress={handleWithdrawalClose} activeOpacity={0.85}>
                                <Text style={s.withdrawStayBtnText}>{i18n("deleteUsersModal.stay")}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={s.withdrawDangerTextBtn}
                                onPress={handleWithdrawalNextOrSubmit}
                                disabled={deleteMutation.isPending || (withdrawalReasonStep && !withdrawalAgree)}
                            >
                                {deleteMutation.isPending ? (
                                    <ActivityIndicator size="small" color="#ef4444" />
                                ) : (
                                    <Text style={[s.withdrawDangerTextBtnText, (!withdrawalReasonStep) && { color: "#9ca3af" }]}>
                                        {withdrawalReasonStep ? i18n("deleteUsersModal.deleteAccount") : i18n("deleteUsersModal.withdraw")}
                                    </Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </Pressable>
                </Pressable>
            </Modal>

            {/* ── 사업자 정보 + 링크 ── */}
            <View style={[s.footerInfoBox, { borderTopColor: t.border }]}>
                <Text style={[s.footerInfoTitle, { color: t.text }]}>사업자 정보</Text>
                <View style={{ gap: 3 }}>
                    <Text style={[s.footerInfoLine, { color: t.textMuted, fontWeight: "600" }]}>(주)두나 (DoNa)</Text>
                    <Text style={[s.footerInfoLine, { color: t.textMuted }]}>
                        대표: 오승용 | 사업자등록번호: 166-10-03081
                    </Text>
                    <Text style={[s.footerInfoLine, { color: t.textMuted }]}>
                        통신판매업 신고번호: 제 2025-충남홍성-0193 호
                    </Text>
                    <Text style={[s.footerInfoLine, { color: t.textMuted }]}>
                        주소: 충청남도 홍성군 홍북읍 신대로 33
                    </Text>
                    <Text style={[s.footerInfoLine, { color: t.textMuted }]}>문의: 12jason@donacouse.com</Text>
                    <Text style={[s.footerInfoLine, { color: t.textMuted }]}>고객센터: 010-2481-9824</Text>
                </View>
                <View style={[s.footerLinkGrid, { paddingBottom: 35 }]}>
                    {(
                        [
                            { label: "서비스 소개", page: "about" as const },
                            { label: "이용 안내", page: "help" as const },
                            { label: "개인정보처리방침", page: "privacy" as const },
                            { label: "이용약관", page: "terms" as const },
                        ] as const
                    ).map(({ label, page }) => (
                        <Pressable
                            key={label}
                            onPress={() => setLegalPage(page)}
                            style={({ pressed }) => [
                                s.footerLinkItem,
                                pressed && { opacity: 0.72 },
                            ]}
                            android_ripple={{ color: "rgba(0,0,0,0.08)", borderless: false }}
                        >
                            <Text style={[s.footerLinkText, { color: t.textMuted }]}>{label}</Text>
                        </Pressable>
                    ))}
                </View>
            </View>

            <NativeLegalModal page={legalPage} onClose={() => setLegalPage(null)} />

            <TicketPlansSheet
                visible={shopSheetVisible}
                onClose={() => setShopSheetVisible(false)}
                context="UPGRADE"
            />

            {/* 프로필 수정 모달 — 웹과 동일한 바텀시트 스타일 */}
            <Modal
                visible={editVisible}
                transparent
                animationType="slide"
                onRequestClose={() => setEditVisible(false)}
                {...MODAL_ANDROID_PROPS}
            >
                <Pressable
                    style={s.editModalBackdrop}
                    onPress={() => setEditVisible(false)}
                >
                    <Pressable
                        style={[s.editModalSheet, { backgroundColor: t.isDark ? "#1a241b" : "#fff" }]}
                        onPress={(e) => e.stopPropagation()}
                    >
                        {/* 드래그 핸들 */}
                        <View style={s.editModalHandle}>
                            <View style={[s.editModalHandleBar, { backgroundColor: t.isDark ? "#4b5563" : "#d1d5db" }]} />
                        </View>

                        {/* 헤더 */}
                        <View style={s.editModalHeaderRow}>
                            <Text style={[s.editModalTitle, { color: t.text }]}>프로필 수정</Text>
                            <TouchableOpacity onPress={() => setEditVisible(false)} hitSlop={12}>
                                <Ionicons name="close" size={22} color={t.textMuted} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView
                            contentContainerStyle={s.editModalScroll}
                            showsVerticalScrollIndicator={false}
                            keyboardShouldPersistTaps="handled"
                        >
                            {!!editError && (
                                <View style={s.editError}>
                                    <Text style={s.editErrorText}>{editError}</Text>
                                </View>
                            )}

                            {/* 닉네임 */}
                            <View style={s.editField}>
                                <Text style={[s.editLabel, { color: t.textMuted }]}>닉네임</Text>
                                <TextInput
                                    style={[s.editInput, { backgroundColor: t.surface, borderColor: t.border, color: t.text }]}
                                    value={form.nickname}
                                    onChangeText={(v) => setForm((p) => ({ ...p, nickname: v }))}
                                    placeholder="닉네임 입력"
                                    placeholderTextColor={t.textSubtle}
                                />
                            </View>

                            {/* MBTI */}
                            <View style={s.editField}>
                                <Text style={[s.editLabel, { color: t.textMuted }]}>MBTI</Text>
                                <View style={s.editChipsWrap}>
                                    {MBTI_LIST.map((m) => {
                                        const sel = form.mbti === m;
                                        return (
                                            <TouchableOpacity
                                                key={m}
                                                onPress={() => setForm((p) => ({ ...p, mbti: sel ? "" : m }))}
                                                style={[
                                                    s.editChip,
                                                    sel
                                                        ? { backgroundColor: "#111827", borderColor: "#111827" }
                                                        : { backgroundColor: t.surface, borderColor: t.border },
                                                ]}
                                            >
                                                <Text style={[s.editChipText, { color: sel ? "#fff" : t.text }]}>{m}</Text>
                                            </TouchableOpacity>
                                        );
                                    })}
                                </View>
                            </View>

                            {/* 연령대 */}
                            <View style={s.editField}>
                                <Text style={[s.editLabel, { color: t.textMuted }]}>연령대</Text>
                                <View style={s.editChipsWrap}>
                                    {AGE_RANGES.map((a) => {
                                        const sel = form.ageRange === a;
                                        return (
                                            <TouchableOpacity
                                                key={a}
                                                onPress={() => setForm((p) => ({ ...p, ageRange: sel ? "" : a }))}
                                                style={[
                                                    s.editChip,
                                                    sel
                                                        ? { backgroundColor: "#111827", borderColor: "#111827" }
                                                        : { backgroundColor: t.surface, borderColor: t.border },
                                                ]}
                                            >
                                                <Text style={[s.editChipText, { color: sel ? "#fff" : t.text }]}>{a}</Text>
                                            </TouchableOpacity>
                                        );
                                    })}
                                </View>
                            </View>

                            {/* 성별 */}
                            <View style={s.editField}>
                                <Text style={[s.editLabel, { color: t.textMuted }]}>성별</Text>
                                <View style={s.editChipsWrap}>
                                    {GENDERS.map(({ label, value }) => {
                                        const sel = form.gender === value;
                                        return (
                                            <TouchableOpacity
                                                key={value}
                                                onPress={() => setForm((p) => ({ ...p, gender: sel ? "" : value }))}
                                                style={[
                                                    s.editChip,
                                                    sel
                                                        ? { backgroundColor: "#111827", borderColor: "#111827" }
                                                        : { backgroundColor: t.surface, borderColor: t.border },
                                                ]}
                                            >
                                                <Text style={[s.editChipText, { color: sel ? "#fff" : t.text }]}>{label}</Text>
                                            </TouchableOpacity>
                                        );
                                    })}
                                </View>
                            </View>

                            {/* 버튼 */}
                            <View style={s.editModalBtnRow}>
                                <TouchableOpacity
                                    style={[s.editModalBtnCancel, { borderColor: t.border }]}
                                    onPress={() => setEditVisible(false)}
                                >
                                    <Text style={[{ fontSize: 15, fontWeight: "600" }, { color: t.text }]}>취소</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[s.editModalBtnSave, editMutation.isPending && { opacity: 0.5 }]}
                                    onPress={() => editMutation.mutate(form)}
                                    disabled={editMutation.isPending}
                                >
                                    {editMutation.isPending
                                        ? <ActivityIndicator size="small" color="#fff" />
                                        : <Text style={{ fontSize: 15, fontWeight: "700", color: "#fff" }}>저장</Text>
                                    }
                                </TouchableOpacity>
                            </View>
                        </ScrollView>
                    </Pressable>
                </Pressable>
            </Modal>
        </ScrollView>
    );
}

// ─── 발자취 탭 ────────────────────────────────────────────────────────────────

function FootprintTab({
    displayName,
    initialView = "calendar",
}: {
    displayName: string;
    initialView?: "calendar" | "memories";
}) {
    const t = useThemeColors();
    const { t: i18n } = useLocale();
    const insets = useSafeAreaInsets();
    const [view, setView] = useState<"calendar" | "memories">(initialView);
    const [currentMonth, setCurrentMonth] = useState(() => new Date());
    const [selectedDate, setSelectedDate] = useState<string | null>(null);
    const [showDateCoursePreviewModal, setShowDateCoursePreviewModal] = useState(false);
    const [dateCoursePreviewItems, setDateCoursePreviewItems] = useState<DateCoursePreviewRow[]>([]);

    // ── 추억 상세 모달 ──
    const [selectedMemory, setSelectedMemory] = useState<MemoryDetailStory | null>(null);
    const [memoryImageIndex, setMemoryImageIndex] = useState(0);

    const { data: completed = [], isLoading: loadingCompleted } = useQuery<CompletedCourse[]>({
        queryKey: ["users", "completions"],
        queryFn: async () => {
            const d = await api.get<any>(endpoints.completions).catch(() => []);
            return Array.isArray(d) ? d : Array.isArray(d?.data) ? d.data : [];
        },
        staleTime: 5 * 60 * 1000,
    });

    const { data: stories = [], isLoading: loadingStories } = useQuery<PersonalStory[]>({
        queryKey: ["users", "personal-stories"],
        queryFn: () => fetchMyPrivateStories(50),
        staleTime: 5 * 60 * 1000,
    });

    const { data: aiSavedList = [] } = useQuery<any[]>({
        queryKey: ["users", "saved-ai"],
        queryFn: async () => {
            const d = await api.get<any>("/api/users/me/courses?source=ai_recommendation").catch(() => ({}));
            return parseSavedCoursesResponse(d);
        },
        staleTime: 5 * 60 * 1000,
    });

    const aiByDate = useMemo(() => {
        const m: Record<string, AiCalendarSlot> = {};
        for (const item of aiSavedList) {
            const raw = item.savedAt ?? item.createdAt;
            if (!raw) continue;
            const k = String(raw).split("T")[0];
            const course = item.course;
            const courseId = Number(course?.id ?? item.courseId);
            if (!courseId || !k) continue;
            if (m[k]) continue;
            m[k] = {
                courseId,
                imageUrl: course?.imageUrl ?? item.imageUrl,
                title: course?.title ?? item.title,
                description: course?.description ?? item.description,
                region: course?.region ?? item.region,
                concept: course?.concept ?? item.concept,
            };
        }
        return m;
    }, [aiSavedList]);

    const itemsByDate = useMemo(() => {
        const m: Record<string, CompletedCourse[]> = {};
        completed.forEach((c) => {
            if (!c?.completedAt) return;
            const k = c.completedAt.split("T")[0];
            if (!m[k]) m[k] = [];
            m[k].push(c);
        });
        return m;
    }, [completed]);

    /** 웹 FootprintTab과 동일: 해당 월이 속한 주의 일요일부터 42칸 */
    const calDays = useMemo(() => {
        const yr = currentMonth.getFullYear();
        const mo = currentMonth.getMonth();
        const firstOfMonth = new Date(yr, mo, 1);
        const start = new Date(firstOfMonth);
        start.setDate(start.getDate() - start.getDay());
        const days: { date: Date; current: boolean; items: CompletedCourse[] }[] = [];
        const cur = new Date(start);
        for (let i = 0; i < 42; i++) {
            const inMonth = cur.getMonth() === mo && cur.getFullYear() === yr;
            const y = cur.getFullYear();
            const m = cur.getMonth();
            const d = cur.getDate();
            const k = `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
            days.push({
                date: new Date(cur),
                current: inMonth,
                items: inMonth ? (itemsByDate[k] ?? []) : [],
            });
            cur.setDate(cur.getDate() + 1);
        }
        return days;
    }, [currentMonth, itemsByDate]);

    const todayKey = (() => {
        const n = new Date();
        return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
    })();

    if (loadingCompleted || loadingStories) {
        return <ActivityIndicator color={Colors.brandGreen} style={{ marginTop: 60 }} />;
    }

    return (
        <View style={{ flex: 1 }}>
            <ScrollView style={s.tabScroll} contentContainerStyle={s.tabContent} showsVerticalScrollIndicator={false}>
            <View style={[s.footprintHeaderCard, { backgroundColor: t.card, borderColor: t.border }]}>
                <View style={s.footprintHeaderRow}>
                    <Text style={[s.footprintTitle, { color: t.text }]}>내 발자취</Text>
                    <View
                        style={[s.viewToggle, { backgroundColor: t.surface, borderColor: t.border, marginBottom: 0 }]}
                    >
                        {(["calendar", "memories"] as const).map((v) => (
                            <TouchableOpacity
                                key={v}
                                style={[
                                    s.viewToggleBtn,
                                    view === v && {
                                        backgroundColor: "#0f172a",
                                    },
                                ]}
                                onPress={() => setView(v)}
                            >
                                <Text
                                    style={[
                                        s.viewToggleText,
                                        {
                                            color: view === v ? "#fff" : t.textMuted,
                                            fontWeight: view === v ? "700" : "500",
                                        },
                                    ]}
                                >
                                    {v === "calendar" ? "달력" : "추억"}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>
                <View style={[s.footprintDivider, { backgroundColor: t.border }]} />
                <Text style={[s.footprintSubText, { color: t.textMuted }]}>
                    {view === "calendar"
                        ? "AI 추천으로 확인한 오늘의 데이트 코스가 자동으로 기록돼요"
                        : "오늘의 순간들을 확인해보세요"}
                </Text>
            </View>

            {/* ── 캘린더 뷰 ── */}
            {view === "calendar" && (
                <View style={[s.calCard, { backgroundColor: t.card, borderColor: t.border }]}>
                    {/* 월 네비 */}
                    <View style={s.calNav}>
                        <TouchableOpacity
                            onPress={() => setCurrentMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        >
                            <Ionicons name="chevron-back" size={22} color={t.text} />
                        </TouchableOpacity>
                        <View style={{ alignItems: "center", flex: 1, paddingHorizontal: 8 }}>
                            <Text style={[s.calNavYear, { color: t.textMuted }]}>{currentMonth.getFullYear()}년</Text>
                            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4 }}>
                                <Text style={[s.calNavTitle, { color: t.text }]}>
                                    {currentMonth.getMonth() + 1}월
                                    {displayName.trim() ? ` ${displayName.trim()}` : ""}
                                </Text>
                                <Ionicons name="chevron-down" size={18} color={t.textMuted} />
                            </View>
                        </View>
                        <TouchableOpacity
                            onPress={() => setCurrentMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        >
                            <Ionicons name="chevron-forward" size={22} color={t.text} />
                        </TouchableOpacity>
                    </View>

                    {/* 통계 (웹과 동일: 달력 그리드 위) */}
                    <View style={[s.calStats, s.calStatsAbove, { borderBottomColor: t.border }]}>
                        <View style={s.calStat}>
                            <Ionicons name="map-outline" size={15} color="#059669" />
                            <Text style={[s.calStatLabel, { color: t.textMuted }]}>완료 코스</Text>
                            <Text style={s.calStatVal}>{completed.length}</Text>
                        </View>
                        <View style={[s.calStatDiv, { backgroundColor: t.border }]} />
                        <View style={s.calStat}>
                            <Ionicons name="sparkles-outline" size={15} color="#0f766e" />
                            <Text style={[s.calStatLabel, { color: t.textMuted }]}>추천 데이트</Text>
                            <Text style={[s.calStatVal, { color: "#0d9488" }]}>{aiSavedList.length}</Text>
                        </View>
                    </View>

                    {/* 요일 헤더 */}
                    <View style={s.calDayNames}>
                        {DAY_NAMES.map((d, i) => (
                            <Text
                                key={d}
                                style={[
                                    s.calDayName,
                                    { color: i === 0 || i === 6 ? "#ef4444" : t.textMuted },
                                ]}
                            >
                                {d}
                            </Text>
                        ))}
                    </View>

                    {/* 날짜 그리드 — 6행 × 7열 */}
                    <View style={s.calGrid}>
                        {Array.from({ length: 6 }, (_, rowIdx) => (
                            <View key={rowIdx} style={s.calRow}>
                                {calDays.slice(rowIdx * 7, rowIdx * 7 + 7).map((day, idx) => {
                            const yr = day.date.getFullYear();
                            const mo = day.date.getMonth();
                            const dt = day.date.getDate();
                            const key = `${yr}-${String(mo + 1).padStart(2, "0")}-${String(dt).padStart(2, "0")}`;
                            const isToday = key === todayKey;
                            const isSelected = key === selectedDate;
                            const hasCompleted = day.current && day.items.length > 0;
                            const aiSlot = day.current ? aiByDate[key] : undefined;
                            const thumbUri = aiSlot?.imageUrl ? resolveImageUrl(aiSlot.imageUrl) : null;
                            const showAiThumb = !!thumbUri;
                            const dow = day.date.getDay();
                            const isWeekend = dow === 0 || dow === 6;
                            const interactive = day.current && (hasCompleted || !!aiSlot);

                            return (
                                <TouchableOpacity
                                    key={idx}
                                    style={s.calCell}
                                    onPress={() => {
                                        if (!day.current) return;
                                        setSelectedDate(key);
                                        const fromCompleted: DateCoursePreviewRow[] = hasCompleted
                                            ? day.items
                                                  .filter(
                                                      (it): it is CompletedCourse =>
                                                          it != null &&
                                                          typeof it === "object" &&
                                                          Number(it.courseId ?? it.course?.id) > 0,
                                                  )
                                                  .map((it) => {
                                                      const c = it.course;
                                                      const cid = Number(c?.id ?? it.courseId);
                                                      return {
                                                          isAI: false,
                                                          course: {
                                                              id: cid,
                                                              title: c?.title,
                                                              description: (c as { description?: string | null })
                                                                  ?.description,
                                                              imageUrl: c?.imageUrl,
                                                              region: c?.region,
                                                              concept: c?.concept,
                                                          },
                                                      };
                                                  })
                                            : [];
                                        const aiRow: DateCoursePreviewRow | null = aiSlot
                                            ? {
                                                  isAI: true,
                                                  course: {
                                                      id: aiSlot.courseId,
                                                      title: aiSlot.title,
                                                      description: aiSlot.description,
                                                      imageUrl: aiSlot.imageUrl,
                                                      region: aiSlot.region,
                                                      concept: aiSlot.concept,
                                                  },
                                              }
                                            : null;
                                        let previewRows: DateCoursePreviewRow[] = [];
                                        if (hasCompleted && aiRow) {
                                            previewRows = [...fromCompleted, aiRow];
                                        } else if (hasCompleted) {
                                            previewRows = fromCompleted;
                                        } else if (aiRow) {
                                            previewRows = [aiRow];
                                        }
                                        if (previewRows.length === 0) return;
                                        setDateCoursePreviewItems(previewRows);
                                        setShowDateCoursePreviewModal(true);
                                    }}
                                    activeOpacity={interactive ? 0.75 : 1}
                                    disabled={!interactive}
                                >
                                    <View
                                        style={[
                                            s.calDayCircle,
                                            isSelected && s.calDayCircleSelected,
                                            isToday && !isSelected && s.calDayCircleToday,
                                            !day.current && s.calDayCircleMuted,
                                        ]}
                                    >
                                        {showAiThumb ? (
                                            <Image
                                                source={{ uri: thumbUri! }}
                                                style={s.calDayThumb}
                                                resizeMode="cover"
                                            />
                                        ) : (
                                            <Text
                                                style={[
                                                    s.calDateInCircle,
                                                    {
                                                        color: !day.current ? t.border : isWeekend ? "#ef4444" : t.text,
                                                    },
                                                    (isToday || isSelected) && { color: "#059669", fontWeight: "800" },
                                                ]}
                                            >
                                                {dt}
                                            </Text>
                                        )}
                                        {hasCompleted ? <View style={s.calCompletedCornerDot} /> : null}
                                        {hasCompleted && day.items.length > 1 ? (
                                            <View style={s.calItemCountOnCircle}>
                                                <Text style={s.calItemCountText}>{day.items.length}</Text>
                                            </View>
                                        ) : null}
                                    </View>
                                </TouchableOpacity>
                            );
                        })}
                            </View>
                        ))}
                    </View>
                </View>
            )}

            {/* ── 추억 뷰 ── */}
            {view === "memories" &&
                (stories.length === 0 ? (
                    <EmptyState
                        emoji="📷"
                        title="아직 기록된 추억이 없어요"
                        sub="코스를 시작하고 나만의 추억을 기록해보세요"
                        t={t}
                    />
                ) : (
                    <View style={{ gap: 12 }}>
                        {stories.map((story, stIdx) => {
                            const imgUri = story.imageUrls?.[0] ? resolveImageUrl(story.imageUrls[0]) : null;
                            const d = new Date(story.createdAt);
                            const dateStr = `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
                            return (
                                <TouchableOpacity
                                    key={story.id}
                                    activeOpacity={0.92}
                                    style={[s.memCard, { backgroundColor: t.card, borderColor: t.border }]}
                                    onPress={() => {
                                        setMemoryImageIndex(0);
                                        setSelectedMemory(story as MemoryDetailStory);
                                    }}
                                >
                                    {imgUri ? (
                                        <Image source={{ uri: imgUri }} style={s.memImg} resizeMode="cover" />
                                    ) : (
                                        <View
                                            style={[
                                                s.memImg,
                                                {
                                                    backgroundColor: t.surface,
                                                    alignItems: "center",
                                                    justifyContent: "center",
                                                },
                                            ]}
                                        >
                                            <Text style={{ fontSize: 40 }}>📷</Text>
                                        </View>
                                    )}
                                    <View style={s.memBody}>
                                        <Text style={[s.memDate, { color: t.textMuted }]}>{dateStr}</Text>
                                        <Text style={[s.memCourse, { color: t.text }]} numberOfLines={2}>
                                            {story.course?.title ?? "코스 기록"}
                                        </Text>
                                        {story.tags && story.tags.length > 0 && (
                                            <View style={s.memTagRow}>
                                                {story.tags.slice(0, 3).map((tag) => (
                                                    <View key={tag} style={s.memTag}>
                                                        <Text style={s.memTagText}>#{tag}</Text>
                                                    </View>
                                                ))}
                                            </View>
                                        )}
                                        {story.rating && story.rating > 0 ? (
                                            <View style={{ flexDirection: "row", gap: 2, marginTop: 6 }}>
                                                {[1, 2, 3, 4, 5].map((star) => (
                                                    <Text
                                                        key={star}
                                                        style={{
                                                            color: star <= (story.rating ?? 0) ? "#fbbf24" : "#e5e7eb",
                                                            fontSize: 13,
                                                        }}
                                                    >
                                                        ★
                                                    </Text>
                                                ))}
                                            </View>
                                        ) : null}
                                    </View>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                ))}

            </ScrollView>

            {/* ── 추억 상세 모달 ── */}
            <MemoryDetailModal
                visible={selectedMemory !== null}
                memory={selectedMemory}
                currentIndex={memoryImageIndex}
                onIndexChange={setMemoryImageIndex}
                onClose={() => setSelectedMemory(null)}
            />

            <Modal
                visible={showDateCoursePreviewModal && dateCoursePreviewItems.length > 0}
                transparent
                animationType="fade"
                onRequestClose={() => setShowDateCoursePreviewModal(false)}
            >
                <View style={s.coursePreviewRoot}>
                    <TouchableOpacity
                        style={StyleSheet.absoluteFillObject}
                        activeOpacity={1}
                        onPress={() => setShowDateCoursePreviewModal(false)}
                    />
                    {(() => {
                        const PREVIEW_IMG_H = 208;
                        const isMulti = dateCoursePreviewItems.length > 1;
                        const CARD_PEEK = 36;
                        const CARD_GAP = 12;
                        const PREVIEW_CARD_W = isMulti ? SW - CARD_PEEK * 2 - CARD_GAP : Math.min(340, SW - 32);
                        const sidePad = isMulti ? CARD_PEEK : Math.max(16, (SW - PREVIEW_CARD_W) / 2);

                        const renderCard = (row: DateCoursePreviewRow | undefined, idx: number) => {
                            if (!row?.course) return null;
                            const { course, isAI } = row;
                            const courseId = Number(course.id);
                            if (!courseId) return null;
                            const imgUri = course.imageUrl ? resolveImageUrl(course.imageUrl) : null;
                            const title =
                                course.title?.trim() ||
                                i18n("mypage.footprintTab.course");
                            const desc =
                                course.description?.trim() ||
                                i18n("mypage.footprintTab.savedCourseDesc");
                            const region =
                                course.region?.trim() ||
                                i18n("mypage.footprintTab.regionSeoul");
                            const concept =
                                course.concept?.trim() ||
                                i18n("mypage.footprintTab.conceptDate");

                            return (
                                <View
                                    key={`${courseId}-${idx}`}
                                    style={[
                                        s.coursePreviewCard,
                                        {
                                            width: PREVIEW_CARD_W,
                                            backgroundColor: t.isDark ? "#1a241b" : "#fff",
                                        },
                                    ]}
                                >
                                    <View style={[s.coursePreviewImgWrap, { height: PREVIEW_IMG_H }]}>
                                        {imgUri ? (
                                            <Image
                                                source={{ uri: imgUri }}
                                                style={[StyleSheet.absoluteFillObject, { opacity: 0.9 }]}
                                                resizeMode="cover"
                                            />
                                        ) : (
                                            <View
                                                style={[
                                                    StyleSheet.absoluteFillObject,
                                                    {
                                                        backgroundColor: t.isDark ? "#374151" : "#e5e7eb",
                                                        alignItems: "center",
                                                        justifyContent: "center",
                                                    },
                                                ]}
                                            >
                                                <Text style={{ fontSize: 28 }}>📍</Text>
                                            </View>
                                        )}
                                        <TouchableOpacity
                                            style={s.coursePreviewClose}
                                            onPress={() => setShowDateCoursePreviewModal(false)}
                                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                        >
                                            <Ionicons name="close" size={22} color="#fff" />
                                        </TouchableOpacity>
                                        <View style={s.coursePreviewBadgeRow}>
                                            {isAI ? (
                                                <View style={s.coursePreviewBadgeAi}>
                                                    <Ionicons name="sparkles" size={11} color="#fff" />
                                                    <Text style={s.coursePreviewBadgeAiText}>AI SELECTED</Text>
                                                </View>
                                            ) : (
                                                <View style={s.coursePreviewBadgeDone}>
                                                    <Ionicons name="checkmark-circle" size={11} color="#fff" />
                                                    <Text style={s.coursePreviewBadgeDoneText}>VERIFIED</Text>
                                                </View>
                                            )}
                                        </View>
                                    </View>

                                    <View style={s.coursePreviewBody}>
                                        <Text
                                            style={[
                                                s.coursePreviewKicker,
                                                { color: t.isDark ? "#34d399" : "#059669" },
                                            ]}
                                        >
                                            {i18n("mypage.footprintTab.privateArchiving")}
                                        </Text>
                                        <Text
                                            style={[s.coursePreviewTitle, { color: t.text }]}
                                            numberOfLines={2}
                                        >
                                            {title}
                                        </Text>
                                        <Text
                                            style={[s.coursePreviewDesc, { color: t.textMuted }]}
                                            numberOfLines={3}
                                        >
                                            {desc}
                                        </Text>

                                        <View style={s.coursePreviewMetaRow}>
                                            <View
                                                style={[
                                                    s.coursePreviewMetaBox,
                                                    {
                                                        backgroundColor: t.isDark ? "#1f2937" : "#f9fafb",
                                                        borderColor: t.isDark ? "#374151" : "#f3f4f6",
                                                    },
                                                ]}
                                            >
                                                <View style={s.coursePreviewMetaLabelRow}>
                                                    <Ionicons
                                                        name="location"
                                                        size={12}
                                                        color={t.isDark ? "#34d399" : "#059669"}
                                                    />
                                                    <Text style={[s.coursePreviewMetaLabel, { color: t.textMuted }]}>
                                                        {i18n("mypage.footprintTab.region")}
                                                    </Text>
                                                </View>
                                                <Text style={[s.coursePreviewMetaVal, { color: t.text }]}>
                                                    {region}
                                                </Text>
                                            </View>
                                            <View
                                                style={[
                                                    s.coursePreviewMetaBox,
                                                    {
                                                        backgroundColor: t.isDark ? "#1f2937" : "#f9fafb",
                                                        borderColor: t.isDark ? "#374151" : "#f3f4f6",
                                                    },
                                                ]}
                                            >
                                                <View style={s.coursePreviewMetaLabelRow}>
                                                    <Ionicons
                                                        name="flash"
                                                        size={12}
                                                        color={t.isDark ? "#34d399" : "#059669"}
                                                    />
                                                    <Text style={[s.coursePreviewMetaLabel, { color: t.textMuted }]}>
                                                        {i18n("mypage.footprintTab.concept")}
                                                    </Text>
                                                </View>
                                                <Text style={[s.coursePreviewMetaVal, { color: t.text }]}>
                                                    {concept}
                                                </Text>
                                            </View>
                                        </View>

                                        <TouchableOpacity
                                            style={[
                                                s.coursePreviewCta,
                                                { backgroundColor: t.isDark ? "#27272a" : "#121826" },
                                            ]}
                                            activeOpacity={0.88}
                                            onPress={() => {
                                                if (!courseId) return;
                                                setShowDateCoursePreviewModal(false);
                                                router.push(`/courses/${courseId}` as any);
                                            }}
                                        >
                                            <Text style={s.coursePreviewCtaText}>
                                                {i18n("mypage.footprintTab.viewCourse")}
                                            </Text>
                                            <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.55)" />
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            );
                        };

                        return (
                            <View style={s.coursePreviewCenter} pointerEvents="box-none">
                                {isMulti ? (
                                    <ScrollView
                                        horizontal
                                        showsHorizontalScrollIndicator={false}
                                        decelerationRate="fast"
                                        snapToInterval={PREVIEW_CARD_W + CARD_GAP}
                                        snapToAlignment="start"
                                        contentContainerStyle={{
                                            paddingHorizontal: sidePad,
                                            paddingVertical: 24,
                                            gap: CARD_GAP,
                                            alignItems: "flex-start",
                                        }}
                                    >
                                        {dateCoursePreviewItems
                                            .map((row, idx) => renderCard(row, idx))
                                            .filter(Boolean)}
                                    </ScrollView>
                                ) : (
                                    <View
                                        style={{
                                            paddingHorizontal: 16,
                                            paddingVertical: 24,
                                            alignItems: "center",
                                        }}
                                    >
                                        {dateCoursePreviewItems[0]
                                            ? renderCard(dateCoursePreviewItems[0], 0)
                                            : null}
                                    </View>
                                )}
                                {isMulti ? (
                                    <Text
                                        style={[
                                            s.coursePreviewSwipeHint,
                                            { bottom: Math.max(20, insets.bottom + 12) },
                                        ]}
                                    >
                                        {i18n("mypage.footprintTab.swipeMore")}
                                    </Text>
                                ) : null}
                            </View>
                        );
                    })()}
                </View>
            </Modal>
        </View>
    );
}

// ─── 기록 탭 ──────────────────────────────────────────────────────────────────

function RecordsTab() {
    const t = useThemeColors();
    const queryClient = useQueryClient();
    const [subTab, setSubTab] = useState<"favorites" | "saved" | "completed" | "casefiles">("favorites");

    const { data: favorites = [], isLoading: loadFav } = useQuery<Favorite[]>({
        queryKey: ["users", "favorites"],
        queryFn: async () => {
            const d = await api.get<any>(endpoints.favorites).catch(() => []);
            return Array.isArray(d) ? d : Array.isArray(d?.data) ? d.data : [];
        },
        staleTime: 5 * 60 * 1000,
    });

    const { data: saved = [], isLoading: loadSaved } = useQuery<any[]>({
        queryKey: ["users", "saved-ai"],
        queryFn: async () => {
            const d = await api.get<any>("/api/users/me/courses?source=ai_recommendation").catch(() => ({}));
            return parseSavedCoursesResponse(d);
        },
        staleTime: 5 * 60 * 1000,
    });

    const { data: completed = [], isLoading: loadCompleted } = useQuery<CompletedCourse[]>({
        queryKey: ["users", "completions"],
        queryFn: async () => {
            const d = await api.get<any>(endpoints.completions).catch(() => []);
            return Array.isArray(d) ? d : Array.isArray(d?.data) ? d.data : [];
        },
        staleTime: 5 * 60 * 1000,
    });

    const { data: casefiles = [], isLoading: loadCase } = useQuery<CasefileItem[]>({
        queryKey: ["users", "casefiles"],
        queryFn: async () => {
            const d = await api.get<any[]>("/api/users/casefiles").catch(() => []);
            return Array.isArray(d) ? d : [];
        },
        staleTime: 5 * 60 * 1000,
    });

    const removeFav = useMutation({
        mutationFn: (courseId: number) => api.delete(`${endpoints.favorites}?courseId=${courseId}`),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ["users", "favorites"] }),
        onError: () => Alert.alert("오류", "찜 해제에 실패했습니다."),
    });

    const subTabs = [
        { id: "favorites" as const, label: "보관함", count: favorites.length },
        { id: "saved" as const, label: "오늘의 데이트 추천", count: saved.length },
        { id: "completed" as const, label: "완료 코스", count: completed.length },
    ];

    const isLoading = loadFav || loadSaved || loadCompleted || loadCase;

    return (
        <ScrollView style={s.tabScroll} contentContainerStyle={s.tabContent} showsVerticalScrollIndicator={false}>
            <SubTabBar tabs={subTabs} active={subTab} onSelect={setSubTab} t={t} />

            {isLoading ? (
                <ActivityIndicator color={Colors.brandGreen} style={{ marginTop: 40 }} />
            ) : (
                <View style={[s.sectionCard, { backgroundColor: t.card, borderColor: t.border }]}>
                    {/* ── 찜하기 ── */}
                    {subTab === "favorites" && (
                        <>
                            <Text style={[s.sectionTitle, { color: t.text }]}>내 보관함</Text>
                            {favorites.length === 0 ? (
                                <EmptyState
                                    emoji="💝"
                                    title="아직 찜한 코스가 없어요"
                                    sub="마음에 드는 코스를 찜해보세요"
                                    ctaLabel="코스 둘러보기"
                                    onCta={() => router.push("/(tabs)/courses" as any)}
                                    t={t}
                                />
                            ) : (
                                <View style={{ gap: 10 }}>
                                    {favorites
                                        .filter((fav) => fav?.course?.id != null)
                                        .map((fav) => (
                                            <CourseListCard
                                                key={fav.id}
                                                title={fav.course.title}
                                                imageUrl={fav.course.imageUrl}
                                                grade={fav.course.grade}
                                                concept={fav.course.concept ?? null}
                                                region={fav.course.region}
                                                onPress={() => router.push(`/courses/${fav.course.id}` as any)}
                                                onRemove={() => removeFav.mutate(fav.course.id)}
                                                t={t}
                                            />
                                        ))}
                                </View>
                            )}
                        </>
                    )}

                    {/* ── AI 추천 저장 ── */}
                    {subTab === "saved" && (
                        <>
                            <Text style={[s.sectionTitle, { color: t.text }]}>AI 추천 저장 코스</Text>
                            {saved.length === 0 ? (
                                <EmptyState
                                    emoji="🤖"
                                    title="저장된 AI 추천 코스가 없어요"
                                    sub="AI 맞춤 추천을 받아보세요"
                                    ctaLabel="AI 추천 받기"
                                    onCta={() => router.push("/(tabs)/ai" as any)}
                                    t={t}
                                />
                            ) : (
                                <View style={{ gap: 10 }}>
                                    {saved.map((item: any, idx: number) => (
                                        <CourseListCard
                                            key={item.id ?? idx}
                                            title={item.title ?? item.course?.title ?? ""}
                                            imageUrl={item.imageUrl ?? item.course?.imageUrl}
                                            grade={item.grade ?? item.course?.grade ?? "FREE"}
                                            concept={item.course?.concept ?? item.concept ?? null}
                                            region={item.region ?? item.course?.region}
                                            date={item.savedAt ?? item.createdAt}
                                            onPress={() =>
                                                router.push(
                                                    `/courses/${item.courseId ?? item.id ?? item.course?.id}` as any,
                                                )
                                            }
                                            t={t}
                                        />
                                    ))}
                                </View>
                            )}
                        </>
                    )}

                    {/* ── 완료 코스 ── */}
                    {subTab === "completed" && (
                        <>
                            <Text style={[s.sectionTitle, { color: t.text }]}>완료한 코스</Text>
                            {completed.length === 0 ? (
                                <EmptyState
                                    emoji="🏁"
                                    title="아직 완료한 코스가 없어요"
                                    sub="코스를 시작하고 완료해보세요"
                                    t={t}
                                />
                            ) : (
                                <View style={{ gap: 10 }}>
                                    {completed.map((item) => (
                                        <CourseListCard
                                            key={item.id}
                                            title={item.course?.title ?? ""}
                                            imageUrl={item.course?.imageUrl}
                                            grade={item.course?.grade}
                                            concept={item.course?.concept ?? null}
                                            region={item.course?.region}
                                            date={item.completedAt}
                                            onPress={() => router.push(`/courses/${item.courseId}` as any)}
                                            t={t}
                                        />
                                    ))}
                                </View>
                            )}
                        </>
                    )}

                    {/* ── 케이스파일 ── */}
                    {subTab === "casefiles" && (
                        <>
                            <Text style={[s.sectionTitle, { color: t.text }]}>케이스파일</Text>
                            {casefiles.length === 0 ? (
                                <EmptyState
                                    emoji="📁"
                                    title="케이스파일이 없어요"
                                    sub="스토리를 완료하면 케이스파일이 쌓여요"
                                    t={t}
                                />
                            ) : (
                                <View style={{ gap: 12 }}>
                                    {casefiles.map((item) => {
                                        const uri = resolveImageUrl(item.imageUrl);
                                        return (
                                            <View key={item.id} style={s.caseCard}>
                                                <View style={s.caseImgWrap}>
                                                    {uri ? (
                                                        <Image
                                                            source={{ uri }}
                                                            style={StyleSheet.absoluteFillObject}
                                                            resizeMode="cover"
                                                        />
                                                    ) : (
                                                        <View
                                                            style={[
                                                                StyleSheet.absoluteFillObject,
                                                                {
                                                                    backgroundColor: "#1f2937",
                                                                    alignItems: "center",
                                                                    justifyContent: "center",
                                                                },
                                                            ]}
                                                        >
                                                            <Text style={{ fontSize: 36 }}>📁</Text>
                                                        </View>
                                                    )}
                                                    <View style={s.caseOverlay} pointerEvents="none" />
                                                    <View style={s.caseTextWrap}>
                                                        <Text style={s.caseTitle} numberOfLines={2}>
                                                            {item.title ?? "케이스파일"}
                                                        </Text>
                                                        <View style={s.caseMeta}>
                                                            {item.region ? (
                                                                <Text style={s.caseMetaText}>{item.region}</Text>
                                                            ) : null}
                                                            {item.completedAt ? (
                                                                <Text style={s.caseMetaText}>
                                                                    {new Date(item.completedAt).toLocaleDateString(
                                                                        "ko-KR",
                                                                    )}
                                                                </Text>
                                                            ) : null}
                                                        </View>
                                                    </View>
                                                </View>
                                                {item.badge ? (
                                                    <View style={s.caseBadge}>
                                                        <Text style={s.caseBadgeText}>{item.badge.name}</Text>
                                                    </View>
                                                ) : null}
                                            </View>
                                        );
                                    })}
                                </View>
                            )}
                        </>
                    )}
                </View>
            )}
        </ScrollView>
    );
}

// ─── 활동 탭 ──────────────────────────────────────────────────────────────────

function ActivityTab() {
    const t = useThemeColors();
    const [subTab, setSubTab] = useState<"badges" | "rewards" | "payments">("badges");
    const [selBadge, setSelBadge] = useState<Badge | null>(null);

    const { data: badges = [], isLoading: loadBadges } = useQuery<Badge[]>({
        queryKey: ["users", "badges"],
        queryFn: async () => {
            const d = await api.get<any[]>(endpoints.badges).catch(() => []);
            return Array.isArray(d) ? d : [];
        },
        staleTime: 5 * 60 * 1000,
    });

    const { data: rewards = [], isLoading: loadRewards } = useQuery<RewardRow[]>({
        queryKey: ["users", "rewards"],
        queryFn: async () => {
            const d = await api.get<any[]>("/api/users/rewards").catch(() => []);
            return Array.isArray(d) ? d : [];
        },
        staleTime: 5 * 60 * 1000,
    });

    const { data: payments = [], isLoading: loadPayments } = useQuery<PaymentHistory[]>({
        queryKey: ["payments", "history"],
        queryFn: async () => {
            const d = await api.get<any[]>("/api/payments/history").catch(() => []);
            return Array.isArray(d) ? d : [];
        },
        staleTime: 5 * 60 * 1000,
    });

    const subTabs = [
        { id: "badges" as const, label: "뱃지", count: badges.length },
        { id: "rewards" as const, label: "보상 내역", count: rewards.length },
        { id: "payments" as const, label: "결제 내역", count: payments.length },
    ];

    const isLoading = loadBadges || loadRewards || loadPayments;

    return (
        <ScrollView style={s.tabScroll} contentContainerStyle={s.tabContent} showsVerticalScrollIndicator={false}>
            <SubTabBar tabs={subTabs} active={subTab} onSelect={setSubTab} t={t} />

            {isLoading ? (
                <ActivityIndicator color={Colors.brandGreen} style={{ marginTop: 40 }} />
            ) : (
                <View style={[s.sectionCard, { backgroundColor: t.card, borderColor: t.border }]}>
                    {/* ── 뱃지 ── */}
                    {subTab === "badges" && (
                        <>
                            <Text style={[s.sectionTitle, { color: t.text }]}>내 뱃지</Text>
                            {badges.length === 0 ? (
                                <EmptyState
                                    emoji="🏅"
                                    title="아직 획득한 뱃지가 없어요"
                                    sub="코스를 완료하고 뱃지를 모아보세요"
                                    t={t}
                                />
                            ) : (
                                <View style={s.badgeGrid}>
                                    {badges.map((b) => {
                                        const uri = b.image_url ? resolveImageUrl(b.image_url) : null;
                                        return (
                                            <TouchableOpacity
                                                key={b.id}
                                                style={[
                                                    s.badgeCard,
                                                    { backgroundColor: t.surface, borderColor: t.border },
                                                ]}
                                                onPress={() => setSelBadge(b)}
                                                activeOpacity={0.85}
                                            >
                                                <View style={s.badgeImgWrap}>
                                                    {uri ? (
                                                        <Image
                                                            source={{ uri }}
                                                            style={s.badgeImg}
                                                            resizeMode="contain"
                                                        />
                                                    ) : (
                                                        <Text style={{ fontSize: 34 }}>🏅</Text>
                                                    )}
                                                </View>
                                                <Text style={[s.badgeName, { color: t.text }]} numberOfLines={2}>
                                                    {b.name}
                                                </Text>
                                                <Text style={[s.badgeDate, { color: t.textMuted }]}>
                                                    {new Date(b.awarded_at).toLocaleDateString("ko-KR")}
                                                </Text>
                                            </TouchableOpacity>
                                        );
                                    })}
                                </View>
                            )}
                        </>
                    )}

                    {/* ── 보상 내역 ── */}
                    {subTab === "rewards" && (
                        <>
                            <Text style={[s.sectionTitle, { color: t.text }]}>보상 지급 내역</Text>
                            {rewards.length === 0 ? (
                                <EmptyState
                                    emoji="🎁"
                                    title="보상 내역이 없어요"
                                    sub="미션을 완료하고 보상을 받아보세요"
                                    t={t}
                                />
                            ) : (
                                rewards.map((r) => (
                                    <View key={r.id} style={[s.rewardRow, { borderBottomColor: t.border }]}>
                                        <View style={{ flex: 1 }}>
                                            <Text style={[s.rewardLabel, { color: t.text }]}>
                                                {REWARD_LABELS[String(r.type ?? "").toLowerCase()] ?? r.type}
                                            </Text>
                                            <Text style={[s.rewardDate, { color: t.textMuted }]}>
                                                {new Date(r.createdAt).toLocaleString("ko-KR", {
                                                    month: "long",
                                                    day: "numeric",
                                                    hour: "2-digit",
                                                    minute: "2-digit",
                                                })}
                                            </Text>
                                        </View>
                                        <View style={s.rewardBadge}>
                                            <Text style={s.rewardBadgeText}>+{r.amount} 티켓</Text>
                                        </View>
                                    </View>
                                ))
                            )}
                        </>
                    )}

                    {/* ── 결제 내역 ── */}
                    {subTab === "payments" && (
                        <>
                            <Text style={[s.sectionTitle, { color: t.text }]}>결제 내역</Text>
                            {payments.length === 0 ? (
                                <EmptyState
                                    emoji="💳"
                                    title="결제 내역이 없어요"
                                    sub="구독·열람권 구매 시 여기에 표시됩니다"
                                    t={t}
                                />
                            ) : (
                                <View style={{ gap: 10 }}>
                                    {payments.map((p) => {
                                        const isRefunded = p.status === "CANCELLED" || p.status === "REFUNDED";
                                        const isTicket = /열람|티켓|ticket/i.test(p.orderName ?? "");
                                        const isSub = /구독|플랜|subscription/i.test(p.orderName ?? "");
                                        return (
                                            <View
                                                key={p.id}
                                                style={[
                                                    s.payCard,
                                                    {
                                                        backgroundColor: isRefunded ? t.surface : t.card,
                                                        borderColor: t.border,
                                                        opacity: isRefunded ? 0.75 : 1,
                                                    },
                                                ]}
                                            >
                                                <View style={s.payTop}>
                                                    <View style={{ flex: 1 }}>
                                                        <View style={s.payBadgeRow}>
                                                            {isTicket && (
                                                                <View style={s.payBadgeTicket}>
                                                                    <Text style={s.payBadgeText}>티켓</Text>
                                                                </View>
                                                            )}
                                                            {isSub && (
                                                                <View style={s.payBadgeSub}>
                                                                    <Text style={s.payBadgeText}>구독권</Text>
                                                                </View>
                                                            )}
                                                            {isRefunded ? (
                                                                <View style={s.payBadgeRefund}>
                                                                    <Text style={s.payStatusText}>환불완료</Text>
                                                                </View>
                                                            ) : (
                                                                <View style={s.payBadgePaid}>
                                                                    <Text style={s.payStatusTextGreen}>결제완료</Text>
                                                                </View>
                                                            )}
                                                        </View>
                                                        <Text style={[s.payOrder, { color: t.text }]}>
                                                            {p.orderName}
                                                        </Text>
                                                        <Text style={[s.payDate, { color: t.textMuted }]}>
                                                            {new Date(p.approvedAt).toLocaleDateString("ko-KR", {
                                                                year: "numeric",
                                                                month: "long",
                                                                day: "numeric",
                                                            })}
                                                        </Text>
                                                        {p.method ? (
                                                            <Text style={[s.payMethod, { color: t.textMuted }]}>
                                                                결제수단: {p.method === "CARD" ? "카드" : p.method}
                                                            </Text>
                                                        ) : null}
                                                    </View>
                                                    <Text
                                                        style={[
                                                            s.payAmount,
                                                            {
                                                                color: isRefunded ? t.textMuted : t.text,
                                                                textDecorationLine: isRefunded
                                                                    ? "line-through"
                                                                    : "none",
                                                            },
                                                        ]}
                                                    >
                                                        {p.amount.toLocaleString("ko-KR")}원
                                                    </Text>
                                                </View>
                                                {!isRefunded && (
                                                    <TouchableOpacity
                                                        style={[s.refundBtn, { borderTopColor: t.border }]}
                                                        onPress={() => router.push("/refund" as any)}
                                                    >
                                                        <Text style={[s.refundBtnText, { color: t.textMuted }]}>
                                                            환불 신청하기
                                                        </Text>
                                                    </TouchableOpacity>
                                                )}
                                            </View>
                                        );
                                    })}
                                </View>
                            )}
                        </>
                    )}
                </View>
            )}

            {/* 뱃지 상세 모달 */}
            <Modal visible={!!selBadge} transparent animationType="fade" onRequestClose={() => setSelBadge(null)}>
                <View style={s.badgeModalBg}>
                    <TouchableOpacity style={StyleSheet.absoluteFillObject} onPress={() => setSelBadge(null)} />
                    {selBadge && (
                        <View style={[s.badgeModalCard, { backgroundColor: "white" }]}>
                            <View style={s.badgeModalImgWrap}>
                                {selBadge.image_url ? (
                                    <Image
                                        source={{ uri: resolveImageUrl(selBadge.image_url) }}
                                        style={s.badgeModalImg}
                                        resizeMode="contain"
                                    />
                                ) : (
                                    <Text style={{ fontSize: 60 }}>🏅</Text>
                                )}
                            </View>
                            <Text style={s.badgeModalName}>{selBadge.name}</Text>
                            {selBadge.description ? <Text style={s.badgeModalDesc}>{selBadge.description}</Text> : null}
                            <Text style={s.badgeModalDateText}>
                                획득일: {new Date(selBadge.awarded_at).toLocaleDateString("ko-KR")}
                            </Text>
                            <TouchableOpacity style={s.badgeModalCloseBtn} onPress={() => setSelBadge(null)}>
                                <Text style={s.badgeModalCloseTxt}>닫기</Text>
                            </TouchableOpacity>
                        </View>
                    )}
                </View>
            </Modal>
        </ScrollView>
    );
}

// ─── 메인 화면 ────────────────────────────────────────────────────────────────

export default function MyPageScreen() {
    const t = useThemeColors();
    const { user, isLoading: authLoading } = useAuth();
    const params = useLocalSearchParams<{ tab?: string; footprintView?: string }>();
    const [activeTab, setActiveTab] = useState<TabId>("profile");

    // 탭 진입 시마다 프로필로 초기화
    useFocusEffect(
        useCallback(() => {
            const tab = params.tab;
            if (tab === "profile" || tab === "footprint" || tab === "records" || tab === "activity") {
                setActiveTab(tab);
            } else {
                setActiveTab("profile");
            }
        }, [params.tab])
    );

    const {
        data: profileData,
        isLoading: profileLoading,
        refetch,
    } = useQuery<UserProfile>({
        queryKey: ["users", "profile"],
        queryFn: () => api.get<UserProfile>(endpoints.profile),
        enabled: !!user,
    });

    const profile = profileData?.user ? { ...profileData, ...profileData.user } : profileData;
    const tier = (profile?.subscriptionTier ?? profile?.subscription_tier ?? "FREE") as SubscriptionTier;

    const isLoading = authLoading || profileLoading;

    if (isLoading) {
        return (
            <SafeAreaView style={[s.container, { backgroundColor: t.bg }]} edges={["top"]}>
                <AppHeaderWithModals />
                <PageLoadingOverlay overlay={false} />
            </SafeAreaView>
        );
    }

    if (!user) {
        return (
            <SafeAreaView style={[s.container, { backgroundColor: t.bg }]} edges={["top"]}>
                <AppHeaderWithModals />
                <View style={s.loginBlock}>
                    <Text style={{ fontSize: 40, marginBottom: 16 }}>👤</Text>
                    <Text style={[s.pageTitle, { color: t.text, marginBottom: 8 }]}>로그인이 필요해요</Text>
                    <Text style={[s.pageSubtitle, { color: t.textMuted, marginBottom: 28, textAlign: "center" }]}>
                        마이페이지를 이용하려면{"\n"}로그인해주세요
                    </Text>
                    <TouchableOpacity style={s.emptyCTA} onPress={() => router.push("/(auth)/login" as any)}>
                        <Text style={s.emptyCTAText}>로그인하기</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={[s.container, { backgroundColor: t.bg }]} edges={["top"]}>
            {/* ── 공통 헤더 ── */}
            <AppHeaderWithModals />

            {/* ── 페이지 제목 + 탭 카드 ── */}
            <View style={[s.tabBarWrapper, { backgroundColor: t.bg }]}>
                <View style={s.pageHeaderCenter}>
                    <Text style={[s.pageTitle, { color: t.text }]}>마이페이지</Text>
                    <Text style={[s.pageSubtitle, { color: t.textMuted }]}>나의 정보와 활동을 확인하세요</Text>
                </View>

                <View style={[s.tabCard, { backgroundColor: t.card, borderColor: t.border }]}>
                    {TABS.map((tab) => {
                        const active = activeTab === tab.id;
                        return (
                            <TouchableOpacity
                                key={tab.id}
                                style={[s.tabBtn, active && s.tabBtnActive]}
                                onPress={() => setActiveTab(tab.id)}
                                activeOpacity={0.75}
                            >
                                <Ionicons name={tab.icon} size={22} color={active ? "#fff" : t.textMuted} />
                                <Text
                                    style={[
                                        s.tabLabel,
                                        {
                                            color: active ? "#fff" : t.textMuted,
                                            fontWeight: active ? "700" : "500",
                                        },
                                    ]}
                                >
                                    {tab.label}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>
            </View>

            {/* ── 탭 콘텐츠 ── */}
            <View style={{ flex: 1 }}>
                {activeTab === "profile" && profile && <ProfileTab profile={profile} tier={tier} refetch={refetch} />}
                {activeTab === "profile" && !profile && (
                    <ActivityIndicator color={Colors.brandGreen} style={{ marginTop: 40 }} />
                )}
                {activeTab === "footprint" && (
                    <FootprintTab
                        key={params.footprintView === "memories" ? "fp-mem" : "fp-cal"}
                        displayName={profile?.nickname ?? profile?.name ?? ""}
                        initialView={params.footprintView === "memories" ? "memories" : "calendar"}
                    />
                )}
                {activeTab === "records" && <RecordsTab />}
                {activeTab === "activity" && <ActivityTab />}
            </View>
        </SafeAreaView>
    );
}

// ─── 스타일 ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
    container: { flex: 1 },

    // 헤더 + 탭바 wrapper (sticky)
    tabBarWrapper: { paddingBottom: 4 },
    pageHeaderCenter: { alignItems: "center", paddingTop: 16, paddingBottom: 10 },
    pageTitle: { fontSize: 26, fontWeight: "800", letterSpacing: -0.5, marginBottom: 3 },
    pageSubtitle: { fontSize: 13 },

    // 탭 카드 (웹 동일 스타일 — full width, 균등 분배)
    tabCard: {
        marginHorizontal: 16,
        marginBottom: 4,
        borderRadius: 10,
        borderWidth: 1,
        padding: 6,
        flexDirection: "row",
        gap: 4,
    },
    tabBtn: {
        flex: 1,
        alignItems: "center",
        paddingVertical: 10,
        borderRadius: 999,
        gap: 4,
    },
    tabBtnActive: {
        backgroundColor: Colors.emerald600,
        shadowColor: Colors.emerald600,
        shadowOpacity: 0.35,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 4 },
        elevation: 6,
    },
    tabLabel: { fontSize: 12 },

    // 로그인 블록
    loginBlock: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 80 },

    // 탭 공통 스크롤
    tabScroll: { flex: 1 },
    tabContent: { padding: 16, paddingBottom: 40 },

    // 발자취 헤더 카드
    footprintHeaderCard: { borderRadius: 22, borderWidth: 1, padding: 14, marginBottom: 12 },
    footprintHeaderRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
    footprintTitle: { fontSize: 18, fontWeight: "800", letterSpacing: -0.3 },
    footprintDivider: { height: 1, marginTop: 12, marginBottom: 12 },
    footprintSubText: { fontSize: 14, lineHeight: 21 },

    // 서브탭 바
    subTabBar: { flexGrow: 0, borderRadius: 18, borderWidth: 1, marginBottom: 14 },
    subTabBarContent: { padding: 4, gap: 6, flexDirection: "row" },
    subTabBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 999 },
    subTabText: { fontSize: 15, fontWeight: "600" },

    // 섹션 카드
    sectionCard: { borderRadius: 20, borderWidth: 1, padding: 16 },
    sectionTitle: { fontSize: 18, fontWeight: "800", marginBottom: 14, letterSpacing: -0.3 },

    // 코스 카드 (기록용 · 가로형 레거시 — 케이스파일 등에서 참조 시 유지)
    courseCard: { flexDirection: "row", borderRadius: 12, borderWidth: 1, overflow: "hidden", marginBottom: 0 },
    courseCardImg: { width: 80, height: 80, position: "relative", flexShrink: 0, backgroundColor: "#e5e7eb" },
    gradeBadge: { position: "absolute", bottom: 4, left: 4, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
    gradeBadgeText: { fontSize: 9, fontWeight: "800", letterSpacing: 0.3 },
    courseCardBody: { flex: 1, padding: 12, justifyContent: "center" },
    courseCardTitle: { fontSize: 14, fontWeight: "700", marginBottom: 3 },
    courseCardSub: { fontSize: 12, marginBottom: 2 },
    courseCardDate: { fontSize: 11 },
    removeBtn: { padding: 12, alignSelf: "center" },

    // 코스 카드 (기록 탭 · 세로형)
    courseCardVertical: {
        borderRadius: 18,
        borderWidth: 1,
        overflow: "hidden",
        marginBottom: 14,
    },
    courseCardImgWrap: {
        width: "100%",
        aspectRatio: 1.15,
        position: "relative",
        backgroundColor: "#e5e7eb",
    },
    courseCardImgFull: { width: "100%", height: "100%" },
    courseCardBadgeRow: {
        position: "absolute",
        left: 10,
        top: 10,
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 6,
        alignItems: "center",
        maxWidth: "78%",
    },
    courseCardGradePill: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
    courseCardGradePillText: { fontSize: 10, fontWeight: "800", letterSpacing: 0.4 },
    courseCardConceptPill: {
        backgroundColor: "rgba(15,23,42,0.72)",
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 999,
    },
    courseCardConceptPillText: { fontSize: 10, fontWeight: "700", color: "#fff" },
    courseCardHeartBtn: {
        position: "absolute",
        top: 8,
        right: 8,
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: "rgba(255,255,255,0.92)",
        alignItems: "center",
        justifyContent: "center",
        ...Shadow.sm,
    },
    courseCardBodyBelow: { paddingHorizontal: 14, paddingVertical: 12, gap: 4 },
    courseCardTitleBelow: { fontSize: 16, fontWeight: "800", letterSpacing: -0.3, lineHeight: 22 },
    courseCardSubBelow: { fontSize: 13 },
    courseCardDateBelow: { fontSize: 12 },

    // 빈 상태
    emptyState: { alignItems: "center", paddingVertical: 40, gap: 6 },
    emptyEmoji: { fontSize: 44, marginBottom: 4 },
    emptyTitle: { fontSize: 16, fontWeight: "700", letterSpacing: -0.3 },
    emptySub: { fontSize: 13, textAlign: "center" },
    emptyCTA: {
        marginTop: 12,
        backgroundColor: "#059669",
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 999,
    },
    emptyCTAText: { color: "#fff", fontSize: 13, fontWeight: "700" },

    // ── 카드 공통 ──
    card: { borderRadius: 16, borderWidth: 1, padding: 16, marginBottom: 14 },
    cardHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
    cardTitle: { fontSize: 18, fontWeight: "800", letterSpacing: -0.3 },
    cardTitleDark: { fontSize: 18, fontWeight: "800", letterSpacing: -0.3, color: "#1e2a1a" },

    // ── 프로필 카드 ──
    profileCard: { borderRadius: 16, borderWidth: 1, padding: 16, marginBottom: 14 },
    profileCardHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 16,
    },
    tierBadge: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
    tierBadgeText: { fontSize: 11, fontWeight: "800", letterSpacing: 0.3 },
    editProfileBtn: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        paddingHorizontal: 10,
        paddingVertical: 6,
        backgroundColor: "#ecfdf5",
        borderRadius: 8,
    },
    editProfileBtnText: { fontSize: 13, fontWeight: "700", color: "#059669" },
    profileRow: { flexDirection: "row", alignItems: "center", gap: 14 },
    avatarRing: {
        width: 84,
        height: 84,
        borderRadius: 42,
        padding: 3,
        backgroundColor: "#d1fae5",
        shadowColor: "#000",
        shadowOpacity: 0.1,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 4 },
        elevation: 4,
        flexShrink: 0,
    },
    avatarInner: {
        flex: 1,
        borderRadius: 40,
        backgroundColor: "#059669",
        overflow: "hidden",
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 2,
        borderColor: "#fff",
    },
    avatarImg: { width: "100%", height: "100%" },
    avatarInitial: { fontSize: 28, fontWeight: "700", color: "#fff" },
    profileName: { fontSize: 20, fontWeight: "800", letterSpacing: -0.4, marginBottom: 3 },
    profileEmail: { fontSize: 13, marginBottom: 8 },
    profileTagsRow: { flexDirection: "row", flexWrap: "wrap", gap: 5 },
    tagChip: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
    tagChipText: { fontSize: 11, fontWeight: "600" },
    tagChipAmber: {
        backgroundColor: "#fffbeb",
        borderRadius: 8,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderWidth: 1,
        borderColor: "#fde68a",
    },
    tagChipAmberText: { fontSize: 11, fontWeight: "700", color: "#b45309" },

    // ── 취향 정보 ──
    darkBtn: { backgroundColor: "#1f2937", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7 },
    darkBtnText: { fontSize: 13, fontWeight: "700", color: "#fff" },
    prefSection: { borderRadius: 12, borderWidth: 1, padding: 12 },
    prefLabel: {
        fontSize: 10,
        fontWeight: "800",
        color: "#9ca3af",
        letterSpacing: 1,
        textTransform: "uppercase",
        marginBottom: 8,
    },
    prefChipRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
    chipEmerald: {
        backgroundColor: "#d1fae5",
        borderRadius: 8,
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderWidth: 1,
        borderColor: "#a7f3d0",
    },
    chipEmeraldText: { fontSize: 12, fontWeight: "700", color: "#065f46" },
    chipOrange: {
        backgroundColor: "#ffedd5",
        borderRadius: 8,
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderWidth: 1,
        borderColor: "#fed7aa",
    },
    chipOrangeText: { fontSize: 12, fontWeight: "700", color: "#c2410c" },
    chipBlue: {
        backgroundColor: "#dbeafe",
        borderRadius: 8,
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderWidth: 1,
        borderColor: "#bfdbfe",
    },
    chipBlueText: { fontSize: 12, fontWeight: "700", color: "#1e40af" },

    // ── 멤버십 카드 ──
    memberCard: { borderRadius: 16, borderWidth: 1, padding: 16, marginBottom: 14 },
    memberInner: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        borderRadius: 14,
        borderWidth: 1,
        padding: 14,
    },
    memberLeft: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
    memberIconWrap: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: "rgba(16,185,129,0.1)",
        alignItems: "center",
        justifyContent: "center",
    },
    memberSubLabel: { fontSize: 10, fontWeight: "800", color: "#059669", letterSpacing: 0.5, marginBottom: 2 },
    memberTierText: { fontSize: 15, fontWeight: "800", letterSpacing: -0.3, color: "#1e2a1a" },
    memberDescText: { fontSize: 11, marginTop: 1, color: "#4b5563" },
    memberBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
    memberBtnText: { fontSize: 12, fontWeight: "700" },

    // ── 계정 관리 ──
    settingRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingVertical: 13,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    settingIconBox: { width: 38, height: 38, borderRadius: 10, alignItems: "center", justifyContent: "center" },
    settingIconBoxOn: { backgroundColor: "#ecfdf5" },
    settingRowText: { fontSize: 15, fontWeight: "600" },
    withdrawalBtn: { alignItems: "center", paddingVertical: 12, marginBottom: 8 },
    withdrawalBtnText: { fontSize: 13, color: "#9ca3af" },
    actionSheetDim: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.5)",
        justifyContent: "flex-end",
    },
    actionSheetWrap: {
        width: "100%",
    },
    actionSheetCard: {
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingHorizontal: 20,
        paddingTop: 10,
        paddingBottom: 26,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: "#e5e7eb",
    },
    actionSheetHandle: {
        width: 42,
        height: 5,
        borderRadius: 99,
        backgroundColor: "#d1d5db",
        alignSelf: "center",
        marginBottom: 14,
    },
    actionSheetIconWrap: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: "#f3f4f6",
        alignItems: "center",
        justifyContent: "center",
        alignSelf: "center",
        marginBottom: 14,
    },
    actionSheetTitle: {
        fontSize: 22,
        fontWeight: "800",
        textAlign: "center",
        marginBottom: 6,
    },
    actionSheetDesc: {
        fontSize: 13,
        lineHeight: 19,
        textAlign: "center",
        marginBottom: 18,
    },
    actionSheetBtnRow: {
        flexDirection: "row",
        gap: 10,
    },
    actionSheetGhostBtn: {
        flex: 1,
        height: 48,
        borderRadius: 12,
        alignItems: "center",
        justifyContent: "center",
    },
    actionSheetGhostBtnText: { fontSize: 15, fontWeight: "700" },
    actionSheetPrimaryBtn: {
        flex: 1,
        height: 48,
        borderRadius: 12,
        backgroundColor: "#111827",
        alignItems: "center",
        justifyContent: "center",
    },
    actionSheetPrimaryBtnText: { fontSize: 15, fontWeight: "700", color: "#fff" },
    withdrawSheetCard: {
        maxHeight: "86%",
    },
    withdrawHero: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: "#ecfdf5",
        alignItems: "center",
        justifyContent: "center",
        alignSelf: "center",
        marginBottom: 12,
    },
    withdrawHeroEmoji: { fontSize: 30 },
    withdrawNoticeBox: {
        borderWidth: 1,
        borderRadius: 14,
        padding: 12,
        marginBottom: 12,
    },
    withdrawNoticeTitle: { fontSize: 14, fontWeight: "800", marginBottom: 6 },
    withdrawNoticeLine: { fontSize: 12, lineHeight: 18 },
    withdrawReasonBox: {
        borderWidth: 1,
        borderRadius: 14,
        padding: 12,
        marginBottom: 12,
    },
    reasonRow: { flexDirection: "row", alignItems: "center", paddingVertical: 6 },
    reasonRadioOuter: {
        width: 18,
        height: 18,
        borderRadius: 9,
        borderWidth: 2,
        borderColor: "#d1d5db",
        alignItems: "center",
        justifyContent: "center",
        marginRight: 9,
    },
    reasonRadioOuterOn: { borderColor: "#10b981" },
    reasonRadioInner: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#10b981" },
    reasonRowText: { fontSize: 13, fontWeight: "600" },
    withdrawEtcInput: {
        borderWidth: 1,
        borderRadius: 10,
        minHeight: 76,
        paddingHorizontal: 10,
        paddingVertical: 8,
        marginTop: 8,
        textAlignVertical: "top",
        fontSize: 13,
    },
    reasonAgreeRow: { flexDirection: "row", alignItems: "flex-start", marginTop: 12 },
    reasonCheckBox: {
        width: 18,
        height: 18,
        borderRadius: 4,
        borderWidth: 1,
        borderColor: "#d1d5db",
        marginRight: 8,
        marginTop: 1,
        alignItems: "center",
        justifyContent: "center",
    },
    reasonCheckBoxOn: { backgroundColor: "#10b981", borderColor: "#10b981" },
    reasonAgreeText: { flex: 1, fontSize: 12, lineHeight: 17 },
    withdrawBtnStack: { gap: 8 },
    withdrawDangerBtn: {
        width: "100%",
        height: 40,
        alignItems: "center",
        justifyContent: "center",
    },
    withdrawDangerBtnText: { fontSize: 14, fontWeight: "700", color: "#ef4444" },

    footerInfoBox: {
        marginTop: 8,
        paddingTop: 20,
        paddingBottom: 32,
        borderTopWidth: StyleSheet.hairlineWidth,
        gap: 12,
    },
    footerInfoTitle: {
        fontSize: 13,
        fontWeight: "700",
        marginBottom: 4,
    },
    footerInfoLine: {
        fontSize: 11,
        lineHeight: 17,
    },
    footerLinkGrid: {
        flexDirection: "row",
        flexWrap: "wrap",
        marginTop: 4,
        rowGap: 4,
        columnGap: 0,
    },
    footerLinkItem: {
        width: "50%",
        paddingVertical: 8,
        paddingHorizontal: 10,
        borderRadius: 999,
        overflow: "hidden",
    },
    footerLinkText: {
        fontSize: 11,
        fontWeight: "500",
    },

    // 편집 모달
    modalSafe: { flex: 1 },
    modalHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    modalHeaderTitle: { fontSize: 16, fontWeight: "700" },
    modalSaveText: { fontSize: 15, fontWeight: "700", color: "#059669" },
    modalContent: { padding: 16, paddingBottom: 40 },
    editError: {
        backgroundColor: "#fef2f2",
        borderRadius: 10,
        padding: 12,
        marginBottom: 14,
        borderWidth: 1,
        borderColor: "#fecaca",
    },
    editErrorText: { fontSize: 13, color: "#dc2626" },
    editField: { marginBottom: 20 },
    editLabel: { fontSize: 13, fontWeight: "700", marginBottom: 10 },
    editInput: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13, fontSize: 15 },
    editChipsWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    editChip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999, borderWidth: 1 },
    editChipText: { fontSize: 13, fontWeight: "600" },
    editModalBackdrop: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.45)",
        justifyContent: "flex-end",
    },
    editModalSheet: {
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        maxHeight: "82%",
        borderTopWidth: StyleSheet.hairlineWidth,
        borderColor: "rgba(0,0,0,0.08)",
    },
    editModalHandle: { alignItems: "center", paddingTop: 10, paddingBottom: 2 },
    editModalHandleBar: { width: 40, height: 4, borderRadius: 2 },
    editModalHeaderRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 24,
        paddingVertical: 16,
    },
    editModalTitle: { fontSize: 22, fontWeight: "800", letterSpacing: -0.4 },
    editModalScroll: { paddingHorizontal: 24, paddingBottom: 40 },
    editModalBtnRow: { flexDirection: "row", gap: 12, marginTop: 8 },
    editModalBtnCancel: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 12,
        borderWidth: 1,
        alignItems: "center",
    },
    editModalBtnSave: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 12,
        backgroundColor: "#111827",
        alignItems: "center",
    },

    // 발자취 - 뷰 토글
    viewToggle: { flexDirection: "row", borderRadius: 999, padding: 4, marginBottom: 14, borderWidth: 1, gap: 6 },
    viewToggleBtn: {
        minWidth: 72,
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: 10,
        borderRadius: 999,
    },
    viewToggleText: { fontSize: 15 },

    // 캘린더
    calCard: { borderRadius: 16, borderWidth: 1, padding: 14, marginBottom: 0 },
    calNav: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 },
    calNavYear: { fontSize: 11, fontWeight: "600", letterSpacing: 0.2, marginBottom: 2 },
    calNavTitle: { fontSize: 20, fontWeight: "800", letterSpacing: -0.4 },
    calDayNames: { flexDirection: "row", marginBottom: 4 },
    calDayName: { flex: 1, textAlign: "center", fontSize: 11, fontWeight: "600", paddingBottom: 6 },
    calGrid: { width: "100%" },
    calRow: { flexDirection: "row", width: "100%", marginBottom: 2 },
    calCell: { flex: 1, alignItems: "center", paddingVertical: 4 },
    calDayCircle: {
        width: CAL_CIRCLE,
        height: CAL_CIRCLE,
        borderRadius: CAL_CIRCLE / 2,
        borderWidth: 1,
        borderColor: "#e5e7eb",
        overflow: "hidden",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "transparent",
    },
    calDayCircleSelected: {
        borderWidth: 2,
        borderColor: "#059669",
        backgroundColor: "rgba(5,150,105,0.06)",
    },
    calDayCircleToday: { borderColor: "#34d399", borderWidth: 1.5 },
    calDayCircleMuted: { opacity: 0.35 },
    calDayThumb: { width: "100%", height: "100%" },
    calDateInCircle: { fontSize: 13, fontWeight: "600" },
    calCompletedCornerDot: {
        position: "absolute",
        bottom: 3,
        right: 3,
        width: 7,
        height: 7,
        borderRadius: 4,
        backgroundColor: "#10b981",
        borderWidth: 1,
        borderColor: "#fff",
    },
    calItemCountOnCircle: {
        position: "absolute",
        top: -2,
        right: -2,
        backgroundColor: "#059669",
        borderRadius: 8,
        minWidth: 16,
        paddingHorizontal: 4,
        alignItems: "center",
        borderWidth: 1,
        borderColor: "#fff",
    },
    calDateNum: { fontSize: 13, fontWeight: "500" },
    calTodayDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: "#059669", marginTop: 3 },
    calItemDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: "#10b981",
        marginTop: 3,
        position: "relative",
    },
    calItemDotSelected: { backgroundColor: "#059669" },
    calItemCount: {
        position: "absolute",
        top: -6,
        right: -10,
        backgroundColor: "#059669",
        borderRadius: 8,
        minWidth: 14,
        paddingHorizontal: 3,
        alignItems: "center",
    },
    calItemCountText: { color: "#fff", fontSize: 8, fontWeight: "800" },
    calStats: { flexDirection: "row", borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 12, marginTop: 10 },
    calStatsAbove: {
        borderTopWidth: 0,
        marginTop: 0,
        marginBottom: 12,
        paddingTop: 0,
        paddingBottom: 12,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    calStat: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5 },
    calStatDiv: { width: StyleSheet.hairlineWidth, marginVertical: 2 },
    calStatLabel: { fontSize: 12 },
    calStatVal: { fontSize: 14, fontWeight: "800", color: "#059669" },

    coursePreviewRoot: {
        flex: 1,
        backgroundColor: "#000",
        justifyContent: "center",
    },
    coursePreviewCenter: {
        flex: 1,
        justifyContent: "center",
        pointerEvents: "box-none",
    },
    coursePreviewCard: {
        borderRadius: 24,
        overflow: "hidden",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.35,
        shadowRadius: 24,
        elevation: 16,
    },
    coursePreviewImgWrap: {
        width: "100%",
        backgroundColor: "#111827",
        position: "relative",
    },
    coursePreviewClose: {
        position: "absolute",
        top: 12,
        right: 12,
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: "rgba(0,0,0,0.45)",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 20,
    },
    coursePreviewBadgeRow: {
        position: "absolute",
        bottom: 16,
        left: 20,
        flexDirection: "row",
        gap: 6,
    },
    coursePreviewBadgeAi: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
        backgroundColor: "#f59e0b",
    },
    coursePreviewBadgeAiText: {
        color: "#fff",
        fontSize: 10,
        fontWeight: "900",
        letterSpacing: 0.3,
    },
    coursePreviewBadgeDone: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
        backgroundColor: "#10b981",
    },
    coursePreviewBadgeDoneText: {
        color: "#fff",
        fontSize: 10,
        fontWeight: "900",
        letterSpacing: 0.3,
    },
    coursePreviewBody: {
        paddingHorizontal: 22,
        paddingTop: 20,
        paddingBottom: 22,
        minHeight: 220,
    },
    coursePreviewKicker: {
        fontSize: 9,
        fontWeight: "900",
        letterSpacing: 2,
        marginBottom: 6,
    },
    coursePreviewTitle: {
        fontSize: 20,
        fontWeight: "900",
        letterSpacing: -0.5,
        lineHeight: 26,
        marginBottom: 10,
    },
    coursePreviewDesc: {
        fontSize: 13,
        lineHeight: 19,
        fontWeight: "500",
        marginBottom: 18,
    },
    coursePreviewMetaRow: {
        flexDirection: "row",
        gap: 10,
        marginBottom: 18,
    },
    coursePreviewMetaBox: {
        flex: 1,
        borderRadius: 12,
        padding: 12,
        borderWidth: StyleSheet.hairlineWidth,
    },
    coursePreviewMetaLabelRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 5,
        marginBottom: 4,
    },
    coursePreviewMetaLabel: {
        fontSize: 9,
        fontWeight: "700",
    },
    coursePreviewMetaVal: {
        fontSize: 12,
        fontWeight: "900",
    },
    coursePreviewCta: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        paddingVertical: 14,
        borderRadius: 12,
    },
    coursePreviewCtaText: {
        color: "#fff",
        fontSize: 14,
        fontWeight: "900",
    },
    coursePreviewSwipeHint: {
        position: "absolute",
        left: 0,
        right: 0,
        textAlign: "center",
        color: "rgba(255,255,255,0.55)",
        fontSize: 12,
        fontWeight: "700",
    },

    // 추억 카드
    memCard: { borderRadius: 16, borderWidth: 1, overflow: "hidden" },
    memImg: { width: "100%", height: 180 },
    memBody: { padding: 14 },
    memDate: { fontSize: 11, marginBottom: 4 },
    memCourse: { fontSize: 15, fontWeight: "700", marginBottom: 8, letterSpacing: -0.3 },
    memTagRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 6 },
    memTag: { backgroundColor: "#dcfce7", borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
    memTagText: { fontSize: 11, fontWeight: "600", color: "#166534" },

    // 날짜 바텀시트
    sheetOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
    sheet: {
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        paddingTop: 12,
        paddingHorizontal: 16,
        paddingBottom: 32,
        maxHeight: "60%",
    },
    sheetHandle: { width: 40, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 14 },
    sheetTitle: { fontSize: 17, fontWeight: "800", marginBottom: 14, letterSpacing: -0.3 },
    sheetRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        paddingVertical: 12,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    sheetRowImg: {
        width: 52,
        height: 52,
        borderRadius: 10,
        backgroundColor: "#e5e7eb",
        overflow: "hidden",
        alignItems: "center",
        justifyContent: "center",
    },
    sheetRowTitle: { fontSize: 14, fontWeight: "700", marginBottom: 2 },
    sheetRowSub: { fontSize: 12 },

    // 케이스파일
    caseCard: { borderRadius: 14, overflow: "hidden", position: "relative" },
    caseImgWrap: { width: "100%", height: 200, position: "relative" },
    caseOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.45)" },
    caseTextWrap: { position: "absolute", bottom: 0, left: 0, right: 0, padding: 14 },
    caseTitle: { color: "#fff", fontSize: 16, fontWeight: "800", marginBottom: 4, lineHeight: 22 },
    caseMeta: { flexDirection: "row", gap: 8 },
    caseMetaText: { color: "rgba(255,255,255,0.8)", fontSize: 11 },
    caseBadge: {
        position: "absolute",
        top: 10,
        right: 10,
        backgroundColor: "#f59e0b",
        borderRadius: 999,
        paddingHorizontal: 10,
        paddingVertical: 4,
    },
    caseBadgeText: { color: "#fff", fontSize: 11, fontWeight: "800" },

    // 뱃지 그리드
    badgeGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
    badgeCard: { width: "47%", borderRadius: 12, borderWidth: 1, padding: 14, alignItems: "center", gap: 6 },
    badgeImgWrap: {
        width: 72,
        height: 72,
        borderRadius: 36,
        backgroundColor: "#fef9c3",
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 4,
    },
    badgeImg: { width: 60, height: 60 },
    badgeName: { fontSize: 13, fontWeight: "700", textAlign: "center" },
    badgeDate: { fontSize: 10, textAlign: "center" },

    // 보상 행
    rewardRow: {
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 14,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    rewardLabel: { fontSize: 14, fontWeight: "600", marginBottom: 3 },
    rewardDate: { fontSize: 11 },
    rewardBadge: {
        backgroundColor: "#ecfdf5",
        borderRadius: 999,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderWidth: 1,
        borderColor: "#d1fae5",
    },
    rewardBadgeText: { fontSize: 13, fontWeight: "800", color: "#065f46" },

    // 결제 카드
    payCard: { borderRadius: 14, borderWidth: 1, padding: 14 },
    payTop: { flexDirection: "row", alignItems: "flex-start" },
    payBadgeRow: { flexDirection: "row", flexWrap: "wrap", gap: 5, marginBottom: 6 },
    payBadgeTicket: { backgroundColor: "#fef9c3", borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
    payBadgeSub: { backgroundColor: "#f3e8ff", borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
    payBadgeText: { fontSize: 11, fontWeight: "700", color: "#92400e" },
    payBadgeRefund: { backgroundColor: "#f3f4f6", borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
    payStatusText: { fontSize: 11, fontWeight: "600", color: "#6b7280" },
    payBadgePaid: { backgroundColor: "#ecfdf5", borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
    payStatusTextGreen: { fontSize: 11, fontWeight: "600", color: "#059669" },
    payOrder: { fontSize: 15, fontWeight: "700", marginBottom: 4, letterSpacing: -0.3 },
    payDate: { fontSize: 12, marginBottom: 2 },
    payMethod: { fontSize: 11 },
    payAmount: { fontSize: 18, fontWeight: "800", marginLeft: 10 },
    refundBtn: { marginTop: 12, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth, alignItems: "center" },
    refundBtnText: { fontSize: 14, fontWeight: "600" },

    // 뱃지 상세 모달
    badgeModalBg: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.6)",
        alignItems: "center",
        justifyContent: "center",
        padding: 32,
    },
    badgeModalCard: { borderRadius: 20, padding: 24, alignItems: "center", width: "100%" },
    badgeModalImgWrap: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: "#fef9c3",
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 16,
    },
    badgeModalImg: { width: 80, height: 80 },
    badgeModalName: { fontSize: 20, fontWeight: "800", color: "#111", marginBottom: 8, textAlign: "center" },
    badgeModalDesc: { fontSize: 14, color: "#6b7280", textAlign: "center", marginBottom: 8, lineHeight: 20 },
    badgeModalDateText: { fontSize: 12, color: "#9ca3af", marginBottom: 20 },
    badgeModalCloseBtn: { backgroundColor: "#f3f4f6", borderRadius: 10, paddingVertical: 12, paddingHorizontal: 32 },
    badgeModalCloseTxt: { fontSize: 14, fontWeight: "700", color: "#374151" },

    // 로그인 CTA
    loginCTA: { backgroundColor: "#059669", borderRadius: 999, paddingHorizontal: 24, paddingVertical: 14 },
    loginCTAText: { color: "#fff", fontSize: 15, fontWeight: "700" },

    // 로그아웃 모달
    logoutSheet: {
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingTop: 32,
        paddingHorizontal: 24,
        borderTopWidth: 1,
    },
    logoutIconWrap: {
        alignItems: "center",
        marginBottom: 16,
    },
    logoutTitle: {
        fontSize: 18,
        fontWeight: "800",
        textAlign: "center",
        marginBottom: 6,
        letterSpacing: -0.3,
    },
    logoutSubtitle: {
        fontSize: 13,
        textAlign: "center",
        lineHeight: 19,
        marginBottom: 24,
    },
    logoutBtnRow: {
        flexDirection: "row",
        gap: 10,
    },
    logoutBtnGray: {
        flex: 1,
        height: 50,
        borderRadius: 12,
        alignItems: "center",
        justifyContent: "center",
    },
    logoutBtnGrayText: {
        fontSize: 15,
        fontWeight: "700",
    },
    logoutBtnDark: {
        flex: 1,
        height: 50,
        borderRadius: 12,
        alignItems: "center",
        justifyContent: "center",
    },
    logoutBtnDarkText: {
        color: "#fff",
        fontSize: 15,
        fontWeight: "700",
    },

    // 회원탈퇴 모달 (센터 다이얼로그)
    withdrawDim: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.55)",
        justifyContent: "flex-end",
    },
    withdrawSheet: {
        width: "100%",
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        borderBottomLeftRadius: 0,
        borderBottomRightRadius: 0,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
        elevation: 16,
        paddingTop: 12,
    },
    withdrawHandle: {
        width: 40,
        height: 4,
        borderRadius: 2,
        backgroundColor: "#d1d5db",
        alignSelf: "center",
        marginBottom: 16,
    },
    withdrawScrollContent: {
        padding: 24,
        paddingBottom: 16,
    },
    withdrawEmojiCircle: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: "#dcfce7",
        alignItems: "center",
        justifyContent: "center",
        alignSelf: "center",
        marginBottom: 14,
    },
    withdrawDialogTitle: {
        fontSize: 18,
        fontWeight: "800",
        textAlign: "center",
        letterSpacing: -0.3,
        marginBottom: 18,
    },
    withdrawWarnCard: {
        borderRadius: 14,
        padding: 14,
        borderWidth: 1,
        marginBottom: 12,
    },
    withdrawWarnRow: {
        flexDirection: "row",
        gap: 10,
    },
    withdrawWarnIcon: {
        fontSize: 18,
        marginTop: 1,
    },
    withdrawWarnTitle: {
        fontSize: 13,
        fontWeight: "700",
        marginBottom: 4,
    },
    withdrawWarnDesc: {
        fontSize: 12,
        lineHeight: 17,
    },
    withdrawReasonCard: {
        borderRadius: 14,
        padding: 14,
        borderWidth: 1,
        marginBottom: 12,
    },
    withdrawReasonTitle: {
        fontSize: 13,
        fontWeight: "700",
        marginBottom: 10,
    },
    withdrawDialogBtns: {
        flexDirection: "row",
        gap: 10,
        paddingHorizontal: 24,
        paddingTop: 12,
        paddingBottom: 16,
    },
    withdrawStayBtn: {
        flex: 1,
        height: 48,
        borderRadius: 12,
        backgroundColor: "#059669",
        alignItems: "center",
        justifyContent: "center",
    },
    withdrawStayBtnText: {
        color: "#fff",
        fontSize: 15,
        fontWeight: "700",
    },
    withdrawDangerTextBtn: {
        flex: 1,
        height: 48,
        borderRadius: 12,
        alignItems: "center",
        justifyContent: "center",
    },
    withdrawDangerTextBtnText: {
        fontSize: 15,
        fontWeight: "700",
        color: "#ef4444",
    },
});
