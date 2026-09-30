import type { Metadata } from "next";

// 홈과 내용이 거의 같아 중복 페이지로 잡히지 않도록 원본을 홈으로 지정
export const metadata: Metadata = { alternates: { canonical: "/" } };

export default function Layout({ children }: { children: React.ReactNode }) {
    return children;
}
