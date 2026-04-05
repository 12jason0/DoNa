/**
 * 웹 NotificationModal.tsx 와 동일 UX — 비로그인 시 알림(혜택) 안내
 * 시트는 아래에서 위로 슬라이드
 */
import React from "react";
import {
    View,
    Text,
    StyleSheet,
    Modal,
    Pressable,
    TouchableOpacity,
    useWindowDimensions,
    Animated,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";

import { Colors } from "../constants/theme";
import { useSlideModalAnimation } from "../hooks/useSlideModalAnimation";
import { useThemeColors } from "../hooks/useThemeColors";
import { modalBottomPadding } from "../utils/modalSafePadding";
import { MODAL_ANDROID_PROPS } from "../constants/modalAndroidProps";
import { useLocale } from "../lib/useLocale";

type Props = {
    visible: boolean;
    onClose: () => void;
};

export default function NotificationPromoModal({ visible, onClose }: Props) {
    const t = useThemeColors();
    const { t: i18n } = useLocale();
    const insets = useSafeAreaInsets();
    const { height } = useWindowDimensions();
    const maxH = Math.min(height * 0.85, height - insets.top - 40);
    const { rendered, translateY, backdropOpacity, sheetReady, isClosing } = useSlideModalAnimation(visible);

    const goLogin = () => {
        onClose();
        router.push("/(auth)/login");
    };

    if (!rendered) return null;

    return (
        <Modal
            visible={rendered}
            transparent
            animationType="none"
            onRequestClose={onClose}
            {...MODAL_ANDROID_PROPS}
        >
            <View style={styles.root} pointerEvents={isClosing ? "none" : "auto"}>
                <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]}>
                    {sheetReady && <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />}
                </Animated.View>
                <Animated.View
                    style={[
                        styles.sheetWrap,
                        {
                            transform: [{ translateY }],
                            maxHeight: maxH,
                        },
                    ]}
                >
                    {/* 하단 safe area는 시트 안쪽 패딩으로만 처리 — 흰 배경은 화면 맨 아래까지 붙음 */}
                    <Pressable
                        style={[styles.sheet, { backgroundColor: t.card, paddingBottom: modalBottomPadding(insets.bottom) }]}
                        onPress={(e) => e.stopPropagation()}
                    >
                        <View style={styles.closeRow}>
                            <TouchableOpacity
                                onPress={onClose}
                                style={[styles.closeBtn, { backgroundColor: t.surface }]}
                                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            >
                                <Ionicons name="close" size={18} color={t.textMuted} />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.badge}>
                            <Text style={styles.badgeText}>✨ {i18n("notificationModal.badge")}</Text>
                        </View>

                        <View style={styles.iconBlock}>
                            <View style={styles.iconGlow} />
                            <View style={styles.iconMain}>
                                <Ionicons name="gift" size={36} color="#fff" />
                            </View>
                        </View>

                        <Text style={[styles.title, { color: t.text }]}>
                            {i18n("notificationModal.titleLine1")}
                            {"\n"}
                            <Text style={styles.titleAccent}>{i18n("notificationModal.titleHighlight")}</Text>
                            {i18n("notificationModal.titleLine2")}
                        </Text>

                        <View style={styles.descBox}>
                            <Text style={[styles.desc, { color: t.text }]}>{i18n("notificationModal.desc")}</Text>
                        </View>

                        <TouchableOpacity style={styles.cta} onPress={goLogin} activeOpacity={0.88}>
                            <Text style={styles.ctaText}>{i18n("notificationModal.cta")}</Text>
                            <Ionicons name="chevron-forward" size={18} color="#fff" style={styles.ctaChevron} />
                        </TouchableOpacity>

                        <TouchableOpacity onPress={onClose} style={styles.laterBtn}>
                            <Text style={[styles.laterText, { color: t.textMuted }]}>{i18n("notificationModal.later")}</Text>
                        </TouchableOpacity>
                    </Pressable>
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
    backdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: "rgba(0,0,0,0.55)",
    },
    sheetWrap: {
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
    },
    sheet: {
        backgroundColor: "#fff",
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        paddingHorizontal: 24,
        paddingTop: 8,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
        elevation: 16,
    },
    closeRow: {
        alignItems: "flex-end",
    },
    closeBtn: {
        padding: 8,
        backgroundColor: "#f9fafb",
        borderRadius: 999,
    },
    badge: {
        alignSelf: "center",
        backgroundColor: "#fef3c7",
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 999,
        marginBottom: 16,
    },
    badgeText: {
        fontSize: 10,
        fontWeight: "600",
        color: "#b45309",
    },
    iconBlock: {
        alignItems: "center",
        marginBottom: 20,
    },
    iconGlow: {
        position: "absolute",
        width: 72,
        height: 72,
        borderRadius: 16,
        backgroundColor: Colors.brandGreen,
        opacity: 0.12,
        transform: [{ rotate: "12deg" }],
    },
    iconMain: {
        width: 72,
        height: 72,
        borderRadius: 18,
        backgroundColor: "#10b981",
        alignItems: "center",
        justifyContent: "center",
        shadowColor: "#10b981",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.35,
        shadowRadius: 8,
        elevation: 6,
    },
    title: {
        fontSize: 20,
        fontWeight: "700",
        color: "#111827",
        textAlign: "center",
        lineHeight: 28,
        marginBottom: 12,
    },
    titleAccent: {
        color: "#059669",
    },
    descBox: {
        backgroundColor: "#ecfdf5",
        borderRadius: 14,
        padding: 14,
        borderWidth: 1,
        borderColor: "#d1fae5",
        marginBottom: 20,
    },
    desc: {
        fontSize: 13,
        color: "#4b5563",
        textAlign: "center",
        lineHeight: 20,
    },
    cta: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        backgroundColor: "#111827",
        paddingVertical: 14,
        borderRadius: 14,
        marginBottom: 8,
        width: "100%",
    },
    ctaText: {
        fontSize: 16,
        fontWeight: "600",
        color: "#fff",
    },
    ctaChevron: { marginLeft: 4 },
    laterBtn: {
        paddingVertical: 12,
        alignItems: "center",
    },
    laterText: {
        fontSize: 12,
        fontWeight: "500",
        color: "#9ca3af",
    },
});
