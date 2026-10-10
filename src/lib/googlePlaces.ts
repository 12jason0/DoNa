// 구글 Places API (공식, legacy 엔드포인트). 키: GOOGLE_PLACES_API_KEY

const KEY = () => process.env.GOOGLE_PLACES_API_KEY ?? "";

export async function findGooglePlace(
    name: string,
    address: string
): Promise<{ place_id: string; lat: number | null; lng: number | null } | null> {
    if (!KEY()) return null;
    const query = encodeURIComponent(`${name} ${address}`.trim());
    // locationbias: 한국 중심(서울) 반경 300km
    const url = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${query}&inputtype=textquery&fields=place_id,geometry&locationbias=circle:300000@37.5665,126.9780&key=${KEY()}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000) }).catch(() => null);
    if (!res?.ok) return null;
    const data = await res.json();
    const candidate = data.candidates?.[0];
    if (!candidate?.place_id) return null;
    return {
        place_id: candidate.place_id,
        lat: candidate.geometry?.location?.lat ?? null,
        lng: candidate.geometry?.location?.lng ?? null,
    };
}

export interface GoogleReview {
    author_name: string;
    text: string;
    time: number; // unix seconds
}

export interface GooglePlaceDetails {
    url: string;
    phone: string;
    weekdayText: string[];
    openingHours: string; // 대표 영업시간 (가장 흔한 시간대)
    closedDays: { day_of_week: number; note: string | null }[];
    reviews: GoogleReview[];
}

export async function fetchGooglePlaceDetails(placeId: string, withReviews: boolean): Promise<GooglePlaceDetails | null> {
    if (!KEY()) return null;
    const fields = ["url", "formatted_phone_number", "opening_hours", ...(withReviews ? ["reviews"] : [])].join(",");
    const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(placeId)}&fields=${fields}&language=ko&reviews_sort=newest&key=${KEY()}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000) }).catch(() => null);
    if (!res?.ok) return null;
    const r = (await res.json()).result;
    if (!r) return null;

    // periods: [{open:{day,time}, close:{day,time}}], day 0=일
    const periods: any[] = r.opening_hours?.periods ?? [];
    const byDay: Record<number, string[]> = {};
    for (const p of periods) {
        if (p.open?.day == null) continue;
        (byDay[p.open.day] ??= []).push(`${fmt(p.open.time)}-${p.close ? fmt(p.close.time) : "24:00"}`);
    }
    const dayTimes = Object.values(byDay).map((t) => t.join(", "));
    const freq: Record<string, number> = {};
    for (const t of dayTimes) freq[t] = (freq[t] ?? 0) + 1;
    const openingHours = Object.entries(freq).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";
    // 24시간 영업(open만 있고 close 없음)이거나 정보 없으면 휴무일 추정 안 함
    const closedDays =
        periods.length === 0 || (periods.length === 1 && !periods[0].close)
            ? []
            : [0, 1, 2, 3, 4, 5, 6].filter((d) => !byDay[d]).map((d) => ({ day_of_week: d, note: null }));

    return {
        url: r.url ?? "",
        phone: r.formatted_phone_number ?? "",
        weekdayText: r.opening_hours?.weekday_text ?? [],
        openingHours,
        closedDays,
        reviews: (r.reviews ?? []).slice(0, 5).map((v: any) => ({ author_name: v.author_name ?? "", text: v.text ?? "", time: v.time ?? 0 })),
    };
}

function fmt(t: string) {
    return t && t.length === 4 ? `${t.slice(0, 2)}:${t.slice(2)}` : t;
}
