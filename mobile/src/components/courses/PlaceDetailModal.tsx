import React, { useState, useCallback, useRef, useMemo } from "react";
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    Image,
    TouchableOpacity,
    ActivityIndicator,
    Linking,
    Modal,
    Pressable,
    Animated,
    PanResponder,
    Dimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { WebView } from "react-native-webview";
import Svg, { Path } from "react-native-svg";
import { router } from "expo-router";
import { useThemeColors } from "../../hooks/useThemeColors";
import { useLocale } from "../../lib/useLocale";
import { floatingTabBarBottomReserve } from "../../constants/floatingTabBarInset";
import { MODAL_ANDROID_PROPS } from "../../constants/modalAndroidProps";
import { getPlaceStatus } from "../../../../src/lib/placeStatus";
import { placeStatusTranslationKey } from "../../../../src/lib/placeStatusUi";
import { parseTipsFromDbForLocale } from "../../../../src/types/tip";
import type { CoursePlaceTipsRow } from "../../../../src/types/tip";
import { localizeParsedTipsForUi, type CourseUiLocale } from "../../../../src/lib/courseTranslate";
import { pickPlaceName, pickPlaceAddress, pickPlaceDescription } from "../../lib/courseLocalized";
import type { LocalePreference } from "../../lib/appSettingsStorage";
import type { PlaceData } from "./types";
import { PLACE_OPEN_BADGE_RN } from "./constants";
import { getPlaceImageUrl, getPlaceReservationUrl, closedDaysForPlaceStatus, isPlaceClosedForReserve } from "./utils";
import { TipCategoryIcon } from "./TipCategoryIcon";

export function PlaceDetailModal({
    place,
    tipsRow,
    onClose,
    isLoggedIn,
    tipLocked,
    onTipLockPress,
}: {
    place: PlaceData;
    tipsRow: CoursePlaceTipsRow;
    onClose: () => void;
    isLoggedIn: boolean;
    tipLocked?: boolean;
    onTipLockPress?: () => void;
}) {
    const t = useThemeColors();
    const insets = useSafeAreaInsets();
    const tabBarReserve = floatingTabBarBottomReserve(insets.bottom);
    const { t: i18n, locale } = useLocale();
    const [reservationWebUrl, setReservationWebUrl] = useState<string | null>(null);
    const imageUri = getPlaceImageUrl(place);
    const reservationUrl = getPlaceReservationUrl(place);
    const placeStatusInfo = getPlaceStatus(place.opening_hours, closedDaysForPlaceStatus(place.closed_days));
    const tipItems = useMemo(() => {
        const base = parseTipsFromDbForLocale(tipsRow, locale as CourseUiLocale);
        return localizeParsedTipsForUi(base, locale as CourseUiLocale, i18n);
    }, [tipsRow, locale, i18n]);
    const hasTips = tipItems.length > 0;
    const screenH = Dimensions.get("window").height;
    const translateY = useRef(new Animated.Value(0)).current;

    const dismissWithSwipe = useCallback(() => {
        Animated.timing(translateY, {
            toValue: screenH,
            duration: 220,
            useNativeDriver: true,
        }).start(() => {
                onClose();
        });
    }, [onClose, screenH, translateY]);

    const imagePanResponder = useMemo(
        () =>
            PanResponder.create({
                onStartShouldSetPanResponder: () => true,
                onMoveShouldSetPanResponder: (_, g) =>
                    g.dy > 8 && g.dy > Math.abs(g.dx),
                onPanResponderMove: (_, g) => {
                    if (g.dy > 0) {
                        translateY.setValue(g.dy);
                    }
                },
                onPanResponderRelease: (_, g) => {
                    if (g.dy > 110 || g.vy > 1.0) {
                        dismissWithSwipe();
                    } else {
                        Animated.spring(translateY, {
                            toValue: 0,
                            useNativeDriver: true,
                            friction: 9,
                            tension: 80,
                        }).start();
                    }
                },
                onPanResponderTerminate: () => {
                    Animated.spring(translateY, {
                        toValue: 0,
                        useNativeDriver: true,
                        friction: 9,
                        tension: 80,
                    }).start();
                },
            }),
        [dismissWithSwipe, translateY],
    );

    return (
        <Modal visible transparent animationType="slide" onRequestClose={onClose} {...MODAL_ANDROID_PROPS}>
            <View style={s.placeModalOverlay}>
                <Pressable style={StyleSheet.absoluteFillObject} onPress={onClose} />
                <Animated.View
                    style={[
                        s.placeModalSheet,
                        {
                            backgroundColor: t.card,
                            borderColor: t.isDark ? "#374151" : "#f3f4f6",
                            height: screenH * 0.80,
                            transform: [{ translateY }],
                        },
                    ]}
                >
                    {/* 이미지·핸들 영역: 아래로 드래그 시 시트 닫기 · 텍스트는 ScrollView에서만 스크롤 */}
                    <View
                        style={[s.detailImgWrap, { flexShrink: 0 }]}
                        collapsable={false}
                        {...imagePanResponder.panHandlers}
                    >
                        {imageUri ? (
                            <Image source={{ uri: imageUri }} style={s.detailImgWeb} resizeMode="cover" />
                        ) : (
                            <View
                                style={[
                                    s.detailImgWeb,
                                    { backgroundColor: t.surface, alignItems: "center", justifyContent: "center" },
                                ]}
                            >
                                <Text style={{ fontSize: 40 }}>📍</Text>
                            </View>
                        )}
                        <View style={s.detailImgGradient} pointerEvents="none">
                            <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0)" }} />
                            <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.12)" }} />
                            <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.28)" }} />
                            <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)" }} />
                        </View>
                        <View style={s.detailHandleOnImg}>
                            <View style={s.detailHandleBarWeb} />
                        </View>
                        <View style={s.detailImgOverlayWeb} pointerEvents="none">
                            <Text style={s.detailImgNameWeb} numberOfLines={2}>
                                {pickPlaceName(place, locale as LocalePreference)}
                            </Text>
                        </View>
                    </View>

                    <ScrollView
                        style={{ flex: 1 }}
                        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: Math.max(24, insets.bottom) }}
                        showsVerticalScrollIndicator={false}
                        nestedScrollEnabled
                        bounces
                        keyboardShouldPersistTaps="handled"
                    >
                        <Text style={[s.detailScrollTitle, { color: t.text }]}>{pickPlaceName(place, locale as LocalePreference)}</Text>

                        <View style={{ marginBottom: 10 }}>
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                                <View
                                    style={[
                                        s.detailStatusBadge,
                                        { backgroundColor: PLACE_OPEN_BADGE_RN[placeStatusInfo.status].bg },
                                    ]}
                                >
                                    <Text
                                        style={[
                                            s.detailStatusText,
                                            { color: PLACE_OPEN_BADGE_RN[placeStatusInfo.status].text },
                                        ]}
                                    >
                                        {i18n(placeStatusTranslationKey(placeStatusInfo.status))}
                                    </Text>
                                </View>
                                {place.opening_hours ? (
                                    <Text style={[s.detailHoursText, { color: t.textMuted }]} numberOfLines={1}>
                                        {place.opening_hours}
                                    </Text>
                                ) : null}
                            </View>
                        </View>

                        {place.address ? (
                            <Text style={[s.detailAddressWeb, { color: t.textMuted }]} numberOfLines={2}>
                                {pickPlaceAddress(place, locale as LocalePreference)}
                            </Text>
                        ) : null}

                        <Text style={[s.detailDescWeb, { color: t.isDark ? "#d1d5db" : "#4b5563" }]}>
                            {pickPlaceDescription(place, locale as LocalePreference) || i18n("courseDetail.noDescription")}
                        </Text>

                        {isLoggedIn && hasTips ? (
                            <View
                                style={[
                                    s.placeTipSection,
                                    {
                                        backgroundColor: t.isDark ? "rgba(6,78,59,0.2)" : "#ecfdf5",
                                        borderColor: t.isDark ? "#065f46" : "#a7f3d0",
                                    },
                                ]}
                            >
                                {/* 헤더 */}
                                <View style={{ flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 10 }}>
                                    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={t.isDark ? "#6ee7b7" : "#047857"} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                                        <Path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                                    </Svg>
                                    <Text style={[s.placeTipSectionLabel, { color: t.isDark ? "#6ee7b7" : "#047857", marginBottom: 0 }]}>
                                        Dona's Pick
                                    </Text>
                                </View>
                                {/* 팁 목록 */}
                                {tipItems.map((tip, i) => (
                                    <View key={i} style={{ flexDirection: "row", alignItems: "flex-start", gap: 8, marginBottom: i < tipItems.length - 1 ? 8 : 0 }}>
                                        <View style={{ marginTop: 1 }}>
                                            <TipCategoryIcon category={tip.category} color={t.isDark ? "#9ca3af" : "#4b5563"} />
                                        </View>
                                        <Text style={[s.placeTipSectionBody, { color: t.text, flex: 1 }]}>{tip.content}</Text>
                                    </View>
                                ))}
                            </View>
                        ) : isLoggedIn && tipLocked ? (
                            <TouchableOpacity
                                style={[s.detailTipBanner, { borderColor: t.border, backgroundColor: t.surface, marginHorizontal: 0 }]}
                                onPress={onTipLockPress}
                                activeOpacity={0.8}
                            >
                                <Ionicons name="lock-closed-outline" size={20} color={t.textMuted} />
                                <View style={{ flex: 1 }}>
                                    <Text style={[s.detailTipBannerTitle, { color: t.text }]}>
                                        {i18n("mobile.courseScreen.tipLockedLabel")}
                                    </Text>
                                    <Text style={[s.detailTipBannerSub, { color: t.textMuted }]}>
                                        {i18n("mobile.courseScreen.tipsLoginSub")}
                                    </Text>
                                </View>
                                <Ionicons name="chevron-forward" size={18} color={t.textMuted} />
                            </TouchableOpacity>
                        ) : null}

                        {!isLoggedIn ? (
                            <TouchableOpacity
                                style={[
                                    s.detailTipBanner,
                                    { borderColor: t.border, backgroundColor: t.surface, marginHorizontal: 0 },
                                ]}
                                onPress={() => {
                                    onClose();
                                    router.push("/(auth)/login" as any);
                                }}
                                activeOpacity={0.8}
                            >
                                <Ionicons name="lock-closed-outline" size={20} color={t.textMuted} />
                                <View style={{ flex: 1 }}>
                                    <Text style={[s.detailTipBannerTitle, { color: t.text }]}>
                                        {i18n("mobile.courseScreen.tipsLoginTitle")}
                                    </Text>
                                    <Text style={[s.detailTipBannerSub, { color: t.textMuted }]}>
                                        {i18n("mobile.courseScreen.tipsLoginSub")}
                                    </Text>
                                </View>
                                <Ionicons name="chevron-forward" size={18} color={t.textMuted} />
                            </TouchableOpacity>
                        ) : null}

                        {reservationUrl ? (
                            <TouchableOpacity
                                style={s.detailReserveBtnWeb}
                                onPress={() => setReservationWebUrl(reservationUrl)}
                                activeOpacity={0.9}
                            >
                                <Ionicons name="open-outline" size={18} color="#fff" />
                                <Text style={s.detailReserveBtnWebText}>
                                    {isPlaceClosedForReserve(placeStatusInfo.status)
                                        ? i18n("courses.reserveOtherDay")
                                        : i18n("courses.reserve")}
                                </Text>
                            </TouchableOpacity>
                        ) : null}

                        <TouchableOpacity style={s.detailCloseTextBtn} onPress={onClose} hitSlop={{ top: 8, bottom: 8 }}>
                            <Text style={[s.detailCloseTextWeb, { color: t.textMuted }]}>{i18n("courseDetail.justClose")}</Text>
                        </TouchableOpacity>
                    </ScrollView>

                    {/* 인앱 예약 WebView */}
                    {reservationWebUrl ? (
                        <View
                            style={[
                                StyleSheet.absoluteFillObject,
                                {
                                    backgroundColor: t.card,
                                    borderTopLeftRadius: 20,
                                    borderTopRightRadius: 20,
                                    overflow: "hidden",
                                },
                            ]}
                        >
                            <View style={[s.reserveWebHeader, { borderBottomColor: t.border, backgroundColor: t.card }]}>
                                <TouchableOpacity
                                    onPress={() => setReservationWebUrl(null)}
                                    hitSlop={10}
                                    style={s.reserveWebBackBtn}
                                >
                                    <Ionicons name="chevron-down" size={22} color={t.text} />
                                </TouchableOpacity>
                                <Text style={[s.reserveWebTitle, { color: t.text }]} numberOfLines={1}>
                                    {i18n("mobile.courseScreen.reserveWithName", { name: pickPlaceName(place, locale as LocalePreference) || i18n("mobile.courseScreen.placeFallback") })}
                                </Text>
                                <TouchableOpacity
                                    onPress={() => Linking.openURL(reservationWebUrl)}
                                    hitSlop={10}
                                    style={s.reserveWebBackBtn}
                                >
                                    <Ionicons name="open-outline" size={19} color={t.textMuted} />
                                </TouchableOpacity>
                            </View>
                            <WebView
                                source={{ uri: reservationWebUrl }}
                                style={{ flex: 1 }}
                                javaScriptEnabled
                                domStorageEnabled
                                allowsInlineMediaPlayback
                                startInLoadingState
                                renderLoading={() => (
                                    <View
                                        style={[
                                            StyleSheet.absoluteFillObject,
                                            { alignItems: "center", justifyContent: "center", backgroundColor: t.card },
                                        ]}
                                    >
                                        <ActivityIndicator color="#7aa06f" />
                                    </View>
                                )}
                            />
                        </View>
                    ) : null}
                </Animated.View>
            </View>
        </Modal>
    );
}

const s = StyleSheet.create({
    placeModalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
    placeModalSheet: {
        borderTopLeftRadius: 16,
        borderTopRightRadius: 16,
        borderTopWidth: 1,
        borderLeftWidth: 1,
        borderRightWidth: 1,
        overflow: "hidden",
        width: "100%",
        maxWidth: 448,
        alignSelf: "center",
        flexDirection: "column",
    },
    detailImgWrap: { position: "relative", backgroundColor: "#f3f4f6" },
    detailImgWeb: { width: "100%", height: 200 },
    detailImgGradient: {
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        height: 140,
        flexDirection: "column",
    },
    detailHandleOnImg: {
        position: "absolute",
        top: 10,
        left: 0,
        right: 0,
        alignItems: "center",
        zIndex: 10,
    },
    detailHandleBarWeb: {
        width: 48,
        height: 6,
        borderRadius: 3,
        backgroundColor: "rgba(255,255,255,0.92)",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.2,
        shadowRadius: 2,
        elevation: 2,
    },
    detailImgOverlayWeb: {
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        paddingHorizontal: 16,
        paddingBottom: 16,
        paddingTop: 36,
        backgroundColor: "transparent",
    },
    detailImgNameWeb: {
        fontSize: 18,
        fontWeight: "600",
        color: "#fff",
        letterSpacing: -0.2,
        textShadowColor: "rgba(0,0,0,0.5)",
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 4,
    },
    detailScrollTitle: { fontSize: 20, fontWeight: "600", marginBottom: 8, letterSpacing: -0.3 },
    detailAddressWeb: { fontSize: 13, fontWeight: "500", marginBottom: 12 },
    detailDescWeb: { fontSize: 14, lineHeight: 22, marginBottom: 16 },
    placeTipSection: { borderRadius: 12, padding: 14, borderWidth: 1, marginBottom: 12 },
    placeTipSectionLabel: { fontSize: 12, fontWeight: "600", marginBottom: 8 },
    placeTipSectionBody: { fontSize: 14, lineHeight: 21, fontWeight: "500" },
    detailReserveBtnWeb: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        backgroundColor: "#10b981",
        borderRadius: 10,
        paddingVertical: 12,
        marginBottom: 8,
        marginTop: 4,
    },
    detailReserveBtnWebText: { color: "#fff", fontSize: 14, fontWeight: "500" },
    detailCloseTextWeb: { fontSize: 13, fontWeight: "500", textAlign: "center" },
    detailCloseTextBtn: { paddingVertical: 10, alignItems: "center" },
    detailStatusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, alignSelf: "flex-start" },
    detailStatusText: { fontSize: 11, fontWeight: "500" },
    detailHoursText: { fontSize: 12, flexShrink: 1 },
    detailTipBanner: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        marginHorizontal: 16,
        marginBottom: 10,
        paddingHorizontal: 14,
        paddingVertical: 12,
        borderRadius: 12,
        borderWidth: 1,
    },
    detailTipBannerTitle: { fontSize: 13, fontWeight: "500", marginBottom: 2 },
    detailTipBannerSub: { fontSize: 12 },
    reserveWebHeader: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderBottomWidth: 1,
    },
    reserveWebBackBtn: { width: 36, alignItems: "center" },
    reserveWebTitle: { flex: 1, fontSize: 15, fontWeight: "500", textAlign: "center" },
});
