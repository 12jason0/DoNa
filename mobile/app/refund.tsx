import React, { useState } from "react";
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    TextInput,
    Alert,
    ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

const REASONS = ["서비스 불만족", "단순 변심", "중복 구매", "기타"];

export default function RefundScreen() {
    const { paymentId } = useLocalSearchParams<{ paymentId?: string }>();

    const [selectedReason, setSelectedReason] = useState<string | null>(null);
    const [customReason, setCustomReason] = useState("");
    const [submitting, setSubmitting] = useState(false);

    const handleSubmit = async () => {
        const reason = selectedReason === "기타" ? customReason.trim() : selectedReason;
        if (!reason) {
            Alert.alert("환불 사유를 선택하거나 입력해주세요.");
            return;
        }
        if (!paymentId) {
            Alert.alert("결제 정보를 찾을 수 없습니다.");
            return;
        }

        setSubmitting(true);
        try {
            const res = await fetch("https://dona.io.kr/api/payments/refund-request", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ paymentId, reason }),
            });
            if (!res.ok) throw new Error("fail");
            Alert.alert(
                "환불 신청 완료",
                "환불 신청이 접수되었습니다.\n영업일 기준 1~3일 내 처리됩니다.",
                [{ text: "확인", onPress: () => router.back() }]
            );
        } catch {
            Alert.alert("오류 발생", "잠시 후 다시 시도해주세요.");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <SafeAreaView style={styles.container} edges={["top"]}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Ionicons name="chevron-back" size={24} color="#1e2a1a" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>환불 신청</Text>
                <View style={{ width: 24 }} />
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                <View style={styles.noticeBox}>
                    <Text style={styles.noticeText}>
                        {"• 환불 신청 후 영업일 기준 1~3일 내에 처리됩니다.\n• 이미 사용한 열람권은 환불이 제한될 수 있습니다."}
                    </Text>
                </View>

                <Text style={styles.sectionLabel}>환불 사유</Text>

                <View style={{ gap: 8, marginBottom: 20 }}>
                    {REASONS.map((r) => {
                        const selected = selectedReason === r;
                        return (
                            <TouchableOpacity
                                key={r}
                                style={[
                                    styles.reasonBtn,
                                    selected && styles.reasonBtnSelected,
                                ]}
                                onPress={() => setSelectedReason(r)}
                                activeOpacity={0.7}
                            >
                                <Ionicons
                                    name={selected ? "radio-button-on" : "radio-button-off"}
                                    size={18}
                                    color={selected ? "#10b981" : "#6b7280"}
                                />
                                <Text style={styles.reasonText}>{r}</Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>

                {selectedReason === "기타" && (
                    <TextInput
                        style={styles.textInput}
                        placeholder="환불 사유를 직접 입력해주세요."
                        placeholderTextColor="#9ca3af"
                        value={customReason}
                        onChangeText={setCustomReason}
                        multiline
                        numberOfLines={4}
                        textAlignVertical="top"
                    />
                )}

                <TouchableOpacity
                    style={[styles.submitBtn, { opacity: submitting ? 0.7 : 1 }]}
                    onPress={handleSubmit}
                    disabled={submitting}
                    activeOpacity={0.85}
                >
                    {submitting ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <Text style={styles.submitBtnText}>환불 신청하기</Text>
                    )}
                </TouchableOpacity>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#ffffff" },
    header: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: "#e5e7eb",
    },
    headerTitle: { fontSize: 17, fontWeight: "600", color: "#1e2a1a" },
    content: { padding: 20 },
    noticeBox: { borderRadius: 12, padding: 14, backgroundColor: "#f9fafb", marginBottom: 20 },
    noticeText: { fontSize: 13, lineHeight: 20, color: "#6b7280" },
    sectionLabel: { fontSize: 15, fontWeight: "600", color: "#1e2a1a", marginBottom: 12 },
    reasonBtn: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        borderWidth: 1.5,
        borderRadius: 10,
        padding: 14,
        borderColor: "#e5e7eb",
        backgroundColor: "#ffffff",
    },
    reasonBtnSelected: {
        borderColor: "#10b981",
        backgroundColor: "rgba(16,185,129,0.08)",
    },
    reasonText: { fontSize: 15, color: "#1e2a1a" },
    textInput: {
        borderWidth: 1,
        borderRadius: 10,
        padding: 12,
        fontSize: 14,
        minHeight: 100,
        marginTop: 4,
        marginBottom: 12,
        borderColor: "#e5e7eb",
        color: "#1e2a1a",
        backgroundColor: "#ffffff",
    },
    submitBtn: {
        backgroundColor: "#111827",
        borderRadius: 12,
        paddingVertical: 16,
        alignItems: "center",
        marginTop: 8,
    },
    submitBtnText: { color: "#fff", fontSize: 16, fontWeight: "600" },
});
