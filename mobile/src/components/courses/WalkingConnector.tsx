import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocale } from "../../lib/useLocale";

export const WalkingConnector = React.memo(function WalkingConnector({ minutes }: { minutes: number }) {
    const { t: i18n } = useLocale();
    return (
        <View style={s.walkConnector}>
            <View style={s.walkLine} />
            <View style={s.walkBadge}>
                <Ionicons name="walk-outline" size={11} color="#6b7280" />
                <Text style={s.walkText}>{i18n("courseDetail.walkingMinutes", { minutes })}</Text>
            </View>
            <View style={s.walkLine} />
        </View>
    );
});

const s = StyleSheet.create({
    walkConnector: { flexDirection: "row", alignItems: "center", marginVertical: 6, paddingHorizontal: 20 },
    walkLine: { flex: 1, height: 1, backgroundColor: "#e5e7eb" },
    walkBadge: {
        flexDirection: "row",
        alignItems: "center",
        gap: 3,
        paddingHorizontal: 10,
        paddingVertical: 3,
        backgroundColor: "#f9fafb",
        borderRadius: 999,
        marginHorizontal: 8,
    },
    walkText: { fontSize: 11, color: "#6b7280", fontWeight: "500" },
});
