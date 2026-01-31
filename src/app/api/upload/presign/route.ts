import { NextResponse, NextRequest } from "next/server";
import { getS3PublicUrl, getPresignedPutUrl } from "@/lib/s3";
import { resolveUserId } from "@/lib/auth";
import { randomBytes } from "crypto";
import prisma from "@/lib/db";

export const runtime = "nodejs";

const MAX_BYTES = 50 * 1024 * 1024; // 50MB

/** POST /api/upload/presign
 * Body: { type?, userId?, courseId?, escapeId?, files: [{ filename, contentType, size }] }
 * Returns: { uploads: [{ uploadUrl, publicUrl }] }
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const type = (body.type as string) || null;
        const userId =
            resolveUserId(request) ||
            (body.userId != null ? String(body.userId) : null);
        const courseId = body.courseId != null ? String(body.courseId) : null;
        const escapeId = body.escapeId != null ? String(body.escapeId) : null;
        const files = Array.isArray(body.files) ? body.files : [];

        if (!files.length) {
            return NextResponse.json(
                { message: "업로드할 파일 정보가 없습니다." },
                { status: 400 }
            );
        }

        if (type === "review" && !courseId) {
            return NextResponse.json(
                { message: "리뷰 업로드에는 courseId가 필요합니다." },
                { status: 400 }
            );
        }
        if (type === "memory" && !userId) {
            return NextResponse.json(
                { message: "개인 추억 업로드에는 userId가 필요합니다." },
                { status: 400 }
            );
        }
        if (type === "escape" && (!userId || !escapeId)) {
            return NextResponse.json(
                { message: "탈출방 업로드에는 userId와 escapeId가 필요합니다." },
                { status: 400 }
            );
        }

        const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
        let userName: string | null = null;

        if (type === "memory" && userId) {
            try {
                const user = await prisma.user.findUnique({
                    where: { id: Number(userId) },
                    select: { username: true },
                });
                if (user?.username) {
                    userName =
                        user.username.replace(
                            /[^a-zA-Z0-9가-힣_!\-.*'()]/g,
                            "_"
                        ).trim() || `user_${userId}`;
                } else {
                    userName = `user_${userId}`;
                }
            } catch {
                userName = `user_${userId}`;
            }
        }

        const uploads: { uploadUrl: string; publicUrl: string }[] = [];

        for (const f of files) {
            const filename = (f.filename as string) || "image.jpg";
            const contentType =
                (f.contentType as string) || "image/jpeg";
            const size = Number(f.size) || 0;

            if (size > MAX_BYTES) {
                return NextResponse.json(
                    {
                        message: `파일 크기가 너무 큽니다. 최대 50MB까지 업로드 가능합니다. (${filename})`,
                    },
                    { status: 413 }
                );
            }

            const originalExt =
                filename.split(".").pop()?.toLowerCase() || "jpg";
            const safeExt = originalExt.replace(/[^a-z0-9]/g, "").slice(0, 10);
            const uniqueFileName = `${Date.now()}-${randomBytes(8).toString("hex")}.${safeExt}`;

            let key: string;
            if (type === "memory" && userId && userName) {
                key = `courses/${userName}/${dateStr}_${uniqueFileName}`;
            } else if (type === "review" && courseId) {
                key = `reviews/course_${courseId}/${dateStr}_${uniqueFileName}`;
            } else if (type === "escape" && userId && escapeId) {
                key = `escape/user_${userId}/escape_${escapeId}/${dateStr}_${uniqueFileName}`;
            } else {
                key = `uploads/${dateStr}/${uniqueFileName}`;
            }

            const uploadUrl = await getPresignedPutUrl(key, contentType);
            const publicUrl = getS3PublicUrl(key);
            uploads.push({ uploadUrl, publicUrl });
        }

        return NextResponse.json({ success: true, uploads });
    } catch (error: any) {
        console.error("[/api/upload/presign] Error:", error);
        return NextResponse.json(
            { message: error?.message || "Presign 처리 중 오류가 발생했습니다." },
            { status: 500 }
        );
    }
}
