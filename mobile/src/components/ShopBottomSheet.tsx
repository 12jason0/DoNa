/**
 * 웹 ShopModal.tsx 와 동일 카피·역할: 두나샵 안내 하단 시트 (구독 풀페이지와 별개)
 */
import React, { useCallback, useEffect, useRef } from "react";
import {
    Modal,
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    Animated,
    Easing,
    Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useThemeColors } from "../hooks/useThemeColors";

const COPY = {
    title: "두나샵",
    desc: "더 완벽한 키트를 위해 준비 중이에요.\n조금만 기다려주세요 🎁",
    confirm: "확인",
} as const;

const SHEET_MAX = 520;

type Props = {
    visible: boolean;
    onClose: () => void;
};

export default function ShopBottomSheet({ visible, onClose }: Props) {
    const t = useThemeColors();
    const insets = useSafeAreaInsets();
    const slide = useRef(new Animated.Value(SHEET_MAX)).current;
    const backdrop = useRef(new Animated.Value(0)).current;
    const closingRef = useRef(false);

    useEffect(() => {
        if (!visible) {
            closingRef.current = false;
            return;
        }
        slide.setValue(SHEET_MAX);
        backdrop.setValue(0);
        Animated.parallel([
            Animated.spring(slide, {
                toValue: 0,
                useNativeDriver: true,
                tension: 68,
                friction: 12,
            }),
            Animated.timing(backdrop, {
                toValue: 1,
                duration: 260,
                easing: Easing.out(Easing.cubic),
                useNativeDriver: true,
            }),
        ]).start();
    }, [visible, slide, backdrop]);

    const dismiss = useCallback(() => {
        if (closingRef.current) return;
        closingRef.current = true;
        Animated.parallel([
            Animated.timing(slide, {
                toValue: SHEET_MAX,
                duration: 260,
                easing: Easing.in(Easing.cubic),
                useNativeDriver: true,
            }),
            Animated.timing(backdrop, {
                toValue: 0,
                duration: 220,
                easing: Easing.in(Easing.quad),
                useNativeDriver: true,
            }),
        ]).start(({ finished }) => {
            closingRef.current = false;
            if (finished) onClose();
        });
    }, [onClose, slide, backdrop]);

    const sheetBg = t.isDark ? "#1a241b" : "#fff";
    const borderTop = t.isDark ? "#374151" : "#f3f4f6";

    return (
        <Modal visible={visible} transparent animationType="none" onRequestClose={dismiss} statusBarTranslucent navigationBarTranslucent>
            <View style={styles.root} pointerEvents="box-none">
                <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={dismiss}>
                    <Animated.View
                        style={[
                            StyleSheet.absoluteFill,
                            {
                                backgroundColor: "rgba(0,0,0,0.45)",
                                opacity: backdrop,
                            },
                        ]}
                    />
                </TouchableOpacity>

                <Animated.View
                    style={[
                        styles.sheet,
                        {
                            backgroundColor: sheetBg,
                            borderTopColor: borderTop,
                            paddingBottom: Math.max(insets.bottom, 20),
                            maxHeight: Dimensions.get("window").height * 0.55,
                            transform: [{ translateY: slide }],
                        },
                    ]}
                >
                    <View style={[styles.grab, { backgroundColor: t.isDark ? "#4b5563" : "#e5e7eb" }]} />

                    <View style={[styles.iconWrap, { backgroundColor: t.isDark ? "rgba(16,185,129,0.15)" : "rgba(122,160,111,0.1)" }]}>
                        <Ionicons name="bag-handle-outline" size={28} color="#7aa06f" />
                    </View>

                    <Text style={[styles.title, { color: t.text }]}>{COPY.title}</Text>
                    <Text style={[styles.desc, { color: t.textMuted }]}>{COPY.desc}</Text>

                    <TouchableOpacity style={styles.cta} onPress={dismiss} activeOpacity={0.9}>
                        <Text style={styles.ctaText}>{COPY.confirm}</Text>
                    </TouchableOpacity>
                </Animated.View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    root: {
        flex: 1,
        justifyContent: "flex-end",
    },
    sheet: {
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        borderTopWidth: StyleSheet.hairlineWidth,
        paddingHorizontal: 24,
        paddingTop: 8,
        alignItems: "center",
    },
    grab: {
        width: 48,
        height: 5,
        borderRadius: 3,
        marginBottom: 20,
    },
    iconWrap: {
        width: 64,
        height: 64,
        borderRadius: 32,
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 20,
    },
    title: {
        fontSize: 20,
        fontWeight: "800",
        letterSpacing: -0.4,
        marginBottom: 8,
        textAlign: "center",
    },
    desc: {
        fontSize: 15,
        lineHeight: 22,
        textAlign: "center",
        marginBottom: 24,
    },
    cta: {
        width: "100%",
        maxWidth: 400,
        backgroundColor: "#7aa06f",
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: "center",
    },
    ctaText: {
        color: "#fff",
        fontSize: 15,
        fontWeight: "700",
    },
});
