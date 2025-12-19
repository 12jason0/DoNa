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

    // [법적 필수] 마케팅 수신 동의한 사용자만 필터링
    const marketingAgreedUsers = await prisma.user
        .findMany({
            where: {
                id: { in: uniqueUserIds },
                isMarketingAgreed: true, // 마케팅 수신 동의한 사용자만
            },
            select: { id: true },
        })
        .catch(() => [] as { id: number }[]);

    const agreedUserIds = marketingAgreedUsers.map((u) => u.id);
    if (agreedUserIds.length === 0) return { success: true, sent: 0 };

    // 토큰 조회 (구독자만 + 마케팅 동의한 사용자만)
    const tokens = await prisma.pushToken
        .findMany({
            where: { userId: { in: agreedUserIds }, subscribed: true },
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
    // 1) 토큰 조회 (구독자만 + 마케팅 수신 동의한 사용자만) - [법적 필수] 정보통신망법 준수
    let tokens: { token: string; userId: number }[] = [];
    try {
        // Prisma Client가 subscribed 필드를 인지하는 경우
        tokens = await (prisma.pushToken as any).findMany({
            where: { subscribed: true },
            select: { token: true, userId: true },
        });
    } catch {
        // 아직 마이그레이션/클라이언트 재생성이 안 된 경우 전체 발송으로 폴백
        tokens = await prisma.pushToken
            .findMany({ select: { token: true, userId: true } })
            .catch(() => [] as { token: string; userId: number }[]);
    }

    // [법적 필수] 마케팅 수신 동의한 사용자만 필터링
    const userIds = tokens.map((t) => t.userId).filter(Boolean);
    const marketingAgreedUsers = await prisma.user
        .findMany({
            where: {
                id: { in: userIds },
                isMarketingAgreed: true, // 마케팅 수신 동의한 사용자만
            },
            select: { id: true },
        })
        .catch(() => [] as { id: number }[]);

    const agreedUserIds = new Set(marketingAgreedUsers.map((u) => u.id));
    const valid = tokens.filter((t) => t.token && agreedUserIds.has(t.userId)).map((t) => t.token);
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
// ⚠️ [법적 필수] 마케팅 수신 동의한 사용자에게만 발송 (정보통신망법 준수)
export async function sendPushNotificationToEveryone(title: string, body: string, data?: PushData) {
    // 마케팅 수신 동의한 사용자만 조회
    const marketingAgreedUsers = await prisma.user
        .findMany({
            where: { isMarketingAgreed: true },
            select: { id: true },
        })
        .catch(() => [] as { id: number }[]);

    const agreedUserIds = marketingAgreedUsers.map((u) => u.id);
    if (agreedUserIds.length === 0) return { success: true, sent: 0 };

    // 동의한 사용자의 토큰만 조회
    const tokens = await prisma.pushToken
        .findMany({
            where: { userId: { in: agreedUserIds } },
            select: { token: true },
        })
        .catch(() => [] as { token: string }[]);

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
