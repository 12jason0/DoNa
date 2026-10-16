import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { captureApiError } from "@/lib/sentry";
import { checkRateLimit, getIdentifierFromRequest } from "@/lib/rateLimit";
import { sendTelegram } from "@/lib/telegram";
import { telegramAdminIds } from "@/lib/instagramDm";
import { INQUIRY_TYPES, type InquiryType } from "@/lib/partnerInquiry";

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

/** 제휴·광고 문의 접수 → DB 저장 + 텔레그램 알림 (로그인 불필요) */
export async function POST(req: NextRequest) {
    try {
        const body = await req.json().catch(() => ({}));

        // honeypot: 사람 눈엔 안 보이는 칸. 채워졌으면 봇 → 저장 없이 성공처럼 응답
        if (str(body.website, 200)) return NextResponse.json({ ok: true });

        const brandName = str(body.brandName, 100);
        const contactName = str(body.contactName, 50);
        const contact = str(body.contact, 100);
        const message = str(body.message, 2000);
        const inquiryType = body.inquiryType as InquiryType;
        if (!brandName || !contactName || !contact || !message || !Object.hasOwn(INQUIRY_TYPES, inquiryType) || body.agree !== true) {
            return NextResponse.json({ error: "필수 항목을 모두 입력해 주세요." }, { status: 400 });
        }

        // 같은 IP 10분에 3건까지. Redis 장애 시엔 막지 않음 (문의 유실이 스팸보다 나쁨)
        const rl = await checkRateLimit("partner_inquiry", getIdentifierFromRequest(req)).catch(() => ({ success: true }));
        if (!rl.success) {
            return NextResponse.json({ error: "잠시 후 다시 시도해 주세요." }, { status: 429 });
        }

        const row = await prisma.partnerInquiry.create({
            data: { brand_name: brandName, contact_name: contactName, contact, inquiry_type: inquiryType, message },
        });

        const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://dona.io.kr";
        const text = [
            "📮 새 제휴·광고 문의",
            "",
            `브랜드: ${brandName}`,
            `담당자: ${contactName}`,
            `연락처: ${contact}`,
            `종류: ${INQUIRY_TYPES[inquiryType]}`,
            "",
            message,
            "",
            `관리자: ${siteUrl}/admin/partner?id=${row.id}`,
        ].join("\n");
        await Promise.all(telegramAdminIds().map((id) => sendTelegram(id, text)));

        return NextResponse.json({ ok: true });
    } catch (error) {
        captureApiError(error);
        console.error("/api/partner POST error:", error);
        return NextResponse.json({ error: "접수 중 오류가 발생했어요. 잠시 후 다시 시도해 주세요." }, { status: 500 });
    }
}
