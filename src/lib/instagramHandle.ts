// 장소 인스타 계정 찾기: 공식 API(네이버 지역 검색 link, 구글 Places website)에 적힌 주소에서만 뽑음. 인스타 직접 조회·크롤링 안 함

/** instagram.com/<계정> 이 아닌 경로 (게시물·릴스·스토리 등) */
const NOT_ACCOUNT = new Set(["p", "reel", "reels", "stories", "explore", "tv", "accounts", "direct", "about", "developer", "legal", "web", "share"]);

/** "https://www.instagram.com/pixel.per.inch/?hl=ko" → "pixel.per.inch". 게시물 주소·링크 모음(linktr.ee 등)·다른 사이트는 null */
export function instagramHandleFromUrl(url: string | null | undefined): string | null {
    if (!url) return null;
    let u: URL;
    try {
        u = new URL(url.trim().startsWith("http") ? url.trim() : `https://${url.trim()}`);
    } catch {
        return null;
    }
    if (!/^(www\.|m\.)?instagram\.com$/i.test(u.hostname)) return null;
    const parts = u.pathname.split("/").filter(Boolean);
    if (parts.length !== 1) return null; // /계정/ 만 인정 (/p/xxx, /계정/reels 등은 제외)
    const handle = parts[0].toLowerCase();
    if (NOT_ACCOUNT.has(handle) || !/^[a-z0-9._]{1,30}$/.test(handle)) return null;
    return handle;
}

/** 주소 비교용: 시·도 표기 통일 후 첫 번지 숫자까지 ("서울 용산구 한강대로54길 7 301호" → 서울 용산구 한강대로54길 7) */
function addressHead(addr: string) {
    const tokens = addr
        .replace(/서울특별시/g, "서울")
        .replace(/(부산|대구|인천|광주|대전|울산)광역시/g, "$1")
        .replace(/세종특별자치시/g, "세종")
        .replace(/경기도/g, "경기")
        .replace(/제주특별자치도/g, "제주")
        .replace(/[(),]/g, " ")
        .split(/\s+/)
        .filter(Boolean);
    const num = tokens.findIndex((t) => /^\d/.test(t));
    return num < 0 ? null : tokens.slice(0, num + 1).join(" ");
}

/** DB 주소와 검색 결과 주소(도로명·지번 중 하나)가 번지까지 같으면 같은 곳 */
export function sameAddress(dbAddress: string | null | undefined, ...candidates: (string | null | undefined)[]) {
    const a = dbAddress ? addressHead(dbAddress) : null;
    return !!a && candidates.some((c) => !!c && addressHead(c) === a);
}

const stripTags = (s: string) => s.replace(/<[^>]+>/g, "");
const squash = (s: string) => s.replace(/&amp;/g, "&").toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
/**
 * 이름 비교: 띄어쓰기·기호 무시, 같거나 한쪽이 다른 쪽으로 시작 ("테디뵈르하우스" ↔ "테디뵈르하우스 용산점").
 * "포함"까지 인정하면 같은 건물 입점 가게("와인픽스 이케아광명점")가 잡혀서 시작만 인정
 */
const nameMatch = (a: string, b: string) => {
    const x = squash(a), y = squash(b);
    return !!x && !!y && (x.startsWith(y) || y.startsWith(x));
};

type NaverLocalItem = { title: string; link: string; address: string; roadAddress: string };

/** 네이버 지역 검색(최대 5개)에서 이름·주소가 DB와 맞는 결과의 link → 인스타 계정 */
export async function instagramFromNaver(name: string, address: string | null): Promise<{ handle: string; link: string; title: string } | null> {
    const id = process.env.NAVER_SEARCH_CLIENT_ID, secret = process.env.NAVER_SEARCH_CLIENT_SECRET;
    if (!id || !secret || !address) return null;
    const gu = address.split(/\s+/)[1] ?? ""; // "서울 용산구 …" → 용산구 (같은 이름 다른 지점 줄이기)
    const res = await fetch(`https://openapi.naver.com/v1/search/local.json?query=${encodeURIComponent(`${name} ${gu}`.trim())}&display=5`, {
        headers: { "X-Naver-Client-Id": id, "X-Naver-Client-Secret": secret },
        cache: "no-store",
        signal: AbortSignal.timeout(10_000),
    }).catch(() => null);
    if (!res?.ok) return null;
    const items = ((await res.json()).items ?? []) as NaverLocalItem[];
    for (const it of items) {
        const title = stripTags(it.title);
        if (!nameMatch(name, title) || !sameAddress(address, it.roadAddress, it.address)) continue;
        const handle = instagramHandleFromUrl(it.link);
        if (handle) return { handle, link: it.link, title };
    }
    return null;
}

/** 구글 Places 상세 website → 인스타 계정 (네이버로 못 찾았을 때만. Place Details 1회 = 유료 호출) */
export async function instagramFromGoogle(googlePlaceId: string | null | undefined): Promise<{ handle: string; link: string } | null> {
    const key = process.env.GOOGLE_PLACES_API_KEY;
    if (!key || !googlePlaceId) return null;
    const res = await fetch(`https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(googlePlaceId)}&fields=website&key=${key}`, {
        signal: AbortSignal.timeout(10_000),
    }).catch(() => null);
    if (!res?.ok) return null;
    const link = ((await res.json()) as { result?: { website?: string } }).result?.website;
    const handle = instagramHandleFromUrl(link);
    return handle && link ? { handle, link } : null;
}
