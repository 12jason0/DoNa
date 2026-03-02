import { Suspense } from "react";
import HomeClient from "./HomeClient";

export const dynamic = "force-dynamic";
export const revalidate = 300;

// 🟢 메인: 개인 맞춤 추천 + 나만의 앨범만 표시 (코스 그리드는 /courses에서)
function HomePlaceholder() {
    return <div className="min-h-screen" aria-hidden="true" />;
}

export default function Page() {
    return (
        <Suspense fallback={<HomePlaceholder />}>
            <HomeClient />
        </Suspense>
    );
}
