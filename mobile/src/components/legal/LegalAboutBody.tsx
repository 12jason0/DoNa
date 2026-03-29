/**
 * 웹 src/app/(home)/about/page.tsx 주요 섹션·문구·데이터 (React Native)
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
    View,
    Text,
    StyleSheet,
    Dimensions,
    FlatList,
    TouchableOpacity,
    ActivityIndicator,
    Linking,
    Image,
    NativeSyntheticEvent,
    NativeScrollEvent,
} from "react-native";
import { useRouter } from "expo-router";

import { BASE_URL } from "../../lib/api";
import { resolveImageUrl } from "../../lib/imageUrl";
import { Colors } from "../../constants/theme";

type Theme = {
    text: string;
    textMuted: string;
    surface: string;
    border: string;
    card: string;
    isDark: boolean;
};

type Props = {
    tr: (key: string) => string;
    theme: Theme;
};

type Course = {
    id: string;
    title: string;
    description?: string;
    duration?: string;
    location?: string;
    price?: string;
    participants?: number;
    imageUrl?: string;
    concept?: string;
    rating?: number;
};

type Review = {
    id: string;
    rating: number;
    comment: string;
    imageUrls?: string[];
    user?: { nickname?: string; initial?: string };
    course?: { title?: string; concept?: string };
};

const SLIDE_WIDTH = Dimensions.get("window").width - 40;

export default function LegalAboutBody({ tr, theme }: Props) {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [courseCount, setCourseCount] = useState(0);
    const [courses, setCourses] = useState<Course[]>([]);
    const [reviews, setReviews] = useState<Review[]>([]);
    const [courseIndex, setCourseIndex] = useState(0);
    const [reviewIndex, setReviewIndex] = useState(0);
    const reviewListRef = useRef<FlatList<Review> | null>(null);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const [countRes, coursesRes, reviewsRes] = await Promise.all([
                fetch(`${BASE_URL}/api/courses/count`, { credentials: "omit" }),
                fetch(`${BASE_URL}/api/courses?limit=3&grade=FREE`, { credentials: "omit" }),
                fetch(`${BASE_URL}/api/reviews?limit=9`, { credentials: "omit" }),
            ]);
            if (countRes.ok) {
                const d: { count?: number } = await countRes.json();
                setCourseCount(d.count ?? 0);
            } else setCourseCount(0);
            if (coursesRes.ok) {
                const list = await coursesRes.json();
                setCourses(Array.isArray(list) ? list : []);
            } else setCourses([]);
            if (reviewsRes.ok) {
                const list = await reviewsRes.json();
                setReviews(Array.isArray(list) ? list.slice(0, 9) : []);
            } else setReviews([]);
        } catch {
            setCourseCount(0);
            setCourses([]);
            setReviews([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void fetchData();
    }, [fetchData]);

    useEffect(() => {
        if (reviews.length === 0) return;
        const id = setInterval(() => {
            setReviewIndex((p) => (p + 1) % reviews.length);
        }, 5000);
        return () => clearInterval(id);
    }, [reviews.length]);

    useEffect(() => {
        if (reviews.length === 0) return;
        reviewListRef.current?.scrollToOffset({ offset: reviewIndex * SLIDE_WIDTH, animated: true });
    }, [reviewIndex, reviews.length]);

    const stepColors = [
        { bg: "#2563eb", emoji: "1️⃣" },
        { bg: "#9333ea", emoji: "2️⃣" },
        { bg: "#16a34a", emoji: "3️⃣" },
    ] as const;

    const badges = [
        { emoji: "💕", label: tr("about.badgeCouple"), bg: "#2563eb" },
        { emoji: "👨‍👩‍👧‍👦", label: tr("about.badgeFamily"), bg: "#9333ea" },
        { emoji: "👥", label: tr("about.badgeFriends"), bg: "#16a34a" },
        { emoji: "☕", label: tr("about.badgeCafe"), bg: "#ea580c" },
        { emoji: "🍽️", label: tr("about.badgeFood"), bg: "#dc2626" },
        { emoji: "🌿", label: tr("about.badgeHealing"), bg: "#0d9488" },
    ];

    const onCourseScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
        const x = e.nativeEvent.contentOffset.x;
        const idx = Math.round(x / SLIDE_WIDTH);
        setCourseIndex(Math.max(0, Math.min(idx, Math.max(courses.length - 1, 0))));
    };

    const sectionAltBg = theme.isDark ? "#0f1710" : "#fff";
    const graySection = theme.isDark ? "#1a241b" : "#f9fafb";

    const renderCourse = ({ item }: { item: Course }) => {
        const img = resolveImageUrl(item.imageUrl) ?? "https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=400&h=200&fit=crop";
        return (
            <View style={{ width: SLIDE_WIDTH }}>
                <TouchableOpacity
                    activeOpacity={0.9}
                    onPress={() => router.push(`/courses/${item.id}` as never)}
                    style={[styles.courseCard, { backgroundColor: theme.card, borderColor: theme.border }]}
                >
                    <View style={styles.courseImgWrap}>
                        <Image source={{ uri: img }} style={styles.courseImg} resizeMode="cover" />
                        <View style={styles.conceptPill}>
                            <Text style={styles.conceptPillText}>{item.concept || "코스"}</Text>
                        </View>
                    </View>
                    <View style={styles.courseBody}>
                        <View style={styles.courseTitleRow}>
                            <Text style={[styles.courseTitle, { color: theme.text }]} numberOfLines={1}>
                                {item.title}
                            </Text>
                            <Text style={styles.rating}>⭐ {item.rating ?? 4.5}</Text>
                        </View>
                        <Text style={[styles.courseDesc, { color: theme.textMuted }]} numberOfLines={2}>
                            {item.description || "완벽한 여행 코스"}
                        </Text>
                        <View style={styles.metaRow}>
                            <View style={[styles.metaPill, { backgroundColor: theme.surface }]}>
                                <Text style={[styles.metaText, { color: theme.textMuted }]}>⏰ {item.duration || "4시간"}</Text>
                            </View>
                            <View style={[styles.metaPill, { backgroundColor: theme.surface }]}>
                                <Text style={[styles.metaText, { color: theme.textMuted }]}>📍 {item.location || "서울"}</Text>
                            </View>
                            {item.price ? (
                                <View style={[styles.metaPill, { backgroundColor: theme.surface }]}>
                                    <Text style={[styles.metaText, { color: theme.textMuted }]}>💰 {item.price}</Text>
                                </View>
                            ) : null}
                        </View>
                        <View style={styles.courseFooter}>
                            <Text style={[styles.participants, { color: theme.textMuted }]}>
                                👥 지금 {item.participants ?? 0}명 진행중
                            </Text>
                            <View style={styles.startBtn}>
                                <Text style={styles.startBtnText}>코스 시작하기</Text>
                            </View>
                        </View>
                    </View>
                </TouchableOpacity>
            </View>
        );
    };

    const conceptColors = (concept?: string) => {
        const c = (concept || "").toLowerCase();
        if (c.includes("커플") || c === "couple") return { bg: "#dbeafe", fg: "#2563eb" };
        if (c.includes("가족") || c === "family") return { bg: "#f3e8ff", fg: "#9333ea" };
        if (c.includes("친구") || c === "friend") return { bg: "#dcfce7", fg: "#16a34a" };
        return { bg: theme.surface, fg: theme.textMuted };
    };

    return (
        <View>
            <View style={[styles.hero, { backgroundColor: sectionAltBg }]}>
                <Text style={styles.heroEmoji}>📦</Text>
                <Text style={[styles.heroTitle, { color: theme.text }]}>{tr("about.heroTitle")}</Text>
                <Text style={styles.heroTag}>{tr("about.heroTagline")}</Text>
                <Text style={[styles.heroDesc, { color: theme.textMuted }]}>{tr("about.heroDesc")}</Text>
                <View style={styles.badgeWrap}>
                    {badges.map((b) => (
                        <View key={b.label} style={[styles.heroBadge, { backgroundColor: b.bg }]}>
                            <Text style={styles.heroBadgeText}>
                                {b.emoji} {b.label}
                            </Text>
                        </View>
                    ))}
                </View>
            </View>

            <View style={[styles.statsSection, { backgroundColor: sectionAltBg }]}>
                <View style={styles.statBlock}>
                    <Text style={styles.statNumBlue}>213+</Text>
                    <Text style={[styles.statLabel, { color: theme.textMuted }]}>{tr("about.statsUsers")}</Text>
                </View>
                <View style={styles.statBlock}>
                    <Text style={styles.statNumPurple}>4.7★</Text>
                    <Text style={[styles.statLabel, { color: theme.textMuted }]}>{tr("about.statsRating")}</Text>
                </View>
                <View style={styles.statBlock}>
                    <Text style={styles.statNumGreen}>{loading ? "…" : String(courseCount)}</Text>
                    <Text style={[styles.statLabel, { color: theme.textMuted }]}>{tr("about.statsCourses")}</Text>
                </View>
            </View>

            <View style={[styles.stepsSection, { backgroundColor: graySection }]}>
                <Text style={[styles.sectionTitle, { color: theme.text }]}>{tr("about.stepsTitle")}</Text>
                {([1, 2, 3] as const).map((n, i) => (
                    <View key={n} style={[styles.stepCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
                        <View style={[styles.stepCircle, { backgroundColor: stepColors[i].bg }]}>
                            <Text style={styles.stepEmoji}>{stepColors[i].emoji}</Text>
                        </View>
                        <Text style={[styles.stepTitle, { color: theme.text }]}>
                            {tr(`about.step${n}Title` as "about.step1Title")}
                        </Text>
                        <Text style={[styles.stepDesc, { color: theme.textMuted }]}>
                            {tr(`about.step${n}Desc` as "about.step1Desc")}
                        </Text>
                    </View>
                ))}
            </View>

            <View style={[styles.coursesSection, { backgroundColor: sectionAltBg }]}>
                <Text style={[styles.sectionTitle, { color: theme.text }]}>이런 코스들이 준비되어 있어요</Text>
                {loading ? (
                    <View style={styles.loader}>
                        <ActivityIndicator color={Colors.brandGreen} />
                    </View>
                ) : courses.length > 0 ? (
                    <>
                        <FlatList
                            data={courses}
                            keyExtractor={(c) => c.id}
                            horizontal
                            pagingEnabled
                            showsHorizontalScrollIndicator={false}
                            snapToInterval={SLIDE_WIDTH}
                            decelerationRate="fast"
                            onMomentumScrollEnd={onCourseScroll}
                            renderItem={renderCourse}
                        />
                        <View style={styles.dots}>
                            {courses.map((_, i) => (
                                <View
                                    key={i}
                                    style={[
                                        styles.dot,
                                        i === courseIndex ? { backgroundColor: "#2563eb" } : { backgroundColor: "#d1d5db" },
                                    ]}
                                />
                            ))}
                        </View>
                    </>
                ) : (
                    <Text style={[styles.emptyText, { color: theme.textMuted }]}>준비된 코스가 없습니다.</Text>
                )}
            </View>

            <View style={[styles.reviewsSection, { backgroundColor: graySection }]}>
                <Text style={[styles.sectionTitle, { color: theme.text }]}>실제 사용자들의 생생한 후기</Text>
                {loading ? (
                    <View style={styles.loader}>
                        <ActivityIndicator color={Colors.brandGreen} />
                    </View>
                ) : reviews.length > 0 ? (
                    <>
                        <FlatList
                            ref={reviewListRef}
                            data={reviews}
                            keyExtractor={(r) => r.id}
                            horizontal
                            pagingEnabled
                            showsHorizontalScrollIndicator={false}
                            snapToInterval={SLIDE_WIDTH}
                            decelerationRate="fast"
                            onMomentumScrollEnd={(e) => {
                                const x = e.nativeEvent.contentOffset.x;
                                setReviewIndex(Math.round(x / SLIDE_WIDTH));
                            }}
                            getItemLayout={(_, index) => ({
                                length: SLIDE_WIDTH,
                                offset: SLIDE_WIDTH * index,
                                index,
                            })}
                            renderItem={({ item: review }) => {
                                const { bg, fg } = conceptColors(review.course?.concept);
                                return (
                                    <View style={{ width: SLIDE_WIDTH }}>
                                        <View style={[styles.reviewCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
                                            <View style={styles.reviewHead}>
                                                <View style={[styles.avatar, { backgroundColor: bg }]}>
                                                    <Text style={[styles.avatarText, { color: fg }]}>
                                                        {review.user?.initial || "?"}
                                                    </Text>
                                                </View>
                                                <View style={{ flex: 1 }}>
                                                    <Text style={[styles.nick, { color: theme.text }]}>
                                                        {review.user?.nickname || ""}
                                                    </Text>
                                                    <Text style={[styles.courseName, { color: theme.textMuted }]} numberOfLines={1}>
                                                        {review.course?.title}
                                                    </Text>
                                                </View>
                                                <Text style={styles.stars}>{"⭐".repeat(review.rating || 0)}</Text>
                                            </View>
                                            <Text style={[styles.comment, { color: theme.textMuted }]}>&quot;{review.comment}&quot;</Text>
                                        </View>
                                    </View>
                                );
                            }}
                        />
                        <View style={styles.dots}>
                            {reviews.map((_, i) => (
                                <View
                                    key={i}
                                    style={[
                                        styles.dot,
                                        i === reviewIndex ? { backgroundColor: "#2563eb" } : { backgroundColor: "#d1d5db" },
                                    ]}
                                />
                            ))}
                        </View>
                    </>
                ) : (
                    <Text style={[styles.emptyText, { color: theme.textMuted }]}>등록된 후기가 없습니다.</Text>
                )}
            </View>

            <View style={[styles.whySection, { backgroundColor: sectionAltBg }]}>
                <Text style={[styles.whyTitle, { color: theme.text }]}>왜 DoNa인가요?</Text>
                <View style={[styles.whyCard, { backgroundColor: theme.isDark ? "rgba(30,58,138,0.2)" : "#f0f9ff" }]}>
                    <Text style={[styles.whyH3, { color: theme.text }]}>여행 계획하기 너무 귀찮으시죠?</Text>
                    <Text style={[styles.whyP, { color: theme.textMuted }]}>
                        &quot;어디 갈까?&quot;, &quot;뭐 먹을까?&quot;, &quot;길 찾기 어려워...&quot; 이런 고민들, 이제 그만!
                    </Text>
                    <Text style={[styles.whyP, { color: theme.textMuted }]}>
                        DoNa는 여러분이 직접 여행 계획을 짤 필요 없이, 이미 검증된 완벽한 코스를 밀키트처럼 제공해드립니다.
                    </Text>
                    <Text style={[styles.whyP, { color: theme.textMuted }]}>
                        컨셉과 카테고리만 선택하면 AI가 여러분을 위한 최적의 여행 코스를 만들어드려요!
                    </Text>
                    <View style={styles.whyCircle}>
                        <Text style={styles.whyCircleEmoji}>🎯</Text>
                    </View>
                </View>
            </View>

            <View style={[styles.ctaSection, { backgroundColor: sectionAltBg }]}>
                <Text style={[styles.ctaTitle, { color: theme.text }]}>지금 바로 여행을 시작해보세요!</Text>
                <Text style={[styles.ctaSub, { color: theme.textMuted }]}>
                    복잡한 계획 없이, 밀키트처럼 간편하게 완벽한 여행을 경험해보세요.
                </Text>
                <TouchableOpacity
                    style={styles.ctaBlue}
                    onPress={() => void Linking.openURL(`${BASE_URL}/personalized-home`)}
                    activeOpacity={0.85}
                >
                    <Text style={styles.ctaBtnText}>🎯 오늘의 데이트 추천 바로 가기</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={styles.ctaPurple}
                    onPress={() => void Linking.openURL(`${BASE_URL}/map`)}
                    activeOpacity={0.85}
                >
                    <Text style={styles.ctaBtnText}>🗺️ 지도에서 탐색하기</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    hero: { alignItems: "center", paddingVertical: 24, paddingHorizontal: 8 },
    heroEmoji: { fontSize: 56, marginBottom: 12 },
    heroTitle: { fontSize: 26, fontWeight: "800", textAlign: "center", marginBottom: 10 },
    heroTag: { fontSize: 17, fontWeight: "700", color: "#2563eb", marginBottom: 10, textAlign: "center" },
    heroDesc: { fontSize: 15, lineHeight: 22, textAlign: "center", marginBottom: 16 },
    badgeWrap: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 8 },
    heroBadge: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
    heroBadgeText: { color: "#fff", fontSize: 13, fontWeight: "700" },
    statsSection: { paddingVertical: 20, gap: 14 },
    statBlock: { alignItems: "center" },
    statNumBlue: { fontSize: 22, fontWeight: "800", color: "#2563eb", marginBottom: 4 },
    statNumPurple: { fontSize: 22, fontWeight: "800", color: "#9333ea", marginBottom: 4 },
    statNumGreen: { fontSize: 22, fontWeight: "800", color: "#16a34a", marginBottom: 4 },
    statLabel: { fontSize: 14 },
    stepsSection: { paddingVertical: 28, paddingHorizontal: 4 },
    sectionTitle: { fontSize: 20, fontWeight: "800", textAlign: "center", marginBottom: 18 },
    stepCard: {
        alignItems: "center",
        padding: 16,
        borderRadius: 14,
        borderWidth: 1,
        marginBottom: 14,
    },
    stepCircle: {
        width: 48,
        height: 48,
        borderRadius: 24,
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 10,
    },
    stepEmoji: { fontSize: 22 },
    stepTitle: { fontSize: 17, fontWeight: "700", marginBottom: 6, textAlign: "center" },
    stepDesc: { fontSize: 14, lineHeight: 21, textAlign: "center" },
    coursesSection: { paddingVertical: 28 },
    loader: { paddingVertical: 40, alignItems: "center" },
    courseCard: { borderRadius: 14, borderWidth: 1, overflow: "hidden", marginRight: 0 },
    courseImgWrap: { height: 160, position: "relative" },
    courseImg: { width: "100%", height: "100%" },
    conceptPill: {
        position: "absolute",
        top: 10,
        right: 10,
        backgroundColor: "#ef4444",
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 999,
    },
    conceptPillText: { color: "#fff", fontSize: 12, fontWeight: "700" },
    courseBody: { padding: 12 },
    courseTitleRow: { flexDirection: "row", alignItems: "center", marginBottom: 6, gap: 8 },
    courseTitle: { flex: 1, fontSize: 16, fontWeight: "800" },
    rating: { fontSize: 14, color: "#eab308", fontWeight: "600" },
    courseDesc: { fontSize: 13, lineHeight: 19, marginBottom: 8 },
    metaRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 10 },
    metaPill: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
    metaText: { fontSize: 11, fontWeight: "600" },
    courseFooter: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    participants: { fontSize: 13 },
    startBtn: { backgroundColor: "#2563eb", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
    startBtnText: { color: "#fff", fontSize: 13, fontWeight: "700" },
    dots: { flexDirection: "row", justifyContent: "center", gap: 8, marginTop: 16 },
    dot: { width: 8, height: 8, borderRadius: 4 },
    emptyText: { textAlign: "center", paddingVertical: 24, fontSize: 15 },
    reviewsSection: { paddingVertical: 28 },
    reviewCard: { borderRadius: 14, borderWidth: 1, padding: 14, marginRight: 0 },
    reviewHead: { flexDirection: "row", alignItems: "center", marginBottom: 10, gap: 10 },
    avatar: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
    avatarText: { fontWeight: "800", fontSize: 16 },
    nick: { fontWeight: "700", fontSize: 15 },
    courseName: { fontSize: 11, marginTop: 2 },
    stars: { fontSize: 12, color: "#eab308" },
    comment: { fontSize: 14, lineHeight: 21 },
    whySection: { paddingVertical: 28, paddingHorizontal: 8 },
    whyTitle: { fontSize: 22, fontWeight: "800", textAlign: "center", marginBottom: 20 },
    whyCard: {
        borderRadius: 18,
        padding: 22,
    },
    whyH3: { fontSize: 20, fontWeight: "700", marginBottom: 12 },
    whyP: { fontSize: 15, lineHeight: 23, marginBottom: 10 },
    whyCircle: {
        width: 120,
        height: 120,
        borderRadius: 60,
        backgroundColor: "#60a5fa",
        alignSelf: "center",
        marginTop: 16,
        alignItems: "center",
        justifyContent: "center",
    },
    whyCircleEmoji: { fontSize: 48 },
    ctaSection: { paddingVertical: 32, paddingHorizontal: 8, alignItems: "center" },
    ctaTitle: { fontSize: 22, fontWeight: "800", textAlign: "center", marginBottom: 12 },
    ctaSub: { fontSize: 17, textAlign: "center", marginBottom: 22, lineHeight: 25 },
    ctaBlue: {
        backgroundColor: "#2563eb",
        paddingVertical: 14,
        paddingHorizontal: 20,
        borderRadius: 10,
        marginBottom: 12,
        width: "100%",
        maxWidth: 360,
    },
    ctaPurple: {
        backgroundColor: "#9333ea",
        paddingVertical: 14,
        paddingHorizontal: 20,
        borderRadius: 10,
        width: "100%",
        maxWidth: 360,
    },
    ctaBtnText: { color: "#fff", fontSize: 16, fontWeight: "700", textAlign: "center" },
});
