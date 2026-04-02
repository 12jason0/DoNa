/**
 * 웹 ComingSoonModal.tsx 와 동일: 커플 미션(방탈출) 오픈 알림 · 준비 중 안내
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
    Modal,
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    Animated,
    Easing,
    Dimensions,
    ActivityIndicator,
    Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";

import { useThemeColors } from "../hooks/useThemeColors";
import { useAuth } from "../hooks/useAuth";
import { api, ApiError } from "../lib/api";
import { useLocale } from "../lib/useLocale";

const SHEET_MAX = 560;

type Props = {
    visible: boolean;
    onClose: () => void;
};

export default function ComingSoonBottomSheet({ visible, onClose }: Props) {
    const t = useThemeColors();
    const { t: i18n } = useLocale();
    const insets = useSafeAreaInsets();
    const { isAuthenticated } = useAuth();
    const slide = useRef(new Animated.Value(SHEET_MAX)).current;
    const backdrop = useRef(new Animated.Value(0)).current;
    const closingRef = useRef(false);

    const [loading, setLoading] = useState(true);
    const [hasNotification, setHasNotification] = useState(false);
    const [submitting, setSubmitting] = useState(false);

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

    useEffect(() => {
        if (!visible) return;
        let cancelled = false;
        setLoading(true);
        api
            .get<{ interests?: { topic: string }[] }>("/api/users/notifications/interests")
            .then((data) => {
                if (cancelled) return;
                const has = data.interests?.some((i) => i.topic === "NEW_ESCAPE");
                setHasNotification(!!has);
            })
            .catch(() => {
                if (!cancelled) setHasNotification(false);
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [visible]);

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

    const handleNotify = async () => {
        if (!isAuthenticated) {
            Alert.alert(i18n("comingSoonModal.alertNoticeTitle"), i18n("comingSoonModal.alertLoginRequired"), [
                { text: i18n("common.cancel"), style: "cancel" },
                {
                    text: i18n("nav.login"),
                    onPress: () => {
                        dismiss();
                        router.push("/(auth)/login" as any);
                    },
                },
            ]);
            return;
        }
        setSubmitting(true);
        try {
            await api.post("/api/users/notifications/consent", { topics: ["NEW_ESCAPE"] });
            setHasNotification(true);
            Alert.alert(i18n("comingSoonModal.alertDoneTitle"), i18n("comingSoonModal.alertSuccess"));
            dismiss();
        } catch (e) {
            const msg =
                e instanceof ApiError && typeof e.data === "object" && e.data && "error" in e.data
                    ? String((e.data as { error?: string }).error ?? i18n("comingSoonModal.alertFail"))
                    : i18n("comingSoonModal.alertError");
            Alert.alert(i18n("comingSoonModal.alertNoticeTitle"), e instanceof ApiError ? msg : i18n("comingSoonModal.alertError"));
        } finally {
            setSubmitting(false);
        }
    };

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
                            maxHeight: Dimensions.get("window").height * 0.62,
                            transform: [{ translateY: slide }],
                        },
                    ]}
                >
                    <View style={[styles.grab, { backgroundColor: t.isDark ? "#4b5563" : "#e5e7eb" }]} />

                    {loading ? (
                        <View style={styles.loadingBox}>
                            <ActivityIndicator size="large" color="#059669" />
                        </View>
                    ) : (
                        <>
                            <View
                                style={[
                                    styles.iconWrap,
                                    { backgroundColor: t.isDark ? "rgba(16,185,129,0.15)" : "rgba(122,160,111,0.1)" },
                                ]}
                            >
                                <Ionicons name="lock-closed-outline" size={28} color="#7aa06f" />
                            </View>

                            <Text style={[styles.title, { color: t.text }]}>{i18n("comingSoonModal.title")}</Text>
                            <Text style={[styles.desc, { color: t.textMuted }]}>{i18n("comingSoonModal.desc")}</Text>

                            <View style={styles.actions}>
                                {!hasNotification ? (
                                    <TouchableOpacity
                                        style={[styles.cta, submitting && { opacity: 0.65 }]}
                                        onPress={handleNotify}
                                        disabled={submitting}
                                        activeOpacity={0.9}
                                    >
                                        <View style={styles.ctaRow}>
                                            <Ionicons name="notifications-outline" size={18} color="#fff" />
                                            <Text style={styles.ctaText}>
                                                {submitting ? i18n("comingSoonModal.submitting") : i18n("comingSoonModal.cta")}
                                            </Text>
                                        </View>
                                    </TouchableOpacity>
                                ) : (
                                    <View
                                        style={[
                                            styles.doneBox,
                                            {
                                                backgroundColor: t.isDark ? "rgba(16,185,129,0.12)" : "#ecfdf5",
                                                borderColor: t.isDark ? "rgba(16,185,129,0.35)" : "#a7f3d0",
                                            },
                                        ]}
                                    >
                                        <Ionicons name="checkmark-circle" size={20} color="#059669" />
                                        <Text style={styles.doneText}>{i18n("comingSoonModal.completed")}</Text>
                                    </View>
                                )}

                                <TouchableOpacity onPress={dismiss} style={styles.closeLink} activeOpacity={0.7}>
                                    <Text style={[styles.closeLinkText, { color: t.textMuted }]}>{i18n("common.close")}</Text>
                                </TouchableOpacity>
                            </View>
                        </>
                    )}
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
    loadingBox: {
        paddingVertical: 48,
        alignItems: "center",
        justifyContent: "center",
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
        fontWeight: "600",
        letterSpacing: -0.4,
        marginBottom: 8,
        textAlign: "center",
    },
    desc: {
        fontSize: 15,
        lineHeight: 22,
        textAlign: "center",
        marginBottom: 20,
    },
    actions: {
        width: "100%",
        maxWidth: 400,
        gap: 12,
    },
    cta: {
        width: "100%",
        backgroundColor: "#7aa06f",
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: "center",
        justifyContent: "center",
    },
    ctaRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
    },
    ctaText: {
        color: "#fff",
        fontSize: 15,
        fontWeight: "500",
    },
    doneBox: {
        width: "100%",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        paddingVertical: 14,
        borderRadius: 12,
        borderWidth: 1,
    },
    doneText: {
        fontSize: 15,
        fontWeight: "500",
        color: "#059669",
    },
    closeLink: {
        paddingVertical: 8,
        alignItems: "center",
    },
    closeLinkText: {
        fontSize: 12,
        fontWeight: "500",
        textDecorationLine: "underline",
    },
});
