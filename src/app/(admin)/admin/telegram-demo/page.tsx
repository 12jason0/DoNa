// 체험 데모 전용: 텔레그램 봇으로 장소를 등록하면 어떤 대화가 오가고 DB에 무엇이 들어오는지 예시 데이터로 보여줌
// 문구는 src/app/api/telegram/webhook/route.ts, src/lib/tipPipeline.ts runTipPipeline 과 같은 형식. 운영(DEMO_MODE 없음)에서는 404
import Link from "next/link";
import { notFound } from "next/navigation";
import prisma from "@/lib/db";
import { isDemoMode } from "@/lib/demo";
import { TIP_STATUS_LABEL } from "@/types/tip";

export const dynamic = "force-dynamic";

/** 사람이 캡션에 쓰는 동네 이름 (주소의 구 → 동네) */
const NEIGHBORHOOD: Record<string, string> = { 성동구: "성수", 마포구: "연남", 종로구: "익선", 용산구: "한남", 송파구: "잠실", 강남구: "신사" };

type Msg = { from: "me" | "bot"; text: string; buttons?: string[]; photo?: string | null };

function Bubble({ m }: { m: Msg }) {
    const mine = m.from === "me";
    return (
        <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap ${mine ? "bg-green-600 text-white" : "bg-white border border-gray-200 text-gray-800"}`}>
                {m.photo && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={m.photo} alt="" className="rounded-lg mb-2 w-48 h-32 object-cover" />
                )}
                {m.text}
                {m.buttons && (
                    <div className="flex gap-2 mt-2">
                        {m.buttons.map((b) => (
                            <span key={b} className="flex-1 text-center rounded-lg bg-gray-100 text-gray-700 px-3 py-1 text-xs font-semibold">
                                {b}
                            </span>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

export default async function TelegramDemoPage() {
    if (!isDemoMode()) notFound();

    const places = await prisma.place.findMany({
        where: { status: "draft", kakao_place_id: { not: null } },
        orderBy: { created_at: "desc" },
        take: 3,
        select: {
            id: true,
            name: true,
            address: true,
            category: true,
            imageUrl: true,
            instagram_handle: true,
            latitude: true,
            tip_status: true,
            created_at: true,
            tip_runs: { where: { kind: "pipeline" }, orderBy: { started_at: "desc" }, take: 1 },
            _count: { select: { tip_sources: true, tip_candidates: true } },
        },
    });

    return (
        <div className="max-w-5xl">
            <h1 className="text-2xl font-bold mb-2">🤖 텔레그램 등록 예시</h1>
            <p className="text-gray-600 mb-6 text-sm leading-relaxed">
                운영에서는 관리자가 텔레그램 봇에 사진과 &quot;장소이름 | 지역 | 카테고리&quot;를 보내면, 카카오 장소 확인 → 자동 채우기(주소·영업시간·번역) → <b>임시저장(draft)</b> 장소 생성 →
                팁 자료 수집·AI 후보 생성까지 이어져요. 데모에서는 봇을 실제로 돌리지 않고, 그렇게 들어온 결과를 예시 데이터로 보여줘요.
            </p>

            {places.length === 0 && <p className="text-gray-500">예시 데이터가 없어요. npm run demo:seed 를 다시 실행해 주세요.</p>}

            <div className="space-y-8">
                {places.map((p) => {
                    const gu = (p.address || "").split(/\s+/).find((w) => w.endsWith("구")) || "";
                    const nb = NEIGHBORHOOD[gu] || gu;
                    const run = p.tip_runs[0];
                    const secs = run?.finished_at ? Math.round((run.finished_at.getTime() - run.started_at.getTime()) / 1000) : null;
                    const msgs: Msg[] = [
                        { from: "me", photo: p.imageUrl, text: `${p.name} | ${nb} | ${p.category ?? ""}` },
                        { from: "bot", text: `여기 맞아요?\n\n${p.name}\n   ${p.address ?? ""}`, buttons: ["맞아요", "아니에요"] },
                        { from: "me", text: "맞아요" },
                        { from: "bot", text: `📍 "${p.name}" / ${nb} (${p.category ?? ""}) 저장 중...` },
                        {
                            from: "bot",
                            text: `✅ "${p.name}" 저장 완료!\n\nID: ${p.id}\n📍 지역: ${nb}\n🏷 카테고리: ${p.category ?? ""}\n🗓 기간: 상설${p.instagram_handle ? `\n📷 인스타: @${p.instagram_handle}` : ""}\n어드민에서 확인·수정 후 발행하세요.`,
                        },
                        { from: "bot", text: "📚 팁 자료 모으는 중... 끝나면 알려드릴게요." },
                    ];
                    if (run && !run.error) {
                        msgs.push({
                            from: "bot",
                            text: `📝 "${p.name}" 팁 후보 ${run.candidate ?? 0}개, 가게 공식 ${run.official ?? 0}개, 확인 필요 ${run.needs_check ?? 0}개\n(자료 ${run.source_count ?? 0}건, 관련 없음 ${run.filtered_count ?? 0}건 제외)\n\n검수: /admin/tips/${p.id}`,
                        });
                    }
                    return (
                        <section key={p.id} className="grid md:grid-cols-2 gap-4">
                            <div className="rounded-2xl bg-sky-50 border border-sky-100 p-4 space-y-2">
                                <p className="text-xs text-sky-700 font-semibold mb-1">텔레그램 대화 (예시)</p>
                                {msgs.map((m, i) => (
                                    <Bubble key={i} m={m} />
                                ))}
                            </div>
                            <div className="rounded-2xl bg-white border border-gray-200 p-4 text-sm">
                                <p className="text-xs text-gray-500 font-semibold mb-3">DB에 들어온 결과</p>
                                <dl className="grid grid-cols-[7rem_1fr] gap-y-2">
                                    <dt className="text-gray-500">장소</dt>
                                    <dd className="font-semibold">
                                        {p.name} <span className="text-xs text-gray-400">ID {p.id}</span>
                                    </dd>
                                    <dt className="text-gray-500">상태</dt>
                                    <dd>
                                        <span className="rounded bg-yellow-100 text-yellow-800 px-2 py-0.5 text-xs font-semibold">draft (임시저장)</span>
                                    </dd>
                                    <dt className="text-gray-500">주소·좌표</dt>
                                    <dd>
                                        {p.address} {p.latitude != null && <span className="text-xs text-gray-400">(좌표 있음)</span>}
                                    </dd>
                                    <dt className="text-gray-500">팁 상태</dt>
                                    <dd>{p.tip_status ? TIP_STATUS_LABEL[p.tip_status] ?? p.tip_status : "-"}</dd>
                                    <dt className="text-gray-500">모은 자료</dt>
                                    <dd>{p._count.tip_sources}건 · 후보 {p._count.tip_candidates}개</dd>
                                    <dt className="text-gray-500">자동 처리</dt>
                                    <dd>{secs != null ? `${secs}초 ("맞아요" ~ 후보 생성)` : "-"}</dd>
                                </dl>
                                <div className="flex flex-wrap gap-2 mt-4">
                                    <Link href={`/admin/tips/${p.id}`} className="rounded-lg bg-green-600 text-white px-3 py-2 text-xs font-semibold">
                                        팁 검수 화면 열기
                                    </Link>
                                </div>
                            </div>
                        </section>
                    );
                })}
            </div>
        </div>
    );
}
