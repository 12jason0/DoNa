import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, endpoints } from '../lib/api';
import { saveUserId, loadUserId, saveAuthToken } from '../lib/mmkv';

// ─── 타입 (웹 authClient.ts AuthUser 와 동일) ─────────────────────────────────

export type AuthUser = {
    id: number;
    email: string;
    name: string;
    nickname?: string;
    profileImage?: string;
    subscriptionPlan?: string;
} | null;

type SessionResponse = {
    authenticated: boolean;
    user: AuthUser;
};

// ─── Query Key ────────────────────────────────────────────────────────────────

export const AUTH_QUERY_KEY = ['auth', 'session'] as const;

// ─── useAuth 훅 ───────────────────────────────────────────────────────────────

export function useAuth() {
    const { data, isLoading, isError } = useQuery<SessionResponse>({
        queryKey: AUTH_QUERY_KEY,
        queryFn: () => api.get<SessionResponse>('/api/auth/session'),
        staleTime: 1000 * 60 * 5,   // 5분
        retry: 1,
        // 세션 체크 실패를 에러로 처리하지 않음 (비로그인 상태)
        throwOnError: false,
    });

    const isAuthenticated = data?.authenticated ?? false;
    const user = data?.user ?? null;

    // 로그인 성공 시 userId MMKV에 저장 (렌더 사이클 밖에서 실행)
    useEffect(() => {
        if (user?.id) {
            saveUserId(String(user.id));
        }
    }, [user?.id]);

    return {
        user,
        isAuthenticated,
        isLoading,
        isError,
    };
}

// ─── 로그아웃 유틸 ────────────────────────────────────────────────────────────

export async function logout(queryClient: ReturnType<typeof useQueryClient>) {
    try {
        await api.post('/api/auth/logout', {});
    } catch {
        // 서버 실패해도 로컬 상태는 초기화
    }

    // MMKV 초기화
    saveAuthToken(null);
    saveUserId(null);

    // TanStack Query 캐시 무효화 → 화면 즉시 업데이트
    queryClient.setQueryData(AUTH_QUERY_KEY, {
        authenticated: false,
        user: null,
    });
    queryClient.invalidateQueries({ queryKey: AUTH_QUERY_KEY });
}
