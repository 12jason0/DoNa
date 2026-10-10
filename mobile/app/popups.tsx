/**
 * 팝업·전시 모음 — 웹 (home)/popups/page.tsx 와 같은 화면 (목록은 /api/popups)
 * 진행 중 / 곧 시작(14일 이내), 종료 7일 이내 D-N 표시, 이 장소가 들어간 코스로 이동
 */
import React, { useCallback, useEffect, useState } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";

import { useThemeColors } from "../src/hooks/useThemeColors";
import { useLocale } from "../src/lib/useLocale";
import { apiFetch } from "../src/lib/api";

type PopupItem = {
    id: number;
    name: string;
    imageUrl: string | null;
    region: string;
    period: string;
    badge: string | null;
    courses: { id: number; title: string }[];
};
type PopupList = { ongoing: PopupItem[]; upcoming: PopupItem[] };

function PopupCard({ p, tc }: { p: PopupItem; tc: ReturnType<typeof useThemeColors> }) {
    return (
        <View style={[styles.card, { backgroundColor: tc.card, borderColor: tc.border }]}>
            <View style={styles.cardTop}>
                {p.imageUrl ? (
                    <Image source={{ uri: p.imageUrl }} style={styles.thumb} contentFit="cover" />
                ) : (
                    <View style={[styles.thumb, styles.thumbEmpty]}>
                        <Text style={styles.thumbEmoji}>🎪</Text>
                    </View>
                )}
                <View style={styles.cardBody}>
                    <View style={styles.titleRow}>
                        {p.badge ? (
                            <View style={[styles.badge, { backgroundColor: tc.isDark ? "rgba(127,29,29,0.4)" : "#fee2e2" }]}>
                                <Text style={[styles.badgeText, { color: tc.isDark ? "#fca5a5" : "#dc2626" }]}>{p.badge}</Text>
                            </View>
                        ) : null}
                        <Text style={[styles.name, { color: tc.text }]} numberOfLines={1}>
                            {p.name}
                        </Text>
                    </View>
                    {p.region ? <Text style={[styles.region, { color: tc.textMuted }]}>{p.region}</Text> : null}
                    <Text style={[styles.period, { color: tc.isDark ? "#99c08e" : "#5f8d57" }]}>{p.period}</Text>
                </View>
            </View>
            {p.courses.length > 0 ? (
                <View style={[styles.courses, { borderTopColor: tc.border }]}>
                    <Text style={[styles.coursesLabel, { color: tc.textMuted }]}>이 장소가 들어간 코스</Text>
                    <View style={styles.chips}>
                        {p.courses.map((c) => (
                            <Pressable
                                key={c.id}
                                onPress={() => router.push(`/courses/${c.id}` as any)}
                                style={[styles.chip, { backgroundColor: tc.isDark ? "rgba(255,255,255,0.1)" : "#f3f4f6" }]}
                            >
                                <Text style={[styles.chipText, { color: tc.isDark ? "#e5e7eb" : "#374151" }]}>{c.title}</Text>
                            </Pressable>
                        ))}
                    </View>
                </View>
            ) : null}
        </View>
    );
}

export default function PopupsScreen() {
    const tc = useThemeColors();
    const { t } = useLocale();
    const [data, setData] = useState<PopupList | null>(null);
    const [error, setError] = useState(false);
    const [refreshing, setRefreshing] = useState(false);

    const load = useCallback(async () => {
        try {
            setError(false);
            setData(await apiFetch<PopupList>("/api/popups"));
        } catch {
            setError(true);
        }
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    const onRefresh = async () => {
        setRefreshing(true);
        await load();
        setRefreshing(false);
    };

    const section = (title: string, items: PopupItem[], empty: string) => (
        <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: tc.text }]}>
                {title} ({items.length})
            </Text>
            {items.length === 0 ? (
                <Text style={[styles.empty, { color: tc.textMuted }]}>{empty}</Text>
            ) : (
                <View style={styles.list}>
                    {items.map((p) => (
                        <PopupCard key={p.id} p={p} tc={tc} />
                    ))}
                </View>
            )}
        </View>
    );

    return (
        <SafeAreaView style={[styles.safe, { backgroundColor: tc.bg }]} edges={["top", "left", "right"]}>
            <View style={[styles.header, { borderBottomColor: tc.border }]}>
                <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button">
                    <Ionicons name="chevron-back" size={24} color={tc.text} />
                </Pressable>
                <Text style={[styles.headerTitle, { color: tc.text }]} numberOfLines={1}>
                    {t("nav.popups")}
                </Text>
                <View style={{ width: 24 }} />
            </View>

            {!data && !error ? (
                <View style={styles.center}>
                    <ActivityIndicator color="#7FCC9F" />
                </View>
            ) : (
                <ScrollView
                    contentContainerStyle={styles.scroll}
                    showsVerticalScrollIndicator={false}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                >
                    <View style={[styles.hero, { backgroundColor: tc.isDark ? "#16241a" : "#e9f6ee" }]}>
                        <Text style={[styles.heroTitle, { color: tc.text }]}>팝업·전시 모음</Text>
                        <Text style={[styles.heroSub, { color: tc.textMuted }]}>지금 진행 중인 곳과 2주 안에 시작하는 곳이에요.</Text>
                    </View>
                    {error ? (
                        <Pressable onPress={load} style={styles.retry}>
                            <Text style={[styles.empty, { color: tc.textMuted }]}>불러오지 못했어요. 눌러서 다시 시도</Text>
                        </Pressable>
                    ) : (
                        <>
                            {section("진행 중", data!.ongoing, "지금 진행 중인 팝업이 없어요")}
                            {section("곧 시작", data!.upcoming, "2주 안에 시작하는 팝업이 없어요")}
                        </>
                    )}
                </ScrollView>
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safe: { flex: 1 },
    header: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    headerTitle: { flex: 1, fontSize: 17, fontWeight: "700", textAlign: "center" },
    center: { flex: 1, alignItems: "center", justifyContent: "center" },
    scroll: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 40 },
    hero: { borderRadius: 24, paddingHorizontal: 24, paddingVertical: 28, alignItems: "center", marginBottom: 32 },
    heroTitle: { fontSize: 24, fontWeight: "700", marginBottom: 8 },
    heroSub: { fontSize: 14, textAlign: "center" },
    section: { marginBottom: 40 },
    sectionTitle: { fontSize: 18, fontWeight: "700", marginBottom: 12 },
    empty: { fontSize: 14 },
    retry: { paddingVertical: 12 },
    list: { gap: 12 },
    card: { borderRadius: 16, borderWidth: 1, overflow: "hidden" },
    cardTop: { flexDirection: "row", gap: 12, padding: 12 },
    thumb: { width: 80, height: 80, borderRadius: 12 },
    thumbEmpty: { backgroundColor: "rgba(127,204,159,0.15)", alignItems: "center", justifyContent: "center" },
    thumbEmoji: { fontSize: 30 },
    cardBody: { flex: 1, minWidth: 0 },
    titleRow: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" },
    badge: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
    badgeText: { fontSize: 11, fontWeight: "700" },
    name: { fontSize: 14, fontWeight: "600", flexShrink: 1 },
    region: { fontSize: 12, marginTop: 2 },
    period: { fontSize: 12, fontWeight: "500", marginTop: 2 },
    courses: { borderTopWidth: 1, paddingHorizontal: 12, paddingVertical: 8 },
    coursesLabel: { fontSize: 11, marginBottom: 4 },
    chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
    chip: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
    chipText: { fontSize: 12 },
});
