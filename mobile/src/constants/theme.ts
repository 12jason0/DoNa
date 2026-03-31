/**
 * DoNa 앱 디자인 토큰
 * 웹 globals.css + (home)/layout.tsx에서 추출한 값과 동일하게 유지
 */

export const Colors = {
    // ─── 브랜드 컬러 ─────────────────────────────────────────────
    // layout.tsx에서 오버라이드된 값 기준 (실제 사용되는 값)
    brandGreen: '#7aa06f',
    brandGreenDark: '#5f8d57',
    brandGreenVeryDark: '#4f6d45',
    brandGreenLight: '#99c08e', // globals.css 원본
    brandCream: '#f5f7f2',
    brandInk: '#1e2a1a',
    splashColor: '#7FCC9F', // 스플래시 배경색

    // ─── 라이트 모드 시맨틱 ──────────────────────────────────────
    background: '#f5f7f2',
    foreground: '#1e2a1a',
    cardBg: '#ffffff',
    border: '#e5e7eb',

    // ─── 다크 모드 시맨틱 ────────────────────────────────────────
    backgroundDark: '#0f1710',
    foregroundDark: '#e7efe4',
    cardBgDark: '#1a241b',
    borderDark: '#2d3748',

    // ─── 기본 ────────────────────────────────────────────────────
    white: '#ffffff',
    black: '#000000',
    transparent: 'transparent',

    // ─── 그레이 스케일 (Tailwind 호환) ───────────────────────────
    gray50: '#f9fafb',
    gray100: '#f3f4f6',
    gray200: '#e5e7eb',
    gray300: '#d1d5db',
    gray400: '#9ca3af',
    gray500: '#6b7280',
    gray600: '#4b5563',
    gray700: '#374151',
    gray800: '#1f2937',
    gray900: '#111827',

    // ─── 에메랄드 (Tailwind emerald) ──────────────────────────────
    emerald100: '#d1fae5',
    emerald200: '#a7f3d0',
    emerald400: '#34d399',
    emerald500: '#10b981',
    emerald600: '#059669',
    emerald700: '#047857',
    emerald900: '#064e3b',

    // ─── 그린 (Tailwind green) ────────────────────────────────────
    green50: '#f0fdf4',
    green100: '#dcfce7',
    green200: '#bbf7d0',
    green400: '#4ade80',
    green600: '#16a34a',
    green800: '#166534',
    green900: '#14532d',

    // ─── 레드 (Tailwind red) ──────────────────────────────────────
    red50: '#fef2f2',
    red200: '#fecaca',
    red400: '#f87171',
    red600: '#dc2626',
    red800: '#991b1b',
    red900: '#7f1d1d',

    // ─── 슬레이트 (제출 버튼) ─────────────────────────────────────
    slate700: '#334155',
    slate800: '#1e293b',
    slate900: '#0f172a',

    // ─── 카카오 ──────────────────────────────────────────────────
    kakaoYellow: '#FEE500',
    kakaoYellowHover: '#F5DC00',

    // ─── 기타 ────────────────────────────────────────────────────
    yellow400: '#facc15',
} as const;

export const FontSize = {
    xs: 11,
    sm: 13,
    base: 15,
    md: 16,
    lg: 18,
    xl: 20,
    '2xl': 24,
    '3xl': 28,
    '4xl': 32,
} as const;

/** 전역적으로 가볍게 */
export const FontWeight = {
    normal: '400' as const,
    medium: '400' as const,
    semibold: '400' as const,
    bold: '400' as const,
};

export const Spacing = {
    1: 4,
    2: 8,
    3: 12,
    4: 16,
    5: 20,
    6: 24,
    8: 32,
    10: 40,
    12: 48,
    16: 64,
} as const;

export const BorderRadius = {
    sm: 6,
    md: 8,
    lg: 12,
    xl: 16,
    '2xl': 20,
    full: 9999,
} as const;

export const Shadow = {
    sm: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
    },
    md: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 4,
        elevation: 3,
    },
    lg: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.12,
        shadowRadius: 8,
        elevation: 5,
    },
} as const;
