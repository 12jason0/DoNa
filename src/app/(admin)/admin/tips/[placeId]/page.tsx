"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import ko from "@/i18n/messages/ko/translation.json";
import { TIP_CATEGORY_VALUES, TIP_STATUS_LABEL, type TipItem } from "@/types/tip";

type Source = {
    id: number;
    source_type: string;
    author: string | null;
    title: string | null;
    content: string | null;
    url: string | null;
    written_at: string | null;
    relevant: boolean;
};
type Candidate = {
    id: number;
    category: string;
    content: string;
    status: string;
    conflict: boolean;
    source_ids: number[];
    source_count: number;
    latest_source_at: string | null;
};
type ApprovedTip = { id: number; category: string; content: string; candidate_id: number | null; approved_at: string };
type Detail = {
    id: number;
    name: string;
    address: string | null;
    tip_status: string | null;
    tip_sources: Source[];
    tip_candidates: Candidate[];
    place_tips: ApprovedTip[];
    courses: { id: number; title: string; tips: TipItem[] }[];
};

const SOURCE_LABEL: Record<string, string> = {
    google_info: "구글 정보",
    google_review: "구글 리뷰",
    naver_blog: "네이버 블로그",
    kakao_blog: "카카오 블로그",
    kakao_cafe: "카카오 카페",
    owner_text: "가게 공지·메뉴판",
};
/** "후보" 구역에 나오는 상태 (src/lib/tipPipeline.ts REVIEW_STATUSES) */
const STATUS_BADGE: Record<string, [string, string]> = {
    candidate: ["후보", "bg-green-100 text-green-800"],
    official: ["가게 공식", "bg-blue-100 text-blue-800"],
    needs_check: ["확인 필요", "bg-amber-100 text-amber-800"],
    manual: ["직접 작성", "bg-purple-100 text-purple-800"],
    demoted: ["승인 취소", "bg-gray-200 text-gray-700"],
};
const MAX_LEN = 35;
const catLabel = (c: string) => (ko.tipCategory as Record<string, string>)[c] ?? c;
const day = (d: string | null) => (d ? d.slice(0, 10) : "날짜 모름");
const norm = (t: string) => t.replace(/\s+/g, "");

function CategorySelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
    return (
        <select value={value} onChange={(e) => onChange(e.target.value)} className="border border-gray-200 rounded-lg px-2 py-1 text-sm">
            {TIP_CATEGORY_VALUES.map((c) => (
                <option key={c} value={c}>
                    {catLabel(c)}
                </option>
            ))}
        </select>
    );
}

/** 글자 수 (35자 넘으면 빨강) */
function CharCount({ text }: { text: string }) {
    const n = [...text.trim()].length;
    return <span className={`text-xs ${n > MAX_LEN ? "text-red-600 font-semibold" : "text-gray-400"}`}>{n}자</span>;
}

function SourceCard({ s, citedBy }: { s: Source; citedBy?: number[] }) {
    return (
        <div className={`bg-white rounded-xl border p-3 text-sm ${citedBy ? "border-green-400" : "border-gray-200"}`}>
            <div className="text-xs text-gray-500 mb-1">
                #{s.id} · {SOURCE_LABEL[s.source_type] ?? s.source_type} · {day(s.written_at)}
                {s.author ? ` · ${s.author}` : ""}
                {citedBy && <span className="ml-1 px-1.5 rounded bg-green-100 text-green-800 font-semibold">후보 {citedBy.join(", ")}번 근거</span>}
            </div>
            {s.title && <div className="font-semibold">{s.title}</div>}
            <div className="whitespace-pre-wrap text-gray-700">{s.content || "(30일 지나 내용 비움)"}</div>
            {s.url && (
                <a href={s.url} target="_blank" rel="noreferrer" className="text-xs text-green-700 hover:underline break-all">
                    {s.url}
                </a>
            )}
        </div>
    );
}

/** 카테고리·문장 편집 칸 (후보·승인 팁 공통) */
function TipEditor({ category, content, setCategory, setContent }: { category: string; content: string; setCategory: (v: string) => void; setContent: (v: string) => void }) {
    return (
        <>
            <div className="flex items-center gap-2 mb-2">
                <CategorySelect value={category} onChange={setCategory} />
                <CharCount text={content} />
            </div>
            <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={2} className="w-full border border-gray-200 rounded-lg p-2 text-sm" />
        </>
    );
}

const btn = "px-3 py-1.5 rounded-lg text-sm disabled:opacity-50";
const btnMain = `${btn} bg-green-600 text-white font-semibold`;
const btnSub = `${btn} bg-white border border-gray-200 text-gray-700`;

function CandidateCard({
    no,
    c,
    courses,
    onApprove,
    onSave,
    onReject,
}: {
    no: number;
    c: Candidate;
    courses: Detail["courses"];
    onApprove: (category: string, content: string) => void;
    onSave: (category: string, content: string) => void;
    onReject: () => void;
}) {
    const [category, setCategory] = useState(c.category);
    const [content, setContent] = useState(c.content);
    const edited = category !== c.category || content !== c.content;
    const sameCategory = courses.filter((co) => co.tips.some((t) => t.category === category));

    return (
        <div className={`bg-white rounded-xl border p-4 ${c.status === "needs_check" ? "border-amber-300" : "border-gray-200"}`}>
            <div className="flex items-center gap-2 mb-2 text-xs">
                <span className="font-bold text-gray-700">{no}번</span>
                <span className={`px-2 py-0.5 rounded-full font-semibold ${STATUS_BADGE[c.status]?.[1] ?? ""}`}>{STATUS_BADGE[c.status]?.[0] ?? c.status}</span>
                {c.conflict && <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-semibold">출처끼리 내용 다름</span>}
                {c.source_ids.length > 0 && (
                    <span className="text-gray-500">
                        근거 {c.source_count}개 · 최근 {day(c.latest_source_at)} · #{c.source_ids.join(", #")}
                    </span>
                )}
            </div>
            <TipEditor category={category} content={content} setCategory={setCategory} setContent={setContent} />
            {sameCategory.length > 0 && (
                <p className="text-xs text-amber-700 mt-1">
                    이 코스에 이미 비슷한 팁 있음 (승인해도 이 코스엔 안 넣어요): {sameCategory.map((co) => co.title).join(", ")}
                </p>
            )}
            <div className="flex gap-2 mt-2">
                <button disabled={!content.trim()} onClick={() => onApprove(category, content)} className={btnMain}>
                    {edited ? "수정 후 승인" : "승인"}
                </button>
                {edited && (
                    <button disabled={!content.trim()} onClick={() => onSave(category, content)} className={btnSub}>
                        수정 저장
                    </button>
                )}
                <button onClick={onReject} className={btnSub}>
                    삭제
                </button>
            </div>
        </div>
    );
}

function ApprovedCard({ t, onSave, onDemote, onDelete }: { t: ApprovedTip; onSave: (category: string, content: string) => void; onDemote: () => void; onDelete: () => void }) {
    const [category, setCategory] = useState(t.category);
    const [content, setContent] = useState(t.content);
    const edited = category !== t.category || content !== t.content;
    return (
        <div className="bg-white rounded-xl border border-green-200 p-4">
            <TipEditor category={category} content={content} setCategory={setCategory} setContent={setContent} />
            <div className="flex gap-2 mt-2">
                {edited && (
                    <button disabled={!content.trim()} onClick={() => onSave(category, content)} className={btnMain}>
                        수정 저장
                    </button>
                )}
                <button onClick={onDemote} className={btnSub}>
                    후보로 내리기
                </button>
                <button
                    onClick={() => {
                        if (window.confirm(`이 팁을 지울까요? 앱(코스 팁)에서도 빠져요.\n\n${t.content}`)) onDelete();
                    }}
                    className={`${btn} bg-white border border-red-200 text-red-600`}
                >
                    삭제
                </button>
            </div>
        </div>
    );
}

export default function AdminTipDetailPage() {
    const { placeId } = useParams<{ placeId: string }>();
    const [data, setData] = useState<Detail | null>(null);
    const [busy, setBusy] = useState(false); // 다시 모으기·붙여넣기 (화면 전체 다시 만듦)
    const [saving, setSaving] = useState(0); // 뒤에서 저장 중인 건수 (승인·수정·삭제)
    const [notice, setNotice] = useState<{ text: string; error?: boolean } | null>(null);
    const [newCategory, setNewCategory] = useState<string>("GOOD_TO_KNOW");
    const [newContent, setNewContent] = useState("");
    const [pasteText, setPasteText] = useState("");
    const opened = useRef(false);
    // 저장 요청은 한 줄로 차례대로 (코스 팁 JSON을 동시에 고치면 서로 덮어씀)
    const queue = useRef<Promise<void>>(Promise.resolve());
    // 화면에 먼저 넣은 임시 id(음수) → 서버가 준 실제 id. 저장이 끝나기 전에 또 누른 버튼도 실제 id로 보냄
    const realId = useRef(new Map<number, number>());
    const tempSeq = useRef(0);
    const tempId = () => --tempSeq.current;
    const idOf = (id: number) => realId.current.get(id) ?? id;

    const load = useCallback(
        (open = false) =>
            fetch(`/api/admin/tips/${placeId}${open ? "?open=1" : ""}`, { credentials: "include", cache: "no-store" })
                .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
                .then(setData)
                .catch((e) => setNotice({ text: `불러오지 못했어요 (${e.message})`, error: true })),
        [placeId]
    );

    useEffect(() => {
        // 작업 시간 기록은 화면을 연 순간 한 번만
        if (opened.current) return;
        opened.current = true;
        load(true);
    }, [load]);

    const post = async (body: object) => {
        const res = await fetch(`/api/admin/tips/${placeId}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify(body),
        });
        const r = await res.json();
        if (!res.ok) throw new Error(r.error || String(res.status));
        return r;
    };

    /**
     * 낙관적 업데이트: 화면부터 바꾸고(optimistic) 서버 저장은 뒤에서. 성공하면 서버 값으로 맞추고(apply),
     * 실패하면 서버에서 다시 불러와 원래대로 되돌리고 오류 표시
     */
    const run = (optimistic: (d: Detail) => Detail, body: () => object, apply?: (d: Detail, r: any) => Detail, okText?: (r: any) => string) => {
        setNotice(null);
        setData((d) => (d ? optimistic(d) : d));
        setSaving((n) => n + 1);
        queue.current = queue.current.then(async () => {
            try {
                const r = await post(body());
                if (apply) setData((d) => (d ? apply(d, r) : d));
                if (okText) setNotice({ text: okText(r) });
            } catch (e) {
                setNotice({ text: `저장 실패해서 되돌렸어요: ${e instanceof Error ? e.message : e}`, error: true });
                await load();
            } finally {
                setSaving((n) => n - 1);
            }
        });
    };

    // 다시 모으기·붙여넣기: 후보 전체가 새로 만들어지므로 기다렸다가 다시 불러옴
    const rebuild = async (body: object, okText: (r: any) => string) => {
        setBusy(true);
        setNotice(null);
        try {
            await queue.current;
            const r = await post(body);
            setNotice({ text: okText(r) });
            await load();
            return true;
        } catch (e) {
            setNotice({ text: `실패: ${e instanceof Error ? e.message : e}`, error: true });
            return false;
        } finally {
            setBusy(false);
        }
    };

    if (!data) return <div className="p-6">{notice?.text || "불러오는 중..."}</div>;

    const replaceCandidate = (d: Detail, id: number, c: Candidate | null) => ({
        ...d,
        tip_candidates: c ? d.tip_candidates.map((x) => (x.id === id ? c : x)) : d.tip_candidates.filter((x) => x.id !== id),
    });
    const replaceTip = (d: Detail, id: number, t: ApprovedTip | null) => ({
        ...d,
        place_tips: t ? d.place_tips.map((x) => (x.id === id ? t : x)) : d.place_tips.filter((x) => x.id !== id),
    });
    const now = () => new Date().toISOString();

    const approve = (c: Candidate, category: string, content: string) => {
        const tmp = tempId();
        run(
            (d) => ({ ...replaceCandidate(d, c.id, null), place_tips: [{ id: tmp, category, content, candidate_id: c.id, approved_at: now() }, ...d.place_tips] }),
            () => ({ action: "approve", candidateId: idOf(c.id), category, content }),
            (d, r) => {
                realId.current.set(tmp, r.tip.id);
                return replaceTip(d, tmp, { ...r.tip, approved_at: now() });
            },
            (r) => `승인했어요. 코스 ${r.appliedCourses}곳에 반영` + (r.skippedCourses.length ? ` · 같은 카테고리 팁이 이미 있어 건너뜀: ${r.skippedCourses.join(", ")}` : "")
        );
    };
    const saveCandidate = (c: Candidate, category: string, content: string) =>
        run(
            (d) => replaceCandidate(d, c.id, { ...c, category, content }),
            () => ({ action: "editCandidate", candidateId: idOf(c.id), category, content })
        );
    const reject = (c: Candidate) => run((d) => replaceCandidate(d, c.id, null), () => ({ action: "reject", candidateId: idOf(c.id) }));
    const saveTip = (t: ApprovedTip, category: string, content: string) =>
        run(
            (d) => replaceTip(d, t.id, { ...t, category, content }),
            () => ({ action: "editTip", tipId: idOf(t.id), category, content })
        );
    const demote = (t: ApprovedTip) => {
        const tmp = tempId();
        const back: Candidate = { id: tmp, category: t.category, content: t.content, status: "demoted", conflict: false, source_ids: [], source_count: 0, latest_source_at: null };
        run(
            (d) => ({ ...replaceTip(d, t.id, null), tip_candidates: [back, ...d.tip_candidates] }),
            () => ({ action: "demote", tipId: idOf(t.id) }),
            (d, r) => {
                realId.current.set(tmp, r.candidate.id);
                // 원래 후보에서 승인한 팁이면 서버는 그 후보 행(source_ids 포함)을 되살려 줌
                return replaceCandidate(d, tmp, r.candidate);
            },
            (r) => `후보로 내렸어요${r.removedFromCourses ? ` · 코스 ${r.removedFromCourses}곳 팁에서 뺌` : ""}`
        );
    };
    const deleteTip = (t: ApprovedTip) =>
        run(
            (d) => replaceTip(d, t.id, null),
            () => ({ action: "deleteTip", tipId: idOf(t.id) }),
            undefined,
            (r) => `지웠어요${r.removedFromCourses ? ` · 코스 ${r.removedFromCourses}곳 팁에서 뺌` : ""}`
        );
    const add = () => {
        const content = newContent.trim();
        if (!content) return;
        if ([...data.place_tips, ...data.tip_candidates.filter((c) => c.status in STATUS_BADGE)].some((t) => norm(t.content) === norm(content))) {
            setNotice({ text: "같은 문장이 이미 있어요", error: true });
            return;
        }
        const tmp = tempId();
        const c: Candidate = { id: tmp, category: newCategory, content, status: "manual", conflict: false, source_ids: [], source_count: 0, latest_source_at: null };
        setNewContent("");
        run(
            (d) => ({ ...d, tip_candidates: [c, ...d.tip_candidates] }),
            () => ({ action: "add", category: c.category, content }),
            (d, r) => {
                realId.current.set(tmp, r.candidate.id);
                return replaceCandidate(d, tmp, r.candidate);
            }
        );
    };

    const pending = data.tip_candidates.filter((c) => c.status in STATUS_BADGE);
    const placeInfo = data.tip_candidates.filter((c) => c.status === "place_info");

    // 근거 자료: 최신순, 아직 검수 안 한 후보가 인용한 글은 위로, 2년 넘은 글은 접어두기, 관련 없는 글은 개수만
    const citedBy = new Map<number, number[]>();
    pending.forEach((c, i) => c.source_ids.forEach((id) => citedBy.set(id, [...(citedBy.get(id) ?? []), i + 1])));
    const relevant = data.tip_sources
        .filter((s) => s.relevant)
        .sort((a, b) => (b.written_at ?? "").localeCompare(a.written_at ?? ""));
    const hiddenCount = data.tip_sources.length - relevant.length;
    const twoYearsAgo = new Date(Date.now() - 2 * 365 * 24 * 60 * 60 * 1000).toISOString();
    const cited = relevant.filter((s) => citedBy.has(s.id));
    const rest = relevant.filter((s) => !citedBy.has(s.id));
    const old = rest.filter((s) => s.written_at && s.written_at < twoYearsAgo);
    const fresh = rest.filter((s) => !old.includes(s));

    return (
        <div className="p-6">
            <Link href="/admin/tips" className="text-sm text-gray-500 hover:underline">
                ← 팁 검수 목록
            </Link>
            <div className="flex items-center justify-between mt-2 mb-4 gap-4 flex-wrap">
                <div>
                    <h1 className="text-2xl font-bold">{data.name}</h1>
                    <p className="text-sm text-gray-500">
                        {data.address} · {TIP_STATUS_LABEL[data.tip_status ?? ""] ?? "시작 전"} · 코스 {data.courses.length}곳에 포함
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    {saving > 0 && <span className="text-xs text-gray-500">저장 중 {saving}건…</span>}
                    <button
                        disabled={busy}
                        onClick={() => rebuild({ action: "recollect" }, (r) => `다시 모았어요. 후보 ${r.candidate}개, 가게 공식 ${r.official}개, 확인 필요 ${r.needsCheck}개`)}
                        className="px-4 py-2 rounded-lg bg-white border border-gray-200 text-sm font-semibold disabled:opacity-50"
                    >
                        {busy ? "처리 중..." : "자료 다시 모으기"}
                    </button>
                </div>
            </div>
            {notice && <p className={`mb-4 p-3 rounded-lg text-sm ${notice.error ? "bg-red-50 text-red-700" : "bg-green-50 text-green-800"}`}>{notice.text}</p>}

            <div className="grid md:grid-cols-2 gap-6">
                <section>
                    <h2 className="font-bold mb-2">
                        근거 자료 ({relevant.length}){" "}
                        {hiddenCount > 0 && <span className="text-xs font-normal text-gray-400">· 관련 없음 {hiddenCount}개</span>}
                    </h2>
                    <div className="space-y-2 max-h-[80vh] overflow-y-auto pr-1">
                        {[...cited, ...fresh].map((s) => (
                            <SourceCard key={s.id} s={s} citedBy={citedBy.get(s.id)} />
                        ))}
                        {old.length > 0 && (
                            <details className="text-sm">
                                <summary className="cursor-pointer text-gray-500 py-2">2년 넘은 글 {old.length}개</summary>
                                <div className="space-y-2">
                                    {old.map((s) => (
                                        <SourceCard key={s.id} s={s} />
                                    ))}
                                </div>
                            </details>
                        )}
                    </div>
                </section>

                <div className="space-y-6">
                    <section className="space-y-3">
                        <h2 className="font-bold">후보 ({pending.length})</h2>
                        {pending.map((c, i) => (
                            <CandidateCard
                                key={`${c.id}-${c.status}-${c.category}-${c.content}`}
                                no={i + 1}
                                c={c}
                                courses={data.courses}
                                onApprove={(category, content) => approve(c, category, content)}
                                onSave={(category, content) => saveCandidate(c, category, content)}
                                onReject={() => reject(c)}
                            />
                        ))}

                        <div className="bg-white rounded-xl border border-gray-200 p-4">
                            <h3 className="font-semibold mb-2 text-sm">직접 팁 추가 (후보로 들어가요)</h3>
                            <div className="flex items-center gap-2">
                                <CategorySelect value={newCategory} onChange={setNewCategory} />
                                <input
                                    value={newContent}
                                    onChange={(e) => setNewContent(e.target.value)}
                                    onKeyDown={(e) => e.key === "Enter" && !e.nativeEvent.isComposing && add()}
                                    className="flex-1 border border-gray-200 rounded-lg px-2 py-1 text-sm"
                                    placeholder="한 줄 팁"
                                />
                                <CharCount text={newContent} />
                                <button disabled={!newContent.trim()} onClick={add} className={btnMain}>
                                    추가
                                </button>
                            </div>
                        </div>

                        <div className="bg-white rounded-xl border border-gray-200 p-4">
                            <h3 className="font-semibold mb-2 text-sm">가게 공지·메뉴판 붙여넣기 → 후보 다시 만들기</h3>
                            <textarea value={pasteText} onChange={(e) => setPasteText(e.target.value)} rows={4} className="w-full border border-gray-200 rounded-lg p-2 text-sm" />
                            <button
                                disabled={busy || !pasteText.trim()}
                                onClick={async () => {
                                    if (await rebuild({ action: "paste", text: pasteText }, (r) => `다시 만들었어요. 후보 ${r.candidate}개, 가게 공식 ${r.official}개, 확인 필요 ${r.needsCheck}개`))
                                        setPasteText("");
                                }}
                                className={`mt-2 ${btnMain}`}
                            >
                                후보 다시 만들기
                            </button>
                        </div>

                        {placeInfo.length > 0 && (
                            <div className="bg-gray-50 rounded-xl border border-gray-200 p-4">
                                <h3 className="font-semibold mb-1 text-sm">장소 정보 칸 후보 ({placeInfo.length})</h3>
                                <p className="text-xs text-gray-500 mb-2">영업시간·주소·메뉴처럼 팁이 아닌 기본 정보예요. 맞으면 장소 관리에서 직접 넣어 주세요.</p>
                                <ul className="text-sm space-y-1">
                                    {placeInfo.map((c) => (
                                        <li key={c.id}>
                                            <span className="text-gray-500">[{c.category}]</span> {c.content}{" "}
                                            <span className="text-xs text-gray-400">#{c.source_ids.join(", #")}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </section>

                    <section className="space-y-3">
                        <h2 className="font-bold">승인됨 ({data.place_tips.length})</h2>
                        {data.place_tips.length === 0 && <p className="text-sm text-gray-400">아직 승인한 팁이 없어요.</p>}
                        {data.place_tips.map((t) => (
                            <ApprovedCard
                                key={`${t.id}-${t.category}-${t.content}`}
                                t={t}
                                onSave={(category, content) => saveTip(t, category, content)}
                                onDemote={() => demote(t)}
                                onDelete={() => deleteTip(t)}
                            />
                        ))}
                    </section>
                </div>
            </div>
        </div>
    );
}
