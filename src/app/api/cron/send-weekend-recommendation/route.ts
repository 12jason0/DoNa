import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { sendPushToUser } from "@/lib/push";
import { captureApiError } from "@/lib/sentry";
import {
    fetchWeekendForecast,
    getWeekendWeatherRisk,
    getWeekendTargetDateStr,
} from "@/lib/weekendRecommendation";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const PUSH_CONCURRENCY = 5;
const MAX_ERRORS_IN_RESPONSE = 20;

// 서울 기준 격자 좌표
const SEOUL_NX = 60;
const SEOUL_NY = 127;

async function fetchSeoulAirQuality(): Promise<"미세먼지" | "황사" | null> {
    const apiKey = process.env.KMA_API_KEY;
    if (!apiKey) return null;
    try {
        const url =
            `https://apis.data.go.kr/B552584/ArpltnInforinquireSvc/getCtprvnRltmMesureDnsty` +
            `?serviceKey=${encodeURIComponent(apiKey)}&numOfRows=1&pageNo=1` +
            `&sidoName=${encodeURIComponent("서울")}&ver=1.3&returnType=json`;
        const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
        if (!res.ok) return null;
        const json = await res.json();
        const item = json?.response?.body?.items?.[0];
        if (!item) return null;
        const pm10 = parseInt(String(item.pm10Value ?? ""), 10);
        const pm25 = parseInt(String(item.pm25Value ?? ""), 10);
        if (pm10 > 150 || pm25 > 75) return "황사";
        if (pm10 > 75 || pm25 > 35) return "미세먼지";
        return null;
    } catch {
        return null;
    }
}

function buildNotificationContent(
    weatherRisk: { rainLikely: boolean } | null,
    airStatus: "미세먼지" | "황사" | null,
    fcstItems: Awaited<ReturnType<typeof fetchWeekendForecast>>,
    targetDateStr: string,
): { title: string; body: string } {
    // 하늘 상태 판단 (SKY: 1=맑음, 3=구름많음, 4=흐림)
    const skyItems = fcstItems.filter(
        (it) =>
            (it.fcstDate ?? it.fcst_date) === targetDateStr &&
            it.category === "SKY",
    );
    const skyValues = skyItems.map((it) =>
        parseInt(String(it.fcstValue ?? it.fcst_value ?? "1"), 10),
    );
    const avgSky =
        skyValues.length > 0
            ? skyValues.reduce((a, b) => a + b, 0) / skyValues.length
            : 1;

    if (airStatus === "황사") {
        return {
            title: "황사 있어도 데이트는 해야죠 🌫️",
            body: "먼지 걱정 없는 코스 있어요",
        };
    }
    if (airStatus === "미세먼지") {
        return {
            title: "오늘은 밖보다 안이 나을 것 같아요 😷",
            body: "실내 데이트 어때요?",
        };
    }
    if (weatherRisk?.rainLikely) {
        return {
            title: "비 오는 날엔 이런 데이트 어때요 ☔",
            body: "감성 실내 코스 준비했어요",
        };
    }
    if (avgSky >= 3.5) {
        return {
            title: "흐린 날 감성, DoNa가 알아요 🌥️",
            body: "코스 골라뒀어요",
        };
    }
    if (avgSky >= 2.5) {
        return {
            title: "이번 주말 구름 조금 🌤️",
            body: "산책하기 딱 좋은 날씨예요",
        };
    }
    return {
        title: "이번 주말 날씨 너무 아까워요 ☀️",
        body: "야외 코스 골라뒀어요",
    };
}

/**
 * [Vercel Cron] 매주 목요일 20:00 KST 실행 (UTC 11:00)
 * 이번 주말 날씨(비/눈/미세먼지/맑음 등)를 확인하고
 * 날씨에 맞는 데이트 코스 추천 알림 발송
 */
export async function GET(req: NextRequest) {
    try {
        const authHeader = req.headers.get("authorization");
        const cronSecret = process.env.CRON_SECRET || "default-secret-change-in-production";
        if (authHeader !== `Bearer ${cronSecret}`) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // 멱등성 처리: 같은 날 이미 실행된 경우 중복 방지
        const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
        const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;
        const todayKST = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
        const idempotencyKey = `cron:weekend-rec:${todayKST}`;

        if (redisUrl && redisToken) {
            const getRes = await fetch(`${redisUrl}/get/${idempotencyKey}`, {
                headers: { Authorization: `Bearer ${redisToken}` },
            });
            const getJson = await getRes.json();
            if (getJson?.result === "done") {
                return NextResponse.json({ success: true, skipped: true, reason: "already sent today" });
            }
            await fetch(`${redisUrl}/set/${idempotencyKey}/done/ex/90000`, {
                headers: { Authorization: `Bearer ${redisToken}` },
            });
        }

        // 주말 날씨 조회
        const apiKey = process.env.KMA_API_KEY ?? "";
        const targetDateStr = getWeekendTargetDateStr();

        const [fcstItems, airStatus] = await Promise.all([
            fetchWeekendForecast(SEOUL_NX, SEOUL_NY, apiKey),
            fetchSeoulAirQuality(),
        ]);

        const weatherRisk = fcstItems.length > 0
            ? getWeekendWeatherRisk(fcstItems, targetDateStr)
            : null;

        const { title, body } = buildNotificationContent(weatherRisk, airStatus, fcstItems, targetDateStr);

        // 알림 수신 동의 유저 전체 조회
        const tokens = await prisma.pushToken.findMany({
            where: { subscribed: true },
            select: { userId: true },
        });

        if (tokens.length === 0) {
            return NextResponse.json({ success: true, total: 0, sent: 0, title, body });
        }

        const data = { screen: "home", url: "/?openMoreCourses=weekend" };

        let sent = 0;
        const errors: Array<{ userId: number; reason: string }> = [];

        for (let i = 0; i < tokens.length; i += PUSH_CONCURRENCY) {
            const chunk = tokens.slice(i, i + PUSH_CONCURRENCY);
            const results = await Promise.all(
                chunk.map(async ({ userId }) => {
                    const result = await sendPushToUser(userId, title, body, data);
                    if (result.ok) return { sent: 1, error: null as { userId: number; reason: string } | null };
                    return { sent: 0, error: { userId, reason: result.reason ?? "알 수 없음" } };
                }),
            );
            sent += results.reduce((s, r) => s + r.sent, 0);
            for (const r of results) {
                if (r.error) {
                    errors.push(r.error);
                    if (errors.length >= MAX_ERRORS_IN_RESPONSE) break;
                }
            }
        }

        return NextResponse.json({
            success: true,
            total: tokens.length,
            sent,
            title,
            body,
            weather: { weatherRisk, airStatus, targetDateStr },
            errors: errors.slice(0, MAX_ERRORS_IN_RESPONSE),
        });
    } catch (error) {
        captureApiError(error);
        console.error("[weekend-recommendation cron]", error);
        return NextResponse.json({ error: "Cron failed" }, { status: 500 });
    }
}
