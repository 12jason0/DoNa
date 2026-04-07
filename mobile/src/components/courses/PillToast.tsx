import React, { useRef, useEffect } from "react";
import { View, Text, Animated, StyleSheet, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import type { EdgeInsets } from "react-native-safe-area-context";
import { Colors } from "../../constants/theme";
import { useThemeColors } from "../../hooks/useThemeColors";
import { useLocale } from "../../lib/useLocale";
import { textFontForLocale } from "../../lib/textDefaultFont";

/**
 * 찜 토스트: 화면 뒤 블러 + 딤, 하단 CTA와 동일 bottom inset에서 배너가 아래에서 슬라이드업 (웹 찜 시트 톤)
 */
export const PillToast = React.memo(function PillToast({
    message,
    mode,
    insets,
    onHide,
}: {
    message: string;
    mode: "fav-added" | "fav-removed";
    insets: EdgeInsets;
    onHide: () => void;
}) {
    const t = useThemeColors();
    const { locale } = useLocale();
    const ctaFont = textFontForLocale(locale);
    const slideY = useRef(new Animated.Value(140)).current;

    useEffect(() => {
        Animated.spring(slideY, {
            toValue: 0,
            useNativeDriver: true,
            tension: 68,
            friction: 14,
        }).start();

        const timer = setTimeout(() => {
            Animated.timing(slideY, {
                toValue: 160,
                duration: 300,
                useNativeDriver: true,
            }).start(onHide);
        }, 2400);

        return () => clearTimeout(timer);
    }, [onHide, slideY]);

    const iconName = mode === "fav-added" ? "checkmark-circle" : "heart-outline";
    const iconColor = mode === "fav-added" ? Colors.emerald400 : t.textMuted;

    const bottomPad = insets.bottom + 12;

    return (
        <View style={s.pillToastOverlayRoot} pointerEvents="box-none">
            <View style={StyleSheet.absoluteFill} pointerEvents="none">
                <BlurView intensity={Platform.OS === "ios" ? 48 : 32} tint="dark" style={StyleSheet.absoluteFill} />
                <View style={[StyleSheet.absoluteFill, s.pillToastDim]} />
            </View>
            <Animated.View
                style={[
                    s.pillToastBannerWrap,
                    {
                        paddingBottom: bottomPad,
                        transform: [{ translateY: slideY }],
                    },
                ]}
                pointerEvents="none"
            >
                <View
                    style={[
                        s.pillToastBannerCard,
                        {
                            backgroundColor: t.card,
                            borderColor: t.border,
                            shadowColor: t.isDark ? "#000" : "#1e2a1a",
                        },
                    ]}
                >
                    <Ionicons name={iconName} size={26} color={iconColor} />
                    <Text style={[ctaFont, s.pillToastBannerText, { color: t.text }]} numberOfLines={3}>
                        {message}
                    </Text>
                </View>
            </Animated.View>
        </View>
    );
});

const s = StyleSheet.create({
    pillToastOverlayRoot: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 500,
    },
    pillToastDim: {
        backgroundColor: "rgba(0,0,0,0.42)",
    },
    pillToastBannerWrap: {
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        paddingHorizontal: 18,
        alignItems: "center",
    },
    pillToastBannerCard: {
        width: "100%",
        maxWidth: 400,
        flexDirection: "row",
        alignItems: "center",
        gap: 14,
        paddingVertical: 16,
        paddingHorizontal: 20,
        borderRadius: 16,
        borderWidth: StyleSheet.hairlineWidth,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.18,
        shadowRadius: 20,
        elevation: 12,
    },
    pillToastBannerText: {
        flex: 1,
        fontSize: 15,
        lineHeight: 22,
    },
});
