import React, { useState, useCallback, useMemo, useRef, useEffect } from "react";
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    ScrollView,
    TouchableOpacity,
    RefreshControl,
    Dimensions,
    ActivityIndicator,
} from "react-native";
import { Image } from "expo-image";
import { SafeAreaView } from "react-native-safe-area-context";
import { useInfiniteQuery, useQuery, useMutation, useQueryClient, type InfiniteData } from "@tanstack/react-query";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api, endpoints } from "../../src/lib/api";
import { Colors } from "../../src/constants/theme";
import PageLoadingOverlay from "../../src/components/PageLoadingOverlay";
import { resolveResizedImageUrl } from "../../src/lib/imageUrl";
import AppHeaderWithModals from "../../src/components/AppHeaderWithModals";
import { useThemeColors } from "../../src/hooks/useThemeColors";
import { useLocale } from "../../src/lib/useLocale";
import { useAuth } from "../../src/hooks/useAuth";
import { useModalActions } from "../../src/lib/modalContext";
import type { LocalePreference } from "../../src/lib/appSettingsStorage";
import type { Course } from "../../src/types/api";
import { pickCourseTitle } from "../../src/lib/courseLocalized";
import CourseCard from "../../src/components/CourseCard";
import {
    translateCourseRegion,
    translateCourseConcept,
    translateDuration,
    type CourseUiLocale,
} from "../../../src/lib/courseTranslate";

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
    { value: "기념일",     tKey: "courseConcept.anniversary",  icon: `${CDN}/ANNIVERSARY.png` },
];

const GRADE_META: Record<string, { bg: string; text: string }> = {
    FREE: { bg: "#dcfce7", text: "#16a34a" },
    BASIC: { bg: "#dbeafe", text: "#1d4ed8" },
    PREMIUM: { bg: "#fef3c7", text: "#d97706" },
};


// ─── 코스 개수 라벨 ──────────────────────────────────────────────────────────
// 헤더(HeroSlider 포함)가 페이지 추가마다 리마운트되지 않도록, 개수 표시만 캐시를
// 자체 구독하는 독립 컴포넌트로 분리한다. enabled:false 로 자체 페치는 하지 않고
// 부모 useInfiniteQuery 가 채운 ["courses-list", activeConcept] 캐시만 구독한다.
const ListCountLabel = React.memo(function ListCountLabel({
    activeConcept,
    style,
    translate,
}: {
    activeConcept: string;
    style: any;
    translate: (k: string, o?: any) => string;
}) {
    const { data } = useInfiniteQuery<Course[]>({
        queryKey: ["courses-list", activeConcept],
        queryFn: async () => [],
        initialPageParam: 0,
        getNextPageParam: () => undefined,
        enabled: false,
    });
    const count = data?.pages.reduce((s, p) => s + (p?.length ?? 0), 0) ?? 0;
    return (
        <Text style={style} numberOfLines={1}>
            {translate("courses.listCount", { count })}
        </Text>
    );
});

// ─── 히어로 슬라이더 ──────────────────────────────────────────────────────────

const HeroSlider = React.memo(function HeroSlider({
    courses,
    locale,
    lt,
    onLockedPress,
    onLoginRequired,
}: {
    courses: Course[];
    locale: LocalePreference;
    lt: (key: string, params?: Record<string, string | number>) => string;
    onLockedPress: (course: Course) => void;
    onLoginRequired: () => void;
}) {
    const { isAuthenticated } = useAuth();
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
                        onPress={() => {
                            if (c.isLocked) {
                                if (!isAuthenticated) { onLoginRequired(); return; }
                                onLockedPress(c);
                            } else {
                                router.push(`/courses/${c.id}` as any);
                            }
                        }}
                        activeOpacity={0.92}
                    >
                        {c.imageUrl ? (
                            <Image source={{ uri: resolveResizedImageUrl(c.imageUrl, 1080) }} style={heroStyles.img} fadeDuration={0} blurRadius={c.isLocked ? 3 : 0} />
                        ) : (
                            <View style={[heroStyles.img, { backgroundColor: "#d1fae5" }]} />
                        )}
                        <View style={heroStyles.gradient}>
                            {c.concept && (
                                <View style={heroStyles.conceptChip}>
                                    <Text style={heroStyles.conceptText}>
                                        #{translateCourseConcept(c.concept, lt)}
                                    </Text>
                                </View>
                            )}
                            <Text style={heroStyles.title} numberOfLines={2}>
                                {pickCourseTitle(c, locale) || c.title}
                            </Text>
                            <View style={heroStyles.metaRow}>
                                {(c.location || c.region) && (
                                    <Text style={heroStyles.meta}>
                                        📍{" "}
                                        {translateCourseRegion(String((c as any).location ?? c.region ?? ""), lt)}
                                    </Text>
                                )}
                                {c.duration && (
                                    <Text style={heroStyles.meta}>
                                        ⏳{" "}
                                        {translateDuration(c.duration, locale as CourseUiLocale)}
                                    </Text>
                                )}
                            </View>
                        </View>
                        {c.isLocked && (
                            <View style={heroStyles.lockOverlay}>
                                <View style={heroStyles.lockIconWrap}>
                                    <Ionicons name="lock-closed" size={32} color="#fff" />
                                </View>
                                <View style={heroStyles.lockBadge}>
                                    <Text style={heroStyles.lockBadgeText}>
                                        {lt("courseLockOverlay.gradeOnly", { grade: c.grade === "PREMIUM" ? lt("courseLockOverlay.premium") : lt("courseLockOverlay.basic") })}
                                    </Text>
                                </View>
                            </View>
                        )}
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
});

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
    conceptText: { color: "#fff", fontSize: 11, fontWeight: "500" },
    title: { color: "#fff", fontSize: 18, fontWeight: "500", marginBottom: 6, letterSpacing: 0, lineHeight: 24 },
    metaRow: { flexDirection: "row", gap: 10 },
    meta: { color: "rgba(255,255,255,0.9)", fontSize: 12, fontWeight: "500" },
    dots: { flexDirection: "row", justifyContent: "center", gap: 6, marginTop: 12 },
    dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "rgba(0,0,0,0.15)" },
    dotActive: { backgroundColor: Colors.brandGreen, width: 20 },
    lockOverlay: {
        position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: "rgba(0,0,0,0.45)",
        alignItems: "center", justifyContent: "center", zIndex: 10,
    },
    lockIconWrap: {
        backgroundColor: "rgba(255,255,255,0.2)",
        borderRadius: 40, padding: 14, marginBottom: 10,
    },
    lockBadge: {
        backgroundColor: "rgba(0,0,0,0.6)",
        borderRadius: 20, paddingHorizontal: 16, paddingVertical: 6,
        borderWidth: 1, borderColor: "rgba(255,255,255,0.2)",
    },
    lockBadgeText: { color: "#fff", fontSize: 13, fontWeight: "700", letterSpacing: -0.3 },
});


// ─── 메인 화면 ────────────────────────────────────────────────────────────────

export default function CoursesScreen() {
    const t = useThemeColors();
    const { t: translate, locale: appLocale } = useLocale();
    const { openModal } = useModalActions();
    const [activeConcept, setActiveConcept] = useState("");

    const CONCEPTS = useMemo(
        () => CONCEPT_ITEMS.map((c) => ({ ...c, label: translate(c.tKey) })),
        [translate],
    );
    const queryClient = useQueryClient();

    // 찜 목록 (비로그인은 401만 나므로 호출 안 함)
    const { isAuthenticated } = useAuth();
    const { data: favList } = useQuery<any[]>({
        queryKey: ["favorites"],
        queryFn: () => api.get<any[]>(endpoints.favorites),
        enabled: isAuthenticated,
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

    const courses = useMemo(() => data?.pages.flat() ?? [], [data?.pages]);

    // 히어로: 별도 API 호출 없이 전체 목록 첫 페이지(20개)에서 뽑음. 필터 중엔 히어로를 안 보여줌
    const heroRaw = activeConcept ? undefined : data?.pages[0];
    // 순서: 1=FREE, 2=BASIC, 3=BASIC, 4=PREMIUM, 5=FREE
    const heroData = React.useMemo(() => {
        if (!heroRaw || heroRaw.length === 0) return [];
        const free = heroRaw.filter((c) => c.grade === "FREE");
        const basic = heroRaw.filter((c) => c.grade === "BASIC");
        const premium = heroRaw.filter((c) => c.grade === "PREMIUM");
        const result: Course[] = [];
        if (free[0]) result.push(free[0]);
        if (basic[0]) result.push(basic[0]);
        if (basic[1] ?? basic[0]) result.push(basic[1] ?? basic[0]);
        if (premium[0]) result.push(premium[0]);
        if (free[1] ?? free[0]) result.push(free[1] ?? free[0]);
        return result;
    }, [heroRaw]);

    const favIdsRef = useRef(favIds);
    useEffect(() => { favIdsRef.current = favIds; }, [favIds]);

    const toggleConcept = useCallback((val: string) => {
        setActiveConcept((prev) => (prev === val ? "" : val));
    }, []);

    const handleFavToggle = useCallback(
        (courseId: number) => {
            favMutation.mutate({ id: courseId, isFav: favIdsRef.current.has(courseId) });
        },
        [favMutation],
    );

    const renderCourseItem = useCallback(
        ({ item }: { item: Course }) => (
            <CourseCard course={item as any} isFav={favIds.has(item.id)} onFavToggle={handleFavToggle} />
        ),
        [favIds, handleFavToggle],
    );

    const listHeaderTitleText = activeConcept
        ? CONCEPTS.find((c) => c.value === activeConcept)?.label ?? translate("courses.allCourses")
        : translate("courses.allCourses");

    const renderHeader = useCallback(
        () => (
            <>
                {heroData && heroData.length > 0 && !activeConcept && (
                    <View
                        style={[
                            styles.heroSection,
                            { backgroundColor: t.isDark ? "rgba(18,35,27,0.95)" : "#f3faf6" },
                        ]}
                    >
                        <Text style={[styles.sectionTitle, { color: t.text }]}>{translate("courses.heroTitle")}</Text>
                        <HeroSlider
                            courses={heroData}
                            locale={appLocale}
                            lt={translate}
                            onLockedPress={(c) => openModal("ticket", {
                                courseId: c.id,
                                courseGrade: c.grade === "PREMIUM" ? "PREMIUM" : "BASIC",
                                onUnlocked: () => queryClient.setQueryData<InfiniteData<Course[]>>(["courses-list", ""], (old) =>
                                    old && { ...old, pages: old.pages.map((page) => page.map((item) => (item.id === c.id ? { ...item, isLocked: false } : item))) }
                                ),
                            })}
                            onLoginRequired={() => openModal("login")}
                        />
                    </View>
                )}
                <View
                    style={[
                        styles.listHeader,
                        { backgroundColor: t.isDark ? "rgba(13,23,18,0.98)" : "#ffffff", borderTopColor: t.border },
                    ]}
                >
                    <Text style={[styles.listHeaderTitle, { color: t.text }]} numberOfLines={2}>
                        {listHeaderTitleText}
                    </Text>
                    <ListCountLabel
                        activeConcept={activeConcept}
                        style={[styles.listHeaderCount, { color: t.textMuted }]}
                        translate={translate}
                    />
                </View>
            </>
        ),
        // courses.length 는 의존성에서 제외 — 페이지 추가마다 renderHeader 가 재생성되면
        // ListHeaderComponent 가 리마운트되어 HeroSlider 가 다시 마운트되고 스크롤이 튄다.
        // 개수는 ListCountLabel 이 캐시를 자체 구독해 갱신한다.
        [heroData, activeConcept, t, translate, listHeaderTitleText, appLocale, openModal],
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
                        <Text style={[styles.categoryLabel, { color: t.textMuted }, !activeConcept && styles.categoryLabelActive]}>
                            {translate("courses.all")}
                        </Text>
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
                                    {c.icon ? (
                                        <Image source={{ uri: c.icon }} style={styles.categoryIcon} contentFit="contain" />
                                    ) : (
                                        <Text style={{ fontSize: 15, fontWeight: "700", color: t.textMuted }}>{c.label.slice(0, 1)}</Text>
                                    )}
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
                    renderItem={renderCourseItem}
                    ListHeaderComponent={renderHeader}
                    contentContainerStyle={[styles.listContent, { backgroundColor: t.card }]}
                    onEndReached={() => {
                        // 이미 로딩 중이면 중복 호출 방지 (풋터 로더 깜빡임·높이 변동 유발)
                        if (hasNextPage && !isFetchingNextPage) fetchNextPage();
                    }}
                    onEndReachedThreshold={0.4}
                    // 카드 높이가 가변(제목 1~2줄·infoLine 유무)이라 removeClippedSubviews 를 켜면
                    // 안드로이드에서 화면 밖 카드를 detach/attach 할 때 높이 계산이 어긋나 스크롤이 튄다.
                    // 다음 페이지가 붙을 때 "왔다갔다"하던 원인 → 끈다.
                    removeClippedSubviews={false}
                    // 새 페이지가 붙어도 현재 보고 있는 위치를 유지 (스크롤 점프 방지)
                    maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
                    maxToRenderPerBatch={6}
                    windowSize={7}
                    initialNumToRender={6}
                    scrollEventThrottle={16}
                    decelerationRate="fast"
                    overScrollMode="never"
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
                            <Text style={[styles.emptyText, { color: t.textMuted }]}>{translate("courses.listEmpty")}</Text>
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
        fontWeight: "500",
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
        fontWeight: "500",
        color: "#111827",
        paddingHorizontal: 16,
        paddingBottom: 10,
        marginBottom: 12,
        letterSpacing: 0,
    },
    listHeader: {
        flexDirection: "row",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: 12,
        paddingHorizontal: 16,
        paddingTop: 16,
        paddingBottom: 8,
        backgroundColor: "#fff",
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: "#e5e7eb",
    },
    listHeaderTitle: {
        flex: 1,
        fontSize: 19,
        fontWeight: "500",
        color: "#111827",
        letterSpacing: 0,
        paddingBottom: 10,
    },
    listHeaderCount: { flexShrink: 0, fontSize: 13, color: "#9ca3af", fontWeight: "500", paddingTop: 2 },
    listContent: { paddingBottom: 130, backgroundColor: "#fff" },

    // ─── 카드 ────────────────────────────────────────────────────────────────────
    card: {
        marginHorizontal: 8,
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
    reserveBadgeText: { color: "#fff", fontSize: 10, fontWeight: "500" },
    infoLine: { fontSize: 12, marginTop: 2 },
    conceptBadge: {
        backgroundColor: "#111827",
        borderRadius: 6,
        paddingHorizontal: 7,
        paddingVertical: 3,
        borderWidth: 1,
        borderColor: "#374151",
    },
    conceptBadgeText: { color: "#fff", fontSize: 10, fontWeight: "500" },
    newBadge: {
        backgroundColor: "#7aa06f",
        borderRadius: 6,
        paddingHorizontal: 7,
        paddingVertical: 3,
    },
    newBadgeText: { color: "#fff", fontSize: 10, fontWeight: "500" },
    lockOverlay: {
        position: "absolute",
        inset: 0,
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0,0,0,0.45)",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 10,
    },
    lockIconWrap: {
        backgroundColor: "rgba(255,255,255,0.2)",
        borderRadius: 40,
        padding: 12,
        marginBottom: 8,
    },
    lockBadge: {
        backgroundColor: "rgba(0,0,0,0.6)",
        borderRadius: 20,
        paddingHorizontal: 14,
        paddingVertical: 5,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.2)",
    },
    lockBadgeText: {
        color: "#fff",
        fontSize: 12,
        fontWeight: "700",
        letterSpacing: -0.3,
    },
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
        fontWeight: "400",
        color: "#111827",
        lineHeight: 24,
        marginBottom: 6,
        letterSpacing: 0,
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
