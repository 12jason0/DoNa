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
type Detail = {
    id: number;
    name: string;
    address: string | null;
    tip_status: string | null;
    tip_sources: Source[];
    tip_candidates: Candidate[];
    place_tips: { id: number; category: string; content: string; approved_at: string }[];
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
const STATUS_BADGE: Record<string, [string, string]> = {
    candidate: ["후보", "bg-green-100 text-green-800"],
    official: ["가게 공식", "bg-blue-100 text-blue-800"],
    needs_check: ["확인 필요", "bg-amber-100 text-amber-800"],
};
const catLabel = (c: string) => (ko.tipCategory as Record<string, string>)[c] ?? c;
const day = (d: string | null) => (d ? d.slice(0, 10) : "날짜 모름");

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

function CandidateCard({ c, courses, busy, onAct }: { c: Candidate; courses: Detail["courses"]; busy: boolean; onAct: (body: object) => void }) {
    const [category, setCategory] = useState(c.category);
    const [content, setContent] = useState(c.content);
    const edited = category !== c.category || content !== c.content;
    const sameCategory = courses.filter((co) => co.tips.some((t) => t.category === category));

    return (
        <div className={`bg-white rounded-xl border p-4 ${c.status === "needs_check" ? "border-amber-300" : "border-gray-200"}`}>
            <div className="flex items-center gap-2 mb-2 text-xs">
                <span className={`px-2 py-0.5 rounded-full font-semibold ${STATUS_BADGE[c.status]?.[1] ?? ""}`}>{STATUS_BADGE[c.status]?.[0] ?? c.status}</span>
                {c.conflict && <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-semibold">출처끼리 내용 다름</span>}
                <span className="text-gray-500">
                    근거 {c.source_count}개 · 최근 {day(c.latest_source_at)} · #{c.source_ids.join(", #")}
                </span>
            </div>
            <div className="flex gap-2 mb-2">
                <CategorySelect value={category} onChange={setCategory} />
            </div>
            <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={2} className="w-full border border-gray-200 rounded-lg p-2 text-sm" />
            {sameCategory.length > 0 && (
                <p className="text-xs text-amber-700 mt-1">
                    이 코스에 이미 비슷한 팁 있음 (승인해도 이 코스엔 안 넣어요): {sameCategory.map((co) => co.title).join(", ")}
                </p>
            )}
            <div className="flex gap-2 mt-2">
                <button
                    disabled={busy || !content.trim()}
                    onClick={() => onAct({ action: "approve", candidateId: c.id, category, content })}
                    className="px-3 py-1.5 rounded-lg bg-green-600 text-white text-sm font-semibold disabled:opacity-50"
                >
                    {edited ? "수정 후 승인" : "승인"}
                </button>
                <button
                    disabled={busy}
                    onClick={() => onAct({ action: "reject", candidateId: c.id })}
                    className="px-3 py-1.5 rounded-lg bg-white border border-gray-200 text-gray-700 text-sm disabled:opacity-50"
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
    const [busy, setBusy] = useState(false);
    const [notice, setNotice] = useState("");
    const [newCategory, setNewCategory] = useState<string>("GOOD_TO_KNOW");
    const [newContent, setNewContent] = useState("");
    const [pasteText, setPasteText] = useState("");
    const opened = useRef(false);

    const load = useCallback(
        (open = false) =>
            fetch(`/api/admin/tips/${placeId}${open ? "?open=1" : ""}`, { credentials: "include", cache: "no-store" })
                .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
                .then(setData)
                .catch((e) => setNotice(`불러오지 못했어요 (${e.message})`)),
        [placeId]
    );

    useEffect(() => {
        // 작업 시간 기록은 화면을 연 순간 한 번만
        if (opened.current) return;
        opened.current = true;
        load(true);
    }, [load]);

    const act = async (body: object, okMessage?: (r: any) => string) => {
        setBusy(true);
        setNotice("");
        try {
            const res = await fetch(`/api/admin/tips/${placeId}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify(body),
            });
            const r = await res.json();
            if (!res.ok) throw new Error(r.error || String(res.status));
            if (r.skippedCourses) {
                setNotice(
                    `승인했어요. 코스 ${r.appliedCourses}곳에 반영` +
                        (r.skippedCourses.length ? ` · 같은 카테고리 팁이 이미 있어 건너뜀: ${r.skippedCourses.join(", ")}` : "")
                );
            } else if (okMessage) setNotice(okMessage(r));
            await load();
            return true;
        } catch (e) {
            setNotice(`실패: ${e instanceof Error ? e.message : e}`);
            return false;
        } finally {
            setBusy(false);
        }
    };

    if (!data) return <div className="p-6">{notice || "불러오는 중..."}</div>;

    const pending = data.tip_candidates.filter((c) => c.status in STATUS_BADGE);

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
                <button
                    disabled={busy}
                    onClick={() => act({ action: "recollect" }, (r) => `다시 모았어요. 후보 ${r.candidate}개, 가게 공식 ${r.official}개, 확인 필요 ${r.needsCheck}개`)}
                    className="px-4 py-2 rounded-lg bg-white border border-gray-200 text-sm font-semibold disabled:opacity-50"
                >
                    {busy ? "처리 중..." : "자료 다시 모으기"}
                </button>
            </div>
            {notice && <p className="mb-4 p-3 rounded-lg bg-green-50 text-green-800 text-sm">{notice}</p>}

            <div className="grid md:grid-cols-2 gap-6">
                <section>
                    <h2 className="font-bold mb-2">근거 자료 ({data.tip_sources.length})</h2>
                    <div className="space-y-2 max-h-[80vh] overflow-y-auto pr-1">
                        {data.tip_sources.map((s) => (
                            <div key={s.id} className="bg-white rounded-xl border border-gray-200 p-3 text-sm">
                                <div className="text-xs text-gray-500 mb-1">
                                    #{s.id} · {SOURCE_LABEL[s.source_type] ?? s.source_type} · {day(s.written_at)}
                                    {s.author ? ` · ${s.author}` : ""}
                                </div>
                                {s.title && <div className="font-semibold">{s.title}</div>}
                                <div className="whitespace-pre-wrap text-gray-700">{s.content || "(30일 지나 내용 비움)"}</div>
                                {s.url && (
                                    <a href={s.url} target="_blank" rel="noreferrer" className="text-xs text-green-700 hover:underline break-all">
                                        {s.url}
                                    </a>
                                )}
                            </div>
                        ))}
                    </div>
                </section>

                <section className="space-y-3">
                    <h2 className="font-bold">후보 ({pending.length})</h2>
                    {pending.map((c) => (
                        <CandidateCard key={`${c.id}-${c.content}`} c={c} courses={data.courses} busy={busy} onAct={(b) => act(b)} />
                    ))}

                    <div className="bg-white rounded-xl border border-gray-200 p-4">
                        <h3 className="font-semibold mb-2 text-sm">직접 팁 추가 (바로 승인)</h3>
                        <div className="flex gap-2">
                            <CategorySelect value={newCategory} onChange={setNewCategory} />
                            <input
                                value={newContent}
                                onChange={(e) => setNewContent(e.target.value)}
                                className="flex-1 border border-gray-200 rounded-lg px-2 py-1 text-sm"
                                placeholder="한 줄 팁"
                            />
                            <button
                                disabled={busy || !newContent.trim()}
                                onClick={async () => {
                                    if (await act({ action: "add", category: newCategory, content: newContent })) setNewContent("");
                                }}
                                className="px-3 py-1.5 rounded-lg bg-green-600 text-white text-sm font-semibold disabled:opacity-50"
                            >
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
                                if (await act({ action: "paste", text: pasteText }, (r) => `다시 만들었어요. 후보 ${r.candidate}개, 가게 공식 ${r.official}개, 확인 필요 ${r.needsCheck}개`))
                                    setPasteText("");
                            }}
                            className="mt-2 px-3 py-1.5 rounded-lg bg-green-600 text-white text-sm font-semibold disabled:opacity-50"
                        >
                            후보 다시 만들기
                        </button>
                    </div>

                    {data.place_tips.length > 0 && (
                        <div>
                            <h3 className="font-semibold mb-2 text-sm">승인된 팁 ({data.place_tips.length})</h3>
                            <ul className="text-sm space-y-1">
                                {data.place_tips.map((t) => (
                                    <li key={t.id}>
                                        <span className="text-gray-500">[{catLabel(t.category)}]</span> {t.content}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </section>
            </div>
        </div>
    );
}
