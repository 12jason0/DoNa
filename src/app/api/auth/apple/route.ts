import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import prisma from "@/lib/db";
import { getJwtSecret } from "@/lib/auth";
import { getSafeRedirectPath } from "@/lib/redirect";
import { getS3StaticUrl } from "@/lib/s3Static";

export const dynamic = "force-dynamic";

/**
 * 💡 Redirect URI 생성 (애플 설정과 100% 일치)
 * image_e89e4a에서 설정하신 주소와 토씨 하나 안 틀리고 똑같이 맞춰줍니다.
 */
const getAppleRedirectUri = (origin: string) => {
    // 🟢 [Fix]: 환경변수로 Redirect URI 직접 설정 (애플 개발자 포털과 정확히 일치)
    if (process.env.NEXT_PUBLIC_APPLE_REDIRECT_URI) {
        return process.env.NEXT_PUBLIC_APPLE_REDIRECT_URI;
    }
    // 🟢 Fallback: 프로덕션은 고정 도메인, 개발은 동적 origin
    const base = process.env.NODE_ENV === "production" ? "https://dona.io.kr" : origin;
    return `${base}/api/auth/apple/callback`;
};

/**
 * 1. Apple 인증 시작 (GET)
 */
export async function GET(request: NextRequest) {
    const APPLE_CLIENT_ID = process.env.APPLE_CLIENT_ID || process.env.NEXT_PUBLIC_APPLE_CLIENT_ID;
    const next = getSafeRedirectPath(request.nextUrl.searchParams.get("next"), "/");

    // 🟢 [Debug]: 환경 변수 확인
    if (process.env.NODE_ENV === "development") {
        console.log("[Apple Auth] 환경 변수 확인:", {
            APPLE_CLIENT_ID: APPLE_CLIENT_ID ? "설정됨" : "누락",
            NEXT_PUBLIC_APPLE_CLIENT_ID: process.env.NEXT_PUBLIC_APPLE_CLIENT_ID ? "설정됨" : "누락",
            NEXT_PUBLIC_APPLE_REDIRECT_URI: process.env.NEXT_PUBLIC_APPLE_REDIRECT_URI || "미설정 (fallback 사용)",
        });
    }

    if (!APPLE_CLIENT_ID) {
        console.error("[Apple Auth] ❌ APPLE_CLIENT_ID 환경 변수가 설정되지 않았습니다.");
        return NextResponse.json({ error: "Apple 로그인 설정 누락" }, { status: 500 });
    }

    const origin = request.nextUrl.origin.includes("0.0.0.0") ? "http://localhost:3000" : request.nextUrl.origin;
    const APPLE_REDIRECT_URI = getAppleRedirectUri(origin);

    const params = new URLSearchParams({
        client_id: APPLE_CLIENT_ID,
        redirect_uri: APPLE_REDIRECT_URI, // 👈 invalid_request 해결 핵심
        response_type: "code id_token",
        response_mode: "form_post",
        scope: "name email",
        state: next,
    });

    const appleAuthUrl = `https://appleid.apple.com/auth/authorize?${params.toString()}`;
    // 🟢 [Debug]: 리다이렉트 URI 확인
    if (process.env.NODE_ENV === "development") {
        console.log("[Apple Auth] Redirect URI:", APPLE_REDIRECT_URI);
        console.log("[Apple Auth] Full URL:", appleAuthUrl);
    }
    return NextResponse.redirect(appleAuthUrl);
}

/**
 * 2. 통합 인증 처리 (POST)
 */
export async function POST(request: NextRequest) {
    try {
        const contentType = request.headers.get("content-type") || "";

        // A. 웹/웹뷰 콜백 (Form POST 방식)
        if (contentType.includes("application/x-www-form-urlencoded")) {
            const formDataText = await request.text();
            const params = new URLSearchParams(formDataText);
            const id_token = params.get("id_token");
            const state = params.get("state") || "/";
            const next = getSafeRedirectPath(state, "/");

            if (!id_token) {
                return generateHtmlResponse(`alert('토큰이 없습니다.'); window.location.href='/login';`);
            }
            return await handleWebAppleAuthLogic(id_token, next);
        }

        // B. 앱 네이티브 (Face ID 인증 데이터 - JSON 방식)
        const body = await request.json();
        const { identityToken, fullName, email: appEmail, authorizationCode } = body;

        if (!identityToken) {
            return NextResponse.json({ error: "인증 토큰 누락" }, { status: 400 });
        }
        return await handleAppAppleAuthLogic(request, identityToken, fullName, appEmail, authorizationCode);
    } catch (error) {
        console.error("Apple POST API 오류:", error);
        return NextResponse.json({ error: "서버 오류" }, { status: 500 });
    }
}

/**
 * 💡 웹 전용 로직 (신규 가입 혜택 및 리다이렉트 포함)
 */
async function handleWebAppleAuthLogic(idToken: string, next: string) {
    try {
        const decoded: any = jwt.decode(idToken);
        const appleUserId = decoded.sub;
        const email = decoded.email;

        // 🟢 두나 기본 프로필 이미지 설정 (로컬 로그인과 동일)
        const DEFAULT_PROFILE_IMG = getS3StaticUrl("profileLogo.png");

        // 🟢 [Fix]: Race Condition 방지 - upsert로 원자적 처리
        const result = await (prisma as any).$transaction(async (tx: any) => {
            const existedBefore = await tx.user.findFirst({
                where: { socialId: appleUserId, provider: "apple" },
            });

            let updateData: any = {};
            let createEmail = email;
            if (email) {
                const existingAppleUser = existedBefore;

                // email이 다른 사용자에게 할당되어 있는지 확인 (기존 Apple 사용자 제외)
                const existingUserWithEmail = await tx.user.findFirst({
                    where: {
                        email: email,
                        NOT: existingAppleUser ? { id: existingAppleUser.id } : undefined,
                    },
                });
                
                if (existingUserWithEmail) {
                    // 🟢 [Fix]: email이 다른 사용자에게 할당되어 있으면 email을 null로 설정 (중복 방지)
                    console.warn(`[Apple Auth] Email ${email} is already assigned to another user, setting email to null for new user`);
                    if (existingAppleUser) {
                        // 기존 사용자 업데이트 시 email 업데이트 건너뛰기
                        updateData.email = undefined; // undefined로 설정하면 업데이트하지 않음
                    } else {
                        // 신규 사용자 생성 시 email을 null로 설정
                        createEmail = null;
                    }
                } else {
                    // email이 사용 가능하면 정상적으로 설정
                    if (existingAppleUser) {
                        updateData.email = email;
                    }
                }
            }

            // 🟢 upsert로 원자적 처리 (이미 있으면 업데이트, 없으면 생성)
            // 🟢 [Fix]: email 충돌 방지를 위해 update/create 데이터 분리
            const upsertWhere = {
                unique_social_provider: {
                    socialId: appleUserId,
                    provider: "apple",
                },
            };
            
            let upsertedUser;
            try {
                upsertedUser = await tx.user.upsert({
                    where: upsertWhere,
                    update: {
                        // 기존 유저의 경우 프로필 정보만 업데이트 (email은 충돌 없을 때만)
                        ...updateData,
                    },
                    create: {
                        email: createEmail, // 🟢 충돌 없을 때만 email 설정, 있으면 null
                        username: `user_${appleUserId.substring(0, 6)}`,
                        socialId: appleUserId,
                        provider: "apple",
                        profileImageUrl: DEFAULT_PROFILE_IMG,
                    },
                });
            } catch (upsertError: any) {
                // 🟢 [Fix]: upsert 실패 시 (email unique constraint 등) 재시도 로직
                if (upsertError?.code === "P2002" && upsertError?.meta?.target?.includes("email")) {
                    console.warn(`[Apple Auth] Email unique constraint 에러 재시도: ${email}`);
                    // email을 null로 설정하고 재시도
                    upsertedUser = await tx.user.upsert({
                        where: upsertWhere,
                        update: {
                            ...updateData,
                            email: undefined, // email 업데이트 건너뛰기
                        },
                        create: {
                            email: null, // 🟢 email 충돌 시 null로 생성
                            username: `user_${appleUserId.substring(0, 6)}`,
                            socialId: appleUserId,
                            provider: "apple",
                            profileImageUrl: DEFAULT_PROFILE_IMG,
                        },
                    });
                } else {
                    throw upsertError; // 다른 에러는 그대로 throw
                }
            }

            // 🟢 프로필 이미지가 없으면 기본 이미지로 업데이트
            if (!upsertedUser.profileImageUrl) {
                await tx.user.update({
                    where: { id: upsertedUser.id },
                    data: { profileImageUrl: DEFAULT_PROFILE_IMG },
                });
                upsertedUser.profileImageUrl = DEFAULT_PROFILE_IMG;
            }

            return { user: upsertedUser, isNew: !existedBefore };
        });

        const user = result.user;

        const serviceToken = jwt.sign({ userId: user.id, name: user.username }, getJwtSecret(), { expiresIn: "365d" });
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
                        
                        // 🟢 [Fix]: 팝업은 메시지만 전송하고 즉시 닫기 (부모 창 리다이렉트 간섭 금지)
                        // 3. 팝업 창 즉시 닫기
                        window.close();
                    } else {
                        // 팝업이 아닌 경우 직접 리다이렉트
                        window.dispatchEvent(new CustomEvent('authLoginSuccess'));
                        window.location.replace("${decodedNext}");
                    }
                } catch (err) {
                    console.error('Apple 로그인 팝업 처리 오류:', err);
                    // 에러 발생 시 팝업이 아닌 경우에만 직접 리다이렉트
                    if (!window.opener || window.opener.closed) {
                        window.location.replace("${decodedNext}");
                    }
                }
            })();`,
            serviceToken
        );
    } catch (err: any) {
        console.error("[Apple Auth] 웹 인증 오류:", {
            error: err?.message,
            code: err?.code,
            meta: err?.meta,
            stack: err?.stack,
        });
        
        // 🟢 [Fix]: Unique constraint 에러를 명확히 처리
        let errorMsg = err instanceof Error ? err.message : "알 수 없는 오류";
        if (err?.code === "P2002" && err?.meta?.target?.includes("email")) {
            errorMsg = "이미 다른 계정으로 등록된 이메일입니다.";
            console.error("[Apple Auth] Email unique constraint 에러 - email이 이미 다른 사용자에게 할당됨");
        }
        
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
 * 💡 앱 네이티브 로직 (Face ID 지원 및 로그 저장)
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
        const appleUserId = decoded.sub;
        const email = appEmail || decoded.email;

        // 🟢 두나 기본 프로필 이미지 설정 (로컬 로그인과 동일)
        const DEFAULT_PROFILE_IMG = getS3StaticUrl("profileLogo.png");

        // 🟢 [Fix]: Race Condition 방지 - upsert로 원자적 처리
        const result = await (prisma as any).$transaction(async (tx: any) => {
            const existedBefore = await tx.user.findFirst({
                where: { socialId: appleUserId, provider: "apple" },
            });

            let updateData: any = {};
            let createEmail = email;
            if (email) {
                const existingAppleUser = existedBefore;

                // email이 다른 사용자에게 할당되어 있는지 확인 (기존 Apple 사용자 제외)
                const existingUserWithEmail = await tx.user.findFirst({
                    where: {
                        email: email,
                        NOT: existingAppleUser ? { id: existingAppleUser.id } : undefined,
                    },
                });
                
                if (existingUserWithEmail) {
                    // 🟢 [Fix]: email이 다른 사용자에게 할당되어 있으면 email을 null로 설정 (중복 방지)
                    console.warn(`[Apple Auth] Email ${email} is already assigned to another user, setting email to null for new user`);
                    if (existingAppleUser) {
                        // 기존 사용자 업데이트 시 email 업데이트 건너뛰기
                        updateData.email = undefined; // undefined로 설정하면 업데이트하지 않음
                    } else {
                        // 신규 사용자 생성 시 email을 null로 설정
                        createEmail = null;
                    }
                } else {
                    // email이 사용 가능하면 정상적으로 설정
                    if (existingAppleUser) {
                        updateData.email = email;
                    }
                }
            }
            
            if (fullName) {
                const username = `${fullName.familyName || ""}${fullName.givenName || ""}`.trim();
                if (username) {
                    updateData.username = username;
                }
            }

            // 🟢 upsert로 원자적 처리 (이미 있으면 업데이트, 없으면 생성)
            // 🟢 [Fix]: email 충돌 방지를 위해 update/create 데이터 분리
            const upsertWhere = {
                unique_social_provider: {
                    socialId: appleUserId,
                    provider: "apple",
                },
            };
            
            let upsertedUser;
            try {
                upsertedUser = await tx.user.upsert({
                    where: upsertWhere,
                    update: {
                        // 기존 유저의 경우 프로필 정보만 업데이트 (email은 충돌 없을 때만)
                        ...updateData,
                    },
                    create: {
                        email: createEmail, // 🟢 충돌 없을 때만 email 설정, 있으면 null
                        username: fullName
                            ? `${fullName.familyName || ""}${fullName.givenName || ""}`.trim()
                            : `user_${appleUserId.substring(0, 6)}`,
                        socialId: appleUserId,
                        provider: "apple",
                        profileImageUrl: DEFAULT_PROFILE_IMG,
                    },
                });
            } catch (upsertError: any) {
                // 🟢 [Fix]: upsert 실패 시 (email unique constraint 등) 재시도 로직
                if (upsertError?.code === "P2002" && upsertError?.meta?.target?.includes("email")) {
                    console.warn(`[Apple Auth] Email unique constraint 에러 재시도: ${email}`);
                    // email을 null로 설정하고 재시도
                    upsertedUser = await tx.user.upsert({
                        where: upsertWhere,
                        update: {
                            ...updateData,
                            email: undefined, // email 업데이트 건너뛰기
                        },
                        create: {
                            email: null, // 🟢 email 충돌 시 null로 생성
                            username: fullName
                                ? `${fullName.familyName || ""}${fullName.givenName || ""}`.trim()
                                : `user_${appleUserId.substring(0, 6)}`,
                            socialId: appleUserId,
                            provider: "apple",
                            profileImageUrl: DEFAULT_PROFILE_IMG,
                        },
                    });
                } else {
                    throw upsertError; // 다른 에러는 그대로 throw
                }
            }

            // 🟢 프로필 이미지가 없으면 기본 이미지로 업데이트
            if (!upsertedUser.profileImageUrl) {
                await tx.user.update({
                    where: { id: upsertedUser.id },
                    data: { profileImageUrl: DEFAULT_PROFILE_IMG },
                });
                upsertedUser.profileImageUrl = DEFAULT_PROFILE_IMG;
            }

            return { user: upsertedUser, isNew: !existedBefore };
        });

        const user = result.user;

        const token = jwt.sign({ userId: user.id, name: user.username }, getJwtSecret(), { expiresIn: "365d" });

        // [기능 유지] 로그인 로그 저장 로직
        const ip = request.headers.get("x-forwarded-for") || "unknown";
        await (prisma as any).loginLog.create({
            data: { userId: user.id, ipAddress: Array.isArray(ip) ? ip[0] : ip },
        });

        const res = NextResponse.json({ success: true, user: { id: user.id, name: user.username } });

        // 🟢 [Fix]: 이전 세션 파편 완전 제거 (로컬/카카오/애플 로그인 통합)
        res.cookies.delete("auth");
        res.cookies.delete("authorization");

        // 🟢 [Fix]: 보안 쿠키 설정 강화 (WebView 환경 대응)
        res.cookies.set("auth", token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            path: "/",
            maxAge: 60 * 60 * 24 * 365,
        });
        
        // 🟢 [Fix]: WebView에서 쿠키 설정을 확실히 하기 위해 Set-Cookie 헤더 직접 설정
        const cookieOptions = [
            `auth=${token}`,
            "Path=/",
            "HttpOnly",
            process.env.NODE_ENV === "production" ? "Secure" : "",
            "SameSite=Lax",
            `Max-Age=${60 * 60 * 24 * 365}`,
        ].filter(Boolean).join("; ");
        res.headers.set("Set-Cookie", cookieOptions);

        return res;
    } catch (err: any) {
        console.error("[Apple Auth] 앱 인증 오류:", {
            error: err?.message,
            code: err?.code,
            meta: err?.meta,
            stack: err?.stack,
        });
        
        // 🟢 [Fix]: Unique constraint 에러를 명확히 처리
        if (err?.code === "P2002" && err?.meta?.target?.includes("email")) {
            console.error("[Apple Auth] Email unique constraint 에러 - email이 이미 다른 사용자에게 할당됨");
            return NextResponse.json({ 
                error: "이미 다른 계정으로 등록된 이메일입니다.",
                code: "EMAIL_ALREADY_EXISTS"
            }, { status: 409 });
        }
        
        return NextResponse.json({ 
            error: "App 인증 실패",
            message: err?.message || "알 수 없는 오류"
        }, { status: 401 });
    }
}

/**
 * 💡 공통 응답 처리 (보안 쿠키 발급)
 */
function generateHtmlResponse(script: string, token?: string) {
    // 🟢 [Fix]: 빈 페이지로 표시하고 스크립트만 실행 (팝업에 아무것도 보이지 않도록)
    const html = `<html><head><meta charset="UTF-8"><style>body{display:none;margin:0;padding:0;}</style></head><body><script>${script}</script></body></html>`;
    const response = new NextResponse(html, {
        headers: { "Content-Type": "text/html; charset=utf-8" },
    });

    if (token) {
        // 🟢 [Fix]: 이전 세션 파편 완전 제거 (로컬/카카오/애플 로그인 통합)
        response.cookies.delete("auth");
        response.cookies.delete("authorization");
        
        // 🟢 [Fix]: 보안 쿠키 설정 강화 (WebView 환경 대응)
        response.cookies.set("auth", token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            path: "/",
            maxAge: 60 * 60 * 24 * 365,
        });
        
        // 🟢 [Fix]: WebView에서 쿠키 설정을 확실히 하기 위해 Set-Cookie 헤더 직접 설정
        const cookieOptions = [
            `auth=${token}`,
            "Path=/",
            "HttpOnly",
            process.env.NODE_ENV === "production" ? "Secure" : "",
            "SameSite=Lax",
            `Max-Age=${60 * 60 * 24 * 365}`,
        ].filter(Boolean).join("; ");
        response.headers.set("Set-Cookie", cookieOptions);
    }
    return response;
}
