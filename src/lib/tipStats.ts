// 팁 파이프라인 누적 숫자 (정부지원사업용). 통계 화면·주간 텔레그램 공통 단가
import prisma from "@/lib/db";
import { REVIEW_STATUSES } from "@/lib/tipPipeline";

// claude-sonnet-4-6 단가 (USD / 100만 토큰)
export const PRICE_IN = 3;
export const PRICE_OUT = 15;
// 구글 Places 상세(연락처 + 리뷰) 정가: 기본 $17 + 연락처 $3 + 분위기(리뷰) $5 / 1,000회. 월 무료 한도는 빼지 않은 상한
// ponytail: 장소 찾기($17)도 같은 단가로 셈. 정확히 나눠야 하면 tip_runs에 종류별 호출 수
export const GOOGLE_USD_PER_CALL = 0.025;
// ponytail: 고정 환율. 원화 비용을 정확히 맞춰야 하면 환율 API나 환경변수로 교체
export const USD_KRW = 1400;

export const claudeUsd = (input: number, output: number) => (input * PRICE_IN + output * PRICE_OUT) / 1e6;

/**
 * 지금까지 누적:
 * - 처리 시간: 실패 없는 pipeline 실행의 started_at~finished_at (텔레그램 저장은 "맞아요" 누른 때부터)
 * - 비용: 파이프라인을 1번 이상 돈 장소 수로 나눔. Claude는 생성·붙여넣기·번역 전부, 구글은 google_calls
 * - 결과 비율: AI 후보(근거 1개 이상)만. 직접 작성한 후보·팁은 뺌
 */
export async function tipKpis() {
    const [runs, decided, aiPending, tips, donePlaces, officialPending, ownerSources] = await Promise.all([
        prisma.tipRun.findMany({ select: { place_id: true, kind: true, started_at: true, finished_at: true, error: true, input_tokens: true, output_tokens: true, google_calls: true } }),
        prisma.tipCandidate.findMany({ where: { status: { in: ["approved", "rejected"] }, NOT: { source_ids: { isEmpty: true } } }, select: { id: true, status: true } }),
        prisma.tipCandidate.count({ where: { status: { in: REVIEW_STATUSES }, NOT: { source_ids: { isEmpty: true } } } }),
        prisma.placeTip.findMany({ select: { candidate_id: true, edited: true } }),
        prisma.place.count({ where: { tip_status: "done" } }),
        prisma.tipCandidate.count({ where: { status: "official" } }),
        prisma.tipSource.findMany({ where: { source_type: "owner_text" }, select: { id: true } }),
    ]);

    const pipeline = runs.filter((r) => r.kind === "pipeline");
    const places = new Set(pipeline.map((r) => r.place_id)).size;
    const secs = pipeline.filter((r) => r.finished_at && !r.error).map((r) => (r.finished_at!.getTime() - r.started_at.getTime()) / 1000);
    const claude = runs.reduce((a, r) => a + claudeUsd(r.input_tokens, r.output_tokens), 0);
    const google = runs.reduce((a, r) => a + r.google_calls * GOOGLE_USD_PER_CALL, 0);

    const editedByCandidate = new Map(tips.filter((t) => t.candidate_id).map((t) => [t.candidate_id!, t.edited]));
    let asIs = 0, edited = 0, rejected = 0;
    for (const c of decided) {
        if (c.status === "rejected") rejected++;
        else if (editedByCandidate.get(c.id)) edited++;
        else asIs++;
    }
    const n = asIs + edited + rejected;
    // 승인되면 status가 approved로 바뀌어 "가게 공식" 표시가 사라짐 → 근거에 가게 공지·메뉴판(owner_text)이 들어간 승인 팁으로 셈
    const officialApproved = ownerSources.length
        ? await prisma.tipCandidate.count({ where: { status: "approved", source_ids: { hasSome: ownerSources.map((s) => s.id) } } })
        : 0;

    return {
        places,
        runs: pipeline.length,
        avgSeconds: secs.length ? secs.reduce((a, b) => a + b, 0) / secs.length : null,
        perPlaceKrw: places ? { claude: (claude / places) * USD_KRW, google: (google / places) * USD_KRW } : null,
        outcomes: { asIs, edited, rejected, rates: n ? { asIs: asIs / n, edited: edited / n, rejected: rejected / n } : null, pending: aiPending },
        donePlaces,
        approvedTips: tips.length,
        official: { pending: officialPending, approved: officialApproved },
    };
}

const pct = (x: number) => `${Math.round(x * 1000) / 10}%`;
const krw = (x: number) => `${Math.round(x).toLocaleString("ko-KR")}원`;

export function tipKpiText(k: Awaited<ReturnType<typeof tipKpis>>) {
    const o = k.outcomes;
    return [
        "📊 팁 파이프라인 누적 숫자",
        `처리 장소 ${k.places}곳 (자동 처리 ${k.runs}회)`,
        `장소당 평균 처리 시간: ${k.avgSeconds == null ? "기록 없음" : `${Math.round(k.avgSeconds * 10) / 10}초`}`,
        k.perPlaceKrw ? `장소당 평균 API 비용: Claude ${krw(k.perPlaceKrw.claude)} · 구글 ${krw(k.perPlaceKrw.google)} (구글은 정가 상한, 환율 ${USD_KRW})` : "장소당 평균 API 비용: 기록 없음",
        o.rates
            ? `AI 후보 결과 (${o.asIs + o.edited + o.rejected}개 결정): 그대로 승인 ${pct(o.rates.asIs)} · 수정 후 승인 ${pct(o.rates.edited)} · 삭제 ${pct(o.rates.rejected)} / 검수 대기 ${o.pending}개`
            : `AI 후보 결과: 아직 결정한 후보 없음 / 검수 대기 ${o.pending}개`,
        `검수 완료 장소 ${k.donePlaces}곳 · 승인된 팁 ${k.approvedTips}개`,
        `가게 공식 팁: 승인 ${k.official.approved}개 (근거에 가게 공지·메뉴판) · 검수 대기 ${k.official.pending}개`,
    ].join("\n");
}
