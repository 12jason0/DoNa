import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { verifyAdminJwt } from "@/lib/auth";
import { claudeUsd, USD_KRW } from "@/lib/tipStats";

export const dynamic = "force-dynamic";

const won = (input: number, output: number) => claudeUsd(input, output) * USD_KRW;
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const median = (xs: number[]) => {
    if (!xs.length) return null;
    const s = [...xs].sort((a, b) => a - b);
    const m = Math.floor(s.length / 2);
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const secs = (a: Date, b: Date) => (b.getTime() - a.getTime()) / 1000;

/** 팁 파이프라인 통계: ?days=30 (없으면 전체) */
export async function GET(req: NextRequest) {
    if (!verifyAdminJwt(req)) return NextResponse.json({ error: "관리자 인증이 필요합니다." }, { status: 401 });
    const days = Number(req.nextUrl.searchParams.get("days")) || null;
    const since = days ? new Date(Date.now() - days * 24 * 60 * 60 * 1000) : new Date(0);

    const [runs, logs, tips, rejected] = await Promise.all([
        prisma.tipRun.findMany({ where: { started_at: { gte: since } }, orderBy: { started_at: "asc" }, include: { place: { select: { name: true } } } }),
        prisma.tipWorkLog.findMany({ where: { opened_at: { gte: since } } }),
        prisma.placeTip.findMany({ where: { approved_at: { gte: since } }, select: { place_id: true, candidate_id: true, edited: true } }),
        prisma.tipCandidate.findMany({ where: { status: "rejected", decided_at: { gte: since } }, select: { place_id: true } }),
    ]);

    // 장소별로 모으기 (수집 수·후보 수는 장소마다 마지막 실행 기준)
    type Row = {
        placeId: number;
        name: string;
        runs: number;
        autoSeconds: number | null;
        sources: number | null;
        filtered: number | null;
        candidate: number | null;
        official: number | null;
        needsCheck: number | null;
        reviewMinutes: number | null;
        approvedAsIs: number;
        approvedEdited: number;
        rejected: number;
        direct: number;
        inputTokens: number;
        outputTokens: number;
        won: number;
    };
    const rows = new Map<number, Row>();
    const row = (placeId: number, name = "") => {
        if (!rows.has(placeId))
            rows.set(placeId, {
                placeId, name, runs: 0, autoSeconds: null, sources: null, filtered: null, candidate: null, official: null, needsCheck: null,
                reviewMinutes: null, approvedAsIs: 0, approvedEdited: 0, rejected: 0, direct: 0, inputTokens: 0, outputTokens: 0, won: 0,
            });
        return rows.get(placeId)!;
    };

    const autoTimes: number[] = [];
    for (const r of runs) {
        const x = row(r.place_id, r.place.name);
        x.inputTokens += r.input_tokens;
        x.outputTokens += r.output_tokens;
        if (r.kind === "pipeline") {
            x.runs++;
            if (r.source_count != null) {
                x.sources = r.source_count;
                x.filtered = r.filtered_count;
            }
            if (r.finished_at && !r.error) {
                x.autoSeconds = secs(r.started_at, r.finished_at);
                autoTimes.push(x.autoSeconds);
            }
        }
        if ((r.kind === "pipeline" || r.kind === "paste") && !r.error && r.candidate != null) {
            x.candidate = r.candidate;
            x.official = r.official;
            x.needsCheck = r.needs_check;
        }
    }
    const reviewTimes: number[] = [];
    for (const l of logs) {
        if (!l.last_approved_at) continue;
        const m = secs(l.opened_at, l.last_approved_at) / 60;
        reviewTimes.push(m);
        row(l.place_id).reviewMinutes = m; // 장소당 마지막 검수 기준
    }
    for (const t of tips) {
        const x = row(t.place_id);
        if (!t.candidate_id) x.direct++;
        else if (t.edited) x.approvedEdited++;
        else x.approvedAsIs++;
    }
    for (const c of rejected) row(c.place_id).rejected++;

    // 이름이 없는 행(작업 로그·승인만 있는 장소) 채우기
    const missing = [...rows.values()].filter((r) => !r.name).map((r) => r.placeId);
    if (missing.length) {
        for (const p of await prisma.place.findMany({ where: { id: { in: missing } }, select: { id: true, name: true } })) row(p.id).name = p.name;
    }
    const list = [...rows.values()].map((r) => ({ ...r, won: Math.round(won(r.inputTokens, r.outputTokens) * 10) / 10 }));
    const processed = list.filter((r) => r.runs > 0);
    const withSources = processed.filter((r) => r.sources != null);
    const withCandidates = list.filter((r) => r.candidate != null);
    const sum = (f: (r: Row) => number) => list.reduce((a, r) => a + f(r), 0);
    const totalSources = withSources.reduce((a, r) => a + (r.sources ?? 0) + (r.filtered ?? 0), 0);
    const totalFiltered = withSources.reduce((a, r) => a + (r.filtered ?? 0), 0);
    const asIs = sum((r) => r.approvedAsIs), edited = sum((r) => r.approvedEdited), rej = sum((r) => r.rejected);
    const decided = asIs + edited + rej;
    const inputTokens = sum((r) => r.inputTokens), outputTokens = sum((r) => r.outputTokens);
    const totalWon = won(inputTokens, outputTokens);

    return NextResponse.json({
        days,
        usdKrw: USD_KRW,
        placesProcessed: processed.length,
        autoSeconds: { avg: avg(autoTimes), min: autoTimes.length ? Math.min(...autoTimes) : null, max: autoTimes.length ? Math.max(...autoTimes) : null },
        reviewMinutes: { avg: avg(reviewTimes), median: median(reviewTimes), count: reviewTimes.length },
        perPlace: {
            sources: avg(withSources.map((r) => (r.sources ?? 0) + (r.filtered ?? 0))),
            irrelevantRate: totalSources ? totalFiltered / totalSources : null,
            candidate: avg(withCandidates.map((r) => r.candidate ?? 0)),
            official: avg(withCandidates.map((r) => r.official ?? 0)),
            needsCheck: avg(withCandidates.map((r) => r.needsCheck ?? 0)),
        },
        outcomes: { asIs, edited, rejected: rej, rates: decided ? { asIs: asIs / decided, edited: edited / decided, rejected: rej / decided } : null },
        directTips: sum((r) => r.direct),
        claude: {
            inputTokens,
            outputTokens,
            won: Math.round(totalWon),
            wonPerPlace: processed.length ? Math.round(totalWon / processed.length) : null,
        },
        places: list,
    });
}
