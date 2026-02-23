import prisma from "@/lib/db";

export type SendPushResult = { ok: boolean; reason?: string };

/**
 * 유저에게 푸시 알림 발송 (내부 호출용)
 * - 푸시 토큰, 마케팅 동의 등 검증 후 Expo API 호출
 */
export async function sendPushToUser(
    userId: number,
    title: string,
    body: string,
    data?: Record<string, unknown>
): Promise<SendPushResult> {
    try {
        const pushToken = await prisma.pushToken.findUnique({
            where: { userId },
        });
        if (!pushToken) {
            return { ok: false, reason: "푸시 토큰 없음" };
        }
        if (pushToken.subscribed === false) {
            return { ok: false, reason: "알림 수신 거부" };
        }

        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { isMarketingAgreed: true },
        });
        if (!user || !user.isMarketingAgreed) {
            return { ok: false, reason: "마케팅 수신 미동의" };
        }

        const message = {
            to: pushToken.token,
            sound: "default" as const,
            title,
            body,
            data: data || {},
            badge: 1,
        };

        const headers: Record<string, string> = {
            Accept: "application/json",
            "Accept-encoding": "gzip, deflate",
            "Content-Type": "application/json",
        };
        const accessToken = process.env.EXPO_ACCESS_TOKEN;
        if (accessToken) {
            headers.Authorization = `Bearer ${accessToken}`;
        }

        const response = await fetch("https://exp.host/--/api/v2/push/send", {
            method: "POST",
            headers,
            body: JSON.stringify(message),
        });
        const result = await response.json();
        const payload = result?.data;
        const first = Array.isArray(payload) ? payload[0] : payload;

        if (first?.status === "ok") {
            return { ok: true };
        }
        if (first?.status === "error") {
            const details = first?.details;
            if (details?.error === "DeviceNotRegistered") {
                await prisma.pushToken.delete({ where: { userId } });
            }
            return { ok: false, reason: first?.message ?? "Expo API 오류" };
        }
        return { ok: false, reason: "Expo 응답 이상" };
    } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return { ok: false, reason: msg };
    }
}
