import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { verifyAdminJwt } from "@/lib/auth";
import { captureApiError } from "@/lib/sentry";
import { INQUIRY_STATUSES } from "@/lib/partnerInquiry";

const unauthorized = () => NextResponse.json({ error: "관리자 인증이 필요합니다." }, { status: 401 });

export async function GET(req: NextRequest) {
    if (!verifyAdminJwt(req)) return unauthorized();
    try {
        // ponytail: 최근 200건만. 넘으면 페이지네이션 추가
        const inquiries = await prisma.partnerInquiry.findMany({ orderBy: { created_at: "desc" }, take: 200 });
        return NextResponse.json({ inquiries });
    } catch (error) {
        captureApiError(error);
        return NextResponse.json({ error: "문의 목록 조회 실패" }, { status: 500 });
    }
}

/** body: { id, status } */
export async function PATCH(req: NextRequest) {
    if (!verifyAdminJwt(req)) return unauthorized();
    try {
        const { id, status } = await req.json();
        if (!Number.isInteger(id) || !Object.hasOwn(INQUIRY_STATUSES, status)) {
            return NextResponse.json({ error: "잘못된 요청" }, { status: 400 });
        }
        const inquiry = await prisma.partnerInquiry.update({ where: { id }, data: { status } });
        return NextResponse.json({ inquiry });
    } catch (error) {
        captureApiError(error);
        return NextResponse.json({ error: "상태 변경 실패" }, { status: 500 });
    }
}
