import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "두나 소개 - 여행, 이제 직접 안 짜도 돼요",
    description: "밀키트처럼 꺼내 먹는 여행 코스, DoNa. 커플·가족·친구 컨셉만 고르면 AI가 취향과 동선에 맞는 코스를 추천해요.",
    alternates: { canonical: "/about" },
};

export default function Layout({ children }: { children: React.ReactNode }) {
    return children;
}
