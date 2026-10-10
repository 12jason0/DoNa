// 카카오에 없는 팝업·전시의 위치 찾기 (크롤링 없음: 이미 모은 블로그 요약 + 카카오 주소 검색 API)
import prisma from "@/lib/db";
import { defaultCache } from "@/lib/cache";
import { kakaoKeywordSearch } from "@/lib/placeAutofill";
import { sendTelegram } from "@/lib/telegram";
import { countDistinctSources } from "@/lib/tipPipeline";
import { translatePopupFields } from "@/lib/popupTranslate";

// "서울 성동구 연무장5길 9-29", "성동구 연무장 5길 9-29" (시·도는 있어도 없어도 됨)
const FULL_ROAD_RE = /([가-힣]+(?:구|군|시))\s+([가-힣][가-힣0-9 ]{0,15}?(?:로|길))\s*(\d{1,5}(?:-\d{1,4})?)(?![\d가-힣]|,\d)/g;

/** 글 안의 도로명 주소를 "성동구 연무장5길 9-29" 형태로 ("서울특별시 성동구연무장5길"처럼 붙여 쓴 것도 같은 모양으로) */
export function extractRoadAddresses(text: string): string[] {
    return [
        ...new Set(
            [...text.matchAll(FULL_ROAD_RE)].map((m) => {
                let gu = m[1];
                let road = m[2].replace(/\s+/g, "");
                const stuck = road.match(/^([가-힣]+?(?:구|군))([가-힣][가-힣0-9]*(?:로|길))$/);
                if (stuck && stuck[2].length >= 2) [gu, road] = [stuck[1], stuck[2]];
                return `${gu} ${road} ${m[3]}`;
            })
        ),
    ];
}

export type LocationOption = { label: string; address: string; lat: number; lng: number };

async function kakaoAddress(query: string): Promise<LocationOption | null> {
    const key = process.env.KAKAO_REST_API_KEY;
    if (!key) return null;
    const res = await fetch(`https://dapi.kakao.com/v2/local/search/address.json?query=${encodeURIComponent(query)}&size=1`, {
        headers: { Authorization: "KakaoAK " + key },
        signal: AbortSignal.timeout(10_000),
    }).catch(() => null);
    if (!res?.ok) return null;
    const d = (await res.json()).documents?.[0];
    if (!d) return null;
    const address = d.road_address?.address_name || d.address_name;
    return { label: address, address, lat: Number(d.y), lng: Number(d.x) };
}

/**
 * 모은 블로그 자료에서 주소 찾기: 서로 다른 글(같은 작성자는 1개) 2개 이상이 같은 주소면 채택 → 카카오 주소 검색으로 좌표.
 * 못 찾으면 null
 */
export async function findPopupAddress(placeId: number): Promise<(LocationOption & { sourceCount: number }) | null> {
    const sources = await prisma.tipSource.findMany({
        where: { place_id: placeId, relevant: true },
        select: { id: true, source_type: true, author: true, url: true, title: true, content: true },
    });
    const byAddress = new Map<string, typeof sources>();
    for (const s of sources)
        for (const a of extractRoadAddresses(`${s.title ?? ""} ${s.content ?? ""}`)) byAddress.set(a, [...(byAddress.get(a) ?? []), s]);

    const ranked = [...byAddress.entries()]
        .map(([address, list]) => ({ address, count: countDistinctSources(list) }))
        .filter((x) => x.count >= 2)
        .sort((a, b) => b.count - a.count);
    for (const r of ranked) {
        const hit = await kakaoAddress(r.address);
        if (hit) return { ...hit, sourceCount: r.count };
    }
    return null;
}

/** 주소·좌표 저장 (이름·tip_query는 그대로) + 주소 다국어 칸 채우기 */
export async function savePlaceLocation(placeId: number, loc: LocationOption) {
    await prisma.place.update({
        where: { id: placeId },
        data: { address: loc.address, latitude: loc.lat, longitude: loc.lng },
    });
    await translatePopupFields(placeId).catch((e) => console.error("팝업 주소 번역 실패:", e));
}

// ---- 텔레그램: "여기 맞아요?" 버튼 / "@건물이름" ----

type AddressPending = { placeId: number; placeName: string; options: LocationOption[] };
export const addressPendingKey = (chatId: number) => `tg:addr-pending:${chatId}`;
const TTL = 24 * 60 * 60 * 1000;

function askOptions(chatId: number, p: AddressPending, intro: string) {
    const text = `${intro}\n\n${p.options.map((o, i) => `${p.options.length > 1 ? `${i + 1}. ` : ""}${o.label}`).join("\n")}`;
    const buttons =
        p.options.length === 1
            ? [[{ text: "맞아요", data: "addr:0" }, { text: "아니에요", data: "addr:no" }]]
            : [p.options.map((_, i) => ({ text: String(i + 1), data: `addr:${i}` })), [{ text: "여기 없어요", data: "addr:no" }]];
    return sendTelegram(chatId, text, buttons);
}

const askBuilding = (chatId: number, placeName: string) =>
    sendTelegram(chatId, `📍 "${placeName}" 주소를 못 찾았어요. @건물이름으로 보내주세요.\n예: @성수 에스팩토리`);

/** 위치 없는 장소 저장 후: 블로그 자료에서 주소를 찾아 "여기 맞아요?"로 묻기 */
export async function suggestPopupAddress(placeId: number, chatId: number) {
    const place = await prisma.place.findUniqueOrThrow({ where: { id: placeId }, select: { name: true } });
    const found = await findPopupAddress(placeId);
    const pending: AddressPending = { placeId, placeName: place.name, options: found ? [found] : [] };
    await defaultCache.set(addressPendingKey(chatId), pending, TTL);
    if (!found) return askBuilding(chatId, place.name);
    return askOptions(chatId, pending, `📍 "${place.name}" 여기 맞아요? (블로그 ${found.sourceCount}곳에서 같은 주소)`);
}

/** "@건물이름" 메시지: 기다리는 장소가 있으면 카카오 키워드 검색 결과를 버튼으로 */
export async function handleBuildingMessage(chatId: number, query: string) {
    const pending = await defaultCache.get<AddressPending>(addressPendingKey(chatId));
    if (!pending) return sendTelegram(chatId, "주소를 기다리는 장소가 없어요.");
    const found = await kakaoKeywordSearch(query, 5);
    if (found.length === 0) return sendTelegram(chatId, `"${query}"를 카카오에서 못 찾았어요. 다른 이름으로 다시 보내주세요.`);
    const next: AddressPending = {
        ...pending,
        options: found.map((k) => {
            const address = k.road_address_name || k.address_name;
            return { label: `${k.place_name} (${address})`, address, lat: Number(k.y), lng: Number(k.x) };
        }),
    };
    await defaultCache.set(addressPendingKey(chatId), next, TTL);
    return askOptions(chatId, next, `📍 "${pending.placeName}" 위치가 여기예요?`);
}

/** 버튼 처리: 고르면 저장하고 placeId를 돌려줌(호출한 쪽에서 구글 자료 다시 모으기). "아니에요"면 @건물이름 안내 */
export async function handleAddressButton(chatId: number, data: string): Promise<number | null> {
    const pending = await defaultCache.get<AddressPending>(addressPendingKey(chatId));
    if (!pending) {
        await sendTelegram(chatId, "시간이 지나서 취소됐어요. 관리자 화면에서 \"주소 자동 찾기\"를 눌러주세요.");
        return null;
    }
    const pick = pending.options[Number(data.replace("addr:", ""))];
    if (!pick) {
        await defaultCache.set(addressPendingKey(chatId), { ...pending, options: [] }, TTL);
        await askBuilding(chatId, pending.placeName);
        return null;
    }
    defaultCache.delete(addressPendingKey(chatId));
    await savePlaceLocation(pending.placeId, pick);
    await sendTelegram(chatId, `✅ "${pending.placeName}" 위치 저장: ${pick.address}\n구글 자료까지 다시 모으는 중... 끝나면 알려드릴게요.`);
    return pending.placeId;
}
