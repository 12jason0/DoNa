import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const coords = searchParams.get("coords"); // "lng,lat;lng,lat"
        let mode = (searchParams.get("mode") || "driving").toLowerCase();

        if (!coords) {
            return NextResponse.json({ error: "coords are required" }, { status: 400 });
        }

        const clientId = process.env.NAVER_MAP_API_KEY_ID;
        const clientSecret = process.env.NAVER_MAP_API_KEY;

        const [start, goal] = coords.split(";");
        if (!start || !goal) {
            return NextResponse.json({ error: "coords must include start and goal" }, { status: 400 });
        }

        // 좌표 유효성 검사
        const [startLng, startLat] = start.split(",").map(Number);
        const [goalLng, goalLat] = goal.split(",").map(Number);

        if (!startLng || !startLat || !goalLng || !goalLat) {
            console.error("❌ 좌표 파싱 실패");
            return NextResponse.json({ coordinates: [], error: "INVALID_COORDS" });
        }

        // 거리 계산 (대략)
        const distance =
            Math.sqrt(Math.pow((goalLng - startLng) * 88.8, 2) + Math.pow((goalLat - startLat) * 111, 2)) * 1000;

        // 🟢 직선 폴백 경로 생성 (9개 포인트)
        const createFallbackPath = (): Array<[number, number]> => {
            const points: Array<[number, number]> = [];
            for (let i = 0; i <= 8; i++) {
                const ratio = i / 8;
                const lng = startLng + (goalLng - startLng) * ratio;
                const lat = startLat + (goalLat - startLat) * ratio;
                points.push([lng, lat]);
            }
            return points;
        };

        // ✅ 도보 모드인데 거리가 15km 이상이면 운전 모드로 변경
        if (mode === "walking" && distance > 15000) {
            mode = "driving";
        }

        // API 키가 없으면 직선 폴백 대신 경로 없음 반환 (건물 통과 방지)
        if (!clientId || !clientSecret) {
            return NextResponse.json({ coordinates: [], fallback: true, error: "NO_API_KEYS" });
        }
        // --- API 선택 ---
        const endpoint =
            mode === "walking"
                ? `https://naveropenapi.apigw.ntruss.com/map-direction/v1/walking?start=${start}&goal=${goal}`
                : `https://naveropenapi.apigw.ntruss.com/map-direction/v1/driving?start=${start}&goal=${goal}&option=trafast`;

        try {
            const doFetch = async (ep: string) =>
                await fetch(ep, {
                    headers: {
                        "X-NCP-APIGW-API-KEY-ID": clientId,
                        "X-NCP-APIGW-API-KEY": clientSecret,
                    },
                    cache: "no-store",
                });
            let response = await doFetch(endpoint);
            let data = await response.json().catch(() => ({}));

            // 운전 경로에서 오류 발생 시(403/404/에러코드 230,300 등) 도보로 한 번 더 시도
            if (!response.ok && mode === "driving") {
                const errCode = (data?.error?.errorCode || data?.errorCode) as string | undefined;
                if (response.status === 403 || response.status === 404 || errCode === "230" || errCode === "300") {
                    const walkingEp = `https://naveropenapi.apigw.ntruss.com/map-direction/v1/walking?start=${start}&goal=${goal}`;
                    response = await doFetch(walkingEp);
                    data = await response.json().catch(() => ({}));
                    mode = "walking";
                }
            }

            // 🟢 에러(3xx/4xx/5xx) 시 직선 폴백 대신 경로 생략
            if (!response.ok) {
                const errCode = (data?.error?.errorCode || data?.errorCode) as string | undefined;
                const errMsg = (data?.error?.message || data?.message) as string | undefined;
                const errDetails = (data?.error?.details || data?.details) as string | undefined;
                const isNotFoundUrl =
                    errCode === "300" ||
                    /not\s*found/i.test(String(errMsg || "")) ||
                    /url\s*not\s*found/i.test(String(errDetails || ""));
                if (isNotFoundUrl) {
                    console.warn("⚠️ Naver API URL not found - 경로 생략:", { errCode, errMsg, errDetails });
                } else {
                    console.error("❌ Naver API 에러:", data);
                }
                return NextResponse.json({ coordinates: [], fallback: true, error: data?.message || response.status });
            }

            // API 응답에 route가 없으면 (짧은 거리 포함)
            if (!data?.route || data.route === null) {
                if (mode !== "walking") {
                    const walkingEp = `https://naveropenapi.apigw.ntruss.com/map-direction/v1/walking?start=${start}&goal=${goal}`;
                    const r = await doFetch(walkingEp);
                    const d = await r.json().catch(() => ({}));
                    if (r.ok && d?.route) {
                        data = d;
                        mode = "walking";
                    } else {
                        return NextResponse.json({ coordinates: [], fallback: true, reason: "NO_ROUTE" });
                    }
                } else {
                    return NextResponse.json({ coordinates: [], fallback: true, reason: "NO_ROUTE" });
                }
            }

            // --- 경로 추출 (모드별로 다른 구조 처리) ---
            let path: Array<[number, number]> | undefined = undefined;

            const route = data.route;

            // ✅ 수정: Walking과 Driving 모두 동일한 구조 처리
            // 응답 구조: { route: { traoptimal/trafast: [{ path: [[lng,lat], ...], summary: {...} }] } }

            if (mode === "walking") {
                // traoptimal 우선 확인
                if (Array.isArray(route.traoptimal) && route.traoptimal.length > 0) {
                    const routePath = route.traoptimal[0]?.path;
                    if (Array.isArray(routePath) && routePath.length > 0) {
                        path = routePath;
                    }
                }

                // trafast 백업
                if (!path && Array.isArray(route.trafast) && route.trafast.length > 0) {
                    const routePath = route.trafast[0]?.path;
                    if (Array.isArray(routePath) && routePath.length > 0) {
                        path = routePath;
                    }
                }
            } else {
                // trafast 우선 확인
                if (Array.isArray(route.trafast) && route.trafast.length > 0) {
                    const routePath = route.trafast[0]?.path;
                    if (Array.isArray(routePath) && routePath.length > 0) {
                        path = routePath;
                    }
                }

                // traoptimal 백업
                if (!path && Array.isArray(route.traoptimal) && route.traoptimal.length > 0) {
                    const routePath = route.traoptimal[0]?.path;
                    if (Array.isArray(routePath) && routePath.length > 0) {
                        path = routePath;
                    }
                }

                // tracomfort 백업
                if (!path && Array.isArray(route.tracomfort) && route.tracomfort.length > 0) {
                    const routePath = route.tracomfort[0]?.path;
                    if (Array.isArray(routePath) && routePath.length > 0) {
                        path = routePath;
                    }
                }
            }

            // 백업: 모든 키를 순회하며 경로 찾기
            if (!path) {
                for (const key of Object.keys(route)) {
                    const routeData = route[key];

                    // 배열인지 확인
                    if (Array.isArray(routeData) && routeData.length > 0) {
                        const firstItem = routeData[0];

                        // path 속성이 있는지 확인
                        if (firstItem?.path && Array.isArray(firstItem.path) && firstItem.path.length > 0) {
                            path = firstItem.path;
                            break;
                        }

                        // 직접 좌표 배열인지 확인
                        if (Array.isArray(firstItem) && firstItem.length === 2 && typeof firstItem[0] === "number") {
                            path = routeData;
                            break;
                        }
                    }
                }
            }

            // 🟢 경로를 찾았으면 반환, 너무 짧거나 없으면 직선 폴백
            if (path && Array.isArray(path) && path.length > 2) {
                return NextResponse.json({
                    coordinates: path,
                    summary: route.traoptimal?.[0]?.summary || route.trafast?.[0]?.summary,
                });
            }
            return NextResponse.json({
                coordinates: createFallbackPath(),
                fallback: true,
                reason: "TOO_CLOSE_OR_NO_ROUTE",
            });
        } catch (fetchError: any) {
            console.error("❌ API 요청 실패:", fetchError);
            return NextResponse.json({ coordinates: [], fallback: true, error: fetchError.message });
        }
    } catch (error: any) {
        console.error("❌ Directions API error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
