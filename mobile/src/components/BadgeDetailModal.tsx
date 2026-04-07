import React from "react";
import { View, Text, Modal, TouchableOpacity, StyleSheet } from "react-native";
import { Image } from "expo-image";
import { useModal, type Badge } from "../lib/modalContext";
import { useLocale } from "../lib/useLocale";
import { resolveImageUrl } from "../lib/imageUrl";
import { localeTag } from "../lib/localeUtils";

export default function BadgeDetailModal() {
    const { isOpen, closeModal, getData } = useModal();
    const visible = isOpen("badgeDetail");
    const data = getData("badgeDetail");
    const badge: Badge | undefined = data?.badge;
    const { t: i18n, locale } = useLocale();
    const dateLoc = localeTag(locale);

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={() => closeModal("badgeDetail")}>
            <View style={s.bg}>
                <TouchableOpacity style={StyleSheet.absoluteFillObject} onPress={() => closeModal("badgeDetail")} />
                {badge && (
                    <View style={s.card}>
                        <View style={s.imgWrap}>
                            {badge.image_url ? (
                                <Image
                                    source={{ uri: resolveImageUrl(badge.image_url) }}
                                    style={s.img}
                                    contentFit="contain"
                                />
                            ) : (
                                <Text style={{ fontSize: 60 }}>🏅</Text>
                            )}
                        </View>
                        <Text style={s.name}>{badge.name}</Text>
                        {badge.description ? <Text style={s.desc}>{badge.description}</Text> : null}
                        <Text style={s.dateText}>
                            {i18n("mypage.badgeAcquiredDate")}:{" "}
                            {new Date(badge.awarded_at).toLocaleDateString(dateLoc)}
                        </Text>
                        <TouchableOpacity style={s.closeBtn} onPress={() => closeModal("badgeDetail")}>
                            <Text style={s.closeTxt}>{i18n("mypage.close")}</Text>
                        </TouchableOpacity>
                    </View>
                )}
            </View>
        </Modal>
    );
}

const s = StyleSheet.create({
    bg: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", alignItems: "center", justifyContent: "center", padding: 32 },
    card: { borderRadius: 20, padding: 24, alignItems: "center", width: "100%", backgroundColor: "white" },
    imgWrap: { width: 100, height: 100, borderRadius: 50, backgroundColor: "#fef9c3", alignItems: "center", justifyContent: "center", marginBottom: 16 },
    img: { width: 80, height: 80 },
    name: { fontSize: 20, fontWeight: "600", color: "#111", marginBottom: 8, textAlign: "center" },
    desc: { fontSize: 14, color: "#6b7280", textAlign: "center", marginBottom: 8, lineHeight: 20 },
    dateText: { fontSize: 12, color: "#9ca3af", marginBottom: 20 },
    closeBtn: { backgroundColor: "#f3f4f6", borderRadius: 10, paddingVertical: 12, paddingHorizontal: 32 },
    closeTxt: { fontSize: 14, fontWeight: "500", color: "#374151" },
});
