/**
 * 이스케이프 - 커플 미션 게임 목록
 */
import React, { useState } from "react";
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Image,
    Modal,
    ActivityIndicator,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";

import { api } from "../../src/lib/api";
import { resolveImageUrl } from "../../src/lib/imageUrl";
import { useThemeColors } from "../../src/hooks/useThemeColors";
import { useAuth } from "../../src/hooks/useAuth";
import AppHeaderWithModals from "../../src/components/AppHeaderWithModals";

// ─── 타입 ─────────────────────────────────────────────────────────────────────

interface Story {
    id: number;
    title: string;
    synopsis: string;
    region: string | null;
    level: number | null;
    imageUrl: string | null;
    badge: { id: number; name: string; description: string; image_url?: string } | null;
}

// ─── 난이도 별 ────────────────────────────────────────────────────────────────

function LevelStars({ level }: { level: number | null }) {
    const n = Math.min(Math.max(level ?? 1, 1), 5);
    return (
        <View style={{ flexDirection: "row", gap: 2 }}>
            {Array.from({ length: 5 }).map((_, i) => (
                <Ionicons key={i} name="star" size={11} color={i < n ? "#f59e0b" : "#d1d5db"} />
            ))}
        </View>
    );
}

// ─── 스토리 카드 ──────────────────────────────────────────────────────────────

function StoryCard({ story, onPress }: { story: Story; onPress: () => void }) {
    const t = useThemeColors();
    const imgUri = resolveImageUrl(story.imageUrl);

    return (
        <TouchableOpacity
            style={[s.card, { backgroundColor: t.card, borderColor: t.border }]}
            activeOpacity={0.88}
            onPress={onPress}
        >
            {imgUri ? (
                <Image source={{ uri: imgUri }} style={s.cardImg} resizeMode="cover" />
            ) : (
                <View style={[s.cardImg, { backgroundColor: t.isDark ? "#1f2937" : "#e5e7eb", alignItems: "center", justifyContent: "center" }]}>
                    <Ionicons name="map" size={36} color={t.textMuted} />
                </View>
            )}
            <View style={s.cardBody}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 }}>
                    {story.region && (
                        <View style={s.regionTag}>
                            <Text style={s.regionTagText}>#{story.region}</Text>
                        </View>
                    )}
                    <LevelStars level={story.level} />
                </View>
                <Text style={[s.cardTitle, { color: t.text }]} numberOfLines={2}>{story.title}</Text>
                <Text style={[s.cardSynopsis, { color: t.textMuted }]} numberOfLines={2}>{story.synopsis}</Text>
                {story.badge && (
                    <View style={[s.badgeRow, { borderColor: t.border }]}>
                        <Ionicons name="ribbon-outline" size={13} color="#f59e0b" />
                        <Text style={[s.badgeText, { color: t.textMuted }]}>{story.badge.name} 획득 가능</Text>
                    </View>
                )}
            </View>
        </TouchableOpacity>
    );
}

// ─── 상세 모달 ────────────────────────────────────────────────────────────────

function StoryDetailModal({
    story,
    visible,
    onClose,
    onStart,
}: {
    story: Story | null;
    visible: boolean;
    onClose: () => void;
    onStart: (id: number) => void;
}) {
    const t = useThemeColors();
    const insets = useSafeAreaInsets();
    if (!story) return null;
    const imgUri = resolveImageUrl(story.imageUrl);

    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
            <View style={s.modalOverlay}>
                <TouchableOpacity style={StyleSheet.absoluteFillObject} activeOpacity={1} onPress={onClose} />
                <View style={[s.detailSheet, { backgroundColor: t.card, paddingBottom: insets.bottom + 16 }]}>
                    {/* 핸들 */}
                    <View style={s.handle} />

                    {/* 이미지 */}
                    {imgUri ? (
                        <Image source={{ uri: imgUri }} style={s.detailImg} resizeMode="cover" />
                    ) : (
                        <View style={[s.detailImg, { backgroundColor: t.isDark ? "#1f2937" : "#e5e7eb", alignItems: "center", justifyContent: "center" }]}>
                            <Ionicons name="map" size={48} color={t.textMuted} />
                        </View>
                    )}

                    <ScrollView showsVerticalScrollIndicator={false} style={{ paddingHorizontal: 20 }}>
                        {/* 태그 + 별 */}
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 14, marginBottom: 8 }}>
                            {story.region && (
                                <View style={s.regionTag}>
                                    <Text style={s.regionTagText}>#{story.region}</Text>
                                </View>
                            )}
                            <LevelStars level={story.level} />
                        </View>

                        {/* 제목 */}
                        <Text style={[s.detailTitle, { color: t.text }]}>{story.title}</Text>

                        {/* 시놉시스 */}
                        <Text style={[s.detailSynopsis, { color: t.textMuted }]}>{story.synopsis}</Text>

                        {/* 뱃지 */}
                        {story.badge && (
                            <View style={[s.detailBadgeBox, { backgroundColor: t.isDark ? "#1c2e1f" : "#fef3c7", borderColor: t.isDark ? "#854d0e" : "#fcd34d" }]}>
                                <Ionicons name="ribbon" size={18} color="#f59e0b" />
                                <View style={{ flex: 1 }}>
                                    <Text style={{ fontSize: 13, fontWeight: "500", color: "#b45309" }}>{story.badge.name}</Text>
                                    <Text style={{ fontSize: 12, color: t.textMuted, marginTop: 2 }}>{story.badge.description}</Text>
                                </View>
                            </View>
                        )}
                    </ScrollView>

                    {/* CTA */}
                    <View style={{ paddingHorizontal: 20, paddingTop: 16 }}>
                        <TouchableOpacity
                            style={s.startBtn}
                            activeOpacity={0.88}
                            onPress={() => {
                                onClose();
                                onStart(story.id);
                            }}
                        >
                            <Ionicons name="play" size={18} color="#fff" />
                            <Text style={s.startBtnText}>시작하기</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
}

// ─── 메인 화면 ────────────────────────────────────────────────────────────────

export default function EscapeScreen() {
    const t = useThemeColors();
    const insets = useSafeAreaInsets();
    const { isAuthenticated } = useAuth();
    const [selectedStory, setSelectedStory] = useState<Story | null>(null);
    const [detailVisible, setDetailVisible] = useState(false);

    const { data: stories = [], isLoading } = useQuery<Story[]>({
        queryKey: ["escape", "stories"],
        queryFn: () => api.get("/api/escape/stories"),
        staleTime: 1000 * 60 * 5,
    });

    return (
        <SafeAreaView style={[s.root, { backgroundColor: t.background }]} edges={["top"]}>
            <AppHeaderWithModals />

            {/* 헤더 */}
            <View style={[s.header, { borderBottomColor: t.border }]}>
                <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Ionicons name="arrow-back" size={22} color={t.text} />
                </TouchableOpacity>
                <View style={{ flex: 1 }}>
                    <Text style={[s.headerTitle, { color: t.text }]}>커플 미션 게임</Text>
                    <Text style={[s.headerSub, { color: t.textMuted }]}>실외 방탈출 코스</Text>
                </View>
                <Ionicons name="compass-outline" size={24} color="#059669" />
            </View>

            {isLoading ? (
                <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                    <ActivityIndicator color="#059669" />
                </View>
            ) : stories.length === 0 ? (
                <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 12 }}>
                    <Text style={{ fontSize: 48 }}>🗺️</Text>
                    <Text style={[{ fontSize: 16, fontWeight: "500", color: t.text }]}>스토리를 준비 중이에요</Text>
                    <Text style={[{ fontSize: 14, color: t.textMuted, textAlign: "center" }]}>곧 새로운 미션 코스가 오픈됩니다!</Text>
                </View>
            ) : (
                <ScrollView
                    contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: insets.bottom + 20 }}
                    showsVerticalScrollIndicator={false}
                >
                    {/* 배너 */}
                    <View style={[s.banner, { backgroundColor: t.isDark ? "#0d2818" : "#ecfdf5" }]}>
                        <Ionicons name="location" size={20} color="#059669" />
                        <Text style={[s.bannerText, { color: t.isDark ? "#6ee7b7" : "#047857" }]}>
                            실제 장소를 돌아다니며 미션을 완수해보세요
                        </Text>
                    </View>

                    {stories.map((story) => (
                        <StoryCard
                            key={story.id}
                            story={story}
                            onPress={() => {
                                setSelectedStory(story);
                                setDetailVisible(true);
                            }}
                        />
                    ))}
                </ScrollView>
            )}

            <StoryDetailModal
                story={selectedStory}
                visible={detailVisible}
                onClose={() => setDetailVisible(false)}
                onStart={(id) => router.push(`/escape/${id}` as any)}
            />
        </SafeAreaView>
    );
}

// ─── 스타일 ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
    root: { flex: 1 },
    header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1 },
    headerTitle: { fontSize: 17, fontWeight: "500" },
    headerSub: { fontSize: 12, marginTop: 1 },
    banner: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 12 },
    bannerText: { fontSize: 13, fontWeight: "500", flex: 1 },
    card: { borderRadius: 16, overflow: "hidden", borderWidth: 1 },
    cardImg: { width: "100%", height: 160 },
    cardBody: { padding: 14 },
    regionTag: { backgroundColor: "#dcfce7", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
    regionTagText: { fontSize: 11, fontWeight: "500", color: "#047857" },
    cardTitle: { fontSize: 16, fontWeight: "500", marginBottom: 4, letterSpacing: -0.3 },
    cardSynopsis: { fontSize: 13, lineHeight: 19 },
    badgeRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 10, paddingTop: 10, borderTopWidth: 1 },
    badgeText: { fontSize: 12 },
    // 모달
    modalOverlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.6)" },
    detailSheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: "90%", overflow: "hidden" },
    handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: "#d1d5db", alignSelf: "center", marginTop: 10, marginBottom: 4 },
    detailImg: { width: "100%", height: 200 },
    detailTitle: { fontSize: 20, fontWeight: "600", letterSpacing: -0.4, marginBottom: 8 },
    detailSynopsis: { fontSize: 14, lineHeight: 22, marginBottom: 14 },
    detailBadgeBox: { flexDirection: "row", alignItems: "flex-start", gap: 10, padding: 12, borderRadius: 12, borderWidth: 1, marginBottom: 14 },
    startBtn: { backgroundColor: "#059669", borderRadius: 16, paddingVertical: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
    startBtnText: { fontSize: 16, fontWeight: "500", color: "#fff" },
});
