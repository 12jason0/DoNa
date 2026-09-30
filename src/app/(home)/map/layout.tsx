import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "지도 검색",
    description: "지도에서 주변 장소와 추천 코스를 찾아보세요. 현재 위치 기반 가까운 맛집·카페·명소 탐색.",
    alternates: { canonical: "/map" },
};

export default function Layout({ children }: { children: React.ReactNode }) {
    return children;
}
