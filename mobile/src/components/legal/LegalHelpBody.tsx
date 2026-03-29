/**
 * 웹 src/app/(home)/help/page.tsx 와 동일 UX·문구 (React Native)
 */
import React, { useEffect, useMemo, useState } from "react";
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    ScrollView,
    StyleSheet,
    Linking,
} from "react-native";

const CONTACT_URL = "https://dona.io.kr/contact";
const CONTACT_EMAIL = "12jason@donacouse.com";

type Theme = {
    text: string;
    textMuted: string;
    textSubtle: string;
    surface: string;
    border: string;
    isDark: boolean;
};

type Props = {
    tr: (key: string) => string;
    theme: Theme;
};

type FAQ = { id: number; question: string; answer: string; category: string };

export default function LegalHelpBody({ tr, theme }: Props) {
    const categories = useMemo(
        () => [
            tr("help.categoryAll"),
            tr("help.categoryService"),
            tr("help.categoryAccount"),
            tr("help.categoryUse"),
            tr("help.categoryPayment"),
            tr("help.categoryTech"),
        ],
        [tr],
    );

    const faqs = useMemo<FAQ[]>(
        () => [
            { id: 1, question: tr("help.faq1Question"), answer: tr("help.faq1Answer"), category: tr("help.faq1Category") },
            { id: 2, question: tr("help.faq2Question"), answer: tr("help.faq2Answer"), category: tr("help.faq2Category") },
            { id: 3, question: tr("help.faq3Question"), answer: tr("help.faq3Answer"), category: tr("help.faq3Category") },
            { id: 4, question: tr("help.faq4Question"), answer: tr("help.faq4Answer"), category: tr("help.faq4Category") },
            { id: 5, question: tr("help.faq5Question"), answer: tr("help.faq5Answer"), category: tr("help.faq5Category") },
            { id: 6, question: tr("help.faq6Question"), answer: tr("help.faq6Answer"), category: tr("help.faq6Category") },
            { id: 7, question: tr("help.faq7Question"), answer: tr("help.faq7Answer"), category: tr("help.faq7Category") },
        ],
        [tr],
    );

    const [selectedCategory, setSelectedCategory] = useState(categories[0] ?? "");
    const [searchTerm, setSearchTerm] = useState("");
    const [openId, setOpenId] = useState<number | null>(null);

    useEffect(() => {
        if (categories[0]) setSelectedCategory(categories[0]);
    }, [categories]);

    const activeCategory = selectedCategory || categories[0];
    const filtered = faqs.filter((faq) => {
        const catOk = activeCategory === categories[0] || faq.category === activeCategory;
        const q = searchTerm.toLowerCase();
        const searchOk =
            !q || faq.question.toLowerCase().includes(q) || faq.answer.toLowerCase().includes(q);
        return catOk && searchOk;
    });

    const inputBg = theme.isDark ? "#1a241b" : "#fff";
    const chipInactiveBg = theme.isDark ? "#1f2937" : "#f3f4f6";
    const chipInactiveBorder = theme.isDark ? "#374151" : "#e5e7eb";
    const faqCardBg = theme.isDark ? "#1a241b" : "#fff";
    const blueBoxBg = theme.isDark ? "rgba(30,58,138,0.2)" : "#eff6ff";
    const blueBoxBorder = theme.isDark ? "rgba(37,99,235,0.45)" : "#bfdbfe";

    return (
        <View>
            <Text style={[styles.title, { color: theme.text }]}>{tr("help.title")}</Text>

            <View style={[styles.searchWrap, { borderColor: theme.border, backgroundColor: inputBg }]}>
                <Text style={styles.searchIcon}>🔎</Text>
                <TextInput
                    value={searchTerm}
                    onChangeText={setSearchTerm}
                    placeholder={tr("help.searchPlaceholder")}
                    placeholderTextColor={theme.textSubtle}
                    style={[styles.searchInput, { color: theme.text }]}
                />
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.catRow}>
                {categories.map((cat) => {
                    const active = activeCategory === cat;
                    return (
                        <TouchableOpacity
                            key={cat}
                            onPress={() => setSelectedCategory(cat)}
                            style={[
                                styles.catChip,
                                active
                                    ? { backgroundColor: "#2563eb", borderColor: "#2563eb" }
                                    : { backgroundColor: chipInactiveBg, borderColor: chipInactiveBorder },
                            ]}
                            activeOpacity={0.85}
                        >
                            <Text
                                style={[
                                    styles.catChipText,
                                    { color: active ? "#fff" : theme.isDark ? "#d1d5db" : "#1f2937" },
                                ]}
                                numberOfLines={2}
                            >
                                {cat}
                            </Text>
                        </TouchableOpacity>
                    );
                })}
            </ScrollView>

            {filtered.length > 0 ? (
                filtered.map((faq) => {
                    const open = openId === faq.id;
                    return (
                        <View
                            key={faq.id}
                            style={[styles.faqOuter, { backgroundColor: faqCardBg, borderColor: theme.border }]}
                        >
                            <TouchableOpacity
                                style={styles.faqHead}
                                onPress={() => setOpenId(open ? null : faq.id)}
                                activeOpacity={0.75}
                            >
                                <View style={styles.faqHeadLeft}>
                                    <View style={[styles.badge, { backgroundColor: theme.isDark ? "rgba(37,99,235,0.35)" : "#dbeafe" }]}>
                                        <Text style={[styles.badgeText, { color: theme.isDark ? "#93c5fd" : "#2563eb" }]}>
                                            {faq.category}
                                        </Text>
                                    </View>
                                    <Text style={[styles.faqQ, { color: theme.text, flex: 1 }]}>{faq.question}</Text>
                                </View>
                                <Text style={[styles.chevron, open && styles.chevronOpen]}>▼</Text>
                            </TouchableOpacity>
                            {open ? (
                                <View style={[styles.faqBody, { borderTopColor: theme.border }]}>
                                    <Text style={[styles.faqA, { color: theme.textMuted }]}>{faq.answer}</Text>
                                </View>
                            ) : null}
                        </View>
                    );
                })
            ) : (
                <View style={styles.empty}>
                    <Text style={styles.emptyEmoji}>🔍</Text>
                    <Text style={[styles.emptyTitle, { color: theme.text }]}>{tr("help.noResultsTitle")}</Text>
                    <Text style={[styles.emptyDesc, { color: theme.textMuted }]}>{tr("help.noResultsDesc")}</Text>
                </View>
            )}

            <View style={[styles.moreBox, { backgroundColor: blueBoxBg, borderColor: blueBoxBorder }]}>
                <Text style={[styles.moreTitle, { color: theme.isDark ? "#93c5fd" : "#1e3a8a" }]}>
                    {tr("help.moreHelpTitle")}
                </Text>
                <Text style={[styles.moreText, { color: theme.isDark ? "#93c5fd" : "#1d4ed8" }]}>
                    {tr("help.moreHelpText")}{" "}
                    <Text style={{ fontWeight: "800" }}>{CONTACT_EMAIL}</Text>
                </Text>
                <TouchableOpacity
                    style={styles.moreBtn}
                    onPress={() => void Linking.openURL(CONTACT_URL)}
                    activeOpacity={0.85}
                >
                    <Text style={styles.moreBtnText}>{tr("help.contactBtn")}</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    title: { fontSize: 28, fontWeight: "700", textAlign: "center", marginBottom: 24 },
    searchWrap: {
        flexDirection: "row",
        alignItems: "center",
        borderWidth: 1,
        borderRadius: 16,
        paddingHorizontal: 12,
        paddingVertical: 10,
        marginBottom: 16,
    },
    searchIcon: { fontSize: 16, marginRight: 8 },
    searchInput: { flex: 1, fontSize: 16, paddingVertical: 4 },
    catRow: { flexDirection: "row", gap: 10, paddingBottom: 8, marginBottom: 16 },
    catChip: {
        minWidth: 88,
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: 16,
        borderWidth: 1,
        justifyContent: "center",
    },
    catChipText: { fontSize: 13, fontWeight: "700", textAlign: "center" },
    faqOuter: { borderWidth: 1, borderRadius: 10, marginBottom: 14, overflow: "hidden" },
    faqHead: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 18,
        paddingVertical: 14,
    },
    faqHeadLeft: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1, paddingRight: 8 },
    badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
    badgeText: { fontSize: 12, fontWeight: "700" },
    faqQ: { fontSize: 15, fontWeight: "600" },
    chevron: { fontSize: 12, color: "#9ca3af" },
    chevronOpen: { transform: [{ rotate: "180deg" }] },
    faqBody: { paddingHorizontal: 18, paddingBottom: 16, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth },
    faqA: { fontSize: 15, lineHeight: 22 },
    empty: { alignItems: "center", paddingVertical: 40 },
    emptyEmoji: { fontSize: 48, marginBottom: 12 },
    emptyTitle: { fontSize: 20, fontWeight: "700", marginBottom: 8 },
    emptyDesc: { fontSize: 15, textAlign: "center" },
    moreBox: {
        marginTop: 28,
        padding: 22,
        borderRadius: 10,
        borderWidth: 1,
        alignItems: "center",
    },
    moreTitle: { fontSize: 17, fontWeight: "700", marginBottom: 8, textAlign: "center" },
    moreText: { fontSize: 15, lineHeight: 22, textAlign: "center", marginBottom: 16 },
    moreBtn: { backgroundColor: "#2563eb", paddingHorizontal: 22, paddingVertical: 10, borderRadius: 10 },
    moreBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
});
