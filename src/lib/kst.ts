/**
 * KST(한국 표준시) 기준 날짜/시간 처리
 * 서버 UTC 환경에서 안전하게 "오늘" 범위 계산
 */
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** KST 기준 오늘 00:00:00 ~ 23:59:59.999 UTC Date 반환 */
export function getKSTTodayRange(): { start: Date; end: Date } {
    const now = new Date();
    const kstMs = now.getTime() + KST_OFFSET_MS;
    const kstDate = new Date(kstMs);
    const y = kstDate.getUTCFullYear();
    const m = kstDate.getUTCMonth();
    const d = kstDate.getUTCDate();
    const start = new Date(Date.UTC(y, m, d) - KST_OFFSET_MS);
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000 - 1);
    return { start, end };
}

/** 현재 KST 시각이 21시 이후인지 */
export function isAfter9PMKST(): boolean {
    const now = new Date();
    const kstMs = now.getTime() + KST_OFFSET_MS;
    const kstDate = new Date(kstMs);
    return kstDate.getUTCHours() >= 21;
}
