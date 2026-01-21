"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import TicketPlans from "@/components/TicketPlans";
import { isAndroidReviewBypass } from "@/lib/platform";

export default function TicketPlanPage() {
    const router = useRouter();

    // 🟢 [Android 리뷰 우회] Android 앱에서만 /ticketplan 접근 시 홈으로 리다이렉트 (웹·iOS는 그대로)
    useEffect(() => {
        if (isAndroidReviewBypass()) router.replace("/");
    }, [router]);

    const handleClose = () => {
        router.push("/");
    };

    if (isAndroidReviewBypass()) return null;
    return <TicketPlans onClose={handleClose} isModal={false} />;
}
