"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import TicketPlans from "@/components/TicketPlans";

function TicketPlanContent() {
    const router = useRouter();
    const searchParams = useSearchParams();

    const courseIdParam = searchParams.get("courseId");
    const gradeParam = searchParams.get("grade") as "BASIC" | "PREMIUM" | null;

    const courseId = courseIdParam ? Number(courseIdParam) : undefined;
    const courseGrade = gradeParam ?? undefined;
    const context = courseId != null ? "COURSE" : "UPGRADE";

    return (
        <TicketPlans
            context={context}
            courseId={courseId}
            courseGrade={courseGrade}
            onClose={() => router.push("/")}
            isModal={false}
        />
    );
}

export default function TicketPlanPage() {
    return (
        <Suspense>
            <TicketPlanContent />
        </Suspense>
    );
}
