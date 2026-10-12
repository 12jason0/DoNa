// 두나 팁 파이프라인: 공식 API로 자료 수집 → 자료만 근거로 팁 후보 생성 → 관리자 검수 → 코스 팁 반영
// 크롤링 없음. 구글 Places / 네이버 검색 API(블로그) / 카카오 검색 API(블로그·카페)만 사용.
import Anthropic from "@anthropic-ai/sdk";
import prisma from "@/lib/db";
import type { Prisma } from "@prisma/client";
import { fetchGooglePlaceDetails, findGooglePlace } from "@/lib/googlePlaces";
import { sendTelegram } from "@/lib/telegram";
import { translateTips } from "@/lib/translateTips";
import { pickTipPrice, type TipPrice } from "@/lib/tipPrice";
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

/** 저장된 이름의 지점명: "한림칼국수 공항점" → "공항점" (없으면 null) */
export function branchOf(name: string): string | null {
    const words = name.split(/[\s()\[\]!?.,·]+/).filter(Boolean);
    const b = words.length > 1 ? words.find((w) => /.점$/.test(w)) : undefined;
    return b ? squash(b) : null;
}

// 주소: "광평중길 82", "신북로 584-6", "성수이로7길 12" (도로명) / "한강로2가 49-1", "교래리 524-1" (지번)
// 이름 뒤 번호가 "5분", "3,000원"처럼 이어지면 주소 아님
const ADDRESS_RE = {
    road: /([가-힣][가-힣0-9 ]{0,20}?(?:로|길))\s*(\d{1,5}(?:-\d{1,4})?)(?![\d가-힣]|,\d)/g,
    jibun: /([가-힣][가-힣0-9 ]{0,20}?(?:동|리|가))\s*(\d{1,5}(?:-\d{1,4})?)(?![\d가-힣]|,\d)/g,
};
// 앞쪽 행정구역("제주 제주시" / "제주특별자치도 제주시")은 글마다 달라서 마지막 단어(길 이름)만 비교
const addressesIn = (text: string, kind: keyof typeof ADDRESS_RE) =>
    [...text.matchAll(ADDRESS_RE[kind])].map((m) => ({ name: squash(m[1].trim().split(/\s+/).at(-1) ?? ""), num: m[2] }));

/**
 * 글에 우리와 같은 종류(도로명/지번)의 주소가 있는데 하나도 우리 주소와 안 맞으면 true.
 * 주소가 없거나 종류가 다르면(우리는 지번, 글은 도로명) 판단 안 함 → false
 */
export function isOtherAddress(text: string, ourAddress: string | null) {
    if (!ourAddress) return false;
    const kind = addressesIn(ourAddress, "road").length ? "road" : "jibun";
    const ours = addressesIn(ourAddress, kind).at(-1);
    if (!ours) return false;
    const found = addressesIn(text, kind);
    // "광평 중길"처럼 길 이름 중간을 띄어 쓴 경우는 끝부분 일치로 인정
    return found.length > 0 && !found.some((f) => f.num === ours.num && (f.name.endsWith(ours.name) || ours.name.endsWith(f.name)));
}

/**
 * 제목·요약에 가게 이름 핵심 단어가 있는 글만 관련 있음.
 * 글에 적힌 주소가 우리 주소와 다르면 관련 없음.
 * 지점이 있는 장소면, 브랜드 바로 뒤에 다른 지점명("한림칼국수 함덕점")이 적혀 있고 우리 지점은 언급이 없는 글은 관련 없음.
 * 지점 언급이 없는 글은 그대로 관련 있음.
 */
export function isRelevant(keywords: string[], title: string | null, content: string | null, branch: string | null = null, address: string | null = null) {
    const raw = `${title ?? ""} ${content ?? ""}`;
    const text = squash(raw);
    if (keywords.length === 0) return true;
    if (!keywords.some((k) => text.includes(k))) return false;
    if (isOtherAddress(raw, address)) return false;
    if (!branch || text.includes(branch)) return true;
    const brand = keywords[0];
    // ponytail: 브랜드 바로 뒤 "…점"만 지점으로 봄. "함덕 맛집 한림칼국수"처럼 지점명 없이 지역만 쓴 글은 못 거름
    const others = [...text.matchAll(new RegExp(`${brand}([\\p{L}\\p{N}]{1,8}?점)(?![심수원포])`, "gu"))]
        .map((m) => m[1])
        .filter((b) => !b.includes(branch) && !branch.includes(b));
    return others.length === 0;
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
    let googleCalls = 0; // 유료 호출 수 (tip_runs.google_calls)
    if (!googleId && hasLocation) {
        googleCalls++;
        const found = await findGooglePlace(place.name, place.address ?? "");
        if (found) {
            googleId = found.place_id;
            await prisma.place.update({ where: { id: placeId }, data: { google_place_id: googleId } });
        }
    }

    if (googleId) googleCalls++;
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
    const branch = branchOf(place.name);
    const seen = new Set<string>();
    const rows = sources.map((s) => ({ ...s, relevant: true }));
    for (const s of [...naver, ...kakaoBlog, ...kakaoCafe]) {
        if (!s.url || seen.has(s.url) || !s.content) continue;
        seen.add(s.url);
        rows.push({ ...s, relevant: isRelevant(keywords, s.title, s.content, branch, place.address) });
    }

    await prisma.$transaction([
        prisma.tipSource.deleteMany({ where: { place_id: placeId, source_type: { not: "owner_text" } } }),
        prisma.tipSource.createMany({ data: rows.map((s) => ({ ...s, place_id: placeId })) }),
    ]);
    const filtered = rows.filter((r) => !r.relevant).length;
    return { google: !!google, hasLocation, count: rows.length - filtered, filtered, googleCalls };
}

/** 근거 개수: 같은 작성자(플랫폼+작성자)의 글은 1개로. 작성자 모르면 링크, 그것도 없으면 행 하나 */
export function countDistinctSources(sources: { id: number; source_type: string; author: string | null; url: string | null }[]) {
    return new Set(sources.map((s) => (s.author ? `${s.source_type.split("_")[0]}:${s.author}` : s.url ? `url:${s.url}` : `id:${s.id}`))).size;
}

/** 검수 대기 상태 (자동 생성): 후보 / 가게 공식 / 확인 필요. 다시 만들 때 지우고 새로 만듦 */
export const PENDING_STATUSES = ["candidate", "official", "needs_check"];
/** 사람이 손댄 후보: 직접 작성 / 승인했다가 후보로 내림 / 자동 후보를 고쳐 저장. 다시 만들어도 지우지 않음 */
export const MANUAL_STATUS = "manual";
export const DEMOTED_STATUS = "demoted";
export const EDITED_STATUS = "edited";
export const HUMAN_STATUSES = [MANUAL_STATUS, DEMOTED_STATUS, EDITED_STATUS];
/** 검수 화면 "후보" 구역·남은 후보 수에 들어가는 상태 전부 */
export const REVIEW_STATUSES = [...PENDING_STATUSES, ...HUMAN_STATUSES];

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

type AiTip = {
    category: string;
    content: string;
    source_ids: number[];
    conflict?: boolean;
    owner_fact?: boolean;
    owner_question?: string;
    activity?: boolean;
    prices?: { value: string; source_id: number }[];
};
type AiPlaceInfo = { field: string; content: string; source_ids: number[] };

/** 새 팁 후보가 쓰는 카테고리 (예전 팁의 WALKING·PHOTO_ZONE 등은 승인·화면에서 그대로 유지) */
export const TIP_GEN_CATEGORIES: readonly TipCategory[] = ["SIGNATURE_MENU", "WAITING", "PARKING", "CAUTION", "GOOD_TO_KNOW", "ETC"];
const MAX_TIPS = 6;
/** 팁이 아닌 기본 정보(영업시간·주소 등) → 팁 목록에 안 넣고 장소 정보 칸 후보로 따로 저장 (tip_candidates.status, category = 칸 이름) */
export const PLACE_INFO_STATUS = "place_info";
export const PLACE_INFO_FIELDS = ["opening_hours", "closed_days", "address", "access", "menu", "price", "service", "other"] as const;

/** 2단계: 모은 자료만 근거로 팁 후보 생성 → tip_candidates (아직 결정 안 한 후보는 교체) */
export async function generateTipCandidates(placeId: number) {
    const place = await prisma.place.findUniqueOrThrow({ where: { id: placeId }, select: { name: true, category: true } });
    const sources = await prisma.tipSource.findMany({ where: { place_id: placeId, relevant: true }, orderBy: { id: "asc" } });
    if (sources.length === 0) {
        await prisma.place.update({ where: { id: placeId }, data: { tip_status: "recheck" } });
        return { candidate: 0, official: 0, needsCheck: 0, placeInfo: 0, ownerQuestions: [] as string[], tokens: { input: 0, output: 0 } };
    }

    const material = sources
        .map((s) => {
            const date = s.written_at ? s.written_at.toISOString().slice(0, 10) : "날짜 모름";
            return `[${s.id}] (${s.source_type}, ${date}) ${s.title ? s.title + " — " : ""}${(s.content ?? "").slice(0, 1500)}`;
        })
        .join("\n");

    const prompt = `당신은 20-30대 커플 데이트 앱 'DoNa'의 팁 에디터입니다.
장소: ${place.name} (${place.category ?? "카테고리 모름"})

아래 [번호] 자료만 근거로, 두 사람이 데이트하러 가기 전에 알면 실패를 피하거나 경험이 달라지는 팁을 만드세요.

좋은 팁 (하나 이상 해당해야 함):
- 모르고 가면 실패하는 것: 헤맴, 문 닫힘, 품절, 웨이팅, 재고 없음
- 알고 가면 경험이 달라지는 것: 숨은 기능, 다른 결과물, 추가 서비스
- 리뷰에서 "몰랐다/헤맸다/아쉬웠다/미리 할걸"이 반복되는 내용 → 가장 먼저

팁이 아닌 것 (tips에 넣지 마세요):
- 영업시간, 휴무일, 주소, 거리, 서비스·메뉴 목록, 가격표 → place_info로 따로 보내세요
- "분위기 좋아요", "맛있어요"처럼 어디에나 있는 말 → 버리세요
- 블로그 소개글 대부분에 나오는 기본 설명 → 버리세요
- 기본 정보는 데이트 실패와 이어질 때만 팁이 됩니다.
  나쁨: "월요일 휴무"  좋음: "오후 1시 오픈 — 오전 첫 코스로 넣으면 문 닫혀 있음"

형식:
- content는 한국어 한 줄, 30자 안팎, 최대 35자(띄어쓰기 포함). 앱 화면 두 줄 안에 끝나야 합니다.
- 구조: "사실 — 해야 할 행동 / 그래서 생기는 일". 수식어·접속사는 빼고 짧게.
- 날짜("2025년 기준", "9월 방문 시")는 문장에 넣지 마세요. 날짜는 근거 자료에만 있으면 됩니다.
- 두 사람이 데이트하는 시점으로 쓰세요. 앞의 '사실'은 반드시 자료에 근거가 있어야 합니다.
- category는 다음 중 하나: ${TIP_GEN_CATEGORIES.join(", ")}
- 장소당 3~${MAX_TIPS}개. 좋은 팁이 없으면 적게(0개도 됨). 억지로 채우지 마세요.

예시 (필름카메라 대여·사진관 한 곳, 형식 참고용. 가격·숫자는 이 가게 것이 아니니 베끼지 마세요):
좋음:
- CAUTION: 간판 없음 — 삼각지역 3번 출구 앞 건물 3층
- CAUTION: 대여 재고 한정 — 주말엔 DM으로 먼저 확인
- GOOD_TO_KNOW: 필름카메라 대여 1만원(필름 별도) — 24시간이라 다음날 반납
- GOOD_TO_KNOW: 반납 때 실물 인화 가능 — 파일 다운로드도 같이
나쁨:
- "월요일은 정기휴무, 화~금 오후 1~7시 운영" → 기본 정보 (place_info)
- "필름카메라 대여·현상·스캔 서비스와 폴라로이드 셀프 촬영" → 서비스 목록 (place_info)
- "삼각지역 3번 출구에서 도보 1분(약 88~91m)" → 거리 정보 (place_info)

근거 규칙:
- 자료에 없는 내용은 절대 만들지 마세요. 추측·일반론 금지.
- 같은 내용은 하나로 합치고, 그 내용을 말한 자료 번호를 source_ids에 모두 넣으세요.
- 자료끼리 내용이 다르면(예: 주차 된다 / 안 된다) conflict: true.
- owner_text 자료는 가게가 직접 올린 공지·메뉴판입니다. 팁이 owner_text에 적힌 메뉴·가격·이용시간·예약·휴무 같은 사실이면 owner_fact: true.
  평가·분위기·추천 문장이거나 owner_text가 근거가 아니면 owner_fact: false.
- 각 팁마다 사장님께 사실 확인용으로 물을 짧은 질문을 owner_question에 쓰세요.

활동 가격:
- 체험·대여·클래스·부스·만들기처럼 "여기서 ~할 수 있음" 팁이면 activity: true, 아니면 false.
- activity 팁은 그 활동 가격이 적힌 자료를 전부 찾아 prices에 자료마다 하나씩 넣으세요: {"value": 자료에 적힌 그대로의 가격, "source_id": 그 자료 번호}.
- 자료에 숫자로 적힌 가격만. 추측·계산(1인 가격×2 등)·반올림 금지. 가격이 없으면 prices는 [].
- "무료"는 자료에 무료라고 적혀 있을 때만.
- 자료마다 가격이 다르면 content에는 가장 최근 날짜 자료의 가격을 쓰세요. 가격을 못 찾았으면 content에 가격을 쓰지 마세요.

place_info: 팁이 아닌 기본 정보 중 자료에 근거가 있는 것. field는 다음 중 하나: ${PLACE_INFO_FIELDS.join(", ")}
(access = 역·출구·거리 같은 찾아가는 길, service = 서비스 목록). content는 자료에 적힌 그대로 한 줄.

다른 텍스트 없이 JSON만:
{"tips":[{"category":"GOOD_TO_KNOW","content":"...","source_ids":[1,2],"conflict":false,"owner_fact":false,"owner_question":"...","activity":true,"prices":[{"value":"...","source_id":2}]}],"place_info":[{"field":"opening_hours","content":"...","source_ids":[3]}]}

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
    const parsed = JSON.parse(json[0]);
    const aiTips: AiTip[] = parsed.tips ?? [];
    const aiInfo: AiPlaceInfo[] = parsed.place_info ?? [];

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
        price: TipPrice | null;
    }[] = [];
    // 가격 확인용: 근거 번호 → 제목+본문, 작성일 (AI가 댄 가격 숫자가 그 글에 실제로 있는지 코드가 확인)
    const priceText = new Map(sources.map((s) => [s.id, { text: `${s.title ?? ""} ${s.content ?? ""}`, written_at: s.written_at }]));
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
            category: (TIP_GEN_CATEGORIES as readonly string[]).includes(t.category) ? (t.category as TipCategory) : "ETC",
            content: t.content.trim(),
            status: judgeCandidate(count, latest, conflict, ownerFact),
            conflict,
            source_ids: used.map((s) => s.id),
            source_count: count,
            latest_source_at: latest,
            owner_question: t.owner_question?.trim() ?? "",
            price: t.activity === true ? pickTipPrice(Array.isArray(t.prices) ? t.prices : [], priceText) : null,
        });
        if (rows.length >= MAX_TIPS) break;
    }

    // 기본 정보는 판정 없이 근거만 붙여 따로 저장 (팁 목록·승인 대상 아님)
    const infoRows = aiInfo.flatMap((i) => {
        const used = [...new Set(i.source_ids ?? [])].map((id) => byId.get(id)).filter((s) => s != null);
        if (used.length === 0 || !i.content?.trim()) return [];
        return [{
            place_id: placeId,
            category: (PLACE_INFO_FIELDS as readonly string[]).includes(i.field) ? i.field : "other",
            content: i.content.trim(),
            status: PLACE_INFO_STATUS,
            source_ids: used.map((s) => s.id),
            source_count: countDistinctSources(used),
            latest_source_at: used.reduce<Date | null>((m, s) => (s.written_at && (!m || s.written_at > m) ? s.written_at : m), null),
        }];
    });

    // 사람이 손댄 후보와 승인 팁은 남기고, 같은 문장인 새 후보는 빼고 나머지만 추가
    const [kept, approved] = await Promise.all([
        prisma.tipCandidate.findMany({ where: { place_id: placeId, status: { in: HUMAN_STATUSES } }, select: { content: true } }),
        prisma.placeTip.findMany({ where: { place_id: placeId }, select: { content: true } }),
    ]);
    const known = [...kept, ...approved].map((t) => t.content);
    const fresh = rows.filter((r) => !known.some((k) => sameText(k, r.content)));
    rows.splice(0, rows.length, ...fresh);

    await prisma.$transaction([
        prisma.tipCandidate.deleteMany({ where: { place_id: placeId, status: { in: [...PENDING_STATUSES, PLACE_INFO_STATUS] } } }),
        prisma.tipCandidate.createMany({
            data: [...rows.map(({ owner_question, price, ...r }) => ({ ...r, place_id: placeId, ...(price ? { price } : {}) })), ...infoRows],
        }),
        prisma.place.update({ where: { id: placeId }, data: { tip_status: rows.length || kept.length ? "review" : "recheck" } }),
    ]);

    return {
        candidate: rows.filter((r) => r.status === "candidate").length,
        official: rows.filter((r) => r.status === "official").length,
        needsCheck: rows.filter((r) => r.status === "needs_check").length,
        placeInfo: infoRows.length,
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
            google_calls: collected.googleCalls,
        });
        if (!chatId) return r;
        const questions = r.ownerQuestions.length
            ? "\n\n사장님께 물어볼 것:\n" + r.ownerQuestions.map((q, i) => `${i + 1}. ${q}`).join("\n")
            : "";
        const where = collected.google ? "" : collected.hasLocation ? ", 구글 장소 못 찾음" : ", 위치 없음: 블로그만 검색";
        await sendTelegram(
            chatId,
            `📝 "${place.name}" 팁 후보 ${r.candidate}개, 가게 공식 ${r.official}개, 확인 필요 ${r.needsCheck}개${r.placeInfo ? `, 장소 정보 칸 후보 ${r.placeInfo}개` : ""}\n(자료 ${collected.count}건, 관련 없음 ${collected.filtered}건 제외${where})\n\n검수: ${tipReviewUrl(placeId)}${questions}`
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
            google_calls: collected?.googleCalls,
            error: String(e).slice(0, 500),
        });
        await prisma.place.update({ where: { id: placeId }, data: { tip_status: "recheck" } });
        if (chatId) await sendTelegram(chatId, `⚠️ "${place.name}" 팁 자료 처리 실패. 검수 화면에서 "다시 모으기"를 눌러주세요.\n${tipReviewUrl(placeId)}`);
        throw e;
    }
}

/**
 * 승인: place_tips 저장(4개 언어) + 이 장소가 들어간 코스들의 course_places.tips 끝에 추가.
 * 같은 카테고리여도 추가. 같은 문장(띄어쓰기 무시)이 이미 있는 코스만 건너뛰고 skippedCourses로 돌려줌.
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
        if (koTips.some((t) => sameText(t.content, ko.content))) {
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
    const candidate = candidateId ? await prisma.tipCandidate.findUnique({ where: { id: candidateId }, select: { content: true, category: true, status: true } }) : null;
    // "수정 저장"으로 먼저 고친 후보(edited)를 그대로 승인해도 수정 후 승인 (통계용)
    const edited = !!candidate && (candidate.status === EDITED_STATUS || candidate.content !== ko.content || candidate.category !== category);
    const log = await prisma.tipWorkLog.findFirst({ where: { place_id: placeId }, orderBy: { opened_at: "desc" } });
    const [created] = await prisma.$transaction([
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
    const saved = { id: created.id, category: created.category, content: created.content, candidate_id: created.candidate_id };
    return { appliedCourses: updates.length, skippedCourses, tip: saved };
}

/** 같은 문장인지 (띄어쓰기 무시) */
export const sameText = (a: string, b: string) => a.replace(/\s+/g, "") === b.replace(/\s+/g, "");

/** 같은 장소에 같은 문장이 승인 팁이나 검수 중 후보에 이미 있는지 */
export async function hasSameTip(placeId: number, content: string) {
    const [tips, cands] = await Promise.all([
        prisma.placeTip.findMany({ where: { place_id: placeId }, select: { content: true } }),
        prisma.tipCandidate.findMany({ where: { place_id: placeId, status: { in: REVIEW_STATUSES } }, select: { content: true } }),
    ]);
    return [...tips, ...cands].some((t) => sameText(t.content, content));
}

/** 코스 팁 JSON 한 칸에서 (카테고리+문장)이 같은 첫 팁을 next로 바꾸거나(null이면 뺌). 없으면 그대로 */
export function replaceTipInJson(col: string | null, category: string, content: string | null, next: TipItem | null) {
    if (!col?.trim() || !content) return col;
    const items = parseTipsFromDb(col);
    const i = items.findIndex((t) => t.category === category && t.content === content);
    if (i < 0) return col;
    if (next) items[i] = { ...items[i], ...next };
    else items.splice(i, 1);
    return tipsToJson(items);
}

/**
 * 승인 팁을 코스 팁(course_places.tips 4개 언어)에서 바꾸거나 뺌.
 * 승인 때 같은 문장이 있어 건너뛴 코스는 (카테고리+문장)이 맞을 때만 바뀜. next = null 이면 뺌
 */
function courseTipUpdates(
    coursePlaces: { id: number; tips: string | null; tips_en: string | null; tips_ja: string | null; tips_zh: string | null }[],
    prev: { category: string; content: string; content_en: string | null; content_ja: string | null; content_zh: string | null },
    next: { category: TipCategory; content: string; content_en?: string | null; content_ja?: string | null; content_zh?: string | null } | null
) {
    const edit = (col: string | null, old: string | null, neu: string | null | undefined) =>
        replaceTipInJson(col, prev.category, old, next && neu ? { category: next.category, content: neu } : null);
    return coursePlaces.flatMap((cp) => {
        const data = {
            tips: edit(cp.tips, prev.content, next?.content),
            tips_en: edit(cp.tips_en, prev.content_en, next?.content_en),
            tips_ja: edit(cp.tips_ja, prev.content_ja, next?.content_ja),
            tips_zh: edit(cp.tips_zh, prev.content_zh, next?.content_zh),
        };
        const changed = data.tips !== cp.tips || data.tips_en !== cp.tips_en || data.tips_ja !== cp.tips_ja || data.tips_zh !== cp.tips_zh;
        return changed ? [prisma.coursePlace.update({ where: { id: cp.id }, data })] : [];
    });
}

const coursePlacesOf = (placeId: number) =>
    prisma.coursePlace.findMany({ where: { place_id: placeId }, select: { id: true, tips: true, tips_en: true, tips_ja: true, tips_zh: true } });

/** 승인 팁 수정: 문장이 바뀌면 다시 번역. 코스 팁에 들어간 같은 문장도 함께 바꿈 */
export async function updateApprovedTip(placeId: number, tipId: number, tip: { category: string; content: string }) {
    const prev = await prisma.placeTip.findFirstOrThrow({ where: { id: tipId, place_id: placeId } });
    const category = ((TIP_CATEGORY_VALUES as readonly string[]).includes(tip.category) ? tip.category : "ETC") as TipCategory;
    const content = tip.content.trim();
    if (!content) throw new Error("팁 내용이 비어 있어요");
    let tr = { content_en: prev.content_en, content_ja: prev.content_ja, content_zh: prev.content_zh };
    if (content !== prev.content) {
        const t0 = new Date();
        const r = await translateTips([{ category, content }]);
        tr = { content_en: r.tips_en?.[0]?.content ?? null, content_ja: r.tips_ja?.[0]?.content ?? null, content_zh: r.tips_zh?.[0]?.content ?? null };
        await logTipRun({ place_id: placeId, kind: "translate", started_at: t0, finished_at: new Date(), input_tokens: r.usage.input, output_tokens: r.usage.output });
    }
    const updates = courseTipUpdates(await coursePlacesOf(placeId), prev, { category, content, ...tr });
    await prisma.$transaction([
        prisma.placeTip.update({ where: { id: tipId }, data: { category, content, ...tr, edited: true } }),
        ...updates,
    ]);
    return { tip: { id: tipId, category, content, candidate_id: prev.candidate_id } };
}

/** 승인 팁을 후보로 내리거나(demote) 지움: 코스 팁(앱 화면)에서 빠짐 */
export async function removeApprovedTip(placeId: number, tipId: number, demote: boolean) {
    const prev = await prisma.placeTip.findFirstOrThrow({ where: { id: tipId, place_id: placeId } });
    const updates = courseTipUpdates(await coursePlacesOf(placeId), prev, null);
    const now = new Date();
    const back = { status: demote ? DEMOTED_STATUS : "rejected", category: prev.category, content: prev.content, decided_at: now };
    // 후보 행: 원래 후보에서 승인한 팁이면 그 행을 되살리고(내림) / 거절 처리(삭제). 직접 추가했던 팁을 내리면 새 후보 행
    const candidateOp = prev.candidate_id
        ? prisma.tipCandidate.update({ where: { id: prev.candidate_id }, data: back })
        : demote
          ? prisma.tipCandidate.create({ data: { place_id: placeId, ...back, decided_at: null } })
          : null;
    const results = await prisma.$transaction([prisma.placeTip.delete({ where: { id: tipId } }), ...updates, ...(candidateOp ? [candidateOp] : [])]);
    if (demote) await prisma.place.update({ where: { id: placeId }, data: { tip_status: "review" } });
    return { candidate: demote ? results[results.length - 1] : null, removedFromCourses: updates.length };
}

/** 남은 후보가 없으면 완료 */
export async function refreshTipStatus(placeId: number) {
    const pending = await prisma.tipCandidate.count({ where: { place_id: placeId, status: { in: REVIEW_STATUSES } } });
    if (pending === 0) await prisma.place.update({ where: { id: placeId }, data: { tip_status: "done" } });
}
