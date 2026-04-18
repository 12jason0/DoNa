/**
 * 통합 모달 컨텍스트
 * - openModal(key, data?) 로 어디서든 모달 열기
 * - closeModal(key) 로 닫기
 * - ModalManager에서 모든 모달을 한 곳에서 렌더링
 */
import React, { createContext, useContext, useReducer, useCallback, useMemo } from "react";
import type { MemoryDetailStory } from "../components/MemoryDetailModal";
import type { NativeLegalPage } from "../components/NativeLegalModal";

// ─── 모달별 데이터 타입 ────────────────────────────────────────────────────────

export type Badge = {
    id: number;
    name: string;
    description?: string | null;
    image_url?: string | null;
    awarded_at: string;
};

export type LimitCtx = {
    tier: "FREE" | "BASIC" | "PREMIUM";
    limit: number | null;
    used: number;
};

export type ModalPayloads = {
    // 헤더 모달
    search: undefined;
    suggestNotification: undefined;
    settings: undefined;

    // 인증
    login: { next?: string; preset?: string } | undefined;

    // 결제
    ticket: {
        context?: "COURSE" | "UPGRADE";
        courseId?: number;
        courseGrade?: "BASIC" | "PREMIUM";
        onUnlocked?: () => void;
    } | undefined;

    // 법률
    legalPage: { page: NativeLegalPage };

    // 추억
    memoryDetail: { story: MemoryDetailStory; imageIndex?: number };

    // 초기 동의
    benefitConsent: undefined;

    // 사이드 메뉴
    sideMenu: undefined;

    // 마이페이지 모달
    logout: undefined;
    withdrawal: undefined;
    profileEdit: undefined;
    badgeDetail: { badge: Badge };

    // AI 모달
    limitExceeded: { ctx: LimitCtx; onUpgrade: () => void };

    // 코스 상세 모달
    memoryLimit: undefined;
    screenReservation: { url: string };

    // 홈 모달
    moreCourses: { todayCourses: any[]; weekendCourses: any[]; locale: string; initialTab?: "today" | "weekend" };

    // 두나샵
    shop: undefined;

    // 준비중
    comingSoon: undefined;
};

export type ModalKey = keyof ModalPayloads;

// ─── 상태 타입 ────────────────────────────────────────────────────────────────

type ModalEntry<K extends ModalKey> = {
    open: boolean;
    data?: ModalPayloads[K];
};

type ModalState = {
    [K in ModalKey]?: ModalEntry<K>;
};

// ─── 액션 ─────────────────────────────────────────────────────────────────────

type Action =
    | { type: "OPEN"; key: ModalKey; data?: any }
    | { type: "CLOSE"; key: ModalKey };

function reducer(state: ModalState, action: Action): ModalState {
    switch (action.type) {
        case "OPEN":
            return { ...state, [action.key]: { open: true, data: action.data } };
        case "CLOSE":
            return { ...state, [action.key]: { open: false, data: undefined } };
        default:
            return state;
    }
}

// ─── 컨텍스트 ─────────────────────────────────────────────────────────────────

interface ModalActionsValue {
    openModal: <K extends ModalKey>(key: K, data?: ModalPayloads[K]) => void;
    closeModal: (key: ModalKey) => void;
}

// Actions context — never changes → consumers don't re-render on modal open/close
const ModalActionsContext = createContext<ModalActionsValue | null>(null);
// State context — changes on every modal open/close
const ModalStateContext = createContext<ModalState>({});

// ─── Provider ─────────────────────────────────────────────────────────────────

export function ModalProvider({ children }: { children: React.ReactNode }) {
    const [state, dispatch] = useReducer(reducer, {});

    const openModal = useCallback(<K extends ModalKey>(key: K, data?: ModalPayloads[K]) => {
        dispatch({ type: "OPEN", key, data });
    }, []);

    const closeModal = useCallback((key: ModalKey) => {
        dispatch({ type: "CLOSE", key });
    }, []);

    const actions = useMemo(() => ({ openModal, closeModal }), [openModal, closeModal]);

    return (
        <ModalActionsContext.Provider value={actions}>
            <ModalStateContext.Provider value={state}>
                {children}
            </ModalStateContext.Provider>
        </ModalActionsContext.Provider>
    );
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

// Use when component only needs openModal/closeModal — never re-renders due to modal state
export function useModalActions() {
    const ctx = useContext(ModalActionsContext);
    if (!ctx) throw new Error("useModalActions must be inside ModalProvider");
    return ctx;
}

// Use when component also needs isOpen/getData — re-renders on every modal state change
export function useModal() {
    const actions = useContext(ModalActionsContext);
    const state = useContext(ModalStateContext);
    if (!actions) throw new Error("useModal must be inside ModalProvider");

    const isOpen = useCallback((key: ModalKey) => !!(state[key]?.open), [state]);
    const getData = useCallback(<K extends ModalKey>(key: K): ModalPayloads[K] | undefined => {
        return state[key]?.data as ModalPayloads[K] | undefined;
    }, [state]);

    return { ...actions, isOpen, getData };
}
