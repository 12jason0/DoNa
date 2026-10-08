/**
 * 가입 직후 한 번만: "두나 어디서 알게 됐어요?" — 웹 src/components/SignupSourcePrompt.tsx 와 동일.
 * 띄울지는 서버가 결정 (답이 없고 가입 하루 이내).
 */
import { useEffect, useState } from "react";
import { useSegments } from "expo-router";
import { Modal, View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "../lib/api";
import { useAuth } from "../hooks/useAuth";
import { useLocale } from "../lib/useLocale";
import { useThemeColors } from "../hooks/useThemeColors";
import { MODAL_ANDROID_PROPS } from "../constants/modalAndroidProps";

const OPTIONS = [
    { value: "instagram", key: "authPage.signup.sourceInstagram" },
    { value: "search", key: "authPage.signup.sourceSearch" },
    { value: "friend", key: "authPage.signup.sourceFriend" },
    { value: "share_link", key: "authPage.signup.sourceShareLink" },
    { value: "other", key: "authPage.signup.sourceOther" },
] as const;

export default function SignupSourcePrompt() {
    const { isAuthenticated, user } = useAuth();
    const { t: i18n } = useLocale();
    const t = useThemeColors();
    const insets = useSafeAreaInsets();
    const [ask, setAsk] = useState(false);
    // 온보딩·로그인 화면 위에는 안 띄움 — 탭 화면으로 돌아왔을 때 보여줌
    const onTabs = useSegments()[0] === "(tabs)";
    const open = ask && onTabs;

    useEffect(() => {
        if (!isAuthenticated) return;
        let cancelled = false;
        api.get<{ ask?: boolean }>("/api/users/me/signup-source")
            .then((d) => !cancelled && d?.ask && setAsk(true))
            .catch(() => {});
        return () => {
            cancelled = true;
        };
    }, [isAuthenticated, user?.id]);

    const answer = (value: string) => {
        setAsk(false);
        api.post("/api/users/me/signup-source", { answer: value }).catch(() => {});
    };

    return (
        <Modal visible={open} transparent animationType="slide" onRequestClose={() => answer("skipped")} {...MODAL_ANDROID_PROPS}>
            <View style={[s.overlay, { backgroundColor: t.overlay }]}>
                <View style={[s.sheet, { backgroundColor: t.card, paddingBottom: insets.bottom + 20 }]}>
                    <Text style={[s.title, { color: t.text }]}>{i18n("authPage.signup.sourceTitle")}</Text>
                    <Text style={[s.sub, { color: t.textMuted }]}>{i18n("authPage.signup.sourceSub")}</Text>
                    <View style={s.grid}>
                        {OPTIONS.map((o) => (
                            <TouchableOpacity
                                key={o.value}
                                style={[s.option, { backgroundColor: t.surface, borderColor: t.border }]}
                                onPress={() => answer(o.value)}
                                activeOpacity={0.8}
                            >
                                <Text style={[s.optionText, { color: t.text }]}>{i18n(o.key)}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                    <TouchableOpacity onPress={() => answer("skipped")} style={s.skip} activeOpacity={0.7}>
                        <Text style={[s.skipText, { color: t.textMuted }]}>{i18n("authPage.signup.sourceSkip")}</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
}

const s = StyleSheet.create({
    overlay: { flex: 1, justifyContent: "flex-end" },
    sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: 24, paddingTop: 24 },
    title: { fontSize: 20, fontWeight: "700", textAlign: "center" },
    sub: { fontSize: 14, textAlign: "center", marginTop: 6, marginBottom: 20 },
    grid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    option: { width: "48.5%", paddingVertical: 14, borderRadius: 12, borderWidth: 1, alignItems: "center" },
    optionText: { fontSize: 15, fontWeight: "700" },
    skip: { marginTop: 12, paddingVertical: 12, alignItems: "center" },
    skipText: { fontSize: 14, fontWeight: "600" },
});
