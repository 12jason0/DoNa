import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "커플 미션 게임 - 데이트 코스 위 방탈출",
    description: "도심을 누비며 챕터를 완료하고 배지를 획득하는 커플 미션 게임. 데이트 코스를 걸으며 이색 방탈출 미션을 즐겨요.",
    alternates: { canonical: "/escape" },
};

export default function Layout({ children }: { children: React.ReactNode }) {
    return children;
}
