import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import prisma from "@/lib/db";
import { getJwtSecret } from "@/lib/auth";
import { getSafeRedirectPath } from "@/lib/redirect";
import { getS3StaticUrl } from "@/lib/s3Static";

export const dynamic = "force-dynamic";

/**
 * 🟢 [Fix]: 콜백 라우트에서 직접 인증 처리 (중간 요청 제거)
 */
export async function POST(request: NextRequest) {
    const origin = request.nextUrl.origin;

    try {
        // Form POST 데이터 파싱
        const formDataText = await request.text();
        const params = new URLSearchParams(formDataText);
        const id_token = params.get("id_token");
        const state = params.get("state") || "/";
        const next = getSafeRedirectPath(state, "/");

        if (!id_token) {
            return generateHtmlResponse(`alert('토큰이 없습니다.'); window.location.href='/login';`);
        }

        // 🟢 [Fix]: 직접 인증 처리 (중간 요청 제거)
        const decoded: any = jwt.decode(id_token);
        const appleUserId = decoded.sub;
        const email = decoded.email;

        const DEFAULT_PROFILE_IMG = getS3StaticUrl("profileLogo.png");

        // 🟢 [Fix]: Race Condition 방지 - upsert로 원자적 처리
        const result = await (prisma as any).$transaction(async (tx: any) => {
            const now = new Date();
            const utc = now.getTime() + now.getTimezoneOffset() * 60000;
            const kstNow = new Date(utc + 9 * 60 * 60 * 1000);
            const eventEndDate = new Date("2026-01-10T23:59:59+09:00");
            const initialCoupons = kstNow <= eventEndDate ? 2 : 1;

            const upsertedUser = await tx.user.upsert({
                where: {
                    unique_social_provider: {
                        socialId: appleUserId,
                        provider: "apple",
                    },
                },
                update: {
                    email: email || undefined,
                },
                create: {
                    email,
                    username: `user_${appleUserId.substring(0, 6)}`,
                    socialId: appleUserId,
                    provider: "apple",
                    couponCount: initialCoupons,
                    profileImageUrl: DEFAULT_PROFILE_IMG,
                },
            });

            if (!upsertedUser.profileImageUrl) {
                await tx.user.update({
                    where: { id: upsertedUser.id },
                    data: { profileImageUrl: DEFAULT_PROFILE_IMG },
                });
                upsertedUser.profileImageUrl = DEFAULT_PROFILE_IMG;
            }

            const existingReward = await tx.userReward.findFirst({
                where: {
                    userId: upsertedUser.id,
                    type: "signup",
                },
            });

            if (!existingReward) {
                await tx.userReward.create({
                    data: { userId: upsertedUser.id, type: "signup", amount: initialCoupons, unit: "coupon" },
                });
                return { user: upsertedUser, isNew: true };
            }

            return { user: upsertedUser, isNew: false };
        });

        const user = result.user;
        const serviceToken = jwt.sign({ userId: user.id, name: user.username }, getJwtSecret(), { expiresIn: "7d" });
        const decodedNext = decodeURIComponent(next).replace(/^%2F/, "/");

        return generateHtmlResponse(
            `(function() {
                try {
                    // 🟢 [Fix]: 부모 창으로 로그인 성공 메시지 전송
                    if (window.opener && !window.opener.closed) {
                        window.opener.postMessage({ type: 'APPLE_LOGIN_SUCCESS', token: '${serviceToken}' }, window.location.origin);
                        window.opener.dispatchEvent(new CustomEvent('authLoginSuccess'));
                        window.opener.location.href = "${decodedNext}";
                        window.close();
                    } else {
                        window.dispatchEvent(new CustomEvent('authLoginSuccess'));
                        window.location.href = "${decodedNext}";
                    }
                } catch (err) {
                    console.error('Apple 로그인 후처리 오류:', err);
                    window.location.href = "${decodedNext}";
                }
            })();`,
            serviceToken
        );
    } catch (err) {
        console.error("[Apple Callback] 오류:", err);
        const errorMsg = err instanceof Error ? err.message : "알 수 없는 오류";
        return generateHtmlResponse(
            `(function() {
                try {
                    if (window.opener && !window.opener.closed) {
                        window.opener.postMessage({ type: 'APPLE_LOGIN_ERROR', error: ${JSON.stringify(errorMsg)} }, window.location.origin);
                        window.close();
                    } else {
                        alert('인증 실패: ' + ${JSON.stringify(errorMsg)});
                        window.location.href = '/login';
                    }
                } catch (e) {
                    console.error('에러 처리 중 오류:', e);
                    window.location.href = '/login';
                }
            })();`
        );
    }
}

/**
 * 💡 공통 응답 처리 (보안 쿠키 발급)
 */
function generateHtmlResponse(script: string, token?: string) {
    const html = `<html><head><meta charset="UTF-8"></head><body><script>${script}</script></body></html>`;
    const response = new NextResponse(html, {
        headers: { "Content-Type": "text/html; charset=utf-8" },
    });

    if (token) {
        response.cookies.set("auth", token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            path: "/",
            maxAge: 60 * 60 * 24 * 7,
        });
    }
    return response;
}
