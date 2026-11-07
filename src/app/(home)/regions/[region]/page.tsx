// 옛 주소 /regions/[region] → /area/[area] 영구 이동 (이미 색인된 주소 보존)
import { permanentRedirect } from "next/navigation";
import { areaPath } from "@/lib/regionIntro";

export default async function OldRegionPage({ params }: { params: Promise<{ region: string }> }) {
    const raw = (await params).region;
    let region = raw;
    try {
        region = decodeURIComponent(raw);
    } catch {}
    permanentRedirect(areaPath(region));
}
