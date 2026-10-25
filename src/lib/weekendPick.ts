import { defaultCache } from "@/lib/cache";

// 관리자가 고른 "이번 주말 추천 코스" (목 20:00 주말 알림에 사용). 알림 보내면 지워서 다음 주는 날씨 문구로 돌아감
const KEY = "push:weekend-pick";
const TTL_MS = 14 * 24 * 60 * 60 * 1000; // 안 보내고 남아도 2주 뒤 자동 삭제

export const getWeekendPick = () => defaultCache.get<number>(KEY);
export const setWeekendPick = (courseId: number) => defaultCache.set(KEY, courseId, TTL_MS);
export const clearWeekendPick = () => defaultCache.delete(KEY);
