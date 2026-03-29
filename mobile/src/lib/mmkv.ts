import { MMKV } from 'react-native-mmkv';

/**
 * 앱 전역 스토리지 (react-native-mmkv)
 * AsyncStorage 대비 ~10x 빠름, 동기 API
 */
export const storage = new MMKV({ id: 'dona-storage' });

// ─── Auth Token ──────────────────────────────────────────────────────────────

const AUTH_TOKEN_KEY = 'authToken';

export function saveAuthToken(token: string | null): void {
    if (token) {
        storage.set(AUTH_TOKEN_KEY, token);
    } else {
        storage.delete(AUTH_TOKEN_KEY);
    }
}

export function loadAuthToken(): string | null {
    return storage.getString(AUTH_TOKEN_KEY) ?? null;
}

// ─── User ID ─────────────────────────────────────────────────────────────────

const USER_ID_KEY = 'userId';

export function saveUserId(id: string | null): void {
    if (id) {
        storage.set(USER_ID_KEY, id);
    } else {
        storage.delete(USER_ID_KEY);
    }
}

export function loadUserId(): string | null {
    return storage.getString(USER_ID_KEY) ?? null;
}

// ─── 기존 AsyncStorage → MMKV 마이그레이션 헬퍼 ────────────────────────────
// Phase 1 로그인 화면 작업 시 호출. 기존 사용자 데이터를 MMKV로 이전.

export async function migrateFromAsyncStorage(): Promise<void> {
    try {
        // 이미 마이그레이션 된 경우 스킵
        if (storage.getBoolean('mmkv_migrated')) return;

        const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;

        const [token, userId] = await Promise.all([
            AsyncStorage.getItem('authToken'),
            AsyncStorage.getItem('userId'),
        ]);

        if (token) saveAuthToken(token);
        if (userId) saveUserId(userId);

        storage.set('mmkv_migrated', true);
    } catch {
        // 마이그레이션 실패해도 앱은 계속 동작
    }
}
