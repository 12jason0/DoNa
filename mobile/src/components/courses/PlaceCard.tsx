import React, { useCallback } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Image } from "expo-image";
import { Colors } from "../../constants/theme";
import { useThemeColors } from "../../hooks/useThemeColors";
import { useLocale } from "../../lib/useLocale";
import { getPlaceStatus } from "../../../../src/lib/placeStatus";
import { placeStatusTranslationKey } from "../../../../src/lib/placeStatusUi";
import { parseTipsFromDbForLocale } from "../../../../src/types/tip";
import {
    translateCourseFreeformKoText,
    translatePlaceCategory,
    type CourseUiLocale,
} from "../../../../src/lib/courseTranslate";
import { pickPlaceName, pickPlaceAddress } from "../../lib/courseLocalized";
import type { LocalePreference } from "../../lib/appSettingsStorage";
import type { CoursePlace } from "./types";
import { PLACE_OPEN_BADGE_RN } from "./constants";
import { getPlaceImageUrl, getPlaceReservationUrl, closedDaysForPlaceStatus, isPlaceClosedForReserve } from "./utils";

export const PlaceCard = React.memo(function PlaceCard({
    cp,
    index,
    onPress,
    onInfoPress,
    isSelected,
    onReserve,
    showConfirmed,
    tipLocked,
    onTipLockPress,
}: {
    cp: CoursePlace;
    index: number;
    onPress: (cp: CoursePlace) => void;
    onInfoPress?: (cp: CoursePlace) => void;
    isSelected: boolean;
    onReserve: (url: string) => void;
    showConfirmed?: boolean;
    tipLocked?: boolean;
    onTipLockPress?: () => void;
}) {

    const t = useThemeColors();
    const { t: i18n, locale } = useLocale();
    const p = cp.place;

    const handlePress = useCallback(() => onPress(cp), [onPress, cp]);

    if (!p) return null;

    const placeStatusInfo = getPlaceStatus(p.opening_hours, closedDaysForPlaceStatus(p.closed_days));
    const imageUri = getPlaceImageUrl(p);
    const rec = cp.recommended_time?.trim();
    const subText = rec
        ? translateCourseFreeformKoText(rec, locale as CourseUiLocale, i18n)
        : pickPlaceAddress(p, locale as LocalePreference) || null;
    const tipsRow = {
        tips: cp.tips,
        tips_en: cp.tips_en,
        tips_ja: cp.tips_ja,
        tips_zh: cp.tips_zh,
    };
    const hasTips = parseTipsFromDbForLocale(tipsRow, locale as CourseUiLocale).length > 0;

    return (
        // 웹: [number circle (외부)] [flex-1 content]
        <View style={s.placeRow}>
            {/* 번호 (웹과 동일: 카드 바깥 왼쪽) */}
            <View style={s.placeNum}>
                <Text style={s.placeNumText}>{index + 1}</Text>
            </View>

            {/* 카드 (웹: bg-white/95 rounded-xl p-4 border) */}
            <TouchableOpacity
                style={[
                    s.placeCard,
                    {
                        borderColor: isSelected ? "#22c55e" : t.isDark ? "rgba(55,65,81,0.4)" : "rgba(255,255,255,0.4)",
                        borderWidth: isSelected ? 2 : 1,
                        backgroundColor: isSelected
                            ? (t.isDark ? "rgba(34,197,94,0.18)" : "rgba(240,253,244,0.95)")
                            : (t.isDark ? "rgba(26,36,27,0.98)" : "rgba(255,255,255,0.95)"),
                    },
                ]}
                onPress={handlePress}
                activeOpacity={0.85}
            >
                <View style={s.placeCardRow}>
                    {/* 썸네일 (웹: w-20 h-20 = 80px) */}
                    {imageUri ? (
                        <Image source={{ uri: imageUri }} style={s.placeThumb} contentFit="cover" />
                    ) : (
                        <View
                            style={[
                                s.placeThumb,
                                { backgroundColor: t.surface, alignItems: "center", justifyContent: "center" },
                            ]}
                        >
                            <Text style={{ fontSize: 20 }}>📍</Text>
                        </View>
                    )}

                    <View style={{ flex: 1, minWidth: 0, justifyContent: "center" }}>
                        {/* 카테고리 · 영업 (웹: text-[10px] font-bold text-gray-400 uppercase) */}
                        <View style={s.placeBadgeRow}>
                            {p.category ? (
                                <Text style={[s.catText, { color: t.textMuted }]}>{translatePlaceCategory(p.category, locale as CourseUiLocale).toUpperCase()}</Text>
                            ) : null}
                            <View
                                style={[
                                    s.statusBadge,
                                    { backgroundColor: PLACE_OPEN_BADGE_RN[placeStatusInfo.status].bg },
                                ]}
                            >
                                <Text
                                    style={[
                                        s.statusBadgeText,
                                        { color: PLACE_OPEN_BADGE_RN[placeStatusInfo.status].text },
                                    ]}
                                >
                                    {i18n(placeStatusTranslationKey(placeStatusInfo.status))}
                                </Text>
                            </View>
                        </View>

                        {/* 이름 (웹: font-bold text-sm) */}
                        <Text style={[s.placeName, { color: t.text }]} numberOfLines={1}>
                            {pickPlaceName(p, locale as LocalePreference)}
                        </Text>

                        {/* 주소 or 추천시간 (웹: text-xs text-gray-500) */}
                        {subText ? (
                            <Text style={[s.placeSubText, { color: t.textMuted }]} numberOfLines={1}>
                                {subText}
                            </Text>
                        ) : null}

                        {/* 확인됨 배지 (선택형 코스 fixed 장소) */}
                        {showConfirmed && (
                            <View style={s.confirmedBadge}>
                                <Text style={s.confirmedBadgeText}>✓ {i18n("courseDetail.confirmed")}</Text>
                            </View>
                        )}

                        {/* 예약 버튼 (웹: inline-flex bg-emerald-500 text-white text-[11px] px-3 py-1.5) */}
                        {getPlaceReservationUrl(p) ? (
                            <TouchableOpacity
                                style={s.reserveBtn}
                                onPress={(e) => {
                                    e.stopPropagation();
                                    const url = getPlaceReservationUrl(p);
                                    if (url) onReserve(url);
                                }}
                                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                            >
                                <View style={s.reserveBtnInner}>
                                    <Text style={s.reserveBtnText}>
                                        {isPlaceClosedForReserve(placeStatusInfo.status)
                                            ? i18n("courses.reserveInAdvance")
                                            : i18n("courses.reserve")}
                                    </Text>
                                </View>
                            </TouchableOpacity>
                        ) : null}
                    </View>
                </View>

                {/* 꿀팁 (웹: ✨ 꿀팁 헤더 + 카테고리 칩) */}
                {hasTips ? (
                    <TouchableOpacity
                        style={s.tipRow}
                        onPress={() => onInfoPress?.(cp)}
                        hitSlop={6}
                        activeOpacity={0.7}
                    >
                        <Text style={s.tipLabel}>{i18n("mobile.courseScreen.tipSectionLabel")}</Text>
                        <View style={s.tipChip}>
                            <Text style={s.tipChipText}>{i18n("mobile.courseScreen.tipViewInfo")}</Text>
                        </View>
                    </TouchableOpacity>
                ) : tipLocked ? (
                    <TouchableOpacity
                        style={s.tipLockedRow}
                        onPress={onTipLockPress}
                        hitSlop={6}
                        activeOpacity={0.7}
                    >
                        <Text style={s.tipLockedIcon}>🔒</Text>
                        <Text style={s.tipLockedLabel}>{i18n("mobile.courseScreen.tipLockedLabel")}</Text>
                        <View style={s.tipLockedBtn}>
                            <Text style={s.tipLockedBtnText}>{i18n("mobile.courseScreen.tipLockedBtn")}</Text>
                        </View>
                    </TouchableOpacity>
                ) : null}
            </TouchableOpacity>
        </View>
    );
});

const s = StyleSheet.create({
    placeRow: { flexDirection: "row", gap: 16, marginBottom: 0, alignItems: "flex-start" },
    placeCard: {
        flex: 1,
        borderRadius: 12,
        borderWidth: 1,
        paddingVertical: 16,
        paddingHorizontal: 16,
    },
    placeCardRow: { flexDirection: "row", alignItems: "flex-start", gap: 16 },
    placeNum: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: Colors.brandGreenLight,
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        marginTop: 16, // 카드 padding과 맞춤
    },
    placeNumText: { color: "#fff", fontSize: 14, fontWeight: "500" },
    placeName: { fontSize: 14, fontWeight: "500", marginBottom: 2 },
    placeSubText: { fontSize: 12, marginBottom: 6 },
    placeBadgeRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 6, marginBottom: 4 },
    catText: { fontSize: 10, fontWeight: "500", letterSpacing: 0.3 },
    statusBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
    statusBadgeText: { fontSize: 10, fontWeight: "500" },
    reserveBtn: { alignSelf: "flex-start", marginTop: 4 },
    reserveBtnInner: {
        backgroundColor: "#10b981",
        borderRadius: 6,
        paddingHorizontal: 12,
        paddingVertical: 6,
    },
    reserveBtnText: { fontSize: 11, color: "#fff", fontWeight: "500" },
    placeThumb: { width: 80, height: 80, borderRadius: 8, flexShrink: 0 },
    tipRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 10, flexWrap: "wrap" },
    tipLabel: { fontSize: 11, fontWeight: "500", color: "#4b5563" },
    tipChip: {
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
        backgroundColor: "#f3f4f6",
        borderWidth: 1,
        borderColor: "#d1fae5",
    },
    tipChipText: { fontSize: 11, fontWeight: "500", color: "#059669" },
    tipLockedRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 10, backgroundColor: "#f9fafb", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7, borderWidth: 1, borderColor: "#e5e7eb" },
    tipLockedIcon: { fontSize: 11 },
    tipLockedLabel: { flex: 1, fontSize: 11, color: "#6b7280" },
    tipLockedBtn: { backgroundColor: "#10b981", borderRadius: 5, paddingHorizontal: 8, paddingVertical: 3 },
    tipLockedBtnText: { fontSize: 11, fontWeight: "600", color: "#fff" },
    confirmedBadge: {
        flexDirection: "row", alignItems: "center",
        alignSelf: "flex-start",
        marginTop: 6,
        paddingHorizontal: 8, paddingVertical: 3,
        borderRadius: 20, backgroundColor: "#dcfce7",
    },
    confirmedBadgeText: { fontSize: 11, fontWeight: "500", color: "#16a34a" },
});
