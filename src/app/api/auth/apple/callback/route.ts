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
        // 🟢 [Fix]: next가 없거나 로그인 페이지면 메인으로, 있으면 그곳으로
        const decodedNext =
            next && !next.startsWith("/login") && next !== "/login"
                ? decodeURIComponent(next).replace(/^%2F/, "/")
                : "/";

        return generateHtmlResponse(
            `(function() {
                // 🟢 [Fix]: 페이지 내용 숨기기 (팝업에 아무것도 표시되지 않도록)
                document.body.style.display = 'none';
                
                try {
                    // 🟢 [Fix]: 팝업 창은 메시지만 전송하고 닫기, 리다이렉트는 부모 창에 맡김
                    if (window.opener && !window.opener.closed) {
                        // 1. 부모 창에 성공 메시지와 토큰, 리다이렉트 경로 전송
                        window.opener.postMessage({ 
                            type: 'APPLE_LOGIN_SUCCESS', 
                            token: '${serviceToken}',
                            next: '${decodedNext}' 
                        }, window.location.origin);
                        
                        // 2. 부모 창에 이벤트 알림
                        window.opener.dispatchEvent(new CustomEvent('authLoginSuccess'));
                        
                        // 3. 팝업 창 즉시 닫기 (여러 번 시도하여 확실하게)
                        setTimeout(function() {
                            window.close();
                        }, 0);
                        window.close();
                    } else {
                        // 팝업이 아닌 경우 직접 리다이렉트
                        window.dispatchEvent(new CustomEvent('authLoginSuccess'));
                        window.location.replace("${decodedNext}");
                    }
                } catch (err) {
                    console.error('Apple 로그인 팝업 처리 오류:', err);
                    try {
                        window.close();
                    } catch (e) {
                        window.location.replace("${decodedNext}");
                    }
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
                        window.opener.postMessage({ type: 'APPLE_LOGIN_ERROR', error: ${JSON.stringify(
                            errorMsg
                        )} }, window.location.origin);
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
