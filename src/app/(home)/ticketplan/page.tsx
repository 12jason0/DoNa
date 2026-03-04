"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import TicketPlans from "@/components/TicketPlans";

export default function TicketPlanPage() {
    const router = useRouter();

    const handleClose = () => {
        router.push("/");
    };

    return <TicketPlans context="UPGRADE" onClose={handleClose} isModal={false} />;
}
