import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const url = searchParams.get("url");
        if (!url) return new NextResponse("Missing url", { status: 400 });

        const upstream = await fetch(url, { cache: "no-store" });
        if (!upstream.ok) {
            return new NextResponse("Upstream fetch failed", { status: 502 });
        }
        const buffer = await upstream.arrayBuffer();
        const contentType = upstream.headers.get("content-type") || "image/jpeg";
        return new NextResponse(buffer, {
            status: 200,
            headers: {
                "Content-Type": contentType,
                "Cache-Control": "public, max-age=3600",
                "Access-Control-Allow-Origin": "*",
            },
        });
    } catch (e: any) {
        return new NextResponse("Proxy error", { status: 500 });
    }
}
