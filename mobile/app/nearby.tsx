/**
 * 오늘 뭐하지 — 네이티브 전환
 * 웹 /nearby (NearbyClient) 1:1 재현
 * - 검색 / 지역 필터 / 무한 스크롤 / 찜
 */
import React, { useState, useCallback, useRef, useMemo } from "react";
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    ScrollView,
    TouchableOpacity,
    Image,
    TextInput,
    ActivityIndicator,
    RefreshControl,
    Platform,
    Dimensions,
    Modal,
    Pressable,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useInfiniteQuery, useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, endpoints } from "../src/lib/api";
import { Colors } from "../src/constants/theme";
import { resolveImageUrl } from "../src/lib/imageUrl";
import { useThemeColors } from "../src/hooks/useThemeColors";
import { useAuth } from "../src/hooks/useAuth";
import PageLoadingOverlay from "../src/components/PageLoadingOverlay";
import AppHeaderWithModals from "../src/components/AppHeaderWithModals";
import StandaloneTabBar from "../src/components/StandaloneTabBar";
import SideMenuSheet from "../src/components/SideMenuSheet";
import type { Course, UserProfile } from "../src/types/api";

const SCREEN_W = Dimensions.get("window").width;

// ─── 상수 ──────────────────────────────────────────────────────────────────────

const REGIONS = ["강남", "성수", "홍대", "종로", "연남", "영등포"];
const CONCEPT_TAGS = ["이색데이트", "감성데이트", "야경", "힐링", "가성비", "인생샷", "맛집탐방", "카페투어", "술자리", "실내데이트", "공연·전시"];
const SITUATION_TAGS = ["썸탈 때", "소개팅", "기념일", "데이트", "친구와", "혼자"];
const MOOD_TAGS = ["로맨틱", "힙한", "활기찬", "레트로", "고급스러운", "감성", "조용한", "이국적인"];

// ─── 코스 카드 ─────────────────────────────────────────────────────────────────

function formatViewCount(v: number) {
    if (v >= 10000) return `${(v / 10000).toFixed(v % 10000 ? 1 : 0)}만`;
    if (v >= 1000)  return `${(v / 1000).toFixed(v % 1000 ? 1 : 0)}천`;
    return String(v);
}

function NearbyCard({
    course,
    isFav,
    onFavToggle,
    userTier,
}: {
    course: Course;
    isFav: boolean;
    onFavToggle: (id: number) => void;
    userTier: string;
}) {
    const t = useThemeColors();
    const isNew = (course as any).reviewCount === 0;
    const placesCount = (course as any).placesCount ?? (course as any).coursePlaces?.length ?? 0;
    const views = Number((course as any).viewCount ?? 0);
    const reviewCount = Number((course as any).reviewCount ?? 0);
    const rating = Number((course as any).rating ?? 0);
    const isLocked = (course as any).isLocked === true;
    const grade = String((course as any).grade ?? "FREE").toUpperCase();
    const hasRealtimeReservation = Boolean(
        (course as any).reservationUrl ||
            (course as any).reservation_url ||
            (course as any).hasReservation ||
            (course as any).coursePlaces?.some((cp: any) =>
                Boolean(
                    cp?.place?.reservationUrl ||
                        cp?.place?.reservation_url ||
                        cp?.place?.reservation_required,
                ),
            ),
    );

    // 1번 장소 이미지 우선, 없으면 코스 대표 이미지
    const firstPlaceImg = (course as any).coursePlaces?.[0]?.place?.imageUrl;
    const displayImgUrl = firstPlaceImg || course.imageUrl;

    const infoLine = views >= 1000
        ? `👀 ${formatViewCount(views)}명이 보는 중`
        : reviewCount > 0
        ? `★ ${rating.toFixed(1)} (${reviewCount})`
        : null;

    return (
        <TouchableOpacity
            style={s.card}
            onPress={() => {
                if (isLocked) { router.push("/shop" as any); return; }
                router.push(`/courses/${course.id}` as any);
            }}
            activeOpacity={0.88}
        >
            {/* 이미지 */}
            <View style={[s.cardImgWrap, { borderColor: t.isDark ? "transparent" : "#f3f4f6" }]}>
                {displayImgUrl ? (
                    <Image source={{ uri: resolveImageUrl(displayImgUrl) }} style={s.cardImg} />
                ) : (
                    <View style={[s.cardImg, { backgroundColor: "#e5e7eb", alignItems: "center", justifyContent: "center" }]}>
                        <Text style={{ color: "#9ca3af", fontSize: 12 }}>DoNa</Text>
                    </View>
                )}

                <View style={s.imgGradient} pointerEvents="none" />

                {/* 배지 */}
                <View style={s.badges} pointerEvents="none">
                    {hasRealtimeReservation && (
                        <View style={s.reserveBadge}>
                            <Text style={s.reserveBadgeText}>실시간 예약</Text>
                        </View>
                    )}
                    {grade !== "FREE" && (
                        <View style={s.tierBadge}>
                            <Text style={s.tierBadgeText}>{grade}</Text>
                        </View>
                    )}
                    {course.concept && (
                        <View style={s.conceptBadge}>
                            <Text style={s.conceptBadgeText}>#{course.concept}</Text>
                        </View>
                    )}
                    {isNew && <View style={s.newBadge}><Text style={s.newBadgeText}>NEW</Text></View>}
                </View>

                {/* 찜 버튼 */}
                <TouchableOpacity
                    style={s.favBtn}
                    onPress={() => onFavToggle(course.id)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                    <Ionicons name={isFav ? "heart" : "heart-outline"} size={19} color={isFav ? "#ef4444" : "#fff"} />
                </TouchableOpacity>

                {/* 잠금 오버레이 */}
                {isLocked && (
                    <View style={s.lockOverlay}>
                        <View style={s.lockBox}>
                            <Ionicons name="lock-closed" size={24} color="#fff" />
                            <Text style={s.lockText}>
                                {course.grade === "PREMIUM" ? "PREMIUM" : "BASIC"} 코스
                            </Text>
                            <Text style={s.lockSub}>구독하고 열람하기</Text>
                        </View>
                    </View>
                )}
            </View>

            {/* 정보 */}
            <View style={s.cardBody}>
                <Text style={[s.cardTitle, { color: t.text }]} numberOfLines={2}>{course.title}</Text>
                <View style={s.metaRow}>
                    {(course.location || (course as any).region) && (
                        <Text style={[s.metaText, { color: t.textMuted }]}>
                            📍 {(course as any).location ?? (course as any).region}
                        </Text>
                    )}
                    {placesCount > 0 && <View style={[s.metaDot, { backgroundColor: t.textMuted }]} />}
                    {placesCount > 0 && <Text style={[s.metaText, { color: t.textMuted }]}>👣 {placesCount} 스팟</Text>}
                    {course.duration && <View style={[s.metaDot, { backgroundColor: t.textMuted }]} />}
                    {course.duration && <Text style={[s.metaText, { color: t.textMuted }]}>⏳ {course.duration}</Text>}
                </View>
                {infoLine && (
                    <Text style={[s.infoLine, { color: t.textMuted }]} numberOfLines={1}>{infoLine}</Text>
                )}
            </View>
        </TouchableOpacity>
    );
}

// ─── 메인 화면 ─────────────────────────────────────────────────────────────────

export default function NearbyScreen() {
    const t = useThemeColors();
    const queryClient = useQueryClient();
    const { isAuthenticated } = useAuth();
    const insets = useSafeAreaInsets();
    const searchInputRef = useRef<TextInput>(null);
    const { q } = useLocalSearchParams<{ q?: string }>();

    const [searchInput, setSearchInput]   = useState(q ?? "");
    const [activeSearch, setActiveSearch] = useState(q ?? "");
    const [activeRegion, setActiveRegion] = useState("");
    const [sideMenuOpen, setSideMenuOpen] = useState(false);
    const [tagModalOpen, setTagModalOpen] = useState(false);
    const [selectedConcepts, setSelectedConcepts] = useState<string[]>([]);
    const [selectedSituations, setSelectedSituations] = useState<string[]>([]);
    const [selectedMoods, setSelectedMoods] = useState<string[]>([]);
    const [draftConcepts, setDraftConcepts] = useState<string[]>([]);
    const [draftSituations, setDraftSituations] = useState<string[]>([]);
    const [draftMoods, setDraftMoods] = useState<string[]>([]);

    const toggleTag = useCallback((list: string[], value: string, setter: (v: string[]) => void) => {
        setter(list.includes(value) ? list.filter((item) => item !== value) : [...list, value]);
    }, []);

    const openTagModal = useCallback(() => {
        setDraftConcepts(selectedConcepts);
        setDraftSituations(selectedSituations);
        setDraftMoods(selectedMoods);
        setTagModalOpen(true);
    }, [selectedConcepts, selectedSituations, selectedMoods]);

    const applyTagFilter = useCallback(() => {
        setSelectedConcepts(draftConcepts);
        setSelectedSituations(draftSituations);
        setSelectedMoods(draftMoods);
        setTagModalOpen(false);
    }, [draftConcepts, draftSituations, draftMoods]);

    const clearTagFilter = useCallback(() => {
        setSelectedConcepts([]);
        setSelectedSituations([]);
        setSelectedMoods([]);
        setDraftConcepts([]);
        setDraftSituations([]);
        setDraftMoods([]);
    }, []);

    // 검색어 제출
    const handleSearchSubmit = useCallback(() => {
        const q = searchInput.trim();
        setActiveSearch(q);
        setActiveRegion("");
    }, [searchInput]);

    // 검색 초기화
    const handleClearSearch = useCallback(() => {
        setSearchInput("");
        setActiveSearch("");
    }, []);

    // 지역 토글
    const toggleRegion = useCallback((val: string) => {
        setActiveRegion(prev => prev === val ? "" : val);
        setActiveSearch("");
        setSearchInput("");
    }, []);

    // 프로필 (잠금 판단용)
    const { data: profile } = useQuery<UserProfile>({
        queryKey: ["profile"],
        queryFn: () => api.get<UserProfile>(endpoints.profile),
        retry: false,
    });
    const userTier = (profile?.subscriptionTier ?? profile?.subscription_tier ?? "FREE") as string;

    // 찜 목록
    const { data: favList } = useQuery<any[]>({
        queryKey: ["favorites"],
        queryFn: () => api.get<any[]>(endpoints.favorites),
        retry: false,
    });
    const favIds = useMemo(() => {
        if (!favList) return new Set<number>();
        return new Set<number>(favList.map((f: any) => Number(f?.course?.id ?? f?.courseId ?? f?.id)));
    }, [favList]);

    const favMutation = useMutation({
        mutationFn: async ({ id, isFav }: { id: number; isFav: boolean }) => {
            if (isFav) {
                await api.delete(`${endpoints.favorites}?courseId=${id}`);
            } else {
                await api.post(endpoints.favorites, { courseId: id });
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["favorites"] });
            queryClient.invalidateQueries({ queryKey: ["users", "favorites"] });
            queryClient.invalidateQueries({ queryKey: ["users", "favorites", "header-badge"] });
        },
    });

    const handleFavToggle = useCallback((courseId: number) => {
        if (!isAuthenticated) { router.push("/(auth)/login" as any); return; }
        favMutation.mutate({ id: courseId, isFav: favIds.has(courseId) });
    }, [favMutation, favIds, isAuthenticated]);

    // 코스 목록 (무한 스크롤)
    const queryKey = ["nearby", activeSearch, activeRegion];

    const {
        data,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage,
        isLoading,
        refetch,
        isRefetching,
    } = useInfiniteQuery<Course[]>({
        queryKey,
        queryFn: async ({ pageParam = 0 }) => {
            const params = new URLSearchParams();
            params.set("limit", "20");
            params.set("offset", String(pageParam as number));
            if (activeSearch) params.set("q", activeSearch);
            if (activeRegion) params.set("region", activeRegion);
            const r = await api.get<Course[] | { data?: Course[]; courses?: Course[] }>(
                `/api/courses/nearby?${params.toString()}`
            );
            if (Array.isArray(r)) return r;
            return (r as any)?.data ?? (r as any)?.courses ?? [];
        },
        initialPageParam: 0,
        getNextPageParam: (lastPage, allPages) => {
            if (!lastPage || lastPage.length < 20) return undefined;
            return allPages.reduce((s, p) => s + p.length, 0);
        },
        staleTime: 2 * 60 * 1000,
    });

    const courses = useMemo(() => {
        const raw = data?.pages.flat() ?? [];
        return raw.filter((course) => {
            const courseConcept = String((course as any).concept ?? "");
            const courseSituationRaw = String((course as any).target_situation ?? (course as any).situation ?? "");
            const normalizedSituation = courseSituationRaw === "SOME" ? "썸탈 때" : courseSituationRaw;
            const courseMood = String((course as any).mood ?? (course as any).atmosphere ?? "");
            const conceptOk = selectedConcepts.length === 0 || selectedConcepts.includes(courseConcept);
            const situationOk =
                selectedSituations.length === 0 ||
                selectedSituations.some((situation) => normalizedSituation.includes(situation));
            const moodOk = selectedMoods.length === 0 || selectedMoods.some((m) => courseMood.includes(m));
            return conceptOk && situationOk && moodOk;
        });
    }, [data?.pages, selectedConcepts, selectedSituations, selectedMoods]);

    // ─── 렌더 헬퍼 ──────────────────────────────────────────────────────────────

    const activeFilterCount =
        [activeSearch, activeRegion].filter(Boolean).length +
        selectedConcepts.length +
        selectedSituations.length +
        selectedMoods.length;

    const ListHeader = useCallback(() => (
        <View>
            <View style={[s.listHeader, { backgroundColor: t.card, borderTopColor: t.border }]}>
                <Text style={[s.listHeaderTitle, { color: t.text }]}>
                    {activeRegion
                        ? `${activeRegion} 코스`
                        : activeSearch
                        ? `"${activeSearch}" 검색 결과`
                        : "오늘 뭐하지?"}
                </Text>
                <Text style={[s.listHeaderCount, { color: t.textMuted }]}>{courses.length}개</Text>
            </View>
        </View>
    ), [activeRegion, activeSearch, courses.length, t]);

    const plusBottom = insets.bottom + 8 + 46 + 12;

    return (
        <SafeAreaView style={[s.container, { backgroundColor: t.bg }]} edges={["top"]}>
            <SideMenuSheet visible={sideMenuOpen} onClose={() => setSideMenuOpen(false)} />

            {/* ── DoNa 헤더 ── */}
            <AppHeaderWithModals />

            {/* ── 검색창 + 지역 필터 ── */}
            <View style={[s.filterBar, { backgroundColor: t.card, borderBottomColor: t.border }]}>
                {/* 검색창 */}
                <View style={[s.searchBox, { backgroundColor: t.surface, borderColor: t.border }]}>
                    <Ionicons name="search" size={18} color={t.textMuted} style={{ marginRight: 8 }} />
                    <TextInput
                        ref={searchInputRef}
                        style={[s.searchInput, { color: t.text }]}
                        placeholder="지역, 코스명 검색"
                        placeholderTextColor={t.textMuted}
                        value={searchInput}
                        onChangeText={setSearchInput}
                        returnKeyType="search"
                        onSubmitEditing={handleSearchSubmit}
                        autoCorrect={false}
                        autoCapitalize="none"
                    />
                    {searchInput.length > 0 && (
                        <TouchableOpacity onPress={handleClearSearch} hitSlop={8}>
                            <Ionicons name="close-circle" size={18} color={t.textMuted} />
                        </TouchableOpacity>
                    )}
                    <TouchableOpacity style={s.filterIconBtn} onPress={openTagModal} hitSlop={8}>
                        <Ionicons name="options-outline" size={20} color={t.textMuted} />
                    </TouchableOpacity>
                </View>

                {/* 지역 칩 */}
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={s.regionRow}
                >
                    {activeFilterCount > 0 && (
                        <TouchableOpacity
                            style={[s.regionChip, { borderColor: "#ef4444", backgroundColor: "rgba(239,68,68,0.08)" }]}
                            onPress={() => {
                                setActiveSearch("");
                                setSearchInput("");
                                setActiveRegion("");
                                clearTagFilter();
                            }}
                            activeOpacity={0.7}
                        >
                            <Text style={[s.regionChipText, { color: "#ef4444" }]}>초기화 ✕</Text>
                        </TouchableOpacity>
                    )}
                    {REGIONS.map((r) => {
                        const isActive = activeRegion === r;
                        return (
                            <TouchableOpacity
                                key={r}
                                style={[s.regionChip, { borderColor: isActive ? "#059669" : t.border, backgroundColor: isActive ? "rgba(5,150,105,0.1)" : t.surface }]}
                                onPress={() => toggleRegion(r)}
                                activeOpacity={0.7}
                            >
                                <Text style={[s.regionChipText, { color: isActive ? "#059669" : t.textMuted }]}>{r}</Text>
                            </TouchableOpacity>
                        );
                    })}
                </ScrollView>
            </View>

            {/* ── 코스 목록 ── */}
            {isLoading ? (
                <PageLoadingOverlay overlay={false} />
            ) : (
                <FlatList
                    data={courses}
                    keyExtractor={(item) => String(item.id)}
                    renderItem={({ item }) => (
                        <NearbyCard
                            course={item}
                            isFav={favIds.has(item.id)}
                            onFavToggle={handleFavToggle}
                            userTier={userTier}
                        />
                    )}
                    ListHeaderComponent={ListHeader}
                    contentContainerStyle={[s.listContent, { backgroundColor: t.card }]}
                    onEndReached={() => { if (hasNextPage) fetchNextPage(); }}
                    onEndReachedThreshold={0.4}
                    ListFooterComponent={
                        isFetchingNextPage ? (
                            <View style={s.footerLoader}>
                                <ActivityIndicator color={Colors.brandGreen} />
                            </View>
                        ) : null
                    }
                    refreshControl={
                        <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.brandGreen} />
                    }
                    ListEmptyComponent={
                        <View style={s.empty}>
                            <Text style={{ fontSize: 40, marginBottom: 12 }}>🏝️</Text>
                            <Text style={[s.emptyText, { color: t.textMuted }]}>
                                {activeFilterCount > 0 ? "해당하는 코스가 없어요" : "코스를 불러오는 중이에요"}
                            </Text>
                        </View>
                    }
                    contentInset={{ bottom: 120 }}
                    contentInsetAdjustmentBehavior="automatic"
                />
            )}

            {/* ── + 버튼 ── */}
            <View style={[s.plusArea, { bottom: plusBottom }]} pointerEvents="box-none">
                {!sideMenuOpen && (
                    <TouchableOpacity
                        style={s.plusBtn}
                        onPress={() => setSideMenuOpen(true)}
                        activeOpacity={0.85}
                        accessibilityLabel="메뉴 열기"
                    >
                        <Text style={s.plusText}>+</Text>
                    </TouchableOpacity>
                )}
            </View>

            {/* ── 하단 탭바 ── */}
            <StandaloneTabBar />

            <Modal visible={tagModalOpen} transparent animationType="slide" onRequestClose={() => setTagModalOpen(false)}>
                <Pressable style={s.tagModalOverlay} onPress={() => setTagModalOpen(false)}>
                    <Pressable
                        style={[s.tagModalSheet, { backgroundColor: t.card, borderColor: t.border }]}
                        onPress={(e) => e.stopPropagation()}
                    >
                        <View style={[s.tagModalGrab, { backgroundColor: t.border }]} />
                        <Text style={[s.tagModalTitle, { color: t.text }]}>필터 설정</Text>

                        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.tagModalBody}>
                            <Text style={[s.tagSectionTitle, { color: t.text }]}>컨셉</Text>
                            <View style={s.tagWrap}>
                                {CONCEPT_TAGS.map((tag) => {
                                    const active = draftConcepts.includes(tag);
                                    return (
                                        <TouchableOpacity
                                            key={`concept-${tag}`}
                                            style={[
                                                s.tagChip,
                                                { borderColor: active ? "#059669" : t.border, backgroundColor: active ? "rgba(5,150,105,0.1)" : t.surface },
                                            ]}
                                            onPress={() => toggleTag(draftConcepts, tag, setDraftConcepts)}
                                            activeOpacity={0.8}
                                        >
                                            <Text style={[s.tagChipText, { color: active ? "#059669" : t.text }]}>{tag}</Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>

                            <Text style={[s.tagSectionTitle, { color: t.text, marginTop: 20 }]}>상황 조건</Text>
                            <View style={s.tagWrap}>
                                {SITUATION_TAGS.map((tag) => {
                                    const active = draftSituations.includes(tag);
                                    return (
                                        <TouchableOpacity
                                            key={`situation-${tag}`}
                                            style={[
                                                s.tagChip,
                                                {
                                                    borderColor: active ? "#059669" : t.border,
                                                    backgroundColor: active ? "rgba(5,150,105,0.1)" : t.surface,
                                                },
                                            ]}
                                            onPress={() => toggleTag(draftSituations, tag, setDraftSituations)}
                                            activeOpacity={0.8}
                                        >
                                            <Text style={[s.tagChipText, { color: active ? "#059669" : t.text }]}>{tag}</Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>

                            <Text style={[s.tagSectionTitle, { color: t.text, marginTop: 20 }]}>분위기</Text>
                            <View style={s.tagWrap}>
                                {MOOD_TAGS.map((tag) => {
                                    const active = draftMoods.includes(tag);
                                    return (
                                        <TouchableOpacity
                                            key={`mood-${tag}`}
                                            style={[
                                                s.tagChip,
                                                { borderColor: active ? "#059669" : t.border, backgroundColor: active ? "rgba(5,150,105,0.1)" : t.surface },
                                            ]}
                                            onPress={() => toggleTag(draftMoods, tag, setDraftMoods)}
                                            activeOpacity={0.8}
                                        >
                                            <Text style={[s.tagChipText, { color: active ? "#059669" : t.text }]}>{tag}</Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                        </ScrollView>

                        <View style={s.tagModalActions}>
                            <TouchableOpacity
                                style={[s.tagResetBtn, { backgroundColor: t.surface, borderColor: t.border }]}
                                onPress={() => {
                                    setDraftConcepts([]);
                                    setDraftSituations([]);
                                    setDraftMoods([]);
                                }}
                            >
                                <Text style={[s.tagResetText, { color: t.textMuted }]}>초기화</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={s.tagApplyBtn} onPress={applyTagFilter}>
                                <Text style={s.tagApplyText}>적용하기</Text>
                </TouchableOpacity>
                        </View>
                    </Pressable>
                </Pressable>
            </Modal>
            </SafeAreaView>
    );
}

// ─── 스타일 ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
    container: { flex: 1 },

    // 검색 + 지역 필터 바
    filterBar: {
        borderBottomWidth: StyleSheet.hairlineWidth,
        paddingBottom: 10,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 2,
        elevation: 2,
    },

    // 검색창
    searchBox: {
        flexDirection: "row",
        alignItems: "center",
        marginHorizontal: 16,
        marginTop: 10,
        marginBottom: 10,
        paddingHorizontal: 14,
        paddingVertical: Platform.OS === "ios" ? 11 : 8,
        borderRadius: 14,
        borderWidth: 1,
    },
    searchInput: { flex: 1, fontSize: 15, padding: 0 },
    filterIconBtn: { marginLeft: 10, paddingHorizontal: 2, paddingVertical: 2 },

    // 지역 칩
    regionRow: {
        flexDirection: "row",
        paddingHorizontal: 16,
        gap: 8,
    },
    regionChip: {
        paddingHorizontal: 16,
        paddingVertical: 7,
        borderRadius: 99,
        borderWidth: 1,
    },
    regionChipText: { fontSize: 14, fontWeight: "600" },

    tagModalOverlay: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.35)",
        justifyContent: "flex-end",
    },
    tagModalSheet: {
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        borderTopWidth: StyleSheet.hairlineWidth,
        maxHeight: "78%",
        paddingHorizontal: 16,
        paddingTop: 8,
    },
    tagModalGrab: {
        alignSelf: "center",
        width: 46,
        height: 5,
        borderRadius: 99,
        marginBottom: 16,
    },
    tagModalTitle: {
        fontSize: 20,
        fontWeight: "800",
        letterSpacing: -0.4,
        marginBottom: 12,
    },
    tagModalBody: { paddingBottom: 18 },
    tagSectionTitle: { fontSize: 18, fontWeight: "800", marginBottom: 12, letterSpacing: -0.3 },
    tagWrap: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
    tagChip: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 13, paddingVertical: 8 },
    tagChipText: { fontSize: 14, fontWeight: "600" },
    tagModalActions: {
        flexDirection: "row",
        gap: 12,
        paddingBottom: 12,
        paddingTop: 10,
    },
    tagResetBtn: {
        flex: 1,
        borderWidth: 1,
        borderRadius: 12,
        alignItems: "center",
        justifyContent: "center",
        minHeight: 48,
    },
    tagResetText: { fontSize: 16, fontWeight: "700" },
    tagApplyBtn: {
        flex: 2,
        backgroundColor: "#0b1738",
        borderRadius: 12,
        alignItems: "center",
        justifyContent: "center",
        minHeight: 48,
    },
    tagApplyText: { color: "#fff", fontSize: 16, fontWeight: "800" },

    // + 버튼
    plusArea: {
        position: "absolute",
        right: 24,
        alignItems: "flex-end",
        zIndex: 50,
    },
    plusBtn: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: "#7FCC9F",
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 2,
        borderColor: "rgba(255,255,255,0.5)",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.2,
        shadowRadius: 16,
        elevation: 10,
    },
    plusText: {
        fontSize: 28,
        fontWeight: "300",
        color: "#fff",
        lineHeight: 34,
        marginTop: -2,
    },

    // 리스트 헤더
    listHeader: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderTopWidth: StyleSheet.hairlineWidth,
    },
    listHeaderTitle: { fontSize: 16, fontWeight: "800", letterSpacing: -0.3 },
    listHeaderCount: { fontSize: 13 },
    listContent: { paddingBottom: 120 },

    // 코스 카드
    card: { marginHorizontal: 16, marginBottom: 24 },
    cardImgWrap: {
        width: "100%",
        aspectRatio: 4 / 3,
        borderRadius: 20,
        overflow: "hidden",
        borderWidth: 1,
        position: "relative",
        backgroundColor: "#f3f4f6",
    },
    cardImg: { width: "100%", height: "100%", resizeMode: "cover" },
    imgGradient: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: "rgba(0,0,0,0.06)",
    },
    badges: {
        position: "absolute", top: 12, left: 12,
        flexDirection: "row", gap: 6, flexWrap: "wrap",
    },
    conceptBadge: {
        backgroundColor: "rgba(0,0,0,0.45)",
        borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4,
    },
    conceptBadgeText: { color: "#fff", fontSize: 10, fontWeight: "700" },
    reserveBadge: {
        backgroundColor: "#0ea68b",
        borderRadius: 10,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.45)",
    },
    reserveBadgeText: {
        color: "#fff",
        fontSize: 11,
        fontWeight: "800",
        letterSpacing: -0.1,
    },
    tierBadge: {
        backgroundColor: "#12b886",
        borderRadius: 10,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderWidth: 1.5,
        borderColor: "rgba(0,0,0,0.18)",
    },
    tierBadgeText: {
        color: "#fff",
        fontSize: 11,
        fontWeight: "900",
        letterSpacing: 0.2,
    },
    newBadge: {
        backgroundColor: "#059669",
        borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4,
    },
    newBadgeText: { color: "#fff", fontSize: 10, fontWeight: "700" },
    favBtn: {
        position: "absolute", top: 12, right: 12,
        width: 36, height: 36, borderRadius: 18,
        backgroundColor: "rgba(0,0,0,0.35)",
        alignItems: "center", justifyContent: "center",
    },
    // 잠금 오버레이
    lockOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: "rgba(0,0,0,0.55)",
        alignItems: "center",
        justifyContent: "center",
    },
    lockBox: { alignItems: "center", gap: 6 },
    lockText: { color: "#fff", fontSize: 14, fontWeight: "800" },
    lockSub: { color: "rgba(255,255,255,0.8)", fontSize: 12, fontWeight: "500" },

    cardBody: { paddingTop: 12, paddingHorizontal: 2 },
    cardTitle: { fontSize: 16, fontWeight: "800", letterSpacing: -0.3, marginBottom: 6, lineHeight: 22 },
    metaRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 4, marginBottom: 4 },
    metaText: { fontSize: 12, fontWeight: "500" },
    metaDot: { width: 3, height: 3, borderRadius: 1.5 },
    infoLine: { fontSize: 12, fontWeight: "500" },

    // 기타
    footerLoader: { paddingVertical: 24, alignItems: "center" },
    empty: { alignItems: "center", paddingVertical: 60 },
    emptyText: { fontSize: 15, fontWeight: "600" },
});
