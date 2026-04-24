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

// Naver day → day_of_week (0=일, 1=월 ... 6=토)
const NAV_DAY_TO_DOW: Record<string, number> = {
    SUN: 0, MON: 1, TUE: 2, WED: 3, THU: 4, FRI: 5, SAT: 6,
};
const ALL_NAV_DAYS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

interface NaverPlaceData {
    menuPrices: string;
    openingHours: string;
    closedDays: { day_of_week: number; note: string | null }[];
}

async function fetchNaverPlaceData(naverLink: string): Promise<NaverPlaceData> {
    const empty: NaverPlaceData = { menuPrices: "", openingHours: "", closedDays: [] };
    try {
        const match = naverLink.match(/place\/(\d+)/);
        if (!match) return empty;
        const placeId = match[1];
        const res = await fetch(`https://map.naver.com/v5/api/sites/summary/${placeId}?lang=ko`, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                Referer: "https://map.naver.com/",
            },
            cache: "no-store",
        });
        if (!res.ok) return empty;
        const data = await res.json();

        // 메뉴 가격
        const menus: any[] = data?.menus ?? data?.result?.menus ?? [];
        const menuPrices = menus.slice(0, 10).map((m: any) => {
            const menuName = m.name || m.menu || "";
            const price = m.price ?? m.cost ?? "";
            return price ? `${menuName}: ${Number(price).toLocaleString("ko-KR")}원` : menuName;
        }).filter(Boolean).join(", ");

        // 영업시간 & 휴무일
        const bizHours: any[] = data?.businessHours ?? data?.result?.businessHours ?? [];

        // 각 요일별 시간 문자열 추출
        const openDayTimes: Record<string, string> = {};
        for (const bh of bizHours) {
            const hours: any[] = bh.businessHours ?? bh.hours ?? [];
            if (!hours.length) continue;
            const timeStr = hours
                .map((h: any) => `${h.startTime ?? h.start ?? ""}-${h.endTime ?? h.end ?? ""}`)
                .join(", ");
            if (timeStr) openDayTimes[bh.day] = timeStr;
        }

        // 대표 영업시간: 가장 많이 등장하는 시간대
        let openingHours = "";
        if (Object.keys(openDayTimes).length > 0) {
            const freq: Record<string, number> = {};
            for (const t of Object.values(openDayTimes)) freq[t] = (freq[t] ?? 0) + 1;
            openingHours = Object.entries(freq).sort((a, b) => b[1] - a[1])[0][0];
        }

        // 휴무일: 7일 중 영업시간 없는 요일
        const closedDays = ALL_NAV_DAYS
            .filter((d) => !openDayTimes[d])
            .map((d) => ({ day_of_week: NAV_DAY_TO_DOW[d], note: null }));

        return { menuPrices, openingHours, closedDays };
    } catch {
        return empty;
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
    opening_hours: string;
    closed_days: { day_of_week: number; note: string | null }[];
    description: string;
    description_en: string;
    description_ja: string;
    description_zh: string;
    avg_cost_range: string;
    reservation_required: boolean;
}

function isNameMatch(input: string, result: string): boolean {
    const norm = (s: string) => s.replace(/\s/g, "").toLowerCase();
    const a = norm(input);
    const b = norm(result);
    return a.includes(b) || b.includes(a);
}

export async function runPlaceAutofill(name: string, imageBuffer?: Buffer, forcedCategory?: string, neighborhood?: string): Promise<PlaceAutofillResult> {
    const searchQuery = neighborhood ? `${name} ${neighborhood}` : name;
    const [kakao, naver] = await Promise.all([kakaoSearch(searchQuery), naverSearch(searchQuery)]);
    const naverLink = naver?.link || "";
    const { menuPrices, openingHours, closedDays } = naverLink
        ? await fetchNaverPlaceData(naverLink)
        : { menuPrices: "", openingHours: "", closedDays: [] };

    const kakaoName = kakao?.place_name || "";
    const naverName = naver?.title?.replace(/<[^>]+>/g, "") || "";
    const resolvedName = kakaoName || naverName || name;

    // 카카오/네이버 결과가 입력한 이름과 다른 장소면 주소·좌표 사용 안 함
    const kakaoMatches = kakaoName ? isNameMatch(name, kakaoName) : false;
    const naverMatches = naverName ? isNameMatch(name, naverName) : false;

    const address = kakaoMatches
        ? kakao?.road_address_name || kakao?.address_name || ""
        : naverMatches
          ? naver?.roadAddress || naver?.address || ""
          : "";
    const phone = (kakaoMatches || naverMatches) ? (naver?.telephone || kakao?.phone || "") : "";
    const website = (kakaoMatches || naverMatches) && naver?.link && !naver.link.includes("map.naver.com") ? naver.link : "";
    const latitude = kakaoMatches && kakao?.y ? parseFloat(parseFloat(kakao.y).toFixed(6)) : null;
    const longitude = kakaoMatches && kakao?.x ? parseFloat(parseFloat(kakao.x).toFixed(6)) : null;
    const categoryRaw = forcedCategory || ((kakaoMatches || naverMatches) ? (kakao?.category_name || naver?.category || "") : "");
    const category = forcedCategory || ((kakaoMatches || naverMatches) ? (kakao?.category_group_name || categoryRaw.split(" > ")[0] || "") : "");

    let aiData: any = {};
    if (process.env.ANTHROPIC_API_KEY) {
        try {
            const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
            const prompt = [
                "당신은 20-30대 커플 데이트 앱 'DoNa'의 장소 큐레이터입니다.",
                "다음 장소 정보를 바탕으로 데이터를 생성해주세요.",
                imageBuffer ? "첨부된 사진을 참고해 실제 공간의 분위기와 특징을 파악하세요." : "",
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
                '  "description": "커플 데이트 관점에서 이 장소의 매력을 1문장으로. 공간 분위기·경험 중심으로 쓰되, 왜 데이트 장소로 좋은지 자연스럽게 녹여내기. (예 카페: \'통유리 너머 한강이 보이는 좌석에서 여유로운 오후를 보낼 수 있는 감성 카페\' / 예 소품샵: \'빈티지 소품과 아기자기한 인테리어 소품이 가득해 함께 구경하며 취향을 나누기 좋은 편집숍\')",',
                '  "description_en": "Same concept, 1 sentence in English for couples",',
                '  "description_ja": "同じコンセプト、カップル向けに日本語で1文",',
                '  "description_zh": "相同概念，面向情侣用中文写一句话",',
                '  "address_en": "주어진 한국어 주소를 영문으로 변환 (로마자 표기)",',
                '  "address_ja": "주어진 한국어 주소를 일본어로 번역",',
                '  "address_zh": "주어진 한국어 주소를 중국어로 번역",',
                '  "avg_cost_range": "위 메뉴/가격 정보를 참고해 1인 기준 최소~최대 가격대를 숫자+쉼표 형식으로 (예: 10,000 - 20,000). 정보 없으면 카테고리 기반으로 추정",',
                '  "reservation_required": false',
                "}",
                "",
                "reservation_required는 예약이 보통 필요한 곳(파인다이닝, 오마카세, 고급 레스토랑 등)이면 true, 아니면 false",
            ].filter(Boolean).join("\n");

            const userContent: Anthropic.MessageParam["content"] = imageBuffer
                ? [
                      { type: "image", source: { type: "base64", media_type: "image/jpeg", data: imageBuffer.toString("base64") } },
                      { type: "text", text: prompt },
                  ]
                : prompt;

            const message = await anthropic.messages.create({
                model: "claude-haiku-4-5-20251001",
                max_tokens: 3000,
                messages: [{ role: "user", content: userContent }],
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
        name: name, // 원본 입력 이름 유지 (카카오 결과로 덮어쓰지 않음)
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
        opening_hours: openingHours,
        closed_days: closedDays,
        description: aiData.description || "",
        description_en: aiData.description_en || "",
        description_ja: aiData.description_ja || "",
        description_zh: aiData.description_zh || "",
        avg_cost_range: aiData.avg_cost_range || "",
        reservation_required: aiData.reservation_required === true,
    };
}
