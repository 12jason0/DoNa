import prisma from "@/lib/db";

type PushData = Record<string, any> | undefined;

// Expo Push API 헤더 생성 (Access Token 포함)
function getExpoPushHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
        Accept: "application/json",
        "Content-Type": "application/json",
    };

    // Access Token이 있으면 헤더에 추가 (선택사항)
    const accessToken = process.env.EXPO_ACCESS_TOKEN;
    if (accessToken) {
        headers.Authorization = `Bearer ${accessToken}`;
    }

    return headers;
}

// 지정 사용자들에게만 발송
export async function sendPushNotificationToUsers(userIds: number[], title: string, body: string, data?: PushData) {
    const uniqueUserIds = Array.from(new Set(userIds.filter((id) => Number.isFinite(Number(id)))));
    if (uniqueUserIds.length === 0) return { success: true, sent: 0 };

    // 토큰 조회 (구독자만)
    const tokens = await prisma.pushToken
        .findMany({
            where: { userId: { in: uniqueUserIds }, subscribed: true },
            select: { token: true },
        })
        .catch(() => [] as { token: string }[]);

    const valid = tokens.map((t) => t.token).filter(Boolean);
    if (valid.length === 0) return { success: true, sent: 0 };

    // Expo Push API로 전송 (100개 단위)
    const batchSize = 100;
    let sent = 0;
    for (let i = 0; i < valid.length; i += batchSize) {
        const slice = valid.slice(i, i + batchSize);
        const messages = slice.map((token) => ({
            to: token,
            sound: "default",
            title,
            body,
            data: data || {},
        }));

        try {
            const resp = await fetch("https://exp.host/--/api/v2/push/send", {
                method: "POST",
                headers: getExpoPushHeaders(),
                body: JSON.stringify(messages),
            });
            sent += slice.length;
            await resp.json().catch(() => ({}));
        } catch (err) {
            console.error("Expo push send failed:", err);
        }
    }

    return { success: true, sent };
}

// 구독자에게만 발송
export async function sendPushNotificationToAll(title: string, body: string, data?: PushData) {
    // 1) 토큰 조회 (구독자만) - 스키마 미반영 환경에서도 동작하도록 폴백 처리
    let tokens: { token: string }[] = [];
    try {
        // Prisma Client가 subscribed 필드를 인지하는 경우
        tokens = await (prisma.pushToken as any).findMany({ where: { subscribed: true }, select: { token: true } });
    } catch {
        // 아직 마이그레이션/클라이언트 재생성이 안 된 경우 전체 발송으로 폴백
        tokens = await prisma.pushToken.findMany({ select: { token: true } }).catch(() => [] as { token: string }[]);
    }
    const valid = tokens.map((t) => t.token).filter(Boolean);
    if (valid.length === 0) return { success: true, sent: 0 };

    // 2) Expo Push API로 전송 (100개 단위 배치)
    const batchSize = 100;
    let sent = 0;
    for (let i = 0; i < valid.length; i += batchSize) {
        const slice = valid.slice(i, i + batchSize);
        const messages = slice.map((token) => ({
            to: token,
            sound: "default",
            title,
            body,
            data: data || {},
        }));

        try {
            const resp = await fetch("https://exp.host/--/api/v2/push/send", {
                method: "POST",
                headers: getExpoPushHeaders(),
                body: JSON.stringify(messages),
            });
            sent += slice.length;
            // 응답을 읽긴 하지만, 실패해도 전체 흐름을 막지 않음
            await resp.json().catch(() => ({}));
        } catch (err) {
            // 개별 배치 실패는 로그만 남김
            console.error("Expo push send failed:", err);
        }
    }

    return { success: true, sent };
}

// 모든 사용자에게 발송(구독 여부 무시) - 관리자 홍보용
export async function sendPushNotificationToEveryone(title: string, body: string, data?: PushData) {
    const tokens = await prisma.pushToken.findMany({ select: { token: true } }).catch(() => [] as { token: string }[]);
    const valid = tokens.map((t) => t.token).filter(Boolean);
    if (valid.length === 0) return { success: true, sent: 0 };

    const batchSize = 100;
    let sent = 0;
    for (let i = 0; i < valid.length; i += batchSize) {
        const slice = valid.slice(i, i + batchSize);
        const messages = slice.map((token) => ({ to: token, sound: "default", title, body, data: data || {} }));
        try {
            const resp = await fetch("https://exp.host/--/api/v2/push/send", {
                method: "POST",
                headers: getExpoPushHeaders(),
                body: JSON.stringify(messages),
            });
            sent += slice.length;
            await resp.json().catch(() => ({}));
        } catch (err) {
            console.error("Expo push send failed:", err);
        }
    }
    return { success: true, sent };
}
