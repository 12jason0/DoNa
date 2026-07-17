/**
 * RevenueCat 초기화 · 상품 조회 헬퍼
 *
 * 결제 버튼이 "눌러도 에러만 뜨고 끝나는" 상태가 되지 않도록:
 * - ensureRcConfigured(): 결제 시점에 SDK가 미초기화여도 그 자리에서 복구
 * - fetchAllPackages(): 일시적 실패는 재시도로 흡수하고, 끝내 실패하면 원인을 구분해서 반환
 * - purchaseErrorInfo(): 스토어가 준 실제 실패 사유를 호출부에 전달
 */
import { Platform } from "react-native";
import Purchases, {
    LOG_LEVEL,
    PURCHASES_ERROR_CODE,
    type PurchasesPackage,
} from "react-native-purchases";
import { loadUserId } from "./mmkv";

// 앱 세션 동안 유지되는 패키지 캐시 (컴포넌트 unmount 후에도 보존)
let cachedPkgs: PurchasesPackage[] = [];

const RETRY_DELAYS_MS = [400, 1200]; // 1차 실패 후 대기 → 2차, 2차 실패 후 대기 → 3차

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function getApiKey(): string {
    return Platform.OS === "ios"
        ? (process.env.EXPO_PUBLIC_REVENUECAT_API_KEY_IOS ?? "")
        : (process.env.EXPO_PUBLIC_REVENUECAT_API_KEY_ANDROID ?? "");
}

// 동시 호출이 configure를 중복 실행하지 않도록 진행 중인 초기화를 공유
let configuring: Promise<boolean> | null = null;

/**
 * RevenueCat이 초기화된 상태임을 보장한다.
 * 이미 초기화돼 있으면 즉시 true. API 키가 없으면 false.
 */
export async function ensureRcConfigured(): Promise<boolean> {
    if (configuring) return configuring;

    configuring = (async () => {
        try {
            if (await Purchases.isConfigured()) return true;
        } catch {
            /* 확인 실패 → 아래에서 configure 시도 */
        }

        const apiKey = getApiKey();
        if (!apiKey) {
            console.warn("[Purchases] RevenueCat API 키가 없습니다.");
            return false;
        }

        try {
            Purchases.configure({ apiKey });
        } catch (e) {
            console.warn("[Purchases] configure 실패:", e);
            // 다른 경로에서 이미 초기화했을 수 있으므로 재확인
            return await Purchases.isConfigured().catch(() => false);
        }

        if (__DEV__) Purchases.setLogLevel(LOG_LEVEL.DEBUG);

        const savedUserId = loadUserId();
        if (savedUserId) {
            try {
                await Purchases.logIn(savedUserId);
            } catch (e) {
                // 로그인 실패해도 상품 조회·결제 자체는 익명으로 가능
                console.warn("[Purchases] logIn 실패:", e);
            }
        }
        return true;
    })();

    try {
        return await configuring;
    } finally {
        configuring = null;
    }
}

export type FetchPackagesResult =
    | { ok: true; packages: PurchasesPackage[] }
    | { ok: false; reason: "not_configured" | "fetch_failed" | "empty" };

/**
 * 모든 offering의 패키지를 상품 식별자 기준 중복 제거해 반환한다.
 * 캐시가 있으면 그대로 쓰고, force가 true면 스토어에서 다시 받아온다.
 * 실패 시 최대 3회까지 백오프를 두고 재시도한다.
 */
export async function fetchAllPackages(opts?: { force?: boolean }): Promise<FetchPackagesResult> {
    if (!opts?.force && cachedPkgs.length > 0) {
        return { ok: true, packages: cachedPkgs };
    }

    if (!(await ensureRcConfigured())) {
        return { ok: false, reason: "not_configured" };
    }

    let sawError = false;

    for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
        if (attempt > 0) await delay(RETRY_DELAYS_MS[attempt - 1]);

        try {
            const offerings = await Purchases.getOfferings();
            const seen = new Set<string>();
            const pkgs: PurchasesPackage[] = [];
            for (const offering of Object.values(offerings.all)) {
                for (const p of offering.availablePackages) {
                    if (!seen.has(p.product.identifier)) {
                        seen.add(p.product.identifier);
                        pkgs.push(p);
                    }
                }
            }

            // 빈 목록 = 스토어에서 상품이 하나도 안 내려온 상태. 일시적일 수 있으니 재시도.
            if (pkgs.length === 0) {
                console.warn(`[Purchases] offerings가 비어 있음 (시도 ${attempt + 1})`);
                continue;
            }

            cachedPkgs = pkgs;
            return { ok: true, packages: pkgs };
        } catch (e) {
            sawError = true;
            console.warn(`[Purchases] getOfferings 실패 (시도 ${attempt + 1}):`, e);
        }
    }

    return { ok: false, reason: sawError ? "fetch_failed" : "empty" };
}

export function getCachedPackages(): PurchasesPackage[] {
    return cachedPkgs;
}

export function clearPackageCache(): void {
    cachedPkgs = [];
}

/** 결제 실패 원인 — i18n 키(ticketPlans.alerts.reasons.*)와 1:1 대응 */
export type PurchaseErrorReason =
    | "network"
    | "storeProblem"
    | "notAllowed"
    | "productUnavailable"
    | "alreadyOwned"
    | "paymentPending"
    | "configuration"
    | "unknown";

export type PurchaseErrorInfo = {
    userCancelled: boolean;
    reason: PurchaseErrorReason;
    /** 스토어가 준 원본 오류 코드 — 고객 문의 시 식별용 */
    code: string | null;
};

const REASON_BY_CODE: Partial<Record<PURCHASES_ERROR_CODE, PurchaseErrorReason>> = {
    [PURCHASES_ERROR_CODE.NETWORK_ERROR]: "network",
    [PURCHASES_ERROR_CODE.OFFLINE_CONNECTION_ERROR]: "network",
    [PURCHASES_ERROR_CODE.PRODUCT_REQUEST_TIMED_OUT_ERROR]: "network",
    [PURCHASES_ERROR_CODE.STORE_PROBLEM_ERROR]: "storeProblem",
    [PURCHASES_ERROR_CODE.UNKNOWN_BACKEND_ERROR]: "storeProblem",
    [PURCHASES_ERROR_CODE.UNEXPECTED_BACKEND_RESPONSE_ERROR]: "storeProblem",
    [PURCHASES_ERROR_CODE.PURCHASE_NOT_ALLOWED_ERROR]: "notAllowed",
    [PURCHASES_ERROR_CODE.PURCHASE_INVALID_ERROR]: "notAllowed",
    [PURCHASES_ERROR_CODE.PRODUCT_NOT_AVAILABLE_FOR_PURCHASE_ERROR]: "productUnavailable",
    [PURCHASES_ERROR_CODE.INELIGIBLE_ERROR]: "productUnavailable",
    [PURCHASES_ERROR_CODE.PRODUCT_ALREADY_PURCHASED_ERROR]: "alreadyOwned",
    [PURCHASES_ERROR_CODE.RECEIPT_ALREADY_IN_USE_ERROR]: "alreadyOwned",
    [PURCHASES_ERROR_CODE.PAYMENT_PENDING_ERROR]: "paymentPending",
    [PURCHASES_ERROR_CODE.CONFIGURATION_ERROR]: "configuration",
    [PURCHASES_ERROR_CODE.INVALID_CREDENTIALS_ERROR]: "configuration",
};

/** purchasePackage가 throw한 값에서 취소 여부와 실패 사유를 뽑아낸다. */
export function purchaseErrorInfo(err: unknown): PurchaseErrorInfo {
    if (!err || typeof err !== "object") {
        return { userCancelled: false, reason: "unknown", code: null };
    }

    const e = err as { userCancelled?: boolean; code?: string };

    if (e.userCancelled === true) {
        return { userCancelled: true, reason: "unknown", code: null };
    }

    const code = typeof e.code === "string" ? e.code : null;

    // 일부 플랫폼은 userCancelled 대신 코드로만 취소를 알린다
    if (code === PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR) {
        return { userCancelled: true, reason: "unknown", code };
    }

    const reason = (code && REASON_BY_CODE[code as PURCHASES_ERROR_CODE]) || "unknown";
    return { userCancelled: false, reason, code };
}
