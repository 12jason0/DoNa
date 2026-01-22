import { NextRequest, NextResponse } from "next/server";
import { resolveUserId } from "@/lib/auth";

export const dynamic = "force-dynamic";

// 간단한 사진 업로드 엔드포인트
// - 현재는 저장소 연동 없이 업로드 성공 여부만 확인해 성공 응답을 반환합니다.
// - 추후 S3 등으로 확장 가능하도록 메타데이터를 함께 받아 둡니다.
export async function POST(request: NextRequest) {
    try {
        const userIdStr = resolveUserId(request);
        const form = await request.formData();

        const file = form.get("photo");
        const storyId = form.get("storyId");
        const chapterNumber = form.get("chapterNumber");

        if (!(file instanceof File)) {
            return NextResponse.json({ error: "사진 파일이 필요합니다" }, { status: 400 });
        }

        // 간단한 용량 제한(50MB)
        const maxBytes = 50 * 1024 * 1024;
        if (file.size > maxBytes) {
            return NextResponse.json({ error: "파일 크기가 너무 큽니다(최대 50MB)" }, { status: 413 });
        }

        // 저장은 생략. 파일 버퍼를 읽어 유효성만 간단 확인
        const arrayBuffer = await file.arrayBuffer();
        if (arrayBuffer.byteLength <= 0) {
            return NextResponse.json({ error: "빈 파일입니다" }, { status: 400 });
        }

        // 여기에 S3 업로드 로직을 연결 가능
        // 예: const url = await uploadToS3(file, { userId, storyId, chapterNumber })

        return NextResponse.json({
            ok: true,
            receivedBytes: arrayBuffer.byteLength,
            contentType: file.type,
            fileName: (file as any).name ?? "photo.jpg",
            userId: userIdStr ? Number(userIdStr) : null,
            storyId: storyId ? Number(storyId) : null,
            chapterNumber: chapterNumber ? Number(chapterNumber) : null,
        });
    } catch (error) {
        return NextResponse.json({ error: "사진 업로드 실패" }, { status: 500 });
    }
}
