/**
 * 웹 BenefitConsentModal 과 동일: 혜택 푸시 토픽 선택 · 드래그 핸들로 닫기
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
    Modal,
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    ScrollView,
    Animated,
    PanResponder,
    Dimensions,
    Alert,
    Pressable,
    Easing,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQueryClient } from "@tanstack/react-query";

import { useThemeColors } from "../hooks/useThemeColors";
import { useLocale } from "../lib/useLocale";
import { api, ApiError } from "../lib/api";
import { setBenefitConsentHideUntil } from "../lib/mmkv";
import { MODAL_ANDROID_PROPS } from "../constants/modalAndroidProps";
import { useModal } from "../lib/modalContext";

const WIN_H = Dimensions.get("window").height;

function getNextDayMidnightKST(): string {
    const now = new Date();
    const kstOffset = 9 * 60 * 60 * 1000;
    const kstNow = new Date(now.getTime() + kstOffset);
    const nextDayKST = new Date(kstNow);
    nextDayKST.setUTCDate(nextDayKST.getUTCDate() + 1);
    nextDayKST.setUTCHours(0, 0, 0, 0);
    return new Date(nextDayKST.getTime() - kstOffset).toISOString();
}

export default function BenefitConsentBottomSheet() {
    const { isOpen, closeModal } = useModal();
    const visible = isOpen("benefitConsent");
    const onClose = () => closeModal("benefitConsent");
    const theme = useThemeColors();
    const { t } = useLocale();
    const insets = useSafeAreaInsets();
    const queryClient = useQueryClient();
    const [selected, setSelected] = useState<string[]>(["COURSE", "NEW_ESCAPE"]);
    const [submitting, setSubmitting] = useState(false);
    const closingRef = useRef(false);
    const slide = useRef(new Animated.Value(WIN_H)).current;
    const backdrop = useRef(new Animated.Value(0)).current;
    const dragStartSlide = useRef(0);

    useEffect(() => {
        if (!visible) {
            closingRef.current = false;
            return;
        }
        setSelected(["COURSE", "NEW_ESCAPE"]);
        setSubmitting(false);
        slide.setValue(WIN_H);
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
                toValue: WIN_H,
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

    const dismissRef = useRef(dismiss);
    dismissRef.current = dismiss;

    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onMoveShouldSetPanResponder: (_, g) => g.dy > 4,
            onPanResponderGrant: () => {
                slide.stopAnimation((v) => {
                    dragStartSlide.current = v;
                });
            },
            onPanResponderMove: (_, g) => {
                const next = Math.min(WIN_H, Math.max(0, dragStartSlide.current + g.dy));
                slide.setValue(next);
            },
            onPanResponderRelease: (_, g) => {
                slide.stopAnimation((v) => {
                    if (v > 100 || g.vy > 0.45) {
                        dismissRef.current();
                    } else {
                        Animated.spring(slide, {
                            toValue: 0,
                            useNativeDriver: true,
                            tension: 68,
                            friction: 12,
                        }).start();
                    }
                });
            },
        }),
    ).current;

    const toggle = (topic: string) => {
        setSelected((prev) =>
            prev.includes(topic) ? prev.filter((x) => x !== topic) : [...prev, topic],
        );
    };

    const handleLater = () => {
        setBenefitConsentHideUntil(getNextDayMidnightKST());
        dismiss();
    };

    const handleConfirm = async () => {
        if (selected.length === 0) {
            Alert.alert("", t("benefitConsentModal.alertSelectOne"));
            return;
        }
        setSubmitting(true);
        dismiss();
        try {
            await api.post("/api/users/notifications/consent", { topics: selected });
            await queryClient.invalidateQueries({ queryKey: ["users", "profile"] });
        } catch (e) {
            const msg =
                e instanceof ApiError && typeof e.data === "object" && e.data && "error" in e.data
                    ? String((e.data as { error?: string }).error ?? "")
                    : "";
            console.error("benefit consent", e);
            if (msg) Alert.alert("", msg);
        } finally {
            setSubmitting(false);
        }
    };

    const sheetBg = theme.isDark ? "#1a241b" : "#fff";
    const borderTop = theme.isDark ? "#374151" : "#f3f4f6";
    const emerald = "#059669";
    const mutedBorder = theme.isDark ? "#374151" : "#e5e7eb";
    const softBg = theme.isDark ? "rgba(16,185,129,0.12)" : "#ecfdf5";

    return (
        <Modal
            visible={visible}
            transparent
            animationType="none"
            onRequestClose={dismiss}
            statusBarTranslucent
            {...MODAL_ANDROID_PROPS}
        >
            <View style={styles.root} pointerEvents="box-none">
                <Pressable style={StyleSheet.absoluteFill} onPress={dismiss}>
                    <Animated.View
                        style={[
                            StyleSheet.absoluteFill,
                            { backgroundColor: "rgba(0,0,0,0.5)", opacity: backdrop },
                        ]}
                    />
                </Pressable>

                <Animated.View
                    style={[
                        styles.sheet,
                        {
                            backgroundColor: sheetBg,
                            borderTopColor: borderTop,
                            maxHeight: WIN_H * 0.9,
                            paddingBottom: Math.max(insets.bottom, 20),
                            transform: [{ translateY: slide }],
                        },
                    ]}
                >
                    <View style={styles.topRow}>
                        <View style={styles.topRowSide} />
                        <View
                            style={styles.handleTouch}
                            {...panResponder.panHandlers}
                            accessibilityRole="adjustable"
                            accessibilityLabel={t("benefitConsentModal.dragToClose")}
                        >
                            <View style={[styles.handleBar, { backgroundColor: theme.isDark ? "#4b5563" : "#d1d5db" }]} />
                        </View>
                        <View style={[styles.topRowSide, styles.topRowSideRight]}>
                            <TouchableOpacity onPress={dismiss} hitSlop={12} accessibilityLabel={t("common.close")}>
                                <Ionicons name="close" size={26} color={theme.textMuted} />
                            </TouchableOpacity>
                        </View>
                    </View>

                    <ScrollView
                        keyboardShouldPersistTaps="handled"
                        showsVerticalScrollIndicator={false}
                        contentContainerStyle={styles.scrollContent}
                    >
                        <Text style={styles.emoji}>💌</Text>
                        <Text style={[styles.title, { color: theme.text }]}>{t("benefitConsentModal.title")}</Text>

                        <TouchableOpacity
                            activeOpacity={0.85}
                            onPress={() => toggle("COURSE")}
                            disabled={submitting}
                            style={[
                                styles.card,
                                {
                                    borderColor: selected.includes("COURSE") ? emerald : mutedBorder,
                                    backgroundColor: selected.includes("COURSE") ? softBg : theme.isDark ? "#0f1710" : "#f9fafb",
                                    opacity: selected.includes("COURSE") ? 1 : 0.72,
                                },
                            ]}
                        >
                            <View style={styles.cardLeft}>
                                <Text style={styles.cardEmoji}>📍</Text>
                                <View style={styles.cardTextCol}>
                                    <Text style={[styles.cardTitle, { color: theme.text }]}>{t("benefitConsentModal.topicCourse")}</Text>
                                    <Text style={[styles.cardDesc, { color: theme.textMuted }]}>{t("benefitConsentModal.topicCourseDesc")}</Text>
                                </View>
                            </View>
                            {selected.includes("COURSE") ? (
                                <View style={styles.check}>
                                    <Text style={styles.checkMark}>✓</Text>
                                </View>
                            ) : null}
                        </TouchableOpacity>

                        <TouchableOpacity
                            activeOpacity={0.85}
                            onPress={() => toggle("NEW_ESCAPE")}
                            disabled={submitting}
                            style={[
                                styles.card,
                                {
                                    borderColor: selected.includes("NEW_ESCAPE") ? emerald : mutedBorder,
                                    backgroundColor: selected.includes("NEW_ESCAPE") ? softBg : theme.isDark ? "#0f1710" : "#f9fafb",
                                    opacity: selected.includes("NEW_ESCAPE") ? 1 : 0.72,
                                },
                            ]}
                        >
                            <View style={styles.cardLeft}>
                                <Text style={styles.cardEmoji}>🔑</Text>
                                <View style={styles.cardTextCol}>
                                    <Text style={[styles.cardTitle, { color: theme.text }]}>{t("benefitConsentModal.topicEscape")}</Text>
                                    <Text style={[styles.cardDesc, { color: theme.textMuted }]}>{t("benefitConsentModal.topicEscapeDesc")}</Text>
                                </View>
                            </View>
                            {selected.includes("NEW_ESCAPE") ? (
                                <View style={styles.check}>
                                    <Text style={styles.checkMark}>✓</Text>
                                </View>
                            ) : null}
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.cta, submitting && { opacity: 0.65 }]}
                            onPress={handleConfirm}
                            disabled={submitting || selected.length === 0}
                            activeOpacity={0.9}
                        >
                            <Text style={styles.ctaText}>{submitting ? t("benefitConsentModal.submitting") : t("benefitConsentModal.cta")}</Text>
                        </TouchableOpacity>

                        <TouchableOpacity onPress={handleLater} disabled={submitting} style={styles.laterWrap}>
                            <Text style={[styles.later, { color: theme.textMuted }]}>{t("benefitConsentModal.later")}</Text>
                        </TouchableOpacity>

                        <Text style={[styles.footer, { color: theme.isDark ? "#6b7280" : "#d1d5db" }]}>{t("benefitConsentModal.footer")}</Text>
                    </ScrollView>
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
        paddingHorizontal: 20,
    },
    topRow: {
        flexDirection: "row",
        alignItems: "center",
        paddingTop: 6,
        marginBottom: 8,
    },
    topRowSide: {
        width: 44,
        minHeight: 36,
    },
    topRowSideRight: {
        alignItems: "flex-end",
        justifyContent: "center",
    },
    handleTouch: {
        flex: 1,
        alignItems: "center",
        paddingVertical: 10,
    },
    handleBar: {
        width: 48,
        height: 5,
        borderRadius: 3,
    },
    scrollContent: {
        paddingBottom: 8,
    },
    emoji: {
        fontSize: 40,
        textAlign: "center",
        marginBottom: 12,
    },
    title: {
        fontSize: 20,
        fontWeight: "500",
        textAlign: "center",
        lineHeight: 28,
        marginBottom: 20,
    },
    card: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        padding: 16,
        borderRadius: 16,
        borderWidth: 2,
        marginBottom: 12,
    },
    cardLeft: {
        flexDirection: "row",
        alignItems: "center",
        flex: 1,
        gap: 12,
    },
    cardEmoji: {
        fontSize: 20,
    },
    cardTextCol: {
        flex: 1,
    },
    cardTitle: {
        fontSize: 14,
        fontWeight: "500",
    },
    cardDesc: {
        fontSize: 11,
        marginTop: 4,
        lineHeight: 16,
    },
    check: {
        width: 22,
        height: 22,
        borderRadius: 11,
        backgroundColor: "#059669",
        alignItems: "center",
        justifyContent: "center",
    },
    checkMark: {
        color: "#fff",
        fontSize: 11,
        fontWeight: "500",
    },
    cta: {
        marginTop: 8,
        backgroundColor: "#111827",
        paddingVertical: 16,
        borderRadius: 16,
        alignItems: "center",
    },
    ctaText: {
        color: "#fff",
        fontSize: 16,
        fontWeight: "500",
    },
    laterWrap: {
        paddingVertical: 12,
        alignItems: "center",
    },
    later: {
        fontSize: 13,
        fontWeight: "500",
    },
    footer: {
        fontSize: 10,
        textAlign: "center",
        lineHeight: 15,
        marginTop: 8,
    },
});
