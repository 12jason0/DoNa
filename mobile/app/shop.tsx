/**
 * 구독/결제 화면 — /shop
 * RevenueCat react-native-purchases 연동
 *
 * 플랜:
 *  sub_basic     kr.io.dona.ai_basic_monthly   4,900원/월  BASIC
 *  sub_premium   kr.io.dona.premium_monthly    9,900원/월  PREMIUM
 *  ticket_basic  kr.io.dona.course_basic         990원     BASIC 1회권
 *  ticket_premium kr.io.dona.course_premium     1,900원    PREMIUM 1회권
 */
import React, { useState, useEffect, useCallback } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, router } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Purchases, { PurchasesPackage } from "react-native-purchases";

import { api, endpoints } from "../src/lib/api";
import { AUTH_QUERY_KEY } from "../src/hooks/useAuth";
import { Colors, FontSize, Spacing, BorderRadius } from "../src/constants/theme";
import { useThemeColors } from "../src/hooks/useThemeColors";
import type { UserProfile, SubscriptionTier } from "../src/types/api";

// ─── 플랜 정의 ────────────────────────────────────────────────────────────────

const PRODUCT_ID_MAP: Record<string, string> = {
    "kr.io.dona.ai_basic_monthly": "sub_basic",
    "kr.io.dona.premium_monthly": "sub_premium",
    "kr.io.dona.course_basic": "ticket_basic",
    "kr.io.dona.course_premium": "ticket_premium",
};

interface Plan {
    id: string;
    type: "sub" | "ticket";
    tier: "BASIC" | "PREMIUM";
    defaultPrice: number;
    period?: string;
    badge?: string;
    badgeColor?: string;
    title: string;
    desc: string;
    features: string[];
    pkg?: PurchasesPackage;
}

const BASE_PLANS: Omit<Plan, "pkg">[] = [
    {
        id: "sub_basic",
        type: "sub",
        tier: "BASIC",
        defaultPrice: 4900,
        period: "/월",
        badge: "EARLY BIRD",
        badgeColor: "#16a34a",
        title: "BASIC 구독",
        desc: "인기 코스를 마음껏",
        features: ["모든 BASIC 코스 무제한", "AI 추천 하루 5회", "기록·앨범 10개"],
    },
    {
        id: "sub_premium",
        type: "sub",
        tier: "PREMIUM",
        defaultPrice: 9900,
        period: "/월",
        badge: "VIP",
        badgeColor: "#d97706",
        title: "PREMIUM 구독",
        desc: "모든 기능을 무제한으로",
        features: ["모든 코스 무제한 (BASIC + PREMIUM)", "AI 추천 무제한", "기록·앨범 무제한", "프리미엄 맞춤 추천"],
    },
    {
        id: "ticket_basic",
        type: "ticket",
        tier: "BASIC",
        defaultPrice: 990,
        title: "BASIC 1회권",
        desc: "BASIC 코스 1개 열람",
        features: ["선택한 BASIC 코스 1개 영구 열람"],
    },
    {
        id: "ticket_premium",
        type: "ticket",
        tier: "PREMIUM",
        defaultPrice: 1900,
        title: "PREMIUM 1회권",
        desc: "PREMIUM 코스 1개 열람",
        features: ["선택한 PREMIUM 코스 1개 영구 열람"],
    },
];

// ─── 유틸 ─────────────────────────────────────────────────────────────────────

function formatPrice(price: number): string {
    return price.toLocaleString("ko-KR") + "원";
}

function tierOrder(tier: SubscriptionTier): number {
    return { FREE: 0, BASIC: 1, PREMIUM: 2 }[tier] ?? 0;
}

// ─── Plan Card ────────────────────────────────────────────────────────────────

function PlanCard({
    plan,
    selected,
    disabled,
    onSelect,
}: {
    plan: Plan;
    selected: boolean;
    disabled: boolean;
    onSelect: () => void;
}) {
    const t = useThemeColors();
    const price = plan.pkg ? plan.pkg.product.priceString : formatPrice(plan.defaultPrice) + (plan.period ?? "");

    return (
        <TouchableOpacity
            style={[
                styles.planCard,
                { backgroundColor: t.surface },
                selected && styles.planCardSelected,
                disabled && styles.planCardDisabled,
            ]}
            onPress={onSelect}
            disabled={disabled}
            activeOpacity={0.85}
        >
            {/* 상단 배지 + 라디오 */}
            <View style={styles.planCardHeader}>
                <View style={styles.planTitleRow}>
                    {plan.badge ? (
                        <View style={[styles.planBadge, { backgroundColor: plan.badgeColor ?? "#6b7280" }]}>
                            <Text style={styles.planBadgeText}>{plan.badge}</Text>
                        </View>
                    ) : null}
                    <Text style={[styles.planTitle, { color: t.text }, disabled && { color: "#9ca3af" }]}>
                        {plan.title}
                    </Text>
                </View>
                <View style={[styles.radio, selected && styles.radioSelected]}>
                    {selected && <View style={styles.radioDot} />}
                </View>
            </View>

            {/* 가격 */}
            <Text style={[styles.planPrice, { color: t.text }, disabled && { color: "#9ca3af" }]}>
                {disabled ? "현재 이용 중" : price}
            </Text>

            {/* 설명 */}
            <Text style={[styles.planDesc, { color: t.textMuted }, disabled && { color: "#9ca3af" }]}>{plan.desc}</Text>

            {/* 기능 목록 */}
            {selected && !disabled && (
                <View style={styles.featureList}>
                    {plan.features.map((f, i) => (
                        <View key={i} style={styles.featureRow}>
                            <Text style={styles.featureCheck}>✓</Text>
                            <Text style={[styles.featureText, { color: t.text }]}>{f}</Text>
                        </View>
                    ))}
                </View>
            )}
        </TouchableOpacity>
    );
}

// ─── 메인 화면 ────────────────────────────────────────────────────────────────

export default function ShopScreen() {
    const t = useThemeColors();
    const { context = "UPGRADE", courseGrade } = useLocalSearchParams<{
        context?: "UPGRADE" | "COURSE";
        courseGrade?: "BASIC" | "PREMIUM";
    }>();

    const queryClient = useQueryClient();

    const [plans, setPlans] = useState<Plan[]>(BASE_PLANS.map((p) => ({ ...p })));
    const [selectedId, setSelectedId] = useState("sub_basic");
    const [offeringsLoading, setOfferingsLoading] = useState(true);
    const [purchasing, setPurchasing] = useState(false);
    const [restoring, setRestoring] = useState(false);

    // 현재 유저 등급
    const { data: profile } = useQuery<UserProfile>({
        queryKey: ["profile"],
        queryFn: () => api.get<UserProfile>(endpoints.profile),
        retry: false,
    });

    const currentTier: SubscriptionTier = (profile?.subscriptionTier ??
        profile?.subscription_tier ??
        "FREE") as SubscriptionTier;

    // RevenueCat offerings 로드
    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const offerings = await Purchases.getOfferings();
                if (cancelled) return;
                const pkgs = offerings.current?.availablePackages ?? [];

                setPlans((prev) =>
                    prev.map((plan) => {
                        const pkg = pkgs.find((p) => PRODUCT_ID_MAP[p.product.identifier] === plan.id);
                        return pkg ? { ...plan, pkg } : plan;
                    }),
                );
            } catch (e) {
                // RevenueCat 로드 실패 시 기본 가격 사용
            } finally {
                if (!cancelled) setOfferingsLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    // context + currentTier에 따라 기본 선택 플랜 설정
    useEffect(() => {
        if (context === "UPGRADE") {
            setSelectedId(currentTier === "BASIC" ? "sub_premium" : "sub_basic");
            return;
        }
        if (context === "COURSE" && courseGrade) {
            if (currentTier === "BASIC") {
                setSelectedId(courseGrade === "BASIC" ? "sub_premium" : "ticket_premium");
            } else {
                setSelectedId(courseGrade === "BASIC" ? "ticket_basic" : "ticket_premium");
            }
        }
    }, [context, courseGrade, currentTier]);

    // shop은 구독권만 — 1회권은 코스 상세에서 직접 처리
    const visiblePlans = plans.filter((p) => p.type === "sub");

    const isDisabled = useCallback(
        (plan: Plan): boolean => {
            const currentOrder = tierOrder(currentTier);
            const planOrder = tierOrder(plan.tier);
            if (plan.type === "sub") return planOrder <= currentOrder && currentOrder > 0;
            return false;
        },
        [currentTier],
    );

    const handlePurchase = useCallback(async () => {
        const plan = plans.find((p) => p.id === selectedId);
        if (!plan) return;

        if (isDisabled(plan)) {
            Alert.alert("알림", "이미 이용 중인 플랜입니다.");
            return;
        }

        if (!plan.pkg) {
            Alert.alert("알림", "결제 상품을 불러오는 중입니다. 잠시 후 다시 시도해주세요.");
            return;
        }

        setPurchasing(true);
        try {
            const { customerInfo } = await Purchases.purchasePackage(plan.pkg);

            // 서버에 구독 반영 (웹훅 지연 방지)
            try {
                await api.post("/api/payments/revenuecat/confirm", {
                    planId: plan.id,
                    planType: plan.type,
                    transactionId: null,
                    customerInfo,
                });
            } catch {
                // confirm 실패해도 웹훅이 처리 — 무시
            }

            queryClient.invalidateQueries({ queryKey: ["profile"] });
            queryClient.invalidateQueries({ queryKey: AUTH_QUERY_KEY });

            Alert.alert("결제 완료 🎉", `${plan.title} 구독이 시작되었습니다!\n이제 코스를 마음껏 이용해보세요.`, [
                { text: "확인", onPress: () => router.back() },
            ]);
        } catch (e: any) {
            if (e?.userCancelled) return;
            Alert.alert("결제 실패", e?.message ?? "결제 중 오류가 발생했습니다. 다시 시도해주세요.");
        } finally {
            setPurchasing(false);
        }
    }, [plans, selectedId, isDisabled, queryClient]);

    const handleRestore = useCallback(async () => {
        setRestoring(true);
        try {
            const customerInfo = await Purchases.restorePurchases();
            queryClient.invalidateQueries({ queryKey: ["profile"] });
            const hasActive = Object.keys(customerInfo.entitlements.active).length > 0;
            Alert.alert("구매 복원", hasActive ? "구매 내역이 복원되었습니다." : "복원할 구매 내역이 없습니다.", [
                { text: "확인" },
            ]);
        } catch (e: any) {
            Alert.alert("복원 실패", e?.message ?? "복원 중 오류가 발생했습니다.");
        } finally {
            setRestoring(false);
        }
    }, [queryClient]);

    const selectedPlan = plans.find((p) => p.id === selectedId);
    const canPurchase = selectedPlan && !isDisabled(selectedPlan) && selectedPlan.pkg;

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: t.bg }]} edges={["top"]}>
            {/* 헤더 */}
            <View style={[styles.header, { borderBottomColor: t.border }]}>
                <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                    <Text style={[styles.backBtn, { color: t.text }]}>←</Text>
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: t.text }]}>구독 플랜</Text>
                <View style={{ width: 32 }} />
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
                {/* 현재 등급 */}
                <View style={styles.currentTierWrap}>
                    <Text style={[styles.currentTierLabel, { color: t.textMuted }]}>현재 등급</Text>
                    <View
                        style={[
                            styles.currentTierBadge,
                            currentTier === "PREMIUM" && { backgroundColor: "#fef3c7", borderColor: "#fde68a" },
                            currentTier === "BASIC" && { backgroundColor: "#dcfce7", borderColor: "#bbf7d0" },
                            currentTier === "FREE" && { backgroundColor: "#f3f4f6", borderColor: "#e5e7eb" },
                        ]}
                    >
                        <Text
                            style={[
                                styles.currentTierText,
                                currentTier === "PREMIUM" && { color: "#92400e" },
                                currentTier === "BASIC" && { color: "#16a34a" },
                                currentTier === "FREE" && { color: "#6b7280" },
                            ]}
                        >
                            {currentTier === "FREE" ? "무료 플랜" : `${currentTier} 구독 중`}
                        </Text>
                    </View>
                </View>

                {/* 타이틀 */}
                <View style={styles.titleSection}>
                    <Text style={[styles.titleMain, { color: t.text }]}>
                        더 많은 데이트를{"\n"}
                        <Text style={{ color: Colors.brandGreen }}>경험해보세요</Text>
                    </Text>
                    <Text style={[styles.titleSub, { color: t.textMuted }]}>언제든 취소할 수 있어요</Text>
                </View>

                {/* 플랜 카드들 */}
                {offeringsLoading ? (
                    <View style={styles.loadingWrap}>
                        <ActivityIndicator color={Colors.brandGreen} />
                        <Text style={styles.loadingText}>플랜 정보 불러오는 중...</Text>
                    </View>
                ) : (
                    <View style={styles.planList}>
                        {visiblePlans.map((plan) => (
                            <PlanCard
                                key={plan.id}
                                plan={plan}
                                selected={selectedId === plan.id}
                                disabled={isDisabled(plan)}
                                onSelect={() => !isDisabled(plan) && setSelectedId(plan.id)}
                            />
                        ))}
                    </View>
                )}

                {/* 구독 안내 */}
                <View style={[styles.notice, { backgroundColor: t.surface }]}>
                    <Text style={[styles.noticeText, { color: t.textMuted }]}>
                        • 구독은 자동으로 갱신됩니다{"\n"}• 갱신 24시간 전에 취소할 수 있습니다{"\n"}•{" "}
                        {Platform.OS === "ios" ? "App Store" : "Google Play"} 계정으로 결제됩니다{"\n"}• 구독 관리:{" "}
                        {Platform.OS === "ios" ? "설정 → Apple ID → 구독" : "Play Store → 구독"}
                    </Text>
                </View>

                {/* 구매 복원 */}
                <TouchableOpacity style={styles.restoreBtn} onPress={handleRestore} disabled={restoring}>
                    {restoring ? (
                        <ActivityIndicator size="small" color={Colors.brandGreen} />
                    ) : (
                        <Text style={styles.restoreBtnText}>이전 구매 복원하기</Text>
                    )}
                </TouchableOpacity>

                <View style={{ height: 100 }} />
            </ScrollView>

            {/* CTA 버튼 */}
            <View style={[styles.ctaWrap, { backgroundColor: t.card, borderTopColor: t.border }]}>
                <TouchableOpacity
                    style={[styles.ctaBtn, (!canPurchase || purchasing) && styles.ctaBtnDisabled]}
                    onPress={handlePurchase}
                    disabled={!canPurchase || purchasing}
                    activeOpacity={0.85}
                >
                    {purchasing ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <Text style={styles.ctaBtnText}>
                            {!selectedPlan
                                ? "플랜을 선택해주세요"
                                : isDisabled(selectedPlan)
                                  ? "현재 이용 중인 플랜"
                                  : !selectedPlan.pkg
                                    ? "상품 로딩 중..."
                                    : `${selectedPlan.title} 시작하기`}
                        </Text>
                    )}
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}

// ─── 스타일 ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#fff" },
    header: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: Spacing[4],
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: "#f3f4f6",
    },
    backBtn: { fontSize: 22, color: Colors.brandInk, fontWeight: "700" },
    headerTitle: {
        fontSize: FontSize.lg,
        fontWeight: "800",
        color: "#111827",
        letterSpacing: -0.3,
    },
    scrollContent: { paddingBottom: 20 },
    currentTierWrap: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: Spacing[4],
        paddingTop: 20,
        paddingBottom: 4,
    },
    currentTierLabel: { fontSize: FontSize.sm, color: "#9ca3af", fontWeight: "500" },
    currentTierBadge: {
        paddingHorizontal: 12,
        paddingVertical: 5,
        borderRadius: 999,
        borderWidth: 1,
    },
    currentTierText: { fontSize: FontSize.sm, fontWeight: "700" },
    titleSection: {
        paddingHorizontal: Spacing[4],
        paddingTop: 16,
        paddingBottom: 20,
    },
    titleMain: {
        fontSize: 26,
        fontWeight: "900",
        color: "#111827",
        letterSpacing: -0.5,
        lineHeight: 36,
        marginBottom: 6,
    },
    titleSub: { fontSize: FontSize.sm, color: "#9ca3af" },
    loadingWrap: {
        paddingVertical: 40,
        alignItems: "center",
        gap: 10,
    },
    loadingText: { fontSize: FontSize.sm, color: "#9ca3af" },
    planList: { paddingHorizontal: Spacing[3], gap: 10 },
    // ─── Plan Card ─────────────────────────────────────────────────────────────
    planCard: {
        backgroundColor: "#f9fafb",
        borderRadius: BorderRadius.xl,
        padding: 18,
        borderWidth: 2,
        borderColor: "transparent",
    },
    planCardSelected: {
        backgroundColor: "#f0fdf4",
        borderColor: Colors.brandGreen,
    },
    planCardDisabled: {
        backgroundColor: "#f9fafb",
        opacity: 0.6,
    },
    planCardHeader: {
        flexDirection: "row",
        alignItems: "flex-start",
        justifyContent: "space-between",
        marginBottom: 6,
    },
    planTitleRow: { flexDirection: "row", alignItems: "center", gap: 8, flex: 1 },
    planBadge: {
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 999,
    },
    planBadgeText: { color: "#fff", fontSize: 10, fontWeight: "800", letterSpacing: 0.3 },
    planTitle: { fontSize: FontSize.base, fontWeight: "700", color: "#111827" },
    radio: {
        width: 22,
        height: 22,
        borderRadius: 11,
        borderWidth: 2,
        borderColor: "#d1d5db",
        alignItems: "center",
        justifyContent: "center",
        marginLeft: 8,
    },
    radioSelected: { borderColor: Colors.brandGreen },
    radioDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: Colors.brandGreen,
    },
    planPrice: {
        fontSize: 22,
        fontWeight: "900",
        color: "#111827",
        letterSpacing: -0.5,
        marginBottom: 2,
    },
    planDesc: { fontSize: FontSize.sm, color: "#6b7280", marginBottom: 6 },
    featureList: { marginTop: 10, gap: 6 },
    featureRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
    featureCheck: { color: Colors.brandGreen, fontWeight: "800", fontSize: FontSize.sm, marginTop: 1 },
    featureText: { fontSize: FontSize.sm, color: "#374151", flex: 1, lineHeight: 20 },
    // ─── 안내 ───────────────────────────────────────────────────────────────────
    notice: {
        margin: Spacing[4],
        padding: 14,
        backgroundColor: "#f9fafb",
        borderRadius: BorderRadius.lg,
    },
    noticeText: { fontSize: 11, color: "#9ca3af", lineHeight: 18 },
    restoreBtn: {
        alignSelf: "center",
        paddingVertical: 10,
        paddingHorizontal: 20,
    },
    restoreBtnText: { fontSize: FontSize.sm, color: Colors.brandGreen, fontWeight: "600" },
    // ─── CTA ────────────────────────────────────────────────────────────────────
    ctaWrap: {
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        padding: Spacing[4],
        paddingBottom: 34,
        backgroundColor: "#fff",
        borderTopWidth: 1,
        borderTopColor: "#f3f4f6",
    },
    ctaBtn: {
        backgroundColor: Colors.brandGreen,
        borderRadius: BorderRadius.xl,
        paddingVertical: 16,
        alignItems: "center",
    },
    ctaBtnDisabled: { backgroundColor: "#d1d5db" },
    ctaBtnText: { color: "#fff", fontSize: FontSize.base, fontWeight: "800", letterSpacing: -0.3 },
});
