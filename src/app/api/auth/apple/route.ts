import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import prisma from "@/lib/db";
import { getJwtSecret } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * 1. Apple 인증 시작 (GET)
 */
export async function GET(request: NextRequest) {
    const APPLE_CLIENT_ID = process.env.APPLE_CLIENT_ID || process.env.NEXT_PUBLIC_APPLE_CLIENT_ID;
    const APPLE_REDIRECT_URI = "https://dona.io.kr/api/auth/apple";

    if (!APPLE_CLIENT_ID) {
        console.error("APPLE_CLIENT_ID가 설정되지 않았습니다.");
        return NextResponse.json({ error: "Apple 로그인 설정이 누락되었습니다." }, { status: 500 });
    }

    const params = new URLSearchParams({
        client_id: APPLE_CLIENT_ID,
        redirect_uri: APPLE_REDIRECT_URI,
        response_type: "code",
        response_mode: "form_post",
        scope: "name email",
        state: "apple_login_state",
    });

    const appleAuthUrl = `https://appleid.apple.com/auth/authorize?${params.toString()}`;
    return NextResponse.redirect(appleAuthUrl);
}

/**
 * 2. 통합 인증 처리 (POST)
 */
export async function POST(request: NextRequest) {
    try {
        const contentType = request.headers.get("content-type") || "";

        if (contentType.includes("application/x-www-form-urlencoded")) {
            const formDataText = await request.text();
            const params = new URLSearchParams(formDataText);
            const code = params.get("code");
            const userJson = params.get("user");

            if (!code) {
                return generateHtmlResponse(
                    "if(window.opener){window.opener.location.href='/login?error=no_code';window.close();}else{window.location.href='/login?error=no_code';}"
                );
            }

            let userData = null;
            if (userJson) {
                try {
                    userData = JSON.parse(userJson);
                } catch (e) {
                    console.error("User JSON 파싱 실패:", e);
                }
            }

            return await handleWebAppleAuthLogic(code, request, userData);
        }

        const body = await request.json();
        const { identityToken, authorizationCode, fullName, email: appEmail } = body;

        if (!identityToken) {
            return NextResponse.json({ error: "Apple 인증 토큰이 필요합니다." }, { status: 400 });
        }

        return await handleAppAppleAuthLogic(request, identityToken, fullName, appEmail, authorizationCode);
    } catch (error) {
        console.error("Apple POST API 오류:", error);
        return NextResponse.json({ error: "서버 오류가 발생했습니다." }, { status: 500 });
    }
}

function generateHtmlResponse(script: string) {
    return new Response(`<html><head><meta charset="UTF-8"></head><body><script>${script}</script></body></html>`, {
        headers: { "Content-Type": "text/html; charset=utf-8" },
    });
}

/**
 * 웹/웹뷰용 실제 인증 로직 (팝업 닫기 및 부모 창 제어 추가)
 */
async function handleWebAppleAuthLogic(code: string, request: NextRequest, userData: any) {
    try {
        // 1. 애플 서버와 code를 실제 token으로 교환
        const tokenResponse = await fetch("https://appleid.apple.com/auth/token", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
                client_id: process.env.APPLE_CLIENT_ID!,
                client_secret: process.env.APPLE_CLIENT_SECRET!,
                code: code,
                grant_type: "authorization_code",
                redirect_uri: "https://dona.io.kr/api/auth/apple",
            }).toString(),
        });

        const tokenData = await tokenResponse.json();
        if (!tokenResponse.ok) {
            throw new Error(tokenData.error_description || "애플 토큰 교환 실패");
        }

        // 2. ID 토큰 디코딩 및 정보 획득
        const decoded: any = jwt.decode(tokenData.id_token);
        const appleUserId = decoded.sub;
        const email = decoded.email || userData?.email;
        // 탈퇴(Revoke)를 위해 꼭 저장해야 하는 리프레시 토큰
        const appleRefreshToken = tokenData.refresh_token;

        // 3. DB 유저 확인 및 업데이트/생성
        let user = await (prisma as any).user.findFirst({
            where: { provider: "apple", socialId: appleUserId },
        });

        if (!user) {
            // 신규 가입
            user = await (prisma as any).user.create({
                data: {
                    email,
                    username: userData?.name
                        ? `${userData.name.lastName}${userData.name.firstName}`.trim()
                        : `user_${appleUserId.substring(0, 6)}`,
                    socialId: appleUserId,
                    provider: "apple",
                    appleRefreshToken: appleRefreshToken, // 토큰 저장
                    couponCount: 3,
                },
            });

            try {
                await (prisma as any).userReward.create({
                    data: { userId: user.id, type: "signup", amount: 3, unit: "coupon" },
                });
            } catch (e) {
                console.error("보상 기록 실패:", e);
            }
        } else {
            // 기존 유저인 경우 리프레시 토큰 갱신 (탈퇴 기능 위해 항상 최신화)
            await (prisma as any).user.update({
                where: { id: user.id },
                data: { appleRefreshToken: appleRefreshToken },
            });
        }

        // 4. 서비스 JWT 생성
        const serviceToken = jwt.sign({ userId: user.id, email: user.email, name: user.username }, getJwtSecret(), {
            expiresIn: "7d",
        });

        // 5. [핵심 수정] 팝업 닫기 및 부모 창 제어 스크립트
        return generateHtmlResponse(`
            (function() {
                const token = "${serviceToken}";
                localStorage.setItem('authToken', token);
                
                if (window.ReactNativeWebView) {
                    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'loginSuccess', token: token }));
                }

                // 부모 창(window.opener)이 있다면 부모 창을 이동시키고 현재 팝업을 닫음
                if (window.opener) {
                    window.opener.location.href = '/?login_success=true';
                    window.close();
                } else {
                    // 팝업이 아닌 일반 리다이렉트인 경우 현재 창 이동
                    window.location.href = '/?login_success=true';
                }
            })();
        `);
    } catch (err: any) {
        console.error("Web Auth Logic Error:", err);
        return generateHtmlResponse(`
            if(window.opener) {
                window.opener.location.href='/login?error=${encodeURIComponent(err.message)}';
                window.close();
            } else {
                window.location.href='/login?error=${encodeURIComponent(err.message)}';
            }
        `);
    }
}

/**
 * 앱 네이티브용 인증 로직 (refresh_token 저장 추가)
 * 앱에서 보낸 authorizationCode를 사용해 refresh_token을 발급받고 저장합니다.
 */
async function handleAppAppleAuthLogic(
    request: NextRequest,
    identityToken: string,
    fullName: any,
    appEmail: string,
    authorizationCode?: string
) {
    try {
        const decoded: any = jwt.decode(identityToken);
        if (!decoded) {
            throw new Error("토큰 디코딩 실패");
        }

        const appleUserId = decoded.sub;
        const email = appEmail || decoded.email;
        let appleRefreshToken: string | null = null;

        // 1. 앱에서 보낸 authorizationCode가 있다면 애플 서버와 통신해서 refresh_token 획득
        if (authorizationCode) {
            try {
                // Apple Client Secret 생성 (동적 생성)
                const { generateAppleClientSecret } = await import("@/lib/config");
                const APPLE_TEAM_ID = process.env.APPLE_TEAM_ID;
                const APPLE_KEY_ID = process.env.APPLE_KEY_ID;
                const APPLE_PRIVATE_KEY = process.env.APPLE_PRIVATE_KEY;
                const APPLE_CLIENT_ID = process.env.APPLE_CLIENT_ID || process.env.NEXT_PUBLIC_APPLE_CLIENT_ID;

                if (!APPLE_TEAM_ID || !APPLE_KEY_ID || !APPLE_PRIVATE_KEY || !APPLE_CLIENT_ID) {
                    console.error("Apple 환경 변수가 설정되지 않았습니다.");
                } else {
                    const clientSecret = generateAppleClientSecret(
                        APPLE_TEAM_ID,
                        APPLE_KEY_ID,
                        APPLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
                        APPLE_CLIENT_ID
                    );

                    const tokenResponse = await fetch("https://appleid.apple.com/auth/token", {
                        method: "POST",
                        headers: { "Content-Type": "application/x-www-form-urlencoded" },
                        body: new URLSearchParams({
                            client_id: APPLE_CLIENT_ID, // 앱용: Bundle ID (kr.io.dona.dona)
                            client_secret: clientSecret,
                            code: authorizationCode,
                            grant_type: "authorization_code",
                        }).toString(),
                    });

                    const tokenData = await tokenResponse.json();

                    if (tokenResponse.ok && tokenData.refresh_token) {
                        appleRefreshToken = tokenData.refresh_token;
                        console.log("[Apple Auth] refresh_token 획득 성공");
                    } else {
                        console.error("[Apple Auth] refresh_token 획득 실패:", tokenData);
                        // refresh_token 획득 실패해도 로그인은 진행 (기존 토큰 사용)
                    }
                }
            } catch (tokenError) {
                console.error("[Apple Auth] refresh_token 획득 중 오류:", tokenError);
                // refresh_token 획득 실패해도 로그인은 진행
            }
        }

        // 2. DB 유저 확인 및 생성/업데이트
        let user = await (prisma as any).user.findFirst({
            where: { provider: "apple", socialId: appleUserId },
            select: { id: true, email: true, username: true, couponCount: true },
        });

        if (!user) {
            // 신규 가입
            const newUserData = await (prisma as any).$transaction(async (tx: any) => {
                const newUser = await tx.user.create({
                    data: {
                        email,
                        username: fullName
                            ? `${fullName.familyName || ""}${fullName.givenName || ""}`.trim() ||
                              `user_${appleUserId.substring(0, 6)}`
                            : `user_${appleUserId.substring(0, 6)}`,
                        socialId: appleUserId,
                        provider: "apple",
                        appleRefreshToken: appleRefreshToken, // 탈퇴용 토큰 저장
                        couponCount: 3,
                    },
                    select: { id: true, email: true, username: true, couponCount: true },
                });

                // 보상 기록
                try {
                    await tx.userReward.create({
                        data: { userId: newUser.id, type: "signup", amount: 3, unit: "coupon" },
                    });
                } catch (e) {
                    console.error("보상 기록 실패:", e);
                }

                return newUser;
            });

            user = newUserData;
        } else if (appleRefreshToken) {
            // 기존 유저도 로그인할 때마다 토큰 최신화 (탈퇴 기능을 위해)
            await (prisma as any).user.update({
                where: { id: user.id },
                data: { appleRefreshToken },
            });
            console.log(`[Apple Auth] User ${user.id}의 refresh_token 갱신 완료`);
        }

        // 3. 서비스 JWT 생성
        const token = jwt.sign({ userId: user.id, email: user.email, name: user.username }, getJwtSecret(), {
            expiresIn: "7d",
        });

        // 4. 로그인 로그 저장
        try {
            const ip =
                request.headers.get("x-forwarded-for") ||
                request.headers.get("x-real-ip") ||
                (request as any).socket?.remoteAddress ||
                "unknown";
            const ipAddress = Array.isArray(ip) ? ip[0] : ip;

            await (prisma as any).loginLog.create({
                data: {
                    userId: user.id,
                    ipAddress: ipAddress,
                },
            });
        } catch (logError) {
            console.error("로그인 로그 저장 실패:", logError);
        }

        return NextResponse.json({
            success: true,
            token,
            user: {
                id: user.id,
                email: user.email,
                name: user.username,
                nickname: user.username,
                coins: user.couponCount ?? 0,
            },
        });
    } catch (err: any) {
        console.error("[Apple Auth] App Auth Logic Error:", err);
        return NextResponse.json(
            {
                error: "인증 처리 중 오류 발생",
                details: err?.message || "알 수 없는 오류",
            },
            { status: 401 }
        );
    }
}
