import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useThemeColors } from "../../hooks/useThemeColors";
import { useLocale } from "../../lib/useLocale";
import { parseTipsFromDbForLocale, getTipCategoryLabel } from "../../../../src/types/tip";
import type { CourseUiLocale } from "../../../../src/lib/courseTranslate";
import { TipCategoryIcon } from "./TipCategoryIcon";
import { coursePlaceToTipsRow } from "./utils";
import type { CoursePlace } from "./types";

/** 보유 꿀팁 칩 (웹과 동일): 카테고리 아이콘 + 이름만, 내용은 장소 정보 모달에서 */
export function TipChips({ coursePlace, max = 3, oneLine = false }: { coursePlace: CoursePlace; max?: number; oneLine?: boolean }) {
    const t = useThemeColors();
    const { t: i18n, locale } = useLocale();
    const categories = [
        ...new Set(parseTipsFromDbForLocale(coursePlaceToTipsRow(coursePlace), locale as CourseUiLocale).map((tip) => tip.category)),
    ];
    if (categories.length === 0) return null;
    return (
        <View style={s.wrap}>
            <Text style={[s.label, { color: t.isDark ? "#9ca3af" : "#4b5563" }]}>✨ {i18n("courseDetail.freeTips")}</Text>
            {/* oneLine: 한 줄 고정, 넘치는 칩은 카드 끝에서 잘림 */}
            <View style={oneLine ? s.oneLine : s.row}>
                {(oneLine ? categories : categories.slice(0, max)).map((cat) => (
                    <View
                        key={cat}
                        style={[s.chip, { backgroundColor: t.isDark ? "#374151" : "#F3F4F6", borderColor: t.isDark ? "rgba(6,95,70,0.4)" : "#d1fae5" }]}
                    >
                        <TipCategoryIcon category={cat} color={t.isDark ? "#34d399" : "#059669"} />
                        <Text style={[s.chipText, { color: t.isDark ? "#34d399" : "#047857" }]}>{getTipCategoryLabel(cat, i18n as any)}</Text>
                    </View>
                ))}
                {!oneLine && categories.length > max && <Text style={[s.chipText, { color: "#6b7280" }]}>...</Text>}
            </View>
        </View>
    );
}

const s = StyleSheet.create({
    wrap: { marginTop: 8, gap: 6 },
    label: { fontSize: 11, fontWeight: "700" },
    row: { flexDirection: "row", flexWrap: "wrap", gap: 6, alignItems: "center" },
    oneLine: { flexDirection: "row", gap: 6, alignItems: "center", overflow: "hidden" },
    chip: { flexDirection: "row", alignItems: "center", gap: 4, paddingVertical: 2, paddingHorizontal: 8, borderRadius: 6, borderWidth: 1 },
    chipText: { fontSize: 11, fontWeight: "500" },
});
