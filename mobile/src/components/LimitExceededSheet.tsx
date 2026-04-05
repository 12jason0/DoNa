import React, { useRef, useEffect } from "react";
import { View, Text, Modal, Pressable, TouchableOpacity, StyleSheet, Animated } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useThemeColors } from "../hooks/useThemeColors";
import { useLocale } from "../lib/useLocale";
import { useModal } from "../lib/modalContext";

export default function LimitExceededSheet() {
    const { isOpen, closeModal, getData } = useModal();
    const visible = isOpen("limitExceeded");
    const data = getData("limitExceeded");
    const t = useThemeColors();
    const { t: i18n } = useLocale();
    const insets = useSafeAreaInsets();
    const slideAnim = useRef(new Animated.Value(400)).current;

    useEffect(() => {
        if (visible) {
            Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 65, friction: 11 }).start();
        } else {
            slideAnim.setValue(400);
        }
    }, [visible]);

    if (!visible || !data?.ctx) return null;

    const { ctx, onUpgrade } = data;
    const isBasic = ctx.tier === "BASIC";
    const title = isBasic ? i18n("personalizedHome.alreadyUsedBasic") : i18n("personalizedHome.alreadyUsedFree");
    const desc = isBasic
        ? `${i18n("personalizedHome.basicLimit")}\n${i18n("personalizedHome.basicUpgradeHint")}`
        : `${i18n("personalizedHome.freeLimit")}\n${i18n("personalizedHome.freeUpgradeHint")}`;
    const btnLabel = isBasic ? i18n("personalizedHome.upgradeToPremium") : i18n("personalizedHome.upgradeToBasic");

    return (
        <Modal visible={visible} transparent animationType="none" onRequestClose={() => closeModal("limitExceeded")}>
            <Pressable style={s.backdrop} onPress={() => closeModal("limitExceeded")} />
            <Animated.View style={[s.sheet, { backgroundColor: t.card, paddingBottom: insets.bottom + 16 }, { transform: [{ translateY: slideAnim }] }]}>
                <View style={s.handle} />
                <View style={s.iconWrap}>
                    <Text style={{ fontSize: 36 }}>⏰</Text>
                </View>
                <Text style={[s.title, { color: t.text }]}>{title}</Text>
                <Text style={[s.desc, { color: t.textMuted }]}>{desc}</Text>
                <TouchableOpacity
                    style={s.upgradeBtn}
                    onPress={() => { closeModal("limitExceeded"); onUpgrade(); }}
                    activeOpacity={0.88}
                >
                    <Text style={s.upgradeBtnText}>{btnLabel}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.closeBtn} onPress={() => closeModal("limitExceeded")} activeOpacity={0.7}>
                    <Text style={[s.closeBtnText, { color: t.textMuted }]}>{i18n("personalizedHome.closeAria")}</Text>
                </TouchableOpacity>
            </Animated.View>
        </Modal>
    );
}

const s = StyleSheet.create({
    backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.55)" },
    sheet: {
        position: "absolute", bottom: 0, left: 0, right: 0,
        borderTopLeftRadius: 28, borderTopRightRadius: 28,
        paddingTop: 12, paddingHorizontal: 24, paddingBottom: 24,
    },
    handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: "#d1d5db", alignSelf: "center", marginBottom: 20 },
    iconWrap: { alignItems: "center", marginBottom: 12 },
    title: { fontSize: 18, fontWeight: "600", textAlign: "center", marginBottom: 8, letterSpacing: -0.3 },
    desc: { fontSize: 13, lineHeight: 19, textAlign: "center", marginBottom: 24 },
    upgradeBtn: { backgroundColor: "#059669", borderRadius: 14, paddingVertical: 15, alignItems: "center", marginBottom: 10 },
    upgradeBtnText: { color: "#fff", fontSize: 15, fontWeight: "600" },
    closeBtn: { alignItems: "center", paddingVertical: 10 },
    closeBtnText: { fontSize: 14 },
});
