import React, { useCallback } from "react";
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
} from "react-native";
import { Image } from "expo-image";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { useThemeColors } from "../hooks/useThemeColors";
import { useLocale } from "../lib/useLocale";
import { useAuth } from "../hooks/useAuth";
import { useModal } from "../lib/modalContext";
import { resolveImageUrl } from "../lib/imageUrl";
import { pickCourseTitle } from "../lib/courseLocalized";
import { formatViewsCompact } from "../lib/localeUtils";
import {
    translateCourseRegion,
    translateCourseConcept,
    translateDuration,
    type CourseUiLocale,
} from "../../../src/lib/courseTranslate";
import type { LocalePreference } from "../lib/appSettingsStorage";

export type CourseCardCourse = {
    id: string | number;
    title: string;
    title_en?: string | null;
    title_ja?: string | null;
    title_zh?: string | null;
    imageUrl?: string | null;
    grade?: string;
    isLocked?: boolean;
    duration?: string | null;
    location?: string | null;
    region?: string | null;
    concept?: string | null;
    coursePlaces?: any[];
    placesCount?: number;
    viewCount?: number;
    reviewCount?: number;
    rating?: number;
};

export default function CourseCard({
    course,
    isFav = false,
    onFavToggle,
}: {
    course: CourseCardCourse;
    isFav?: boolean;
    onFavToggle?: (id: number) => void;
}) {
    const t = useThemeColors();
    const { t: lt, locale } = useLocale();
    const { isAuthenticated } = useAuth();
    const { openModal } = useModal();

    const isLocked = !!course.isLocked;
    const isNew = (course as any).reviewCount === 0;
    const placesCount = course.placesCount ?? course.coursePlaces?.length ?? 0;
    const views = Number((course as any).viewCount ?? 0);
    const reviewCount = Number((course as any).reviewCount ?? 0);
    const rating = Number((course as any).rating ?? 0);
    const hasReservation = !!course.coursePlaces?.some((cp: any) => cp?.place?.reservationUrl);

    const infoLine =
        views >= 1000
            ? lt("courses.viewsWatching", { compact: formatViewsCompact(views, locale) })
            : reviewCount > 0
              ? `★ ${rating.toFixed(1)} (${reviewCount})`
              : null;

    // "c-123" → "123" 형태의 ID 정규화
    const cleanId = String(course.id).replace(/^c-/, "");

    const handlePress = useCallback(() => {
        if (isLocked) {
            if (!isAuthenticated) {
                openModal("login");
                return;
            }
            openModal("ticket", {
                context: "COURSE",
                courseId: Number(cleanId),
                courseGrade: (course.grade ?? "BASIC") as "BASIC" | "PREMIUM",
            });
            return;
        }
        router.push(`/courses/${cleanId}` as any);
    }, [isLocked, isAuthenticated, cleanId, course.grade]);

    const gradeLabel =
        course.grade === "BASIC"
            ? lt("courseLockOverlay.basic")
            : lt("courseLockOverlay.premium");
    const lockLabel = lt("courseLockOverlay.gradeOnly", { grade: gradeLabel });

    return (
        <TouchableOpacity style={s.card} onPress={handlePress} activeOpacity={0.88}>
            {/* 이미지 영역 */}
            <View style={[s.cardImgWrap, { borderColor: t.isDark ? "transparent" : "#f3f4f6" }]}>
                {course.imageUrl ? (
                    <Image
                        source={{ uri: resolveImageUrl(course.imageUrl) }}
                        style={s.cardImg}
                        fadeDuration={0}
                        blurRadius={isLocked ? 3 : 0}
                    />
                ) : (
                    <View style={[s.cardImg, { backgroundColor: "#e5e7eb", alignItems: "center", justifyContent: "center" }]}>
                        <Text style={{ color: "#9ca3af", fontSize: 12 }}>DoNa</Text>
                    </View>
                )}

                {/* 잠금 오버레이 */}
                {isLocked && (
                    <View style={s.lockOverlay} pointerEvents="none">
                        <View style={s.lockIconWrap}>
                            <Ionicons name="lock-closed" size={28} color="#fff" />
                        </View>
                        <View style={s.lockBadge}>
                            <Text style={s.lockBadgeText}>{lockLabel}</Text>
                        </View>
                    </View>
                )}

                {/* 그라데이션 오버레이 */}
                <View style={s.imgGradient} pointerEvents="none" />

                {/* 배지 (상단 좌측) */}
                <View style={s.badges} pointerEvents="none">
                    {hasReservation && (
                        <View style={s.reserveBadge}>
                            <Text style={s.reserveBadgeText}>{lt("courses.badgeReservable")}</Text>
                        </View>
                    )}
                    {course.concept && (
                        <View style={s.conceptBadge}>
                            <Text style={s.conceptBadgeText}>
                                #{translateCourseConcept(course.concept, lt)}
                            </Text>
                        </View>
                    )}
                    {isNew && !isLocked && (
                        <View style={s.newBadge}>
                            <Text style={s.newBadgeText}>{lt("courses.badgeNew")}</Text>
                        </View>
                    )}
                </View>

                {/* 찜 버튼 (상단 우측) */}
                {onFavToggle && (
                    <TouchableOpacity
                        style={s.favBtn}
                        onPress={() => onFavToggle(Number(cleanId))}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                        <Ionicons
                            name={isFav ? "heart" : "heart-outline"}
                            size={22}
                            color={isFav ? "#ef4444" : "#ffffff"}
                        />
                    </TouchableOpacity>
                )}
            </View>

            {/* 정보 영역 */}
            <View style={s.cardBody}>
                <Text style={[s.cardTitle, { color: t.text }]} numberOfLines={2}>
                    {pickCourseTitle(course as any, locale as LocalePreference) || course.title}
                </Text>
                <View style={s.metaRow}>
                    {(course.location || course.region) && (
                        <Text style={[s.metaText, { color: t.textMuted }]}>
                            📍 {translateCourseRegion(String(course.location ?? course.region ?? ""), lt)}
                        </Text>
                    )}
                    {(course.location || course.region) && placesCount > 0 && (
                        <View style={[s.metaDot, { backgroundColor: t.textMuted }]} />
                    )}
                    {placesCount > 0 && (
                        <Text style={[s.metaText, { color: t.textMuted }]}>
                            {lt("courses.metaSpots", { count: placesCount, spots: lt("courseDetail.spots") })}
                        </Text>
                    )}
                    {placesCount > 0 && course.duration && (
                        <View style={[s.metaDot, { backgroundColor: t.textMuted }]} />
                    )}
                    {course.duration && (
                        <Text style={[s.metaText, { color: t.textMuted }]}>
                            ⏳ {translateDuration(course.duration, locale as CourseUiLocale)}
                        </Text>
                    )}
                </View>
                {infoLine && (
                    <Text style={[s.infoLine, { color: t.textMuted }]} numberOfLines={1}>
                        {infoLine}
                    </Text>
                )}
            </View>
        </TouchableOpacity>
    );
}

const s = StyleSheet.create({
    card:        { marginHorizontal: 8, marginBottom: 24 },
    cardImgWrap: {
        position: "relative", aspectRatio: 4 / 3, borderRadius: 20,
        overflow: "hidden", backgroundColor: "#e5e7eb", marginBottom: 10,
    },
    cardImg:     { width: "100%", height: "100%", resizeMode: "cover" } as any,
    imgGradient: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.08)" },
    badges:      { position: "absolute", top: 12, left: 12, flexDirection: "row", flexWrap: "wrap", gap: 4 },
    reserveBadge:     { backgroundColor: "#059669", borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3 },
    reserveBadgeText: { color: "#fff", fontSize: 10, fontWeight: "500" },
    conceptBadge:     { backgroundColor: "#111827", borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3, borderWidth: 1, borderColor: "#374151" },
    conceptBadgeText: { color: "#fff", fontSize: 10, fontWeight: "500" },
    newBadge:         { backgroundColor: "#7aa06f", borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3 },
    newBadgeText:     { color: "#fff", fontSize: 10, fontWeight: "500" },
    lockOverlay: {
        position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: "rgba(0,0,0,0.45)", alignItems: "center", justifyContent: "center", zIndex: 10,
    },
    lockIconWrap: { backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 40, padding: 12, marginBottom: 8 },
    lockBadge:    { backgroundColor: "rgba(0,0,0,0.6)", borderRadius: 20, paddingHorizontal: 14, paddingVertical: 5, borderWidth: 1, borderColor: "rgba(255,255,255,0.2)" },
    lockBadgeText:{ color: "#fff", fontSize: 12, fontWeight: "700", letterSpacing: -0.3 },
    favBtn: {
        position: "absolute", top: 12, right: 12, width: 44, height: 44, borderRadius: 22,
        backgroundColor: "#111827", borderWidth: 1, borderColor: "#374151",
        alignItems: "center", justifyContent: "center",
    },
    cardBody:  { paddingHorizontal: 4 },
    cardTitle: { fontSize: 17, fontWeight: "400", color: "#111827", lineHeight: 24, marginBottom: 6, letterSpacing: 0 },
    metaRow:   { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 4 },
    metaText:  { fontSize: 12, color: "#6b7280", fontWeight: "500" },
    metaDot:   { width: 3, height: 3, borderRadius: 1.5, backgroundColor: "#9ca3af" },
    infoLine:  { fontSize: 12, marginTop: 2 },
});
