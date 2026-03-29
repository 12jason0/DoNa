/**
 * TicketPlansSheet — 웹 TicketPlans.tsx 모달과 UI 1:1 대응
 * 바텀 시트 형태 (translateY 스프링 애니메이션) 유지
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Animated,
    Dimensions,
    Easing,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Purchases from "react-native-purchases";
import { useQueryClient } from "@tanstack/react-query";

import { useThemeColors } from "../hooks/useThemeColors";
import { useLocale } from "../lib/useLocale";
import { useAuth, AUTH_QUERY_KEY } from "../hooks/useAuth";
import { api } from "../lib/api";
import NativeLegalModal, { type NativeLegalPage } from "./NativeLegalModal";

// ─── 플랜 정의 (웹 PLANS 동일) ────────────────────────────────────────────────

const PLANS = [
    {
        id: "sub_basic",
        type: "sub" as const,
        price: 4900,
        originalPrice: 9900,
        badge: "EARLY BIRD",
        featureCount: 3,
        tier: "BASIC" as const,
    },
    {
        id: "sub_premium",
        type: "sub" as const,
        price: 9900,
        badge: "VIP",
        featureCount: 4,
        tier: "PREMIUM" as const,
    },
    {
        id: "ticket_basic",
        type: "ticket" as const,
        price: 990,
        tier: "BASIC" as const,
    },
    {
        id: "ticket_premium",
        type: "ticket" as const,
        price: 1900,
        tier: "PREMIUM" as const,
    },
] as const;

type PlanId = (typeof PLANS)[number]["id"];
type Tier = "FREE" | "BASIC" | "PREMIUM";

// RevenueCat 상품 식별자 매핑
const RC_PRODUCT_IDS: Record<string, string> = {
    ticket_basic: "kr.io.dona.course_basic",
    ticket_premium: "kr.io.dona.course_premium",
};

// ─── Props (웹 TicketPlansProps 동일) ─────────────────────────────────────────

export interface TicketPlansSheetProps {
    visible: boolean;
    onClose: () => void;
    courseId?: number;
    courseGrade?: "BASIC" | "PREMIUM";
    /** COURSE: 구독+열람권 | UPGRADE: 구독만 */
    context?: "COURSE" | "UPGRADE";
    /** 결제 성공 후 콜백 */
    onUnlocked?: () => void;
}

const { height: SCREEN_H } = Dimensions.get("window");
const SHEET_HEIGHT = SCREEN_H * 0.8;

// ─── Component ────────────────────────────────────────────────────────────────

export default function TicketPlansSheet({
    visible,
    onClose,
    courseId,
    courseGrade,
    context = "COURSE",
    onUnlocked,
}: TicketPlansSheetProps) {
    const t = useThemeColors();
    const { t: i18n } = useLocale();
    const insets = useSafeAreaInsets();
    const { isAuthenticated } = useAuth();
    const queryClient = useQueryClient();

    const slide = useRef(new Animated.Value(SHEET_HEIGHT)).current;
    const backdrop = useRef(new Animated.Value(0)).current;
    const closingRef = useRef(false);

    const [selectedPlanId, setSelectedPlanId] = useState<PlanId>("sub_basic");
    const selectedPlanIdRef = useRef<PlanId>("sub_basic");
    const [currentTier, setCurrentTier] = useState<Tier>("FREE");
    const [loading, setLoading] = useState(false);
    const [rcPrices, setRcPrices] = useState<Partial<Record<PlanId, string>>>({});
    const [legalPage, setLegalPage] = useState<NativeLegalPage | null>(null);

    // ref 동기화 (티어 로딩 시 최신 selectedPlanId 참조용)
    useEffect(() => { selectedPlanIdRef.current = selectedPlanId; }, [selectedPlanId]);

    // ─── 열기 / 닫기 애니메이션 ──────────────────────────────────────────────

    useEffect(() => {
        if (!visible) { closingRef.current = false; return; }
        slide.setValue(SHEET_HEIGHT);
        backdrop.setValue(0);
        Animated.parallel([
            Animated.spring(slide, { toValue: 0, useNativeDriver: true, tension: 68, friction: 12 }),
            Animated.timing(backdrop, { toValue: 1, duration: 260, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        ]).start();
    }, [visible]);

    const dismiss = useCallback(() => {
        if (closingRef.current) return;
        closingRef.current = true;
        Animated.parallel([
            Animated.timing(slide, { toValue: SHEET_HEIGHT, duration: 260, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
            Animated.timing(backdrop, { toValue: 0, duration: 220, easing: Easing.in(Easing.quad), useNativeDriver: true }),
        ]).start(({ finished }) => { closingRef.current = false; if (finished) onClose(); });
    }, [onClose]);

    // ─── 사용자 등급 조회 ─────────────────────────────────────────────────────

    useEffect(() => {
        if (!visible) return;
        api.get<{ user?: { subscriptionTier?: string } }>("/api/users/profile")
            .then((d) => {
                const tier = (d?.user?.subscriptionTier ?? "FREE") as Tier;
                setCurrentTier(tier);

                // 1) 등급 로딩 직후: 현재 선택이 이미 보유한 구독이면 즉시 교정
                const sid = selectedPlanIdRef.current;
                const sel = PLANS.find((p) => p.id === sid);
                const alreadyOwned =
                    sel?.type === "sub" &&
                    ((tier === "BASIC" && sel.tier === "BASIC") ||
                        (tier === "PREMIUM" && (sel.tier === "BASIC" || sel.tier === "PREMIUM")));
                if (alreadyOwned) {
                    if (context === "UPGRADE") {
                        setSelectedPlanId(tier === "BASIC" ? "sub_premium" : "sub_basic");
                    } else {
                        const firstTicket = PLANS.find((p) => p.type === "ticket");
                        if (firstTicket) setSelectedPlanId(firstTicket.id);
                    }
                }
            })
            .catch(() => setCurrentTier("FREE"));
    }, [visible]);

    // ─── RevenueCat 가격 조회 ─────────────────────────────────────────────────

    useEffect(() => {
        if (!visible) return;
        (async () => {
            try {
                const offerings = await Purchases.getOfferings();
                const pkgs = offerings.current?.availablePackages ?? [];
                const prices: Partial<Record<PlanId, string>> = {};
                for (const pkg of pkgs) {
                    const match = PLANS.find(
                        (p) =>
                            p.id === pkg.identifier ||
                            RC_PRODUCT_IDS[p.id] === pkg.product.identifier,
                    );
                    if (match) prices[match.id] = pkg.product.priceString;
                }
                if (Object.keys(prices).length > 0) setRcPrices(prices);
            } catch { /* fallback: 하드코딩 가격 */ }
        })();
    }, [visible]);

    // ─── 기본 선택 플랜 (웹과 동일 로직) ─────────────────────────────────────

    useEffect(() => {
        if (context === "UPGRADE") {
            setSelectedPlanId(currentTier === "BASIC" ? "sub_premium" : "sub_basic");
            return;
        }
        if (courseId != null && courseGrade) {
            if (currentTier === "BASIC") {
                setSelectedPlanId(courseGrade === "BASIC" ? "sub_premium" : "ticket_premium");
            } else {
                setSelectedPlanId(courseGrade === "BASIC" ? "ticket_basic" : "ticket_premium");
            }
        } else {
            setSelectedPlanId((prev) =>
                prev === "ticket_basic" || prev === "ticket_premium" ? "sub_basic" : prev,
            );
        }
    }, [context, courseId, courseGrade, currentTier]);

    // 2) BASIC 유저 + sub_basic 선택 조합 강제 차단 (이중 안전장치)
    useEffect(() => {
        if (currentTier === "BASIC" && selectedPlanId === "sub_basic") {
            setSelectedPlanId("sub_premium");
        }
    }, [currentTier]);

    // ─── 결제 처리 ────────────────────────────────────────────────────────────

    const handlePayment = async () => {
        const selectedPlan = PLANS.find((p) => p.id === selectedPlanId);
        if (!selectedPlan) return;

        if (!isAuthenticated) {
            Alert.alert(i18n("ticketPlans.alerts.loginRequired"));
            return;
        }
        if (selectedPlan.type === "sub") {
            const owned =
                (currentTier === "BASIC" && selectedPlan.tier === "BASIC") ||
                (currentTier === "PREMIUM");
            if (owned) { Alert.alert(i18n("ticketPlans.alerts.alreadySubscribed")); return; }
        }

        setLoading(true);
        try {
            // 티켓 결제 시 unlock-intent 발급
            let intentId: string | null = null;
            if (selectedPlan.type === "ticket" && courseId != null) {
                const productId = selectedPlan.id === "ticket_basic" ? "course_basic" : "course_premium";
                const res = await api.post<{ intentId?: string }>("/api/payments/unlock-intent", {
                    courseId: Number(courseId), productId, unlockTarget: "FULL",
                });
                if (!res?.intentId) {
                    Alert.alert(i18n("ticketPlans.alerts.paymentFailed"));
                    setLoading(false);
                    return;
                }
                intentId = res.intentId;
            }

            // RevenueCat 패키지 찾기
            const offerings = await Purchases.getOfferings();
            const allPkgs = offerings.current?.availablePackages ?? [];
            const pkg = allPkgs.find(
                (p) =>
                    p.identifier === selectedPlan.id ||
                    RC_PRODUCT_IDS[selectedPlan.id] === p.product.identifier,
            );
            if (!pkg) {
                Alert.alert(i18n("ticketPlans.alerts.paymentError"));
                setLoading(false);
                return;
            }

            const { customerInfo } = await Purchases.purchasePackage(pkg);

            // 티켓 결제 서버 confirm
            if (selectedPlan.type === "ticket" && intentId) {
                try {
                    await api.post("/api/payments/revenuecat/confirm", {
                        planId: selectedPlan.id,
                        planType: "ticket",
                        transactionId: (customerInfo as any)?.originalTransactionId ?? null,
                        customerInfo,
                        intentId,
                        courseId,
                    });
                } catch { /* confirm 실패해도 구매 처리 */ }
            }

            if (courseId != null) queryClient.invalidateQueries({ queryKey: ["course", String(courseId)] });
            queryClient.invalidateQueries({ queryKey: ["profile"] });
            queryClient.invalidateQueries({ queryKey: AUTH_QUERY_KEY });

            Alert.alert(i18n("ticketPlans.alerts.paymentComplete"), undefined, [
                { text: "확인", onPress: () => { dismiss(); onUnlocked?.(); } },
            ]);
        } catch (err: unknown) {
            if (err && typeof err === "object" && "userCancelled" in err && (err as any).userCancelled) return;
            Alert.alert(i18n("ticketPlans.alerts.paymentError"));
        } finally {
            setLoading(false);
        }
    };

    // ─── 헬퍼 ────────────────────────────────────────────────────────────────

    const priceStr = (plan: (typeof PLANS)[number]) =>
        rcPrices[plan.id] ?? `${plan.price.toLocaleString()}원`;

    // 웹과 동일 조건
    const showTickets = courseId != null && courseGrade != null && context !== "UPGRADE";

    const subDisabled = (tier: "BASIC" | "PREMIUM") =>
        (currentTier === "BASIC" && tier === "BASIC") ||
        (currentTier === "PREMIUM" && (tier === "BASIC" || tier === "PREMIUM"));

    const ticketDisabled = (planId: PlanId) =>
        (courseGrade === "BASIC" && planId === "ticket_premium") ||
        (courseGrade === "PREMIUM" && planId === "ticket_basic") ||
        (currentTier === "BASIC" && planId === "ticket_basic");

    const selectedPlan = PLANS.find((p) => p.id === selectedPlanId);

    // ─── 색 ───────────────────────────────────────────────────────────────────

    const sheetBg = t.isDark ? "#1a241b" : "#fff";
    const dividerColor = t.isDark ? "#1f2937" : "#f3f4f6";
    const sectionLabelColor = t.isDark ? "#6b7280" : "#9ca3af";
    const cardBg = t.isDark ? "#0f1710" : "#fff";
    const cardDisabledBg = t.isDark ? "rgba(31,41,55,0.5)" : "#f9fafb";
    const cardSelectedBg = t.isDark ? "rgba(16,185,129,0.2)" : "rgba(236,253,245,0.8)";
    const businessBg = t.isDark ? "rgba(31,41,55,0.5)" : "#f9fafb";

    return (
        <Modal
            visible={visible}
            transparent
            animationType="none"
            onRequestClose={dismiss}
            statusBarTranslucent
            navigationBarTranslucent
        >
            <View style={styles.root} pointerEvents="box-none">
                {/* 어두운 오버레이 (backdrop-blur 대체) */}
                <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={dismiss}>
                    <Animated.View
                        style={[
                            StyleSheet.absoluteFill,
                            { backgroundColor: t.isDark ? "rgba(0,0,0,0.8)" : "rgba(0,0,0,0.7)", opacity: backdrop },
                        ]}
                    />
                </TouchableOpacity>

                {/* 시트 — 웹 rounded-t-3xl = 24px */}
                <Animated.View
                    style={[
                        styles.sheet,
                        {
                            backgroundColor: sheetBg,
                            borderTopColor: dividerColor,
                            height: SHEET_HEIGHT,
                            transform: [{ translateY: slide }],
                        },
                    ]}
                >
                    {/* ── 헤더 (웹과 동일 위계) ─────────────────────────────── */}
                    <View style={[styles.header, { borderBottomColor: dividerColor }]}>
                        <View style={styles.headerLeft}>
                            <Text style={[styles.headerTitle, { color: t.text }]}>
                                {i18n("ticketPlans.mainTitle")}
                                {"\n"}
                                <Text style={styles.headerHighlight}>
                                    {i18n("ticketPlans.mainHighlight")}
                                </Text>
                            </Text>
                            <Text style={[styles.headerSub, { color: sectionLabelColor }]}>
                                {i18n("ticketPlans.mainSubtitle")}
                            </Text>
                        </View>
                        <TouchableOpacity
                            onPress={dismiss}
                            style={[styles.closeBtn, { backgroundColor: t.isDark ? "#374151" : "#f3f4f6" }]}
                            activeOpacity={0.7}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                            <Ionicons name="close" size={14} color={sectionLabelColor} />
                        </TouchableOpacity>
                    </View>

                    {/* ── 스크롤 콘텐츠 ─────────────────────────────────────── */}
                    <ScrollView
                        style={styles.scroll}
                        contentContainerStyle={styles.scrollContent}
                        showsVerticalScrollIndicator={false}
                    >
                        {/* 구독 플랜 섹션 */}
                        <Text style={[styles.sectionLabel, { color: sectionLabelColor }]}>
                            {i18n("ticketPlans.monthlyMembership")}
                        </Text>

                        {PLANS.filter((p) => p.type === "sub").map((plan) => {
                            const disabled = subDisabled(plan.tier);
                            const selected = selectedPlanId === plan.id;
                            return (
                                <TouchableOpacity
                                    key={plan.id}
                                    onPress={() => !disabled && setSelectedPlanId(plan.id)}
                                    activeOpacity={disabled ? 1 : 0.85}
                                    style={[
                                        styles.planCard,
                                        {
                                            borderColor: disabled
                                                ? dividerColor
                                                : selected ? "#10b981" : dividerColor,
                                            backgroundColor: disabled
                                                ? cardDisabledBg
                                                : selected ? cardSelectedBg : cardBg,
                                            opacity: disabled ? 0.5 : 1,
                                        },
                                    ]}
                                >
                                    {/* 배지 */}
                                    {disabled ? (
                                        <View style={[styles.badge, { backgroundColor: "#10b981" }]}>
                                            <Text style={styles.badgeText}>{i18n("ticketPlans.currentPlan")}</Text>
                                        </View>
                                    ) : plan.badge ? (
                                        <View style={[styles.badge, { backgroundColor: plan.badge === "EARLY BIRD" ? "#ef4444" : "#111827" }]}>
                                            <Text style={styles.badgeText}>{plan.badge}</Text>
                                        </View>
                                    ) : null}

                                    <View style={styles.planCardBody}>
                                        {/* 좌측: 이름·설명·가격 */}
                                        <View style={styles.planCardLeft}>
                                            <View style={styles.planNameRow}>
                                                <Text style={[styles.planName, { color: disabled ? sectionLabelColor : t.text, fontFamily: "LINESeedKR-Bd" }]}>
                                                    {i18n(`ticketPlans.plans.${plan.id}.name`)}
                                                </Text>
                                                {selected && !disabled && (
                                                    <Ionicons name="checkmark-circle" size={16} color="#10b981" />
                                                )}
                                            </View>
                                            <Text style={[styles.planDesc, { color: sectionLabelColor }]} numberOfLines={1}>
                                                {disabled
                                                    ? i18n("ticketPlans.alreadySubscribed")
                                                    : i18n(`ticketPlans.plans.${plan.id}.desc`)}
                                            </Text>
                                            <View style={styles.priceRow}>
                                                <Text style={[styles.price, { color: disabled ? sectionLabelColor : t.text, fontFamily: "LINESeedKR-Bd" }]}>
                                                    {priceStr(plan)}
                                                </Text>
                                                {"originalPrice" in plan && !disabled && (
                                                    <Text style={styles.origPrice}>
                                                        {plan.originalPrice.toLocaleString()}원
                                                    </Text>
                                                )}
                                                {!disabled && (
                                                    <Text style={[styles.perMonth, { color: sectionLabelColor }]}>
                                                        {i18n("ticketPlans.perMonth")}
                                                    </Text>
                                                )}
                                            </View>
                                        </View>

                                        {/* 우측: 기능 목록 (웹 sm 이상 우측 컬럼 재현) */}
                                        <View style={[
                                            styles.featureBox,
                                            {
                                                backgroundColor: disabled
                                                    ? t.isDark ? "rgba(31,41,55,0.3)" : "rgba(243,244,246,0.5)"
                                                    : t.isDark ? "rgba(16,185,129,0.05)" : "rgba(236,253,245,0.6)",
                                                borderColor: disabled
                                                    ? dividerColor
                                                    : t.isDark ? "rgba(16,185,129,0.2)" : "rgba(167,243,208,0.5)",
                                            },
                                        ]}>
                                            {Array.from({ length: plan.featureCount }, (_, i) => (
                                                <View key={i} style={styles.featureRow}>
                                                    <Ionicons
                                                        name="checkmark"
                                                        size={9}
                                                        color={disabled ? sectionLabelColor : "#10b981"}
                                                    />
                                                    <Text style={[styles.featureText, { color: disabled ? sectionLabelColor : t.textMuted }]}>
                                                        {i18n(`ticketPlans.plans.${plan.id}.feature${i}`)}
                                                    </Text>
                                                </View>
                                            ))}
                                        </View>
                                    </View>
                                </TouchableOpacity>
                            );
                        })}

                        {/* 코스 열람권 섹션 (웹과 동일 조건) */}
                        {showTickets && (
                            <View style={{ marginTop: 16 }}>
                                <Text style={[styles.sectionLabel, { color: sectionLabelColor }]}>
                                    {i18n("ticketPlans.courseTicket")}
                                </Text>

                                {PLANS.filter((p) => p.type === "ticket").map((plan) => {
                                    const disabled = ticketDisabled(plan.id as PlanId);
                                    // BASIC 유저가 ticket_basic 못 사는 경우 = 이미 보유
                                    const alreadyHas = currentTier === "BASIC" && plan.id === "ticket_basic";
                                    const selected = selectedPlanId === plan.id;

                                    return (
                                        <TouchableOpacity
                                            key={plan.id}
                                            onPress={() => !disabled && setSelectedPlanId(plan.id as PlanId)}
                                            activeOpacity={disabled ? 1 : 0.85}
                                            style={[
                                                styles.ticketCard,
                                                {
                                                    borderColor: disabled
                                                        ? dividerColor
                                                        : selected ? "#10b981" : dividerColor,
                                                    backgroundColor: disabled
                                                        ? cardDisabledBg
                                                        : selected
                                                            ? t.isDark ? "rgba(16,185,129,0.2)" : "rgba(236,253,245,0.8)"
                                                            : t.isDark ? "rgba(31,41,55,0.5)" : "rgba(249,250,251,0.5)",
                                                    opacity: disabled ? 0.5 : 1,
                                                },
                                            ]}
                                        >
                                            {alreadyHas && (
                                                <View style={[styles.badge, styles.badgeInline, { backgroundColor: "#10b981" }]}>
                                                    <Text style={styles.badgeText}>{i18n("ticketPlans.alreadyAvailable")}</Text>
                                                </View>
                                            )}
                                            <View style={styles.ticketRow}>
                                                {/* 도트 인디케이터 */}
                                                <View style={[
                                                    styles.ticketDot,
                                                    { backgroundColor: disabled ? (t.isDark ? "#4b5563" : "#d1d5db") : selected ? "#10b981" : (t.isDark ? "#4b5563" : "#d1d5db") },
                                                ]} />
                                                <Text style={[
                                                    styles.ticketName,
                                                    { color: disabled ? sectionLabelColor : t.text, fontFamily: "LINESeedKR-Bd" },
                                                ]}>
                                                    {i18n(`ticketPlans.plans.${plan.id}.name`)}
                                                </Text>
                                                <Text style={[
                                                    styles.ticketPrice,
                                                    { color: disabled ? sectionLabelColor : t.text, fontFamily: "LINESeedKR-Bd" },
                                                ]}>
                                                    {priceStr(plan)}
                                                </Text>
                                            </View>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                        )}

                        {/* 법적 안내 (웹과 동일 구조) */}
                        <View style={[styles.legalSection, { borderTopColor: dividerColor }]}>
                            {/* 개인정보·EULA 링크 */}
                            <Text style={[styles.legalTitle, { color: t.isDark ? "#9ca3af" : "#6b7280" }]}>
                                {i18n("ticketPlans.legalNotice")}
                            </Text>
                            <View style={styles.legalLinks}>
                                <TouchableOpacity onPress={() => setLegalPage("privacy")}>
                                    <Text style={styles.legalLink}>{i18n("ticketPlans.privacyPolicy")}</Text>
                                </TouchableOpacity>
                                <TouchableOpacity onPress={() => setLegalPage("terms")}>
                                    <Text style={styles.legalLink}>{i18n("ticketPlans.eula")}</Text>
                                </TouchableOpacity>
                            </View>
                            <Text style={[styles.legalText, { color: sectionLabelColor }]}>
                                {i18n("ticketPlans.subscriptionRenewal")}
                            </Text>

                            {/* 사업자 정보 박스 */}
                            <View style={[styles.businessBox, { backgroundColor: businessBg }]}>
                                <Text style={[styles.businessTitle, { color: t.isDark ? "#9ca3af" : "#6b7280" }]}>
                                    {i18n("ticketPlans.businessInfo")}
                                </Text>
                                <Text style={[styles.businessText, { color: sectionLabelColor }]}>{i18n("ticketPlans.businessDetails")}</Text>
                                <Text style={[styles.businessText, { color: sectionLabelColor }]}>{i18n("ticketPlans.businessAddress")}</Text>
                                <Text style={[styles.businessText, { color: sectionLabelColor }]}>{i18n("ticketPlans.businessContact")}</Text>
                                <Text style={[styles.businessCenter]}>{i18n("ticketPlans.customerCenter")}</Text>
                            </View>
                        </View>

                        <View style={{ height: 100 }} />
                    </ScrollView>

                    {/* ── 하단 고정 버튼 (웹과 동일: dark + ChevronRight) ───── */}
                    <View
                        style={[
                            styles.footer,
                            {
                                backgroundColor: sheetBg,
                                borderTopColor: dividerColor,
                                paddingBottom: Math.max(insets.bottom, 16),
                            },
                        ]}
                    >
                        {/* 티켓 선택 시 팁 (웹 ticketTip2) */}
                        {selectedPlan?.type === "ticket" && (
                            <Text style={[styles.ticketTip, { color: sectionLabelColor }]}>
                                {i18n("ticketPlans.ticketTip2")}
                            </Text>
                        )}
                        <TouchableOpacity
                            style={[
                                styles.payBtn,
                                {
                                    backgroundColor: loading
                                        ? (t.isDark ? "#374151" : "#d1d5db")
                                        : (t.isDark ? "#1f2937" : "#111827"),
                                },
                            ]}
                            onPress={handlePayment}
                            activeOpacity={0.85}
                            disabled={loading}
                        >
                            {loading ? (
                                <>
                                    <ActivityIndicator color="#fff" size="small" style={{ marginRight: 8 }} />
                                    <Text style={[styles.payBtnText, { fontFamily: "LINESeedKR-Bd" }]}>
                                        {i18n("ticketPlans.loadingPayment")}
                                    </Text>
                                </>
                            ) : (
                                <>
                                    <Text style={[styles.payBtnText, { fontFamily: "LINESeedKR-Bd" }]}>
                                        {i18n("ticketPlans.startPlan", {
                                            name: i18n(`ticketPlans.plans.${selectedPlan?.id ?? "sub_basic"}.name`),
                                        })}
                                    </Text>
                                    <Ionicons name="chevron-forward" size={16} color="#34d399" />
                                </>
                            )}
                        </TouchableOpacity>
                    </View>
                </Animated.View>
            </View>

            <NativeLegalModal page={legalPage} onClose={() => setLegalPage(null)} />
        </Modal>
    );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
    root: { flex: 1, justifyContent: "flex-end" },

    // 시트: rounded-t-3xl = 24px, border-t
    sheet: {
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        borderTopWidth: StyleSheet.hairlineWidth,
        overflow: "hidden",
    },

    // 헤더: px-5 pt-6 pb-3
    header: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "flex-start",
        paddingHorizontal: 20,
        paddingTop: 24,
        paddingBottom: 12,
    },
    headerLeft: { flex: 1 },
    headerTitle: { fontSize: 20, lineHeight: 26, fontFamily: "LINESeedKR-Bd" },
    headerHighlight: { color: "#10b981", fontSize: 20, fontFamily: "LINESeedKR-Bd" },
    headerSub: { fontSize: 12, marginTop: 2 },
    closeBtn: {
        width: 28,
        height: 28,
        borderRadius: 14,
        alignItems: "center",
        justifyContent: "center",
        marginLeft: 8,
        marginTop: 2,
    },

    scroll: { flex: 1 },
    scrollContent: { paddingHorizontal: 20, paddingTop: 8 },

    // 섹션 레이블: text-xs font-bold uppercase tracking-widest
    sectionLabel: {
        fontSize: 10,
        fontFamily: "LINESeedKR-Bd",
        letterSpacing: 1.5,
        textTransform: "uppercase",
        marginBottom: 10,
        marginLeft: 2,
    },

    // 구독 카드: p-5 rounded-2xl border-2
    planCard: {
        borderWidth: 2,
        borderRadius: 16,
        padding: 20,
        marginBottom: 10,
        position: "relative",
    },
    badge: {
        position: "absolute",
        top: -10,
        left: 16,
        paddingHorizontal: 10,
        paddingVertical: 3,
        borderRadius: 99,
        zIndex: 1,
    },
    badgeInline: { top: -9 },
    badgeText: { color: "#fff", fontSize: 9, fontFamily: "LINESeedKR-Bd", letterSpacing: 0.3 },

    planCardBody: { flexDirection: "row", gap: 10, marginTop: 4 },
    planCardLeft: { flex: 1 },
    planNameRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 2 },
    planName: { fontSize: 15 },
    planDesc: { fontSize: 11, marginBottom: 8 },
    priceRow: { flexDirection: "row", alignItems: "baseline", gap: 6, flexWrap: "wrap" },
    price: { fontSize: 22 },
    origPrice: { fontSize: 12, color: "#9ca3af", textDecorationLine: "line-through" },
    perMonth: { fontSize: 11 },

    // 기능 목록 우측 박스
    featureBox: {
        borderWidth: 1,
        borderRadius: 10,
        padding: 8,
        gap: 4,
        minWidth: 120,
        alignSelf: "flex-start",
        flexShrink: 0,
    },
    featureRow: { flexDirection: "row", alignItems: "center", gap: 4 },
    featureText: { fontSize: 9, flex: 1, lineHeight: 13 },

    // 티켓 카드: 한 줄형 compact (웹 flex justify-between items-center p-4 rounded-xl)
    ticketCard: {
        borderWidth: 2,
        borderRadius: 12,
        paddingVertical: 14,
        paddingHorizontal: 14,
        marginBottom: 8,
        position: "relative",
    },
    ticketRow: { flexDirection: "row", alignItems: "center", gap: 10 },
    ticketDot: { width: 8, height: 8, borderRadius: 4 },
    ticketName: { flex: 1, fontSize: 13 },
    ticketPrice: { fontSize: 13 },

    // 법적 안내: pt-6 border-t space-y-4
    legalSection: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 20, marginTop: 4, gap: 8 },
    legalTitle: { fontSize: 10, fontFamily: "LINESeedKR-Bd", textDecorationLine: "underline", textAlign: "center" },
    legalLinks: { flexDirection: "row", justifyContent: "center", gap: 16, flexWrap: "wrap" },
    legalLink: { fontSize: 11, color: "#10b981", textDecorationLine: "underline" },
    legalText: { fontSize: 10, lineHeight: 16, textAlign: "center" },

    // 사업자 정보 박스: bg-gray-50 p-4 rounded-2xl text-[9px] text-center
    businessBox: { borderRadius: 16, padding: 14, gap: 2, alignItems: "center" },
    businessTitle: { fontSize: 9, fontFamily: "LINESeedKR-Bd", marginBottom: 4 },
    businessText: { fontSize: 9, lineHeight: 14 },
    businessCenter: { fontSize: 9, color: "#10b981", fontFamily: "LINESeedKR-Bd", marginTop: 4 },

    // 하단 버튼: bg-gray-900 rounded-xl py-3.5
    footer: { paddingHorizontal: 20, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth },
    ticketTip: { fontSize: 11, textAlign: "center", marginBottom: 10 },
    payBtn: {
        borderRadius: 12,
        paddingVertical: 14,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 4,
        elevation: 3,
    },
    payBtnText: { color: "#fff", fontSize: 14 },
});
