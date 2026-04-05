import React from "react";
import { View, Text, Modal, Pressable, TouchableOpacity, StyleSheet, ActivityIndicator, Linking } from "react-native";
import { WebView } from "react-native-webview";
import { Ionicons } from "@expo/vector-icons";
import { useThemeColors } from "../hooks/useThemeColors";
import { useLocale } from "../lib/useLocale";
import { useModal } from "../lib/modalContext";
import { MODAL_ANDROID_PROPS } from "../constants/modalAndroidProps";

export default function ScreenReservationModal() {
    const { isOpen, closeModal, getData } = useModal();
    const visible = isOpen("screenReservation");
    const data = getData("screenReservation");
    const rawUrl = data?.url ?? null;
    const url = rawUrl && rawUrl.startsWith("https://") ? rawUrl : null;
    const t = useThemeColors();
    const { t: i18n } = useLocale();

    return (
        <Modal
            visible={visible}
            animationType="slide"
            transparent
            onRequestClose={() => closeModal("screenReservation")}
            {...MODAL_ANDROID_PROPS}
        >
            <View style={s.overlay}>
                <Pressable style={StyleSheet.absoluteFillObject} onPress={() => closeModal("screenReservation")} />
                <View style={s.sheet}>
                    <View style={[s.header, { borderBottomColor: "#e5e7eb", backgroundColor: "#fff" }]}>
                        <TouchableOpacity
                            onPress={() => closeModal("screenReservation")}
                            hitSlop={10}
                            style={s.backBtn}
                        >
                            <Ionicons name="chevron-down" size={22} color="#111827" />
                        </TouchableOpacity>
                        <Text style={[s.headerTitle, { color: "#111827" }]} numberOfLines={1}>
                            {i18n("courses.reserve")}
                        </Text>
                        <TouchableOpacity
                            onPress={() => url && Linking.openURL(url)}
                            hitSlop={10}
                            style={s.backBtn}
                        >
                            <Ionicons name="open-outline" size={19} color="#6b7280" />
                        </TouchableOpacity>
                    </View>
                    {url ? (
                        <WebView
                            source={{ uri: url }}
                            style={{ flex: 1 }}
                            javaScriptEnabled
                            domStorageEnabled
                            allowsInlineMediaPlayback
                            startInLoadingState
                            renderLoading={() => (
                                <View style={[StyleSheet.absoluteFillObject, { alignItems: "center", justifyContent: "center", backgroundColor: "#fff" }]}>
                                    <ActivityIndicator color="#7aa06f" />
                                </View>
                            )}
                        />
                    ) : null}
                </View>
            </View>
        </Modal>
    );
}

const s = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
    sheet: { height: "90%", borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: "hidden", backgroundColor: "#fff" },
    header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1 },
    backBtn: { padding: 4 },
    headerTitle: { flex: 1, fontSize: 15, fontWeight: "500", textAlign: "center" },
});
