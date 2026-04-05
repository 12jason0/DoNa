import { loadAuthToken } from './mmkv';
import { loadLocalePreference, type LocalePreference } from './appSettingsStorage';

export const BASE_URL = 'https://dona.io.kr';

function acceptLanguageHeader(locale: LocalePreference): string {
    switch (locale) {
        case 'en':
            return 'en-US,en;q=0.9,ko;q=0.5';
        case 'ja':
            return 'ja-JP,ja;q=0.9,en;q=0.5';
        case 'zh':
            return 'zh-CN,zh;q=0.9,en;q=0.5';
        default:
            return 'ko-KR,ko;q=0.9,en;q=0.5';
    }
}

// ─── 타입 ─────────────────────────────────────────────────────────────────────

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

interface FetchOptions {
    method?: HttpMethod;
    body?: unknown;
    headers?: Record<string, string>;
    /** 쿠키 기반 세션 전달 여부 (기본 true) */
    credentials?: RequestCredentials;
}

export class ApiError extends Error {
    constructor(
        public status: number,
        message: string,
        public data?: unknown,
    ) {
        super(message);
        this.name = 'ApiError';
    }
}

// ─── 핵심 fetch 래퍼 ──────────────────────────────────────────────────────────

export async function apiFetch<T>(
    path: string,
    options: FetchOptions = {},
): Promise<T> {
    const { method = 'GET', body, headers = {}, credentials = 'include' } = options;

    const token = loadAuthToken();
    const locale = loadLocalePreference();

    const response = await fetch(`${BASE_URL}${path}`, {
        method,
        credentials,
        headers: {
            'Content-Type': 'application/json',
            'Accept-Language': acceptLanguageHeader(locale),
            'X-App-Locale': locale,
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...headers,
        },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });

    if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new ApiError(
            response.status,
            (data as { error?: string }).error ?? `HTTP ${response.status}`,
            data,
        );
    }

    // 204 No Content
    if (response.status === 204) return undefined as T;

    return response.json() as Promise<T>;
}

// ─── 편의 메서드 ──────────────────────────────────────────────────────────────

export const api = {
    get: <T>(path: string, headers?: Record<string, string>) =>
        apiFetch<T>(path, { method: 'GET', headers }),

    post: <T>(path: string, body: unknown, headers?: Record<string, string>) =>
        apiFetch<T>(path, { method: 'POST', body, headers }),

    put: <T>(path: string, body: unknown) =>
        apiFetch<T>(path, { method: 'PUT', body }),

    patch: <T>(path: string, body: unknown) =>
        apiFetch<T>(path, { method: 'PATCH', body }),

    delete: <T>(path: string) =>
        apiFetch<T>(path, { method: 'DELETE' }),
};

// ─── API 엔드포인트 정의 ──────────────────────────────────────────────────────
// 기존 Next.js /api/* 엔드포인트 그대로 사용

export const endpoints = {
    // Auth
    me: '/api/me',
    login: '/api/auth/login',
    logout: '/api/auth/logout',
    kakaoAuth: '/api/auth/kakao',
    appleAuth: '/api/auth/apple',

    // Courses
    courses: '/api/courses',
    course: (id: string) => `/api/courses/${id}`,
    courseStart: (id: string) => `/api/courses/${id}/start`,

    // Bookings
    bookings: '/api/users/bookings',

    // Push
    push: '/api/push',

    // Rewards
    rewards: '/api/rewards',

    // Users
    profile: '/api/users/profile',
    activeCourse: '/api/users/active-course',
    preferences: '/api/users/preferences',
    favorites: '/api/users/favorites',
    completions: '/api/users/completions',
    badges: '/api/users/badges',
} as const;
