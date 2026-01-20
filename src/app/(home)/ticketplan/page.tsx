"use client";

import { useRouter } from "next/navigation";
import TicketPlans from "@/components/TicketPlans";

export default function TicketPlanPage() {
    const router = useRouter();

    const handleClose = () => {
        // 페이지에서 닫기 버튼 클릭 시 홈으로 이동
        router.push("/");
    };

    return <TicketPlans onClose={handleClose} isModal={false} />;
}
