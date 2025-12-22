"use client";

import { useState, useEffect } from "react";
import { Container as MapDiv, NaverMap, Marker, Polyline, Polygon } from "react-naver-maps";

// --- 타입 정의 ---
interface Coordinate {
    lat: number;
    lng: number;
}

interface FootprintProps {
    // 사용자가 완료한 코스 경로 데이터
    courses?: {
        id: number | string;
        title: string;
        path: Coordinate[]; // 경로 좌표 배열 [{lat, lng}, ...]
    }[];

    // 사용자가 방문 인증(미션 성공)한 장소 데이터
    visitedPlaces?: {
        id: number | string;
        name: string;
        lat: number;
        lng: number;
        type: "escape" | "course_spot"; // escape: 방탈출 미션 성공, course_spot: 일반 코스 방문
        courseId?: number | string; // 코스 ID (클릭 시 상세 페이지로 이동)
    }[];

    // 🟢 핀 클릭 시 호출되는 콜백
    onPlaceClick?: (place: {
        id: number | string;
        name: string;
        courseId?: number | string;
        type: "escape" | "course_spot";
    }) => void;
}

export default function MyFootprintMap({ courses = [], visitedPlaces = [], onPlaceClick }: FootprintProps) {
    const [mapsReady, setMapsReady] = useState(false);

    // 🌫️ 안개 효과를 위한 좌표 (대한민국 주변을 덮는 거대한 사각형)
    // 이 영역 내부를 흰색 반투명으로 칠해서 지도를 흐리게 만듭니다.
    const fogBounds = [
        { lat: 43.0, lng: 124.0 }, // 좌상단 (북한 위쪽)
        { lat: 43.0, lng: 132.0 }, // 우상단 (동해 쪽)
        { lat: 32.0, lng: 132.0 }, // 우하단 (제주도 아래)
        { lat: 32.0, lng: 124.0 }, // 좌하단 (서해 쪽)
    ];

    // 네이버 지도 SDK 로드 확인 (메인 지도와 동일 로직)
    useEffect(() => {
        if (typeof window === "undefined") return;

        // 이미 로드되어 있다면 바로 준비 상태로 변경
        if ((window as any).naver && (window as any).naver.maps) {
            setMapsReady(true);
            return;
        }

        // 로드 안 되어 있으면 스크립트 추가
        const clientId = process.env.NEXT_PUBLIC_NAVER_MAP_CLIENT_ID || "";
        if (!clientId) return;

        const script = document.createElement("script");
        script.src = `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${encodeURIComponent(clientId)}`;
        script.async = true;
        script.onload = () => setMapsReady(true);
        document.head.appendChild(script);
    }, []);

    if (!mapsReady) {
        return (
            <div className="w-full h-full bg-gray-50 flex items-center justify-center">
                <div className="animate-pulse text-gray-300 text-sm">지도를 펼치는 중...</div>
            </div>
        );
    }

    const navermaps = (window as any).naver.maps;

    return (
        <MapDiv style={{ width: "100%", height: "100%" }}>
            <NaverMap
                // 초기 중심점 (서울 시청 기준, 추후 사용자 마지막 위치로 변경 가능)
                defaultCenter={new navermaps.LatLng(37.5665, 126.978)}
                defaultZoom={12} // 탐색용 지도보다 조금 더 넓게(Zoom Out) 보여줌
                // 🎨 [스타일링 핵심] 지도 컨트롤러 숨기기 & 로고 재배치
                scaleControl={false} // 거리 자 끄기
                mapDataControl={false} // 네이버 카피라이트 텍스트 끄기 (로고는 남음)
                zoomControl={true} // 줌 버튼은 켜둠 (사용성 위해)
                zoomControlOptions={{
                    position: navermaps.Position.TOP_RIGHT,
                    style: navermaps.ZoomControlStyle.SMALL,
                }}
                logoControlOptions={{
                    position: navermaps.Position.BOTTOM_RIGHT, // 로고를 우측 하단 구석으로 이동
                }}
                // 지도 터치/드래그 시 관성 효과 끄기 (좀 더 종이 지도 같은 느낌)
                draggable={true}
                scrollWheel={true}
                disableKineticPan={false}
            >
                {/* 1️⃣ 화이트 포그 (White Fog) 레이어 */}
                {/* 지도를 85% 투명한 흰색으로 덮어서 배경을 흐릿하게 만듦 */}
                {/* zIndex: 10 (지도 바로 위) */}
                <Polygon
                    paths={fogBounds}
                    fillColor="#ffffff"
                    fillOpacity={0.85}
                    strokeWeight={0}
                    clickable={false} // 클릭 방해 안 함
                    zIndex={10}
                />

                {/* 2️⃣ 내 이동 경로 (Polyline) */}
                {/* 흰색 안개 위에 그려져서 선명하게 보임 */}
                {/* zIndex: 20 */}
                {courses.map((course, index) => (
                    <Polyline
                        key={`path-${course.id}-${index}`}
                        path={course.path}
                        strokeColor="#7aa06f" // 두나 시그니처 그린 컬러
                        strokeWeight={6} // 굵게 그려서 강조
                        strokeOpacity={1} // 완전 불투명
                        strokeLineCap="round" // 끝부분 둥글게
                        strokeLineJoin="round" // 꺾이는 부분 둥글게
                        zIndex={20}
                    />
                ))}

                {/* 3️⃣ 방문 장소 마커 (Custom Marker) */}
                {/* zIndex: 30 (가장 위) */}
                {visitedPlaces.map((place, index) => (
                    <Marker
                        key={`marker-${place.id}-${index}`}
                        position={new navermaps.LatLng(place.lat, place.lng)}
                        zIndex={30}
                        onClick={() => {
                            // 🟢 핀 클릭 시 콜백 호출
                            if (onPlaceClick) {
                                onPlaceClick({
                                    id: place.id,
                                    name: place.name,
                                    courseId: place.courseId,
                                    type: place.type,
                                });
                            }
                        }}
                        icon={{
                            // HTML 커스텀 아이콘
                            content: `
                <div style="position: relative; display: flex; justify-content: center; align-items: center; transition: transform 0.2s;">
                   ${
                       place.type === "escape"
                           ? // 🏆 탈출/미션 성공 마커 (큼직한 트로피 or 깃발) - 더 크고 눈에 띄게
                             `<div style="
                          font-size: 36px; 
                          filter: drop-shadow(0 6px 10px rgba(0,0,0,0.4));
                          transform: translateY(-18px);
                          transition: transform 0.2s;
                        ">🚩</div>`
                           : // 📍 일반 코스 방문 점 (두나 컬러 도트) - 더 크고 눈에 띄게
                             `<div style="
                          width: 20px; 
                          height: 20px; 
                          background-color: #10b981; 
                          border: 3px solid white; 
                          border-radius: 50%; 
                          box-shadow: 0 4px 8px rgba(0,0,0,0.4), 0 0 0 2px rgba(16,185,129,0.3);
                          transform: scale(1);
                          transition: transform 0.2s;
                        "></div>`
                   }
                   ${/* 라벨 (장소 이름) - 선택 사항 */ ""}
                   <div style="
                      position: absolute;
                      top: ${place.type === "escape" ? "18px" : "18px"};
                      white-space: nowrap;
                      font-size: 11px;
                      font-weight: 700;
                      color: #374151;
                      text-shadow: -1px -1px 0 #fff, 1px -1px 0 #fff, -1px 1px 0 #fff, 1px 1px 0 #fff;
                      pointer-events: none;
                      max-width: 120px;
                      overflow: hidden;
                      text-overflow: ellipsis;
                   ">${place.name && place.name.length > 15 ? place.name.substring(0, 15) + "..." : place.name}</div>
                </div>
              `,
                            anchor: new navermaps.Point(
                                place.type === "escape" ? 18 : 10,
                                place.type === "escape" ? 36 : 20
                            ),
                        }}
                    />
                ))}
            </NaverMap>
        </MapDiv>
    );
}
