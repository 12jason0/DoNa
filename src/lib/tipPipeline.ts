// 두나 팁 파이프라인: 공식 API로 자료 수집 → 자료만 근거로 팁 후보 생성 → 관리자 검수 → 코스 팁 반영
// 크롤링 없음. 구글 Places / 네이버 검색 API(블로그) / 카카오 검색 API(블로그·카페)만 사용.
import Anthropic from "@anthropic-ai/sdk";
import prisma from "@/lib/db";
import type { Prisma } from "@prisma/client";
import { fetchGooglePlaceDetails, findGooglePlace } from "@/lib/googlePlaces";
import { sendTelegram } from "@/lib/telegram";
import { translateTips } from "@/lib/translateTips";
import { parseTipsFromDb, tipsToJson, TIP_CATEGORY_VALUES, type TipCategory, type TipItem } from "@/types/tip";

const RECENT_MS = 183 * 24 * 60 * 60 * 1000; // 최근 6개월
const MIN_SOURCES = 3;
const timeout = () => AbortSignal.timeout(10_000); // API별 10초

type NewSource = {
    source_type: string;
    author: string | null;
    title: string | null;
    content: string;
    url: string | null;
    written_at: Date | null;
};

const stripTags = (s: string) =>
    s
        .replace(/<[^>]+>/g, "")
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
        .trim();

const squash = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");

/**
 * 가게 이름 핵심 단어: "한림칼국수 공항점" → ["한림칼국수"], "4233 마음센터" → ["4233마음센터", "마음센터"]
 * 지점명(…점)은 빼고, 붙여 쓴 전체 이름과 가장 긴 단어. 띄어쓰기·기호는 무시하고 비교.
 */
export function coreKeywords(name: string): string[] {
    const words = name.split(/[\s()\[\]!?.,·]+/).filter(Boolean);
    const main = words.length > 1 ? words.filter((w) => !/.점$/.test(w)) : words;
    const longest = [...main].sort((a, b) => b.length - a.length)[0] ?? name;
    return [...new Set([squash(main.join("")), squash(longest)])].filter((k) => k.length >= 2);
}

/** 제목·요약에 가게 이름 핵심 단어가 있는 글만 관련 있음 */
export function isRelevant(keywords: string[], title: string | null, content: string | null) {
    const text = squash(`${title ?? ""} ${content ?? ""}`);
    return keywords.length === 0 || keywords.some((k) => text.includes(k));
}

/** "서울 종로구 율곡로 ..." → "종로구" (검색어 "가게명 + 지역"용) */
function regionOf(address: string | null) {
    return address?.split(" ")[1] ?? "";
}

async function naverBlogs(query: string): Promise<NewSource[]> {
    const id = process.env.NAVER_SEARCH_CLIENT_ID;
    const secret = process.env.NAVER_SEARCH_CLIENT_SECRET;
    if (!id || !secret) return [];
    const res = await fetch(`https://openapi.naver.com/v1/search/blog.json?query=${encodeURIComponent(query)}&display=10&sort=sim`, {
        headers: { "X-Naver-Client-Id": id, "X-Naver-Client-Secret": secret },
        signal: timeout(),
    }).catch(() => null);
    if (!res?.ok) return [];
    const items: any[] = (await res.json()).items ?? [];
    return items.map((it) => ({
        source_type: "naver_blog",
        author: it.bloggerlink || it.bloggername || null,
        title: stripTags(it.title ?? ""),
        content: stripTags(it.description ?? ""),
        url: it.link ?? null,
        // postdate: "20260503"
        written_at: /^\d{8}$/.test(it.postdate ?? "") ? new Date(`${it.postdate.slice(0, 4)}-${it.postdate.slice(4, 6)}-${it.postdate.slice(6)}T00:00:00+09:00`) : null,
    }));
}

async function kakaoDocs(kind: "blog" | "cafe", query: string): Promise<NewSource[]> {
    const key = process.env.KAKAO_REST_API_KEY;
    if (!key) return [];
    const res = await fetch(`https://dapi.kakao.com/v2/search/${kind}?query=${encodeURIComponent(query)}&size=10&sort=accuracy`, {
        headers: { Authorization: "KakaoAK " + key },
        signal: timeout(),
    }).catch(() => null);
    if (!res?.ok) return [];
    const docs: any[] = (await res.json()).documents ?? [];
    return docs.map((d) => ({
        source_type: `kakao_${kind}`,
        author: (kind === "blog" ? d.blogname : d.cafename) || null,
        title: stripTags(d.title ?? ""),
        content: stripTags(d.contents ?? ""),
        url: d.url ?? null,
        written_at: d.datetime ? new Date(d.datetime) : null,
    }));
}

/** 1단계: 자료 수집 → tip_sources (관리자가 붙여넣은 owner_text는 유지, 자동 수집분만 새로 고침) */
export async function collectTipSources(placeId: number) {
    const place = await prisma.place.findUniqueOrThrow({
        where: { id: placeId },
        select: { name: true, address: true, google_place_id: true, latitude: true, longitude: true, tip_query: true },
    });
    // 카카오에 없어 이름만 저장한 장소(위치 없음): 다른 가게와 섞이지 않게 구글은 건너뛰고 블로그만
    const hasLocation = !!place.address || place.latitude != null;

    let googleId = place.google_place_id;
    if (!googleId && hasLocation) {
        const found = await findGooglePlace(place.name, place.address ?? "");
        if (found) {
            googleId = found.place_id;
            await prisma.place.update({ where: { id: placeId }, data: { google_place_id: googleId } });
        }
    }

    const query = place.tip_query || `${place.name} ${regionOf(place.address)}`.trim();
    const [google, naver, kakaoBlog, kakaoCafe] = await Promise.all([
        googleId ? fetchGooglePlaceDetails(googleId, true) : null,
        naverBlogs(query),
        kakaoDocs("blog", query),
        kakaoDocs("cafe", query),
    ]);

    const sources: NewSource[] = [];
    if (google) {
        const info = [google.weekdayText.length ? "영업시간: " + google.weekdayText.join(" / ") : "", google.phone ? "전화: " + google.phone : ""]
            .filter(Boolean)
            .join("\n");
        if (info) sources.push({ source_type: "google_info", author: null, title: "구글 장소 정보", content: info, url: google.url || null, written_at: new Date() });
        for (const r of google.reviews) {
            if (!r.text.trim()) continue;
            sources.push({
                source_type: "google_review",
                author: r.author_name || null,
                title: null,
                content: r.text,
                url: google.url || null,
                written_at: r.time ? new Date(r.time * 1000) : null,
            });
        }
    }
    // 같은 링크는 1번만 (구글 리뷰는 링크가 장소 링크로 같아서 제외)
    // 가게 이름이 없는 글은 relevant=false로 남김 (후보 근거에서 빠지고 화면엔 "관련 없음 N개"만, 통계용)
    const keywords = coreKeywords(place.name);
    const seen = new Set<string>();
    const rows = sources.map((s) => ({ ...s, relevant: true }));
    for (const s of [...naver, ...kakaoBlog, ...kakaoCafe]) {
        if (!s.url || seen.has(s.url) || !s.content) continue;
        seen.add(s.url);
        rows.push({ ...s, relevant: isRelevant(keywords, s.title, s.content) });
    }

    await prisma.$transaction([
        prisma.tipSource.deleteMany({ where: { place_id: placeId, source_type: { not: "owner_text" } } }),
        prisma.tipSource.createMany({ data: rows.map((s) => ({ ...s, place_id: placeId })) }),
    ]);
    const filtered = rows.filter((r) => !r.relevant).length;
    return { google: !!google, hasLocation, count: rows.length - filtered, filtered };
}

/** 근거 개수: 같은 작성자(플랫폼+작성자)의 글은 1개로. 작성자 모르면 링크, 그것도 없으면 행 하나 */
export function countDistinctSources(sources: { id: number; source_type: string; author: string | null; url: string | null }[]) {
    return new Set(sources.map((s) => (s.author ? `${s.source_type.split("_")[0]}:${s.author}` : s.url ? `url:${s.url}` : `id:${s.id}`))).size;
}

/** 검수 대기 상태: 후보 / 가게 공식 / 확인 필요 */
export const PENDING_STATUSES = ["candidate", "official", "needs_check"];

/**
 * 후보 / 가게 공식 / 확인 필요 판정 (AI가 아니라 코드가 정함)
 * ownerFact: 가게가 직접 밝힌 사실(메뉴·가격·이용시간·예약·휴무)이고 근거에 붙여넣은 공지·메뉴판이 있음 → 출처 1개로도 인정
 */
export function judgeCandidate(distinctCount: number, latest: Date | null, conflict: boolean, ownerFact = false, now = Date.now()) {
    if (conflict) return "needs_check";
    if (ownerFact) return "official";
    const recent = latest != null && now - latest.getTime() <= RECENT_MS;
    return distinctCount >= MIN_SOURCES && recent ? "candidate" : "needs_check";
}

type AiTip = { category: string; content: string; source_ids: number[]; conflict?: boolean; owner_fact?: boolean; owner_question?: string };

/** 2단계: 모은 자료만 근거로 팁 후보 생성 → tip_candidates (아직 결정 안 한 후보는 교체) */
export async function generateTipCandidates(placeId: number) {
    const place = await prisma.place.findUniqueOrThrow({ where: { id: placeId }, select: { name: true, category: true } });
    const sources = await prisma.tipSource.findMany({ where: { place_id: placeId, relevant: true }, orderBy: { id: "asc" } });
    if (sources.length === 0) {
        await prisma.place.update({ where: { id: placeId }, data: { tip_status: "recheck" } });
        return { candidate: 0, official: 0, needsCheck: 0, ownerQuestions: [] as string[], tokens: { input: 0, output: 0 } };
    }

    const material = sources
        .map((s) => {
            const date = s.written_at ? s.written_at.toISOString().slice(0, 10) : "날짜 모름";
            return `[${s.id}] (${s.source_type}, ${date}) ${s.title ? s.title + " — " : ""}${(s.content ?? "").slice(0, 1500)}`;
        })
        .join("\n");

    const prompt = `당신은 20-30대 커플 데이트 앱 'DoNa'의 팁 에디터입니다.
장소: ${place.name} (${place.category ?? "카테고리 모름"})

아래 [번호] 자료만 근거로, 데이트하러 가는 사람이 미리 알면 행동이 바뀌는 한 줄 팁을 만드세요.

규칙:
- 자료에 없는 내용은 절대 만들지 마세요. 추측·일반론 금지.
- "분위기 좋아요", "맛있어요", "추천해요"처럼 읽어도 행동이 안 바뀌는 문장은 버리세요.
  좋은 예: "주말 오후 2~4시는 대기 30분 이상, 오픈 직후 방문", "주차장 없음, 안국역 1번 출구에서 도보 5분"
- 같은 내용은 하나로 합치고, 그 내용을 말한 자료 번호를 source_ids에 모두 넣으세요.
- 자료끼리 내용이 다르면(예: 주차 된다 / 안 된다) conflict: true.
- owner_text 자료는 가게가 직접 올린 공지·메뉴판입니다. 팁이 owner_text에 적힌 메뉴·가격·이용시간·예약·휴무 같은 사실이면 owner_fact: true.
  평가·분위기·추천 문장이거나 owner_text가 근거가 아니면 owner_fact: false.
- 각 팁마다 사장님께 사실 확인용으로 물을 짧은 질문을 owner_question에 쓰세요.
- category는 다음 중 하나: ${TIP_CATEGORY_VALUES.join(", ")}
- content는 한국어 한 문장, 60자 이내.

다른 텍스트 없이 JSON만:
{"tips":[{"category":"WAITING","content":"...","source_ids":[1,2],"conflict":false,"owner_fact":false,"owner_question":"..."}]}

자료:
${material}`;

    const message = await new Anthropic().messages.create(
        { model: "claude-sonnet-4-6", max_tokens: 4000, messages: [{ role: "user", content: prompt }] },
        { timeout: 120_000 }
    );
    const tokens = { input: message.usage.input_tokens, output: message.usage.output_tokens };
    const raw = message.content[0].type === "text" ? message.content[0].text : "";
    const json = raw.match(/\{[\s\S]*\}/);
    if (!json) throw new Error("팁 후보 응답 파싱 실패: " + raw.slice(0, 200));
    const aiTips: AiTip[] = JSON.parse(json[0]).tips ?? [];

    const byId = new Map(sources.map((s) => [s.id, s]));
    const rows: {
        category: TipCategory;
        content: string;
        status: string;
        conflict: boolean;
        source_ids: number[];
        source_count: number;
        latest_source_at: Date | null;
        owner_question: string;
    }[] = [];
    for (const t of aiTips) {
        // AI가 없는 번호를 댄 경우 버림 → 근거 0개면 후보에서 제외
        const used = [...new Set(t.source_ids ?? [])].map((id) => byId.get(id)).filter((s) => s != null);
        if (used.length === 0 || !t.content?.trim()) continue;
        const latest = used.reduce<Date | null>((m, s) => (s.written_at && (!m || s.written_at > m) ? s.written_at : m), null);
        const count = countDistinctSources(used);
        const conflict = t.conflict === true;
        // AI 표시만 믿지 않고, 근거에 붙여넣은 공지·메뉴판이 실제로 있어야 인정
        const ownerFact = t.owner_fact === true && used.some((s) => s.source_type === "owner_text");
        rows.push({
            category: (TIP_CATEGORY_VALUES as readonly string[]).includes(t.category) ? (t.category as TipCategory) : "ETC",
            content: t.content.trim(),
            status: judgeCandidate(count, latest, conflict, ownerFact),
            conflict,
            source_ids: used.map((s) => s.id),
            source_count: count,
            latest_source_at: latest,
            owner_question: t.owner_question?.trim() ?? "",
        });
    }

    await prisma.$transaction([
        prisma.tipCandidate.deleteMany({ where: { place_id: placeId, status: { in: PENDING_STATUSES } } }),
        prisma.tipCandidate.createMany({ data: rows.map(({ owner_question, ...r }) => ({ ...r, place_id: placeId })) }),
        prisma.place.update({ where: { id: placeId }, data: { tip_status: rows.length ? "review" : "recheck" } }),
    ]);

    return {
        candidate: rows.filter((r) => r.status === "candidate").length,
        official: rows.filter((r) => r.status === "official").length,
        needsCheck: rows.filter((r) => r.status === "needs_check").length,
        ownerQuestions: rows.filter((r) => r.status === "needs_check" && r.owner_question).map((r) => r.owner_question).slice(0, 5),
        tokens,
    };
}

export function tipReviewUrl(placeId: number) {
    return `${(process.env.NEXT_PUBLIC_SITE_URL || "https://dona.io.kr").replace(/\/$/, "")}/admin/tips/${placeId}`;
}

/** 자동 처리 1회 기록 (통계 화면용). 기록 실패가 본 작업을 막지 않게 오류는 무시 */
export function logTipRun(data: Prisma.TipRunUncheckedCreateInput) {
    return prisma.tipRun.create({ data }).catch((e) => console.error("tip_runs 기록 실패:", e));
}

/**
 * 텔레그램 "맞아요" 이후 after()에서 실행. startedAt: "맞아요"를 누른 시각 (자동 처리 시간 = 그때 ~ 후보 생성 완료)
 * Hobby 플랜 함수 최대 300초 → 수집(API별 10초 제한, 병렬) + Claude 1회(120초 제한)로 최대 약 150초.
 */
export async function runTipPipeline(placeId: number, chatId?: number, startedAt = new Date()) {
    const place = await prisma.place.update({ where: { id: placeId }, data: { tip_status: "collecting" }, select: { name: true } });
    let collected: Awaited<ReturnType<typeof collectTipSources>> | null = null;
    try {
        collected = await collectTipSources(placeId);
        const r = await generateTipCandidates(placeId);
        await logTipRun({
            place_id: placeId,
            kind: "pipeline",
            started_at: startedAt,
            finished_at: new Date(),
            source_count: collected.count,
            filtered_count: collected.filtered,
            candidate: r.candidate,
            official: r.official,
            needs_check: r.needsCheck,
            input_tokens: r.tokens.input,
            output_tokens: r.tokens.output,
        });
        if (!chatId) return r;
        const questions = r.ownerQuestions.length
            ? "\n\n사장님께 물어볼 것:\n" + r.ownerQuestions.map((q, i) => `${i + 1}. ${q}`).join("\n")
            : "";
        const where = collected.google ? "" : collected.hasLocation ? ", 구글 장소 못 찾음" : ", 위치 없음: 블로그만 검색";
        await sendTelegram(
            chatId,
            `📝 "${place.name}" 팁 후보 ${r.candidate}개, 가게 공식 ${r.official}개, 확인 필요 ${r.needsCheck}개\n(자료 ${collected.count}건, 관련 없음 ${collected.filtered}건 제외${where})\n\n검수: ${tipReviewUrl(placeId)}${questions}`
        );
        return r;
    } catch (e) {
        console.error("팁 파이프라인 실패:", e);
        await logTipRun({
            place_id: placeId,
            kind: "pipeline",
            started_at: startedAt,
            source_count: collected?.count,
            filtered_count: collected?.filtered,
            error: String(e).slice(0, 500),
        });
        await prisma.place.update({ where: { id: placeId }, data: { tip_status: "recheck" } });
        if (chatId) await sendTelegram(chatId, `⚠️ "${place.name}" 팁 자료 처리 실패. 검수 화면에서 "다시 모으기"를 눌러주세요.\n${tipReviewUrl(placeId)}`);
        throw e;
    }
}

/**
 * 승인: place_tips 저장(4개 언어) + 이 장소가 들어간 코스들의 course_places.tips 끝에 추가.
 * 같은 카테고리 팁이 이미 있는 코스는 건드리지 않고 skippedCourses로 돌려줌.
 */
export async function approveTip(placeId: number, tip: { category: string; content: string }, candidateId?: number) {
    const category = ((TIP_CATEGORY_VALUES as readonly string[]).includes(tip.category) ? tip.category : "ETC") as TipCategory;
    const ko: TipItem = { category, content: tip.content.trim() };
    if (!ko.content) throw new Error("팁 내용이 비어 있어요");
    const t0 = new Date();
    const tr = await translateTips([ko]);
    const en = tr.tips_en?.[0], ja = tr.tips_ja?.[0], zh = tr.tips_zh?.[0];

    const coursePlaces = await prisma.coursePlace.findMany({
        where: { place_id: placeId },
        select: { id: true, tips: true, tips_en: true, tips_ja: true, tips_zh: true, course: { select: { title: true } } },
    });

    const skippedCourses: string[] = [];
    const updates = [];
    for (const cp of coursePlaces) {
        const koTips = parseTipsFromDb(cp.tips);
        if (koTips.some((t) => t.category === category)) {
            skippedCourses.push(cp.course.title);
            continue;
        }
        // 번역 칸이 비어 있으면 앱이 한국어로 대신 보여줌 → 비어 있던 칸은 그대로 둠 (한국어 쪽에 추가되므로 같이 보임)
        const add = (col: string | null, item?: { content: string }) =>
            col?.trim() && item ? tipsToJson([...parseTipsFromDb(col), { category, content: item.content }]) : col;
        updates.push(
            prisma.coursePlace.update({
                where: { id: cp.id },
                data: {
                    tips: tipsToJson([...koTips, ko]),
                    tips_en: add(cp.tips_en, en),
                    tips_ja: add(cp.tips_ja, ja),
                    tips_zh: add(cp.tips_zh, zh),
                },
            })
        );
    }

    const now = new Date();
    const candidate = candidateId ? await prisma.tipCandidate.findUnique({ where: { id: candidateId }, select: { content: true, category: true } }) : null;
    const edited = !!candidate && (candidate.content !== ko.content || candidate.category !== category);
    const log = await prisma.tipWorkLog.findFirst({ where: { place_id: placeId }, orderBy: { opened_at: "desc" } });
    await prisma.$transaction([
        prisma.placeTip.create({
            data: { place_id: placeId, category, content: ko.content, content_en: en?.content, content_ja: ja?.content, content_zh: zh?.content, candidate_id: candidateId, edited },
        }),
        ...(candidateId
            ? [prisma.tipCandidate.update({ where: { id: candidateId }, data: { status: "approved", content: ko.content, category, decided_at: now } })]
            : []),
        ...updates,
        ...(log ? [prisma.tipWorkLog.update({ where: { id: log.id }, data: { last_approved_at: now, approved_count: { increment: 1 } } })] : []),
    ]);
    await logTipRun({ place_id: placeId, kind: "translate", started_at: t0, finished_at: now, input_tokens: tr.usage.input, output_tokens: tr.usage.output });
    await refreshTipStatus(placeId);
    return { appliedCourses: updates.length, skippedCourses };
}

/** 남은 후보가 없으면 완료 */
export async function refreshTipStatus(placeId: number) {
    const pending = await prisma.tipCandidate.count({ where: { place_id: placeId, status: { in: PENDING_STATUSES } } });
    if (pending === 0) await prisma.place.update({ where: { id: placeId }, data: { tip_status: "done" } });
}
