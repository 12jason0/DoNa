import React, { useState, useRef } from "react";
import {
    View,
    Text,
    Modal,
    Pressable,
    TouchableOpacity,
    StyleSheet,
    FlatList,
    Image,
    Animated,
    PanResponder,
} from "react-native";
import { router } from "expo-router";
import { useThemeColors } from "../hooks/useThemeColors";
import { useLocale } from "../lib/useLocale";
import { useModal } from "../lib/modalContext";
import { resolveImageUrl } from "../lib/imageUrl";
import { pickCourseTitle } from "../lib/courseLocalized";
import {
    translateCourseRegion,
    translateCourseTagLabel,
} from "../../../src/lib/courseTranslate";
import type { Course } from "../types/api";
import type { LocalePreference } from "../lib/appSettingsStorage";

function getTodayDayType(): "today" | "weekend" {
    const kst = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
    return kst.getDay() === 0 || kst.getDay() === 6 ? "weekend" : "today";
}

function MoreCourseCard({
    course,
    onPress,
    locale,
}: {
    course: Course;
    onPress: () => void;
    locale: LocalePreference;
}) {
    const { t: i18n } = useLocale();
    const imageUri = resolveImageUrl(course.imageUrl ?? course.coursePlaces?.[0]?.place?.imageUrl);
    const tags = (Array.isArray(course.tags) ? course.tags : []).slice(0, 3);
    const displayTitle = pickCourseTitle(course, locale) || course.title;
    const regionLabel = course.region ? translateCourseRegion(course.region, i18n) : "";
    return (
        <TouchableOpacity style={s.moreCard} activeOpacity={0.88} onPress={onPress}>
            <View style={s.moreCardImgWrap}>
                {imageUri ? (
                    <Image source={{ uri: imageUri }} style={s.moreCardImg} resizeMode="cover" />
                ) : (
                    <View style={[s.moreCardImg, { backgroundColor: "#e5e7eb", alignItems: "center", justifyContent: "center" }]}>
                        <Text style={{ fontSize: 24 }}>🗺️</Text>
                    </View>
                )}
                <View style={s.moreCardOverlay} />
                <View style={s.moreCardTextWrap}>
                    <Text style={s.moreCardTitle} numberOfLines={2}>{displayTitle}</Text>
                    {regionLabel ? <Text style={s.moreCardRegion}>{regionLabel}</Text> : null}
                    {tags.length > 0 && (
                        <View style={s.moreCardTagRow}>
                            {tags.map((tag, i) => (
                                <View key={i} style={s.moreCardTagPill}>
                                    <Text style={s.moreCardTagText}>#{translateCourseTagLabel(String(tag), i18n)}</Text>
                                </View>
                            ))}
                        </View>
                    )}
                </View>
            </View>
        </TouchableOpacity>
    );
}

export default function MoreCoursesSheet() {
    const { isOpen, closeModal, getData } = useModal();
    const visible = isOpen("moreCourses");
    const data = getData("moreCourses");
    const t = useThemeColors();
    const { t: i18n } = useLocale();
    const [activeTab, setActiveTab] = useState<"today" | "weekend">(data?.initialTab ?? getTodayDayType());
    const translateY = useRef(new Animated.Value(0)).current;

    const onClose = () => closeModal("moreCourses");

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

    if (!visible || !data) return null;

    const { todayCourses, weekendCourses, locale } = data;
    const displayCourses = activeTab === "today" ? todayCourses : weekendCourses;

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} hardwareAccelerated>
            {/* 배경 딤 + dismiss 영역 */}
            <Pressable style={[StyleSheet.absoluteFillObject, { backgroundColor: "rgba(0,0,0,0.82)" }]} onPress={onClose} />
            {/* 시트 — Pressable 뒤에 렌더링되어 터치 우선순위 가짐 */}
            <Animated.View style={[s.sheet, { backgroundColor: t.card, transform: [{ translateY }] }]}>
                <View {...panResponder.panHandlers} style={s.sheetHandle}>
                    <View style={[s.sheetHandleBar, { backgroundColor: t.isDark ? "#374151" : "#e5e7eb" }]} />
                </View>

                <Text style={[s.sheetTitle, { color: t.text }]}>{i18n("personalized.viewMore")}</Text>

                <View style={s.sheetTabRow}>
                    <TouchableOpacity
                        style={[s.sheetTab, activeTab === "today" && s.sheetTabActive]}
                        onPress={() => setActiveTab("today")}
                    >
                        <Text style={[s.sheetTabText, activeTab === "today" && s.sheetTabTextActive]}>
                            {i18n("personalized.today")}
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[s.sheetTab, activeTab === "weekend" && s.sheetTabActive]}
                        onPress={() => setActiveTab("weekend")}
                    >
                        <Text style={[s.sheetTabText, activeTab === "weekend" && s.sheetTabTextActive]}>
                            {i18n("personalized.weekend")}
                        </Text>
                    </TouchableOpacity>
                </View>

                <FlatList
                    data={displayCourses}
                    keyExtractor={(item) => String(item.id)}
                    renderItem={({ item }) => (
                        <MoreCourseCard
                            course={item}
                            locale={locale as LocalePreference}
                            onPress={() => {
                                onClose();
                                router.push(`/courses/${item.id}` as any);
                            }}
                        />
                    )}
                    contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40, paddingTop: 4 }}
                    showsVerticalScrollIndicator={false}
                    ListEmptyComponent={
                        <View style={s.emptyWrap}>
                            <Text style={[s.emptyText, { color: t.textMuted }]}>
                                {i18n("personalized.loadingToday")}
                            </Text>
                        </View>
                    }
                />
            </Animated.View>
        </Modal>
    );
}

const s = StyleSheet.create({
    sheetOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.82)", justifyContent: "flex-end" }, // unused but kept for safety
    sheet: { position: "absolute", bottom: 0, left: 0, right: 0, borderTopLeftRadius: 28, borderTopRightRadius: 28, height: "80%" },
    sheetHandle: { alignItems: "center", paddingTop: 12, paddingBottom: 8 },
    sheetHandleBar: { width: 40, height: 6, borderRadius: 3, backgroundColor: "#e5e7eb" },
    sheetTitle: { fontSize: 17, fontWeight: "700", paddingHorizontal: 16, paddingBottom: 12 },
    sheetTabRow: { flexDirection: "row", gap: 8, paddingHorizontal: 16, paddingBottom: 12 },
    sheetTab: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999, backgroundColor: "#f3f4f6" },
    sheetTabActive: { backgroundColor: "#059669" },
    sheetTabText: { fontSize: 14, fontWeight: "500", color: "#6b7280" },
    sheetTabTextActive: { color: "#fff" },
    moreCard: { marginBottom: 12, borderRadius: 12, overflow: "hidden", backgroundColor: "#e5e7eb" },
    moreCardImgWrap: { position: "relative", width: "100%", aspectRatio: 16 / 9 },
    moreCardImg: { width: "100%", height: "100%" },
    moreCardOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.28)" },
    moreCardTextWrap: { position: "absolute", bottom: 12, left: 12, right: 12 },
    moreCardTitle: { fontSize: 15, fontWeight: "500", color: "#fff", lineHeight: 20 },
    moreCardRegion: { fontSize: 12, color: "rgba(255,255,255,0.7)", marginTop: 2 },
    moreCardTagRow: { flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 6 },
    moreCardTagPill: { backgroundColor: "rgba(255,255,255,0.2)", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
    moreCardTagText: { fontSize: 11, fontWeight: "500", color: "#fff" },
    emptyWrap: { height: 120, alignItems: "center", justifyContent: "center" },
    emptyText: { fontSize: 14 },
});
