import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { extractBearerToken, verifyJwtAndGetUserId } from "@/lib/auth";
import { captureApiError } from "@/lib/sentry";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
    try {
        const token = extractBearerToken(req);
        if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        let userIdStr: string;
        try {
            userIdStr = verifyJwtAndGetUserId(token);
        } catch {
            return NextResponse.json({ error: "Invalid token" }, { status: 401 });
        }

        const body = await req.json();
        const courseId = Number(body?.courseId);
        const action = String(body?.action || "").trim();

        const valid = new Set(["view", "click", "like", "share", "time_spent"]);
        if (!valid.has(action)) {
            return NextResponse.json({ error: "Invalid action" }, { status: 400 });
        }
        if (!Number.isFinite(courseId) || courseId <= 0) {
            return NextResponse.json({ error: "Invalid courseId" }, { status: 400 });
        }

        await prisma.userInteraction.create({
            data: { userId: Number(userIdStr), courseId, action },
        });

        return NextResponse.json({ success: true });
    } catch (e) {

            captureApiError(e);
        return NextResponse.json({ error: "record failed" }, { status: 500 });
    }
}
