/**
 * 홈 화면
 * 웹 src/app/(home)/HomeClient.tsx + PersonalizedSection.tsx 기반
 *
 * 섹션:
 * 1. 헤더 (로고 + 알림 아이콘)
 * 2. 오늘 진행 중인 코스 배너 (active-course, 로그인 시)
 * 3. 오늘의 선택 (PersonalizedSection — /api/recommendations)
 * 4. AI 맞춤 추천 CTA (로그인 시)
 * 5. 더 보기 Bottom Sheet
 */
import React, { useState, useCallback, useRef, useEffect } from "react";
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Image,
    RefreshControl,
    Animated,
    Modal,
    FlatList,
    Pressable,
    PanResponder,
    Dimensions,
    StatusBar,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";

import { Colors } from "../../src/constants/theme";
import PageLoadingOverlay from "../../src/components/PageLoadingOverlay";
import { api } from "../../src/lib/api";
import { fetchMyPrivateStories } from "../../src/lib/personalStories";
import { useAuth } from "../../src/hooks/useAuth";
import { resolveImageUrl } from "../../src/lib/imageUrl";
import AppHeaderWithModals from "../../src/components/AppHeaderWithModals";
import { useThemeColors } from "../../src/hooks/useThemeColors";
import { useLocale } from "../../src/lib/useLocale";
import type { Course, ActiveCourse } from "../../src/types/api";
import MemoryDetailModal, { type MemoryDetailStory } from "../../src/components/MemoryDetailModal";

// ─── 타입 ─────────────────────────────────────────────────────────────────────

type RecommendationResponse = {
    recommendations: Course[];
    hasOnboardingData?: boolean;
};

type PersonalStory = MemoryDetailStory;

// translation.json 키 매핑 (HOME_I18N 대체)
type HomeI18nText = {
    defaultCourseTitle: string;
    todayDateKicker: string;
    inProgress: string;
    continue: string;
    viewCourse: string;
    moreRecommendedCourses: string;
    aiCtaTitle: string;
    aiCtaSub: string;
    sectionTitle: string;
    sectionLoginHint: string;
    memoryAlbumTitle: string;
    memoryAlbumEmptySub: string;
    memoryAlbumCta: string;
    memoryAlbumViewMore: string;
    loadingRecommendations: string;
    viewMore: string;
};

function buildTx(t: (key: string) => string): HomeI18nText {
    return {
        defaultCourseTitle:     t("courses.noTitle"),
        todayDateKicker:        t("home.activeCourse.todayDate"),
        inProgress:             t("home.activeCourse.inProgress"),
        continue:               t("home.activeCourse.continue"),
        viewCourse:             t("personalized.viewCourse"),
        moreRecommendedCourses: t("personalized.viewMore"),
        aiCtaTitle:             t("home.personalizedHomeCta"),
        aiCtaSub:               t("home.personalizedHomeCtaSub"),
        sectionTitle:           t("personalized.todayPick"),
        sectionLoginHint:       t("personalized.loginHint"),
        memoryAlbumTitle:       t("memory.empty.title"),
        memoryAlbumEmptySub:    t("memory.empty.subtitle"),
        memoryAlbumCta:         t("memory.empty.button"),
        memoryAlbumViewMore:    t("memory.viewAll"),
        loadingRecommendations: t("personalized.loadingToday"),
        viewMore:               t("personalized.viewMore"),
    };
}

// ─── 오늘의 선택 헤더 메시지 ──────────────────────────────────────────────────

function getTodayDayType(): "today" | "weekend" {
    const kst = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
    return kst.getDay() === 0 || kst.getDay() === 6 ? "weekend" : "today";
}

// ─── 활성 코스 배너 ───────────────────────────────────────────────────────────

function ActiveCourseBanner({ course, tx }: { course: ActiveCourse; tx: HomeI18nText }) {
    const t = useThemeColors();
    const imageUri = resolveImageUrl(course.imageUrl);
    const title = course.title ?? course.courseTitle ?? tx.defaultCourseTitle;

    const goCourse = () => router.push(`/courses/${course.courseId}` as any);

    return (
        <View
            style={[
                styles.activeBanner,
                {
                    backgroundColor: t.card,
                    borderColor: t.isDark ? "#374151" : "#e5e7eb",
                },
            ]}
        >
            <View style={styles.activeBannerInner}>
                <TouchableOpacity onPress={goCourse} activeOpacity={0.9} accessibilityRole="imagebutton">
                    <View style={styles.activeBannerImg}>
                        {imageUri ? (
                            <Image source={{ uri: imageUri }} style={styles.activeBannerImgEl} resizeMode="cover" />
                        ) : (
                            <View style={[styles.activeBannerImgEl, styles.activeBannerImgPlaceholder]}>
                                <Text style={{ fontSize: 24 }}>📍</Text>
                            </View>
                        )}
                    </View>
                </TouchableOpacity>
                <View style={[styles.activeBannerText, { minHeight: 84, justifyContent: "space-between" }]}>
                    <View>
                        <Text style={[styles.activeBannerKicker, { color: t.textMuted }]}>{tx.todayDateKicker}</Text>
                        <TouchableOpacity onPress={goCourse} activeOpacity={0.85}>
                            <Text style={[styles.activeBannerTitle, { color: t.text }]} numberOfLines={2}>
                                {title}
                            </Text>
                        </TouchableOpacity>
                    </View>
                    <View style={styles.activeBannerFooterRow}>
                        <Text style={[styles.activeBannerStatus, { color: t.textMuted }]}>{tx.inProgress}</Text>
                        <TouchableOpacity style={styles.activeContinueBtn} onPress={goCourse} activeOpacity={0.88}>
                            <Text style={styles.activeContinueText}>{tx.continue}</Text>
                            <Text style={styles.activeContinueArrow}>→</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </View>
    );
}

// ─── 오늘의 선택 Featured 카드 ────────────────────────────────────────────────

function FeaturedCourseCard({ course, tx }: { course: Course; tx: HomeI18nText }) {
    const t = useThemeColors();
    const imageUri = resolveImageUrl(course.imageUrl ?? course.coursePlaces?.[0]?.place?.imageUrl);
    return (
        <View style={[styles.featuredCard, { backgroundColor: t.card }]}>
            <TouchableOpacity activeOpacity={0.95} onPress={() => router.push(`/courses/${course.id}` as any)}>
                <View style={styles.featuredImgWrap}>
                    {imageUri ? (
                        <Image source={{ uri: imageUri }} style={styles.featuredImg} resizeMode="cover" />
                    ) : (
                        <View style={[styles.featuredImg, styles.featuredImgPlaceholder]}>
                            <Text style={{ fontSize: 48 }}>🗺️</Text>
                        </View>
                    )}
                </View>
            </TouchableOpacity>
            <View style={styles.featuredBody}>
                {course.tags && course.tags.length > 0 && (
                    <View style={styles.featuredChips}>
                        {course.tags.slice(0, 4).map((tag, i) => (
                            <View key={i} style={[styles.featuredChip, { backgroundColor: t.surface }]}>
                                <Text style={[styles.featuredChipText, { color: t.text }]}>#{tag}</Text>
                            </View>
                        ))}
                    </View>
                )}
                <Text style={[styles.featuredTitle, { color: t.text }]} numberOfLines={2}>
                    {course.title}
                </Text>
                {course.region && (
                    <Text style={[styles.featuredRegion, { color: t.textMuted }]}>📍 {course.region}</Text>
                )}
                <TouchableOpacity
                    style={styles.featuredBtn}
                    activeOpacity={0.88}
                    onPress={() => router.push(`/courses/${course.id}` as any)}
                >
                    <Text style={styles.featuredBtnText}>{tx.viewCourse} →</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}

// ─── 더 보기 모달 카드 ────────────────────────────────────────────────────────

function MoreCourseCard({ course, onPress }: { course: Course; onPress: () => void }) {
    const imageUri = resolveImageUrl(course.imageUrl ?? course.coursePlaces?.[0]?.place?.imageUrl);
    const tags = (Array.isArray(course.tags) ? course.tags : []).slice(0, 3);
    return (
        <TouchableOpacity style={styles.moreCard} activeOpacity={0.88} onPress={onPress}>
            <View style={styles.moreCardImgWrap}>
                {imageUri ? (
                    <Image source={{ uri: imageUri }} style={styles.moreCardImg} resizeMode="cover" />
                ) : (
                    <View
                        style={[
                            styles.moreCardImg,
                            { backgroundColor: "#e5e7eb", alignItems: "center", justifyContent: "center" },
                        ]}
                    >
                        <Text style={{ fontSize: 24 }}>🗺️</Text>
                    </View>
                )}
                <View style={styles.moreCardOverlay} />
                <View style={styles.moreCardTextWrap}>
                    <Text style={styles.moreCardTitle} numberOfLines={2}>
                        {course.title}
                    </Text>
                    {course.region && <Text style={styles.moreCardRegion}>{course.region}</Text>}
                    {tags.length > 0 && (
                        <View style={styles.moreCardTagRow}>
                            {tags.map((tag, i) => (
                                <View key={i} style={styles.moreCardTagPill}>
                                    <Text style={styles.moreCardTagText}>#{tag}</Text>
                                </View>
                            ))}
                        </View>
                    )}
                </View>
            </View>
        </TouchableOpacity>
    );
}

// ─── 더 보기 Bottom Sheet ─────────────────────────────────────────────────────

function MoreCoursesSheet({
    visible,
    todayCourses,
    weekendCourses,
    onClose,
}: {
    visible: boolean;
    todayCourses: Course[];
    weekendCourses: Course[];
    onClose: () => void;
}) {
    const t = useThemeColors();
    const [activeTab, setActiveTab] = useState<"today" | "weekend">(getTodayDayType());
    const translateY = useRef(new Animated.Value(0)).current;

    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onMoveShouldSetPanResponder: (_, gs) => gs.dy > 5,
            onPanResponderMove: (_, gs) => {
                if (gs.dy > 0) translateY.setValue(gs.dy);
            },
            onPanResponderRelease: (_, gs) => {
                if (gs.dy > 80) {
                    onClose();
                    translateY.setValue(0);
                } else {
                    Animated.spring(translateY, { toValue: 0, useNativeDriver: true }).start();
                }
            },
        }),
    ).current;

    const displayCourses = activeTab === "today" ? todayCourses : weekendCourses;

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <Pressable style={styles.sheetOverlay} onPress={onClose}>
                <Animated.View style={[styles.sheet, { backgroundColor: t.card, transform: [{ translateY }] }]}>
                    <Pressable onPress={(e) => e.stopPropagation()} style={{ flex: 1 }}>
                        {/* 드래그 핸들 */}
                        <View {...panResponder.panHandlers} style={styles.sheetHandle}>
                            <View
                                style={[styles.sheetHandleBar, { backgroundColor: t.isDark ? "#374151" : "#e5e7eb" }]}
                            />
                        </View>

                        {/* 오늘 / 주말 필터 탭 */}
                        <View style={styles.sheetTabRow}>
                            <TouchableOpacity
                                style={[styles.sheetTab, activeTab === "today" && styles.sheetTabActive]}
                                onPress={() => setActiveTab("today")}
                            >
                                <Text style={[styles.sheetTabText, activeTab === "today" && styles.sheetTabTextActive]}>
                                    오늘
                                </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.sheetTab, activeTab === "weekend" && styles.sheetTabActive]}
                                onPress={() => setActiveTab("weekend")}
                            >
                                <Text
                                    style={[styles.sheetTabText, activeTab === "weekend" && styles.sheetTabTextActive]}
                                >
                                    주말
                                </Text>
                            </TouchableOpacity>
                        </View>

                        {/* 코스 목록 */}
                        <FlatList
                            data={displayCourses}
                            keyExtractor={(item) => String(item.id)}
                            renderItem={({ item }) => (
                                <MoreCourseCard
                                    course={item}
                                    onPress={() => {
                                        onClose();
                                        router.push(`/courses/${item.id}` as any);
                                    }}
                                />
                            )}
                            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40, paddingTop: 4 }}
                            showsVerticalScrollIndicator={false}
                        />
                    </Pressable>
                </Animated.View>
            </Pressable>
        </Modal>
    );
}

// ─── AI CTA 카드 ──────────────────────────────────────────────────────────────

function AiCtaCard({ tx }: { tx: HomeI18nText }) {
    return (
        <TouchableOpacity style={styles.aiCta} activeOpacity={0.88} onPress={() => router.push("/(tabs)/ai")}>
            <View style={styles.aiCtaLeft}>
                <View>
                    <Text style={styles.aiCtaTitle}>{tx.aiCtaTitle}</Text>
                    <Text style={styles.aiCtaSub}>{tx.aiCtaSub}</Text>
                </View>
            </View>
            <Text style={styles.aiCtaArrow}>→</Text>
        </TouchableOpacity>
    );
}

// ─── 메인 화면 ────────────────────────────────────────────────────────────────

export default function HomeScreen() {
    const t = useThemeColors();
    const { user } = useAuth();
    const { t: translate, locale } = useLocale();
    const [showMore, setShowMore] = useState(false);
    const [selectedMemory, setSelectedMemory] = useState<PersonalStory | null>(null);
    const [showMemoryModal, setShowMemoryModal] = useState(false);
    const [currentImageIndex, setCurrentImageIndex] = useState(0);
    const dayType = getTodayDayType();
    const tx = buildTx(translate);

    // 추천 코스 (오늘의 선택)
    const {
        data: recData,
        isLoading: recLoading,
        refetch: refetchRec,
        isRefetching,
    } = useQuery<RecommendationResponse>({
        queryKey: ["recommendations", "home", dayType],
        queryFn: () => api.get<RecommendationResponse>(`/api/recommendations?limit=6&dayType=${dayType}`),
        staleTime: 1000 * 60 * 5,
    });

    // 더보기 시트용 — 반대 dayType 코스 (시트 열릴 때만 fetch)
    const otherDayType = dayType === "today" ? "weekend" : "today";
    const { data: otherRecData } = useQuery<RecommendationResponse>({
        queryKey: ["recommendations", "home", otherDayType],
        queryFn: () => api.get<RecommendationResponse>(`/api/recommendations?limit=6&dayType=${otherDayType}`),
        staleTime: 1000 * 60 * 5,
        enabled: showMore,
    });

    // 활성 코스 (진행 중인 데이트)
    const { data: activeCourse } = useQuery<ActiveCourse | null>({
        queryKey: ["users", "active-course"],
        queryFn: () => api.get<ActiveCourse | null>("/api/users/active-course").catch(() => null),
        enabled: !!user,
        staleTime: 1000 * 60 * 2,
    });

    const { data: stories = [] } = useQuery<PersonalStory[]>({
        queryKey: ["users", "personal-stories"],
        queryFn: () => fetchMyPrivateStories(6),
        enabled: !!user,
        staleTime: 1000 * 60 * 2,
    });

    const recommendations = recData?.recommendations ?? [];
    const featuredCourse = recommendations[0] ?? null;
    const hasMore = recommendations.length >= 2;

    const todayCourses = dayType === "today" ? recommendations : (otherRecData?.recommendations ?? []);
    const weekendCourses = dayType === "weekend" ? recommendations : (otherRecData?.recommendations ?? []);

    const onRefresh = useCallback(() => {
        refetchRec();
    }, [refetchRec]);

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: t.bg }]} edges={["top"]}>
            <AppHeaderWithModals />
            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
                refreshControl={
                    <RefreshControl refreshing={isRefetching} onRefresh={onRefresh} tintColor={Colors.brandGreen} />
                }
            >
                {/* ── 활성 코스 배너 ────────────────────────────────── */}
                {activeCourse && (
                    <View style={styles.section}>
                        <ActiveCourseBanner course={activeCourse} tx={tx} />
                    </View>
                )}

                {/* ── 오늘의 선택 ────────────────────────────────────── */}
                <View style={styles.section}>
                    <View style={styles.sectionHeaderRow}>
                        <Text style={styles.sectionTitleGreen}>{tx.sectionTitle}</Text>
                        {!user && (
                            <Text style={[styles.sectionSub, { color: t.textMuted }]}>{tx.sectionLoginHint}</Text>
                        )}
                    </View>

                    {recLoading ? (
                        <View style={[styles.featuredSkeleton, { backgroundColor: t.surface }]}>
                            <PageLoadingOverlay overlay={false} message={tx.loadingRecommendations} />
                        </View>
                    ) : featuredCourse ? (
                        <>
                            <FeaturedCourseCard course={featuredCourse} tx={tx} />
                            {hasMore && (
                                <TouchableOpacity
                                    style={styles.viewMoreBtn}
                                    onPress={() => setShowMore(true)}
                                    activeOpacity={0.75}
                                >
                                    <Text style={styles.viewMoreText}>{tx.viewMore} →</Text>
                                </TouchableOpacity>
                            )}
                        </>
                    ) : (
                        <View style={[styles.emptyRec, { backgroundColor: t.surface }]}>
                            <Text style={[styles.emptyRecText, { color: t.textMuted }]}>
                                {tx.loadingRecommendations}
                            </Text>
                        </View>
                    )}
                </View>

                {/* ── AI 맞춤 추천 CTA ────────────────────────────────── */}
                <View style={styles.section}>
                    <AiCtaCard tx={tx} />
                </View>

                {/* ── 나만의 데이트 앨범 (로그인 시만) ─────────────────── */}
                {user && (
                    <View style={styles.section}>
                        <View
                            style={[
                                styles.memoryAlbumWrap,
                                {
                                    backgroundColor: t.isDark ? "rgba(17,27,21,0.9)" : "rgba(255,255,255,0.9)",
                                    borderColor: t.isDark ? "#374151" : "#f3f4f6",
                                },
                            ]}
                        >
                            <View style={styles.memoryAlbumHeader}>
                                <Text style={[styles.memoryAlbumTitle, { color: t.text }]}>{tx.memoryAlbumTitle}</Text>
                                {stories.length > 0 && (
                                    <TouchableOpacity
                                        onPress={() =>
                                            router.push(
                                                "/(tabs)/mypage?tab=footprint&footprintView=memories" as any,
                                            )
                                        }
                                        activeOpacity={0.7}
                                    >
                                        <Text style={styles.viewMoreText}>{tx.memoryAlbumViewMore} →</Text>
                                    </TouchableOpacity>
                                )}
                            </View>

                            {stories.length === 0 ? (
                                <View style={styles.memoryAlbumEmptyWrap}>
                                    <Text style={[styles.memoryAlbumEmptySub, { color: t.textMuted }]}>
                                        {tx.memoryAlbumEmptySub}
                                    </Text>
                                    <TouchableOpacity
                                        style={styles.memoryAlbumCtaBtn}
                                        onPress={() =>
                                            router.push(
                                                "/(tabs)/mypage?tab=footprint&footprintView=memories" as any,
                                            )
                                        }
                                        activeOpacity={0.85}
                                    >
                                        <Text style={styles.memoryAlbumCtaText}>{tx.memoryAlbumCta}</Text>
                                    </TouchableOpacity>
                                </View>
                            ) : (
                                <ScrollView
                                    horizontal
                                    showsHorizontalScrollIndicator={false}
                                    contentContainerStyle={styles.memoryAlbumScroll}
                                >
                                    {stories.slice(0, 6).map((story) => {
                                        const img = story.imageUrls?.[0] ? resolveImageUrl(story.imageUrls[0]) : null;
                                        const courseId = story.course?.id;
                                        const topTags = (story.tags ?? []).slice(0, 2);
                                        const dateText = story.createdAt
                                            ? new Date(story.createdAt).toLocaleDateString(
                                                  locale === "ko"
                                                      ? "ko-KR"
                                                      : locale === "ja"
                                                        ? "ja-JP"
                                                        : locale === "zh"
                                                          ? "zh-CN"
                                                          : "en-US",
                                                  { month: "numeric", day: "numeric" },
                                              )
                                            : "";
                                        return (
                                            <TouchableOpacity
                                                key={story.id}
                                                style={[
                                                    styles.memoryAlbumCard,
                                                    {
                                                        backgroundColor: t.card,
                                                        borderColor: t.isDark ? "#374151" : "#f3f4f6",
                                                    },
                                                ]}
                                                onPress={() => {
                                                    setSelectedMemory(story);
                                                    setCurrentImageIndex(0);
                                                    setShowMemoryModal(true);
                                                }}
                                                activeOpacity={0.9}
                                            >
                                                {img ? (
                                                    <Image
                                                        source={{ uri: img }}
                                                        style={styles.memoryAlbumImage}
                                                        resizeMode="cover"
                                                    />
                                                ) : (
                                                    <View
                                                        style={[
                                                            styles.memoryAlbumImage,
                                                            {
                                                                backgroundColor: t.surface,
                                                                alignItems: "center",
                                                                justifyContent: "center",
                                                            },
                                                        ]}
                                                    >
                                                        <Text style={{ fontSize: 20 }}>📷</Text>
                                                    </View>
                                                )}
                                                <View style={styles.memoryAlbumBody}>
                                                    <Text
                                                        style={[styles.memoryAlbumCaption, { color: t.text }]}
                                                        numberOfLines={1}
                                                    >
                                                        {(story.course?.title ?? tx.memoryAlbumTitle).slice(0, 12)}
                                                    </Text>
                                                    {topTags.length > 0 && (
                                                        <View style={styles.memoryTagRow}>
                                                            {topTags.map((tag) => (
                                                                <View
                                                                    key={`${story.id}-${tag}`}
                                                                    style={styles.memoryTagPill}
                                                                >
                                                                    <Text style={styles.memoryTagText}>#{tag}</Text>
                                                                </View>
                                                            ))}
                                                        </View>
                                                    )}
                                                    {!!dateText && (
                                                        <Text style={[styles.memoryDateText, { color: t.textMuted }]}>
                                                            {dateText}
                                                        </Text>
                                                    )}
                                                </View>
                                            </TouchableOpacity>
                                        );
                                    })}
                                </ScrollView>
                            )}
                        </View>
                    </View>
                )}
            </ScrollView>

            {/* 더 보기 Bottom Sheet */}
            <MoreCoursesSheet
                visible={showMore}
                todayCourses={todayCourses}
                weekendCourses={weekendCourses}
                onClose={() => setShowMore(false)}
            />

            {/* 추억 상세 모달 */}
            <MemoryDetailModal
                visible={showMemoryModal}
                memory={selectedMemory}
                currentIndex={currentImageIndex}
                onIndexChange={setCurrentImageIndex}
                onClose={() => {
                    setShowMemoryModal(false);
                    setSelectedMemory(null);
                }}
                locale={locale}
            />
        </SafeAreaView>
    );
}

// ─── 스타일 ───────────────────────────────────────────────────────────────────

const SCREEN_W = Dimensions.get("window").width; // MoreCoursesSheet에서 사용

function getAllPhotos(memory: PersonalStory): string[] {
    if (memory.placeData && typeof memory.placeData === "object") {
        const stepIndices = Object.keys(memory.placeData).sort((a, b) => Number(a) - Number(b));
        return stepIndices.flatMap((k) => memory.placeData![k]?.photos ?? []);
    }
    return memory.imageUrls ?? [];
}

function getTagsForIndex(memory: PersonalStory, idx: number): string[] {
    if (memory.placeData && typeof memory.placeData === "object") {
        const stepIndices = Object.keys(memory.placeData).sort((a, b) => Number(a) - Number(b));
        let count = 0;
        for (const k of stepIndices) {
            const photos = memory.placeData![k]?.photos ?? [];
            if (idx < count + photos.length) return memory.placeData![k]?.tags ?? [];
            count += photos.length;
        }
        return [];
    }
    return memory.tags ?? [];
}

// ─── 스타일 ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#fff" },
    containerDark: { backgroundColor: "#0f1710" },
    scrollContent: { paddingBottom: 130 },

    // 섹션
    section: {
        paddingHorizontal: 24,
        marginBottom: 24,
    },
    sectionHeaderRow: {
        marginBottom: 12,
    },
    sectionTitleGreen: {
        fontSize: 18,
        fontWeight: "700",
        color: "#059669",
        letterSpacing: -0.3,
    },
    sectionSub: {
        fontSize: 13,
        color: "#9ca3af",
        marginTop: 2,
    },

    // 활성 코스 카드 (웹/디자인: 썸네일 + 오늘의 데이트 + 제목 + 진행 중 + 이어가기)
    activeBanner: {
        borderRadius: 20,
        borderWidth: 1,
        padding: 16,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
        elevation: 4,
    },
    activeBannerInner: {
        flexDirection: "row",
        gap: 14,
        alignItems: "flex-start",
    },
    activeBannerImg: {
        width: 84,
        height: 84,
        borderRadius: 14,
        overflow: "hidden",
        backgroundColor: "#f1f5f9",
        flexShrink: 0,
    },
    activeBannerImgEl: {
        width: 84,
        height: 84,
    },
    activeBannerImgPlaceholder: {
        alignItems: "center",
        justifyContent: "center",
    },
    activeBannerText: {
        flex: 1,
        minWidth: 0,
    },
    activeBannerKicker: {
        fontSize: 12,
        fontWeight: "600",
        marginBottom: 6,
        letterSpacing: -0.2,
    },
    activeBannerTitle: {
        fontSize: 16,
        fontWeight: "800",
        lineHeight: 22,
        letterSpacing: -0.4,
        marginTop: 2,
    },
    activeBannerFooterRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 10,
        marginTop: 8,
    },
    activeBannerStatus: {
        fontSize: 12,
        fontWeight: "600",
    },
    activeContinueBtn: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        backgroundColor: Colors.brandGreenLight,
        paddingHorizontal: 16,
        paddingVertical: 9,
        borderRadius: 999,
    },
    activeContinueText: {
        fontSize: 13,
        fontWeight: "700",
        color: "#fff",
    },
    activeContinueArrow: {
        fontSize: 13,
        fontWeight: "700",
        color: "#fff",
    },

    // Featured 카드 (오늘의 선택)
    featuredCard: {
        backgroundColor: "#fff",
        borderRadius: 16,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
        elevation: 3,
        overflow: "hidden",
    },
    featuredImgWrap: {},
    featuredImg: {
        width: "100%",
        height: 220,
        backgroundColor: "#e5e7eb",
    },
    featuredImgPlaceholder: {
        alignItems: "center",
        justifyContent: "center",
    },
    featuredBody: {
        padding: 16,
        paddingTop: 12,
    },
    featuredChips: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 6,
        marginBottom: 8,
    },
    featuredChip: {
        backgroundColor: "#f3f4f6",
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 999,
    },
    featuredChipText: {
        fontSize: 12,
        color: "#374151",
        fontWeight: "500",
    },
    featuredTitle: {
        fontSize: 17,
        fontWeight: "600",
        color: "#111827",
        lineHeight: 24,
        letterSpacing: -0.3,
    },
    featuredRegion: {
        fontSize: 13,
        color: "#9ca3af",
        marginTop: 4,
    },
    featuredBtn: {
        marginTop: 16,
        alignSelf: "flex-start",
        backgroundColor: "#059669",
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 999,
    },
    featuredBtnText: {
        fontSize: 14,
        fontWeight: "600",
        color: "#fff",
    },
    featuredSkeleton: {
        height: 320,
        backgroundColor: "#f3f4f6",
        borderRadius: 16,
        alignItems: "center",
        justifyContent: "center",
    },

    viewMoreBtn: {
        alignSelf: "flex-end",
        marginTop: 10,
    },
    viewMoreText: {
        fontSize: 14,
        fontWeight: "500",
        color: "#059669",
    },

    emptyRec: {
        height: 160,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#f9fafb",
        borderRadius: 16,
    },
    emptyRecText: {
        fontSize: 14,
        color: "#9ca3af",
    },

    // AI CTA
    aiCta: {
        backgroundColor: "#ecfdf5",
        borderRadius: 24,
        borderWidth: 1,
        borderColor: "#d1fae5",
        paddingVertical: 16,
        paddingHorizontal: 16,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },
    aiCtaLeft: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        flex: 1,
    },
    aiCtaTitle: {
        fontSize: 14,
        fontWeight: "600",
        color: "#064e3b",
        letterSpacing: -0.2,
    },
    aiCtaSub: {
        fontSize: 12,
        color: "#047857",
        marginTop: 2,
    },
    aiCtaArrow: {
        fontSize: 16,
        color: "#059669",
        fontWeight: "500",
    },

    // 더 보기 모달 카드
    moreCard: {
        marginBottom: 12,
        borderRadius: 12,
        overflow: "hidden",
        backgroundColor: "#e5e7eb",
    },
    moreCardImgWrap: {
        position: "relative",
        width: "100%",
        aspectRatio: 16 / 9,
    },
    moreCardImg: {
        width: "100%",
        height: "100%",
    },
    moreCardOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: "rgba(0,0,0,0.28)",
    },
    moreCardTextWrap: {
        position: "absolute",
        bottom: 12,
        left: 12,
        right: 12,
    },
    moreCardTagRow: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 4,
        marginTop: 6,
    },
    moreCardTagPill: {
        backgroundColor: "rgba(255,255,255,0.2)",
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 999,
    },
    moreCardTagText: {
        fontSize: 11,
        fontWeight: "600",
        color: "#fff",
    },
    moreCardTitle: {
        fontSize: 15,
        fontWeight: "700",
        color: "#fff",
        lineHeight: 20,
    },
    moreCardRegion: {
        fontSize: 12,
        color: "rgba(255,255,255,0.7)",
        marginTop: 2,
    },

    // Bottom Sheet
    sheetOverlay: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.82)",
        justifyContent: "flex-end",
    },
    sheet: {
        backgroundColor: "#fff",
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        height: "80%",
        flex: 0,
    },
    sheetHandle: {
        alignItems: "center",
        paddingTop: 12,
        paddingBottom: 8,
    },
    sheetHandleBar: {
        width: 40,
        height: 6,
        borderRadius: 3,
        backgroundColor: "#e5e7eb",
    },
    sheetTabRow: {
        flexDirection: "row",
        gap: 8,
        paddingHorizontal: 16,
        paddingBottom: 12,
    },
    sheetTab: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 999,
        backgroundColor: "#f3f4f6",
    },
    sheetTabActive: {
        backgroundColor: "#059669",
    },
    sheetTabInactive: {
        backgroundColor: "#f3f4f6",
    },
    sheetTabText: {
        fontSize: 14,
        fontWeight: "600",
        color: "#6b7280",
    },
    sheetTabTextActive: {
        color: "#fff",
    },
    sheetTabTextInactive: {
        color: "#6b7280",
    },

    // 나만의 데이트 앨범
    memoryAlbumWrap: {
        borderRadius: 24,
        borderWidth: 1,
        paddingVertical: 16,
        paddingHorizontal: 14,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.08,
        shadowRadius: 14,
        elevation: 3,
    },
    memoryAlbumHeader: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 10,
    },
    memoryAlbumTitle: { fontSize: 18, fontWeight: "800", letterSpacing: -0.3 },
    memoryAlbumEmptyWrap: { paddingTop: 2 },
    memoryAlbumEmptySub: { fontSize: 14, marginTop: 4, marginBottom: 14, lineHeight: 20 },
    memoryAlbumCtaBtn: {
        width: "100%",
        minHeight: 48,
        borderRadius: 999,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#7aa06f",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.12,
        shadowRadius: 10,
        elevation: 3,
    },
    memoryAlbumCtaText: { color: "#fff", fontSize: 14, fontWeight: "700" },
    memoryAlbumScroll: { paddingRight: 6 },
    memoryAlbumCard: {
        width: 178,
        borderRadius: 16,
        borderWidth: 1,
        marginRight: 12,
        overflow: "hidden",
    },
    memoryAlbumImage: {
        width: "100%",
        height: 180,
        backgroundColor: "#e5e7eb",
    },
    memoryAlbumBody: { paddingHorizontal: 10, paddingVertical: 10, minHeight: 74 },
    memoryAlbumCaption: {
        fontSize: 13,
        fontWeight: "700",
    },
    memoryTagRow: { flexDirection: "row", flexWrap: "wrap", gap: 5, marginTop: 6 },
    memoryTagPill: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 999,
        backgroundColor: "#d1fae5",
    },
    memoryTagText: { fontSize: 10, fontWeight: "700", color: "#047857" },
    memoryDateText: { fontSize: 11, marginTop: 5 },
});
