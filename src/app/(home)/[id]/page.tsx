import { notFound } from "next/navigation";
import prisma from "@/lib/db";
import PlaceDetailView, { type PlaceDetailSerialized } from "./PlaceDetailView";

interface PageProps {
    params: Promise<{
        id: string;
    }>;
}

export const dynamic = "force-dynamic";

/**
 * 장소 상세 페이지
 */
export default async function PlaceDetailPage({ params }: PageProps) {
    const { id } = await params;
    const placeId = parseInt(id);

    if (isNaN(placeId)) {
        notFound();
    }

    const place = await prisma.place.findUnique({
        where: { id: placeId },
        include: {
            closed_days: {
                orderBy: [{ day_of_week: "asc" }, { specific_date: "asc" }],
            },
        },
    });

    if (!place) {
        notFound();
    }

    const serialized = JSON.parse(JSON.stringify(place)) as PlaceDetailSerialized;

    return <PlaceDetailView place={serialized} />;
}
