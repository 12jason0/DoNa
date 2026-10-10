import Anthropic from "@anthropic-ai/sdk";
import { fetchGooglePlaceDetails, findGooglePlace } from "@/lib/googlePlaces";

/** 카카오 로컬 키워드 검색 결과 (필요한 필드만) */
export interface KakaoPlace {
    id: string;
    place_name: string;
    address_name: string;
    road_address_name: string;
    phone: string;
    category_name: string;
    category_group_name: string;
    x: string;
    y: string;
}

export async function kakaoKeywordSearch(query: string, size = 1): Promise<KakaoPlace[]> {
    const apiKey = process.env.KAKAO_REST_API_KEY;
    if (!apiKey) return [];
    const res = await fetch(
        "https://dapi.kakao.com/v2/local/search/keyword.json?query=" + encodeURIComponent(query) + "&size=" + size,
        { headers: { Authorization: "KakaoAK " + apiKey }, cache: "no-store" }
    ).catch(() => null);
    if (!res?.ok) return [];
    const data = await res.json();
    return data.documents ?? [];
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
    google_place_id: string;
}

/** 주소 다국어 (자동채우기와 같은 haiku). 실패하면 null */
export async function translateAddress(address: string): Promise<{ address_en: string; address_ja: string; address_zh: string } | null> {
    if (!process.env.ANTHROPIC_API_KEY || !address.trim()) return null;
    try {
        const message = await new Anthropic().messages.create(
            {
                model: "claude-haiku-4-5-20251001",
                max_tokens: 500,
                messages: [
                    {
                        role: "user",
                        content: [
                            "다음 한국 주소를 옮기세요.",
                            `주소: ${address}`,
                            'JSON만 응답: {"address_en": "로마자 표기 영문 주소", "address_ja": "일본어 주소", "address_zh": "중국어(간체) 주소"}',
                        ].join("\n"),
                    },
                ],
            },
            { timeout: 30_000 }
        );
        const text = message.content[0].type === "text" ? message.content[0].text : "";
        const json = text.match(/\{[\s\S]*\}/);
        const r = json ? JSON.parse(json[0]) : null;
        return r?.address_en && r?.address_ja && r?.address_zh ? r : null;
    } catch (e) {
        console.error("주소 번역 실패:", e);
        return null;
    }
}

function isNameMatch(input: string, result: string): boolean {
    const norm = (s: string) => s.replace(/\s/g, "").toLowerCase();
    const a = norm(input);
    const b = norm(result);
    return a.includes(b) || b.includes(a);
}

/** pickedKakao: 텔레그램에서 관리자가 "맞아요"로 고른 카카오 장소 (있으면 이름 비교 없이 확정) */
export async function runPlaceAutofill(name: string, imageBuffer?: Buffer, forcedCategory?: string, neighborhood?: string, pickedKakao?: KakaoPlace): Promise<PlaceAutofillResult> {
    const searchQuery = neighborhood ? `${name} ${neighborhood}` : name;
    const [kakaoFound, naver] = await Promise.all([
        pickedKakao ? Promise.resolve([pickedKakao]) : kakaoKeywordSearch(searchQuery),
        naverSearch(searchQuery),
    ]);
    const kakao = kakaoFound[0] ?? null;

    const kakaoName = kakao?.place_name || "";
    const naverName = naver?.title?.replace(/<[^>]+>/g, "") || "";
    const resolvedName = kakaoName || naverName || name;

    // 카카오/네이버 결과가 입력한 이름과 다른 장소면 주소·좌표 사용 안 함
    const kakaoMatches = pickedKakao ? true : kakaoName ? isNameMatch(name, kakaoName) : false;
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

    // 영업시간·휴무일: 구글 Places (공식 API). 주소를 확정 못 하면 다른 가게일 수 있어 건너뜀
    const google = address ? await findGooglePlace(resolvedName, address) : null;
    const details = google ? await fetchGooglePlaceDetails(google.place_id, false) : null;

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
                '  "avg_cost_range": "카테고리 기반으로 1인 기준 최소~최대 가격대를 숫자+쉼표 형식으로 추정 (예: 10,000 - 20,000)",',
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
        phone: phone || details?.phone || "",
        website,
        latitude,
        longitude,
        category,
        opening_hours: details?.openingHours || "",
        closed_days: details?.closedDays ?? [],
        description: aiData.description || "",
        description_en: aiData.description_en || "",
        description_ja: aiData.description_ja || "",
        description_zh: aiData.description_zh || "",
        avg_cost_range: aiData.avg_cost_range || "",
        reservation_required: aiData.reservation_required === true,
        google_place_id: google?.place_id || "",
    };
}
