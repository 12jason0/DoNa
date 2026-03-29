"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** OG 메타가 포함된 200 HTML을 준 뒤, 사용자만 코스 상세로 이동 */
export default function CourseViewRedirect({ href }: { href: string }) {
    const router = useRouter();
    useEffect(() => {
        router.replace(href);
    }, [href, router]);
    return (
        <p className="sr-only" aria-live="polite">
            코스 페이지로 이동 중…
        </p>
    );
}
