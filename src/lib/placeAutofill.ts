import Anthropic from "@anthropic-ai/sdk";

async function kakaoSearch(name: string) {
    const apiKey = process.env.KAKAO_REST_API_KEY;
    if (!apiKey) return null;
    const res = await fetch(
        "https://dapi.kakao.com/v2/local/search/keyword.json?query=" + encodeURIComponent(name) + "&size=1",
        { headers: { Authorization: "KakaoAK " + apiKey }, cache: "no-store" }
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data.documents?.[0] ?? null;
}

async function naverSearch(name: string) {
    const clientId = process.env.NAVER_SEARCH_CLIENT_ID;
    const clientSecret = process.env.NAVER_SEARCH_CLIENT_SECRET;
    if (!clientId || !clientSecret) return null;
    const res = await fetch(
        "https://openapi.naver.com/v1/search/local.json?query=" + encodeURIComponent(name) + "&display=1",
        {
            headers: { "X-Naver-Client-Id": clientId, "X-Naver-Client-Secret": clientSecret },
            cache: "no-store",
        }
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data.items?.[0] ?? null;
}

async function fetchNaverPlaceMenuPrices(naverLink: string): Promise<string> {
    try {
        const match = naverLink.match(/place\/(\d+)/);
        if (!match) return "";
        const placeId = match[1];
        const res = await fetch(`https://map.naver.com/v5/api/sites/summary/${placeId}?lang=ko`, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                Referer: "https://map.naver.com/",
            },
            cache: "no-store",
        });
        if (!res.ok) return "";
        const data = await res.json();
        const menus: any[] = data?.menus ?? data?.result?.menus ?? [];
        if (!menus.length) return "";
        const lines = menus.slice(0, 10).map((m: any) => {
            const menuName = m.name || m.menu || "";
            const price = m.price ?? m.cost ?? "";
            return price ? `${menuName}: ${Number(price).toLocaleString("ko-KR")}원` : menuName;
        });
        return lines.filter(Boolean).join(", ");
    } catch {
        return "";
    }
}

export interface PlaceAutofillResult {
    name: string;
    name_en: string;
    name_ja: string;
    name_zh: string;
    address: string;
    address_en: string;
    address_ja: string;
    address_zh: string;
    phone: string;
    website: string;
    latitude: number | null;
    longitude: number | null;
    category: string;
    description: string;
    description_en: string;
    description_ja: string;
    description_zh: string;
    avg_cost_range: string;
    reservation_required: boolean;
}

export async function runPlaceAutofill(name: string): Promise<PlaceAutofillResult> {
    const [kakao, naver] = await Promise.all([kakaoSearch(name), naverSearch(name)]);
    const naverLink = naver?.link || "";
    const menuPrices = naverLink ? await fetchNaverPlaceMenuPrices(naverLink) : "";

    const address = kakao?.road_address_name || kakao?.address_name || naver?.roadAddress || naver?.address || "";
    const phone = naver?.telephone || kakao?.phone || "";
    const website = naver?.link && !naver.link.includes("map.naver.com") ? naver.link : "";
    const latitude = kakao?.y ? parseFloat(parseFloat(kakao.y).toFixed(6)) : null;
    const longitude = kakao?.x ? parseFloat(parseFloat(kakao.x).toFixed(6)) : null;
    const categoryRaw = kakao?.category_name || naver?.category || "";
    const category = kakao?.category_group_name || categoryRaw.split(" > ")[0] || "";
    const resolvedName = kakao?.place_name || naver?.title?.replace(/<[^>]+>/g, "") || name;

    let aiData: any = {};
    if (process.env.ANTHROPIC_API_KEY) {
        try {
            const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
            const prompt = [
                "다음 장소 정보를 바탕으로 데이터를 생성해주세요.",
                "",
                "장소명: " + resolvedName,
                "주소(한국어): " + (address || "정보 없음"),
                "카테고리: " + (categoryRaw || "정보 없음"),
                "메뉴/가격 정보: " + (menuPrices || "정보 없음"),
                "",
                "다음 JSON 형식으로만 응답하세요 (다른 텍스트 없이):",
                "{",
                '  "name_en": "장소명 영어 번역 (한국어 고유명사는 로마자 발음 그대로, 예: 봉땅 → Bongdang)",',
                '  "name_ja": "장소명 일본어 번역 (한국어 고유명사는 가타카나 음역, 예: 봉땅 → ポンダン)",',
                '  "name_zh": "장소명 중국어 번역 (한국어 고유명사는 한자 음역 또는 병음, 예: 봉땅 → 蓬当)",',
                '  "description": "이 장소의 분위기와 경험을 1문장으로 (예: 스마트폰과 미디어에 의존하는 일상에서 벗어나 독서를 통해 디지털 디톡스와 힐링을 실천할 수 있는 장소)",',
                '  "description_en": "Same concept, 1 sentence in English",',
                '  "description_ja": "同じコンセプト、日本語で1文",',
                '  "description_zh": "相同概念，用中文写一句话",',
                '  "address_en": "주어진 한국어 주소를 영문으로 변환 (로마자 표기)",',
                '  "address_ja": "주어진 한국어 주소를 일본어로 번역",',
                '  "address_zh": "주어진 한국어 주소를 중국어로 번역",',
                '  "avg_cost_range": "위 메뉴/가격 정보를 참고해 1인 기준 최소~최대 가격대를 숫자+쉼표 형식으로 (예: 10,000 - 20,000). 정보 없으면 카테고리 기반으로 추정",',
                '  "reservation_required": false',
                "}",
                "",
                "reservation_required는 예약이 보통 필요한 곳(파인다이닝, 오마카세, 고급 레스토랑 등)이면 true, 아니면 false",
            ].join("\n");

            const message = await anthropic.messages.create({
                model: "claude-haiku-4-5-20251001",
                max_tokens: 3000,
                messages: [{ role: "user", content: prompt }],
            });
            const text = message.content[0].type === "text" ? message.content[0].text : "";
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                try {
                    aiData = JSON.parse(jsonMatch[0]);
                } catch {
                    console.error("placeAutofill JSON 파싱 실패:", jsonMatch[0].slice(0, 200));
                }
            }
        } catch (e) {
            console.error("placeAutofill Claude 호출 실패:", e);
        }
    }

    return {
        name: resolvedName,
        name_en: aiData.name_en || "",
        name_ja: aiData.name_ja || "",
        name_zh: aiData.name_zh || "",
        address,
        address_en: aiData.address_en || "",
        address_ja: aiData.address_ja || "",
        address_zh: aiData.address_zh || "",
        phone,
        website,
        latitude,
        longitude,
        category,
        description: aiData.description || "",
        description_en: aiData.description_en || "",
        description_ja: aiData.description_ja || "",
        description_zh: aiData.description_zh || "",
        avg_cost_range: aiData.avg_cost_range || "",
        reservation_required: aiData.reservation_required === true,
    };
}
