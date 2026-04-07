import React, { useCallback } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Dimensions } from "react-native";
import { Image } from "expo-image";
import { useThemeColors } from "../../hooks/useThemeColors";
import { useLocale } from "../../lib/useLocale";
import type { CourseReview } from "./types";

interface ReviewCardProps {
    item: CourseReview;
    onImagePress: (images: string[], index: number) => void;
}

export const ReviewCard = React.memo(function ReviewCard({ item, onImagePress }: ReviewCardProps) {
    const t = useThemeColors();
    const { t: i18n } = useLocale();

    const handleImagePress = useCallback((idx: number) => {
        onImagePress(item.imageUrls!, idx);
    }, [onImagePress, item.imageUrls]);

    return (
        <View style={[s.reviewCard, { backgroundColor: t.isDark ? "rgba(26,36,27,0.5)" : "#f9fafb" }]}>
            <View style={s.reviewTop}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <Image
                        source={{ uri: item.profileImageUrl || "https://d13xx6k6chk2in.cloudfront.net/profileLogo.png" }}
                        style={s.reviewAvatar}
                    />
                    <Text style={[s.reviewUser, { color: t.text }]}>
                        {item.userName.trim() ? item.userName : i18n("mobile.courseScreen.anonymous")}
                    </Text>
                </View>
                <Text style={[s.reviewDate, { color: t.textMuted }]}>
                    {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : ""}
                </Text>
            </View>
            {item.rating > 0 ? (
                <View style={{ flexDirection: "row", gap: 2, marginBottom: 8 }}>
                    {[1, 2, 3, 4, 5].map((star) => (
                        <Text
                            key={star}
                            style={{
                                fontSize: 13,
                                color: star <= item.rating ? "#facc15" : t.isDark ? "#374151" : "#e5e7eb",
                            }}
                        >
                            ★
                        </Text>
                    ))}
                </View>
            ) : null}
            <Text style={[s.reviewContent, { color: t.isDark ? "#d1d5db" : "#4b5563" }]}>
                {item.content}
            </Text>
            {item.imageUrls && item.imageUrls.length > 0 && (
                <View style={s.reviewImgGrid}>
                    {item.imageUrls.map((uri, idx) => (
                        <TouchableOpacity
                            key={idx}
                            activeOpacity={0.85}
                            onPress={() => handleImagePress(idx)}
                        >
                            <Image source={{ uri }} style={s.reviewImgThumb} contentFit="cover" />
                        </TouchableOpacity>
                    ))}
                </View>
            )}
        </View>
    );
});

const s = StyleSheet.create({
    reviewCard: { borderRadius: 16, padding: 20 },
    reviewAvatar: { width: 32, height: 32, borderRadius: 16 },
    reviewTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
    reviewUser: { fontSize: 14, fontWeight: "500" },
    reviewDate: { fontSize: 12 },
    reviewContent: { fontSize: 15, lineHeight: 24 },
    reviewImgGrid: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 6,
        marginTop: 10,
    },
    reviewImgThumb: {
        width: (Dimensions.get("window").width - 32 - 40 - 12) / 3,
        aspectRatio: 1,
        borderRadius: 8,
        backgroundColor: "#e5e7eb",
    },
});
