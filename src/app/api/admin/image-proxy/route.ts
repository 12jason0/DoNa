import { NextRequest, NextResponse } from "next/server";
import { isDemoMode } from "@/lib/demo";

export async function GET(req: NextRequest) {
    const url = req.nextUrl.searchParams.get("url");
    if (!url) return new NextResponse("missing url", { status: 400 });
    // 체험 데모: 예시 이미지는 같은 사이트의 /demo/ 파일이라 바로 넘기고, 바깥 주소는 부르지 않음
    if (isDemoMode()) {
        if (url.startsWith("/demo/")) return NextResponse.redirect(new URL(url, req.nextUrl.origin));
        return new NextResponse("demo: external fetch blocked", { status: 403 });
    }

    try {
        const res = await fetch(url);
        if (!res.ok) return new NextResponse("upstream error", { status: res.status });

        const buf = await res.arrayBuffer();
        const ct = res.headers.get("content-type") || "image/jpeg";

        return new NextResponse(buf, {
            headers: {
                "Content-Type": ct,
                "Cache-Control": "public, max-age=86400",
                "Access-Control-Allow-Origin": "*",
            },
        });
    } catch {
        return new NextResponse("fetch failed", { status: 502 });
    }
}
