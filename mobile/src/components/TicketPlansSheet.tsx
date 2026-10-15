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
import { useModal } from "../lib/modalContext";
import { fetchAllPackages, purchaseErrorInfo } from "../lib/purchases";
import { androidShadow } from "../constants/theme";
import { posthog } from "../lib/posthog";

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

// RevenueCat 상품 식별자 매핑 — iOS/Android 상품 ID 모두 포함
const RC_PRODUCT_IDS: Record<string, string[]> = {
    ticket_basic:  ["kr.io.dona.course_basic", "course_basic"],
    ticket_premium: ["kr.io.dona.course_premium", "course_premium"],
    sub_basic:     ["kr.io.dona.ai_basic_monthly"],
    sub_premium:   ["kr.io.dona.premium_monthly"],
};

// RevenueCat Offering 의 Package 식별자 → 플랜 매핑 (상품 ID 매칭 실패 시 대비)
const RC_PACKAGE_IDS: Record<string, string> = {
    monthly_basic: "sub_basic",
    monthly_premium: "sub_premium",
    ticket_basic: "ticket_basic",
    ticket_premium: "ticket_premium",
};

/**
 * Android 구독 상품은 "상품ID:기본요금제ID" 형태로 내려온다
 * (예: kr.io.dona.ai_basic_monthly:basic-monthly). 콜론 뒤 기본요금제 ID 를 떼어
 * 상품 ID 만 비교해야 매칭된다. iOS/일회성 상품은 콜론이 없어 그대로 통과.
 */
const baseProductId = (identifier: string) => identifier.split(":")[0];

/** 이 패키지가 어느 플랜인지 판별 — 상품 ID 우선, 실패 시 패키지 식별자로 대체 */
const planIdForPackage = (pkg: { identifier: string; product: { identifier: string } }) => {
    const base = baseProductId(pkg.product.identifier);
    const byProduct = Object.keys(RC_PRODUCT_IDS).find((planId) =>
        RC_PRODUCT_IDS[planId].includes(base),
    );
    return byProduct ?? RC_PACKAGE_IDS[pkg.identifier];
};

const { height: SCREEN_H } = Dimensions.get("window");
const SHEET_HEIGHT = SCREEN_H * 0.8;

// ─── Component ────────────────────────────────────────────────────────────────

export default function TicketPlansSheet() {
    const { isOpen, closeModal, openModal, getData } = useModal();
    const data = getData("ticket");
    const visible = isOpen("ticket");
    const onClose = () => closeModal("ticket");
    const courseId = data?.courseId;
    const courseGrade = data?.courseGrade;
    const context = data?.context ?? "COURSE";
    const onUnlocked = data?.onUnlocked;
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
    const [tierLoadFailed, setTierLoadFailed] = useState(false);
    const [loading, setLoading] = useState(false);
    const [rcPrices, setRcPrices] = useState<Partial<Record<PlanId, string>>>({});
    // unlock-intent 프리패치 캐시 (courseId+planId 키)
    const prefetchedIntentRef = useRef<{ key: string; intentId: string } | null>(null);

    // ref 동기화 (티어 로딩 시 최신 selectedPlanId 참조용)
    useEffect(() => { selectedPlanIdRef.current = selectedPlanId; }, [selectedPlanId]);

    // ─── 열기 / 닫기 애니메이션 ──────────────────────────────────────────────

    useEffect(() => {
        if (!visible) { closingRef.current = false; return; }
        posthog.capture("paywall_shown", { context, course_id: courseId ?? null, course_grade: courseGrade ?? null });
        setTierLoadFailed(false);
        slide.setValue(SHEET_HEIGHT);
        backdrop.setValue(0);
        Animated.parallel([
            Animated.spring(slide, { toValue: 0, useNativeDriver: true, tension: 68, friction: 12 }),
            Animated.timing(backdrop, { toValue: 1, duration: 260, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        ]).start();
    }, [visible]);

    const dismiss = useCallback((afterDismiss?: () => void) => {
        if (closingRef.current) return;
        closingRef.current = true;
        Animated.parallel([
            Animated.timing(slide, { toValue: SHEET_HEIGHT, duration: 260, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
            Animated.timing(backdrop, { toValue: 0, duration: 220, easing: Easing.in(Easing.quad), useNativeDriver: true }),
        ]).start(({ finished }) => { closingRef.current = false; onClose(); if (typeof afterDismiss === 'function') afterDismiss(); });
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
            .catch(() => { setCurrentTier("FREE"); setTierLoadFailed(true); });
    }, [visible]);

    // ─── RevenueCat 가격 조회 (모듈 캐시 우선, 없으면 네트워크) ───────────────

    useEffect(() => {
        if (!visible) return;
        (async () => {
            const result = await fetchAllPackages();
            if (!result.ok) return; // fallback: 하드코딩 가격 표시
            const prices: Partial<Record<PlanId, string>> = {};
            for (const pkg of result.packages) {
                const planId = planIdForPackage(pkg);
                const match = PLANS.find((p) => p.id === planId);
                if (match) prices[match.id] = pkg.product.priceString;
            }
            if (Object.keys(prices).length > 0) setRcPrices(prices);
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

    // ─── unlock-intent 프리패치 (티켓 플랜 선택 시 미리 호출) ────────────────
    useEffect(() => {
        if (!visible || courseId == null) return;
        const plan = PLANS.find((p) => p.id === selectedPlanId);
        if (plan?.type !== "ticket") return;

        const productId = plan.id === "ticket_basic" ? "course_basic" : "course_premium";
        const key = `${courseId}:${plan.id}`;
        if (prefetchedIntentRef.current?.key === key) return; // 이미 패치됨

        prefetchedIntentRef.current = null; // 이전 캐시 무효화
        api.post<{ intentId?: string }>("/api/payments/unlock-intent", {
            courseId: Number(courseId), productId, unlockTarget: "FULL",
        }).then((res) => {
            if (res?.intentId) prefetchedIntentRef.current = { key, intentId: res.intentId };
        }).catch(() => {}); // 실패해도 결제 시 재시도
    }, [visible, selectedPlanId, courseId]);

    // ─── 결제 처리 ────────────────────────────────────────────────────────────

    /**
     * 실패해도 사용자가 그 자리에서 다시 시도할 수 있게 [다시 시도] 버튼을 단 알림.
     * 결제 버튼이 "눌러도 아무 일 안 일어나는 버튼"으로 보이지 않게 하는 핵심.
     */
    const alertWithRetry = useCallback((title: string, message: string, onRetry: () => void) => {
        Alert.alert(title, message, [
            { text: i18n("ticketPlans.alerts.close"), style: "cancel" },
            { text: i18n("ticketPlans.alerts.retry"), onPress: onRetry },
        ]);
    }, [i18n]);

    const handlePayment = async (opts?: { forceRefresh?: boolean }) => {
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

        // ── 1) unlock-intent (프리패치 캐시 우선) ──────────────────────────────
        let intentId: string | null = null;
        if (selectedPlan.type === "ticket" && courseId != null) {
            const key = `${courseId}:${selectedPlan.id}`;
            const cached = prefetchedIntentRef.current?.key === key ? prefetchedIntentRef.current.intentId : null;
            if (cached) {
                intentId = cached;
            } else {
                try {
                    const productId = selectedPlan.id === "ticket_basic" ? "course_basic" : "course_premium";
                    const res = await api.post<{ intentId?: string }>("/api/payments/unlock-intent", {
                        courseId: Number(courseId), productId, unlockTarget: "FULL",
                    });
                    intentId = res?.intentId ?? null;
                } catch { /* 아래에서 null 체크 */ }
                if (!intentId) {
                    setLoading(false);
                    Alert.alert(i18n("ticketPlans.alerts.paymentFailed"));
                    return;
                }
            }
        }

        // ── 2) RC 패키지 찾기 ─────────────────────────────────────────────────
        // 초기화 확인 → 재시도(백오프) 포함 조회. 실패 시 원인별로 안내가 갈린다.
        const fetched = await fetchAllPackages({ force: opts?.forceRefresh });
        if (!fetched.ok) {
            setLoading(false);
            alertWithRetry(
                i18n("ticketPlans.alerts.storeUnavailableTitle"),
                i18n("ticketPlans.alerts.storeUnavailableMessage"),
                () => handlePayment({ forceRefresh: true }),
            );
            return;
        }

        const allPkgs = fetched.packages;
        const findPkg = (pkgs: typeof allPkgs) =>
            pkgs.find((p) => planIdForPackage(p) === selectedPlan.id);

        const pkg = findPkg(allPkgs);
        if (!pkg) {
            setLoading(false);
            // 캐시가 오래돼 상품이 빠졌을 수 있으니 강제 새로고침으로 재시도할 기회를 준다
            alertWithRetry(
                i18n("ticketPlans.alerts.productUnavailableTitle"),
                i18n("ticketPlans.alerts.productUnavailableMessage"),
                () => handlePayment({ forceRefresh: true }),
            );
            return;
        }

        // ── 3) RC 결제창 호출 ────────────────────────────────────────────────
        if (selectedPlan.type === "ticket" && courseId != null) {
            await Purchases.setAttributes({ pending_course_id: String(courseId) });
        }

        let customerInfo: any;
        let transactionId: string | null = null;
        try {
            const result = await Purchases.purchasePackage(pkg);
            customerInfo = result.customerInfo;
            // 스토어 거래 ID — 웹훅 transaction_id와 같은 값이라 서버에서 결제가 1건으로 합쳐짐
            transactionId = result.transaction?.transactionIdentifier ?? null;
        } catch (err: unknown) {
            setLoading(false);
            const info = purchaseErrorInfo(err);
            if (info.userCancelled) {
                console.log('[Purchase] 사용자 취소');
                return;
            }
            console.log('[Purchase] purchasePackage 오류:', info.code, err);

            // 결제 대기(PAYMENT_PENDING)는 실패가 아니라 승인 대기 — 재시도 버튼 없이 안내만
            if (info.reason === "paymentPending") {
                Alert.alert(
                    i18n("ticketPlans.alerts.purchaseFailedTitle"),
                    i18n("ticketPlans.alerts.reasons.paymentPending"),
                );
                return;
            }

            // 스토어가 준 실제 사유 + 문의용 오류 코드를 함께 노출
            const reasonText = i18n(`ticketPlans.alerts.reasons.${info.reason}`);
            const message = info.code
                ? `${reasonText}\n\n${i18n("ticketPlans.alerts.errorCode", { code: info.code })}`
                : reasonText;
            alertWithRetry(
                i18n("ticketPlans.alerts.purchaseFailedTitle"),
                message,
                () => handlePayment(),
            );
            return;
        }

        // ── 4) confirm + UI 반응 ─────────────────────────────────────────────

        // RC 결제 완료 = 사용자는 이미 돈을 냄. 즉시 잠금 해제 + 시트 닫기
        if (selectedPlan.type === "ticket") {
            // cancelQueries → setQueryData 순서 보장: 자동 background refetch가 낙관적 업데이트를 덮어쓰는 것 방지
            if (courseId != null) {
                const courseKey = ["course", String(courseId)];
                console.log('[Unlock] cancelQueries 시작, courseId:', courseId, 'key:', courseKey);
                await queryClient.cancelQueries({ queryKey: courseKey });
                console.log('[Unlock] setQueryData 실행');
                queryClient.setQueryData<any>(courseKey, (old: any) => {
                    console.log('[Unlock] updater 호출, old:', old ? { isLocked: (old as any).isLocked } : old);
                    return old ? { ...old, isLocked: false } : old;
                });
                console.log('[Unlock] setQueryData 완료');
            } else {
                console.log('[Unlock] courseId null — setQueryData 스킵');
            }
            onUnlocked?.();
            prefetchedIntentRef.current = null;
            queryClient.invalidateQueries({ queryKey: ["users", "profile"] });
            queryClient.invalidateQueries({ queryKey: ["profile"] });
            setLoading(false);
            dismiss();
            // confirm 뒤 invalidate → 서버 확정 데이터로 재동기화.
            // confirm이 실패해도(웹훅이 먼저 처리 등) 다시 불러온다 — 결제 전에 받은 데이터는 장소가 가려져 있다
            if (intentId) {
                api.post("/api/payments/revenuecat/confirm", {
                    planId: selectedPlan.id, planType: "ticket",
                    transactionId, customerInfo, intentId, courseId,
                }).catch(() => {}).finally(() => {
                    if (courseId != null) {
                        queryClient.invalidateQueries({ queryKey: ["course", String(courseId)] });
                    }
                    // 코스 목록(히어로는 목록 첫 페이지에서 뽑음)·구매한 코스도 갱신해 잠금 상태 반영
                    queryClient.invalidateQueries({ queryKey: ["courses-list"] });
                    queryClient.invalidateQueries({ queryKey: ["users", "unlocked-courses"] });
                });
            }
            return;
        } else if (selectedPlan.type === "sub") {
            // 구독: 즉시 닫고 confirm은 백그라운드.
            // 등급 반영은 서버 confirm 이 끝나야 하므로 .then() 안에서 무효화한다.
            // 마이페이지 등급 뱃지·구독플랜은 ["users","profile"] 쿼리를 쓰므로 반드시 이 키를 무효화해야 한다
            // (["profile"] 는 접두어가 달라 ["users","profile"] 를 잡지 못한다).
            api.post("/api/payments/revenuecat/confirm", {
                planId: selectedPlan.id, planType: "sub",
                transactionId, customerInfo,
            }).then(() => {
                queryClient.invalidateQueries({ queryKey: ["users", "profile"] });
                queryClient.invalidateQueries({ queryKey: ["profile"] });
                queryClient.invalidateQueries({ queryKey: AUTH_QUERY_KEY });
            }).catch(() => {});
        }

        // 결제 완료 후 intent 캐시 초기화 (재결제 시 만료된 intentId 재사용 방지)
        prefetchedIntentRef.current = null;

        // 낙관적 1차 무효화 (서버가 웹훅으로 이미 반영했을 경우 대비) — 위 confirm.then 이 2차로 재동기화
        queryClient.invalidateQueries({ queryKey: ["users", "profile"] });
        queryClient.invalidateQueries({ queryKey: ["profile"] });
        if (selectedPlan.type === "sub") {
            queryClient.invalidateQueries({ queryKey: AUTH_QUERY_KEY });
        }

        setLoading(false);
        dismiss();
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
            onRequestClose={() => dismiss()}
            statusBarTranslucent
            navigationBarTranslucent
        >
            <View style={styles.root} pointerEvents="box-none">
                {/* 어두운 오버레이 (backdrop-blur 대체) */}
                <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => dismiss()}>
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
                                {context === "UPGRADE" ? i18n("ticketPlans.upgradeTitle") : i18n("ticketPlans.mainTitle")}
                                {"\n"}
                                <Text style={styles.headerHighlight}>
                                    {context === "UPGRADE" ? i18n("ticketPlans.upgradeHighlight") : i18n("ticketPlans.mainHighlight")}
                                </Text>
                            </Text>
                            <Text style={[styles.headerSub, { color: sectionLabelColor }]}>
                                {context === "UPGRADE" ? i18n("ticketPlans.upgradeSubtitle") : i18n("ticketPlans.mainSubtitle")}
                            </Text>
                        </View>
                        <TouchableOpacity
                            onPress={() => dismiss()}
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
                                                <Text style={[styles.planName, { color: disabled ? sectionLabelColor : t.text, fontWeight: "400" }]}>
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
                                                <Text style={[styles.price, { color: disabled ? sectionLabelColor : t.text, fontWeight: "400" }]}>
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
                                                    { color: disabled ? sectionLabelColor : t.text, fontWeight: "400" },
                                                ]}>
                                                    {i18n(`ticketPlans.plans.${plan.id}.name`)}
                                                </Text>
                                                <Text style={[
                                                    styles.ticketPrice,
                                                    { color: disabled ? sectionLabelColor : t.text, fontWeight: "400" },
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
                                <TouchableOpacity onPress={() => openModal("legalPage", { page: "privacy" })}>
                                    <Text style={styles.legalLink}>{i18n("ticketPlans.privacyPolicy")}</Text>
                                </TouchableOpacity>
                                <TouchableOpacity onPress={() => openModal("legalPage", { page: "terms" })}>
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

                    {/* ── 하단 고정 버튼 ───── */}
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
                        {/* 티켓 선택 시 팁 */}
                        {selectedPlan?.type === "ticket" && (
                            <Text style={[styles.ticketTip, { color: sectionLabelColor }]}>
                                {i18n("ticketPlans.ticketTip2")}
                            </Text>
                        )}

                        {/* 결제 버튼 */}
                        <TouchableOpacity
                            style={[
                                styles.payBtn,
                                {
                                    backgroundColor: tierLoadFailed
                                        ? (t.isDark ? "#374151" : "#e5e7eb")
                                        : "#111827",
                                    opacity: loading ? 0.7 : 1,
                                },
                            ]}
                            onPress={() => handlePayment()}
                            activeOpacity={0.85}
                            disabled={loading || tierLoadFailed}
                        >
                            {loading ? (
                                <ActivityIndicator color="#fff" size="small" />
                            ) : (
                                <Text style={styles.payBtnText}>
                                    {i18n("ticketPlans.startPlan", {
                                        name: i18n(`ticketPlans.plans.${selectedPlanId}.name`),
                                    })}
                                </Text>
                            )}
                        </TouchableOpacity>
                    </View>
                </Animated.View>
            </View>

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
    headerTitle: { fontSize: 20, lineHeight: 26, fontWeight: "400" },
    headerHighlight: { color: "#10b981", fontSize: 20, fontWeight: "400" },
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
        fontWeight: "400",
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
    badgeText: { color: "#fff", fontSize: 9, fontWeight: "400", letterSpacing: 0.3 },

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
    legalTitle: { fontSize: 10, fontWeight: "400", textDecorationLine: "underline", textAlign: "center" },
    legalLinks: { flexDirection: "row", justifyContent: "center", gap: 16, flexWrap: "wrap" },
    legalLink: { fontSize: 11, color: "#10b981", textDecorationLine: "underline" },
    legalText: { fontSize: 10, lineHeight: 16, textAlign: "center" },

    // 사업자 정보 박스: bg-gray-50 p-4 rounded-2xl text-[9px] text-center
    businessBox: { borderRadius: 16, padding: 14, gap: 2, alignItems: "center" },
    businessTitle: { fontSize: 9, fontWeight: "400", marginBottom: 4 },
    businessText: { fontSize: 9, lineHeight: 14 },
    businessCenter: { fontSize: 9, color: "#10b981", fontWeight: "400", marginTop: 4 },

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
        ...androidShadow(3),
    },
    payBtnText: { color: "#fff", fontSize: 14 },
});
