import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { verifyAdminJwt } from "@/lib/auth";
import { approveTip, EDITED_STATUS, generateTipCandidates, hasSameTip, HUMAN_STATUSES, logTipRun, MANUAL_STATUS, refreshTipStatus, removeApprovedTip, runTipPipeline, updateApprovedTip } from "@/lib/tipPipeline";
import { TIP_CATEGORY_VALUES } from "@/types/tip";
import { parseTipsFromDb } from "@/types/tip";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300; // 다시 모으기 = 수집 + Claude 1회 (최대 약 150초)

type Ctx = { params: Promise<{ placeId: string }> };

/** 장소 상세: 근거 자료 + 후보 + 승인된 팁 + 이 장소가 들어간 코스. ?open=1 이면 작업 시간 기록 시작 */
export async function GET(req: NextRequest, { params }: Ctx) {
    if (!verifyAdminJwt(req)) return NextResponse.json({ error: "관리자 인증이 필요합니다." }, { status: 401 });
    const placeId = Number((await params).placeId);

    const place = await prisma.place.findUnique({
        where: { id: placeId },
        select: {
            id: true,
            name: true,
            address: true,
            category: true,
            tip_status: true,
            tip_sources: { orderBy: [{ source_type: "asc" }, { written_at: "desc" }] },
            tip_candidates: { where: { status: { not: "rejected" } }, orderBy: [{ status: "asc" }, { source_count: "desc" }] },
            place_tips: { orderBy: { approved_at: "desc" } },
            coursePlaces: { select: { id: true, tips: true, course: { select: { id: true, title: true } } } },
        },
    });
    if (!place) return NextResponse.json({ error: "장소 없음" }, { status: 404 });

    if (req.nextUrl.searchParams.get("open") === "1") {
        await prisma.tipWorkLog.create({ data: { place_id: placeId } });
    }

    const { coursePlaces, ...rest } = place;
    return NextResponse.json({
        ...rest,
        courses: coursePlaces.map((cp) => ({ id: cp.course.id, title: cp.course.title, tips: parseTipsFromDb(cp.tips) })),
    });
}

/**
 * action:
 *  approve {candidateId, category, content}  — 승인 / 수정 후 승인
 *  reject {candidateId}
 *  editCandidate {candidateId, category, content} — 후보 수정만 (승인 안 함). 자동 후보는 "수정함"이 돼서 다시 만들어도 남음
 *  add {category, content}                    — 직접 작성 후보 추가 (승인은 따로). 같은 문장 있으면 409
 *  editTip {tipId, category, content}         — 승인 팁 수정 (코스 팁도 같이)
 *  demote {tipId} / deleteTip {tipId}         — 승인 팁을 후보로 내림 / 삭제 (코스 팁에서 빠짐)
 *  paste {text}                               — 가게 공지·메뉴판 붙여넣기 → 후보 다시 만들기
 *  recollect                                  — 자료 다시 모으기 + 후보 다시 만들기
 */
export async function POST(req: NextRequest, { params }: Ctx) {
    if (!verifyAdminJwt(req)) return NextResponse.json({ error: "관리자 인증이 필요합니다." }, { status: 401 });
    const placeId = Number((await params).placeId);
    const body = await req.json();

    try {
        switch (body.action) {
            case "approve":
                return NextResponse.json(
                    await approveTip(placeId, { category: String(body.category ?? ""), content: String(body.content ?? "") }, body.candidateId ?? undefined)
                );
            case "add": {
                const content = String(body.content ?? "").trim();
                const category = (TIP_CATEGORY_VALUES as readonly string[]).includes(body.category) ? body.category : "ETC";
                if (!content) return NextResponse.json({ error: "팁 내용이 비어 있어요" }, { status: 400 });
                if (await hasSameTip(placeId, content)) return NextResponse.json({ error: "같은 문장이 이미 있어요" }, { status: 409 });
                const candidate = await prisma.tipCandidate.create({ data: { place_id: placeId, category, content, status: MANUAL_STATUS, source_ids: [] } });
                await prisma.place.update({ where: { id: placeId }, data: { tip_status: "review" } });
                return NextResponse.json({ candidate });
            }
            case "editCandidate": {
                const content = String(body.content ?? "").trim();
                const category = (TIP_CATEGORY_VALUES as readonly string[]).includes(body.category) ? body.category : "ETC";
                if (!content) return NextResponse.json({ error: "팁 내용이 비어 있어요" }, { status: 400 });
                const prev = await prisma.tipCandidate.findFirstOrThrow({ where: { id: Number(body.candidateId), place_id: placeId }, select: { status: true } });
                const status = HUMAN_STATUSES.includes(prev.status) ? prev.status : EDITED_STATUS;
                const candidate = await prisma.tipCandidate.update({ where: { id: Number(body.candidateId) }, data: { category, content, status } });
                return NextResponse.json({ candidate });
            }
            case "editTip":
                return NextResponse.json(await updateApprovedTip(placeId, Number(body.tipId), { category: String(body.category ?? ""), content: String(body.content ?? "") }));
            case "demote":
            case "deleteTip": {
                const r = await removeApprovedTip(placeId, Number(body.tipId), body.action === "demote");
                await refreshTipStatus(placeId);
                return NextResponse.json(r);
            }
            case "reject":
                await prisma.tipCandidate.update({ where: { id: Number(body.candidateId), place_id: placeId }, data: { status: "rejected", decided_at: new Date() } });
                await refreshTipStatus(placeId);
                return NextResponse.json({ ok: true });
            case "paste": {
                const text = String(body.text ?? "").trim();
                if (!text) return NextResponse.json({ error: "붙여넣은 내용이 없어요" }, { status: 400 });
                await prisma.tipSource.create({
                    data: { place_id: placeId, source_type: "owner_text", author: "가게 공지·메뉴판", title: "관리자 붙여넣기", content: text.slice(0, 5000), written_at: new Date() },
                });
                const startedAt = new Date();
                const r = await generateTipCandidates(placeId);
                await logTipRun({
                    place_id: placeId,
                    kind: "paste",
                    started_at: startedAt,
                    finished_at: new Date(),
                    candidate: r.candidate,
                    official: r.official,
                    needs_check: r.needsCheck,
                    input_tokens: r.tokens.input,
                    output_tokens: r.tokens.output,
                });
                return NextResponse.json(r);
            }
            case "recollect":
                return NextResponse.json(await runTipPipeline(placeId));
            default:
                return NextResponse.json({ error: "알 수 없는 action" }, { status: 400 });
        }
    } catch (e) {
        console.error("팁 검수 처리 실패:", e);
        return NextResponse.json({ error: e instanceof Error ? e.message : "처리 실패" }, { status: 500 });
    }
}
