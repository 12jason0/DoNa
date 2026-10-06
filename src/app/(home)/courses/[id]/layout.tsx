import React from "react";
import { notFound } from "next/navigation";
import prisma from "@/lib/db";

/**
 * 코스 상세 세그먼트 공통 레이아웃 — 실제 UI는 `page.tsx` + `CourseDetailClient`
 * 없는 코스는 여기서 notFound(): 같은 폴더의 loading.tsx(Suspense) 바깥이라 스트리밍 전에 진짜 404 상태가 나감.
 * (page.tsx에서만 notFound하면 로딩 화면이 먼저 전송돼 200으로 고정됨) — 존재 여부만 보고 권한 판단은 page.tsx 그대로.
 */
export default async function CoursesIdLayout({
    children,
    params,
}: {
    children: React.ReactNode;
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;
    const courseId = Number(id.startsWith("c-") ? id.replace("c-", "") : id);
    const exists =
        Number.isInteger(courseId) &&
        courseId > 0 &&
        (await prisma.course.findUnique({ where: { id: courseId }, select: { id: true } }));
    if (!exists) notFound();
    return <>{children}</>;
}
