import React, { useState, useCallback } from "react";
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    ScrollView,
    TouchableOpacity,
    Image,
    RefreshControl,
    Dimensions,
    ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useInfiniteQuery, useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api, endpoints } from "../../src/lib/api";
import { Colors } from "../../src/constants/theme";
import PageLoadingOverlay from "../../src/components/PageLoadingOverlay";
import { resolveImageUrl } from "../../src/lib/imageUrl";
import AppHeaderWithModals from "../../src/components/AppHeaderWithModals";
import { useThemeColors } from "../../src/hooks/useThemeColors";
import { useLocale } from "../../src/lib/useLocale";
import type { Course, UserProfile } from "../../src/types/api";

const SCREEN_W = Dimensions.get('window').width;

// ─── 카테고리 아이콘 (CloudFront) ─────────────────────────────────────────────

const CDN = "https://d13xx6k6chk2in.cloudfront.net/concept-Icon";

// 컨셉 값(서버 필터용) → translation.json key 매핑
const CONCEPT_ITEMS: { value: string; tKey: string; icon: string }[] = [
    { value: "이색데이트", tKey: "courseConcept.unique",       icon: `${CDN}/UNIQUE.png` },
    { value: "감성데이트", tKey: "courseConcept.emotionalDate", icon: `${CDN}/EMOTIONAL.png` },
    { value: "야경",       tKey: "courseConcept.nightView",    icon: `${CDN}/NIGHT_VIEW.png` },
    { value: "힐링",       tKey: "courseConcept.healing",      icon: `${CDN}/HEALING.png` },
    { value: "가성비",     tKey: "courseConcept.cost",         icon: `${CDN}/COST_EFFECTIVE.png` },
    { value: "인생샷",     tKey: "courseConcept.photoSpot",    icon: `${CDN}/PHOTO.png` },
    { value: "맛집탐방",   tKey: "courseConcept.foodTour",     icon: `${CDN}/FOOD_TOUR.png` },
    { value: "카페투어",   tKey: "courseConcept.cafeTour",     icon: `${CDN}/CAFE.png` },
    { value: "술자리",     tKey: "courseConcept.drinking",     icon: `${CDN}/DRINKING.png` },
    { value: "실내데이트", tKey: "courseConcept.indoorDate",   icon: `${CDN}/INDOOR.png` },
    { value: "공연·전시",  tKey: "courseConcept.exhibition",   icon: `${CDN}/EXHIBITION.png` },
];

const GRADE_META: Record<string, { bg: string; text: string }> = {
    FREE: { bg: "#dcfce7", text: "#16a34a" },
    BASIC: { bg: "#dbeafe", text: "#1d4ed8" },
    PREMIUM: { bg: "#fef3c7", text: "#d97706" },
};

// ─── 히어로 슬라이더 ──────────────────────────────────────────────────────────

function HeroSlider({ courses }: { courses: Course[] }) {
    const [activeIdx, setActiveIdx] = useState(0);
    // 양옆 카드가 살짝 보이도록 폭을 줄임
    const HORIZONTAL_GUTTER = 20;
    const SLIDE_GAP = 12;
    const SLIDE_W = SCREEN_W - HORIZONTAL_GUTTER * 2 - 22;

    if (courses.length === 0) return null;

    return (
        <View style={heroStyles.wrap}>
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                decelerationRate="fast"
                snapToInterval={SLIDE_W + SLIDE_GAP}
                snapToAlignment="start"
                contentContainerStyle={{ paddingHorizontal: HORIZONTAL_GUTTER, gap: SLIDE_GAP }}
                onMomentumScrollEnd={(e) => {
                    const idx = Math.round(e.nativeEvent.contentOffset.x / (SLIDE_W + SLIDE_GAP));
                    setActiveIdx(Math.min(idx, courses.length - 1));
                }}
            >
                {courses.map((c) => (
                    <TouchableOpacity
                        key={c.id}
                        style={[heroStyles.slide, { width: SLIDE_W }]}
                        onPress={() => router.push(`/courses/${c.id}` as any)}
                        activeOpacity={0.92}
                    >
                        {c.imageUrl ? (
                            <Image source={{ uri: resolveImageUrl(c.imageUrl) }} style={heroStyles.img} />
                        ) : (
                            <View style={[heroStyles.img, { backgroundColor: "#d1fae5" }]} />
                        )}
                        <View style={heroStyles.gradient}>
                            {c.concept && (
                                <View style={heroStyles.conceptChip}>
                                    <Text style={heroStyles.conceptText}>#{c.concept}</Text>
                                </View>
                            )}
                            <Text style={heroStyles.title} numberOfLines={2}>{c.title}</Text>
                            <View style={heroStyles.metaRow}>
                                {(c.location || c.region) && (
                                    <Text style={heroStyles.meta}>📍 {(c as any).location ?? c.region}</Text>
                                )}
                                {c.duration && <Text style={heroStyles.meta}>⏳ {c.duration}</Text>}
                            </View>
                        </View>
                    </TouchableOpacity>
                ))}
            </ScrollView>
            <View style={heroStyles.dots}>
                {courses.map((_, i) => (
                    <View key={i} style={[heroStyles.dot, i === activeIdx && heroStyles.dotActive]} />
                ))}
            </View>
        </View>
    );
}

const heroStyles = StyleSheet.create({
    wrap: { marginBottom: 12 },
    slide: {
        height: 400,
        borderRadius: 24,
        overflow: "hidden",
        position: "relative",
        // 그림자로 일반 카드와 입체감 차별화
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.22,
        shadowRadius: 14,
        elevation: 10,
    },
    img: { width: "100%", height: "100%", resizeMode: "cover" },
    gradient: {
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        paddingHorizontal: 16,
        paddingVertical: 16,
        // 살짝 연한 오버레이
        backgroundColor: "rgba(0,0,0,0.5)",
    },
    conceptChip: {
        alignSelf: "flex-start",
        backgroundColor: Colors.brandGreen,
        borderRadius: 8,
        paddingHorizontal: 10,
        paddingVertical: 4,
        marginBottom: 8,
    },
    conceptText: { color: "#fff", fontSize: 11, fontWeight: "800" },
    title: { color: "#fff", fontSize: 18, fontWeight: "800", marginBottom: 6, letterSpacing: -0.4, lineHeight: 24 },
    metaRow: { flexDirection: "row", gap: 10 },
    meta: { color: "rgba(255,255,255,0.9)", fontSize: 12, fontWeight: "500" },
    dots: { flexDirection: "row", justifyContent: "center", gap: 6, marginTop: 12 },
    dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "rgba(0,0,0,0.15)" },
    dotActive: { backgroundColor: Colors.brandGreen, width: 20 },
});

// ─── 코스 카드 (웹 CourseCard와 동일) ─────────────────────────────────────────

function formatViewCount(views: number): string {
    if (views >= 10000) return `${(views / 10000).toFixed(views % 10000 ? 1 : 0)}만`;
    if (views >= 1000) return `${(views / 1000).toFixed(views % 1000 ? 1 : 0)}천`;
    return `${views}`;
}

function CourseCard({
    course,
    isFav,
    onFavToggle,
}: {
    course: Course;
    isFav: boolean;
    onFavToggle: (id: number) => void;
}) {
    const t = useThemeColors();
    const isNew = (course as any).reviewCount === 0;
    const placesCount = (course as any).placesCount ?? (course as any).coursePlaces?.length ?? 0;
    const views = Number((course as any).viewCount ?? 0);
    const reviewCount = Number((course as any).reviewCount ?? 0);
    const rating = Number((course as any).rating ?? 0);
    const hasReservation = !!((course as any).coursePlaces?.some((cp: any) => cp?.place?.reservationUrl));

    // 웹과 동일: 조회수 1000+ 이면 👀, 아니면 별점
    const infoLine = views >= 1000
        ? `👀 ${formatViewCount(views)}명이 보는 중`
        : (reviewCount > 0 ? `★ ${rating.toFixed(1)} (${reviewCount})` : null);

    return (
        <TouchableOpacity
            style={styles.card}
            onPress={() => router.push(`/courses/${course.id}` as any)}
            activeOpacity={0.88}
        >
            {/* 이미지 영역 */}
            <View style={[styles.cardImgWrap, { borderColor: t.isDark ? 'transparent' : '#f3f4f6' }]}>
                {course.imageUrl ? (
                    <Image source={{ uri: resolveImageUrl(course.imageUrl) }} style={styles.cardImg} />
                ) : (
                    <View
                        style={[
                            styles.cardImg,
                            { backgroundColor: "#e5e7eb", alignItems: "center", justifyContent: "center" },
                        ]}
                    >
                        <Text style={{ color: "#9ca3af", fontSize: 12 }}>DoNa</Text>
                    </View>
                )}

                {/* 그라데이션 오버레이 */}
                <View style={styles.imgGradient} pointerEvents="none" />

                {/* 배지 (상단 좌측) — 웹과 동일 순서 */}
                <View style={styles.badges} pointerEvents="none">
                    {hasReservation && (
                        <View style={styles.reserveBadge}>
                            <Text style={styles.reserveBadgeText}>예약가능</Text>
                        </View>
                    )}
                    {course.concept && (
                        <View style={styles.conceptBadge}>
                            <Text style={styles.conceptBadgeText}>#{course.concept}</Text>
                        </View>
                    )}
                    {isNew && (
                        <View style={styles.newBadge}>
                            <Text style={styles.newBadgeText}>NEW</Text>
                        </View>
                    )}
                </View>

                {/* 찜 버튼 (상단 우측) — 웹과 동일한 dark circle */}
                <TouchableOpacity
                    style={styles.favBtn}
                    onPress={() => onFavToggle(course.id)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                    <Ionicons
                        name={isFav ? "heart" : "heart-outline"}
                        size={22}
                        color={isFav ? "#ef4444" : "#ffffff"}
                    />
                </TouchableOpacity>
            </View>

            {/* 정보 영역 */}
            <View style={styles.cardBody}>
                <Text style={[styles.cardTitle, { color: t.text }]} numberOfLines={2}>
                    {course.title}
                </Text>
                <View style={styles.metaRow}>
                    {(course.location || (course as any).region) && (
                        <Text style={[styles.metaText, { color: t.textMuted }]}>📍 {(course as any).location ?? (course as any).region}</Text>
                    )}
                    {((course as any).location || (course as any).region) && placesCount > 0 && <View style={[styles.metaDot, { backgroundColor: t.textMuted }]} />}
                    {placesCount > 0 && <Text style={[styles.metaText, { color: t.textMuted }]}>👣 {placesCount} 스팟</Text>}
                    {placesCount > 0 && course.duration && <View style={[styles.metaDot, { backgroundColor: t.textMuted }]} />}
                    {course.duration && <Text style={[styles.metaText, { color: t.textMuted }]}>⏳ {course.duration}</Text>}
                </View>
                {infoLine && (
                    <Text style={[styles.infoLine, { color: t.textMuted }]} numberOfLines={1}>
                        {infoLine}
                    </Text>
                )}
            </View>
        </TouchableOpacity>
    );
}

// ─── 메인 화면 ────────────────────────────────────────────────────────────────

export default function CoursesScreen() {
    const t = useThemeColors();
    const { t: translate } = useLocale();
    const [activeConcept, setActiveConcept] = useState("");

    // 번역된 컨셉 라벨 목록
    const CONCEPTS = CONCEPT_ITEMS.map((c) => ({ ...c, label: translate(c.tKey) }));
    const queryClient = useQueryClient();

    const { data: profile } = useQuery<UserProfile>({
        queryKey: ["profile"],
        queryFn: () => api.get<UserProfile>(endpoints.profile),
        retry: false,
    });

    // 히어로 슬라이더용 인기 코스
    const { data: heroData } = useQuery<Course[]>({
        queryKey: ["courses-hero"],
        queryFn: async () => {
            const r = await api.get<Course[] | { data?: Course[]; courses?: Course[] }>("/api/courses?limit=5");
            if (Array.isArray(r)) return r;
            return (r as any)?.data ?? (r as any)?.courses ?? [];
        },
        staleTime: 5 * 60 * 1000,
    });

    // 찜 목록
    const { data: favList } = useQuery<any[]>({
        queryKey: ["favorites"],
        queryFn: () => api.get<any[]>(endpoints.favorites),
        retry: false,
    });

    const favIds = React.useMemo(() => {
        if (!favList) return new Set<number>();
        return new Set<number>(favList.map((f: any) => Number(f?.course?.id ?? f?.course_id ?? f?.courseId ?? f?.id)));
    }, [favList]);

    const favMutation = useMutation({
        mutationFn: async ({ id, isFav }: { id: number; isFav: boolean }) => {
            if (isFav) {
                await api.delete(`${endpoints.favorites}?courseId=${id}`);
            } else {
                await api.post(endpoints.favorites, { courseId: id });
            }
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ["favorites"] }),
    });

    // 코스 목록 (무한 스크롤)
    const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, refetch, isRefetching } = useInfiniteQuery<
        Course[]
    >({
        queryKey: ["courses-list", activeConcept],
        queryFn: async ({ pageParam = 0 }) => {
            const params = new URLSearchParams();
            params.set("limit", "20");
            params.set("offset", String(pageParam as number));
            if (activeConcept) params.set("concept", activeConcept);
            const r = await api.get<Course[] | { data?: Course[]; courses?: Course[] }>(
                `/api/courses?${params.toString()}`,
            );
            if (Array.isArray(r)) return r;
            return (r as any)?.data ?? (r as any)?.courses ?? [];
        },
        initialPageParam: 0,
        getNextPageParam: (lastPage, allPages) => {
            if (!lastPage || lastPage.length < 20) return undefined;
            return allPages.reduce((s, p) => s + p.length, 0);
        },
    });

    const courses = data?.pages.flat() ?? [];

    const toggleConcept = useCallback((val: string) => {
        setActiveConcept((prev) => (prev === val ? "" : val));
    }, []);

    const handleFavToggle = useCallback(
        (courseId: number) => {
            favMutation.mutate({ id: courseId, isFav: favIds.has(courseId) });
        },
        [favMutation, favIds],
    );

    const renderHeader = useCallback(
        () => (
            <>
                {/* 히어로 슬라이더 */}
                {heroData && heroData.length > 0 && !activeConcept && (
                    <View
                        style={[
                            styles.heroSection,
                            { backgroundColor: t.isDark ? "rgba(18,35,27,0.95)" : "#f3faf6" },
                        ]}
                    >
                        <Text style={[styles.sectionTitle, { color: t.text }]}>지금 많이 선택한 코스</Text>
                        <HeroSlider courses={heroData} />
                    </View>
                )}
                {/* 전체 코스 타이틀 */}
                <View
                    style={[
                        styles.listHeader,
                        { backgroundColor: t.isDark ? "rgba(13,23,18,0.98)" : "#ffffff", borderTopColor: t.border },
                    ]}
                >
                    <Text style={[styles.listHeaderTitle, { color: t.text }]}>{activeConcept ? activeConcept : translate("courses.allCourses")}</Text>
                    <Text style={[styles.listHeaderCount, { color: t.textMuted }]}>{courses.length}개</Text>
                </View>
            </>
        ),
        [heroData, activeConcept, courses.length, t],
    );

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: t.bg }]} edges={["top"]}>
            {/* 헤더 */}
            <AppHeaderWithModals />

            {/* 카테고리 필터 — 원형 아이콘 (웹과 동일) */}
            <View style={[styles.categoryBar, { backgroundColor: t.card, borderBottomColor: t.border }]}>
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.categoryRow}
                >
                    {/* 전체 버튼 */}
                    <TouchableOpacity style={styles.categoryItem} onPress={() => setActiveConcept("")}>
                        <View style={[styles.categoryCircle, { borderColor: t.border, backgroundColor: t.surface }, !activeConcept && styles.categoryCircleActive]}>
                            <Ionicons name="grid" size={18} color={!activeConcept ? "#059669" : t.textMuted} />
                        </View>
                        <Text style={[styles.categoryLabel, { color: t.textMuted }, !activeConcept && styles.categoryLabelActive]}>전체</Text>
                    </TouchableOpacity>

                    {CONCEPTS.map((c) => {
                        const isActive = activeConcept === c.value;
                        return (
                            <TouchableOpacity
                                key={c.value}
                                style={styles.categoryItem}
                                onPress={() => toggleConcept(c.value)}
                            >
                                <View style={[styles.categoryCircle, { borderColor: t.border, backgroundColor: t.surface }, isActive && styles.categoryCircleActive]}>
                                    <Image source={{ uri: c.icon }} style={styles.categoryIcon} resizeMode="contain" />
                                </View>
                                <Text
                                    style={[styles.categoryLabel, { color: t.textMuted }, isActive && styles.categoryLabelActive]}
                                    numberOfLines={1}
                                >
                                    {c.label}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </ScrollView>
            </View>

            {isLoading ? (
                <PageLoadingOverlay overlay={false} />
            ) : (
                <FlatList
                    data={courses}
                    keyExtractor={(item) => String(item.id)}
                    renderItem={({ item }) => (
                        <CourseCard course={item} isFav={favIds.has(item.id)} onFavToggle={handleFavToggle} />
                    )}
                    ListHeaderComponent={renderHeader}
                    contentContainerStyle={[styles.listContent, { backgroundColor: t.card }]}
                    onEndReached={() => {
                        if (hasNextPage) fetchNextPage();
                    }}
                    onEndReachedThreshold={0.4}
                    ListFooterComponent={
                        isFetchingNextPage ? (
                            <View style={styles.footerLoader}>
                                <ActivityIndicator color={Colors.brandGreen} />
                            </View>
                        ) : null
                    }
                    refreshControl={
                        <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.brandGreen} />
                    }
                    ListEmptyComponent={
                        <View style={styles.empty}>
                            <Text style={{ fontSize: 40, marginBottom: 12 }}>🏝️</Text>
                            <Text style={[styles.emptyText, { color: t.textMuted }]}>코스가 없습니다</Text>
                        </View>
                    }
                />
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#F8F9FA" },
    containerDark: { backgroundColor: "#0f1710" },

    // ─── 카테고리 ────────────────────────────────────────────────────────────────
    categoryBar: {
        backgroundColor: "#fff",
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: "#e5e7eb",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 2,
        elevation: 2,
    },
    categoryRow: {
        flexDirection: "row",
        paddingHorizontal: 16,
        paddingVertical: 12,
        gap: 16,
    },
    categoryItem: {
        alignItems: "center",
        gap: 4,
        minWidth: 52,
    },
    categoryCircle: {
        width: 44,
        height: 44,
        borderRadius: 22,
        borderWidth: 2,
        borderColor: "#e5e7eb",
        backgroundColor: "#f9fafb",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
    },
    categoryCircleActive: {
        borderColor: "#059669",
        backgroundColor: "rgba(5, 150, 105, 0.08)",
    },
    categoryIcon: { width: 32, height: 32 },
    categoryLabel: {
        fontSize: 11,
        fontWeight: "600",
        color: "#6b7280",
        textAlign: "center",
    },
    categoryLabelActive: { color: "#059669" },

    // ─── 섹션 ────────────────────────────────────────────────────────────────────
    heroSection: {
        paddingTop: 16,
        paddingBottom: 4,
        backgroundColor: "#fff",
    },
    sectionTitle: {
        fontSize: 19,
        fontWeight: "800",
        color: "#111827",
        paddingHorizontal: 16,
        paddingBottom: 10,
        marginBottom: 12,
        letterSpacing: -0.4,
    },
    listHeader: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 16,
        paddingTop: 16,
        paddingBottom: 8,
        backgroundColor: "#fff",
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: "#e5e7eb",
    },
    listHeaderTitle: { fontSize: 19, fontWeight: "800", color: "#111827", letterSpacing: -0.4, paddingBottom: 10 },
    listHeaderCount: { fontSize: 13, color: "#9ca3af", fontWeight: "500" },
    listContent: { paddingBottom: 130, backgroundColor: "#fff" },

    // ─── 카드 ────────────────────────────────────────────────────────────────────
    card: {
        marginHorizontal: 16,
        marginBottom: 24,
    },
    cardImgWrap: {
        position: "relative",
        aspectRatio: 4 / 3,
        borderRadius: 20,
        overflow: "hidden",
        backgroundColor: "#e5e7eb",
        marginBottom: 10,
    },
    cardImg: {
        width: "100%",
        height: "100%",
        resizeMode: "cover",
    },
    imgGradient: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: "rgba(0,0,0,0.08)",
    },
    badges: {
        position: "absolute",
        top: 12,
        left: 12,
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 4,
    },
    reserveBadge: {
        backgroundColor: "#059669",
        borderRadius: 6,
        paddingHorizontal: 7,
        paddingVertical: 3,
    },
    reserveBadgeText: { color: "#fff", fontSize: 10, fontWeight: "700" },
    infoLine: { fontSize: 12, marginTop: 2 },
    conceptBadge: {
        backgroundColor: "#111827",
        borderRadius: 6,
        paddingHorizontal: 7,
        paddingVertical: 3,
        borderWidth: 1,
        borderColor: "#374151",
    },
    conceptBadgeText: { color: "#fff", fontSize: 10, fontWeight: "700" },
    newBadge: {
        backgroundColor: "#7aa06f",
        borderRadius: 6,
        paddingHorizontal: 7,
        paddingVertical: 3,
    },
    newBadgeText: { color: "#fff", fontSize: 10, fontWeight: "700" },
    favBtn: {
        position: "absolute",
        top: 12,
        right: 12,
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: "#111827",
        borderWidth: 1,
        borderColor: "#374151",
        alignItems: "center",
        justifyContent: "center",
    },
    cardBody: { paddingHorizontal: 4 },
    cardTitle: {
        fontSize: 17,
        fontWeight: "700",
        color: "#111827",
        lineHeight: 24,
        marginBottom: 6,
        letterSpacing: -0.3,
    },
    metaRow: {
        flexDirection: "row",
        alignItems: "center",
        flexWrap: "wrap",
        gap: 4,
    },
    metaText: { fontSize: 12, color: "#6b7280", fontWeight: "500" },
    metaDot: {
        width: 3,
        height: 3,
        borderRadius: 1.5,
        backgroundColor: "#9ca3af",
    },

    // ─── 기타 ────────────────────────────────────────────────────────────────────
    center: { flex: 1, alignItems: "center", justifyContent: "center" },
    footerLoader: { paddingVertical: 20, alignItems: "center" },
    empty: { paddingTop: 80, alignItems: "center" },
    emptyText: { color: "#9ca3af", fontSize: 15 },
});
